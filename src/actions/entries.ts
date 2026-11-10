"use server";

import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { requireSession } from "@/lib/auth/guards";
import { entryInputSchema, firstErrors, type EntryInput } from "@/lib/validation";
import { computeZoning } from "@/lib/zones";
import { DATA_PROTECTION_VERSION, TERMS_VERSION } from "@/lib/legal-text";

export type EntryActionResult = { ok: false; message?: string; errors?: Record<string, string> } | { ok: true; id: string };

async function nextReference(): Promise<string> {
  const year = new Date().getFullYear();
  const key = `entry:${year}`;
  const [row] = await db
    .insert(schema.counters)
    .values({ key, value: 1 })
    .onConflictDoUpdate({ target: schema.counters.key, set: { value: sql`${schema.counters.value} + 1` } })
    .returning({ value: schema.counters.value });
  return `CP-${year}-${String(row.value).padStart(5, "0")}`;
}

async function buildRecord(input: EntryInput) {
  const [bank, cbcList, harvester, deliveryCbc] = await Promise.all([
    db.query.banks.findFirst({ where: and(eq(schema.banks.id, input.bankId), eq(schema.banks.active, true)) }),
    db.query.cbcs.findMany({ where: eq(schema.cbcs.active, true) }),
    db.query.harvesters.findFirst({ where: and(eq(schema.harvesters.id, input.harvesterId), eq(schema.harvesters.active, true)) }),
    db.query.cbcs.findFirst({ where: eq(schema.cbcs.id, input.deliveryCbcId) }),
  ]);
  const errors: Record<string, string> = {};
  if (!bank) errors.bankId = "Choose a bank from the list";
  if (!harvester) errors.harvesterId = "Choose a harvester from the list";
  if (!deliveryCbc) errors.deliveryCbcId = "Choose a cane buying centre";
  if (bank && input.accountNumber.length !== bank.accountLength) {
    errors.accountNumber = `${bank.name} account numbers have ${bank.accountLength} digits`;
  }
  if (Object.keys(errors).length) return { errors };

  const zoning = computeZoning(input.polygon, cbcList);
  const now = new Date();
  return {
    record: {
      farmerName: input.farmerName,
      farmerPhone: input.farmerPhone.replace(/\s+/g, ""),
      farmerIdNumber: input.farmerIdNumber,
      plotLrNo: input.plotLrNo,
      estimatedAcres: input.estimatedAcres,
      estimatedTrips: input.estimatedTrips,
      sublocation: input.sublocation,
      area: input.area,
      deliveryCbcId: input.deliveryCbcId,
      harvesterId: input.harvesterId,
      polygon: input.polygon,
      centroidLat: zoning.centroid[0],
      centroidLng: zoning.centroid[1],
      polygonAcres: zoning.acres,
      polygonHectares: zoning.hectares,
      nearestCbcId: zoning.nearestCbcId,
      distanceKm: zoning.distanceKm,
      zone: zoning.zone,
      bankId: bank!.id,
      bankCode: bank!.code,
      bankName: bank!.name,
      accountNumber: input.accountNumber,
      accountName: input.accountName,
      branch: input.branch,
      bankCardPhotoUrl: input.bankCardPhotoUrl || null,
      idFrontUrl: input.idFrontUrl,
      idBackUrl: input.idBackUrl,
      farmerPhotoUrl: input.farmerPhotoUrl,
      signatureUrl: input.signatureUrl,
      termsVersion: TERMS_VERSION,
      termsAcceptedAt: now,
      dataConsentVersion: DATA_PROTECTION_VERSION,
      dataConsentAt: now,
      updatedAt: now,
    } satisfies Partial<schema.NewEntry>,
  };
}

export async function createEntryAction(raw: unknown): Promise<EntryActionResult> {
  const session = await requireSession();
  if (session.role !== "SCOUT" && session.role !== "ADMIN") return { ok: false, message: "Only scouts can submit entries." };

  const parsed = entryInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error), message: "Some fields need attention." };

  const built = await buildRecord(parsed.data);
  if ("errors" in built) return { ok: false, errors: built.errors, message: "Some fields need attention." };

  const reference = await nextReference();
  const [created] = await db
    .insert(schema.entries)
    .values({ ...built.record, reference, scoutId: session.id, status: "SUBMITTED" })
    .returning({ id: schema.entries.id });
  await db.insert(schema.events).values({
    entryId: created.id,
    actorId: session.id,
    action: "SUBMITTED",
    toStatus: "SUBMITTED",
    notes: "Captured in the field",
  });
  revalidatePath("/entries");
  return { ok: true, id: created.id };
}

export async function resubmitEntryAction(entryId: string, raw: unknown): Promise<EntryActionResult> {
  const session = await requireSession();
  const existing = await db.query.entries.findFirst({ where: eq(schema.entries.id, entryId) });
  if (!existing) return { ok: false, message: "Entry not found." };
  const owns = existing.scoutId === session.id || session.role === "ADMIN";
  if (!owns) return { ok: false, message: "You can only edit your own entries." };
  if (existing.status !== "RETURNED") return { ok: false, message: "Only returned entries can be edited." };

  const parsed = entryInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error), message: "Some fields need attention." };
  const built = await buildRecord(parsed.data);
  if ("errors" in built) return { ok: false, errors: built.errors, message: "Some fields need attention." };

  await db
    .update(schema.entries)
    .set({ ...built.record, status: "SUBMITTED", returnReason: null, callAttempts: 0 })
    .where(eq(schema.entries.id, entryId));
  await db.insert(schema.events).values({
    entryId,
    actorId: session.id,
    action: "RESUBMITTED",
    fromStatus: "RETURNED",
    toStatus: "SUBMITTED",
    notes: "Corrected and resubmitted by the scout",
  });
  revalidatePath("/entries");
  revalidatePath(`/entries/${entryId}`);
  return { ok: true, id: entryId };
}

export async function goToEntry(id: string) {
  redirect(`/entries/${id}`);
}
