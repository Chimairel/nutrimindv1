ALTER TABLE "User"
ADD COLUMN "passwordLoginEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Google-created accounts were already email-verified and never entered the
-- email OTP flow. Preserve password access for email accounts that later linked
-- Google, while marking historical Google registrations as provider-only.
UPDATE "User" AS users
SET "passwordLoginEnabled" = false
WHERE users."emailVerificationLastSentAt" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "Account" AS accounts
    WHERE accounts."userId" = users."id"
      AND accounts."provider" = 'google'
  );
