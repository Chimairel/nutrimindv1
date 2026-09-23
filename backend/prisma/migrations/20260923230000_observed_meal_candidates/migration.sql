CREATE TYPE "ObservedMealSubmissionStatus" AS ENUM ('SUBMITTED', 'ADMITTED_REFERENCE', 'ADMITTED_RECIPE', 'WITHDRAWN');

CREATE TABLE "ObservedFoodReference" (
  "id" TEXT NOT NULL,
  "signature" VARCHAR(64) NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "normalizedName" VARCHAR(180) NOT NULL,
  "servingGrams" DOUBLE PRECISION NOT NULL,
  "calories" DOUBLE PRECISION NOT NULL,
  "proteinG" DOUBLE PRECISION NOT NULL,
  "carbsG" DOUBLE PRECISION NOT NULL,
  "fatG" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ObservedFoodReference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ObservedMealSubmission" (
  "id" TEXT NOT NULL,
  "sourceUserId" TEXT,
  "sourceOutsideMealItemId" TEXT,
  "sourceRevision" INTEGER NOT NULL,
  "detailsConsentedAt" TIMESTAMP(3) NOT NULL,
  "imageReuseConsentedAt" TIMESTAMP(3),
  "status" "ObservedMealSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "foodReferenceId" TEXT,
  "rawRecipeCandidateId" TEXT,
  "classifiedByNutritionistId" TEXT,
  "classifiedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ObservedMealSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ObservedFoodReference_signature_key" ON "ObservedFoodReference"("signature");
CREATE INDEX "ObservedFoodReference_normalizedName_idx" ON "ObservedFoodReference"("normalizedName");
CREATE UNIQUE INDEX "ObservedMealSubmission_sourceOutsideMealItemId_sourceRevision_key"
  ON "ObservedMealSubmission"("sourceOutsideMealItemId", "sourceRevision");
CREATE INDEX "ObservedMealSubmission_status_createdAt_idx" ON "ObservedMealSubmission"("status", "createdAt");
CREATE INDEX "ObservedMealSubmission_rawRecipeCandidateId_status_idx" ON "ObservedMealSubmission"("rawRecipeCandidateId", "status");
CREATE INDEX "ObservedMealSubmission_foodReferenceId_status_idx" ON "ObservedMealSubmission"("foodReferenceId", "status");

ALTER TABLE "ObservedMealSubmission" ADD CONSTRAINT "ObservedMealSubmission_sourceUserId_fkey"
  FOREIGN KEY ("sourceUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ObservedMealSubmission" ADD CONSTRAINT "ObservedMealSubmission_sourceOutsideMealItemId_fkey"
  FOREIGN KEY ("sourceOutsideMealItemId") REFERENCES "OutsideMealLogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ObservedMealSubmission" ADD CONSTRAINT "ObservedMealSubmission_foodReferenceId_fkey"
  FOREIGN KEY ("foodReferenceId") REFERENCES "ObservedFoodReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ObservedMealSubmission" ADD CONSTRAINT "ObservedMealSubmission_rawRecipeCandidateId_fkey"
  FOREIGN KEY ("rawRecipeCandidateId") REFERENCES "RawRecipeCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
