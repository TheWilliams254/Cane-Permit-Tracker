"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { schema } from "@/lib/db/schema-client";
import { STATUS_LABEL } from "@/lib/workflow";
import { Input, Select } from "@/components/ui";

export function EntriesFilter({ status, q }: { status: string; q: string }) {
  const router = useRouter();
  const params = useSearchParams();
  function update(next: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) v ? p.set(k, v) : p.delete(k);
    router.replace(`/entries?${p.toString()}`);
  }
  return (
    <form className="mb-4 flex flex-col sm:flex-row gap-2" onSubmit={(e) => e.preventDefault()} role="search">
      <Input
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Search name, phone, ID, reference or plot"
        className="sm:max-w-sm"
        aria-label="Search entries"
        onKeyDown={(e) => e.key === "Enter" && update({ q: (e.target as HTMLInputElement).value })}
        onBlur={(e) => e.target.value !== q && update({ q: e.target.value })}
      />
      <Select value={status} onChange={(e) => update({ status: e.target.value })} className="sm:max-w-[240px]" aria-label="Filter by status">
        <option value="">All statuses</option>
        {schema.statuses.map((s) => (
          <option key={s} value={s}>{STATUS_LABEL[s]}</option>
        ))}
      </Select>
    </form>
  );
}
