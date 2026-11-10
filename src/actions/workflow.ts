"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/guards";
import { CALL_CENTER_CHECKS, LEGAL_DOCS, STAGES, type StageKey } from "@/lib/workflow";
import { ZONE_LETTERS } from "@/lib/zones";
import type { FormState } from "./auth";

// These actions deliberately do not call revalidatePath: the entry page is dynamic, so the
// next navigation always refetches it, and leaving the current render alone lets the action
// panel show its success state instead of unmounting mid-confirmation.
async function loadForStage(entryId: string, stageKey: StageKey) {
  const session = await requireSession();
  const stage = STAGES.find((s) => s.key === stageKey);
  if (!stage) throw new Error("Unknown stage");
  if (!stage.roles.includes(session.role) && session.role !== "ADMIN") {
    throw new Error("You do not work this stage.");
  }
  const entry = await db.query.entries.findFirst({ where: eq(schema.entries.id, entryId) });
  if (!entry) throw new Error("Entry not found.");
  if (entry.status !== stage.input) {
    throw new Error(`This entry is no longer waiting on ${stage.shortTitle}.`);
  }
  return { session, stage, entry };
}

function checksFromForm(formData: FormData, keys: { key: string }[]) {
  const out: Record<string, boolean> = {};
  for (const k of keys) out[k.key] = formData.get(`check_${k.key}`) === "on";
  return out;
}

const notes = z.string().trim().max(2000).optional().or(z.literal(""));

export async function completeStageAction(entryId: string, stageKey: StageKey, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const { session, stage, entry } = await loadForStage(entryId, stageKey);
    const note = notes.parse(formData.get("notes")) || "";
    const patch: Partial<schema.Entry> = { status: stage.output, updatedAt: new Date(), returnReason: null };
    let eventNote = note;

    switch (stage.key) {
      case "CALL_CENTER": {
        const checks = checksFromForm(formData, CALL_CENTER_CHECKS);
        const missing = CALL_CENTER_CHECKS.filter((c) => !checks[c.key]).map((c) => c.label);
        if (missing.length) return { ok: false, message: `Confirm every item with the farmer before completing. Not confirmed: ${missing.join(", ")}.` };
        patch.callCenterChecks = checks;
        patch.callCenterConfirmedAt = new Date();
        patch.callAttempts = entry.callAttempts + 1;
        eventNote = note || "All details confirmed with the farmer by phone";
        break;
      }
      case "DATA_CHECK": {
        if (formData.get("check_id") !== "on" || formData.get("check_bank") !== "on" || formData.get("check_polygon") !== "on") {
          return { ok: false, message: "Tick all three checks before approving." };
        }
        patch.dataCheckedAt = new Date();
        eventNote = note || "Data verified against ID and bank card photos";
        break;
      }
      case "LEGAL": {
        const checks = checksFromForm(formData, LEGAL_DOCS);
        const required = ["idCopy", "signedTerms"];
        const missing = required.filter((k) => !checks[k]);
        if (missing.length) return { ok: false, message: "The ID copy and the signed terms are required before confirming receipt." };
        const fileRef = z.string().trim().max(80).parse(formData.get("fileRef") ?? "");
        patch.legalDocsChecklist = checks;
        patch.legalDocsReceivedAt = new Date();
        patch.legalFileRef = fileRef || null;
        eventNote = note || `Physical documents received${fileRef ? ` · file ${fileRef}` : ""}`;
        break;
      }
      case "ERP_ENTRY": {
        const farmerCode = z.string().trim().min(1, "Enter the ERP farmer code").max(40).safeParse(formData.get("erpFarmerCode"));
        if (!farmerCode.success) return { ok: false, errors: { erpFarmerCode: "Enter the ERP farmer code" } };
        const fieldCode = z.string().trim().max(40).parse(formData.get("erpFieldCode") ?? "");
        patch.erpFarmerCode = farmerCode.data;
        patch.erpFieldCode = fieldCode || null;
        patch.erpPostedAt = new Date();
        eventNote = note || `Posted to ERP as ${farmerCode.data}${fieldCode ? ` / ${fieldCode}` : ""}`;
        break;
      }
      case "PERMIT": {
        const permit = z.string().trim().min(1).max(40).safeParse(formData.get("permitNumber"));
        const clips = z.string().trim().min(1).max(200).safeParse(formData.get("ccsClips"));
        const errors: Record<string, string> = {};
        if (!permit.success) errors.permitNumber = "Enter the permit number";
        if (!clips.success) errors.ccsClips = "Enter the CCS clip numbers issued";
        if (Object.keys(errors).length) return { ok: false, errors };
        patch.permitNumber = permit.data!;
        patch.ccsClips = clips.data!;
        patch.permitIssuedAt = new Date();
        eventNote = note || `Permit ${permit.data} issued · CCS clips ${clips.data}`;
        break;
      }
      case "ZONING": {
        if (formData.get("gisFieldInspected") !== "on" || formData.get("gisPolygonReviewed") !== "on") {
          return { ok: false, message: "Confirm the field was inspected and the polygon reviewed." };
        }
        const zone = z.enum(ZONE_LETTERS).safeParse(formData.get("gisZone"));
        const cbcId = z.string().uuid().safeParse(formData.get("gisCbcId"));
        const dist = z.coerce.number().min(0).max(500).safeParse(formData.get("gisDistanceKm"));
        const errors: Record<string, string> = {};
        if (!zone.success) errors.gisZone = "Choose the zone";
        if (!cbcId.success) errors.gisCbcId = "Choose the CBC";
        if (!dist.success) errors.gisDistanceKm = "Enter the linear distance in km";
        if (Object.keys(errors).length) return { ok: false, errors };
        patch.gisZone = zone.data!;
        patch.gisCbcId = cbcId.data!;
        patch.gisDistanceKm = dist.data!;
        patch.gisFieldInspected = true;
        patch.gisPolygonReviewed = true;
        patch.zonedAt = new Date();
        const changed = zone.data !== entry.zone || cbcId.data !== entry.nearestCbcId;
        eventNote = note || (changed ? `Zone confirmed as ${zone.data} (computed ${entry.zone ?? "—"})` : `Zone ${zone.data} confirmed`);
        break;
      }
    }

    await db.update(schema.entries).set(patch).where(eq(schema.entries.id, entryId));
    await db.insert(schema.events).values({
      entryId,
      actorId: session.id,
      action: `${stage.key}_DONE`,
      fromStatus: stage.input,
      toStatus: stage.output,
      notes: eventNote,
    });
    return { ok: true, message: `${stage.title} completed.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function returnEntryAction(entryId: string, stageKey: StageKey, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const { session, stage } = await loadForStage(entryId, stageKey);
    if (!stage.canReturn) return { ok: false, message: "This stage cannot return entries." };
    const reason = z.string().trim().min(5, "Explain what the scout must fix").max(2000).safeParse(formData.get("reason"));
    if (!reason.success) return { ok: false, errors: { reason: "Explain what the scout must fix (at least 5 characters)" } };

    await db
      .update(schema.entries)
      .set({ status: "RETURNED", returnReason: reason.data, updatedAt: new Date() })
      .where(eq(schema.entries.id, entryId));
    await db.insert(schema.events).values({
      entryId,
      actorId: session.id,
      action: `${stage.key}_RETURNED`,
      fromStatus: stage.input,
      toStatus: "RETURNED",
      notes: reason.data,
    });
    return { ok: true, message: "Returned to the scout." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function rejectEntryAction(entryId: string, stageKey: StageKey, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const { session, stage } = await loadForStage(entryId, stageKey);
    if (!stage.canReject && session.role !== "ADMIN") return { ok: false, message: "This stage cannot reject entries." };
    const reason = z.string().trim().min(5).max(2000).safeParse(formData.get("reason"));
    if (!reason.success) return { ok: false, errors: { reason: "Give the reason for rejecting (at least 5 characters)" } };

    await db
      .update(schema.entries)
      .set({ status: "REJECTED", returnReason: reason.data, updatedAt: new Date() })
      .where(eq(schema.entries.id, entryId));
    await db.insert(schema.events).values({
      entryId,
      actorId: session.id,
      action: `${stage.key}_REJECTED`,
      fromStatus: stage.input,
      toStatus: "REJECTED",
      notes: reason.data,
    });
    return { ok: true, message: "Entry rejected." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/** Call centre could not reach the farmer: keep the entry in the queue and log the attempt. */
export async function logCallAttemptAction(entryId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const { session, entry } = await loadForStage(entryId, "CALL_CENTER");
    const note = notes.parse(formData.get("notes")) || "Farmer not reachable";
    await db
      .update(schema.entries)
      .set({ callAttempts: entry.callAttempts + 1, updatedAt: new Date() })
      .where(eq(schema.entries.id, entryId));
    await db.insert(schema.events).values({
      entryId,
      actorId: session.id,
      action: "CALL_ATTEMPT",
      fromStatus: entry.status,
      toStatus: entry.status,
      notes: `Call attempt ${entry.callAttempts + 1}: ${note}`,
    });
    return { ok: true, message: "Call attempt logged. The entry stays in your queue." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Something went wrong." };
  }
}
