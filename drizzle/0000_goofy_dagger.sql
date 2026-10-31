CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"record_type" text NOT NULL,
	"record_id" text,
	"before" jsonb,
	"after" jsonb,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"reviewer_id" text NOT NULL,
	"action" text NOT NULL,
	"checklist" jsonb NOT NULL,
	"notes" text,
	"previous_status" text NOT NULL,
	"next_status" text NOT NULL,
	"conflict_of_interest" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_reviews_submission_version_unique" UNIQUE("submission_id","version"),
	CONSTRAINT "content_reviews_action_check" CHECK ("content_reviews"."action" in ('APPROVE', 'REQUEST_REVISION', 'REJECT'))
);
--> statement-breakpoint
CREATE TABLE "content_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"actor_id" text NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_revisions_submission_version_unique" UNIQUE("submission_id","version")
);
--> statement-breakpoint
CREATE TABLE "content_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_code" text NOT NULL,
	"stakeholder_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"submitted_by" text NOT NULL,
	"on_behalf_of" text,
	"title" text,
	"narrative" text NOT NULL,
	"published_url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"normalized_url_hash" text NOT NULL,
	"platform" text NOT NULL,
	"theme_id" uuid NOT NULL,
	"date_created" date NOT NULL,
	"published_at" date,
	"location_id" uuid NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"idempotency_key" text NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"reviewed_by" text,
	"decision_reason" text,
	"archived" boolean DEFAULT false NOT NULL,
	"is_demo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_submissions_reference_unique" UNIQUE("reference_code"),
	CONSTRAINT "content_submissions_idempotency_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "content_submissions_status_check" CHECK ("content_submissions"."status" in ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REVISION_REQUIRED', 'REJECTED', 'REVOKED', 'ARCHIVED')),
	CONSTRAINT "content_submissions_platform_check" CHECK ("content_submissions"."platform" in ('INSTAGRAM', 'FACEBOOK', 'X', 'TIKTOK', 'YOUTUBE', 'WEBSITE', 'LAINNYA')),
	CONSTRAINT "content_submissions_version_check" CHECK ("content_submissions"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "demo_rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "demo_rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "kpi_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_label" text DEFAULT 'Bandung Demo' NOT NULL,
	"stakeholder_id" uuid,
	"theme_id" uuid,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"target_count" integer NOT NULL,
	"reporting_unit" text DEFAULT 'konten' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kpi_targets_count_check" CHECK ("kpi_targets"."target_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"label" text NOT NULL,
	"source" text NOT NULL,
	"accuracy_meters" double precision,
	"consent_at" timestamp with time zone,
	"verified_status" text NOT NULL,
	"precision" text DEFAULT 'approximate' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "locations_source_check" CHECK ("locations"."source" in ('device_gps', 'manual_pin', 'registered_stakeholder')),
	CONSTRAINT "locations_verified_status_check" CHECK ("locations"."verified_status" in ('VERIFIED', 'MANUAL_UNVERIFIED')),
	CONSTRAINT "locations_precision_check" CHECK ("locations"."precision" in ('exact', 'approximate')),
	CONSTRAINT "locations_latitude_check" CHECK ("locations"."latitude" between -90 and 90),
	CONSTRAINT "locations_longitude_check" CHECK ("locations"."longitude" between -180 and 180)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" text NOT NULL,
	"event_type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"object_type" text,
	"object_id" text,
	"href" text,
	"read_at" timestamp with time zone,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_dedupe_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_key" text NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"recipient_id" text,
	"notification_id" uuid,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "outbox_events_event_key_unique" UNIQUE("event_key")
);
--> statement-breakpoint
CREATE TABLE "stakeholders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"faskes_type" text,
	"service_area" text NOT NULL,
	"address_label" text,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"location_precision" text DEFAULT 'approximate' NOT NULL,
	"website_url" text,
	"social_handle" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"is_demo" boolean DEFAULT true NOT NULL,
	"joined_at" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stakeholders_category_check" CHECK ("stakeholders"."category" in ('FASKES', 'INSTANSI', 'TOKOH', 'MEDIA', 'INFLUENCER', 'ORGANISASI')),
	CONSTRAINT "stakeholders_status_check" CHECK ("stakeholders"."status" in ('ACTIVE', 'INACTIVE')),
	CONSTRAINT "stakeholders_precision_check" CHECK ("stakeholders"."location_precision" in ('exact', 'approximate')),
	CONSTRAINT "stakeholders_latitude_check" CHECK ("stakeholders"."latitude" between -90 and 90),
	CONSTRAINT "stakeholders_longitude_check" CHECK ("stakeholders"."longitude" between -180 and 180)
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "themes_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"display_title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_role_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_role_memberships_user_role_unique" UNIQUE("user_id","role"),
	CONSTRAINT "user_role_memberships_role_check" CHECK ("user_role_memberships"."role" in ('ADMIN', 'CLIENT'))
);
--> statement-breakpoint
CREATE TABLE "user_stakeholder_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"stakeholder_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_stakeholder_memberships_unique" UNIQUE("user_id","stakeholder_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_submission_id_content_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."content_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_submission_id_content_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."content_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_revisions" ADD CONSTRAINT "content_revisions_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_stakeholder_id_stakeholders_id_fk" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_on_behalf_of_user_id_fk" FOREIGN KEY ("on_behalf_of") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_stakeholder_id_stakeholders_id_fk" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox_events" ADD CONSTRAINT "outbox_events_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."notifications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_memberships" ADD CONSTRAINT "user_role_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stakeholder_memberships" ADD CONSTRAINT "user_stakeholder_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_stakeholder_memberships" ADD CONSTRAINT "user_stakeholder_memberships_stakeholder_id_stakeholders_id_fk" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."stakeholders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_unique" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_unique" ON "session" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_record_idx" ON "audit_logs" USING btree ("record_type","record_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "content_reviews_reviewer_idx" ON "content_reviews" USING btree ("reviewer_id");--> statement-breakpoint
CREATE INDEX "content_submissions_status_idx" ON "content_submissions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "content_submissions_stakeholder_idx" ON "content_submissions" USING btree ("stakeholder_id");--> statement-breakpoint
CREATE INDEX "content_submissions_creator_idx" ON "content_submissions" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "content_submissions_theme_idx" ON "content_submissions" USING btree ("theme_id");--> statement-breakpoint
CREATE INDEX "content_submissions_date_created_idx" ON "content_submissions" USING btree ("date_created");--> statement-breakpoint
CREATE INDEX "content_submissions_approved_at_idx" ON "content_submissions" USING btree ("approved_at");--> statement-breakpoint
CREATE INDEX "content_submissions_normalized_hash_idx" ON "content_submissions" USING btree ("normalized_url_hash");--> statement-breakpoint
CREATE INDEX "kpi_targets_period_idx" ON "kpi_targets" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "notifications_recipient_idx" ON "notifications" USING btree ("recipient_id","id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_read_idx" ON "notifications" USING btree ("recipient_id","read_at");--> statement-breakpoint
CREATE INDEX "outbox_events_pending_idx" ON "outbox_events" USING btree ("processed_at","next_retry_at");--> statement-breakpoint
CREATE INDEX "stakeholders_category_idx" ON "stakeholders" USING btree ("category");--> statement-breakpoint
CREATE INDEX "stakeholders_status_idx" ON "stakeholders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_stakeholder_memberships_user_idx" ON "user_stakeholder_memberships" USING btree ("user_id");