"use client";

import { useActionState, useState, useTransition } from "react";
import { createUserAction, resetPasswordAction, setUserActiveAction, setUserRoleAction, type UserFormState } from "@/actions/admin";
import type { Role } from "@/lib/db/schema";
import { ROLES, ROLE_LABEL } from "@/lib/workflow";
import { fmtDate } from "@/lib/format";
import { Alert, Button, Field, Input, Select } from "@/components/ui";

type Row = { id: string; username: string; name: string; phone: string | null; role: Role; active: boolean; mustChangePassword: boolean; lastLoginAt: Date | null; createdAt: Date };

export function UsersClient({ users, meId }: { users: Row[]; meId: string }) {
  const [state, action, pending] = useActionState<UserFormState, FormData>(createUserAction, { ok: false });
  const [issued, setIssued] = useState<{ username: string; tempPassword: string } | null>(null);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const credential = issued ?? (state.ok && state.tempPassword ? { username: state.username!, tempPassword: state.tempPassword } : null);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
      <div className="panel overflow-x-auto order-2 lg:order-1">
        {error && <div className="p-3"><Alert tone="danger">{error}</Alert></div>}
        <table className="table-base">
          <thead>
            <tr><th>Name</th><th>Username</th><th>Role</th><th>Last sign-in</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-60"}>
                <td><p className="font-medium">{u.name}</p>{u.phone && <p className="text-stone-500 tabular-nums">{u.phone}</p>}</td>
                <td className="tabular-nums">{u.username}</td>
                <td>
                  <select
                    className="field-input !min-h-9 !py-1 text-sm"
                    value={u.role}
                    disabled={busy || u.id === meId}
                    aria-label={`Role for ${u.name}`}
                    onChange={(e) => start(async () => { const r = await setUserRoleAction(u.id, e.target.value); setError(r.ok ? null : r.message ?? null); })}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                </td>
                <td className="text-stone-500 whitespace-nowrap">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : "Never"}{u.mustChangePassword && <span className="block text-sugar-700">Temporary password</span>}</td>
                <td>{u.active ? <span className="text-cane-700">Active</span> : <span className="text-stone-500">Deactivated</span>}</td>
                <td className="whitespace-nowrap">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => start(async () => { const r = await resetPasswordAction(u.id); if (r.ok && r.tempPassword) setIssued({ username: r.username!, tempPassword: r.tempPassword }); else setError(r.message ?? "Could not reset"); })}>Reset password</Button>
                    {u.id !== meId && (
                      <Button size="sm" variant={u.active ? "danger" : "secondary"} disabled={busy} onClick={() => start(async () => { const r = await setUserActiveAction(u.id, !u.active); setError(r.ok ? null : r.message ?? null); })}>
                        {u.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-4 order-1 lg:order-2">
        {credential && (
          <div className="panel p-4 border-cane-300 bg-cane-50">
            <p className="font-medium">Temporary password for {credential.username}</p>
            <p className="mt-1 font-mono text-xl tracking-wide select-all">{credential.tempPassword}</p>
            <p className="mt-2 text-sm text-stone-700">Share it in person or by phone. It is shown once and must be changed at first sign-in.</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => { setIssued(null); }}>Dismiss</Button>
          </div>
        )}
        <form action={action} className="panel p-4 flex flex-col gap-4" noValidate>
          <h2 className="text-lg font-bold">Add a user</h2>
          {state.message && !state.ok && <Alert tone="danger">{state.message}</Alert>}
          <Field label="Full name" htmlFor="u-name" error={state.errors?.name}><Input id="u-name" name="name" required error={!!state.errors?.name} /></Field>
          <Field label="Username" htmlFor="u-username" error={state.errors?.username} hint="Lowercase; letters, numbers, dot, dash, underscore."><Input id="u-username" name="username" autoCapitalize="none" required error={!!state.errors?.username} /></Field>
          <Field label="Phone (optional)" htmlFor="u-phone"><Input id="u-phone" name="phone" inputMode="tel" /></Field>
          <Field label="Role" htmlFor="u-role" error={state.errors?.role}>
            <Select id="u-role" name="role" defaultValue="SCOUT">
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </Select>
          </Field>
          <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create user"}</Button>
        </form>
      </div>
    </div>
  );
}
