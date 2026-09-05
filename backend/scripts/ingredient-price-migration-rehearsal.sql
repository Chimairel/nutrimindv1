\set ON_ERROR_STOP on

-- Local-only destructive probe suite for the disposable ingredient-price
-- migration rehearsal. The caller must provide the synthetic FoodItem
-- `price-rehearsal-food`; every write below is rolled back.
BEGIN;

CREATE FUNCTION pg_temp.expect_failure(
  case_name text,
  statement_text text,
  expected_state text,
  expected_constraint text DEFAULT NULL
) RETURNS void AS $$
DECLARE
  actual_state text;
  actual_constraint text;
BEGIN
  BEGIN
    EXECUTE statement_text;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      actual_state = RETURNED_SQLSTATE,
      actual_constraint = CONSTRAINT_NAME;
    IF actual_state <> expected_state THEN
      RAISE EXCEPTION '% returned SQLSTATE %, expected %', case_name, actual_state, expected_state;
    END IF;
    IF expected_constraint IS NOT NULL AND actual_constraint IS DISTINCT FROM expected_constraint THEN
      RAISE EXCEPTION '% returned constraint %, expected %', case_name, actual_constraint, expected_constraint;
    END IF;
    RETURN;
  END;
  RAISE EXCEPTION '% unexpectedly accepted invalid operation', case_name;
END;
$$ LANGUAGE plpgsql;

INSERT INTO "IngredientPriceSource" (
  "id", "code", "kind", "agencyName", "datasetName", "homepageUrl",
  "apiBaseUrl", "termsUrl", "licenseCode", "attributionText",
  "accessMethod", "automationStatus", "updateCadence", "createdAt"
) VALUES (
  'price-source-v1', 'SYNTHETIC_LOCAL_PRICE_SOURCE_V1', 'PSA_OPENSTAT',
  'Synthetic local agency', 'Synthetic local dataset', 'https://example.invalid/source',
  'https://example.invalid/api', 'https://example.invalid/terms', 'TEST-ONLY',
  'Synthetic local rehearsal only', 'API', 'SUPPORTED', 'TEST',
  '2026-09-06T00:00:00Z'
);

SELECT pg_temp.expect_failure(
  'source requires HTTPS',
  $sql$INSERT INTO "IngredientPriceSource" ("id","code","kind","agencyName","datasetName","homepageUrl","attributionText","accessMethod","automationStatus") VALUES ('bad-source-http','BAD_SOURCE_HTTP','OTHER_OFFICIAL','Synthetic','Synthetic','http://example.invalid','Synthetic','DOWNLOAD','MANUAL_ONLY')$sql$,
  '23514', 'IngredientPriceSource_https_urls'
);
SELECT pg_temp.expect_failure(
  'supported automation requires API details',
  $sql$INSERT INTO "IngredientPriceSource" ("id","code","kind","agencyName","datasetName","homepageUrl","attributionText","accessMethod","automationStatus") VALUES ('bad-source-auto','BAD_SOURCE_AUTO','OTHER_OFFICIAL','Synthetic','Synthetic','https://example.invalid','Synthetic','DOWNLOAD','SUPPORTED')$sql$,
  '23514', 'IngredientPriceSource_automation_shape'
);
SELECT pg_temp.expect_failure(
  'source code identity is unique',
  $sql$INSERT INTO "IngredientPriceSource" ("id","code","kind","agencyName","datasetName","homepageUrl","attributionText","accessMethod","automationStatus") VALUES ('bad-source-duplicate','SYNTHETIC_LOCAL_PRICE_SOURCE_V1','OTHER_OFFICIAL','Synthetic','Synthetic','https://example.invalid','Synthetic','DOWNLOAD','MANUAL_ONLY')$sql$,
  '23505', 'IngredientPriceSource_code_key'
);

INSERT INTO "IngredientPriceGeography" ("id","scheme","externalCode","displayName","level","createdAt")
VALUES ('price-geo-national','SYNTHETIC_GEO_V1','PH','Synthetic Philippines','NATIONAL','2026-09-06T00:00:00Z');
INSERT INTO "IngredientPriceGeography" ("id","scheme","externalCode","displayName","level","parentId","createdAt")
VALUES ('price-geo-region','SYNTHETIC_GEO_V1','PH-R','Synthetic Region','REGION','price-geo-national','2026-09-06T00:00:00Z');
INSERT INTO "IngredientPriceGeography" ("id","scheme","externalCode","displayName","level","parentId","createdAt")
VALUES ('price-geo-city','SYNTHETIC_GEO_V1','PH-R-C','Synthetic City','CITY','price-geo-region','2026-09-06T00:00:00Z');

SELECT pg_temp.expect_failure(
  'geography parent must exist',
  $sql$INSERT INTO "IngredientPriceGeography" ("id","scheme","externalCode","displayName","level","parentId") VALUES ('bad-geo-parent','SYNTHETIC_GEO_V1','BAD-PARENT','Bad','CITY','missing-parent')$sql$,
  '23503', 'IngredientPriceGeography_parentId_fkey'
);
SELECT pg_temp.expect_failure(
  'geography scheme and external code are unique',
  $sql$INSERT INTO "IngredientPriceGeography" ("id","scheme","externalCode","displayName","level") VALUES ('bad-geo-duplicate','SYNTHETIC_GEO_V1','PH-R-C','Duplicate','CITY')$sql$,
  '23505', 'IngredientPriceGeography_scheme_externalCode_key'
);

INSERT INTO "IngredientPricePublication" (
  "id", "sourceId", "externalPublicationId", "sourceUrl", "publishedAt",
  "periodStart", "periodEnd", "retrievedAt", "contentSha256", "metadata", "createdAt"
) VALUES (
  'price-publication-v1', 'price-source-v1', 'synthetic-publication-v1',
  'https://example.invalid/publication-v1', '2026-09-01T00:00:00Z',
  '2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z', '2026-09-06T00:00:00Z',
  repeat('a', 64), '{"synthetic":true}'::jsonb, '2026-09-06T00:00:00Z'
);

SELECT pg_temp.expect_failure(
  'publication period is ordered',
  $sql$INSERT INTO "IngredientPricePublication" ("id","sourceId","externalPublicationId","sourceUrl","periodStart","periodEnd","retrievedAt") VALUES ('bad-publication-period','price-source-v1','bad-period','https://example.invalid/bad','2026-09-01','2026-08-01','2026-09-06')$sql$,
  '23514', 'IngredientPricePublication_period_order'
);
SELECT pg_temp.expect_failure(
  'publication hash is lowercase SHA-256',
  $sql$INSERT INTO "IngredientPricePublication" ("id","sourceId","externalPublicationId","sourceUrl","retrievedAt","contentSha256") VALUES ('bad-publication-hash','price-source-v1','bad-hash','https://example.invalid/bad','2026-09-06','ABC')$sql$,
  '23514', 'IngredientPricePublication_sha256_shape'
);
SELECT pg_temp.expect_failure(
  'publication source URL requires HTTPS',
  $sql$INSERT INTO "IngredientPricePublication" ("id","sourceId","externalPublicationId","sourceUrl","retrievedAt") VALUES ('bad-publication-url','price-source-v1','bad-url','http://example.invalid/bad','2026-09-06')$sql$,
  '23514', 'IngredientPricePublication_https_source'
);
SELECT pg_temp.expect_failure(
  'publication snapshot identity is unique',
  $sql$INSERT INTO "IngredientPricePublication" ("id","sourceId","externalPublicationId","sourceUrl","retrievedAt") VALUES ('bad-publication-duplicate','price-source-v1','synthetic-publication-v1','https://example.invalid/duplicate','2026-09-06T00:00:00Z')$sql$,
  '23505', 'IngredientPricePublication_sourceId_externalPublicationId_r_key'
);

INSERT INTO "IngredientPriceCommodity" (
  "id", "sourceId", "sourceCommodityKey", "originalDescription", "originalSpecification",
  "originalUnit", "normalizedQuantity", "normalizedUnit", "createdAt"
) VALUES (
  'price-commodity-v1', 'price-source-v1', 'synthetic-commodity-v1',
  'Synthetic rehearsal food', 'Synthetic specification', '1 kg', 1, 'KILOGRAM',
  '2026-09-06T00:00:00Z'
);

SELECT pg_temp.expect_failure(
  'commodity normalization is all or none',
  $sql$INSERT INTO "IngredientPriceCommodity" ("id","sourceId","sourceCommodityKey","originalDescription","originalUnit","normalizedQuantity") VALUES ('bad-commodity-half','price-source-v1','bad-half','Bad','1 kg',1)$sql$,
  '23514'
);
SELECT pg_temp.expect_failure(
  'commodity unit without quantity is rejected',
  $sql$INSERT INTO "IngredientPriceCommodity" ("id","sourceId","sourceCommodityKey","originalDescription","originalUnit","normalizedUnit") VALUES ('bad-commodity-unit-only','price-source-v1','bad-unit-only','Bad','1 kg','KILOGRAM')$sql$,
  '23514', 'IngredientPriceCommodity_normalization_pair_strict'
);
SELECT pg_temp.expect_failure(
  'commodity normalized quantity is positive',
  $sql$INSERT INTO "IngredientPriceCommodity" ("id","sourceId","sourceCommodityKey","originalDescription","originalUnit","normalizedQuantity","normalizedUnit") VALUES ('bad-commodity-zero','price-source-v1','bad-zero','Bad','1 kg',0,'KILOGRAM')$sql$,
  '23514'
);
SELECT pg_temp.expect_failure(
  'source commodity identity is unique',
  $sql$INSERT INTO "IngredientPriceCommodity" ("id","sourceId","sourceCommodityKey","originalDescription","originalUnit") VALUES ('bad-commodity-duplicate','price-source-v1','synthetic-commodity-v1','Duplicate','1 kg')$sql$,
  '23505', 'IngredientPriceCommodity_sourceId_sourceCommodityKey_key'
);

INSERT INTO "IngredientPriceCommodityMapping" (
  "id", "commodityId", "state", "foodItemId", "evidenceKind", "evidenceReference", "rationale", "createdAt"
) VALUES (
  'price-mapping-v1', 'price-commodity-v1', 'EXACT', 'price-rehearsal-food',
  'REVIEWED_EXACT_DESCRIPTION', 'synthetic-review-v1', 'Synthetic exact rehearsal mapping',
  '2026-09-06T00:00:00Z'
);
INSERT INTO "IngredientPriceCommodityMapping" (
  "id", "commodityId", "state", "foodItemId", "evidenceKind", "evidenceReference",
  "rationale", "supersedesMappingId", "createdAt"
) VALUES (
  'price-mapping-v2', 'price-commodity-v1', 'EXACT', 'price-rehearsal-food',
  'EXTERNAL_IDENTIFIER', 'synthetic-review-v2', 'Synthetic superseding mapping',
  'price-mapping-v1', '2026-09-06T00:01:00Z'
);

SELECT pg_temp.expect_failure(
  'exact mapping requires FNRI food',
  $sql$INSERT INTO "IngredientPriceCommodityMapping" ("id","commodityId","state","evidenceKind","evidenceReference","rationale") VALUES ('bad-map-no-food','price-commodity-v1','EXACT','REVIEWED_EXACT_DESCRIPTION','review','Bad')$sql$,
  '23514', 'IngredientPriceCommodityMapping_state_shape'
);
SELECT pg_temp.expect_failure(
  'exact mapping requires exact evidence kind',
  $sql$INSERT INTO "IngredientPriceCommodityMapping" ("id","commodityId","state","foodItemId","evidenceKind","evidenceReference","rationale") VALUES ('bad-map-kind','price-commodity-v1','EXACT','price-rehearsal-food','CANDIDATE_ONLY','review','Bad')$sql$,
  '23514', 'IngredientPriceCommodityMapping_state_shape'
);
SELECT pg_temp.expect_failure(
  'unmapped state cannot point to FNRI food',
  $sql$INSERT INTO "IngredientPriceCommodityMapping" ("id","commodityId","state","foodItemId","evidenceKind","rationale") VALUES ('bad-map-unmapped-food','price-commodity-v1','UNMAPPED','price-rehearsal-food','CANDIDATE_ONLY','Bad')$sql$,
  '23514', 'IngredientPriceCommodityMapping_state_shape'
);
SELECT pg_temp.expect_failure(
  'mapping cannot supersede itself',
  $sql$INSERT INTO "IngredientPriceCommodityMapping" ("id","commodityId","state","evidenceKind","rationale","supersedesMappingId") VALUES ('bad-map-self','price-commodity-v1','UNMAPPED','CANDIDATE_ONLY','Bad','bad-map-self')$sql$,
  '23514', 'IngredientPriceCommodityMapping_no_self_supersession'
);
SELECT pg_temp.expect_failure(
  'one mapping can be superseded only once',
  $sql$INSERT INTO "IngredientPriceCommodityMapping" ("id","commodityId","state","foodItemId","evidenceKind","evidenceReference","rationale","supersedesMappingId") VALUES ('bad-map-branch','price-commodity-v1','EXACT','price-rehearsal-food','EXTERNAL_IDENTIFIER','review','Bad','price-mapping-v1')$sql$,
  '23505', 'IngredientPriceCommodityMapping_supersedesMappingId_key'
);
SELECT pg_temp.expect_failure(
  'mapping food link is restrictive',
  $sql$DELETE FROM "FoodItem" WHERE "id"='price-rehearsal-food'$sql$,
  '23503', 'IngredientPriceCommodityMapping_foodItemId_fkey'
);

INSERT INTO "IngredientPriceObservation" (
  "id", "publicationId", "commodityId", "geographyId", "sourceObservationKey", "kind",
  "currency", "amountMinCentavos", "amountMaxCentavos", "observedFrom", "observedTo",
  "validFrom", "validUntil", "originalCommodityDescription", "originalSpecification",
  "originalUnit", "normalizedQuantity", "normalizedUnit", "createdAt"
) VALUES (
  'price-observation-v1', 'price-publication-v1', 'price-commodity-v1', 'price-geo-city',
  'synthetic-observation-v1', 'AVERAGE_RETAIL', 'PHP', 5000, 6000,
  '2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z', '2026-09-01T00:00:00Z',
  '2026-09-30T00:00:00Z', 'Synthetic rehearsal food', 'Synthetic specification',
  '1 kg', 1, 'KILOGRAM', '2026-09-06T00:00:00Z'
);
INSERT INTO "IngredientPriceObservation" (
  "id", "publicationId", "commodityId", "geographyId", "sourceObservationKey", "kind",
  "currency", "amountMinCentavos", "amountMaxCentavos", "observedFrom", "observedTo",
  "originalCommodityDescription", "originalUnit", "normalizedQuantity", "normalizedUnit",
  "supersedesObservationId", "createdAt"
) VALUES (
  'price-observation-v2', 'price-publication-v1', 'price-commodity-v1', 'price-geo-city',
  'synthetic-observation-v2', 'OBSERVED_RANGE', 'PHP', 5100, 6100,
  '2026-08-01T00:00:00Z', '2026-08-31T00:00:00Z', 'Synthetic rehearsal food',
  '1 kg', 1, 'KILOGRAM', 'price-observation-v1', '2026-09-06T00:01:00Z'
);

SELECT pg_temp.expect_failure(
  'integer centavos reject fractional text',
  $sql$INSERT INTO "IngredientPriceObservation" ("id","publicationId","commodityId","geographyId","sourceObservationKey","kind","amountMinCentavos","amountMaxCentavos","observedFrom","observedTo","originalCommodityDescription","originalUnit") VALUES ('bad-obs-fraction','price-publication-v1','price-commodity-v1','price-geo-city','bad-fraction','AVERAGE_RETAIL','1.5',2,'2026-08-01','2026-08-31','Bad','kg')$sql$,
  '22P02'
);
SELECT pg_temp.expect_failure(
  'observation requires PHP',
  $sql$INSERT INTO "IngredientPriceObservation" ("id","publicationId","commodityId","geographyId","sourceObservationKey","kind","currency","amountMinCentavos","amountMaxCentavos","observedFrom","observedTo","originalCommodityDescription","originalUnit") VALUES ('bad-obs-currency','price-publication-v1','price-commodity-v1','price-geo-city','bad-currency','AVERAGE_RETAIL','USD',1,2,'2026-08-01','2026-08-31','Bad','kg')$sql$,
  '23514', 'IngredientPriceObservation_money_range'
);
SELECT pg_temp.expect_failure(
  'observation price is positive',
  $sql$INSERT INTO "IngredientPriceObservation" ("id","publicationId","commodityId","geographyId","sourceObservationKey","kind","amountMinCentavos","amountMaxCentavos","observedFrom","observedTo","originalCommodityDescription","originalUnit") VALUES ('bad-obs-zero','price-publication-v1','price-commodity-v1','price-geo-city','bad-zero','AVERAGE_RETAIL',0,2,'2026-08-01','2026-08-31','Bad','kg')$sql$,
  '23514', 'IngredientPriceObservation_money_range'
);
SELECT pg_temp.expect_failure(
  'observation range is ordered',
  $sql$INSERT INTO "IngredientPriceObservation" ("id","publicationId","commodityId","geographyId","sourceObservationKey","kind","amountMinCentavos","amountMaxCentavos","observedFrom","observedTo","originalCommodityDescription","originalUnit") VALUES ('bad-obs-range','price-publication-v1','price-commodity-v1','price-geo-city','bad-range','AVERAGE_RETAIL',3,2,'2026-08-01','2026-08-31','Bad','kg')$sql$,
  '23514', 'IngredientPriceObservation_money_range'
);
SELECT pg_temp.expect_failure(
  'observation dates are ordered',
  $sql$INSERT INTO "IngredientPriceObservation" ("id","publicationId","commodityId","geographyId","sourceObservationKey","kind","amountMinCentavos","amountMaxCentavos","observedFrom","observedTo","originalCommodityDescription","originalUnit") VALUES ('bad-obs-dates','price-publication-v1','price-commodity-v1','price-geo-city','bad-dates','AVERAGE_RETAIL',1,2,'2026-09-01','2026-08-01','Bad','kg')$sql$,
  '23514', 'IngredientPriceObservation_period_order'
);
SELECT pg_temp.expect_failure(
  'observation validity is ordered',
  $sql$INSERT INTO "IngredientPriceObservation" ("id","publicationId","commodityId","geographyId","sourceObservationKey","kind","amountMinCentavos","amountMaxCentavos","observedFrom","observedTo","validFrom","validUntil","originalCommodityDescription","originalUnit") VALUES ('bad-obs-validity','price-publication-v1','price-commodity-v1','price-geo-city','bad-validity','AVERAGE_RETAIL',1,2,'2026-08-01','2026-08-31','2026-10-01','2026-09-01','Bad','kg')$sql$,
  '23514', 'IngredientPriceObservation_period_order'
);
SELECT pg_temp.expect_failure(
  'observation normalization is all or none',
  $sql$INSERT INTO "IngredientPriceObservation" ("id","publicationId","commodityId","geographyId","sourceObservationKey","kind","amountMinCentavos","amountMaxCentavos","observedFrom","observedTo","originalCommodityDescription","originalUnit","normalizedUnit") VALUES ('bad-obs-half','price-publication-v1','price-commodity-v1','price-geo-city','bad-half','AVERAGE_RETAIL',1,2,'2026-08-01','2026-08-31','Bad','kg','KILOGRAM')$sql$,
  '23514', 'IngredientPriceObservation_normalization_pair_strict'
);
SELECT pg_temp.expect_failure(
  'observation normalized quantity is positive',
  $sql$INSERT INTO "IngredientPriceObservation" ("id","publicationId","commodityId","geographyId","sourceObservationKey","kind","amountMinCentavos","amountMaxCentavos","observedFrom","observedTo","originalCommodityDescription","originalUnit","normalizedQuantity","normalizedUnit") VALUES ('bad-obs-normalized-zero','price-publication-v1','price-commodity-v1','price-geo-city','bad-normalized-zero','AVERAGE_RETAIL',1,2,'2026-08-01','2026-08-31','Bad','kg',0,'KILOGRAM')$sql$,
  '23514'
);
SELECT pg_temp.expect_failure(
  'observation cannot supersede itself',
  $sql$INSERT INTO "IngredientPriceObservation" ("id","publicationId","commodityId","geographyId","sourceObservationKey","kind","amountMinCentavos","amountMaxCentavos","observedFrom","observedTo","originalCommodityDescription","originalUnit","supersedesObservationId") VALUES ('bad-obs-self','price-publication-v1','price-commodity-v1','price-geo-city','bad-self','AVERAGE_RETAIL',1,2,'2026-08-01','2026-08-31','Bad','kg','bad-obs-self')$sql$,
  '23514', 'IngredientPriceObservation_no_self_supersession'
);
SELECT pg_temp.expect_failure(
  'publication observation identity is unique',
  $sql$INSERT INTO "IngredientPriceObservation" ("id","publicationId","commodityId","geographyId","sourceObservationKey","kind","amountMinCentavos","amountMaxCentavos","observedFrom","observedTo","originalCommodityDescription","originalUnit") VALUES ('bad-obs-duplicate','price-publication-v1','price-commodity-v1','price-geo-city','synthetic-observation-v1','AVERAGE_RETAIL',1,2,'2026-08-01','2026-08-31','Bad','kg')$sql$,
  '23505', 'IngredientPriceObservation_publicationId_sourceObservationK_key'
);
SELECT pg_temp.expect_failure(
  'one observation can be superseded only once',
  $sql$INSERT INTO "IngredientPriceObservation" ("id","publicationId","commodityId","geographyId","sourceObservationKey","kind","amountMinCentavos","amountMaxCentavos","observedFrom","observedTo","originalCommodityDescription","originalUnit","supersedesObservationId") VALUES ('bad-obs-branch','price-publication-v1','price-commodity-v1','price-geo-city','bad-branch','AVERAGE_RETAIL',1,2,'2026-08-01','2026-08-31','Bad','kg','price-observation-v1')$sql$,
  '23505', 'IngredientPriceObservation_supersedesObservationId_key'
);
SELECT pg_temp.expect_failure(
  'observation publication must exist',
  $sql$INSERT INTO "IngredientPriceObservation" ("id","publicationId","commodityId","geographyId","sourceObservationKey","kind","amountMinCentavos","amountMaxCentavos","observedFrom","observedTo","originalCommodityDescription","originalUnit") VALUES ('bad-obs-fk','missing-publication','price-commodity-v1','price-geo-city','bad-fk','AVERAGE_RETAIL',1,2,'2026-08-01','2026-08-31','Bad','kg')$sql$,
  '23503', 'IngredientPriceObservation_publicationId_fkey'
);

SELECT pg_temp.expect_failure(
  'publication update is immutable',
  $sql$UPDATE "IngredientPricePublication" SET "sourceUrl"='https://example.invalid/changed' WHERE "id"='price-publication-v1'$sql$,
  'P0001'
);
SELECT pg_temp.expect_failure(
  'publication delete is immutable',
  $sql$DELETE FROM "IngredientPricePublication" WHERE "id"='price-publication-v1'$sql$,
  'P0001'
);
SELECT pg_temp.expect_failure(
  'observation update is immutable',
  $sql$UPDATE "IngredientPriceObservation" SET "amountMaxCentavos"=7000 WHERE "id"='price-observation-v2'$sql$,
  'P0001'
);
SELECT pg_temp.expect_failure(
  'observation delete is immutable',
  $sql$DELETE FROM "IngredientPriceObservation" WHERE "id"='price-observation-v2'$sql$,
  'P0001'
);
SELECT pg_temp.expect_failure(
  'mapping update is immutable',
  $sql$UPDATE "IngredientPriceCommodityMapping" SET "rationale"='changed' WHERE "id"='price-mapping-v2'$sql$,
  'P0001'
);

DO $audit$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM "IngredientPriceSource";
  IF n <> 1 THEN RAISE EXCEPTION 'expected one valid source, found %', n; END IF;
  SELECT count(*) INTO n FROM "IngredientPriceGeography";
  IF n <> 3 THEN RAISE EXCEPTION 'expected geography hierarchy of three, found %', n; END IF;
  SELECT count(*) INTO n FROM "IngredientPriceCommodityMapping";
  IF n <> 2 THEN RAISE EXCEPTION 'expected two mapping revisions, found %', n; END IF;
  SELECT count(*) INTO n FROM "IngredientPriceObservation";
  IF n <> 2 THEN RAISE EXCEPTION 'expected two observation revisions, found %', n; END IF;
END
$audit$;

SELECT 'ingredient_price_rehearsal_probes_passed' AS result;
ROLLBACK;
