-- Versioned clinical evidence registry. This migration is additive and does
-- not approve or activate any condition rule.

CREATE TYPE "ClinicalEvidenceDomain" AS ENUM (
  'GENERAL_NUTRITION',
  'ENERGY_ESTIMATION',
  'HYPERTENSION',
  'DIABETES',
  'KIDNEY_DISEASE',
  'CARDIOVASCULAR',
  'PREGNANCY',
  'ALLERGEN_LABELING'
);

CREATE TYPE "ClinicalEvidenceDocumentType" AS ENUM (
  'GUIDELINE',
  'REGULATION',
  'PEER_REVIEWED_STUDY',
  'GOVERNMENT_GUIDANCE',
  'CONSENSUS_REPORT'
);

CREATE TYPE "ClinicalEvidenceSourceState" AS ENUM ('CURRENT', 'SUPERSEDED', 'WITHDRAWN');

CREATE TYPE "ConditionRuleEvaluationScope" AS ENUM (
  'INGREDIENT',
  'PREPARATION',
  'SERVING',
  'MEAL',
  'DAY',
  'PLAN'
);

CREATE TYPE "ConditionRuleAuthority" AS ENUM (
  'INFORMATIONAL',
  'REVIEW_REQUIRED',
  'HARD_BLOCK',
  'CLEARANCE_ELIGIBLE'
);

CREATE TABLE "ClinicalEvidenceSource" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(100) NOT NULL,
  "issuingOrganization" VARCHAR(240) NOT NULL,
  "title" VARCHAR(500) NOT NULL,
  "documentType" "ClinicalEvidenceDocumentType" NOT NULL,
  "domain" "ClinicalEvidenceDomain" NOT NULL,
  "canonicalUrl" VARCHAR(1000) NOT NULL,
  "archivedUrl" VARCHAR(1000),
  "sourceVersion" VARCHAR(160) NOT NULL,
  "publicationDate" DATE,
  "retrievedAt" TIMESTAMP(3) NOT NULL,
  "sectionLocator" VARCHAR(500),
  "population" TEXT NOT NULL,
  "jurisdiction" VARCHAR(160) NOT NULL,
  "exclusionsAndCaveats" TEXT NOT NULL,
  "artifactChecksum" VARCHAR(64),
  "state" "ClinicalEvidenceSourceState" NOT NULL DEFAULT 'CURRENT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ClinicalEvidenceSource_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClinicalEvidenceSource_checksum_format" CHECK (
    "artifactChecksum" IS NULL OR "artifactChecksum" ~ '^[0-9a-f]{64}$'
  )
);

CREATE UNIQUE INDEX "ClinicalEvidenceSource_code_key" ON "ClinicalEvidenceSource"("code");
CREATE INDEX "ClinicalEvidenceSource_domain_state_idx" ON "ClinicalEvidenceSource"("domain", "state");

ALTER TABLE "ConditionNutrientRule"
  ADD COLUMN "evidenceSourceId" TEXT,
  ADD COLUMN "evidenceLocator" VARCHAR(500),
  ADD COLUMN "applicablePopulation" TEXT,
  ADD COLUMN "requiredInputs" JSONB,
  ADD COLUMN "exclusionsAndCaveats" TEXT,
  ADD COLUMN "evaluationScope" "ConditionRuleEvaluationScope",
  ADD COLUMN "authorityOutcome" "ConditionRuleAuthority" NOT NULL DEFAULT 'REVIEW_REQUIRED',
  ADD COLUMN "formulaCode" VARCHAR(80);

ALTER TABLE "ConditionIngredientRule"
  ADD COLUMN "evidenceSourceId" TEXT,
  ADD COLUMN "evidenceLocator" VARCHAR(500),
  ADD COLUMN "applicablePopulation" TEXT,
  ADD COLUMN "requiredInputs" JSONB,
  ADD COLUMN "exclusionsAndCaveats" TEXT,
  ADD COLUMN "evaluationScope" "ConditionRuleEvaluationScope",
  ADD COLUMN "authorityOutcome" "ConditionRuleAuthority" NOT NULL DEFAULT 'REVIEW_REQUIRED';

CREATE INDEX "ConditionNutrientRule_evidenceSourceId_idx" ON "ConditionNutrientRule"("evidenceSourceId");
CREATE INDEX "ConditionIngredientRule_evidenceSourceId_idx" ON "ConditionIngredientRule"("evidenceSourceId");

ALTER TABLE "ConditionNutrientRule"
  ADD CONSTRAINT "ConditionNutrientRule_evidenceSourceId_fkey"
  FOREIGN KEY ("evidenceSourceId") REFERENCES "ClinicalEvidenceSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ConditionIngredientRule"
  ADD CONSTRAINT "ConditionIngredientRule_evidenceSourceId_fkey"
  FOREIGN KEY ("evidenceSourceId") REFERENCES "ClinicalEvidenceSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
