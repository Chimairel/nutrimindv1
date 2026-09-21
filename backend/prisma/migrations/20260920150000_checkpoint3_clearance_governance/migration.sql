CREATE TYPE "AssuranceTier" AS ENUM ('BASE', 'STANDARD', 'ENHANCED');
CREATE TYPE "ConditionClearanceProvenance" AS ENUM ('MANUAL_REVIEW', 'APPROVED_RULESET');
CREATE TYPE "ConditionClearanceState" AS ENUM ('ACTIVE', 'REVIEW_DUE', 'SUSPENDED', 'REVOKED', 'EXPIRED', 'DISPUTED');
CREATE TYPE "ClearanceDecisionValue" AS ENUM ('APPROVE', 'REJECT');
CREATE TYPE "ClearanceDecisionStage" AS ENUM ('PRIMARY', 'SECONDARY', 'RECHECK', 'DISPUTE_RESOLUTION');
CREATE TYPE "MealPlanReviewDecisionValue" AS ENUM ('APPROVE', 'REJECT');
CREATE TYPE "ConditionRulePolicyState" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'RETIRED');
CREATE TYPE "RuleApprovalDecision" AS ENUM ('APPROVE', 'REJECT');
CREATE TYPE "RawRecipeCandidateStatus" AS ENUM ('AVAILABLE', 'RETIRED');
CREATE TYPE "MealCandidateProvenance" AS ENUM ('CERTIFIED_LIBRARY', 'RAW_RECIPE_CORPUS', 'AI_FROM_SCRATCH');
CREATE TYPE "AiUsageOperation" AS ENUM ('MEAL_PLAN_CORPUS_LOOKUP', 'MEAL_PLAN_GENERATION', 'MEAL_REPLACEMENT', 'OUTSIDE_MEAL_ESTIMATE', 'NUTRITION_REPORT', 'OTHER');
ALTER TYPE "MealPlanStatus" ADD VALUE 'DISPUTED';

ALTER TABLE "NutritionistProfile" ADD COLUMN "canLeadReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MealPlan" ADD COLUMN "candidateProvenance" "MealCandidateProvenance" NOT NULL DEFAULT 'AI_FROM_SCRATCH';
ALTER TABLE "MealPlan" ADD COLUMN "sourceRawRecipeCandidateId" TEXT;
ALTER TABLE "AiUsageEvent" ADD COLUMN "operation" "AiUsageOperation" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "AiUsageEvent" ADD COLUMN "purpose" VARCHAR(120);

CREATE TABLE "RawRecipeCandidate" (
  "id" TEXT NOT NULL,
  "sourceRecordId" VARCHAR(191) NOT NULL,
  "sourceName" VARCHAR(80) NOT NULL DEFAULT 'PANLASANG_PINOY',
  "sourceUrl" VARCHAR(2048) NOT NULL,
  "sourceImageUrl" VARCHAR(2048),
  "sourceVideoUrl" VARCHAR(2048),
  "recipeName" VARCHAR(240) NOT NULL,
  "normalizedName" VARCHAR(240) NOT NULL,
  "contentSignature" VARCHAR(64) NOT NULL,
  "category" VARCHAR(120),
  "cuisines" JSONB NOT NULL,
  "description" TEXT,
  "mealType" "MealType" NOT NULL,
  "dietaryTags" JSONB NOT NULL,
  "ingredients" JSONB NOT NULL,
  "publishedNutrition" JSONB,
  "calories" DOUBLE PRECISION,
  "proteinG" DOUBLE PRECISION,
  "carbsG" DOUBLE PRECISION,
  "fatG" DOUBLE PRECISION,
  "originalServings" DOUBLE PRECISION,
  "status" "RawRecipeCandidateStatus" NOT NULL DEFAULT 'AVAILABLE',
  "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RawRecipeCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealConditionClearance" (
  "id" TEXT NOT NULL,
  "mealLibraryId" TEXT NOT NULL,
  "userScopeId" TEXT,
  "condition" "HealthConditionType" NOT NULL,
  "recipeSignature" VARCHAR(64) NOT NULL,
  "evidenceRevision" INTEGER NOT NULL,
  "policyVersion" VARCHAR(64),
  "rulePolicyVersionId" TEXT,
  "assuranceTier" "AssuranceTier" NOT NULL,
  "provenance" "ConditionClearanceProvenance" NOT NULL,
  "state" "ConditionClearanceState" NOT NULL DEFAULT 'REVIEW_DUE',
  "evidenceSnapshot" JSONB NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "auditDueAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "suspensionReason" VARCHAR(240),
  "resolvedByNutritionistId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MealConditionClearance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealConditionClearanceDecision" (
  "id" TEXT NOT NULL,
  "clearanceId" TEXT NOT NULL,
  "nutritionistProfileId" TEXT NOT NULL,
  "stage" "ClearanceDecisionStage" NOT NULL,
  "decision" "ClearanceDecisionValue" NOT NULL,
  "rationale" VARCHAR(1000),
  "evidenceSnapshot" JSONB NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MealConditionClearanceDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealPlanClearanceUsage" (
  "id" TEXT NOT NULL,
  "mealPlanId" TEXT NOT NULL,
  "clearanceId" TEXT NOT NULL,
  "condition" "HealthConditionType" NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MealPlanClearanceUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealPlanReviewDecision" (
  "id" TEXT NOT NULL,
  "mealPlanId" TEXT NOT NULL,
  "nutritionistProfileId" TEXT NOT NULL,
  "stage" "ClearanceDecisionStage" NOT NULL,
  "decision" "MealPlanReviewDecisionValue" NOT NULL,
  "rationale" VARCHAR(1000),
  "evidenceSnapshot" JSONB NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MealPlanReviewDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConditionRulePolicyVersion" (
  "id" TEXT NOT NULL,
  "condition" "HealthConditionType" NOT NULL,
  "policyVersion" VARCHAR(64) NOT NULL,
  "assuranceTier" "AssuranceTier" NOT NULL,
  "automationAllowed" BOOLEAN NOT NULL DEFAULT false,
  "state" "ConditionRulePolicyState" NOT NULL DEFAULT 'DRAFT',
  "impactReport" JSONB,
  "activatedAt" TIMESTAMP(3),
  "suspendedAt" TIMESTAMP(3),
  "suspensionReason" VARCHAR(240),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConditionRulePolicyVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConditionRulePolicyApproval" (
  "id" TEXT NOT NULL,
  "policyVersionId" TEXT NOT NULL,
  "nutritionistProfileId" TEXT NOT NULL,
  "decision" "RuleApprovalDecision" NOT NULL,
  "rationale" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConditionRulePolicyApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RawRecipeCandidate_sourceRecordId_key" ON "RawRecipeCandidate"("sourceRecordId");
CREATE UNIQUE INDEX "RawRecipeCandidate_contentSignature_key" ON "RawRecipeCandidate"("contentSignature");
CREATE INDEX "RawRecipeCandidate_status_mealType_calories_idx" ON "RawRecipeCandidate"("status", "mealType", "calories");
CREATE INDEX "RawRecipeCandidate_normalizedName_idx" ON "RawRecipeCandidate"("normalizedName");
CREATE INDEX "MealPlan_sourceRawRecipeCandidateId_idx" ON "MealPlan"("sourceRawRecipeCandidateId");
CREATE INDEX "MealConditionClearance_mealLibraryId_condition_state_idx" ON "MealConditionClearance"("mealLibraryId", "condition", "state");
CREATE INDEX "MealConditionClearance_condition_state_auditDueAt_idx" ON "MealConditionClearance"("condition", "state", "auditDueAt");
CREATE INDEX "MealConditionClearance_userScopeId_condition_state_idx" ON "MealConditionClearance"("userScopeId", "condition", "state");
CREATE INDEX "MealConditionClearance_policyVersion_state_idx" ON "MealConditionClearance"("policyVersion", "state");
CREATE INDEX "MealConditionClearance_rulePolicyVersionId_state_idx" ON "MealConditionClearance"("rulePolicyVersionId", "state");
CREATE UNIQUE INDEX "MealConditionClearanceDecision_clearanceId_nutritionistProfileId_stage_key" ON "MealConditionClearanceDecision"("clearanceId", "nutritionistProfileId", "stage");
CREATE INDEX "MealConditionClearanceDecision_clearanceId_submittedAt_idx" ON "MealConditionClearanceDecision"("clearanceId", "submittedAt");
CREATE INDEX "MealConditionClearanceDecision_nutritionistProfileId_submittedAt_idx" ON "MealConditionClearanceDecision"("nutritionistProfileId", "submittedAt");
CREATE UNIQUE INDEX "MealPlanClearanceUsage_mealPlanId_condition_key" ON "MealPlanClearanceUsage"("mealPlanId", "condition");
CREATE INDEX "MealPlanClearanceUsage_clearanceId_mealPlanId_idx" ON "MealPlanClearanceUsage"("clearanceId", "mealPlanId");
CREATE UNIQUE INDEX "MealPlanReviewDecision_mealPlanId_nutritionistProfileId_stage_key" ON "MealPlanReviewDecision"("mealPlanId", "nutritionistProfileId", "stage");
CREATE INDEX "MealPlanReviewDecision_mealPlanId_submittedAt_idx" ON "MealPlanReviewDecision"("mealPlanId", "submittedAt");
CREATE UNIQUE INDEX "ConditionRulePolicyVersion_condition_policyVersion_key" ON "ConditionRulePolicyVersion"("condition", "policyVersion");
CREATE INDEX "ConditionRulePolicyVersion_condition_state_idx" ON "ConditionRulePolicyVersion"("condition", "state");
CREATE UNIQUE INDEX "ConditionRulePolicyApproval_policyVersionId_nutritionistProfileId_key" ON "ConditionRulePolicyApproval"("policyVersionId", "nutritionistProfileId");
CREATE INDEX "ConditionRulePolicyApproval_policyVersionId_createdAt_idx" ON "ConditionRulePolicyApproval"("policyVersionId", "createdAt");
CREATE INDEX "AiUsageEvent_operation_createdAt_idx" ON "AiUsageEvent"("operation", "createdAt");

ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_sourceRawRecipeCandidateId_fkey" FOREIGN KEY ("sourceRawRecipeCandidateId") REFERENCES "RawRecipeCandidate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MealConditionClearance" ADD CONSTRAINT "MealConditionClearance_mealLibraryId_fkey" FOREIGN KEY ("mealLibraryId") REFERENCES "MealLibrary"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MealConditionClearance" ADD CONSTRAINT "MealConditionClearance_userScopeId_fkey" FOREIGN KEY ("userScopeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealConditionClearance" ADD CONSTRAINT "MealConditionClearance_resolvedByNutritionistId_fkey" FOREIGN KEY ("resolvedByNutritionistId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MealConditionClearance" ADD CONSTRAINT "MealConditionClearance_rulePolicyVersionId_fkey" FOREIGN KEY ("rulePolicyVersionId") REFERENCES "ConditionRulePolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MealConditionClearanceDecision" ADD CONSTRAINT "MealConditionClearanceDecision_clearanceId_fkey" FOREIGN KEY ("clearanceId") REFERENCES "MealConditionClearance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MealConditionClearanceDecision" ADD CONSTRAINT "MealConditionClearanceDecision_nutritionistProfileId_fkey" FOREIGN KEY ("nutritionistProfileId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MealPlanClearanceUsage" ADD CONSTRAINT "MealPlanClearanceUsage_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealPlanClearanceUsage" ADD CONSTRAINT "MealPlanClearanceUsage_clearanceId_fkey" FOREIGN KEY ("clearanceId") REFERENCES "MealConditionClearance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MealPlanReviewDecision" ADD CONSTRAINT "MealPlanReviewDecision_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MealPlanReviewDecision" ADD CONSTRAINT "MealPlanReviewDecision_nutritionistProfileId_fkey" FOREIGN KEY ("nutritionistProfileId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConditionRulePolicyApproval" ADD CONSTRAINT "ConditionRulePolicyApproval_policyVersionId_fkey" FOREIGN KEY ("policyVersionId") REFERENCES "ConditionRulePolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConditionRulePolicyApproval" ADD CONSTRAINT "ConditionRulePolicyApproval_nutritionistProfileId_fkey" FOREIGN KEY ("nutritionistProfileId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MealConditionClearance" ADD CONSTRAINT "MealConditionClearance_evidenceRevision_check" CHECK ("evidenceRevision" > 0);
