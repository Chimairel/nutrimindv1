-- Batch 3: catalog metadata, favorites, source-neutral applicability, and
-- composed-serving provenance. Legacy primary mealType columns remain as the
-- display/default slot while normalized applicability rows become queryable.

CREATE TYPE "MealApplicabilitySource" AS ENUM ('LEGACY_BACKFILL', 'DETERMINISTIC_CLASSIFIER', 'NUTRITIONIST_REVIEW');
CREATE TYPE "MealApplicabilityReviewStatus" AS ENUM ('PROPOSED', 'REVIEWED');
CREATE TYPE "RecipeRiceRole" AS ENUM ('PAIR_WITH_RICE', 'STANDALONE', 'INCLUDES_RICE');
CREATE TYPE "RiceRoleReviewStatus" AS ENUM ('NOT_REVIEWED', 'PROPOSED', 'REVIEWED');
CREATE TYPE "MealPlanServingComponentType" AS ENUM ('BASE_RECIPE', 'COOKED_RICE');

ALTER TABLE "MealLibrary"
  ADD COLUMN "riceRole" "RecipeRiceRole",
  ADD COLUMN "riceRoleReviewStatus" "RiceRoleReviewStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
  ADD COLUMN "includedRiceG" DOUBLE PRECISION;

ALTER TABLE "RawRecipeCandidate"
  ADD COLUMN "riceRole" "RecipeRiceRole",
  ADD COLUMN "riceRoleReviewStatus" "RiceRoleReviewStatus" NOT NULL DEFAULT 'NOT_REVIEWED',
  ADD COLUMN "includedRiceG" DOUBLE PRECISION;

ALTER TABLE "MealPlan"
  ADD COLUMN "baseRecipeSignature" VARCHAR(64),
  ADD COLUMN "composedServingSignature" VARCHAR(64);

ALTER TABLE "MealConditionClearance"
  ADD COLUMN "composedServingSignature" VARCHAR(64);

ALTER TABLE "MealPlanClearanceUsage"
  ADD COLUMN "composedServingSignature" VARCHAR(64);

CREATE TABLE "MealLibraryApplicableType" (
  "id" TEXT NOT NULL,
  "mealLibraryId" TEXT NOT NULL,
  "mealType" "MealType" NOT NULL,
  "source" "MealApplicabilitySource" NOT NULL DEFAULT 'DETERMINISTIC_CLASSIFIER',
  "reviewStatus" "MealApplicabilityReviewStatus" NOT NULL DEFAULT 'PROPOSED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MealLibraryApplicableType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RawRecipeApplicableType" (
  "id" TEXT NOT NULL,
  "rawRecipeCandidateId" TEXT NOT NULL,
  "mealType" "MealType" NOT NULL,
  "source" "MealApplicabilitySource" NOT NULL DEFAULT 'DETERMINISTIC_CLASSIFIER',
  "reviewStatus" "MealApplicabilityReviewStatus" NOT NULL DEFAULT 'PROPOSED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RawRecipeApplicableType_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealFavorite" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mealLibraryId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MealFavorite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealPlanServingComponent" (
  "id" TEXT NOT NULL,
  "mealPlanId" TEXT NOT NULL,
  "componentType" "MealPlanServingComponentType" NOT NULL,
  "position" INTEGER NOT NULL,
  "foodItemId" TEXT,
  "quantityG" DOUBLE PRECISION,
  "calories" DOUBLE PRECISION NOT NULL,
  "proteinG" DOUBLE PRECISION NOT NULL,
  "carbsG" DOUBLE PRECISION NOT NULL,
  "fatG" DOUBLE PRECISION NOT NULL,
  "evidenceSource" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MealPlanServingComponent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MealLibraryApplicableType_mealLibraryId_mealType_key" ON "MealLibraryApplicableType"("mealLibraryId", "mealType");
CREATE INDEX "MealLibraryApplicableType_mealType_reviewStatus_mealLibraryId_idx" ON "MealLibraryApplicableType"("mealType", "reviewStatus", "mealLibraryId");
CREATE UNIQUE INDEX "RawRecipeApplicableType_rawRecipeCandidateId_mealType_key" ON "RawRecipeApplicableType"("rawRecipeCandidateId", "mealType");
CREATE INDEX "RawRecipeApplicableType_mealType_reviewStatus_rawRecipeCandidateId_idx" ON "RawRecipeApplicableType"("mealType", "reviewStatus", "rawRecipeCandidateId");
CREATE UNIQUE INDEX "MealFavorite_userId_mealLibraryId_key" ON "MealFavorite"("userId", "mealLibraryId");
CREATE INDEX "MealFavorite_userId_createdAt_idx" ON "MealFavorite"("userId", "createdAt");
CREATE INDEX "MealFavorite_mealLibraryId_idx" ON "MealFavorite"("mealLibraryId");
CREATE UNIQUE INDEX "MealPlanServingComponent_mealPlanId_position_key" ON "MealPlanServingComponent"("mealPlanId", "position");
CREATE INDEX "MealPlanServingComponent_mealPlanId_componentType_idx" ON "MealPlanServingComponent"("mealPlanId", "componentType");
CREATE INDEX "MealPlanServingComponent_foodItemId_idx" ON "MealPlanServingComponent"("foodItemId");

ALTER TABLE "MealLibraryApplicableType" ADD CONSTRAINT "MealLibraryApplicableType_mealLibraryId_fkey"
  FOREIGN KEY ("mealLibraryId") REFERENCES "MealLibrary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RawRecipeApplicableType" ADD CONSTRAINT "RawRecipeApplicableType_rawRecipeCandidateId_fkey"
  FOREIGN KEY ("rawRecipeCandidateId") REFERENCES "RawRecipeCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealFavorite" ADD CONSTRAINT "MealFavorite_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealFavorite" ADD CONSTRAINT "MealFavorite_mealLibraryId_fkey"
  FOREIGN KEY ("mealLibraryId") REFERENCES "MealLibrary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealPlanServingComponent" ADD CONSTRAINT "MealPlanServingComponent_mealPlanId_fkey"
  FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealPlanServingComponent" ADD CONSTRAINT "MealPlanServingComponent_foodItemId_fkey"
  FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep every legacy primary slot as an explicit applicability fact. A legacy
-- or deterministic proposal may be corrected by an RND without rewriting the
-- recipe's display/default meal type.
INSERT INTO "MealLibraryApplicableType" ("id", "mealLibraryId", "mealType", "source", "reviewStatus", "updatedAt")
SELECT 'mlat_' || "id", "id", "mealType", 'LEGACY_BACKFILL', 'PROPOSED', CURRENT_TIMESTAMP
FROM "MealLibrary"
ON CONFLICT ("mealLibraryId", "mealType") DO NOTHING;

INSERT INTO "RawRecipeApplicableType" ("id", "rawRecipeCandidateId", "mealType", "source", "reviewStatus", "updatedAt")
SELECT 'rrat_' || "id", "id", "mealType", 'LEGACY_BACKFILL', 'PROPOSED', CURRENT_TIMESTAMP
FROM "RawRecipeCandidate"
ON CONFLICT ("rawRecipeCandidateId", "mealType") DO NOTHING;

-- Existing plan nutrition is preserved as its immutable base component. Rice
-- composition is only added by the governed composition service after this
-- migration; no legacy rice amount is guessed.
INSERT INTO "MealPlanServingComponent" (
  "id", "mealPlanId", "componentType", "position", "quantityG",
  "calories", "proteinG", "carbsG", "fatG", "evidenceSource"
)
SELECT 'mpsc_' || "id", "id", 'BASE_RECIPE', 0, NULL,
       "calories", "proteinG", "carbsG", "fatG", 'LEGACY_PLAN_SNAPSHOT'
FROM "MealPlan"
ON CONFLICT ("mealPlanId", "position") DO NOTHING;

UPDATE "MealPlan" AS plan
SET "baseRecipeSignature" = library."recipeSignature",
    "composedServingSignature" = library."recipeSignature"
FROM "MealLibrary" AS library
WHERE plan."libraryMealId" = library."id"
  AND library."recipeSignature" IS NOT NULL;

UPDATE "MealPlanClearanceUsage" AS usage
SET "composedServingSignature" = plan."composedServingSignature"
FROM "MealPlan" AS plan
WHERE usage."mealPlanId" = plan."id"
  AND plan."composedServingSignature" IS NOT NULL;

ALTER TABLE "MealLibrary" ADD CONSTRAINT "MealLibrary_includedRiceG_positive_check"
  CHECK ("includedRiceG" IS NULL OR "includedRiceG" > 0);
ALTER TABLE "RawRecipeCandidate" ADD CONSTRAINT "RawRecipeCandidate_includedRiceG_positive_check"
  CHECK ("includedRiceG" IS NULL OR "includedRiceG" > 0);
ALTER TABLE "MealPlanServingComponent" ADD CONSTRAINT "MealPlanServingComponent_quantityG_positive_check"
  CHECK ("quantityG" IS NULL OR "quantityG" > 0);
