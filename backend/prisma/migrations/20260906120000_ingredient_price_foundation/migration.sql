-- CreateEnum
CREATE TYPE "IngredientPriceSourceKind" AS ENUM ('PSA_OPENSTAT', 'DA_BANTAY_PRESYO', 'DTI_SRP_BULLETIN', 'OTHER_OFFICIAL');

-- CreateEnum
CREATE TYPE "IngredientPriceAccessMethod" AS ENUM ('API', 'DOWNLOAD', 'MANUAL_TRANSCRIPTION');

-- CreateEnum
CREATE TYPE "IngredientPriceAutomationStatus" AS ENUM ('SUPPORTED', 'MANUAL_ONLY', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "IngredientPriceGeographyLevel" AS ENUM ('NATIONAL', 'REGION', 'PROVINCE', 'CITY', 'MARKET_GROUP');

-- CreateEnum
CREATE TYPE "IngredientPriceObservationKind" AS ENUM ('AVERAGE_RETAIL', 'SUGGESTED_RETAIL', 'OBSERVED_RANGE');

-- CreateEnum
CREATE TYPE "IngredientPriceUnit" AS ENUM ('MILLIGRAM', 'GRAM', 'KILOGRAM', 'MILLILITER', 'LITER', 'PIECE', 'PACKAGE');

-- CreateEnum
CREATE TYPE "IngredientPriceMappingState" AS ENUM ('UNMAPPED', 'EXACT', 'AMBIGUOUS', 'REJECTED');

-- CreateEnum
CREATE TYPE "IngredientPriceMappingEvidenceKind" AS ENUM ('EXTERNAL_IDENTIFIER', 'REVIEWED_EXACT_DESCRIPTION', 'REVIEWED_EXACT_ALIAS', 'CANDIDATE_ONLY', 'REJECTION_NOTE');

-- CreateTable
CREATE TABLE "IngredientPriceSource" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "kind" "IngredientPriceSourceKind" NOT NULL,
    "agencyName" VARCHAR(160) NOT NULL,
    "datasetName" VARCHAR(240) NOT NULL,
    "homepageUrl" VARCHAR(500) NOT NULL,
    "apiBaseUrl" VARCHAR(500),
    "termsUrl" VARCHAR(500),
    "licenseCode" VARCHAR(80),
    "attributionText" VARCHAR(300) NOT NULL,
    "accessMethod" "IngredientPriceAccessMethod" NOT NULL,
    "automationStatus" "IngredientPriceAutomationStatus" NOT NULL,
    "updateCadence" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientPriceSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientPricePublication" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalPublicationId" VARCHAR(191) NOT NULL,
    "sourceUrl" VARCHAR(500) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "contentSha256" CHAR(64),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientPricePublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientPriceGeography" (
    "id" TEXT NOT NULL,
    "scheme" VARCHAR(80) NOT NULL,
    "externalCode" VARCHAR(120) NOT NULL,
    "displayName" VARCHAR(180) NOT NULL,
    "level" "IngredientPriceGeographyLevel" NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientPriceGeography_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientPriceCommodity" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceCommodityKey" VARCHAR(191) NOT NULL,
    "originalDescription" VARCHAR(240) NOT NULL,
    "originalSpecification" VARCHAR(240),
    "originalUnit" VARCHAR(80) NOT NULL,
    "normalizedQuantity" DECIMAL(18,6),
    "normalizedUnit" "IngredientPriceUnit",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientPriceCommodity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientPriceCommodityMapping" (
    "id" TEXT NOT NULL,
    "commodityId" TEXT NOT NULL,
    "state" "IngredientPriceMappingState" NOT NULL,
    "foodItemId" TEXT,
    "evidenceKind" "IngredientPriceMappingEvidenceKind" NOT NULL,
    "evidenceReference" VARCHAR(500),
    "rationale" VARCHAR(500) NOT NULL,
    "candidateFoodItemIds" JSONB,
    "supersedesMappingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientPriceCommodityMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngredientPriceObservation" (
    "id" TEXT NOT NULL,
    "publicationId" TEXT NOT NULL,
    "commodityId" TEXT NOT NULL,
    "geographyId" TEXT NOT NULL,
    "sourceObservationKey" VARCHAR(240) NOT NULL,
    "kind" "IngredientPriceObservationKind" NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'PHP',
    "amountMinCentavos" INTEGER NOT NULL,
    "amountMaxCentavos" INTEGER NOT NULL,
    "observedFrom" TIMESTAMP(3) NOT NULL,
    "observedTo" TIMESTAMP(3) NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "originalCommodityDescription" VARCHAR(240) NOT NULL,
    "originalSpecification" VARCHAR(240),
    "originalUnit" VARCHAR(80) NOT NULL,
    "normalizedQuantity" DECIMAL(18,6),
    "normalizedUnit" "IngredientPriceUnit",
    "supersedesObservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngredientPriceObservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngredientPriceSource_code_key" ON "IngredientPriceSource"("code");

-- CreateIndex
CREATE INDEX "IngredientPricePublication_sourceId_periodEnd_idx" ON "IngredientPricePublication"("sourceId", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientPricePublication_sourceId_externalPublicationId_r_key" ON "IngredientPricePublication"("sourceId", "externalPublicationId", "retrievedAt");

-- CreateIndex
CREATE INDEX "IngredientPriceGeography_parentId_idx" ON "IngredientPriceGeography"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientPriceGeography_scheme_externalCode_key" ON "IngredientPriceGeography"("scheme", "externalCode");

-- CreateIndex
CREATE INDEX "IngredientPriceCommodity_sourceId_originalDescription_idx" ON "IngredientPriceCommodity"("sourceId", "originalDescription");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientPriceCommodity_sourceId_sourceCommodityKey_key" ON "IngredientPriceCommodity"("sourceId", "sourceCommodityKey");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientPriceCommodityMapping_supersedesMappingId_key" ON "IngredientPriceCommodityMapping"("supersedesMappingId");

-- CreateIndex
CREATE INDEX "IngredientPriceCommodityMapping_commodityId_createdAt_idx" ON "IngredientPriceCommodityMapping"("commodityId", "createdAt");

-- CreateIndex
CREATE INDEX "IngredientPriceCommodityMapping_foodItemId_idx" ON "IngredientPriceCommodityMapping"("foodItemId");

-- CreateIndex
CREATE INDEX "IngredientPriceCommodityMapping_state_idx" ON "IngredientPriceCommodityMapping"("state");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientPriceObservation_supersedesObservationId_key" ON "IngredientPriceObservation"("supersedesObservationId");

-- CreateIndex
CREATE INDEX "IngredientPriceObservation_commodityId_geographyId_observed_idx" ON "IngredientPriceObservation"("commodityId", "geographyId", "observedTo");

-- CreateIndex
CREATE INDEX "IngredientPriceObservation_geographyId_observedTo_idx" ON "IngredientPriceObservation"("geographyId", "observedTo");

-- CreateIndex
CREATE UNIQUE INDEX "IngredientPriceObservation_publicationId_sourceObservationK_key" ON "IngredientPriceObservation"("publicationId", "sourceObservationKey");

-- AddForeignKey
ALTER TABLE "IngredientPricePublication" ADD CONSTRAINT "IngredientPricePublication_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IngredientPriceSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientPriceGeography" ADD CONSTRAINT "IngredientPriceGeography_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "IngredientPriceGeography"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientPriceCommodity" ADD CONSTRAINT "IngredientPriceCommodity_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IngredientPriceSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientPriceCommodityMapping" ADD CONSTRAINT "IngredientPriceCommodityMapping_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "IngredientPriceCommodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientPriceCommodityMapping" ADD CONSTRAINT "IngredientPriceCommodityMapping_foodItemId_fkey" FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientPriceCommodityMapping" ADD CONSTRAINT "IngredientPriceCommodityMapping_supersedesMappingId_fkey" FOREIGN KEY ("supersedesMappingId") REFERENCES "IngredientPriceCommodityMapping"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientPriceObservation" ADD CONSTRAINT "IngredientPriceObservation_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES "IngredientPricePublication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientPriceObservation" ADD CONSTRAINT "IngredientPriceObservation_commodityId_fkey" FOREIGN KEY ("commodityId") REFERENCES "IngredientPriceCommodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientPriceObservation" ADD CONSTRAINT "IngredientPriceObservation_geographyId_fkey" FOREIGN KEY ("geographyId") REFERENCES "IngredientPriceGeography"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngredientPriceObservation" ADD CONSTRAINT "IngredientPriceObservation_supersedesObservationId_fkey" FOREIGN KEY ("supersedesObservationId") REFERENCES "IngredientPriceObservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CheckConstraint: source URLs and API automation claims must be explicit and secure.
ALTER TABLE "IngredientPriceSource" ADD CONSTRAINT "IngredientPriceSource_https_urls" CHECK (
    "homepageUrl" ~ '^https://' AND
    ("apiBaseUrl" IS NULL OR "apiBaseUrl" ~ '^https://') AND
    ("termsUrl" IS NULL OR "termsUrl" ~ '^https://')
);
ALTER TABLE "IngredientPriceSource" ADD CONSTRAINT "IngredientPriceSource_automation_shape" CHECK (
    "automationStatus" <> 'SUPPORTED' OR ("accessMethod" = 'API' AND "apiBaseUrl" IS NOT NULL)
);

-- CheckConstraint: publication snapshots preserve bounded dates and optional SHA-256 evidence.
ALTER TABLE "IngredientPricePublication" ADD CONSTRAINT "IngredientPricePublication_period_order" CHECK (
    "periodStart" IS NULL OR "periodEnd" IS NULL OR "periodEnd" >= "periodStart"
);
ALTER TABLE "IngredientPricePublication" ADD CONSTRAINT "IngredientPricePublication_sha256_shape" CHECK (
    "contentSha256" IS NULL OR "contentSha256" ~ '^[0-9a-f]{64}$'
);
ALTER TABLE "IngredientPricePublication" ADD CONSTRAINT "IngredientPricePublication_https_source" CHECK (
    "sourceUrl" ~ '^https://'
);

-- CheckConstraint: normalization is optional, but may never be half-populated or non-positive.
ALTER TABLE "IngredientPriceCommodity" ADD CONSTRAINT "IngredientPriceCommodity_normalization_shape" CHECK (
    ("normalizedQuantity" IS NULL AND "normalizedUnit" IS NULL) OR
    ("normalizedQuantity" > 0 AND "normalizedUnit" IS NOT NULL)
);

-- CheckConstraint: only explicit exact mappings can point at one FNRI food; uncertain states cannot.
ALTER TABLE "IngredientPriceCommodityMapping" ADD CONSTRAINT "IngredientPriceCommodityMapping_state_shape" CHECK (
    (
      "state" = 'EXACT' AND
      "foodItemId" IS NOT NULL AND
      "evidenceReference" IS NOT NULL AND
      "evidenceKind" IN ('EXTERNAL_IDENTIFIER', 'REVIEWED_EXACT_DESCRIPTION', 'REVIEWED_EXACT_ALIAS')
    ) OR (
      "state" = 'UNMAPPED' AND
      "foodItemId" IS NULL
    ) OR (
      "state" = 'AMBIGUOUS' AND
      "foodItemId" IS NULL AND
      "evidenceKind" = 'CANDIDATE_ONLY'
    ) OR (
      "state" = 'REJECTED' AND
      "foodItemId" IS NULL AND
      "evidenceKind" = 'REJECTION_NOTE'
    )
);
ALTER TABLE "IngredientPriceCommodityMapping" ADD CONSTRAINT "IngredientPriceCommodityMapping_no_self_supersession" CHECK (
    "supersedesMappingId" IS NULL OR "supersedesMappingId" <> "id"
);

-- CheckConstraint: observations retain PHP integer ranges, time bounds, and explicit normalization.
ALTER TABLE "IngredientPriceObservation" ADD CONSTRAINT "IngredientPriceObservation_money_range" CHECK (
    "currency" = 'PHP' AND
    "amountMinCentavos" > 0 AND
    "amountMaxCentavos" >= "amountMinCentavos"
);
ALTER TABLE "IngredientPriceObservation" ADD CONSTRAINT "IngredientPriceObservation_period_order" CHECK (
    "observedTo" >= "observedFrom" AND
    ("validFrom" IS NULL OR "validUntil" IS NULL OR "validUntil" >= "validFrom")
);
ALTER TABLE "IngredientPriceObservation" ADD CONSTRAINT "IngredientPriceObservation_normalization_shape" CHECK (
    ("normalizedQuantity" IS NULL AND "normalizedUnit" IS NULL) OR
    ("normalizedQuantity" > 0 AND "normalizedUnit" IS NOT NULL)
);
ALTER TABLE "IngredientPriceObservation" ADD CONSTRAINT "IngredientPriceObservation_no_self_supersession" CHECK (
    "supersedesObservationId" IS NULL OR "supersedesObservationId" <> "id"
);

-- Evidence is append-only. Corrections are represented by a new snapshot or superseding row.
CREATE FUNCTION "IngredientPriceEvidence_reject_mutation"() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'ingredient price evidence is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "IngredientPriceSource_append_only" BEFORE UPDATE OR DELETE ON "IngredientPriceSource"
FOR EACH ROW EXECUTE FUNCTION "IngredientPriceEvidence_reject_mutation"();
CREATE TRIGGER "IngredientPricePublication_append_only" BEFORE UPDATE OR DELETE ON "IngredientPricePublication"
FOR EACH ROW EXECUTE FUNCTION "IngredientPriceEvidence_reject_mutation"();
CREATE TRIGGER "IngredientPriceGeography_append_only" BEFORE UPDATE OR DELETE ON "IngredientPriceGeography"
FOR EACH ROW EXECUTE FUNCTION "IngredientPriceEvidence_reject_mutation"();
CREATE TRIGGER "IngredientPriceCommodity_append_only" BEFORE UPDATE OR DELETE ON "IngredientPriceCommodity"
FOR EACH ROW EXECUTE FUNCTION "IngredientPriceEvidence_reject_mutation"();
CREATE TRIGGER "IngredientPriceCommodityMapping_append_only" BEFORE UPDATE OR DELETE ON "IngredientPriceCommodityMapping"
FOR EACH ROW EXECUTE FUNCTION "IngredientPriceEvidence_reject_mutation"();
CREATE TRIGGER "IngredientPriceObservation_append_only" BEFORE UPDATE OR DELETE ON "IngredientPriceObservation"
FOR EACH ROW EXECUTE FUNCTION "IngredientPriceEvidence_reject_mutation"();
