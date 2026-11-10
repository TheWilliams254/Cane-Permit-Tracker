import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guards";
import { referenceLists } from "@/lib/queries";
import { EntryForm } from "@/components/EntryForm";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "New entry" };

export default async function NewEntryPage() {
  await requireRole("SCOUT", "ADMIN");
  const refs = await referenceLists();
  return (
    <>
      <PageHeader title="New entry" lead="Capture the farmer, draw the field, take the photos and get the signature. Photos upload as you take them, so you can keep going on a weak signal." />
      <EntryForm banks={refs.banks} harvesters={refs.harvesters} cbcs={refs.cbcs} />
    </>
  );
}
