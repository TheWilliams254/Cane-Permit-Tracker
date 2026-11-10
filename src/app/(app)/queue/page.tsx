import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/guards";
import { listEntries } from "@/lib/queries";
import { stagesForRole } from "@/lib/workflow";
import { EntryTable } from "@/components/EntryTable";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "My queue" };

export default async function QueuePage() {
  const user = await requireSession();
  const stages = stagesForRole(user.role);
  if (!stages.length) redirect("/");

  const rows = await listEntries({ statuses: stages.map((s) => s.input) });
  const lead =
    stages.length === 1
      ? stages[0].description
      : `Two stages come to you: ${stages.map((s) => s.title.toLowerCase()).join(" and ")}.`;

  return (
    <>
      <PageHeader title="My queue" lead={`${rows.length} ${rows.length === 1 ? "entry is" : "entries are"} waiting on you. ${lead}`} />
      {stages.length > 1 ? (
        <div className="flex flex-col gap-8">
          {stages.map((s) => {
            const subset = rows.filter((r) => r.status === s.input);
            return (
              <section key={s.key}>
                <h2 className="text-lg font-bold mb-3">{s.title} <span className="text-stone-500 font-normal">· {subset.length}</span></h2>
                <EntryTable rows={subset} dateLabel="Waiting since" empty={{ title: `Nothing waiting for ${s.title.toLowerCase()}` }} />
              </section>
            );
          })}
        </div>
      ) : (
        <EntryTable rows={rows} dateLabel="Waiting since" empty={{ title: "Your queue is clear", body: "New entries appear here as soon as the previous stage finishes with them." }} />
      )}
    </>
  );
}
