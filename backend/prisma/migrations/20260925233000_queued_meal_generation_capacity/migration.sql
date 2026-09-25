ALTER TYPE "MealPlanGenerationJobStatus" ADD VALUE 'WAITING_FOR_AI';
ALTER TYPE "MealPlanGenerationJobStatus" ADD VALUE 'PROCESSING_AI';

ALTER TABLE "MealPlanGenerationJob"
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "processingToken" VARCHAR(64);

CREATE INDEX "MealPlanGenerationJob_status_nextAttemptAt_idx"
  ON "MealPlanGenerationJob"("status", "nextAttemptAt");

CREATE TABLE "AiQuotaReservation" (
  "id" TEXT NOT NULL,
  "provider" VARCHAR(32) NOT NULL,
  "model" VARCHAR(80) NOT NULL,
  "estimatedTokens" INTEGER NOT NULL,
  "operation" "AiUsageOperation" NOT NULL,
  "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "AiQuotaReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiQuotaReservation_provider_reservedAt_idx"
  ON "AiQuotaReservation"("provider", "reservedAt");
CREATE INDEX "AiQuotaReservation_provider_completedAt_reservedAt_idx"
  ON "AiQuotaReservation"("provider", "completedAt", "reservedAt");
