ALTER TABLE "VerificationJob" ADD COLUMN "traceId" TEXT NOT NULL DEFAULT '';
UPDATE "VerificationJob" SET "traceId" = gen_random_uuid()::text WHERE "traceId" = '';
