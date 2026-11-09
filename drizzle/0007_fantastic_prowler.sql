-- DAKOSTA v3.6 status collapse: 9 values -> 4 canonical values.
-- LOSSY MAPPING: RESUBMITTED/IN_REVIEW -> SUBMITTED,
-- REJECTED/REVOKED -> REVISION_REQUIRED, ARCHIVED -> APPROVED + archived=true.
-- Exact pre-migration values are recoverable only from the production backup
-- taken immediately before this migration. Review history keeps the original
-- action (APPROVE/REQUEST_REVISION/REJECT/REVOKE) in content_reviews.
UPDATE "content_submissions" SET "status" = 'SUBMITTED'
  WHERE "status" IN ('RESUBMITTED', 'IN_REVIEW');--> statement-breakpoint
UPDATE "content_submissions" SET "status" = 'REVISION_REQUIRED'
  WHERE "status" IN ('REJECTED', 'REVOKED');--> statement-breakpoint
UPDATE "content_submissions" SET "status" = 'APPROVED', "archived" = true
  WHERE "status" = 'ARCHIVED';--> statement-breakpoint
ALTER TABLE "content_submissions" DROP CONSTRAINT "content_submissions_status_check";--> statement-breakpoint
ALTER TABLE "content_submissions" ADD CONSTRAINT "content_submissions_status_check" CHECK ("content_submissions"."status" in ('DRAFT', 'SUBMITTED', 'REVISION_REQUIRED', 'APPROVED'));--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "content_submissions"
    WHERE "status" NOT IN ('DRAFT', 'SUBMITTED', 'REVISION_REQUIRED', 'APPROVED')
  ) THEN
    RAISE EXCEPTION 'v3.6 status migration left legacy values';
  END IF;
END $$;
