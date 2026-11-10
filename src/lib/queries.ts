import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { EntryStatus, Role } from "@/lib/db/schema";
import type { SessionUser } from "@/lib/auth/session";
import { stagesForRole } from "@/lib/workflow";

export type EntryListRow = {
  id: string;
  reference: string;
  status: EntryStatus;
  farmerName: string;
  farmerPhone: string;
  plotLrNo: string;
  area: string;
  sublocation: string;
  zone: string | null;
  gisZone: string | null;
  estimatedAcres: number;
  callAttempts: number;
  updatedAt: Date;
  createdAt: Date;
  scoutName: string;
  cbcName: string | null;
};

const listSelect = {
  id: schema.entries.id,
  reference: schema.entries.reference,
  status: schema.entries.status,
  farmerName: schema.entries.farmerName,
  farmerPhone: schema.entries.farmerPhone,
  plotLrNo: schema.entries.plotLrNo,
  area: schema.entries.area,
  sublocation: schema.entries.sublocation,
  zone: schema.entries.zone,
  gisZone: schema.entries.gisZone,
  estimatedAcres: schema.entries.estimatedAcres,
  callAttempts: schema.entries.callAttempts,
  updatedAt: schema.entries.updatedAt,
  createdAt: schema.entries.createdAt,
  scoutName: schema.users.name,
  cbcName: schema.cbcs.name,
};

export async function listEntries(opts: {
  statuses?: EntryStatus[];
  scoutId?: string;
  search?: string;
  limit?: number;
}): Promise<EntryListRow[]> {
  const where: SQL[] = [];
  if (opts.statuses?.length) where.push(inArray(schema.entries.status, opts.statuses));
  if (opts.scoutId) where.push(eq(schema.entries.scoutId, opts.scoutId));
  if (opts.search) {
    const q = `%${opts.search.trim()}%`;
    where.push(
      or(
        ilike(schema.entries.farmerName, q),
        ilike(schema.entries.reference, q),
        ilike(schema.entries.farmerPhone, q),
        ilike(schema.entries.farmerIdNumber, q),
        ilike(schema.entries.plotLrNo, q),
      )!,
    );
  }
  return db
    .select(listSelect)
    .from(schema.entries)
    .innerJoin(schema.users, eq(schema.entries.scoutId, schema.users.id))
    .leftJoin(schema.cbcs, eq(schema.entries.deliveryCbcId, schema.cbcs.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(schema.entries.updatedAt))
    .limit(opts.limit ?? 500);
}

/** Entries the given user has acted on (their "completed" list). */
export async function listCompletedBy(userId: string): Promise<(EntryListRow & { lastActionAt: Date; lastAction: string })[]> {
  const latest = db
    .select({
      entryId: schema.events.entryId,
      lastActionAt: sql<Date>`max(${schema.events.createdAt})`.as("last_action_at"),
    })
    .from(schema.events)
    .where(and(eq(schema.events.actorId, userId), sql`${schema.events.action} not in ('CALL_ATTEMPT','SUBMITTED','RESUBMITTED')`))
    .groupBy(schema.events.entryId)
    .as("latest");

  const rows = await db
    .select({ ...listSelect, lastActionAt: latest.lastActionAt })
    .from(latest)
    .innerJoin(schema.entries, eq(schema.entries.id, latest.entryId))
    .innerJoin(schema.users, eq(schema.entries.scoutId, schema.users.id))
    .leftJoin(schema.cbcs, eq(schema.entries.deliveryCbcId, schema.cbcs.id))
    .orderBy(desc(latest.lastActionAt))
    .limit(500);

  return rows.map((r) => ({ ...r, lastAction: "" }));
}

export async function getEntryFull(id: string) {
  return db.query.entries.findFirst({
    where: eq(schema.entries.id, id),
    with: {
      scout: { columns: { id: true, name: true, phone: true, username: true } },
      harvester: true,
      bank: true,
      deliveryCbc: true,
      nearestCbc: true,
      gisCbc: true,
      events: { with: { actor: { columns: { name: true, role: true } } }, orderBy: (ev, { asc }) => [asc(ev.createdAt)] },
    },
  });
}

export type EntryFull = NonNullable<Awaited<ReturnType<typeof getEntryFull>>>;

export function canViewEntry(user: SessionUser, entry: EntryFull): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "SCOUT") return entry.scoutId === user.id;
  const stages = stagesForRole(user.role as Role);
  if (stages.some((s) => s.input === entry.status)) return true; // in their queue
  return entry.events.some((ev) => ev.actorId === user.id); // they acted on it
}

export async function countsByStatus() {
  const rows = await db
    .select({ status: schema.entries.status, n: sql<number>`count(*)::int` })
    .from(schema.entries)
    .groupBy(schema.entries.status);
  const out = {} as Record<EntryStatus, number>;
  for (const s of schema.statusEnum.enumValues) out[s] = 0;
  for (const r of rows) out[r.status] = r.n;
  return out;
}

export async function recentEvents(limit = 25) {
  return db.query.events.findMany({
    orderBy: (ev, { desc }) => [desc(ev.createdAt)],
    limit,
    with: {
      actor: { columns: { name: true, role: true } },
      entry: { columns: { id: true, reference: true, farmerName: true } },
    },
  });
}

export async function referenceLists() {
  const [banks, harvesters, cbcs] = await Promise.all([
    db.query.banks.findMany({ orderBy: (b, { asc }) => [asc(b.name)] }),
    db.query.harvesters.findMany({ orderBy: (h, { asc }) => [asc(h.name)] }),
    db.query.cbcs.findMany({ orderBy: (c, { asc }) => [asc(c.name)] }),
  ]);
  return { banks, harvesters, cbcs };
}
