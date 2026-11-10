import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth/guards";
import { listCompletedBy } from "@/lib/queries";
import { isStageRole } from "@/lib/workflow";
import { EntryTable } from "@/components/EntryTable";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Completed" };

export default async function CompletedPage() {
  const user = await requireSession();
  if (!isStageRole(user.role)) redirect("/");
  const rows = await listCompletedBy(user.id);
  return (
    <>
      <PageHeader title="Completed" lead={`${rows.length} ${rows.length === 1 ? "entry" : "entries"} you have actioned, most recent first. The progress bar shows how far each has gone since.`} />
      <EntryTable rows={rows} showWaitingOn dateLabel="Your action" dateKey="lastActionAt" empty={{ title: "Nothing completed yet", body: "Entries you confirm, return or reject will be listed here." }} />
    </>
  );
}
