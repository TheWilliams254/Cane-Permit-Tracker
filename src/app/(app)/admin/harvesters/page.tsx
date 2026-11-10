import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { toggleHarvesterAction, upsertHarvesterAction } from "@/actions/admin";
import { RefTable } from "@/components/RefTable";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Harvesters" };

export default async function HarvestersPage() {
  await requireRole("ADMIN");
  const rows = await db.query.harvesters.findMany({ orderBy: (h, { asc }) => [asc(h.name)] });
  return (
    <>
      <PageHeader title="Harvesters" lead="The dropdown scouts choose from. Codes match the ERP partner accounts (HARVnnn)." />
      <RefTable
        rows={rows}
        addTitle="Onboard a harvester"
        fields={[
          { name: "name", label: "Name" },
          { name: "code", label: "ERP code", hint: "e.g. HARV066" },
          { name: "phone", label: "Phone (optional)", inputMode: "tel" },
          { name: "idNumber", label: "ID number (optional)", inputMode: "numeric" },
        ]}
        columns={[
          { key: "name", label: "Name" },
          { key: "code", label: "Code" },
          { key: "phone", label: "Phone" },
          { key: "idNumber", label: "ID" },
        ]}
        upsert={upsertHarvesterAction}
        toggle={toggleHarvesterAction}
      />
    </>
  );
}
