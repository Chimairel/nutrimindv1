CREATE TYPE "NutritionistApplicationStatus" AS ENUM (
  'SUBMITTED',
  'UNDER_REVIEW',
  'CALL_REQUIRED',
  'CALL_SCHEDULED',
  'APPROVED',
  'REJECTED',
  'ACTIVATED'
);

CREATE TABLE "NutritionistApplication" (
  "id" TEXT NOT NULL,
  "referenceCode" VARCHAR(32) NOT NULL,
  "status" "NutritionistApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "fullName" VARCHAR(161) NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "phoneNumber" VARCHAR(30) NOT NULL,
  "prcLicenseNumber" VARCHAR(80) NOT NULL,
  "prcLicenseExpiry" TIMESTAMP(3) NOT NULL,
  "specialization" VARCHAR(120) NOT NULL,
  "yearsOfExperience" INTEGER NOT NULL,
  "university" VARCHAR(180) NOT NULL,
  "professionalBio" TEXT NOT NULL,
  "availableCallSlots" JSONB NOT NULL,
  "applicantConsentAt" TIMESTAMP(3) NOT NULL,
  "reviewedByAdminId" TEXT,
  "scheduledCallAt" TIMESTAMP(3),
  "meetingUrl" VARCHAR(500),
  "adminNotes" TEXT,
  "decisionReason" VARCHAR(500),
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "invitationTokenHash" VARCHAR(64),
  "invitationExpiresAt" TIMESTAMP(3),
  "invitationSentAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "invitedUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NutritionistApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NutritionistApplication_referenceCode_key" ON "NutritionistApplication"("referenceCode");
CREATE UNIQUE INDEX "NutritionistApplication_email_key" ON "NutritionistApplication"("email");
CREATE UNIQUE INDEX "NutritionistApplication_prcLicenseNumber_key" ON "NutritionistApplication"("prcLicenseNumber");
CREATE UNIQUE INDEX "NutritionistApplication_invitationTokenHash_key" ON "NutritionistApplication"("invitationTokenHash");
CREATE UNIQUE INDEX "NutritionistApplication_invitedUserId_key" ON "NutritionistApplication"("invitedUserId");
CREATE INDEX "NutritionistApplication_status_createdAt_idx" ON "NutritionistApplication"("status", "createdAt");
CREATE INDEX "NutritionistApplication_scheduledCallAt_idx" ON "NutritionistApplication"("scheduledCallAt");

ALTER TABLE "NutritionistApplication"
  ADD CONSTRAINT "NutritionistApplication_reviewedByAdminId_fkey"
  FOREIGN KEY ("reviewedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NutritionistApplication"
  ADD CONSTRAINT "NutritionistApplication_invitedUserId_fkey"
  FOREIGN KEY ("invitedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NutritionistApplication"
  ADD CONSTRAINT "NutritionistApplication_yearsOfExperience_check"
  CHECK ("yearsOfExperience" >= 0 AND "yearsOfExperience" <= 70);
