import Link from "next/link";
import type { EntryListRow } from "@/lib/queries";
import { fmtDate, fmtNum } from "@/lib/format";
import { waitingOn } from "@/lib/workflow";
import { StageRail } from "./StageRail";
import { StatusBadge } from "./StatusBadge";
import { EmptyState } from "./ui";

export function EntryTable({
  rows,
  showScout = false,
  showWaitingOn = false,
  dateLabel = "Updated",
  dateKey = "updatedAt",
  empty,
}: {
  rows: (EntryListRow & { lastActionAt?: Date })[];
  showScout?: boolean;
  showWaitingOn?: boolean;
  dateLabel?: string;
  dateKey?: "updatedAt" | "createdAt" | "lastActionAt";
  empty: { title: string; body?: string; action?: React.ReactNode };
}) {
  if (!rows.length) return <EmptyState {...empty} />;
  return (
    <>
      {/* Mobile: cards */}
      <ul className="grid gap-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/entries/${r.id}`} className="block panel p-4 active:bg-stone-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{r.farmerName}</p>
                  <p className="text-sm text-stone-500 tabular-nums">{r.reference} · {r.plotLrNo}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <StageRail status={r.status} className="mt-3" />
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-500">
                <span>{r.area}, {r.sublocation}</span>
                <span>{fmtNum(r.estimatedAcres, 1)} ac</span>
                {(r.gisZone || r.zone) && <span>Zone {r.gisZone ?? r.zone}</span>}
                <span>{fmtDate((r as Record<string, unknown>)[dateKey] as Date)}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop: table */}
      <div className="hidden md:block panel overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Serial</th>
              <th>Farmer</th>
              <th>Plot / area</th>
              <th>Acres</th>
              <th>Zone</th>
              <th className="min-w-[180px]">Progress</th>
              <th>Status</th>
              {showWaitingOn && <th>Waiting on</th>}
              {showScout && <th>Scout</th>}
              <th>{dateLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-stone-50">
                <td className="tabular-nums whitespace-nowrap">
                  <Link href={`/entries/${r.id}`} className="font-medium text-cane-700 hover:underline">{r.reference}</Link>
                </td>
                <td>
                  <p className="font-medium">{r.farmerName}</p>
                  <p className="text-stone-500 tabular-nums">{r.farmerPhone}</p>
                </td>
                <td>
                  <p>{r.plotLrNo}</p>
                  <p className="text-stone-500">{r.area}, {r.sublocation}</p>
                </td>
                <td className="tabular-nums">{fmtNum(r.estimatedAcres, 1)}</td>
                <td>{r.gisZone ?? r.zone ?? "—"}</td>
                <td><StageRail status={r.status} /></td>
                <td><StatusBadge status={r.status} /></td>
                {showWaitingOn && <td className="text-stone-700">{waitingOn(r.status)}</td>}
                {showScout && <td>{r.scoutName}</td>}
                <td className="whitespace-nowrap text-stone-500">{fmtDate((r as Record<string, unknown>)[dateKey] as Date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
