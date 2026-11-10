"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, schema } from "@/lib/db";
import { requireRole } from "@/lib/auth/guards";
import { generateTempPassword, hashPassword } from "@/lib/auth/password";
import { bankInputSchema, cbcInputSchema, firstErrors, harvesterInputSchema, userInputSchema } from "@/lib/validation";
import type { FormState } from "./auth";

export type UserFormState = FormState & { tempPassword?: string; username?: string };

export async function createUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  await requireRole("ADMIN");
  const parsed = userInputSchema.safeParse({
    username: formData.get("username"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };
  const exists = await db.query.users.findFirst({ where: eq(schema.users.username, parsed.data.username) });
  if (exists) return { ok: false, errors: { username: "That username is already taken" } };

  const tempPassword = generateTempPassword();
  await db.insert(schema.users).values({
    username: parsed.data.username,
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    role: parsed.data.role,
    passwordHash: await hashPassword(tempPassword),
    mustChangePassword: true,
  });
  revalidatePath("/admin/users");
  return { ok: true, message: "User created.", tempPassword, username: parsed.data.username };
}

export async function resetPasswordAction(userId: string): Promise<UserFormState> {
  await requireRole("ADMIN");
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!user) return { ok: false, message: "User not found." };
  const tempPassword = generateTempPassword();
  await db
    .update(schema.users)
    .set({ passwordHash: await hashPassword(tempPassword), mustChangePassword: true })
    .where(eq(schema.users.id, userId));
  revalidatePath("/admin/users");
  return { ok: true, message: "Temporary password issued.", tempPassword, username: user.username };
}

export async function setUserRoleAction(userId: string, role: string): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const parsed = userInputSchema.shape.role.safeParse(role);
  if (!parsed.success) return { ok: false, message: "Unknown role." };
  if (admin.id === userId && parsed.data !== "ADMIN") return { ok: false, message: "You cannot remove your own administrator role." };
  await db.update(schema.users).set({ role: parsed.data }).where(eq(schema.users.id, userId));
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function setUserActiveAction(userId: string, active: boolean): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  if (admin.id === userId && !active) return { ok: false, message: "You cannot deactivate your own account." };
  await db.update(schema.users).set({ active }).where(eq(schema.users.id, userId));
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function upsertHarvesterAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN");
  const id = String(formData.get("id") || "");
  const parsed = harvesterInputSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    idNumber: formData.get("idNumber"),
  });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };
  const values = { ...parsed.data, phone: parsed.data.phone || null, idNumber: parsed.data.idNumber || null };
  if (id) {
    await db.update(schema.harvesters).set(values).where(eq(schema.harvesters.id, id));
  } else {
    const dup = await db.query.harvesters.findFirst({ where: eq(schema.harvesters.code, values.code) });
    if (dup) return { ok: false, errors: { code: "A harvester with this code already exists" } };
    await db.insert(schema.harvesters).values(values);
  }
  revalidatePath("/admin/harvesters");
  return { ok: true, message: id ? "Harvester updated." : "Harvester added." };
}

export async function toggleHarvesterAction(id: string, active: boolean) {
  await requireRole("ADMIN");
  await db.update(schema.harvesters).set({ active }).where(eq(schema.harvesters.id, id));
  revalidatePath("/admin/harvesters");
}

export async function upsertBankAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN");
  const id = String(formData.get("id") || "");
  const parsed = bankInputSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    accountLength: formData.get("accountLength"),
  });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };
  if (id) await db.update(schema.banks).set(parsed.data).where(eq(schema.banks.id, id));
  else await db.insert(schema.banks).values(parsed.data);
  revalidatePath("/admin/banks");
  return { ok: true, message: id ? "Bank updated." : "Bank added." };
}

export async function toggleBankAction(id: string, active: boolean) {
  await requireRole("ADMIN");
  await db.update(schema.banks).set({ active }).where(eq(schema.banks.id, id));
  revalidatePath("/admin/banks");
}

export async function upsertCbcAction(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("ADMIN");
  const id = String(formData.get("id") || "");
  const parsed = cbcInputSchema.safeParse({ name: formData.get("name"), lat: formData.get("lat"), lng: formData.get("lng") });
  if (!parsed.success) return { ok: false, errors: firstErrors(parsed.error) };
  if (id) await db.update(schema.cbcs).set(parsed.data).where(eq(schema.cbcs.id, id));
  else {
    const dup = await db.query.cbcs.findFirst({ where: eq(schema.cbcs.name, parsed.data.name) });
    if (dup) return { ok: false, errors: { name: "A CBC with this name already exists" } };
    await db.insert(schema.cbcs).values(parsed.data);
  }
  revalidatePath("/admin/cbcs");
  return { ok: true, message: id ? "CBC updated." : "CBC added." };
}

export async function toggleCbcAction(id: string, active: boolean) {
  await requireRole("ADMIN");
  await db.update(schema.cbcs).set({ active }).where(eq(schema.cbcs.id, id));
  revalidatePath("/admin/cbcs");
}
