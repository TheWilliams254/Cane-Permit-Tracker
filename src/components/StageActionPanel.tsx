"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/actions/auth";
import { completeStageAction, logCallAttemptAction, rejectEntryAction, returnEntryAction } from "@/actions/workflow";
import type { Cbc, Entry } from "@/lib/db/schema";
import { CALL_CENTER_CHECKS, LEGAL_DOCS, type Stage } from "@/lib/workflow";
import { ZONE_LETTERS, zoneRangeLabel } from "@/lib/zones";
import { Alert, Button, CheckRow, Field, Input, Select, Textarea } from "./ui";

type Mode = "complete" | "return" | "reject" | "call";

export function StageActionPanel({ entry, stage, cbcs }: { entry: Entry; stage: Stage; cbcs: Cbc[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("complete");

  const complete = completeStageAction.bind(null, entry.id, stage.key);
  const ret = returnEntryAction.bind(null, entry.id, stage.key);
  const rej = rejectEntryAction.bind(null, entry.id, stage.key);
  const call = logCallAttemptAction.bind(null, entry.id);

  const [cState, cAction, cPending] = useActionState<FormState, FormData>(complete, { ok: false });
  const [rState, rAction, rPending] = useActionState<FormState, FormData>(ret, { ok: false });
  const [jState, jAction, jPending] = useActionState<FormState, FormData>(rej, { ok: false });
  const [kState, kAction, kPending] = useActionState<FormState, FormData>(call, { ok: false });

  const done = cState.ok || rState.ok || jState.ok;
  if (done) {
    const msg = cState.message || rState.message || jState.message;
    return (
      <div className="panel p-5 flex flex-col gap-4 border-cane-300">
        <Alert tone="success">{msg}</Alert>
        <div className="flex gap-2">
          <Button onClick={() => router.push("/queue")}>Back to my queue</Button>
          <Button variant="secondary" onClick={() => router.refresh()}>View updated entry</Button>
        </div>
      </div>
    );
  }

  const tabs: { key: Mode; label: string }[] = [
    { key: "complete", label: stage.key === "LEGAL" ? "Confirm receipt" : stage.key === "CALL_CENTER" ? "Confirmed" : "Complete" },
    ...(stage.key === "CALL_CENTER" ? [{ key: "call" as Mode, label: "Not reachable" }] : []),
    ...(stage.canReturn ? [{ key: "return" as Mode, label: "Return to scout" }] : []),
    ...(stage.canReject ? [{ key: "reject" as Mode, label: "Reject" }] : []),
  ];

  return (
    <div className="panel border-sugar-300 overflow-hidden">
      <div className="bg-sugar-100 px-5 py-3 border-b border-sugar-300">
        <p className="text-sm text-sugar-700">Waiting on you</p>
        <h2 className="text-lg font-bold">{stage.title}</h2>
        <p className="text-[15px] text-stone-700 mt-0.5">{stage.description}</p>
      </div>
      <div className="flex gap-1 px-3 pt-3 flex-wrap" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={mode === t.key}
            onClick={() => setMode(t.key)}
            className={`h-10 rounded-md px-3 text-sm font-medium ${mode === t.key ? "bg-ink text-white" : "text-stone-700 hover:bg-stone-100"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {mode === "complete" && (
          <form action={cAction} className="flex flex-col gap-4">
            {cState.message && !cState.ok && <Alert tone="danger">{cState.message}</Alert>}
            <StageFields stage={stage} entry={entry} cbcs={cbcs} errors={cState.errors} />
            <Field label="Notes (optional)" htmlFor="notes">
              <Textarea id="notes" name="notes" rows={2} placeholder="Anything the next person should know." />
            </Field>
            <Button type="submit" size="lg" disabled={cPending} className="self-start">
              {cPending ? "Saving…" : tabs[0].label}
            </Button>
          </form>
        )}

        {mode === "call" && (
          <form action={kAction} className="flex flex-col gap-4">
            {kState.message && <Alert tone={kState.ok ? "success" : "danger"}>{kState.message}</Alert>}
            <p className="text-[15px] text-stone-700">
              Logs a call attempt and keeps the entry in your queue. {entry.callAttempts > 0 && <>So far: {entry.callAttempts} attempt{entry.callAttempts === 1 ? "" : "s"}.</>}
            </p>
            <Field label="What happened" htmlFor="call-notes">
              <Textarea id="call-notes" name="notes" rows={2} placeholder="Phone off, no answer, wrong number…" />
            </Field>
            <Button type="submit" variant="amber" disabled={kPending} className="self-start">
              {kPending ? "Saving…" : "Log attempt"}
            </Button>
          </form>
        )}

        {mode === "return" && (
          <form action={rAction} className="flex flex-col gap-4">
            {rState.message && !rState.ok && <Alert tone="danger">{rState.message}</Alert>}
            <p className="text-[15px] text-stone-700">The scout sees this reason, corrects the entry and resubmits it. It then starts again at the call centre.</p>
            <Field label="What must the scout fix?" htmlFor="reason" error={rState.errors?.reason}>
              <Textarea id="reason" name="reason" rows={3} required error={!!rState.errors?.reason} />
            </Field>
            <Button type="submit" variant="danger" disabled={rPending} className="self-start">
              {rPending ? "Saving…" : "Return to scout"}
            </Button>
          </form>
        )}

        {mode === "reject" && (
          <form action={jAction} className="flex flex-col gap-4">
            {jState.message && !jState.ok && <Alert tone="danger">{jState.message}</Alert>}
            <p className="text-[15px] text-stone-700">Rejecting closes the entry permanently. Use it for land disputes, duplicate contracts or fraud; use <em>Return</em> for anything fixable.</p>
            <Field label="Reason for rejecting" htmlFor="reject-reason" error={jState.errors?.reason}>
              <Textarea id="reject-reason" name="reason" rows={3} required error={!!jState.errors?.reason} />
            </Field>
            <Button type="submit" variant="danger" disabled={jPending} className="self-start">
              {jPending ? "Saving…" : "Reject entry"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

function StageFields({ stage, entry, cbcs, errors = {} }: { stage: Stage; entry: Entry; cbcs: Cbc[]; errors?: Record<string, string> }) {
  switch (stage.key) {
    case "CALL_CENTER":
      return (
        <div>
          <p className="text-[15px] text-stone-700 mb-1">Call <span className="font-medium tabular-nums">{entry.farmerPhone}</span> and tick each item as the farmer confirms it.</p>
          <div className="divide-y divide-stone-100">
            {CALL_CENTER_CHECKS.map((c) => (
              <CheckRow key={c.key} name={`check_${c.key}`} label={c.label} />
            ))}
          </div>
        </div>
      );
    case "DATA_CHECK":
      return (
        <div className="divide-y divide-stone-100">
          <CheckRow name="check_id" label="Name and ID number match the ID card photos" />
          <CheckRow name="check_bank" label="Bank, account number and account name match the bank card photo" hint={entry.bankCardPhotoUrl ? undefined : "No bank card photo was captured — verify by other means or return the entry."} />
          <CheckRow name="check_polygon" label="Plot LR number, acreage and polygon are plausible" />
        </div>
      );
    case "LEGAL":
      return (
        <div className="flex flex-col gap-3">
          <div className="divide-y divide-stone-100">
            {LEGAL_DOCS.map((d) => (
              <CheckRow key={d.key} name={`check_${d.key}`} label={d.label} hint={d.key === "idCopy" || d.key === "signedTerms" ? "Required" : undefined} />
            ))}
          </div>
          <Field label="Physical file reference (optional)" htmlFor="fileRef" hint="Where the originals are filed.">
            <Input id="fileRef" name="fileRef" className="sm:max-w-xs" />
          </Field>
        </div>
      );
    case "ERP_ENTRY":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ERP farmer code" htmlFor="erpFarmerCode" error={errors.erpFarmerCode}>
            <Input id="erpFarmerCode" name="erpFarmerCode" required error={!!errors.erpFarmerCode} />
          </Field>
          <Field label="ERP field code (optional)" htmlFor="erpFieldCode">
            <Input id="erpFieldCode" name="erpFieldCode" />
          </Field>
        </div>
      );
    case "PERMIT":
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Permit number" htmlFor="permitNumber" error={errors.permitNumber}>
            <Input id="permitNumber" name="permitNumber" required error={!!errors.permitNumber} />
          </Field>
          <Field label="CCS clips issued" htmlFor="ccsClips" error={errors.ccsClips} hint="Clip numbers or range, e.g. 1041–1052.">
            <Input id="ccsClips" name="ccsClips" required error={!!errors.ccsClips} />
          </Field>
        </div>
      );
    case "ZONING":
      return (
        <div className="flex flex-col gap-4">
          <div className="divide-y divide-stone-100">
            <CheckRow name="gisFieldInspected" label="Field inspected" />
            <CheckRow name="gisPolygonReviewed" label="Polygon reviewed against imagery" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Transport zone" htmlFor="gisZone" error={errors.gisZone} hint="Pre-filled from the polygon.">
              <Select id="gisZone" name="gisZone" defaultValue={entry.gisZone ?? entry.zone ?? ""} error={!!errors.gisZone}>
                <option value="">Choose…</option>
                {ZONE_LETTERS.map((z) => (
                  <option key={z} value={z}>Zone {z} — {zoneRangeLabel(z)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Zoned to CBC" htmlFor="gisCbcId" error={errors.gisCbcId}>
              <Select id="gisCbcId" name="gisCbcId" defaultValue={entry.gisCbcId ?? entry.nearestCbcId ?? ""} error={!!errors.gisCbcId}>
                <option value="">Choose…</option>
                {cbcs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Linear distance (km)" htmlFor="gisDistanceKm" error={errors.gisDistanceKm}>
              <Input id="gisDistanceKm" name="gisDistanceKm" inputMode="decimal" defaultValue={entry.gisDistanceKm ?? entry.distanceKm ?? ""} error={!!errors.gisDistanceKm} />
            </Field>
          </div>
        </div>
      );
  }
}
