CREATE TYPE "IngredientConversionBasis" AS ENUM ('PURCHASED_AS_SOLD', 'RAW_EDIBLE', 'COOKED_EDIBLE');
CREATE TYPE "IngredientConversionKind" AS ENUM ('PURCHASED_TO_RAW_YIELD', 'RAW_TO_COOKED_YIELD', 'PURCHASED_TO_COOKED_YIELD', 'HOUSEHOLD_MEASURE_TO_MASS');
CREATE TYPE "IngredientConversionDirection" AS ENUM ('FORWARD_ONLY', 'BIDIRECTIONAL');
CREATE TYPE "IngredientConversionUnit" AS ENUM ('MILLIGRAM', 'GRAM', 'KILOGRAM', 'MILLILITER', 'LITER', 'TEASPOON', 'TABLESPOON', 'CUP', 'PIECE');
CREATE TYPE "IngredientConversionReviewStatus" AS ENUM ('DRAFT', 'REVIEWED', 'REJECTED');
CREATE TYPE "IngredientConversionRedistributionStatus" AS ENUM ('REDISTRIBUTABLE', 'AUTHORIZED_INTERNAL_USE', 'METADATA_ONLY', 'LICENSE_REVIEW_REQUIRED');

CREATE TABLE "IngredientConversionSource" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "agencyName" VARCHAR(180) NOT NULL,
  "publicationTitle" VARCHAR(300) NOT NULL,
  "sourceUrl" VARCHAR(500) NOT NULL,
  "termsUrl" VARCHAR(500),
  "versionLabel" VARCHAR(120) NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "accessedAt" TIMESTAMP(3) NOT NULL,
  "geographyApplicability" VARCHAR(240) NOT NULL,
  "methodology" TEXT NOT NULL,
  "licenseCode" VARCHAR(100),
  "redistributionStatus" "IngredientConversionRedistributionStatus" NOT NULL,
  "attributionText" VARCHAR(500) NOT NULL,
  "contentSha256" CHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IngredientConversionSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IngredientConversionEvidence" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "externalEvidenceKey" VARCHAR(191) NOT NULL,
  "evidenceVersion" VARCHAR(80) NOT NULL,
  "kind" "IngredientConversionKind" NOT NULL,
  "fromBasis" "IngredientConversionBasis" NOT NULL,
  "toBasis" "IngredientConversionBasis" NOT NULL,
  "direction" "IngredientConversionDirection" NOT NULL DEFAULT 'FORWARD_ONLY',
  "fromFoodIdentity" VARCHAR(240) NOT NULL,
  "toFoodIdentity" VARCHAR(240) NOT NULL,
  "fromFoodItemId" TEXT,
  "toFoodItemId" TEXT,
  "fromPriceCommodityId" TEXT,
  "fromPreparationCode" VARCHAR(120) NOT NULL,
  "toPreparationCode" VARCHAR(120) NOT NULL,
  "fromUnit" "IngredientConversionUnit" NOT NULL,
  "toUnit" "IngredientConversionUnit" NOT NULL,
  "factorMinNumerator" INTEGER NOT NULL,
  "factorMinDenominator" INTEGER NOT NULL,
  "factorMaxNumerator" INTEGER NOT NULL,
  "factorMaxDenominator" INTEGER NOT NULL,
  "uncertaintyNote" VARCHAR(500) NOT NULL,
  "observedFrom" TIMESTAMP(3),
  "observedTo" TIMESTAMP(3),
  "effectiveFrom" TIMESTAMP(3),
  "effectiveUntil" TIMESTAMP(3),
  "reviewStatus" "IngredientConversionReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "reviewedAt" TIMESTAMP(3),
  "reviewerReference" VARCHAR(191),
  "supersedesEvidenceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IngredientConversionEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IngredientConversionSource_code_key" ON "IngredientConversionSource"("code");
CREATE UNIQUE INDEX "IngredientConversionEvidence_sourceId_externalEvidenceKey_e_key" ON "IngredientConversionEvidence"("sourceId", "externalEvidenceKey", "evidenceVersion");
CREATE UNIQUE INDEX "IngredientConversionEvidence_supersedesEvidenceId_key" ON "IngredientConversionEvidence"("supersedesEvidenceId");
CREATE INDEX "IngredientConversionEvidence_fromFoodItemId_toFoodItemId_idx" ON "IngredientConversionEvidence"("fromFoodItemId", "toFoodItemId");
CREATE INDEX "IngredientConversionEvidence_fromPriceCommodityId_idx" ON "IngredientConversionEvidence"("fromPriceCommodityId");
CREATE INDEX "IngredientConversionEvidence_reviewStatus_effectiveUntil_idx" ON "IngredientConversionEvidence"("reviewStatus", "effectiveUntil");

ALTER TABLE "IngredientConversionSource" ADD CONSTRAINT "IngredientConversionSource_https_urls" CHECK (
  "sourceUrl" LIKE 'https://%' AND ("termsUrl" IS NULL OR "termsUrl" LIKE 'https://%')
);
ALTER TABLE "IngredientConversionSource" ADD CONSTRAINT "IngredientConversionSource_sha256_shape" CHECK (
  "contentSha256" IS NULL OR "contentSha256" ~ '^[0-9a-f]{64}$'
);
ALTER TABLE "IngredientConversionSource" ADD CONSTRAINT "IngredientConversionSource_license_shape" CHECK (
  ("redistributionStatus" IN ('REDISTRIBUTABLE', 'AUTHORIZED_INTERNAL_USE') AND "licenseCode" IS NOT NULL AND length(btrim("licenseCode")) > 0 AND "contentSha256" IS NOT NULL) OR
  ("redistributionStatus" IN ('METADATA_ONLY', 'LICENSE_REVIEW_REQUIRED'))
);

ALTER TABLE "IngredientConversionEvidence" ADD CONSTRAINT "IngredientConversionEvidence_positive_factors" CHECK (
  "factorMinNumerator" > 0 AND "factorMinDenominator" > 0 AND
  "factorMaxNumerator" > 0 AND "factorMaxDenominator" > 0 AND
  "factorMinNumerator" <= 1000000000 AND "factorMinDenominator" <= 1000000000 AND
  "factorMaxNumerator" <= 1000000000 AND "factorMaxDenominator" <= 1000000000
);
ALTER TABLE "IngredientConversionEvidence" ADD CONSTRAINT "IngredientConversionEvidence_ordered_factor_range" CHECK (
  "factorMinNumerator"::bigint * "factorMaxDenominator"::bigint <=
  "factorMaxNumerator"::bigint * "factorMinDenominator"::bigint
);
ALTER TABLE "IngredientConversionEvidence" ADD CONSTRAINT "IngredientConversionEvidence_period_order" CHECK (
  ("observedFrom" IS NULL OR "observedTo" IS NULL OR "observedFrom" <= "observedTo") AND
  ("effectiveFrom" IS NULL OR "effectiveUntil" IS NULL OR "effectiveFrom" <= "effectiveUntil")
);
ALTER TABLE "IngredientConversionEvidence" ADD CONSTRAINT "IngredientConversionEvidence_review_shape" CHECK (
  ("reviewStatus" IN ('REVIEWED', 'REJECTED') AND "reviewedAt" IS NOT NULL AND "reviewerReference" IS NOT NULL AND length(btrim("reviewerReference")) > 0) OR
  ("reviewStatus" = 'DRAFT' AND "reviewedAt" IS NULL AND "reviewerReference" IS NULL)
);
ALTER TABLE "IngredientConversionEvidence" ADD CONSTRAINT "IngredientConversionEvidence_no_self_supersession" CHECK (
  "supersedesEvidenceId" IS NULL OR "supersedesEvidenceId" <> "id"
);
ALTER TABLE "IngredientConversionEvidence" ADD CONSTRAINT "IngredientConversionEvidence_identity_shape" CHECK (
  length(btrim("fromFoodIdentity")) > 0 AND length(btrim("toFoodIdentity")) > 0 AND
  length(btrim("fromPreparationCode")) > 0 AND length(btrim("toPreparationCode")) > 0 AND
  (("fromBasis" = 'PURCHASED_AS_SOLD' AND "fromPriceCommodityId" IS NOT NULL) OR
   ("fromBasis" <> 'PURCHASED_AS_SOLD' AND "fromPriceCommodityId" IS NULL AND "fromFoodItemId" IS NOT NULL)) AND
  (("toBasis" = 'PURCHASED_AS_SOLD' AND "fromPriceCommodityId" IS NOT NULL) OR
   ("toBasis" <> 'PURCHASED_AS_SOLD' AND "toFoodItemId" IS NOT NULL))
);
ALTER TABLE "IngredientConversionEvidence" ADD CONSTRAINT "IngredientConversionEvidence_kind_shape" CHECK (
  (
    "kind" = 'PURCHASED_TO_RAW_YIELD' AND "fromBasis" = 'PURCHASED_AS_SOLD' AND "toBasis" = 'RAW_EDIBLE' AND
    "fromUnit" IN ('MILLIGRAM','GRAM','KILOGRAM') AND "toUnit" IN ('MILLIGRAM','GRAM','KILOGRAM') AND
    "factorMaxNumerator"::bigint <= "factorMaxDenominator"::bigint
  ) OR (
    "kind" = 'RAW_TO_COOKED_YIELD' AND "fromBasis" = 'RAW_EDIBLE' AND "toBasis" = 'COOKED_EDIBLE' AND
    "fromUnit" IN ('MILLIGRAM','GRAM','KILOGRAM') AND "toUnit" IN ('MILLIGRAM','GRAM','KILOGRAM') AND
    "factorMinNumerator"::bigint * 20 >= "factorMinDenominator"::bigint AND
    "factorMaxNumerator"::bigint <= "factorMaxDenominator"::bigint * 10
  ) OR (
    "kind" = 'PURCHASED_TO_COOKED_YIELD' AND "fromBasis" = 'PURCHASED_AS_SOLD' AND "toBasis" = 'COOKED_EDIBLE' AND
    "fromUnit" IN ('MILLIGRAM','GRAM','KILOGRAM') AND "toUnit" IN ('MILLIGRAM','GRAM','KILOGRAM') AND
    "factorMinNumerator"::bigint * 20 >= "factorMinDenominator"::bigint AND
    "factorMaxNumerator"::bigint <= "factorMaxDenominator"::bigint * 10
  ) OR (
    "kind" = 'HOUSEHOLD_MEASURE_TO_MASS' AND "fromBasis" = "toBasis" AND
    "fromUnit" IN ('MILLILITER','LITER','TEASPOON','TABLESPOON','CUP','PIECE') AND
    "toUnit" IN ('MILLIGRAM','GRAM','KILOGRAM')
  )
);

ALTER TABLE "IngredientConversionEvidence" ADD CONSTRAINT "IngredientConversionEvidence_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "IngredientConversionSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IngredientConversionEvidence" ADD CONSTRAINT "IngredientConversionEvidence_fromFoodItemId_fkey" FOREIGN KEY ("fromFoodItemId") REFERENCES "FoodItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IngredientConversionEvidence" ADD CONSTRAINT "IngredientConversionEvidence_toFoodItemId_fkey" FOREIGN KEY ("toFoodItemId") REFERENCES "FoodItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IngredientConversionEvidence" ADD CONSTRAINT "IngredientConversionEvidence_fromPriceCommodityId_fkey" FOREIGN KEY ("fromPriceCommodityId") REFERENCES "IngredientPriceCommodity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IngredientConversionEvidence" ADD CONSTRAINT "IngredientConversionEvidence_supersedesEvidenceId_fkey" FOREIGN KEY ("supersedesEvidenceId") REFERENCES "IngredientConversionEvidence"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "IngredientConversionEvidence_reject_mutation"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ingredient conversion evidence is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "IngredientConversionEvidence_require_usable_source"()
RETURNS trigger AS $$
DECLARE source_status "IngredientConversionRedistributionStatus";
BEGIN
  SELECT "redistributionStatus" INTO source_status FROM "IngredientConversionSource" WHERE "id" = NEW."sourceId";
  IF source_status NOT IN ('REDISTRIBUTABLE', 'AUTHORIZED_INTERNAL_USE') THEN
    RAISE EXCEPTION 'conversion factors require reviewed source-use rights';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "IngredientConversionEvidence_usable_source_only"
BEFORE INSERT ON "IngredientConversionEvidence"
FOR EACH ROW EXECUTE FUNCTION "IngredientConversionEvidence_require_usable_source"();

CREATE TRIGGER "IngredientConversionSource_append_only"
BEFORE UPDATE OR DELETE ON "IngredientConversionSource"
FOR EACH ROW EXECUTE FUNCTION "IngredientConversionEvidence_reject_mutation"();
CREATE TRIGGER "IngredientConversionEvidence_append_only"
BEFORE UPDATE OR DELETE ON "IngredientConversionEvidence"
FOR EACH ROW EXECUTE FUNCTION "IngredientConversionEvidence_reject_mutation"();
