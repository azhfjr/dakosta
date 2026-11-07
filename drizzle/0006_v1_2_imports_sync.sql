CREATE TABLE "content_import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"status" text NOT NULL,
	"reference_code" text,
	"submission_id" uuid,
	"organization_name" text,
	"errors" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_import_rows_row_unique" UNIQUE("run_id","row_number"),
	CONSTRAINT "content_import_rows_status_check" CHECK ("content_import_rows"."status" in ('VALID', 'INVALID', 'CREATED', 'APPROVED', 'FAILED')),
	CONSTRAINT "content_import_rows_row_number_check" CHECK ("content_import_rows"."row_number" >= 1)
);
--> statement-breakpoint
CREATE TABLE "content_import_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text NOT NULL,
	"filename" text NOT NULL,
	"digest" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'VALIDATED' NOT NULL,
	"row_count" integer DEFAULT 0 NOT NULL,
	"created_count" integer DEFAULT 0 NOT NULL,
	"approved_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"stats" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"committed_at" timestamp with time zone,
	CONSTRAINT "content_import_runs_idempotency_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "content_import_runs_status_check" CHECK ("content_import_runs"."status" in ('VALIDATED', 'COMMITTED', 'FAILED')),
	CONSTRAINT "content_import_runs_row_count_check" CHECK ("content_import_runs"."row_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text DEFAULT 'INTERNAL_CONSISTENCY' NOT NULL,
	"status" text DEFAULT 'QUEUED' NOT NULL,
	"dry_run" boolean DEFAULT true NOT NULL,
	"stage" text DEFAULT 'QUEUED' NOT NULL,
	"processed" integer DEFAULT 0 NOT NULL,
	"total" integer,
	"summary" jsonb,
	"error" text,
	"created_by" text NOT NULL,
	"started_at" timestamp with time zone,
	"heartbeat_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"cancel_requested" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_jobs_status_check" CHECK ("sync_jobs"."status" in ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL', 'CANCELLED')),
	CONSTRAINT "sync_jobs_processed_check" CHECK ("sync_jobs"."processed" >= 0)
);
--> statement-breakpoint
ALTER TABLE "account_import_rows" DROP CONSTRAINT "account_import_rows_status_check";--> statement-breakpoint
ALTER TABLE "account_imports" DROP CONSTRAINT "account_imports_mode_check";--> statement-breakpoint
ALTER TABLE "account_imports" ALTER COLUMN "mode" SET DEFAULT 'skip';--> statement-breakpoint
ALTER TABLE "content_import_rows" ADD CONSTRAINT "content_import_rows_run_id_content_import_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."content_import_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_import_rows" ADD CONSTRAINT "content_import_rows_submission_id_content_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."content_submissions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_import_runs" ADD CONSTRAINT "content_import_runs_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_import_rows_run_idx" ON "content_import_rows" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "content_import_runs_actor_idx" ON "content_import_runs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "sync_jobs_created_idx" ON "sync_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_jobs_active_kind_unique" ON "sync_jobs" USING btree ("kind") WHERE "sync_jobs"."status" in ('QUEUED', 'RUNNING');--> statement-breakpoint
ALTER TABLE "account_import_rows" ADD CONSTRAINT "account_import_rows_status_check" CHECK ("account_import_rows"."status" in ('VALID', 'INVALID', 'CONFLICT', 'CREATED', 'UPDATED', 'SKIPPED', 'FAILED'));--> statement-breakpoint
ALTER TABLE "account_imports" ADD CONSTRAINT "account_imports_mode_check" CHECK ("account_imports"."mode" in ('create_only', 'skip', 'update', 'upsert'));