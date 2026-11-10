import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/guards";
import { ROLE_LABEL } from "@/lib/workflow";
import { PageHeader, Alert } from "@/components/ui";
import { PasswordForm } from "./PasswordForm";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ first?: string }> }) {
  const user = await requireSession();
  const { first } = await searchParams;
  return (
    <>
      <PageHeader title="Your account" lead={`${user.name} · ${ROLE_LABEL[user.role]} · signed in as ${user.username}`} />
      <div className="max-w-md flex flex-col gap-4">
        {(first || user.mustChangePassword) && (
          <Alert tone="warn">You are using a temporary password. Choose your own before continuing.</Alert>
        )}
        <PasswordForm />
      </div>
    </>
  );
}
