-- CreateEnum
CREATE TYPE "MealLibrarySafetyDeclarationType" AS ENUM ('ALLERGEN_PRESENT', 'ALLERGEN_REVIEWED_ABSENT', 'CONDITION_REVIEWED');

-- AlterEnum
ALTER TYPE "MealLibraryStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN "shoppingDayOfWeek" INTEGER;
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_shoppingDayOfWeek_range" CHECK ("shoppingDayOfWeek" IS NULL OR "shoppingDayOfWeek" BETWEEN 0 AND 6);

-- CreateEnum
CREATE TYPE "MealLibrarySafetyReviewOutcome" AS ENUM ('DRAFT_CREATED', 'CERTIFIED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "MealPlanGenerationJobStatus" AS ENUM ('GENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "WeeklyAdaptationState" AS ENUM ('INSUFFICIENT_DATA', 'ON_TRACK', 'LOW_ADHERENCE', 'REVIEW_RECOMMENDED');

-- CreateEnum
CREATE TYPE "HealthProfileRevisionType" AS ENUM ('BODY_DIET_UPDATED', 'CONDITIONS_UPDATED', 'ALLERGIES_UPDATED');

-- CreateEnum
CREATE TYPE "AiUsageStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "MealLibraryIngredient" (
    "id" TEXT NOT NULL,
    "mealLibraryId" TEXT NOT NULL,
    "foodItemId" TEXT,
    "position" INTEGER NOT NULL,
    "ingredientName" VARCHAR(180) NOT NULL,
    "category" VARCHAR(80),
    "dataSource" "MealIngredientDataSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealLibraryIngredient_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MealLibraryIngredient_position_nonnegative" CHECK ("position" >= 0)
);

-- CreateTable
CREATE TABLE "MealLibrarySafetyDeclaration" (
    "id" TEXT NOT NULL,
    "mealLibraryId" TEXT NOT NULL,
    "mealLibraryIngredientId" TEXT,
    "declarationType" "MealLibrarySafetyDeclarationType" NOT NULL,
    "canonicalKey" VARCHAR(64),
    "customKey" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealLibrarySafetyDeclaration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MealLibrarySafetyDeclaration_exactly_one_key" CHECK (("canonicalKey" IS NULL) <> ("customKey" IS NULL))
);

-- CreateTable
CREATE TABLE "MealLibrarySafetyReview" (
    "id" TEXT NOT NULL,
    "mealLibraryId" TEXT NOT NULL,
    "nutritionistProfileId" TEXT,
    "outcome" "MealLibrarySafetyReviewOutcome" NOT NULL,
    "evidenceRevision" INTEGER NOT NULL,
    "policyVersion" VARCHAR(64),
    "reasonCode" VARCHAR(64),
    "evidenceSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealLibrarySafetyReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MealLibrarySafetyReview_revision_nonnegative" CHECK ("evidenceRevision" >= 0)
);

-- CreateTable
CREATE TABLE "MealPlanGenerationJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planType" "PlanType" NOT NULL,
    "cycleStartDate" TIMESTAMP(3) NOT NULL,
    "status" "MealPlanGenerationJobStatus" NOT NULL DEFAULT 'GENERATING',
    "planGroupId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastErrorCode" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealPlanGenerationJob_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MealPlanGenerationJob_attempts_positive" CHECK ("attempts" > 0)
);

-- CreateTable
CREATE TABLE "WeeklyCheckin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleStartDate" TIMESTAMP(3) NOT NULL,
    "changed" BOOLEAN NOT NULL,
    "submittedWeightKg" DOUBLE PRECISION,
    "submittedGoal" "Goal",
    "submittedActivityLevel" "ActivityLevel",
    "weightTrendKg" DOUBLE PRECISION,
    "averageAdherencePct" DOUBLE PRECISION,
    "observationDays" INTEGER NOT NULL DEFAULT 0,
    "adaptationState" "WeeklyAdaptationState" NOT NULL,
    "profileSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyCheckin_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WeeklyCheckin_observationDays_nonnegative" CHECK ("observationDays" >= 0),
    CONSTRAINT "WeeklyCheckin_submittedWeight_positive" CHECK ("submittedWeightKg" IS NULL OR "submittedWeightKg" > 0),
    CONSTRAINT "WeeklyCheckin_adherence_range" CHECK ("averageAdherencePct" IS NULL OR "averageAdherencePct" BETWEEN 0 AND 100)
);

-- CreateTable
CREATE TABLE "HealthProfileRevision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revisionType" "HealthProfileRevisionType" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthProfileRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(32) NOT NULL,
    "model" VARCHAR(80),
    "status" "AiUsageStatus" NOT NULL,
    "attempts" INTEGER NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "errorCode" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AiUsageEvent_attempts_positive" CHECK ("attempts" > 0),
    CONSTRAINT "AiUsageEvent_latency_nonnegative" CHECK ("latencyMs" >= 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "MealLibraryIngredient_mealLibraryId_position_key" ON "MealLibraryIngredient"("mealLibraryId", "position");
CREATE INDEX "MealLibraryIngredient_mealLibraryId_idx" ON "MealLibraryIngredient"("mealLibraryId");
CREATE INDEX "MealLibraryIngredient_foodItemId_idx" ON "MealLibraryIngredient"("foodItemId");
CREATE INDEX "MealLibrarySafetyDeclaration_mealLibraryId_idx" ON "MealLibrarySafetyDeclaration"("mealLibraryId");
CREATE INDEX "MealLibrarySafetyDeclaration_mealLibraryIngredientId_idx" ON "MealLibrarySafetyDeclaration"("mealLibraryIngredientId");
CREATE UNIQUE INDEX "MealLibrarySafetyDeclaration_current_canonical_key" ON "MealLibrarySafetyDeclaration"("mealLibraryId", "declarationType", "canonicalKey") WHERE "canonicalKey" IS NOT NULL;
CREATE UNIQUE INDEX "MealLibrarySafetyDeclaration_current_custom_key" ON "MealLibrarySafetyDeclaration"("mealLibraryId", "declarationType", "customKey") WHERE "customKey" IS NOT NULL;
CREATE INDEX "MealLibrarySafetyReview_mealLibraryId_createdAt_idx" ON "MealLibrarySafetyReview"("mealLibraryId", "createdAt");
CREATE INDEX "MealLibrarySafetyReview_nutritionistProfileId_idx" ON "MealLibrarySafetyReview"("nutritionistProfileId");
CREATE UNIQUE INDEX "MealPlanGenerationJob_userId_planType_cycleStartDate_key" ON "MealPlanGenerationJob"("userId", "planType", "cycleStartDate");
CREATE INDEX "MealPlanGenerationJob_status_updatedAt_idx" ON "MealPlanGenerationJob"("status", "updatedAt");
CREATE UNIQUE INDEX "WeeklyCheckin_userId_cycleStartDate_key" ON "WeeklyCheckin"("userId", "cycleStartDate");
CREATE INDEX "WeeklyCheckin_adaptationState_createdAt_idx" ON "WeeklyCheckin"("adaptationState", "createdAt");
CREATE INDEX "HealthProfileRevision_userId_createdAt_idx" ON "HealthProfileRevision"("userId", "createdAt");
CREATE INDEX "AiUsageEvent_createdAt_status_idx" ON "AiUsageEvent"("createdAt", "status");

-- AddForeignKey
ALTER TABLE "MealLibraryIngredient" ADD CONSTRAINT "MealLibraryIngredient_mealLibraryId_fkey" FOREIGN KEY ("mealLibraryId") REFERENCES "MealLibrary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealLibraryIngredient" ADD CONSTRAINT "MealLibraryIngredient_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MealLibrarySafetyDeclaration" ADD CONSTRAINT "MealLibrarySafetyDeclaration_mealLibraryId_fkey" FOREIGN KEY ("mealLibraryId") REFERENCES "MealLibrary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealLibrarySafetyDeclaration" ADD CONSTRAINT "MealLibrarySafetyDeclaration_mealLibraryIngredientId_fkey" FOREIGN KEY ("mealLibraryIngredientId") REFERENCES "MealLibraryIngredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MealLibrarySafetyReview" ADD CONSTRAINT "MealLibrarySafetyReview_mealLibraryId_fkey" FOREIGN KEY ("mealLibraryId") REFERENCES "MealLibrary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MealLibrarySafetyReview" ADD CONSTRAINT "MealLibrarySafetyReview_nutritionistProfileId_fkey" FOREIGN KEY ("nutritionistProfileId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MealPlanGenerationJob" ADD CONSTRAINT "MealPlanGenerationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyCheckin" ADD CONSTRAINT "WeeklyCheckin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthProfileRevision" ADD CONSTRAINT "HealthProfileRevision_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
