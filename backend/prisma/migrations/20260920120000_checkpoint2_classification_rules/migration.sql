-- Checkpoint 2: deterministic classification, extended nutrient evidence,
-- governed condition rules, dual-provenance declarations, and recipe deduplication.

CREATE TYPE "MealNutritionEvidenceSource" AS ENUM ('UNKNOWN', 'SOURCE_PUBLISHED', 'FNRI_RECONCILED', 'NUTRITIONIST_EDITED');
CREATE TYPE "MealIngredientClassificationStatus" AS ENUM ('UNCLASSIFIED', 'COMPLETE', 'NEEDS_REVIEW');
CREATE TYPE "SafetyDeclarationProvenance" AS ENUM ('DETERMINISTIC_CLASSIFIER', 'NUTRITIONIST_REVIEW', 'APPROVED_RULESET');
CREATE TYPE "ConditionRuleReviewStatus" AS ENUM ('DRAFT', 'APPROVED', 'RETIRED');
CREATE TYPE "ConditionRuleSeverity" AS ENUM ('FLAG', 'HARD_BLOCK');
CREATE TYPE "ConditionRuleOperator" AS ENUM ('GREATER_THAN', 'GREATER_THAN_OR_EQUAL', 'LESS_THAN', 'LESS_THAN_OR_EQUAL', 'EQUAL');
CREATE TYPE "ConditionRuleBasis" AS ENUM ('PER_SERVING', 'PER_1000_KCAL', 'DAILY_TOTAL', 'PERCENT_OF_DAILY_CALORIES', 'PER_KG_BODY_WEIGHT_DAILY');
CREATE TYPE "ConditionRuleNutrient" AS ENUM ('SODIUM_MG', 'SUGAR_G', 'FIBER_G', 'POTASSIUM_MG', 'PHOSPHORUS_MG', 'PROTEIN_G', 'SATURATED_FAT_G', 'CARBOHYDRATE_G');

ALTER TYPE "MealLibrarySafetyDeclarationType" ADD VALUE 'CONDITION_RULESET_CLEARED';
ALTER TYPE "MealLibrarySafetyReviewOutcome" ADD VALUE 'CERTIFICATION_PENDING_SECOND_REVIEW';

ALTER TABLE "MealLibrary"
  ADD COLUMN "sodiumMg" DOUBLE PRECISION,
  ADD COLUMN "sugarG" DOUBLE PRECISION,
  ADD COLUMN "fiberG" DOUBLE PRECISION,
  ADD COLUMN "potassiumMg" DOUBLE PRECISION,
  ADD COLUMN "phosphorusMg" DOUBLE PRECISION,
  ADD COLUMN "saturatedFatG" DOUBLE PRECISION,
  ADD COLUMN "nutritionEvidenceSource" "MealNutritionEvidenceSource" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "nutritionServingDescription" VARCHAR(180),
  ADD COLUMN "ingredientClassificationStatus" "MealIngredientClassificationStatus" NOT NULL DEFAULT 'UNCLASSIFIED',
  ADD COLUMN "ingredientClassificationVersion" VARCHAR(64),
  ADD COLUMN "ingredientClassifiedAt" TIMESTAMP(3),
  ADD COLUMN "ingredientClassificationFindings" JSONB,
  ADD COLUMN "recipeSignature" VARCHAR(64);

ALTER TABLE "MealLibrarySafetyDeclaration"
  ADD COLUMN "provenance" "SafetyDeclarationProvenance" NOT NULL DEFAULT 'NUTRITIONIST_REVIEW',
  ADD COLUMN "policyVersion" VARCHAR(64),
  ADD COLUMN "evidenceSnapshot" JSONB;

CREATE TABLE "ConditionNutrientRule" (
  "id" TEXT NOT NULL,
  "condition" "HealthConditionType" NOT NULL,
  "nutrient" "ConditionRuleNutrient" NOT NULL,
  "operator" "ConditionRuleOperator" NOT NULL,
  "threshold" DOUBLE PRECISION NOT NULL,
  "unit" VARCHAR(32) NOT NULL,
  "basis" "ConditionRuleBasis" NOT NULL,
  "severity" "ConditionRuleSeverity" NOT NULL,
  "rationale" TEXT NOT NULL,
  "sourceTitle" VARCHAR(240) NOT NULL,
  "sourceCitation" VARCHAR(1000) NOT NULL,
  "approvedByNutritionistId" TEXT,
  "reviewStatus" "ConditionRuleReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "policyVersion" VARCHAR(64) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConditionNutrientRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConditionNutrientRule_nonnegative_threshold" CHECK ("threshold" >= 0),
  CONSTRAINT "ConditionNutrientRule_real_condition" CHECK ("condition" <> 'NONE'),
  CONSTRAINT "ConditionNutrientRule_approval_integrity" CHECK (
    ("reviewStatus" = 'APPROVED' AND "active" = true AND "approvedByNutritionistId" IS NOT NULL)
    OR ("reviewStatus" <> 'APPROVED' AND "active" = false)
    OR ("reviewStatus" = 'APPROVED' AND "active" = false AND "approvedByNutritionistId" IS NOT NULL)
  )
);

CREATE TABLE "ConditionIngredientRule" (
  "id" TEXT NOT NULL,
  "condition" "HealthConditionType" NOT NULL,
  "ingredientCategory" VARCHAR(80) NOT NULL,
  "matchingTerms" JSONB NOT NULL,
  "severity" "ConditionRuleSeverity" NOT NULL,
  "rationale" TEXT NOT NULL,
  "sourceTitle" VARCHAR(240) NOT NULL,
  "sourceCitation" VARCHAR(1000) NOT NULL,
  "approvedByNutritionistId" TEXT,
  "reviewStatus" "ConditionRuleReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "policyVersion" VARCHAR(64) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConditionIngredientRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConditionIngredientRule_real_condition" CHECK ("condition" <> 'NONE'),
  CONSTRAINT "ConditionIngredientRule_approval_integrity" CHECK (
    ("reviewStatus" = 'APPROVED' AND "active" = true AND "approvedByNutritionistId" IS NOT NULL)
    OR ("reviewStatus" <> 'APPROVED' AND "active" = false)
    OR ("reviewStatus" = 'APPROVED' AND "active" = false AND "approvedByNutritionistId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "MealLibrary_recipeSignature_key" ON "MealLibrary"("recipeSignature");
CREATE UNIQUE INDEX "ConditionNutrientRule_unique_policy_rule" ON "ConditionNutrientRule"("condition", "nutrient", "operator", "threshold", "basis", "policyVersion");
CREATE INDEX "ConditionNutrientRule_condition_reviewStatus_active_idx" ON "ConditionNutrientRule"("condition", "reviewStatus", "active");
CREATE UNIQUE INDEX "ConditionIngredientRule_unique_policy_rule" ON "ConditionIngredientRule"("condition", "ingredientCategory", "policyVersion");
CREATE INDEX "ConditionIngredientRule_condition_reviewStatus_active_idx" ON "ConditionIngredientRule"("condition", "reviewStatus", "active");

ALTER TABLE "ConditionNutrientRule" ADD CONSTRAINT "ConditionNutrientRule_approvedByNutritionistId_fkey"
  FOREIGN KEY ("approvedByNutritionistId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConditionIngredientRule" ADD CONSTRAINT "ConditionIngredientRule_approvedByNutritionistId_fkey"
  FOREIGN KEY ("approvedByNutritionistId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
