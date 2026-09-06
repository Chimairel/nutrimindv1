\set ON_ERROR_STOP on
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.expect_failure(statement_name text, statement_sql text, expected_state text, expected_constraint text DEFAULT NULL)
RETURNS void AS $$
BEGIN
  BEGIN
    EXECUTE statement_sql;
    RAISE EXCEPTION 'expected % to fail', statement_name;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> expected_state THEN RAISE; END IF;
    IF expected_constraint IS NOT NULL AND SQLERRM NOT LIKE '%' || expected_constraint || '%' THEN
      RAISE EXCEPTION '% failed with unexpected message: %', statement_name, SQLERRM;
    END IF;
  END;
END;
$$ LANGUAGE plpgsql;

DO $empty$
BEGIN
  IF (SELECT count(*) FROM "IngredientConversionSource") <> 0 OR
     (SELECT count(*) FROM "IngredientConversionEvidence") <> 0 THEN
    RAISE EXCEPTION 'new conversion tables must be empty after migration';
  END IF;
END
$empty$;

INSERT INTO "FoodItem" ("id","name","calories","proteinG","carbsG","fatG","source") VALUES
  ('conversion-raw-food','Synthetic raw carrot',1,0,0,0,'SYNTHETIC_REHEARSAL'),
  ('conversion-cooked-food','Synthetic boiled carrot',1,0,0,0,'SYNTHETIC_REHEARSAL');

INSERT INTO "IngredientPriceSource" (
  "id","code","kind","agencyName","datasetName","homepageUrl","attributionText","accessMethod","automationStatus"
) VALUES (
  'conversion-price-source','SYNTHETIC_CONVERSION_PRICE','OTHER_OFFICIAL','Synthetic local agency','Synthetic local prices',
  'https://example.invalid/prices','Synthetic rehearsal only','DOWNLOAD','MANUAL_ONLY'
);
INSERT INTO "IngredientPriceCommodity" (
  "id","sourceId","sourceCommodityKey","originalDescription","originalUnit","normalizedQuantity","normalizedUnit"
) VALUES (
  'conversion-price-commodity','conversion-price-source','synthetic-carrot','Synthetic carrot as sold','1 kg',1,'KILOGRAM'
);

INSERT INTO "IngredientConversionSource" (
  "id","code","agencyName","publicationTitle","sourceUrl","termsUrl","versionLabel","accessedAt",
  "geographyApplicability","methodology","licenseCode","redistributionStatus","attributionText","contentSha256"
) VALUES (
  'conversion-source-v1','SYNTHETIC_CONVERSION_SOURCE','Synthetic local agency','Synthetic yield table',
  'https://example.invalid/yields','https://example.invalid/terms','v1','2026-09-06T00:00:00Z',
  'Synthetic local rehearsal','Synthetic exact weighed input and output','TEST-ONLY','REDISTRIBUTABLE',
  'Synthetic rehearsal only',repeat('a',64)
);

INSERT INTO "IngredientConversionEvidence" (
  "id","sourceId","externalEvidenceKey","evidenceVersion","kind","fromBasis","toBasis","direction",
  "fromFoodIdentity","toFoodIdentity","fromFoodItemId","toFoodItemId","fromPriceCommodityId",
  "fromPreparationCode","toPreparationCode","fromUnit","toUnit",
  "factorMinNumerator","factorMinDenominator","factorMaxNumerator","factorMaxDenominator","uncertaintyNote",
  "effectiveFrom","effectiveUntil","reviewStatus","reviewedAt","reviewerReference"
) VALUES (
  'conversion-evidence-v1','conversion-source-v1','synthetic-carrot-ap-raw','v1','PURCHASED_TO_RAW_YIELD',
  'PURCHASED_AS_SOLD','RAW_EDIBLE','BIDIRECTIONAL','Synthetic carrot as sold','Synthetic raw carrot',
  NULL,'conversion-raw-food','conversion-price-commodity','FRESH_WHOLE_AS_SOLD','TRIMMED_PEELED','KILOGRAM','GRAM',
  4,5,17,20,'Synthetic bounded range','2026-01-01','2026-12-31','REVIEWED','2026-09-06','synthetic-review-v1'
);
INSERT INTO "IngredientConversionEvidence" (
  "id","sourceId","externalEvidenceKey","evidenceVersion","kind","fromBasis","toBasis",
  "fromFoodIdentity","toFoodIdentity","fromFoodItemId","toFoodItemId","fromPreparationCode","toPreparationCode",
  "fromUnit","toUnit","factorMinNumerator","factorMinDenominator","factorMaxNumerator","factorMaxDenominator",
  "uncertaintyNote","reviewStatus","reviewedAt","reviewerReference","supersedesEvidenceId"
) VALUES (
  'conversion-evidence-v2','conversion-source-v1','synthetic-carrot-raw-cooked','v2','RAW_TO_COOKED_YIELD',
  'RAW_EDIBLE','COOKED_EDIBLE','Synthetic raw carrot','Synthetic boiled carrot','conversion-raw-food','conversion-cooked-food',
  'TRIMMED_PEELED','BOILED_DRAINED','GRAM','GRAM',9,10,1,1,'Synthetic bounded range',
  'REVIEWED','2026-09-06','synthetic-review-v2',NULL
);

SELECT pg_temp.expect_failure(
  'metadata-only source cannot carry factors',
  $sql$WITH s AS (
    INSERT INTO "IngredientConversionSource" ("id","code","agencyName","publicationTitle","sourceUrl","versionLabel","accessedAt","geographyApplicability","methodology","redistributionStatus","attributionText")
    VALUES ('metadata-source','METADATA_ONLY_SOURCE','Synthetic','Abstract only','https://example.invalid/abstract','v1','2026-09-06','Synthetic','Abstract','METADATA_ONLY','Synthetic') RETURNING "id"
  ) INSERT INTO "IngredientConversionEvidence" ("id","sourceId","externalEvidenceKey","evidenceVersion","kind","fromBasis","toBasis","fromFoodIdentity","toFoodIdentity","toFoodItemId","fromPriceCommodityId","fromPreparationCode","toPreparationCode","fromUnit","toUnit","factorMinNumerator","factorMinDenominator","factorMaxNumerator","factorMaxDenominator","uncertaintyNote")
  SELECT 'bad-license',"id",'bad','v1','PURCHASED_TO_RAW_YIELD','PURCHASED_AS_SOLD','RAW_EDIBLE','Bad','Bad','conversion-raw-food','conversion-price-commodity','AS_SOLD','RAW','GRAM','GRAM',1,2,1,2,'Bad' FROM s$sql$,
  'P0001','conversion factors require reviewed source-use rights'
);
SELECT pg_temp.expect_failure(
  'factor must be positive',
  $sql$INSERT INTO "IngredientConversionEvidence" ("id","sourceId","externalEvidenceKey","evidenceVersion","kind","fromBasis","toBasis","fromFoodIdentity","toFoodIdentity","toFoodItemId","fromPriceCommodityId","fromPreparationCode","toPreparationCode","fromUnit","toUnit","factorMinNumerator","factorMinDenominator","factorMaxNumerator","factorMaxDenominator","uncertaintyNote") VALUES ('bad-zero','conversion-source-v1','bad-zero','v1','PURCHASED_TO_RAW_YIELD','PURCHASED_AS_SOLD','RAW_EDIBLE','Bad','Bad','conversion-raw-food','conversion-price-commodity','AS_SOLD','RAW','GRAM','GRAM',0,1,1,2,'Bad')$sql$,
  '23514','IngredientConversionEvidence_positive_factors'
);
SELECT pg_temp.expect_failure(
  'AP yield cannot exceed one',
  $sql$INSERT INTO "IngredientConversionEvidence" ("id","sourceId","externalEvidenceKey","evidenceVersion","kind","fromBasis","toBasis","fromFoodIdentity","toFoodIdentity","toFoodItemId","fromPriceCommodityId","fromPreparationCode","toPreparationCode","fromUnit","toUnit","factorMinNumerator","factorMinDenominator","factorMaxNumerator","factorMaxDenominator","uncertaintyNote") VALUES ('bad-yield','conversion-source-v1','bad-yield','v1','PURCHASED_TO_RAW_YIELD','PURCHASED_AS_SOLD','RAW_EDIBLE','Bad','Bad','conversion-raw-food','conversion-price-commodity','AS_SOLD','RAW','GRAM','GRAM',1,1,2,1,'Bad')$sql$,
  '23514','IngredientConversionEvidence_kind_shape'
);
SELECT pg_temp.expect_failure(
  'review requires reviewer evidence',
  $sql$INSERT INTO "IngredientConversionEvidence" ("id","sourceId","externalEvidenceKey","evidenceVersion","kind","fromBasis","toBasis","fromFoodIdentity","toFoodIdentity","toFoodItemId","fromPriceCommodityId","fromPreparationCode","toPreparationCode","fromUnit","toUnit","factorMinNumerator","factorMinDenominator","factorMaxNumerator","factorMaxDenominator","uncertaintyNote","reviewStatus") VALUES ('bad-review','conversion-source-v1','bad-review','v1','PURCHASED_TO_RAW_YIELD','PURCHASED_AS_SOLD','RAW_EDIBLE','Bad','Bad','conversion-raw-food','conversion-price-commodity','AS_SOLD','RAW','GRAM','GRAM',1,2,1,2,'Bad','REVIEWED')$sql$,
  '23514','IngredientConversionEvidence_review_shape'
);
SELECT pg_temp.expect_failure(
  'evidence identity is unique per source version',
  $sql$INSERT INTO "IngredientConversionEvidence" ("id","sourceId","externalEvidenceKey","evidenceVersion","kind","fromBasis","toBasis","fromFoodIdentity","toFoodIdentity","toFoodItemId","fromPriceCommodityId","fromPreparationCode","toPreparationCode","fromUnit","toUnit","factorMinNumerator","factorMinDenominator","factorMaxNumerator","factorMaxDenominator","uncertaintyNote") VALUES ('bad-duplicate','conversion-source-v1','synthetic-carrot-ap-raw','v1','PURCHASED_TO_RAW_YIELD','PURCHASED_AS_SOLD','RAW_EDIBLE','Bad','Bad','conversion-raw-food','conversion-price-commodity','AS_SOLD','RAW','GRAM','GRAM',1,2,1,2,'Bad')$sql$,
  '23505','IngredientConversionEvidence_sourceId_externalEvidenceKey_e_key'
);
SELECT pg_temp.expect_failure(
  'conversion source is append-only',
  $sql$UPDATE "IngredientConversionSource" SET "versionLabel"='changed' WHERE "id"='conversion-source-v1'$sql$,
  'P0001','ingredient conversion evidence is append-only'
);
SELECT pg_temp.expect_failure(
  'conversion evidence is append-only',
  $sql$DELETE FROM "IngredientConversionEvidence" WHERE "id"='conversion-evidence-v1'$sql$,
  'P0001','ingredient conversion evidence is append-only'
);

DO $audit$
BEGIN
  IF (SELECT count(*) FROM "IngredientConversionSource" WHERE "id"='conversion-source-v1') <> 1 THEN
    RAISE EXCEPTION 'expected source';
  END IF;
  IF (SELECT count(*) FROM "IngredientConversionEvidence") <> 2 THEN
    RAISE EXCEPTION 'expected two valid evidence revisions';
  END IF;
END
$audit$;

SELECT 'ingredient_conversion_rehearsal_probes_passed' AS result;
ROLLBACK;
