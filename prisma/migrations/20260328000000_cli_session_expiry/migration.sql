-- Add expiresAt to CliSession for token expiry enforcement
ALTER TABLE "CliSession" ADD COLUMN "expiresAt" TIMESTAMP(3);
