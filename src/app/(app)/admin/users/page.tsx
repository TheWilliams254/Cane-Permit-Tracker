import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { UsersClient } from "./UsersClient";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireRole("ADMIN");
  const users = await db.query.users.findMany({
    orderBy: (u, { asc }) => [asc(u.role), asc(u.name)],
    columns: { id: true, username: true, name: true, phone: true, role: true, active: true, mustChangePassword: true, lastLoginAt: true, createdAt: true },
  });
  return (
    <>
      <PageHeader title="Users" lead="Add people with a temporary password, set what they do, and deactivate anyone who leaves. Everyone changes their password on first sign-in." />
      <UsersClient users={users} meId={me.id} />
    </>
  );
}
