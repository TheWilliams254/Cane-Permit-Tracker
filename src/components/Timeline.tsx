import type { EntryFull } from "@/lib/queries";
import { fmtDate } from "@/lib/format";
import { ROLE_LABEL, STATUS_LABEL } from "@/lib/workflow";

export function Timeline({ events }: { events: EntryFull["events"] }) {
  if (!events.length) return <p className="text-stone-500">No activity yet.</p>;
  return (
    <ol className="relative border-l-2 border-stone-200 ml-2 pl-5 flex flex-col gap-5">
      {events.map((ev) => {
        const tone = ev.toStatus === "RETURNED" || ev.toStatus === "REJECTED" ? "bg-danger" : ev.action === "CALL_ATTEMPT" ? "bg-sugar-500" : "bg-cane-600";
        return (
          <li key={ev.id} className="relative">
            <span className={`absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-stone-50 ${tone}`} aria-hidden />
            <p className="text-[15px]">
              <span className="font-medium">{ev.action === "RESUBMITTED" ? "Resubmitted" : ev.toStatus && ev.toStatus !== ev.fromStatus ? STATUS_LABEL[ev.toStatus] : ev.action === "CALL_ATTEMPT" ? "Call attempt" : ev.action === "RESUBMITTED" ? "Resubmitted" : ev.action}</span>
              <span className="text-stone-500"> · {ev.actor?.name ?? "System"}{ev.actor ? `, ${ROLE_LABEL[ev.actor.role]}` : ""}</span>
            </p>
            {ev.notes && <p className="mt-0.5 text-stone-700 text-[15px] leading-relaxed whitespace-pre-wrap">{ev.notes}</p>}
            <p className="mt-0.5 text-sm text-stone-500 tabular-nums">{fmtDate(ev.createdAt)}</p>
          </li>
        );
      })}
    </ol>
  );
}
