"use client";

import type { ComponentProps } from "react";
import { RefTable } from "@/components/RefTable";

type Props = Pick<ComponentProps<typeof RefTable>, "rows" | "upsert" | "toggle">;

export function CbcTable({ rows, upsert, toggle }: Props) {
  return (
    <RefTable
      rows={rows}
      addTitle="Add a CBC"
      fields={[
        { name: "name", label: "Name" },
        { name: "lat", label: "Latitude", inputMode: "decimal", hint: "Decimal degrees, e.g. -1.051671" },
        { name: "lng", label: "Longitude", inputMode: "decimal", hint: "e.g. 34.598069" },
      ]}
      columns={[
        { key: "name", label: "CBC" },
        { key: "lat", label: "Latitude", render: (r) => <span className="tabular-nums">{Number(r.lat).toFixed(6)}</span> },
        { key: "lng", label: "Longitude", render: (r) => <span className="tabular-nums">{Number(r.lng).toFixed(6)}</span> },
      ]}
      upsert={upsert}
      toggle={toggle}
    />
  );
}