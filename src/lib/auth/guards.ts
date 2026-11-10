import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "./session";
import type { Role } from "@/lib/db/schema";

export async function requireSession(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const s = await requireSession();
  if (!roles.includes(s.role)) redirect("/");
  return s;
}

export function assertRole(user: SessionUser, ...roles: Role[]) {
  if (!roles.includes(user.role)) throw new Error("You do not have permission to do that.");
}
