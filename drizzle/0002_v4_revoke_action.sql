-- Master-only corrective action: an approved content item can be revoked.
-- The historical review trail is preserved; the new action is additive.
ALTER TABLE "content_reviews" DROP CONSTRAINT IF EXISTS "content_reviews_action_check";
--> statement-breakpoint
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_action_check" CHECK ("content_reviews"."action" in ('APPROVE', 'REQUEST_REVISION', 'REJECT', 'REVOKE'));
