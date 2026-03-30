-- Drop the old non-unique index and replace with a unique constraint
DROP INDEX IF EXISTS "GithubDelivery_deliveryId_idx";
ALTER TABLE "GithubDelivery" ADD CONSTRAINT "GithubDelivery_deliveryId_key" UNIQUE ("deliveryId");
