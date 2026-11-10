import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { toggleCbcAction, upsertCbcAction } from "@/actions/admin";
import { RefTable } from "@/components/RefTable";
import { PageHeader, SectionTitle } from "@/components/ui";
import { ZONE_BAND_KM, ZONE_LETTERS, zoneRangeLabel } from "@/lib/zones";

export const metadata: Metadata = { title: "CBCs & zones" };

export default async function CbcsPage() {
  await requireRole("ADMIN");
  const rows = await db.query.cbcs.findMany({ orderBy: (c, { asc }) => [asc(c.name)] });
  return (
    <>
      <PageHeader title="Cane buying centres and transport zones" lead="The zone of a field is the band its polygon centroid falls in, measured as a straight line to the nearest active CBC." />
      <section className="mb-8">
        <SectionTitle>Zone bands</SectionTitle>
        <div className="panel overflow-hidden">
          <ol className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-stone-100">
            {ZONE_LETTERS.map((z) => (
              <li key={z} className="px-4 py-3">
                <p className="text-2xl font-bold text-cane-800">{z}</p>
                <p className="text-sm text-stone-500">{zoneRangeLabel(z)}</p>
              </li>
            ))}
          </ol>
          <p className="hairline px-4 py-2 text-sm text-stone-500">Bands are {ZONE_BAND_KM} km wide; zone {ZONE_LETTERS[ZONE_LETTERS.length - 1]} is open-ended. Change them in <code className="text-[13px]">src/lib/zones.ts</code>.</p>
        </div>
      </section>
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
        upsert={upsertCbcAction}
        toggle={toggleCbcAction}
      />
    </>
  );
}
