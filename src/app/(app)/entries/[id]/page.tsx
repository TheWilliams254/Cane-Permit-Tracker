import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/guards";
import { canViewEntry, getEntryFull } from "@/lib/queries";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { fmtDate, fmtNum } from "@/lib/format";
import { CALL_CENTER_CHECKS, LEGAL_DOCS, stageForStatus, waitingOn } from "@/lib/workflow";
import { zoneRangeLabel } from "@/lib/zones";
import { termsText } from "@/lib/legal-text";
import { StageRail } from "@/components/StageRail";
import { StatusBadge } from "@/components/StatusBadge";
import { Timeline } from "@/components/Timeline";
import { StageActionPanel } from "@/components/StageActionPanel";
import { PolygonMap } from "@/components/PolygonMap";
import { Alert, DescriptionList, LinkButton, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Entry" };

export default async function EntryPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const user = await requireSession();
  const { id } = await params;
  const { saved } = await searchParams;
  const entry = await getEntryFull(id);
  if (!entry) notFound();
  if (!canViewEntry(user, entry)) redirect("/");

  const stage = stageForStatus(entry.status);
  const canAct = !!stage && (stage.roles.includes(user.role) || user.role === "ADMIN");
  const cbcs = canAct ? await db.query.cbcs.findMany({ where: eq(schema.cbcs.active, true), orderBy: (c, { asc }) => [asc(c.name)] }) : [];
  const isOwner = entry.scoutId === user.id;
  const finalZone = entry.gisZone ?? entry.zone;
  const finalCbc = entry.gisCbc ?? entry.nearestCbc;
  const finalDist = entry.gisDistanceKm ?? entry.distanceKm;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-stone-500 tabular-nums">Serial <span className="font-medium text-ink">{entry.reference}</span> · captured {fmtDate(entry.createdAt)} by {entry.scout.name}</p>
            <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight leading-tight mt-0.5">{entry.farmerName}</h1>
            <p className="text-stone-700 mt-1">{entry.plotLrNo} · {entry.area}, {entry.sublocation}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={entry.status} />
            {entry.status === "RETURNED" && (isOwner || user.role === "ADMIN") && <LinkButton href={`/entries/${entry.id}/edit`}>Correct and resubmit</LinkButton>}
          </div>
        </div>
        <div className="mt-5 panel p-4">
          <StageRail status={entry.status} size="lg" showLabels />
          <p className="mt-3 text-[15px] text-stone-700">
            {entry.status === "ZONED" ? "Complete: permit issued and zone confirmed." : entry.status === "REJECTED" ? "Closed: rejected." : <>Waiting on <span className="font-medium">{waitingOn(entry.status)}</span>.</>}
            {entry.callAttempts > 0 && entry.status === "SUBMITTED" && <span className="text-stone-500"> {entry.callAttempts} call attempt{entry.callAttempts === 1 ? "" : "s"} so far.</span>}
          </p>
        </div>
      </header>

      {saved && <Alert tone="success">Entry saved with serial {entry.reference}. The call centre will phone the farmer to confirm the details.</Alert>}
      {(entry.status === "RETURNED" || entry.status === "REJECTED") && entry.returnReason && (
        <Alert tone={entry.status === "REJECTED" ? "danger" : "warn"}>
          <strong>{entry.status === "REJECTED" ? "Rejected:" : "Returned for correction:"}</strong> {entry.returnReason}
        </Alert>
      )}

      {canAct && stage && <StageActionPanel entry={entry} stage={stage} cbcs={cbcs} />}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-8 min-w-0">
          <section>
            <SectionTitle>Field boundary and zone</SectionTitle>
            <div className="panel p-4 flex flex-col gap-4">
              <PolygonMap value={entry.polygon} readOnly cbcs={[...(entry.nearestCbc ? [entry.nearestCbc] : []), ...(entry.deliveryCbc && entry.deliveryCbc.id !== entry.nearestCbc?.id ? [entry.deliveryCbc] : [])]} highlightCbcId={finalCbc?.id} centroid={[entry.centroidLat, entry.centroidLng]} />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Zone" value={finalZone ?? "—"} sub={finalZone ? zoneRangeLabel(finalZone) : undefined} accent />
                <Stat label="Zoned to" value={finalCbc?.name ?? "—"} sub={finalDist != null ? `${fmtNum(finalDist)} km linear` : undefined} />
                <Stat label="Polygon area" value={`${fmtNum(entry.polygonAcres)} ac`} sub={`${fmtNum(entry.polygonHectares)} ha · ${entry.polygon.length} corners`} />
                <Stat label="Contracted acreage" value={`${fmtNum(entry.estimatedAcres)} ac`} sub={`${entry.estimatedTrips} trips estimated`} />
              </div>
              {entry.gisZone && entry.gisZone !== entry.zone && (
                <p className="text-sm text-stone-500">GIS changed the zone from the computed {entry.zone} to {entry.gisZone}.</p>
              )}
              <p className="text-sm text-stone-500 tabular-nums">Centroid {entry.centroidLat.toFixed(6)}, {entry.centroidLng.toFixed(6)}</p>
            </div>
          </section>

          <section>
            <SectionTitle>Farmer</SectionTitle>
            <div className="panel p-4">
              <DescriptionList
                items={[
                  { label: "Full name", value: entry.farmerName },
                  { label: "Phone", value: <span className="tabular-nums">{entry.farmerPhone}</span> },
                  { label: "National ID", value: <span className="tabular-nums">{entry.farmerIdNumber}</span> },
                  { label: "Plot LR number", value: entry.plotLrNo },
                  { label: "Sub-location", value: entry.sublocation },
                  { label: "Area", value: entry.area },
                  { label: "Delivery CBC", value: entry.deliveryCbc?.name },
                  { label: "Harvester", value: entry.harvester ? `${entry.harvester.name} (${entry.harvester.code})` : "—" },
                ]}
              />
            </div>
          </section>

          <section>
            <SectionTitle>Bank details</SectionTitle>
            <div className="panel p-4 grid gap-4 sm:grid-cols-[1fr_200px]">
              <DescriptionList
                cols={1}
                items={[
                  { label: "Bank", value: entry.bankName },
                  { label: "Bank code", value: entry.bankCode },
                  { label: "Account number", value: <span className="tabular-nums">{entry.accountNumber}</span> },
                  { label: "Account name", value: entry.accountName },
                  { label: "Branch", value: entry.branch },
                ]}
              />
              <Photo url={entry.bankCardPhotoUrl} label="Bank card" />
            </div>
          </section>

          <section>
            <SectionTitle>Photos and signature</SectionTitle>
            <div className="panel p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Photo url={entry.idFrontUrl} label="ID front" />
              <Photo url={entry.idBackUrl} label="ID back" />
              <Photo url={entry.farmerPhotoUrl} label="Farmer" />
              <Photo url={entry.signatureUrl} label="Signature" contain />
            </div>
            <details className="mt-3 text-[15px] text-stone-700">
              <summary className="cursor-pointer text-cane-700 font-medium">Undertaking signed (v{entry.termsVersion}, {fmtDate(entry.termsAcceptedAt)}) · data consent v{entry.dataConsentVersion}</summary>
              <p className="mt-2 leading-relaxed max-w-prose">{termsText(entry.farmerName, entry.farmerIdNumber)}</p>
            </details>
          </section>
        </div>

        <div className="flex flex-col gap-8 min-w-0">
          <section>
            <SectionTitle>Stage record</SectionTitle>
            <div className="panel divide-y divide-stone-100">
              <StageRecord title="Call centre" done={!!entry.callCenterConfirmedAt} when={entry.callCenterConfirmedAt}>
                {entry.callCenterChecks && <Checks checks={entry.callCenterChecks} labels={CALL_CENTER_CHECKS} />}
                {entry.callAttempts > 0 && <p className="text-sm text-stone-500">{entry.callAttempts} call{entry.callAttempts === 1 ? "" : "s"} made</p>}
              </StageRecord>
              <StageRecord title="Data check" done={!!entry.dataCheckedAt} when={entry.dataCheckedAt} />
              <StageRecord title="ERP" done={!!entry.erpPostedAt} when={entry.erpPostedAt}>
                {entry.erpFarmerCode && <p className="text-sm">Farmer code <span className="font-medium tabular-nums">{entry.erpFarmerCode}</span>{entry.erpFieldCode && <> · field <span className="font-medium tabular-nums">{entry.erpFieldCode}</span></>}</p>}
              </StageRecord>
              <StageRecord title="Permit" done={!!entry.permitIssuedAt} when={entry.permitIssuedAt}>
                {entry.permitNumber && <p className="text-sm">Permit <span className="font-medium tabular-nums">{entry.permitNumber}</span> · CCS clips <span className="font-medium tabular-nums">{entry.ccsClips}</span></p>}
              </StageRecord>
              <StageRecord title="Legal · physical documents" done={!!entry.legalDocsReceivedAt} when={entry.legalDocsReceivedAt}>
                {entry.legalDocsChecklist && <Checks checks={entry.legalDocsChecklist} labels={LEGAL_DOCS} />}
                {entry.legalFileRef && <p className="text-sm">File: {entry.legalFileRef}</p>}
              </StageRecord>
              <StageRecord title="GIS zoning" done={!!entry.zonedAt} when={entry.zonedAt}>
                {entry.zonedAt && <p className="text-sm">Zone {entry.gisZone} to {entry.gisCbc?.name}, {fmtNum(entry.gisDistanceKm)} km</p>}
              </StageRecord>
            </div>
          </section>

          <section>
            <SectionTitle>Activity</SectionTitle>
            <div className="panel p-4">
              <Timeline events={entry.events} />
            </div>
          </section>

          {user.role === "ADMIN" && (
            <p className="text-sm text-stone-500">
              Scout: {entry.scout.name} ({entry.scout.username}){entry.scout.phone && `, ${entry.scout.phone}`}. Status history is recorded for every action; see <Link href="/entries" className="text-cane-700 hover:underline">all entries</Link> for the full list.
            </p>
          )}
        </div>
      </div>
    </div>
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

function Photo({ url, label, contain }: { url: string | null; label: string; contain?: boolean }) {
  if (!url) {
    return (
      <div className="aspect-[4/3] rounded-md border border-dashed border-stone-300 grid place-items-center text-sm text-stone-500">
        No {label.toLowerCase()}
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block group">
      <div className="aspect-[4/3] overflow-hidden rounded-md border border-stone-200 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={label} className={`h-full w-full ${contain ? "object-contain p-2" : "object-cover"}`} loading="lazy" />
      </div>
      <p className="mt-1 text-sm text-stone-500 group-hover:text-cane-700">{label}</p>
    </a>
  );
}

function StageRecord({ title, done, when, children }: { title: string; done: boolean; when: Date | null; children?: React.ReactNode }) {
  return (
    <div className="px-4 py-3 flex gap-3">
      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${done ? "bg-cane-600" : "bg-stone-200"}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-3">
          <p className="font-medium text-[15px]">{title}</p>
          <p className="text-sm text-stone-500 tabular-nums shrink-0">{done ? fmtDate(when) : "Pending"}</p>
        </div>
        {children && <div className="mt-1 flex flex-col gap-1">{children}</div>}
      </div>
    </div>
  );
}

function Checks({ checks, labels }: { checks: Record<string, boolean>; labels: { key: string; label: string }[] }) {
  const yes = labels.filter((l) => checks[l.key]);
  const no = labels.filter((l) => !checks[l.key]);
  return (
    <p className="text-sm text-stone-700">
      {yes.length} of {labels.length} confirmed{no.length > 0 && <span className="text-stone-500"> · not ticked: {no.map((l) => l.label).join(", ")}</span>}
    </p>
  );
}

