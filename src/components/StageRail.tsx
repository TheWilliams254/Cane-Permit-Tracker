import { STAGES, STATUS_ORDER } from "@/lib/workflow";
import type { EntryStatus } from "@/lib/db/schema";
import { cx } from "@/lib/format";

/**
 * The permit pipeline drawn as a cane stalk: six internodes, one per stage, with a node ring
 * between them. Filled green once a stage is done, amber for the stage the entry is waiting on,
 * red-ringed when it has been sent back to the scout.
 */
export function StageRail({
  status,
  size = "sm",
  showLabels = false,
  className,
}: {
  status: EntryStatus;
  size?: "sm" | "lg";
  showLabels?: boolean;
  className?: string;
}) {
  const done = Math.max(0, STATUS_ORDER.indexOf(status)); // number of stages completed
  const returned = status === "RETURNED";
  const rejected = status === "REJECTED";
  const h = size === "lg" ? "h-3" : "h-2";

  return (
    <div className={cx("w-full", className)} aria-label={`Progress: ${done} of ${STAGES.length} stages complete`}>
      <div className="flex items-center gap-[3px]">
        {STAGES.map((s, i) => {
          const isDone = !returned && !rejected && i < done;
          const isCurrent = !returned && !rejected && i === done && status !== "ZONED";
          return (
            <div key={s.key} className="flex-1 flex items-center gap-[3px]">
              <div
                className={cx(
                  "flex-1 rounded-[3px]",
                  h,
                  isDone && "bg-cane-600",
                  isCurrent && "bg-sugar-500",
                  !isDone && !isCurrent && !rejected && "bg-stone-200",
                  returned && "ring-1 ring-danger/50",
                  rejected && "bg-stone-200 opacity-60",
                )}
                title={s.title}
              />
              {i < STAGES.length - 1 && (
                <span
                  className={cx(
                    "rounded-full shrink-0 border-2",
                    size === "lg" ? "h-3.5 w-3.5" : "h-2.5 w-2.5",
                    isDone ? "border-cane-700 bg-cane-100" : "border-stone-300 bg-white",
                  )}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>
      {showLabels && (
        <div className="mt-2 grid grid-cols-6 gap-1 text-[12px] leading-4 text-stone-500">
          {STAGES.map((s, i) => (
            <span key={s.key} className={cx(i < done && !returned && !rejected && "text-cane-700", i === done && !returned && !rejected && status !== "ZONED" && "text-sugar-700 font-medium")}>
              {s.shortTitle}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
