CREATE TYPE "ClinicalEvidenceArea" AS ENUM ('DIABETES', 'HYPERTENSION', 'KIDNEY_DISEASE', 'HEART_CONDITION', 'PREGNANCY', 'FOOD_ALLERGY', 'OTHER');
CREATE TYPE "ClinicalDocumentType" AS ENUM ('MEDICAL_ABSTRACT', 'LABORATORY_REPORT', 'MEDICATION_LIST', 'DIET_ORDER', 'DISCHARGE_INSTRUCTIONS', 'ALLERGY_ACTION_PLAN', 'PRENATAL_SUMMARY', 'OTHER');
CREATE TYPE "ClinicalDocumentStatus" AS ENUM ('UPLOADED', 'NEEDS_CLARIFICATION', 'SUFFICIENT_FOR_NUTRITION_REVIEW', 'UNUSABLE', 'SUPERSEDED', 'WITHDRAWN');
CREATE TYPE "ClinicalDocumentReviewDecision" AS ENUM ('SUFFICIENT', 'NEEDS_CLARIFICATION', 'UNUSABLE');
CREATE TYPE "ClinicalFactCode" AS ENUM ('CKD_STAGE', 'EGFR', 'SERUM_POTASSIUM', 'SERUM_PHOSPHORUS', 'DIALYSIS_STATUS', 'HEART_DIAGNOSIS', 'SODIUM_LIMIT', 'FLUID_LIMIT', 'A1C', 'DIABETES_MEDICATION', 'RECURRENT_HYPOGLYCEMIA', 'GESTATIONAL_AGE_WEEKS', 'MEDICATION_SUMMARY', 'CLINICIAN_INSTRUCTION', 'ALLERGY_SEVERITY', 'CROSS_CONTACT_REQUIRED', 'OTHER');
CREATE TYPE "ClinicalFactProvenance" AS ENUM ('USER_ENTERED', 'DOCUMENT_TRANSCRIBED', 'NUTRITIONIST_CONFIRMED');
CREATE TYPE "ClinicalFactReviewStatus" AS ENUM ('UNREVIEWED', 'CONFIRMED', 'UNCLEAR', 'REJECTED');

CREATE TABLE "ClinicalContextResponse" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "area" "ClinicalEvidenceArea" NOT NULL,
  "responses" JSONB NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicalContextResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClinicalDocument" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "area" "ClinicalEvidenceArea" NOT NULL,
  "documentType" "ClinicalDocumentType" NOT NULL,
  "status" "ClinicalDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  "revision" INTEGER NOT NULL DEFAULT 1,
  "originalFileName" VARCHAR(180) NOT NULL,
  "mimeType" VARCHAR(80) NOT NULL,
  "byteSize" INTEGER NOT NULL,
  "sha256" VARCHAR(64) NOT NULL,
  "encryptedPayload" BYTEA NOT NULL,
  "encryptionIv" BYTEA NOT NULL,
  "encryptionAuthTag" BYTEA NOT NULL,
  "issuedAt" DATE,
  "issuerName" VARCHAR(180),
  "consentVersion" VARCHAR(80) NOT NULL,
  "validUntil" DATE,
  "supersedesDocumentId" TEXT,
  "claimedByNutritionistId" TEXT,
  "claimedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicalDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClinicalFact" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "documentId" TEXT,
  "area" "ClinicalEvidenceArea" NOT NULL,
  "code" "ClinicalFactCode" NOT NULL,
  "valueText" VARCHAR(500),
  "valueNumber" DOUBLE PRECISION,
  "unit" VARCHAR(40),
  "observedAt" DATE,
  "pageNumber" INTEGER,
  "provenance" "ClinicalFactProvenance" NOT NULL DEFAULT 'USER_ENTERED',
  "reviewStatus" "ClinicalFactReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
  "reviewedByNutritionistId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicalFact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClinicalDocumentReview" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "nutritionistProfileId" TEXT NOT NULL,
  "decision" "ClinicalDocumentReviewDecision" NOT NULL,
  "rationale" VARCHAR(1500) NOT NULL,
  "validUntil" DATE,
  "factsSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClinicalDocumentReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClearanceClinicalEvidence" (
  "id" TEXT NOT NULL,
  "clearanceId" TEXT NOT NULL,
  "clinicalDocumentId" TEXT NOT NULL,
  "documentRevision" INTEGER NOT NULL,
  "documentSha256" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClearanceClinicalEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealPlanClinicalEvidence" (
  "id" TEXT NOT NULL,
  "mealPlanId" TEXT NOT NULL,
  "clinicalDocumentId" TEXT NOT NULL,
  "documentRevision" INTEGER NOT NULL,
  "documentSha256" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MealPlanClinicalEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClinicalContextResponse_userId_area_key" ON "ClinicalContextResponse"("userId", "area");
CREATE INDEX "ClinicalContextResponse_area_updatedAt_idx" ON "ClinicalContextResponse"("area", "updatedAt");
CREATE UNIQUE INDEX "ClinicalDocument_supersedesDocumentId_key" ON "ClinicalDocument"("supersedesDocumentId");
CREATE INDEX "ClinicalDocument_userId_area_status_idx" ON "ClinicalDocument"("userId", "area", "status");
CREATE INDEX "ClinicalDocument_status_createdAt_idx" ON "ClinicalDocument"("status", "createdAt");
CREATE INDEX "ClinicalDocument_claimedByNutritionistId_claimedAt_idx" ON "ClinicalDocument"("claimedByNutritionistId", "claimedAt");
CREATE INDEX "ClinicalFact_userId_area_code_idx" ON "ClinicalFact"("userId", "area", "code");
CREATE INDEX "ClinicalFact_documentId_reviewStatus_idx" ON "ClinicalFact"("documentId", "reviewStatus");
CREATE INDEX "ClinicalDocumentReview_documentId_createdAt_idx" ON "ClinicalDocumentReview"("documentId", "createdAt");
CREATE INDEX "ClinicalDocumentReview_nutritionistProfileId_createdAt_idx" ON "ClinicalDocumentReview"("nutritionistProfileId", "createdAt");
CREATE UNIQUE INDEX "ClearanceClinicalEvidence_clearanceId_clinicalDocumentId_key" ON "ClearanceClinicalEvidence"("clearanceId", "clinicalDocumentId");
CREATE INDEX "ClearanceClinicalEvidence_clinicalDocumentId_clearanceId_idx" ON "ClearanceClinicalEvidence"("clinicalDocumentId", "clearanceId");
CREATE UNIQUE INDEX "MealPlanClinicalEvidence_mealPlanId_clinicalDocumentId_key" ON "MealPlanClinicalEvidence"("mealPlanId", "clinicalDocumentId");
CREATE INDEX "MealPlanClinicalEvidence_clinicalDocumentId_mealPlanId_idx" ON "MealPlanClinicalEvidence"("clinicalDocumentId", "mealPlanId");

ALTER TABLE "ClinicalContextResponse" ADD CONSTRAINT "ClinicalContextResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalDocument" ADD CONSTRAINT "ClinicalDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalDocument" ADD CONSTRAINT "ClinicalDocument_supersedesDocumentId_fkey" FOREIGN KEY ("supersedesDocumentId") REFERENCES "ClinicalDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalDocument" ADD CONSTRAINT "ClinicalDocument_claimedByNutritionistId_fkey" FOREIGN KEY ("claimedByNutritionistId") REFERENCES "NutritionistProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalFact" ADD CONSTRAINT "ClinicalFact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalFact" ADD CONSTRAINT "ClinicalFact_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ClinicalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalFact" ADD CONSTRAINT "ClinicalFact_reviewedByNutritionistId_fkey" FOREIGN KEY ("reviewedByNutritionistId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClinicalDocumentReview" ADD CONSTRAINT "ClinicalDocumentReview_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ClinicalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalDocumentReview" ADD CONSTRAINT "ClinicalDocumentReview_nutritionistProfileId_fkey" FOREIGN KEY ("nutritionistProfileId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClearanceClinicalEvidence" ADD CONSTRAINT "ClearanceClinicalEvidence_clearanceId_fkey" FOREIGN KEY ("clearanceId") REFERENCES "MealConditionClearance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClearanceClinicalEvidence" ADD CONSTRAINT "ClearanceClinicalEvidence_clinicalDocumentId_fkey" FOREIGN KEY ("clinicalDocumentId") REFERENCES "ClinicalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MealPlanClinicalEvidence" ADD CONSTRAINT "MealPlanClinicalEvidence_mealPlanId_fkey" FOREIGN KEY ("mealPlanId") REFERENCES "MealPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealPlanClinicalEvidence" ADD CONSTRAINT "MealPlanClinicalEvidence_clinicalDocumentId_fkey" FOREIGN KEY ("clinicalDocumentId") REFERENCES "ClinicalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
