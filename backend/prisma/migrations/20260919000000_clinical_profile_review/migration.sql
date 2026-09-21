CREATE TYPE "ClinicalProfileReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

CREATE TABLE "ClinicalProfileReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileRevision" INTEGER NOT NULL,
    "policyVersion" VARCHAR(80) NOT NULL,
    "status" "ClinicalProfileReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reasonCodes" JSONB NOT NULL,
    "profileSnapshot" JSONB NOT NULL,
    "reviewerId" TEXT,
    "reviewNotes" VARCHAR(2000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "ClinicalProfileReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClinicalProfileReview_userId_profileRevision_policyVersion_key"
ON "ClinicalProfileReview"("userId", "profileRevision", "policyVersion");
CREATE INDEX "ClinicalProfileReview_status_createdAt_idx" ON "ClinicalProfileReview"("status", "createdAt");
CREATE INDEX "ClinicalProfileReview_reviewerId_idx" ON "ClinicalProfileReview"("reviewerId");

ALTER TABLE "ClinicalProfileReview" ADD CONSTRAINT "ClinicalProfileReview_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalProfileReview" ADD CONSTRAINT "ClinicalProfileReview_reviewerId_fkey"
FOREIGN KEY ("reviewerId") REFERENCES "NutritionistProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
