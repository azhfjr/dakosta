CREATE TABLE "kpi_target_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_id" uuid,
	"stakeholder_id" uuid,
	"branch_office_id" uuid,
	"regional_office_id" uuid,
	"theme_id" uuid,
	"sub_theme" text,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"target_count" integer NOT NULL,
	"change_type" text NOT NULL,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kpi_target_history_change_check" CHECK ("kpi_target_history"."change_type" in ('CREATED', 'UPDATED', 'DELETED'))
);
--> statement-breakpoint
CREATE TABLE "sla_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_days" integer,
	"calendar" text DEFAULT '24x7' NOT NULL,
	"starts_at" text DEFAULT 'FIRST_SUBMISSION' NOT NULL,
	"pauses_on_revision" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sla_policies_target_days_check" CHECK ("sla_policies"."target_days" is null or "sla_policies"."target_days" > 0),
	CONSTRAINT "sla_policies_calendar_check" CHECK ("sla_policies"."calendar" in ('24x7', 'BUSINESS_DAYS')),
	CONSTRAINT "sla_policies_starts_at_check" CHECK ("sla_policies"."starts_at" in ('FIRST_SUBMISSION', 'LATEST_SUBMISSION'))
);
--> statement-breakpoint
CREATE TABLE "user_activation_locations" (
	"user_id" text PRIMARY KEY NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"accuracy_meters" double precision NOT NULL,
	"source" text NOT NULL,
	"distance_meters" double precision,
	"review_flag" boolean DEFAULT false NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_activation_locations_source_check" CHECK ("user_activation_locations"."source" in ('browser_geolocation', 'demo_backfill', 'master_exception')),
	CONSTRAINT "user_activation_locations_latitude_check" CHECK ("user_activation_locations"."latitude" between -90 and 90),
	CONSTRAINT "user_activation_locations_longitude_check" CHECK ("user_activation_locations"."longitude" between -180 and 180),
	CONSTRAINT "user_activation_locations_accuracy_check" CHECK ("user_activation_locations"."accuracy_meters" >= 0)
);
--> statement-breakpoint
ALTER TABLE "content_submissions" ADD COLUMN "branch_office_id" uuid;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD COLUMN "regional_office_id" uuid;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD COLUMN "first_submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "stakeholder_id" uuid;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "location_status" text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "location_grace_deadline" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kpi_target_history" ADD CONSTRAINT "kpi_target_history_stakeholder_id_stakeholders_id_fk" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_target_history" ADD CONSTRAINT "kpi_target_history_branch_office_id_branch_offices_id_fk" FOREIGN KEY ("branch_office_id") REFERENCES "public"."branch_offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_target_history" ADD CONSTRAINT "kpi_target_history_regional_office_id_regional_offices_id_fk" FOREIGN KEY ("regional_office_id") REFERENCES "public"."regional_offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_target_history" ADD CONSTRAINT "kpi_target_history_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activation_locations" ADD CONSTRAINT "user_activation_locations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kpi_target_history_stakeholder_period_idx" ON "kpi_target_history" USING btree ("stakeholder_id","period_start");--> statement-breakpoint
CREATE INDEX "sla_policies_active_idx" ON "sla_policies" USING btree ("active","updated_at");--> statement-breakpoint
ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_branch_office_id_branch_offices_id_fk" FOREIGN KEY ("branch_office_id") REFERENCES "public"."branch_offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_regional_office_id_regional_offices_id_fk" FOREIGN KEY ("regional_office_id") REFERENCES "public"."regional_offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_stakeholder_id_stakeholders_id_fk" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_reviews_submission_created_idx" ON "content_reviews" USING btree ("submission_id","created_at");--> statement-breakpoint
CREATE INDEX "content_submissions_sla_queue_idx" ON "content_submissions" USING btree ("status","first_submitted_at");--> statement-breakpoint
CREATE INDEX "content_submissions_branch_approved_idx" ON "content_submissions" USING btree ("branch_office_id","approved_at");--> statement-breakpoint
CREATE INDEX "content_submissions_region_approved_idx" ON "content_submissions" USING btree ("regional_office_id","approved_at");--> statement-breakpoint
CREATE INDEX "content_submissions_institution_approved_idx" ON "content_submissions" USING btree ("stakeholder_id","approved_at");--> statement-breakpoint
CREATE INDEX "locations_stakeholder_idx" ON "locations" USING btree ("stakeholder_id");--> statement-breakpoint
CREATE INDEX "user_profiles_location_status_idx" ON "user_profiles" USING btree ("location_status");--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_location_status_check" CHECK ("user_profiles"."location_status" in ('PENDING', 'GRACE', 'VERIFIED', 'EXEMPT'));
--> statement-breakpoint
-- Existing accounts keep working during a 30-day grace window (F4). New
-- accounts use the column default PENDING and must activate once.
UPDATE "user_profiles"
SET "location_status" = 'GRACE',
    "location_grace_deadline" = now() + interval '30 days'
WHERE "location_status" = 'PENDING';--> statement-breakpoint
UPDATE "content_submissions"
SET "first_submitted_at" = "submitted_at"
WHERE "first_submitted_at" IS NULL AND "submitted_at" IS NOT NULL;--> statement-breakpoint
UPDATE "content_submissions" AS cs
SET "branch_office_id" = s."branch_office_id"
FROM "stakeholders" AS s
WHERE cs."stakeholder_id" = s."id" AND cs."branch_office_id" IS NULL;--> statement-breakpoint
UPDATE "content_submissions" AS cs
SET "regional_office_id" = b."regional_office_id"
FROM "stakeholders" AS s
JOIN "branch_offices" AS b ON b."id" = s."branch_office_id"
WHERE cs."stakeholder_id" = s."id" AND cs."regional_office_id" IS NULL;--> statement-breakpoint
UPDATE "locations" AS l
SET "stakeholder_id" = x."stakeholder_id"
FROM (
  SELECT
    "location_id",
    (array_agg(DISTINCT "stakeholder_id"))[1] AS "stakeholder_id"
  FROM "content_submissions"
  WHERE "location_id" IS NOT NULL
  GROUP BY "location_id"
  HAVING count(DISTINCT "stakeholder_id") = 1
) AS x
WHERE l."id" = x."location_id" AND l."stakeholder_id" IS NULL;--> statement-breakpoint
INSERT INTO "kpi_target_history" (
  "target_id", "stakeholder_id", "branch_office_id", "regional_office_id",
  "theme_id", "sub_theme", "period_start", "period_end", "target_count",
  "change_type", "actor_id", "created_at"
)
SELECT
  "id", "stakeholder_id", "branch_office_id", "regional_office_id",
  "theme_id", "sub_theme", "period_start", "period_end", "target_count",
  'CREATED', "created_by", now()
FROM "kpi_targets";
