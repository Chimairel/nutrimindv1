-- CreateEnum
CREATE TYPE "MealLibrarySafetyEvidenceStatus" AS ENUM ('INCOMPLETE', 'COMPLETE', 'STALE');

-- CreateEnum
CREATE TYPE "MealLibrarySafetyEvidenceOrigin" AS ENUM ('LEGACY_UNREVIEWED', 'NUTRITIONIST_DRAFT', 'NUTRITIONIST_REVIEW');

-- CreateEnum
CREATE TYPE "MealLibraryDeclarationState" AS ENUM ('NOT_REVIEWED', 'REVIEWED_NONE_DECLARED', 'REVIEWED_WITH_DECLARATIONS');

-- CreateEnum
CREATE TYPE "MealLibraryCrossContactAssessment" AS ENUM ('NOT_ASSESSED', 'ASSESSED_NO_KNOWN_RISK', 'RISK_IDENTIFIED');

-- AlterTable
ALTER TABLE "MealLibrary"
ADD COLUMN "safetyEvidenceStatus" "MealLibrarySafetyEvidenceStatus" NOT NULL DEFAULT 'INCOMPLETE',
ADD COLUMN "safetyEvidenceOrigin" "MealLibrarySafetyEvidenceOrigin" NOT NULL DEFAULT 'LEGACY_UNREVIEWED',
ADD COLUMN "conditionDeclarationState" "MealLibraryDeclarationState" NOT NULL DEFAULT 'NOT_REVIEWED',
ADD COLUMN "allergenDeclarationState" "MealLibraryDeclarationState" NOT NULL DEFAULT 'NOT_REVIEWED',
ADD COLUMN "crossContactAssessment" "MealLibraryCrossContactAssessment" NOT NULL DEFAULT 'NOT_ASSESSED',
ADD COLUMN "safetyEvidenceRevision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "certifiedEvidenceRevision" INTEGER,
ADD COLUMN "safetyPolicyVersion" VARCHAR(64),
ADD COLUMN "safetyReviewedByNutritionistId" TEXT,
ADD COLUMN "safetyReviewedAt" TIMESTAMP(3),
ADD COLUMN "safetyInvalidatedAt" TIMESTAMP(3),
ADD COLUMN "safetyInvalidationReason" VARCHAR(64),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing rows retain LEGACY_UNREVIEWED; future rows start as NUTRITIONIST_DRAFT.
ALTER TABLE "MealLibrary"
ALTER COLUMN "safetyEvidenceOrigin" SET DEFAULT 'NUTRITIONIST_DRAFT';

-- AddCheckConstraint
ALTER TABLE "MealLibrary"
ADD CONSTRAINT "MealLibrary_safetyEvidenceRevision_nonnegative" CHECK ("safetyEvidenceRevision" >= 0),
ADD CONSTRAINT "MealLibrary_certifiedEvidenceRevision_nonnegative" CHECK ("certifiedEvidenceRevision" IS NULL OR "certifiedEvidenceRevision" >= 0);

-- CreateIndex
CREATE INDEX "MealLibrary_status_safetyEvidenceStatus_idx" ON "MealLibrary"("status", "safetyEvidenceStatus");

-- CreateIndex
CREATE INDEX "MealLibrary_safetyReviewedByNutritionistId_idx" ON "MealLibrary"("safetyReviewedByNutritionistId");

-- AddForeignKey
ALTER TABLE "MealLibrary"
ADD CONSTRAINT "MealLibrary_safetyReviewedByNutritionistId_fkey"
FOREIGN KEY ("safetyReviewedByNutritionistId") REFERENCES "NutritionistProfile"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
