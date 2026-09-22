-- Batch 4: persist versioned preparation policy, explainable candidate
-- ranking, review-work identity, and per-slot candidate supersession.

ALTER TABLE "MealPlanCycle"
  ADD COLUMN "preparationPolicyVersion" VARCHAR(64) NOT NULL DEFAULT 'UPCOMING_PREPARATION_V1',
  ADD COLUMN "assuranceTier" "AssuranceTier" NOT NULL DEFAULT 'BASE',
  ADD COLUMN "preparationTriggeredAt" TIMESTAMP(3);

ALTER TABLE "MealPlan"
  ADD COLUMN "reviewWorkKey" VARCHAR(64),
  ADD COLUMN "candidateRank" INTEGER,
  ADD COLUMN "rankingScore" DOUBLE PRECISION,
  ADD COLUMN "rankingReasonCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "fallbackAvailable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "supersededByMealPlanId" TEXT;

ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_supersededByMealPlanId_fkey"
  FOREIGN KEY ("supersededByMealPlanId") REFERENCES "MealPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "MealPlan_reviewWorkKey_status_idx" ON "MealPlan"("reviewWorkKey", "status");
CREATE INDEX "MealPlan_cycle_slot_status_idx" ON "MealPlan"("planGroupId", "scheduledDate", "mealType", "status");
CREATE INDEX "MealPlan_supersededByMealPlanId_idx" ON "MealPlan"("supersededByMealPlanId");

ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_candidateRank_positive_check"
  CHECK ("candidateRank" IS NULL OR "candidateRank" > 0);
