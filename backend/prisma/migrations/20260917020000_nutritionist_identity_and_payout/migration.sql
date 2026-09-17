-- Additive and safe for environments where these fields were previously added with db push.
ALTER TABLE "NutritionistProfile"
  ADD COLUMN IF NOT EXISTS "officialHeadshot" TEXT,
  ADD COLUMN IF NOT EXISTS "digitalSignature" TEXT,
  ADD COLUMN IF NOT EXISTS "payoutChannel" VARCHAR(30),
  ADD COLUMN IF NOT EXISTS "payoutAccountName" VARCHAR(120),
  ADD COLUMN IF NOT EXISTS "payoutAccountNumber" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "payoutBankName" VARCHAR(80);

ALTER TABLE "NutritionistApplication"
  ADD COLUMN IF NOT EXISTS "officialHeadshot" TEXT,
  ADD COLUMN IF NOT EXISTS "digitalSignature" TEXT;
