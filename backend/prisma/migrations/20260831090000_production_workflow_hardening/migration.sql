-- Durable workflow state for production-readiness controls. Existing records
-- are preserved; legacy meal plans require an explicit current-policy review.
ALTER TABLE "MealPlan"
  ADD COLUMN "requiresSafetyRevalidation" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "safetyPolicyVersion" VARCHAR(64),
  ADD COLUMN "highRiskReviewRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reviewApprovalCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "firstApprovedByNutritionistId" TEXT,
  ADD COLUMN "firstApprovedAt" TIMESTAMP(3);

ALTER TABLE "MealIngredient"
  ADD COLUMN "quantity" DOUBLE PRECISION,
  ADD COLUMN "unit" VARCHAR(32);

ALTER TABLE "MealLibraryIngredient"
  ADD COLUMN "quantity" DOUBLE PRECISION,
  ADD COLUMN "unit" VARCHAR(32);

ALTER TABLE "GroceryItem"
  ADD COLUMN "quantity" DOUBLE PRECISION,
  ADD COLUMN "unit" VARCHAR(32),
  ADD COLUMN "sourceMealCount" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "isPantryStaple" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "MealPlanGenerationJob"
  ADD COLUMN "progressPct" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "stageCode" VARCHAR(64) NOT NULL DEFAULT 'QUEUED',
  ADD COLUMN "stageMessage" VARCHAR(180),
  ADD COLUMN "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "completedAt" TIMESTAMP(3);

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "action" VARCHAR(80) NOT NULL,
  "entityType" VARCHAR(80) NOT NULL,
  "entityId" VARCHAR(191),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutsideMealPreview" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mealName" VARCHAR(180) NOT NULL,
  "mealType" "MealType" NOT NULL,
  "estimate" JSONB NOT NULL,
  "warnings" JSONB NOT NULL,
  "reasons" JSONB NOT NULL,
  "notes" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutsideMealPreview_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MealPlan"
  ADD CONSTRAINT "MealPlan_firstApprovedByNutritionistId_fkey"
  FOREIGN KEY ("firstApprovedByNutritionistId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuditEvent"
  ADD CONSTRAINT "AuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OutsideMealPreview"
  ADD CONSTRAINT "OutsideMealPreview_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MealPlan"
  ADD CONSTRAINT "MealPlan_reviewApprovalCount_nonnegative" CHECK ("reviewApprovalCount" >= 0 AND "reviewApprovalCount" <= 2);
ALTER TABLE "MealIngredient"
  ADD CONSTRAINT "MealIngredient_quantity_positive" CHECK ("quantity" IS NULL OR "quantity" > 0);
ALTER TABLE "MealLibraryIngredient"
  ADD CONSTRAINT "MealLibraryIngredient_quantity_positive" CHECK ("quantity" IS NULL OR "quantity" > 0);
ALTER TABLE "GroceryItem"
  ADD CONSTRAINT "GroceryItem_quantity_positive" CHECK ("quantity" IS NULL OR "quantity" > 0);
ALTER TABLE "GroceryItem"
  ADD CONSTRAINT "GroceryItem_sourceMealCount_positive" CHECK ("sourceMealCount" > 0);
ALTER TABLE "MealPlanGenerationJob"
  ADD CONSTRAINT "MealPlanGenerationJob_progress_range" CHECK ("progressPct" >= 0 AND "progressPct" <= 100);

CREATE INDEX "MealPlan_revalidation_status_idx" ON "MealPlan"("requiresSafetyRevalidation", "status");
CREATE INDEX "MealPlan_highRisk_review_idx" ON "MealPlan"("highRiskReviewRequired", "reviewApprovalCount", "status");
CREATE INDEX "AuditEvent_entityType_entityId_createdAt_idx" ON "AuditEvent"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditEvent_actorUserId_createdAt_idx" ON "AuditEvent"("actorUserId", "createdAt");
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");
CREATE INDEX "OutsideMealPreview_userId_expiresAt_idx" ON "OutsideMealPreview"("userId", "expiresAt");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "MealLog" WHERE "mealPlanId" IS NOT NULL
    GROUP BY "mealPlanId" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add planned-meal uniqueness: duplicate MealLog.mealPlanId rows require owner-reviewed remediation';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "DailyNutritionLog"
    GROUP BY "userId", "logDate" HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add daily aggregate uniqueness: duplicate user/date rows require owner-reviewed remediation';
  END IF;
END $$;

CREATE UNIQUE INDEX "MealLog_mealPlanId_key" ON "MealLog"("mealPlanId");
CREATE UNIQUE INDEX "DailyNutritionLog_userId_logDate_key" ON "DailyNutritionLog"("userId", "logDate");
