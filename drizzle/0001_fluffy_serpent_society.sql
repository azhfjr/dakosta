CREATE TABLE "account_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"purpose" text DEFAULT 'ACTIVATION' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_invitations_token_unique" UNIQUE("token_hash"),
	CONSTRAINT "account_invitations_purpose_check" CHECK ("account_invitations"."purpose" in ('ACTIVATION', 'RESET'))
);
--> statement-breakpoint
CREATE TABLE "branch_offices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"regional_office_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "branch_offices_code_unique" UNIQUE("code"),
	CONSTRAINT "branch_offices_status_check" CHECK ("branch_offices"."status" in ('ACTIVE', 'INACTIVE'))
);
--> statement-breakpoint
CREATE TABLE "migration_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"target_env" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"counts" jsonb,
	"checksum" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "organization_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"from_branch_office_id" uuid,
	"to_branch_office_id" uuid NOT NULL,
	"actor_id" text,
	"reason" text,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "regional_offices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "regional_offices_code_unique" UNIQUE("code"),
	CONSTRAINT "regional_offices_status_check" CHECK ("regional_offices"."status" in ('ACTIVE', 'INACTIVE'))
);
--> statement-breakpoint
CREATE TABLE "user_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"regional_office_id" uuid,
	"branch_office_id" uuid,
	"organization_id" uuid,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_memberships_role_check" CHECK ("user_memberships"."role" in ('MASTER_ADMIN', 'REGIONAL_ADMIN', 'BRANCH_ADMIN', 'STAKEHOLDER')),
	CONSTRAINT "user_memberships_scope_check" CHECK ((
        ("user_memberships"."role" = 'MASTER_ADMIN'
          and "user_memberships"."regional_office_id" is null
          and "user_memberships"."branch_office_id" is null
          and "user_memberships"."organization_id" is null)
        or ("user_memberships"."role" = 'REGIONAL_ADMIN'
          and "user_memberships"."regional_office_id" is not null
          and "user_memberships"."branch_office_id" is null
          and "user_memberships"."organization_id" is null)
        or ("user_memberships"."role" = 'BRANCH_ADMIN'
          and "user_memberships"."branch_office_id" is not null
          and "user_memberships"."organization_id" is null)
        or ("user_memberships"."role" = 'STAKEHOLDER'
          and "user_memberships"."organization_id" is not null)
      ))
);
--> statement-breakpoint
CREATE TABLE "edufast_monthly_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_yyyy_mm" text NOT NULL,
	"timezone" text DEFAULT 'Asia/Jakarta' NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"explanation" text,
	"created_by" text NOT NULL,
	"published_by" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edufast_policies_period_check" CHECK ("edufast_monthly_policies"."period_yyyy_mm" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "edufast_policies_status_check" CHECK ("edufast_monthly_policies"."status" in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
	CONSTRAINT "edufast_policies_version_check" CHECK ("edufast_monthly_policies"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "edufast_policy_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_id" text,
	"snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edufast_policy_events_action_check" CHECK ("edufast_policy_events"."action" in ('CREATED', 'UPDATED', 'PUBLISHED', 'ARCHIVED', 'COPIED'))
);
--> statement-breakpoint
CREATE TABLE "edufast_policy_subthemes" (
	"policy_id" uuid NOT NULL,
	"sub_theme" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "edufast_policy_subthemes_policy_id_sub_theme_pk" PRIMARY KEY("policy_id","sub_theme"),
	CONSTRAINT "edufast_policy_subthemes_check" CHECK ("edufast_policy_subthemes"."sub_theme" in ('MOBILE_JKN', 'TESTIMONI_PESERTA', 'ALUR_BEROBAT', 'EDUKATIF_PERSUASIF', 'KORPORAT', 'INFORMASI'))
);
--> statement-breakpoint
CREATE TABLE "account_import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"status" text NOT NULL,
	"normalized" jsonb,
	"errors" jsonb,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_import_rows_row_unique" UNIQUE("import_id","row_number"),
	CONSTRAINT "account_import_rows_status_check" CHECK ("account_import_rows"."status" in ('VALID', 'INVALID', 'CREATED', 'UPDATED', 'SKIPPED', 'FAILED')),
	CONSTRAINT "account_import_rows_row_number_check" CHECK ("account_import_rows"."row_number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "account_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text NOT NULL,
	"filename" text NOT NULL,
	"digest" text NOT NULL,
	"mode" text DEFAULT 'create_only' NOT NULL,
	"status" text DEFAULT 'VALIDATED' NOT NULL,
	"idempotency_key" text NOT NULL,
	"preview_stats" jsonb,
	"row_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone,
	CONSTRAINT "account_imports_idempotency_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "account_imports_mode_check" CHECK ("account_imports"."mode" in ('create_only', 'upsert')),
	CONSTRAINT "account_imports_status_check" CHECK ("account_imports"."status" in ('VALIDATED', 'COMMITTED', 'FAILED')),
	CONSTRAINT "account_imports_row_count_check" CHECK ("account_imports"."row_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "content_submissions" DROP CONSTRAINT "content_submissions_status_check";--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "region_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "correlation_id" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "source" text DEFAULT 'APP' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_reviews" ADD COLUMN "reviewer_role" text;--> statement-breakpoint
ALTER TABLE "content_reviews" ADD COLUMN "reviewer_branch_id" uuid;--> statement-breakpoint
ALTER TABLE "content_reviews" ADD COLUMN "decision_source" text DEFAULT 'NORMAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD COLUMN "content_type" text;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD COLUMN "main_theme" text;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD COLUMN "sub_theme" text;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD COLUMN "edufast_policy_id" uuid;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD COLUMN "edufast_policy_version" integer;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD COLUMN "approved_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD COLUMN "approved_version" integer;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD COLUMN "resubmission_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD COLUMN "source_submission_id" uuid;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "kpi_targets" ADD COLUMN "regional_office_id" uuid;--> statement-breakpoint
ALTER TABLE "kpi_targets" ADD COLUMN "branch_office_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "branch_office_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "stakeholders" ADD COLUMN "branch_office_id" uuid;--> statement-breakpoint
ALTER TABLE "stakeholders" ADD COLUMN "organization_type" text DEFAULT 'OTHER' NOT NULL;--> statement-breakpoint
ALTER TABLE "stakeholders" ADD COLUMN "faskes_class" text;--> statement-breakpoint
ALTER TABLE "stakeholders" ADD COLUMN "faskes_code" text;--> statement-breakpoint
ALTER TABLE "stakeholders" ADD COLUMN "faskes_code_normalized" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "status" text DEFAULT 'ACTIVE' NOT NULL;--> statement-breakpoint
ALTER TABLE "account_invitations" ADD CONSTRAINT "account_invitations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_invitations" ADD CONSTRAINT "account_invitations_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branch_offices" ADD CONSTRAINT "branch_offices_regional_office_id_regional_offices_id_fk" FOREIGN KEY ("regional_office_id") REFERENCES "public"."regional_offices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_transfers" ADD CONSTRAINT "organization_transfers_organization_id_stakeholders_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."stakeholders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_transfers" ADD CONSTRAINT "organization_transfers_from_branch_office_id_branch_offices_id_fk" FOREIGN KEY ("from_branch_office_id") REFERENCES "public"."branch_offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_transfers" ADD CONSTRAINT "organization_transfers_to_branch_office_id_branch_offices_id_fk" FOREIGN KEY ("to_branch_office_id") REFERENCES "public"."branch_offices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_transfers" ADD CONSTRAINT "organization_transfers_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_regional_office_id_regional_offices_id_fk" FOREIGN KEY ("regional_office_id") REFERENCES "public"."regional_offices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_branch_office_id_branch_offices_id_fk" FOREIGN KEY ("branch_office_id") REFERENCES "public"."branch_offices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_organization_id_stakeholders_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."stakeholders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edufast_monthly_policies" ADD CONSTRAINT "edufast_monthly_policies_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edufast_monthly_policies" ADD CONSTRAINT "edufast_monthly_policies_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edufast_policy_events" ADD CONSTRAINT "edufast_policy_events_policy_id_edufast_monthly_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."edufast_monthly_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edufast_policy_events" ADD CONSTRAINT "edufast_policy_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edufast_policy_subthemes" ADD CONSTRAINT "edufast_policy_subthemes_policy_id_edufast_monthly_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."edufast_monthly_policies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_import_rows" ADD CONSTRAINT "account_import_rows_import_id_account_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."account_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_import_rows" ADD CONSTRAINT "account_import_rows_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_imports" ADD CONSTRAINT "account_imports_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_invitations_user_idx" ON "account_invitations" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "branch_offices_region_idx" ON "branch_offices" USING btree ("regional_office_id");--> statement-breakpoint
CREATE INDEX "branch_offices_status_idx" ON "branch_offices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "migration_runs_name_idx" ON "migration_runs" USING btree ("name");--> statement-breakpoint
CREATE INDEX "migration_runs_target_idx" ON "migration_runs" USING btree ("target_env");--> statement-breakpoint
CREATE INDEX "organization_transfers_org_idx" ON "organization_transfers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_transfers_effective_idx" ON "organization_transfers" USING btree ("effective_at");--> statement-breakpoint
CREATE INDEX "regional_offices_status_idx" ON "regional_offices" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "user_memberships_active_user_unique" ON "user_memberships" USING btree ("user_id") WHERE "user_memberships"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "user_memberships_role_idx" ON "user_memberships" USING btree ("role");--> statement-breakpoint
CREATE INDEX "user_memberships_region_idx" ON "user_memberships" USING btree ("regional_office_id");--> statement-breakpoint
CREATE INDEX "user_memberships_branch_idx" ON "user_memberships" USING btree ("branch_office_id");--> statement-breakpoint
CREATE INDEX "user_memberships_organization_idx" ON "user_memberships" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "edufast_policies_period_idx" ON "edufast_monthly_policies" USING btree ("period_yyyy_mm");--> statement-breakpoint
CREATE UNIQUE INDEX "edufast_policies_published_period_unique" ON "edufast_monthly_policies" USING btree ("period_yyyy_mm") WHERE "edufast_monthly_policies"."status" = 'PUBLISHED';--> statement-breakpoint
CREATE INDEX "edufast_policy_events_policy_idx" ON "edufast_policy_events" USING btree ("policy_id");--> statement-breakpoint
CREATE INDEX "account_import_rows_import_idx" ON "account_import_rows" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "account_imports_actor_idx" ON "account_imports" USING btree ("actor_id");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_region_id_regional_offices_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regional_offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_branch_id_branch_offices_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branch_offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organization_id_stakeholders_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."stakeholders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_reviewer_branch_id_branch_offices_id_fk" FOREIGN KEY ("reviewer_branch_id") REFERENCES "public"."branch_offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_edufast_policy_id_edufast_monthly_policies_id_fk" FOREIGN KEY ("edufast_policy_id") REFERENCES "public"."edufast_monthly_policies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_regional_office_id_regional_offices_id_fk" FOREIGN KEY ("regional_office_id") REFERENCES "public"."regional_offices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_branch_office_id_branch_offices_id_fk" FOREIGN KEY ("branch_office_id") REFERENCES "public"."branch_offices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_branch_office_id_branch_offices_id_fk" FOREIGN KEY ("branch_office_id") REFERENCES "public"."branch_offices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_stakeholders_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."stakeholders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stakeholders" ADD CONSTRAINT "stakeholders_branch_office_id_branch_offices_id_fk" FOREIGN KEY ("branch_office_id") REFERENCES "public"."branch_offices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_region_idx" ON "audit_logs" USING btree ("region_id");--> statement-breakpoint
CREATE INDEX "audit_logs_branch_idx" ON "audit_logs" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "audit_logs_organization_idx" ON "audit_logs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "content_reviews_branch_idx" ON "content_reviews" USING btree ("reviewer_branch_id");--> statement-breakpoint
CREATE INDEX "content_submissions_org_status_date_idx" ON "content_submissions" USING btree ("stakeholder_id","status","date_created");--> statement-breakpoint
CREATE INDEX "content_submissions_status_submitted_idx" ON "content_submissions" USING btree ("status","submitted_at");--> statement-breakpoint
CREATE INDEX "content_submissions_content_type_idx" ON "content_submissions" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX "content_submissions_main_theme_idx" ON "content_submissions" USING btree ("main_theme");--> statement-breakpoint
CREATE INDEX "content_submissions_sub_theme_idx" ON "content_submissions" USING btree ("sub_theme");--> statement-breakpoint
CREATE INDEX "notifications_branch_idx" ON "notifications" USING btree ("branch_office_id");--> statement-breakpoint
CREATE INDEX "notifications_organization_idx" ON "notifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "stakeholders_branch_idx" ON "stakeholders" USING btree ("branch_office_id");--> statement-breakpoint
CREATE INDEX "stakeholders_type_idx" ON "stakeholders" USING btree ("organization_type");--> statement-breakpoint
CREATE UNIQUE INDEX "stakeholders_faskes_code_unique" ON "stakeholders" USING btree ("faskes_code_normalized") WHERE "stakeholders"."organization_type" = 'FASKES' and "stakeholders"."faskes_code_normalized" is not null;--> statement-breakpoint
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_decision_source_check" CHECK ("content_reviews"."decision_source" in ('NORMAL', 'MASTER_OVERRIDE'));--> statement-breakpoint
ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_content_type_check" CHECK ("content_submissions"."content_type" is null or "content_submissions"."content_type" in ('VIDEO', 'INFOGRAFIS'));--> statement-breakpoint
ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_main_theme_check" CHECK ("content_submissions"."main_theme" is null or "content_submissions"."main_theme" in ('EDUFAST', 'NON_EDUFAST'));--> statement-breakpoint
ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_sub_theme_check" CHECK ("content_submissions"."sub_theme" is null or "content_submissions"."sub_theme" in ('MOBILE_JKN', 'TESTIMONI_PESERTA', 'ALUR_BEROBAT', 'EDUKATIF_PERSUASIF', 'KORPORAT', 'INFORMASI'));--> statement-breakpoint
ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_status_check" CHECK ("content_submissions"."status" in ('DRAFT', 'SUBMITTED', 'RESUBMITTED', 'IN_REVIEW', 'APPROVED', 'REVISION_REQUIRED', 'REJECTED', 'REVOKED', 'ARCHIVED'));--> statement-breakpoint
ALTER TABLE "stakeholders" ADD CONSTRAINT "stakeholders_organization_type_check" CHECK ("stakeholders"."organization_type" in ('FASKES', 'PEMDA', 'OTHER'));--> statement-breakpoint
ALTER TABLE "stakeholders" ADD CONSTRAINT "stakeholders_faskes_class_check" CHECK ("stakeholders"."faskes_class" is null or "stakeholders"."faskes_class" in ('FKTP', 'FKRTL'));--> statement-breakpoint
ALTER TABLE "stakeholders" ADD CONSTRAINT "stakeholders_faskes_fields_check" CHECK ((
        ("stakeholders"."organization_type" = 'FASKES'
          and "stakeholders"."faskes_class" in ('FKTP', 'FKRTL')
          and "stakeholders"."faskes_code_normalized" is not null
          and length(trim("stakeholders"."faskes_code_normalized")) > 0)
        or
        ("stakeholders"."organization_type" in ('PEMDA', 'OTHER')
          and "stakeholders"."faskes_class" is null
          and "stakeholders"."faskes_code_normalized" is null)
      ));--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_status_check" CHECK ("user_profiles"."status" in ('ACTIVE', 'INVITED', 'SUSPENDED', 'DISABLED'));