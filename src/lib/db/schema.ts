import {
  pgTable,
  pgEnum,
  text,
  integer,
  boolean,
  timestamp,
  doublePrecision,
  jsonb,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const roleEnum = pgEnum("role", [
  "ADMIN",
  "SCOUT",
  "CALL_CENTER",
  "IT_CHECKER",
  "LEGAL",
  "PERMIT_OFFICER",
  "GIS_OFFICER",
]);

export const statusEnum = pgEnum("entry_status", [
  "SUBMITTED",
  "FARMER_CONFIRMED",
  "DATA_CHECKED",
  "DOCS_RECEIVED",
  "ERP_POSTED",
  "PERMIT_ISSUED",
  "ZONED",
  "RETURNED",
  "REJECTED",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  role: roleEnum("role").notNull(),
  passwordHash: text("password_hash").notNull(),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
});

export const banks = pgTable("banks", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  accountLength: integer("account_length").notNull(),
  active: boolean("active").notNull().default(true),
});

export const harvesters = pgTable("harvesters", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  phone: text("phone"),
  idNumber: text("id_number"),
  active: boolean("active").notNull().default(true),
});

export const cbcs = pgTable("cbcs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  active: boolean("active").notNull().default(true),
});

export type LatLng = [number, number];

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(), // human-readable, e.g. CP-2026-00042
    status: statusEnum("status").notNull().default("SUBMITTED"),
    scoutId: uuid("scout_id")
      .notNull()
      .references(() => users.id),

    // Farmer and field
    farmerName: text("farmer_name").notNull(),
    farmerPhone: text("farmer_phone").notNull(),
    farmerIdNumber: text("farmer_id_number").notNull(),
    plotLrNo: text("plot_lr_no").notNull(),
    estimatedAcres: doublePrecision("estimated_acres").notNull(),
    estimatedTrips: integer("estimated_trips").notNull(),
    sublocation: text("sublocation").notNull(),
    area: text("area").notNull(),
    deliveryCbcId: uuid("delivery_cbc_id").references(() => cbcs.id),
    harvesterId: uuid("harvester_id").references(() => harvesters.id),

    // Field polygon and derived zoning
    polygon: jsonb("polygon").$type<LatLng[]>().notNull(),
    centroidLat: doublePrecision("centroid_lat").notNull(),
    centroidLng: doublePrecision("centroid_lng").notNull(),
    polygonAcres: doublePrecision("polygon_acres").notNull(),
    polygonHectares: doublePrecision("polygon_hectares").notNull(),
    nearestCbcId: uuid("nearest_cbc_id").references(() => cbcs.id),
    distanceKm: doublePrecision("distance_km"),
    zone: text("zone"),

    // GIS confirmation (may override the computed values)
    gisZone: text("gis_zone"),
    gisCbcId: uuid("gis_cbc_id").references(() => cbcs.id),
    gisDistanceKm: doublePrecision("gis_distance_km"),
    gisFieldInspected: boolean("gis_field_inspected"),
    gisPolygonReviewed: boolean("gis_polygon_reviewed"),

    // Bank
    bankId: uuid("bank_id").references(() => banks.id),
    bankCode: text("bank_code"),
    bankName: text("bank_name"),
    accountNumber: text("account_number"),
    accountName: text("account_name"),
    branch: text("branch"),
    bankCardPhotoUrl: text("bank_card_photo_url"),

    // Photos, consent, signature
    idFrontUrl: text("id_front_url").notNull(),
    idBackUrl: text("id_back_url").notNull(),
    farmerPhotoUrl: text("farmer_photo_url").notNull(),
    signatureUrl: text("signature_url").notNull(),
    termsVersion: text("terms_version").notNull(),
    termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }).notNull(),
    dataConsentVersion: text("data_consent_version").notNull(),
    dataConsentAt: timestamp("data_consent_at", { withTimezone: true }).notNull(),

    // Stage outputs
    callCenterConfirmedAt: timestamp("call_center_confirmed_at", { withTimezone: true }),
    callCenterChecks: jsonb("call_center_checks").$type<Record<string, boolean>>(),
    callAttempts: integer("call_attempts").notNull().default(0),
    dataCheckedAt: timestamp("data_checked_at", { withTimezone: true }),
    legalDocsReceivedAt: timestamp("legal_docs_received_at", { withTimezone: true }),
    legalDocsChecklist: jsonb("legal_docs_checklist").$type<Record<string, boolean>>(),
    legalFileRef: text("legal_file_ref"),
    erpFarmerCode: text("erp_farmer_code"),
    erpFieldCode: text("erp_field_code"),
    erpPostedAt: timestamp("erp_posted_at", { withTimezone: true }),
    permitNumber: text("permit_number"),
    ccsClips: text("ccs_clips"),
    permitIssuedAt: timestamp("permit_issued_at", { withTimezone: true }),
    zonedAt: timestamp("zoned_at", { withTimezone: true }),
    returnReason: text("return_reason"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("entries_status_idx").on(t.status),
    index("entries_scout_idx").on(t.scoutId),
    index("entries_created_idx").on(t.createdAt),
  ],
);

export const events = pgTable(
  "entry_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id),
    action: text("action").notNull(),
    fromStatus: statusEnum("from_status"),
    toStatus: statusEnum("to_status"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("events_entry_idx").on(t.entryId), index("events_actor_idx").on(t.actorId)],
);

export const counters = pgTable("counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
});

export const usersRelations = relations(users, ({ many }) => ({
  entries: many(entries),
  events: many(events),
}));

export const entriesRelations = relations(entries, ({ one, many }) => ({
  scout: one(users, { fields: [entries.scoutId], references: [users.id] }),
  harvester: one(harvesters, { fields: [entries.harvesterId], references: [harvesters.id] }),
  bank: one(banks, { fields: [entries.bankId], references: [banks.id] }),
  deliveryCbc: one(cbcs, { fields: [entries.deliveryCbcId], references: [cbcs.id], relationName: "deliveryCbc" }),
  nearestCbc: one(cbcs, { fields: [entries.nearestCbcId], references: [cbcs.id], relationName: "nearestCbc" }),
  gisCbc: one(cbcs, { fields: [entries.gisCbcId], references: [cbcs.id], relationName: "gisCbc" }),
  events: many(events),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  entry: one(entries, { fields: [events.entryId], references: [entries.id] }),
  actor: one(users, { fields: [events.actorId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;
export type EntryEvent = typeof events.$inferSelect;
export type Bank = typeof banks.$inferSelect;
export type Harvester = typeof harvesters.$inferSelect;
export type Cbc = typeof cbcs.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type EntryStatus = (typeof statusEnum.enumValues)[number];
