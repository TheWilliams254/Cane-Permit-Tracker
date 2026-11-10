"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Bank, Cbc, Entry, Harvester, LatLng } from "@/lib/db/schema";
import { computeZoning, zoneRangeLabel } from "@/lib/zones";
import { DATA_PROTECTION_STATEMENT, termsText } from "@/lib/legal-text";
import { entryInputSchema, firstErrors } from "@/lib/validation";
import { createEntryAction, resubmitEntryAction } from "@/actions/entries";
import { fmtNum } from "@/lib/format";
import { Alert, Button, Field, Input, Select, SectionTitle } from "./ui";
import { PolygonMap } from "./PolygonMap";
import { PhotoInput, uploadBlob } from "./PhotoInput";
import { SignaturePad } from "./SignaturePad";

type Props = {
  banks: Bank[];
  harvesters: Harvester[];
  cbcs: Cbc[];
  initial?: Entry | null;
};

type FormValues = {
  farmerName: string;
  farmerPhone: string;
  farmerIdNumber: string;
  plotLrNo: string;
  estimatedAcres: string;
  estimatedTrips: string;
  sublocation: string;
  area: string;
  deliveryCbcId: string;
  harvesterId: string;
  polygon: LatLng[];
  bankId: string;
  accountNumber: string;
  accountName: string;
  branch: string;
  bankCardPhotoUrl: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  farmerPhotoUrl: string | null;
  termsAccepted: boolean;
  dataConsent: boolean;
};

function fromEntry(e?: Entry | null): FormValues {
  return {
    farmerName: e?.farmerName ?? "",
    farmerPhone: e?.farmerPhone ?? "",
    farmerIdNumber: e?.farmerIdNumber ?? "",
    plotLrNo: e?.plotLrNo ?? "",
    estimatedAcres: e ? String(e.estimatedAcres) : "",
    estimatedTrips: e ? String(e.estimatedTrips) : "",
    sublocation: e?.sublocation ?? "",
    area: e?.area ?? "",
    deliveryCbcId: e?.deliveryCbcId ?? "",
    harvesterId: e?.harvesterId ?? "",
    polygon: e?.polygon ?? [],
    bankId: e?.bankId ?? "",
    accountNumber: e?.accountNumber ?? "",
    accountName: e?.accountName ?? "",
    branch: e?.branch ?? "",
    bankCardPhotoUrl: e?.bankCardPhotoUrl ?? null,
    idFrontUrl: e?.idFrontUrl ?? null,
    idBackUrl: e?.idBackUrl ?? null,
    farmerPhotoUrl: e?.farmerPhotoUrl ?? null,
    termsAccepted: !!e,
    dataConsent: !!e,
  };
}

export function EntryForm({ banks, harvesters, cbcs, initial }: Props) {
  const router = useRouter();
  const [v, setV] = useState<FormValues>(() => fromEntry(initial));
  const [acresTouched, setAcresTouched] = useState(!!initial);
  const [cbcTouched, setCbcTouched] = useState(!!initial);
  const [signature, setSignature] = useState<Blob | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => setV((s) => ({ ...s, [k]: val }));

  const zoning = useMemo(() => (v.polygon.length >= 3 ? computeZoning(v.polygon, cbcs) : null), [v.polygon, cbcs]);
  const bank = banks.find((b) => b.id === v.bankId);
  const activeHarvesters = harvesters.filter((h) => h.active || h.id === v.harvesterId);
  const activeBanks = banks.filter((b) => b.active || b.id === v.bankId);
  const activeCbcs = cbcs.filter((c) => c.active || c.id === v.deliveryCbcId);

  function onPolygon(ring: LatLng[]) {
    setV((s) => {
      const next = { ...s, polygon: ring };
      if (ring.length >= 3) {
        const z = computeZoning(ring, cbcs);
        if (!acresTouched) next.estimatedAcres = z.acres > 0 ? z.acres.toFixed(2) : "";
        if (!cbcTouched && z.nearestCbcId) next.deliveryCbcId = z.nearestCbcId;
      }
      return next;
    });
  }

  function submit() {
    setMessage(null);
    start(async () => {
      // Client-side pass first so the scout gets instant feedback without a round trip.
      const payloadBase = {
        ...v,
        estimatedAcres: v.estimatedAcres,
        estimatedTrips: v.estimatedTrips,
        bankCardPhotoUrl: v.bankCardPhotoUrl ?? "",
        idFrontUrl: v.idFrontUrl ?? "",
        idBackUrl: v.idBackUrl ?? "",
        farmerPhotoUrl: v.farmerPhotoUrl ?? "",
        signatureUrl: initial?.signatureUrl ?? "",
      };
      const local = entryInputSchema.safeParse({ ...payloadBase, signatureUrl: signature || initial?.signatureUrl ? "https://pending.local/sig" : "" });
      if (!local.success) {
        const errs = firstErrors(local.error);
        setErrors(errs);
        setMessage("Some fields need attention. The first problem is highlighted below.");
        scrollToFirst(errs);
        return;
      }
      if (bank && v.accountNumber.length !== bank.accountLength) {
        setErrors({ accountNumber: `${bank.name} account numbers have ${bank.accountLength} digits` });
        setMessage("Check the account number.");
        scrollToFirst({ accountNumber: "" });
        return;
      }
      let signatureUrl = initial?.signatureUrl ?? "";
      try {
        if (signature) signatureUrl = await uploadBlob(signature, "signature", "signature.png");
      } catch (e) {
        setMessage(e instanceof Error ? `Could not upload the signature: ${e.message}` : "Could not upload the signature.");
        return;
      }
      const payload = { ...payloadBase, signatureUrl };
      const res = initial ? await resubmitEntryAction(initial.id, payload) : await createEntryAction(payload);
      if (!res.ok) {
        setErrors(res.errors ?? {});
        setMessage(res.message ?? "Could not save the entry.");
        if (res.errors) scrollToFirst(res.errors);
        return;
      }
      router.push(`/entries/${res.id}?saved=1`);
    });
  }

  const idPrefix = "f-";
  const e = errors;

  return (
    <form
      className="flex flex-col gap-10"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        submit();
      }}
    >
      {initial?.returnReason && (
        <Alert tone="warn">
          <strong>Returned for correction:</strong> {initial.returnReason}
        </Alert>
      )}

      <section id="sec-farmer">
        <SectionTitle>Farmer</SectionTitle>
        <div className="panel p-4 sm:p-5 grid gap-4 sm:grid-cols-2">
          <Field label="Full name (as on ID)" htmlFor={idPrefix + "name"} error={e.farmerName} className="sm:col-span-2">
            <Input id={idPrefix + "name"} value={v.farmerName} onChange={(ev) => set("farmerName", ev.target.value)} autoComplete="off" error={!!e.farmerName} />
          </Field>
          <Field label="Phone number" htmlFor={idPrefix + "phone"} error={e.farmerPhone} hint="The number the call centre will use to confirm this entry.">
            <Input id={idPrefix + "phone"} inputMode="tel" value={v.farmerPhone} onChange={(ev) => set("farmerPhone", ev.target.value)} placeholder="07XX XXX XXX" error={!!e.farmerPhone} />
          </Field>
          <Field label="National ID number" htmlFor={idPrefix + "id"} error={e.farmerIdNumber}>
            <Input id={idPrefix + "id"} inputMode="numeric" value={v.farmerIdNumber} onChange={(ev) => set("farmerIdNumber", ev.target.value.replace(/\D/g, ""))} error={!!e.farmerIdNumber} />
          </Field>
          <Field label="Plot LR number" htmlFor={idPrefix + "lr"} error={e.plotLrNo}>
            <Input id={idPrefix + "lr"} value={v.plotLrNo} onChange={(ev) => set("plotLrNo", ev.target.value)} error={!!e.plotLrNo} />
          </Field>
          <Field label="Estimated trips" htmlFor={idPrefix + "trips"} error={e.estimatedTrips} hint="Lorry loads expected from this field.">
            <Input id={idPrefix + "trips"} inputMode="numeric" value={v.estimatedTrips} onChange={(ev) => set("estimatedTrips", ev.target.value.replace(/\D/g, ""))} error={!!e.estimatedTrips} />
          </Field>
          <Field label="Sub-location" htmlFor={idPrefix + "subloc"} error={e.sublocation}>
            <Input id={idPrefix + "subloc"} value={v.sublocation} onChange={(ev) => set("sublocation", ev.target.value)} error={!!e.sublocation} />
          </Field>
          <Field label="Area" htmlFor={idPrefix + "area"} error={e.area}>
            <Input id={idPrefix + "area"} value={v.area} onChange={(ev) => set("area", ev.target.value)} error={!!e.area} />
          </Field>
        </div>
      </section>

      <section id="sec-polygon">
        <SectionTitle>Field boundary</SectionTitle>
        <div className="panel p-4 sm:p-5 flex flex-col gap-4">
          <PolygonMap value={v.polygon} onChange={onPolygon} cbcs={cbcs.filter((c) => c.active)} highlightCbcId={zoning?.nearestCbcId} centroid={zoning?.centroid ?? null} />
          {e.polygon && <p className="text-sm text-danger" role="alert">{e.polygon}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[15px]">
            <Stat label="Corners" value={String(v.polygon.length)} />
            <Stat label="Area" value={zoning ? `${fmtNum(zoning.acres)} ac` : "—"} sub={zoning ? `${fmtNum(zoning.hectares)} ha` : undefined} />
            <Stat label="Nearest CBC" value={zoning?.nearestCbcName ?? "—"} sub={zoning?.distanceKm != null ? `${fmtNum(zoning.distanceKm, 2)} km linear` : undefined} />
            <Stat label="Transport zone" value={zoning?.zone ?? "—"} sub={zoning?.zone ? zoneRangeLabel(zoning.zone) : undefined} accent />
          </div>
          <Field
            label="Estimated acreage (acres)"
            htmlFor={idPrefix + "acres"}
            error={e.estimatedAcres}
            hint="Pre-filled from the polygon. Change it only if the contracted acreage differs."
            className="sm:max-w-xs"
          >
            <Input
              id={idPrefix + "acres"}
              inputMode="decimal"
              value={v.estimatedAcres}
              onChange={(ev) => {
                setAcresTouched(true);
                set("estimatedAcres", ev.target.value.replace(/[^\d.]/g, ""));
              }}
              error={!!e.estimatedAcres}
            />
          </Field>
        </div>
      </section>

      <section id="sec-delivery">
        <SectionTitle>Delivery and harvesting</SectionTitle>
        <div className="panel p-4 sm:p-5 grid gap-4 sm:grid-cols-2">
          <Field label="Cane buying centre (delivery)" htmlFor={idPrefix + "cbc"} error={e.deliveryCbcId} hint={zoning?.nearestCbcName && v.deliveryCbcId !== zoning.nearestCbcId ? `Nearest CBC is ${zoning.nearestCbcName}; the zone is always measured to the nearest CBC.` : undefined}>
            <Select
              id={idPrefix + "cbc"}
              value={v.deliveryCbcId}
              onChange={(ev) => {
                setCbcTouched(true);
                set("deliveryCbcId", ev.target.value);
              }}
              error={!!e.deliveryCbcId}
            >
              <option value="">Choose…</option>
              {activeCbcs.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Harvester" htmlFor={idPrefix + "harv"} error={e.harvesterId}>
            <Select id={idPrefix + "harv"} value={v.harvesterId} onChange={(ev) => set("harvesterId", ev.target.value)} error={!!e.harvesterId}>
              <option value="">Choose…</option>
              {activeHarvesters.map((h) => (
                <option key={h.id} value={h.id}>{h.name} ({h.code})</option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      <section id="sec-bank">
        <SectionTitle>Bank details</SectionTitle>
        <div className="panel p-4 sm:p-5 grid gap-4 sm:grid-cols-2">
          <Field label="Bank" htmlFor={idPrefix + "bank"} error={e.bankId}>
            <Select id={idPrefix + "bank"} value={v.bankId} onChange={(ev) => set("bankId", ev.target.value)} error={!!e.bankId}>
              <option value="">Choose…</option>
              {activeBanks.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Bank code" htmlFor={idPrefix + "bankcode"} hint="Filled from the bank master.">
            <Input id={idPrefix + "bankcode"} value={bank?.code ?? ""} readOnly disabled />
          </Field>
          <Field
            label="Account number"
            htmlFor={idPrefix + "acct"}
            error={e.accountNumber}
            hint={bank ? `${bank.accountLength} digits for ${bank.name} · ${v.accountNumber.length}/${bank.accountLength}` : "Digits only. Choose the bank first."}
          >
            <Input
              id={idPrefix + "acct"}
              inputMode="numeric"
              value={v.accountNumber}
              maxLength={bank?.accountLength}
              onChange={(ev) => set("accountNumber", ev.target.value.replace(/\D/g, "").slice(0, bank?.accountLength ?? 24))}
              error={!!e.accountNumber}
              disabled={!bank}
            />
          </Field>
          <Field label="Account name" htmlFor={idPrefix + "acctname"} error={e.accountName}>
            <Input id={idPrefix + "acctname"} value={v.accountName} onChange={(ev) => set("accountName", ev.target.value)} error={!!e.accountName} />
          </Field>
          <Field label="Branch" htmlFor={idPrefix + "branch"} error={e.branch}>
            <Input id={idPrefix + "branch"} value={v.branch} onChange={(ev) => set("branch", ev.target.value)} error={!!e.branch} />
          </Field>
          <div className="sm:col-span-2 sm:max-w-sm">
            <PhotoInput label="Bank card or passbook" kind="bank-card" value={v.bankCardPhotoUrl} onChange={(u) => set("bankCardPhotoUrl", u)} error={e.bankCardPhotoUrl} hint="Optional, but it lets the data check verify the account." />
          </div>
        </div>
      </section>

      <section id="sec-photos">
        <SectionTitle>Identification photos</SectionTitle>
        <div className="panel p-4 sm:p-5 grid gap-4 sm:grid-cols-3">
          <PhotoInput label="ID card, front" kind="id-front" value={v.idFrontUrl} onChange={(u) => set("idFrontUrl", u)} error={e.idFrontUrl} required />
          <PhotoInput label="ID card, back" kind="id-back" value={v.idBackUrl} onChange={(u) => set("idBackUrl", u)} error={e.idBackUrl} required />
          <PhotoInput label="Farmer" kind="farmer" value={v.farmerPhotoUrl} onChange={(u) => set("farmerPhotoUrl", u)} error={e.farmerPhotoUrl} required hint="Head and shoulders, in daylight." />
        </div>
      </section>

      <section id="sec-consent">
        <SectionTitle>Terms, consent and signature</SectionTitle>
        <div className="panel p-4 sm:p-5 flex flex-col gap-5">
          <div>
            <h3 className="font-medium">Undertaking to the Miller</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-stone-700 max-w-prose">{termsText(v.farmerName, v.farmerIdNumber)}</p>
            <label className="mt-3 flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={v.termsAccepted} onChange={(ev) => set("termsAccepted", ev.target.checked)} className="mt-1 h-5 w-5 rounded border-stone-300 text-cane-700 focus:ring-sugar-500" />
              <span className="text-[15px]">The farmer has read, or had read to them, this undertaking and agrees to it.</span>
            </label>
            {e.termsAccepted && <p className="mt-1 text-sm text-danger" role="alert">{e.termsAccepted}</p>}
          </div>
          <div className="hairline" />
          <div>
            <h3 className="font-medium">Data protection statement</h3>
            <details className="mt-2 text-[15px] leading-relaxed text-stone-700 max-w-prose">
              <summary className="cursor-pointer text-cane-700 font-medium">Read the statement</summary>
              <p className="mt-2">{DATA_PROTECTION_STATEMENT}</p>
            </details>
            <label className="mt-3 flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={v.dataConsent} onChange={(ev) => set("dataConsent", ev.target.checked)} className="mt-1 h-5 w-5 rounded border-stone-300 text-cane-700 focus:ring-sugar-500" />
              <span className="text-[15px]">The farmer consents to ASML collecting their ID, photos and bank details for the harvest permit, as described in the statement.</span>
            </label>
            {e.dataConsent && <p className="mt-1 text-sm text-danger" role="alert">{e.dataConsent}</p>}
          </div>
          <div className="hairline" />
          <div>
            <h3 className="font-medium">Farmer's signature</h3>
            <div className="mt-2">
              <SignaturePad onChange={setSignature} initialUrl={initial?.signatureUrl} />
            </div>
            {e.signatureUrl && <p className="mt-1 text-sm text-danger" role="alert">{e.signatureUrl}</p>}
          </div>
        </div>
      </section>

      {message && <Alert tone="danger">{message}</Alert>}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 sticky bottom-[calc(64px+var(--safe-bottom))] lg:bottom-4 bg-stone-50/95 backdrop-blur py-3 -mx-4 px-4 sm:mx-0 sm:px-0 sm:bg-transparent">
        <Button type="button" variant="secondary" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="submit" size="lg" disabled={pending} className="sm:min-w-[220px]">
          {pending ? "Saving…" : initial ? "Resubmit entry" : "Submit for confirmation"}
        </Button>
      </div>
    </form>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={accent ? "rounded-md bg-cane-50 px-3 py-2 border border-cane-200" : "rounded-md bg-stone-50 px-3 py-2"}>
      <p className="text-[13px] text-stone-500">{label}</p>
      <p className={accent ? "text-xl font-bold text-cane-800" : "font-medium"}>{value}</p>
      {sub && <p className="text-[13px] text-stone-500">{sub}</p>}
    </div>
  );
}

const SECTION_FOR_FIELD: Record<string, string> = {
  farmerName: "sec-farmer", farmerPhone: "sec-farmer", farmerIdNumber: "sec-farmer", plotLrNo: "sec-farmer",
  estimatedTrips: "sec-farmer", sublocation: "sec-farmer", area: "sec-farmer",
  polygon: "sec-polygon", estimatedAcres: "sec-polygon",
  deliveryCbcId: "sec-delivery", harvesterId: "sec-delivery",
  bankId: "sec-bank", accountNumber: "sec-bank", accountName: "sec-bank", branch: "sec-bank", bankCardPhotoUrl: "sec-bank",
  idFrontUrl: "sec-photos", idBackUrl: "sec-photos", farmerPhotoUrl: "sec-photos",
  termsAccepted: "sec-consent", dataConsent: "sec-consent", signatureUrl: "sec-consent",
};

function scrollToFirst(errs: Record<string, string>) {
  const order = Object.keys(SECTION_FOR_FIELD);
  const first = order.find((k) => k in errs);
  const id = first ? SECTION_FOR_FIELD[first] : undefined;
  if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
