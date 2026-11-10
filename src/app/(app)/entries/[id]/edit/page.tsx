import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getEntryFull, referenceLists } from "@/lib/queries";
import { EntryForm } from "@/components/EntryForm";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Correct entry" };

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole("SCOUT", "ADMIN");
  const { id } = await params;
  const entry = await getEntryFull(id);
  if (!entry) notFound();
  if (user.role !== "ADMIN" && entry.scoutId !== user.id) redirect("/entries");
  if (entry.status !== "RETURNED") redirect(`/entries/${id}`);
  const refs = await referenceLists();
  return (
    <>
      <PageHeader title={`Correct ${entry.reference}`} lead="Fix what was flagged and resubmit. The entry goes back to the start of the pipeline." />
      <EntryForm banks={refs.banks} harvesters={refs.harvesters} cbcs={refs.cbcs} initial={entry} />
    </>
  );
}
