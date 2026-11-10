import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { toggleBankAction, upsertBankAction } from "@/actions/admin";
import { RefTable } from "@/components/RefTable";
import { Alert, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Banks" };

export default async function BanksPage() {
  await requireRole("ADMIN");
  const rows = await db.query.banks.findMany({ orderBy: (b, { asc }) => [asc(b.name)] });
  const nbk = rows.filter((b) => b.code === "12" && b.active).length;
  return (
    <>
      <PageHeader title="Banks" lead="Choosing a bank fills its code and fixes how many digits the account number must have." />
      {nbk > 1 && (
        <div className="mb-4">
          <Alert tone="warn">The bank master lists National Bank {nbk} times with different digit counts. Deactivate the variants the ERP does not accept so scouts see one choice.</Alert>
        </div>
      )}
      <RefTable
        rows={rows}
        addTitle="Add a bank"
        fields={[
          { name: "name", label: "Bank name" },
          { name: "code", label: "Bank code", inputMode: "numeric" },
          { name: "accountLength", label: "Account number digits", inputMode: "numeric" },
        ]}
        columns={[
          { key: "name", label: "Bank" },
          { key: "code", label: "Code" },
          { key: "accountLength", label: "Digits" },
        ]}
        upsert={upsertBankAction}
        toggle={toggleBankAction}
      />
    </>
  );
}
