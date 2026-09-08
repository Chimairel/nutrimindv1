ALTER TYPE "MealLogDataSource" ADD VALUE IF NOT EXISTS 'VERIFIED_LIBRARY';
ALTER TYPE "MealLogDataSource" ADD VALUE IF NOT EXISTS 'USER_REPORTED';
ALTER TYPE "MealLogDataSource" ADD VALUE IF NOT EXISTS 'NUTRITIONIST_REVIEWED';
ALTER TYPE "MealLogDataSource" ADD VALUE IF NOT EXISTS 'MIXED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OUTSIDE_MEAL_REVIEWED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'OUTSIDE_MEAL_MORE_INFO';

CREATE TYPE "OutsideMealItemSource" AS ENUM ('VERIFIED_LIBRARY', 'FNRI', 'USER_REPORTED', 'GEMINI_ESTIMATED', 'NUTRITIONIST_REVIEWED', 'UNRESOLVED');
CREATE TYPE "OutsideMealNutritionStatus" AS ENUM ('REFERENCE_RESOLVED', 'USER_REPORTED', 'PENDING_REVIEW', 'VERIFIED', 'CORRECTED', 'NEEDS_MORE_INFO', 'UNRESOLVED');
CREATE TYPE "OutsideMealCompatibilityStatus" AS ENUM ('NO_KNOWN_CONFLICT', 'CAUTION', 'REVIEW_REQUIRED', 'CONFLICT_DETECTED', 'INSUFFICIENT_EVIDENCE');
CREATE TYPE "OutsideMealCompleteness" AS ENUM ('COMPLETE', 'PARTIAL', 'UNRESOLVED');
CREATE TYPE "OutsideMealReviewStatus" AS ENUM ('PENDING', 'CLAIMED', 'VERIFIED', 'CORRECTED', 'NEEDS_MORE_INFO');

ALTER TABLE "MealLog"
  ADD COLUMN "mealType" "MealType",
  ADD COLUMN "nutritionCompleteness" "OutsideMealCompleteness" NOT NULL DEFAULT 'COMPLETE',
  ADD COLUMN "provisionalCalories" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "OutsideMealPreview"
  ALTER COLUMN "mealName" TYPE VARCHAR(1000),
  ADD COLUMN "items" JSONB,
  ADD COLUMN "requestKey" VARCHAR(128),
  ADD COLUMN "usedAi" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "OutsideMealPreview_requestKey_key" ON "OutsideMealPreview"("requestKey");

CREATE TABLE "OutsideMealLogItem" (
  "id" TEXT NOT NULL,
  "mealLogId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "portionGrams" DOUBLE PRECISION,
  "source" "OutsideMealItemSource" NOT NULL,
  "nutritionStatus" "OutsideMealNutritionStatus" NOT NULL,
  "compatibilityStatus" "OutsideMealCompatibilityStatus" NOT NULL,
  "includedInTotals" BOOLEAN NOT NULL DEFAULT false,
  "calories" DOUBLE PRECISION,
  "proteinG" DOUBLE PRECISION,
  "carbsG" DOUBLE PRECISION,
  "fatG" DOUBLE PRECISION,
  "calorieLow" DOUBLE PRECISION,
  "calorieHigh" DOUBLE PRECISION,
  "foodItemId" TEXT,
  "mealLibraryId" TEXT,
  "ingredients" JSONB,
  "currentRevision" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutsideMealLogItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OutsideMealLogItem_mealLogId_position_key" ON "OutsideMealLogItem"("mealLogId", "position");
CREATE INDEX "OutsideMealLogItem_status_compat_created_idx" ON "OutsideMealLogItem"("nutritionStatus", "compatibilityStatus", "createdAt");
CREATE INDEX "OutsideMealLogItem_foodItemId_idx" ON "OutsideMealLogItem"("foodItemId");
CREATE INDEX "OutsideMealLogItem_mealLibraryId_idx" ON "OutsideMealLogItem"("mealLibraryId");

CREATE TABLE "OutsideMealItemRevision" (
  "id" TEXT NOT NULL,
  "outsideMealLogItemId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL,
  "source" "OutsideMealItemSource" NOT NULL,
  "nutritionStatus" "OutsideMealNutritionStatus" NOT NULL,
  "calories" DOUBLE PRECISION,
  "proteinG" DOUBLE PRECISION,
  "carbsG" DOUBLE PRECISION,
  "fatG" DOUBLE PRECISION,
  "calorieLow" DOUBLE PRECISION,
  "calorieHigh" DOUBLE PRECISION,
  "reason" VARCHAR(500),
  "reviewedByNutritionistId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutsideMealItemRevision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OutsideMealItemRevision_outsideMealLogItemId_revision_key" ON "OutsideMealItemRevision"("outsideMealLogItemId", "revision");
CREATE INDEX "OutsideMealItemRevision_reviewedByNutritionistId_createdAt_idx" ON "OutsideMealItemRevision"("reviewedByNutritionistId", "createdAt");

CREATE TABLE "OutsideMealReview" (
  "id" TEXT NOT NULL,
  "outsideMealLogItemId" TEXT NOT NULL,
  "status" "OutsideMealReviewStatus" NOT NULL DEFAULT 'PENDING',
  "priority" INTEGER NOT NULL DEFAULT 10,
  "claimedByNutritionistId" TEXT,
  "claimedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OutsideMealReview_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OutsideMealReview_outsideMealLogItemId_key" ON "OutsideMealReview"("outsideMealLogItemId");
CREATE INDEX "OutsideMealReview_status_priority_createdAt_idx" ON "OutsideMealReview"("status", "priority", "createdAt");
CREATE INDEX "OutsideMealReview_claimedByNutritionistId_status_idx" ON "OutsideMealReview"("claimedByNutritionistId", "status");

CREATE TABLE "OutsideMealAiUsage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "itemCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutsideMealAiUsage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OutsideMealAiUsage_userId_createdAt_idx" ON "OutsideMealAiUsage"("userId", "createdAt");

ALTER TABLE "MealLog" ADD CONSTRAINT "MealLog_provisionalCalories_check" CHECK ("provisionalCalories" >= 0 AND "provisionalCalories" <= "calories");
ALTER TABLE "OutsideMealLogItem" ADD CONSTRAINT "OutsideMealLogItem_position_check" CHECK ("position" >= 0 AND "position" < 10);
ALTER TABLE "OutsideMealLogItem" ADD CONSTRAINT "OutsideMealLogItem_portion_check" CHECK ("portionGrams" IS NULL OR ("portionGrams" > 0 AND "portionGrams" <= 5000));
ALTER TABLE "OutsideMealLogItem" ADD CONSTRAINT "OutsideMealLogItem_effective_nutrition_check" CHECK (
  ("includedInTotals" = true AND "calories" IS NOT NULL AND "proteinG" IS NOT NULL AND "carbsG" IS NOT NULL AND "fatG" IS NOT NULL
    AND "calories" >= 0 AND "proteinG" >= 0 AND "carbsG" >= 0 AND "fatG" >= 0)
  OR
  ("includedInTotals" = false AND "calories" IS NULL AND "proteinG" IS NULL AND "carbsG" IS NULL AND "fatG" IS NULL)
);
ALTER TABLE "OutsideMealLogItem" ADD CONSTRAINT "OutsideMealLogItem_calorie_range_check" CHECK (
  ("calorieLow" IS NULL AND "calorieHigh" IS NULL)
  OR ("calorieLow" IS NOT NULL AND "calorieHigh" IS NOT NULL AND "calorieLow" >= 0 AND "calorieLow" <= "calories" AND "calories" <= "calorieHigh")
);
ALTER TABLE "OutsideMealItemRevision" ADD CONSTRAINT "OutsideMealItemRevision_revision_check" CHECK ("revision" >= 0);
ALTER TABLE "OutsideMealReview" ADD CONSTRAINT "OutsideMealReview_priority_check" CHECK ("priority" >= 0 AND "priority" <= 200);
ALTER TABLE "OutsideMealAiUsage" ADD CONSTRAINT "OutsideMealAiUsage_itemCount_check" CHECK ("itemCount" > 0 AND "itemCount" <= 10);

ALTER TABLE "OutsideMealLogItem" ADD CONSTRAINT "OutsideMealLogItem_mealLogId_fkey" FOREIGN KEY ("mealLogId") REFERENCES "MealLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutsideMealLogItem" ADD CONSTRAINT "OutsideMealLogItem_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutsideMealLogItem" ADD CONSTRAINT "OutsideMealLogItem_mealLibraryId_fkey" FOREIGN KEY ("mealLibraryId") REFERENCES "MealLibrary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutsideMealItemRevision" ADD CONSTRAINT "OutsideMealItemRevision_outsideMealLogItemId_fkey" FOREIGN KEY ("outsideMealLogItemId") REFERENCES "OutsideMealLogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutsideMealItemRevision" ADD CONSTRAINT "OutsideMealItemRevision_reviewedByNutritionistId_fkey" FOREIGN KEY ("reviewedByNutritionistId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutsideMealReview" ADD CONSTRAINT "OutsideMealReview_outsideMealLogItemId_fkey" FOREIGN KEY ("outsideMealLogItemId") REFERENCES "OutsideMealLogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutsideMealReview" ADD CONSTRAINT "OutsideMealReview_claimedByNutritionistId_fkey" FOREIGN KEY ("claimedByNutritionistId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OutsideMealAiUsage" ADD CONSTRAINT "OutsideMealAiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
