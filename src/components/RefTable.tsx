"use client";

import { useActionState, useState, useTransition } from "react";
import type { FormState } from "@/actions/auth";
import { Alert, Button, Field, Input } from "./ui";

export type RefField = { name: string; label: string; hint?: string; inputMode?: "numeric" | "decimal" | "text" | "tel"; width?: string };

type Row = Record<string, unknown> & { id: string; active: boolean };

/** Generic admin table for a reference list: inline edit, add, deactivate. */
export function RefTable({
  rows,
  fields,
  columns,
  upsert,
  toggle,
  addTitle,
}: {
  rows: Row[];
  fields: RefField[];
  columns: { key: string; label: string; render?: (r: Row) => React.ReactNode }[];
  upsert: (prev: FormState, fd: FormData) => Promise<FormState>;
  toggle: (id: string, active: boolean) => Promise<void>;
  addTitle: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(upsert, { ok: false });
  const [editing, setEditing] = useState<Row | null>(null);
  const [busy, start] = useTransition();
  const [showInactive, setShowInactive] = useState(false);
  const visible = rows.filter((r) => showInactive || r.active);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start">
      <div className="order-2 lg:order-1">
        <label className="mb-2 inline-flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4 rounded border-stone-300 text-cane-700" />
          Show deactivated ({rows.length - rows.filter((r) => r.active).length})
        </label>
        <div className="panel overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>{columns.map((c) => <th key={c.key}>{c.label}</th>)}<th></th></tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className={r.active ? "" : "opacity-60"}>
                  {columns.map((c) => <td key={c.key}>{c.render ? c.render(r) : String(r[c.key] ?? "—")}</td>)}
                  <td className="whitespace-nowrap">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>Edit</Button>
                      <Button size="sm" variant={r.active ? "danger" : "secondary"} disabled={busy} onClick={() => start(() => toggle(r.id, !r.active))}>{r.active ? "Deactivate" : "Reactivate"}</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && <tr><td colSpan={columns.length + 1} className="text-center text-stone-500 py-8">Nothing here yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <form key={editing?.id ?? "new"} action={action} className="panel p-4 flex flex-col gap-4 order-1 lg:order-2" noValidate>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">{editing ? `Edit ${String(editing[fields[0].name] ?? "")}` : addTitle}</h2>
          {editing && <button type="button" className="text-sm text-cane-700 hover:underline" onClick={() => setEditing(null)}>Add new instead</button>}
        </div>
        {state.message && <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>}
        <input type="hidden" name="id" value={editing?.id ?? ""} />
        {fields.map((f) => (
          <Field key={f.name} label={f.label} htmlFor={`rf-${f.name}`} hint={f.hint} error={state.errors?.[f.name]}>
            <Input id={`rf-${f.name}`} name={f.name} inputMode={f.inputMode} defaultValue={editing ? String(editing[f.name] ?? "") : ""} error={!!state.errors?.[f.name]} />
          </Field>
        ))}
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Add"}</Button>
      </form>
    </div>
  );
}
