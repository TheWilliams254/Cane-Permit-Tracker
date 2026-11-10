import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guards";
import { listEntries } from "@/lib/queries";
import { schema } from "@/lib/db";
import type { EntryStatus } from "@/lib/db/schema";
import { STATUS_LABEL } from "@/lib/workflow";
import { EntryTable } from "@/components/EntryTable";
import { LinkButton, PageHeader } from "@/components/ui";
import { EntriesFilter } from "./EntriesFilter";

export const metadata: Metadata = { title: "Entries" };

export default async function EntriesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const user = await requireRole("SCOUT", "ADMIN");
  const sp = await searchParams;
  const status = schema.statusEnum.enumValues.includes(sp.status as EntryStatus) ? (sp.status as EntryStatus) : undefined;
  const isAdmin = user.role === "ADMIN";

  const rows = await listEntries({
    statuses: status ? [status] : undefined,
    scoutId: isAdmin ? undefined : user.id,
    search: sp.q,
  });
  const returned = isAdmin ? 0 : rows.filter((r) => r.status === "RETURNED").length;

  return (
    <>
      <PageHeader
        title={isAdmin ? "All entries" : "My entries"}
        lead={
          isAdmin
            ? `${rows.length} ${status ? STATUS_LABEL[status].toLowerCase() : ""} entries across every stage.`
            : returned
              ? `${returned} ${returned === 1 ? "entry needs" : "entries need"} your correction.`
              : "Every field you have captured and where it stands."
        }
        actions={
          isAdmin ? (
            <LinkButton href={`/admin/export${status ? `?status=${status}` : ""}`} variant="secondary">Download CSV</LinkButton>
          ) : (
            <LinkButton href="/entries/new">New entry</LinkButton>
          )
        }
      />
      <EntriesFilter status={status ?? ""} q={sp.q ?? ""} />
      <EntryTable
        rows={rows}
        showScout={isAdmin}
        showWaitingOn={isAdmin}
        empty={{
          title: sp.q || status ? "No entries match" : isAdmin ? "No entries yet" : "You have not captured any fields yet",
          body: sp.q || status ? "Clear the filter to see everything." : isAdmin ? "Entries appear here as scouts submit them." : "Start with a new entry when you are with the farmer.",
          action: !isAdmin && !sp.q && !status ? <LinkButton href="/entries/new">New entry</LinkButton> : undefined,
        }}
      />
    </>
  );
}
