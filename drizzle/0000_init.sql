CREATE TYPE "public"."role" AS ENUM('ADMIN', 'SCOUT', 'CALL_CENTER', 'IT_CHECKER', 'LEGAL', 'PERMIT_OFFICER', 'GIS_OFFICER');--> statement-breakpoint
CREATE TYPE "public"."entry_status" AS ENUM('SUBMITTED', 'FARMER_CONFIRMED', 'DATA_CHECKED', 'DOCS_RECEIVED', 'ERP_POSTED', 'PERMIT_ISSUED', 'ZONED', 'RETURNED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "banks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"account_length" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cbcs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "cbcs_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference" text NOT NULL,
	"status" "entry_status" DEFAULT 'SUBMITTED' NOT NULL,
	"scout_id" uuid NOT NULL,
	"farmer_name" text NOT NULL,
	"farmer_phone" text NOT NULL,
	"farmer_id_number" text NOT NULL,
	"plot_lr_no" text NOT NULL,
	"estimated_acres" double precision NOT NULL,
	"estimated_trips" integer NOT NULL,
	"sublocation" text NOT NULL,
	"area" text NOT NULL,
	"delivery_cbc_id" uuid,
	"harvester_id" uuid,
	"polygon" jsonb NOT NULL,
	"centroid_lat" double precision NOT NULL,
	"centroid_lng" double precision NOT NULL,
	"polygon_acres" double precision NOT NULL,
	"polygon_hectares" double precision NOT NULL,
	"nearest_cbc_id" uuid,
	"distance_km" double precision,
	"zone" text,
	"gis_zone" text,
	"gis_cbc_id" uuid,
	"gis_distance_km" double precision,
	"gis_field_inspected" boolean,
	"gis_polygon_reviewed" boolean,
	"bank_id" uuid,
	"bank_code" text,
	"bank_name" text,
	"account_number" text,
	"account_name" text,
	"branch" text,
	"bank_card_photo_url" text,
	"id_front_url" text NOT NULL,
	"id_back_url" text NOT NULL,
	"farmer_photo_url" text NOT NULL,
	"signature_url" text NOT NULL,
	"terms_version" text NOT NULL,
	"terms_accepted_at" timestamp with time zone NOT NULL,
	"data_consent_version" text NOT NULL,
	"data_consent_at" timestamp with time zone NOT NULL,
	"call_center_confirmed_at" timestamp with time zone,
	"call_center_checks" jsonb,
	"call_attempts" integer DEFAULT 0 NOT NULL,
	"data_checked_at" timestamp with time zone,
	"legal_docs_received_at" timestamp with time zone,
	"legal_docs_checklist" jsonb,
	"legal_file_ref" text,
	"erp_farmer_code" text,
	"erp_field_code" text,
	"erp_posted_at" timestamp with time zone,
	"permit_number" text,
	"ccs_clips" text,
	"permit_issued_at" timestamp with time zone,
	"zoned_at" timestamp with time zone,
	"return_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entries_reference_unique" UNIQUE("reference")
);
--> statement-breakpoint
CREATE TABLE "entry_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"from_status" "entry_status",
	"to_status" "entry_status",
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "harvesters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"id_number" text,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "harvesters_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"role" "role" NOT NULL,
	"password_hash" text NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_scout_id_users_id_fk" FOREIGN KEY ("scout_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_delivery_cbc_id_cbcs_id_fk" FOREIGN KEY ("delivery_cbc_id") REFERENCES "public"."cbcs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_harvester_id_harvesters_id_fk" FOREIGN KEY ("harvester_id") REFERENCES "public"."harvesters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_nearest_cbc_id_cbcs_id_fk" FOREIGN KEY ("nearest_cbc_id") REFERENCES "public"."cbcs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_gis_cbc_id_cbcs_id_fk" FOREIGN KEY ("gis_cbc_id") REFERENCES "public"."cbcs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_events" ADD CONSTRAINT "entry_events_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_events" ADD CONSTRAINT "entry_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entries_status_idx" ON "entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "entries_scout_idx" ON "entries" USING btree ("scout_id");--> statement-breakpoint
CREATE INDEX "entries_created_idx" ON "entries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "events_entry_idx" ON "entry_events" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "events_actor_idx" ON "entry_events" USING btree ("actor_id");