import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { countsByStatus, listEntries, recentEvents } from "@/lib/queries";
import { ROLE_LABEL, STAGES, STATUS_LABEL } from "@/lib/workflow";
import { fmtDate } from "@/lib/format";
import { EntryTable } from "@/components/EntryTable";
import { LinkButton, PageHeader, SectionTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminOverview() {
  await requireRole("ADMIN");
  const [counts, events, stale] = await Promise.all([countsByStatus(), recentEvents(20), listEntries({ limit: 300 })]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const inFlight = total - counts.ZONED - counts.REJECTED;
  const weekAgo = Date.now() - 7 * 86_400_000;
  const stuck = stale.filter((r) => !["ZONED", "REJECTED"].includes(r.status) && r.updatedAt.getTime() < weekAgo).slice(0, 10);

  return (
    <>
      <PageHeader title="Overview" lead={`${total} entries in total · ${inFlight} in progress · ${counts.ZONED} complete · ${counts.RETURNED} with scouts · ${counts.REJECTED} rejected.`} actions={<LinkButton href="/admin/export" variant="secondary">Download CSV</LinkButton>} />

      <section>
        <SectionTitle>Where entries are waiting</SectionTitle>
        <div className="panel overflow-hidden">
          <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 divide-stone-100 lg:divide-x">
            {STAGES.map((s, i) => {
              const n = counts[s.input];
              return (
                <li key={s.key} className="px-4 py-4">
                  <Link href={`/entries?status=${s.input}`} className="block group">
                    <p className="text-sm text-stone-500">{i + 1}. {s.shortTitle}</p>
                    <p className={`mt-1 text-3xl font-bold tabular-nums ${n ? "text-sugar-700" : "text-stone-300"}`}>{n}</p>
                    <p className="text-[13px] text-stone-500 group-hover:text-cane-700">{STATUS_LABEL[s.input]}</p>
                  </Link>
                </li>
              );
            })}
          </ol>
          <div className="hairline grid grid-cols-3 divide-x divide-stone-100">
            <Link href="/entries?status=RETURNED" className="px-4 py-3 hover:bg-stone-50"><p className="text-sm text-stone-500">With scouts</p><p className="text-xl font-bold tabular-nums text-danger">{counts.RETURNED}</p></Link>
            <Link href="/entries?status=ZONED" className="px-4 py-3 hover:bg-stone-50"><p className="text-sm text-stone-500">Complete</p><p className="text-xl font-bold tabular-nums text-cane-700">{counts.ZONED}</p></Link>
            <Link href="/entries?status=REJECTED" className="px-4 py-3 hover:bg-stone-50"><p className="text-sm text-stone-500">Rejected</p><p className="text-xl font-bold tabular-nums text-stone-700">{counts.REJECTED}</p></Link>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="min-w-0">
          <SectionTitle>Not moved in 7 days</SectionTitle>
          <EntryTable rows={stuck} showScout showWaitingOn empty={{ title: "Nothing is stuck", body: "Every open entry has moved in the last week." }} />
        </section>
        <section className="min-w-0">
          <SectionTitle>Latest activity</SectionTitle>
          <ul className="panel divide-y divide-stone-100">
            {events.length === 0 && <li className="px-4 py-6 text-stone-500 text-center">No activity yet.</li>}
            {events.map((ev) => (
              <li key={ev.id} className="px-4 py-3">
                <p className="text-[15px]">
                  <Link href={`/entries/${ev.entry.id}`} className="font-medium text-cane-700 hover:underline">{ev.entry.reference}</Link>{" "}
                  <span className="text-stone-700">{ev.entry.farmerName}</span> · {ev.action === "RESUBMITTED" ? "Resubmitted" : ev.toStatus && ev.toStatus !== ev.fromStatus ? STATUS_LABEL[ev.toStatus] : ev.action === "CALL_ATTEMPT" ? "Call attempt" : ev.action === "RESUBMITTED" ? "Resubmitted" : ev.action}
                </p>
                <p className="text-sm text-stone-500">{ev.actor?.name ?? "System"}{ev.actor && `, ${ROLE_LABEL[ev.actor.role]}`} · {fmtDate(ev.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
