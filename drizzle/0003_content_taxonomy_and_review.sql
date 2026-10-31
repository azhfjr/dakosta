-- Content comes from the v4 taxonomy (main_theme + sub_theme); the legacy
-- themes table stays for historical rows but is no longer required.
ALTER TABLE "content_reviews" DROP CONSTRAINT IF EXISTS "content_reviews_submission_version_unique";--> statement-breakpoint
ALTER TABLE "content_reviews" DROP CONSTRAINT IF EXISTS "content_reviews_action_check";--> statement-breakpoint
ALTER TABLE "content_submissions" ALTER COLUMN "theme_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "kpi_targets" ADD COLUMN "sub_theme" text;--> statement-breakpoint
ALTER TABLE "kpi_targets" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_submissions_stakeholder_subtheme_approved_idx" ON "content_submissions" USING btree ("stakeholder_id","sub_theme","approved_at");--> statement-breakpoint
CREATE INDEX "content_submissions_approved_partial_idx" ON "content_submissions" USING btree ("approved_at") WHERE "content_submissions"."status" = 'APPROVED';--> statement-breakpoint
CREATE INDEX "kpi_targets_stakeholder_subtheme_idx" ON "kpi_targets" USING btree ("stakeholder_id","sub_theme");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_targets_scope_unique" ON "kpi_targets" USING btree ("period_start","period_end",coalesce("regional_office_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("branch_office_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("stakeholder_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("theme_id", '00000000-0000-0000-0000-000000000000'::uuid),coalesce("sub_theme", ''));--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "notifications" USING btree ("recipient_id","created_at");--> statement-breakpoint
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_submission_version_action_unique" UNIQUE("submission_id","version","action");--> statement-breakpoint
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_action_check" CHECK ("content_reviews"."action" in ('APPROVE', 'REQUEST_REVISION', 'REJECT', 'REVOKE'));--> statement-breakpoint
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_sub_theme_check" CHECK ("kpi_targets"."sub_theme" is null or "kpi_targets"."sub_theme" in ('MOBILE_JKN', 'TESTIMONI_PESERTA', 'ALUR_BEROBAT', 'EDUKATIF_PERSUASIF', 'KORPORAT', 'INFORMASI'));--> statement-breakpoint
-- Backfill taxonomy for historical rows so legacy submissions stay visible in
-- lists, dashboards, the map, and exports. Rows without a legacy theme keep a
-- null sub_theme and render as "Tanpa tema".
UPDATE "content_submissions" AS s
SET "sub_theme" = CASE t."slug"
  WHEN 'edukasi-jkn' THEN 'INFORMASI'
  WHEN 'layanan-primer' THEN 'INFORMASI'
  WHEN 'kesehatan-ibu-anak' THEN 'INFORMASI'
  WHEN 'pencegahan-penyakit' THEN 'INFORMASI'
  WHEN 'transformasi-digital' THEN 'MOBILE_JKN'
  WHEN 'mobile-jkn' THEN 'MOBILE_JKN'
  WHEN 'testimoni' THEN 'TESTIMONI_PESERTA'
  WHEN 'alur-berobat' THEN 'ALUR_BEROBAT'
  WHEN 'edukatif-persuasif' THEN 'EDUKATIF_PERSUASIF'
  WHEN 'korporat' THEN 'KORPORAT'
  WHEN 'informatif' THEN 'INFORMASI'
  WHEN 'informasi' THEN 'INFORMASI'
END
FROM "themes" AS t
WHERE s."theme_id" = t."id"
  AND s."sub_theme" IS NULL
  AND t."slug" IN (
    'edukasi-jkn', 'layanan-primer', 'kesehatan-ibu-anak',
    'pencegahan-penyakit', 'transformasi-digital', 'mobile-jkn',
    'testimoni', 'alur-berobat', 'edukatif-persuasif', 'korporat',
    'informatif', 'informasi'
  );--> statement-breakpoint
-- Legacy targets keep theme_id; the resolver reads their sub-theme through the
-- theme slug mapping, so no destructive rewrite is needed here.
