-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "aiConfidence" DOUBLE PRECISION,
ADD COLUMN     "aiCriterionScores" JSONB,
ADD COLUMN     "aiEvidenceQuotes" JSONB,
ADD COLUMN     "aiGradedAt" TIMESTAMP(3),
ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiNeedsReview" BOOLEAN,
ADD COLUMN     "aiReasoningSummary" TEXT;
