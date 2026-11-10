"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { clearSessionCookie, getSession, setSessionCookie } from "@/lib/auth/session";
import { changePasswordSchema, firstErrors, loginSchema } from "@/lib/validation";

export type FormState = { ok: boolean; message?: string; errors?: Record<string, string> };

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({ username: formData.get("username"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };

  const user = await db.query.users.findFirst({
    where: eq(schema.users.username, parsed.data.username.toLowerCase()),
  });
  // Constant-ish time: always run a compare.
  const ok = user ? await verifyPassword(parsed.data.password, user.passwordHash) : await verifyPassword(parsed.data.password, "$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid");
  if (!user || !ok || !user.active) {
    return { ok: false, message: "Username or password is incorrect, or the account has been deactivated." };
  }

  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id));
  await setSessionCookie({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  });
  redirect(user.mustChangePassword ? "/account?first=1" : "/");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function changePasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession();
  if (!session) redirect("/login");
  const parsed = changePasswordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };

  const user = await db.query.users.findFirst({ where: eq(schema.users.id, session.id) });
  if (!user || !(await verifyPassword(parsed.data.current, user.passwordHash))) {
    return { ok: false, errors: { current: "Current password is incorrect" } };
  }
  await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(parsed.data.next), mustChangePassword: false })
    .where(eq(schema.users.id, user.id));
  await setSessionCookie({ ...session, mustChangePassword: false });
  return { ok: true, message: "Password changed." };
}
