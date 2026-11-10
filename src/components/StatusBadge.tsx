import type { EntryStatus } from "@/lib/db/schema";
import { STATUS_LABEL } from "@/lib/workflow";
import { cx } from "@/lib/format";

export function StatusBadge({ status, className }: { status: EntryStatus; className?: string }) {
  const tone =
    status === "ZONED"
      ? "bg-cane-700 text-white"
      : status === "RETURNED"
        ? "bg-red-50 text-danger border border-danger/30"
        : status === "REJECTED"
          ? "bg-stone-200 text-stone-700"
          : "bg-sugar-100 text-sugar-700 border border-sugar-300";
  return (
    <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-medium whitespace-nowrap", tone, className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}
