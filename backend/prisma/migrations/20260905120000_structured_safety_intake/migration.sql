-- Additive structured safety intake storage. Existing condition/allergy tables and
-- UserProfile custom strings remain for backwards-compatible consumers.
CREATE TYPE "SafetyEntryDomain" AS ENUM ('CONDITION', 'ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT');
CREATE TYPE "SafetyEntryProvenance" AS ENUM ('PREDEFINED', 'CUSTOM', 'LEGACY_MIGRATION');
CREATE TYPE "SafetyEntrySupportState" AS ENUM ('SUPPORTED', 'RECOGNIZED_UNSUPPORTED', 'NEEDS_CLARIFICATION', 'PENDING_REVIEW', 'INVALID');

ALTER TYPE "HealthProfileRevisionType" ADD VALUE 'STRUCTURED_SAFETY_UPDATED';

CREATE TABLE "SafetyProfileEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" "SafetyEntryDomain" NOT NULL,
    "canonicalCode" VARCHAR(64),
    "displayName" VARCHAR(120) NOT NULL,
    "originalText" VARCHAR(120) NOT NULL,
    "normalizedText" VARCHAR(120) NOT NULL,
    "provenance" "SafetyEntryProvenance" NOT NULL,
    "supportState" "SafetyEntrySupportState" NOT NULL,
    "policyReference" VARCHAR(120) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyProfileEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SafetyProfileEntry_userId_domain_normalizedText_key"
ON "SafetyProfileEntry"("userId", "domain", "normalizedText");

CREATE INDEX "SafetyProfileEntry_userId_domain_idx"
ON "SafetyProfileEntry"("userId", "domain");

CREATE INDEX "SafetyProfileEntry_supportState_idx"
ON "SafetyProfileEntry"("supportState");

ALTER TABLE "SafetyProfileEntry"
ADD CONSTRAINT "SafetyProfileEntry_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
