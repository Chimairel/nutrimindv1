-- Additive onboarding consent and email-verification security metadata.
ALTER TABLE "User"
ADD COLUMN "emailVerificationFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "emailVerificationLockedUntil" TIMESTAMP(3),
ADD COLUMN "emailVerificationLastSentAt" TIMESTAMP(3),
ADD COLUMN "acceptedTermsVersion" TEXT,
ADD COLUMN "acceptedPrivacyVersion" TEXT,
ADD COLUMN "healthDataConsentedAt" TIMESTAMP(3);

ALTER TABLE "User"
ADD CONSTRAINT "User_emailVerificationFailedAttempts_nonnegative"
CHECK ("emailVerificationFailedAttempts" >= 0);
