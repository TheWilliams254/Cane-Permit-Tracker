import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import { STATUS_LABEL } from "@/lib/workflow";

export const dynamic = "force-dynamic";

function csvCell(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return new Response("Forbidden", { status: 403 });
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const where = status && (schema.statusEnum.enumValues as string[]).includes(status) ? eq(schema.entries.status, status as schema.EntryStatus) : undefined;

  const rows = await db.query.entries.findMany({
    where,
    orderBy: [desc(schema.entries.createdAt)],
    with: { scout: { columns: { name: true } }, harvester: true, deliveryCbc: true, nearestCbc: true, gisCbc: true },
  });

  const header = [
    "Reference", "Status", "Captured", "Scout", "Farmer name", "Phone", "ID number", "Plot LR", "Sub-location", "Area",
    "Est. acres", "Est. trips", "Polygon acres", "Polygon ha", "Delivery CBC", "Nearest CBC", "Distance km", "Zone (computed)",
    "Zone (GIS)", "GIS CBC", "GIS distance km", "Harvester", "Harvester code", "Bank", "Bank code", "Account number", "Account name", "Branch",
    "Farmer confirmed", "Data checked", "Docs received", "Legal file", "ERP farmer code", "ERP field code", "ERP posted", "Permit number", "CCS clips", "Permit issued", "Zoned",
    "Centroid lat", "Centroid lng", "Return/reject reason",
  ];
  const lines = [header.map(csvCell).join(",")];
  for (const e of rows) {
    lines.push(
      [
        e.reference, STATUS_LABEL[e.status], e.createdAt, e.scout.name, e.farmerName, e.farmerPhone, e.farmerIdNumber, e.plotLrNo, e.sublocation, e.area,
        e.estimatedAcres, e.estimatedTrips, e.polygonAcres.toFixed(3), e.polygonHectares.toFixed(3), e.deliveryCbc?.name, e.nearestCbc?.name, e.distanceKm, e.zone,
        e.gisZone, e.gisCbc?.name, e.gisDistanceKm, e.harvester?.name, e.harvester?.code, e.bankName, e.bankCode, e.accountNumber, e.accountName, e.branch,
        e.callCenterConfirmedAt, e.dataCheckedAt, e.legalDocsReceivedAt, e.legalFileRef, e.erpFarmerCode, e.erpFieldCode, e.erpPostedAt, e.permitNumber, e.ccsClips, e.permitIssuedAt, e.zonedAt,
        e.centroidLat, e.centroidLng, e.returnReason,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cane-permit-entries-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
