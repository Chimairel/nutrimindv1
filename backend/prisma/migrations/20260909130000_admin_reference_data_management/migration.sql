CREATE TYPE "ReferenceDataDomain" AS ENUM (
  'FOOD_COMPOSITION',
  'FOOD_CONSUMPTION',
  'INGREDIENT_PRICE',
  'MEAL_CATALOGUE',
  'MEAL_MEDIA'
);

CREATE TYPE "ReferenceDataReleaseStatus" AS ENUM ('DRAFT', 'STAGED', 'ACTIVE', 'RETIRED');
CREATE TYPE "ReferenceDataActivationAction" AS ENUM ('PUBLISH', 'ROLLBACK');
CREATE TYPE "ConsumptionGeographyLevel" AS ENUM ('NATIONAL', 'REGION', 'PROVINCE_HUC');
CREATE TYPE "ConsumptionMappingStatus" AS ENUM ('EXACT', 'MANUAL', 'REVIEW_REQUIRED', 'UNMAPPED');

CREATE TABLE "ReferenceDataSource" (
  "id" TEXT NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "agencyName" VARCHAR(180) NOT NULL,
  "domain" "ReferenceDataDomain" NOT NULL,
  "homepageUrl" VARCHAR(500) NOT NULL,
  "termsUrl" VARCHAR(500),
  "attributionText" VARCHAR(300) NOT NULL,
  "updateCadence" VARCHAR(120),
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferenceDataSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferenceDataRelease" (
  "id" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "versionLabel" VARCHAR(120) NOT NULL,
  "surveyYear" INTEGER,
  "sourceUrl" VARCHAR(500) NOT NULL,
  "sourcePublishedAt" TIMESTAMP(3),
  "retrievedAt" TIMESTAMP(3) NOT NULL,
  "contentSha256" CHAR(64),
  "status" "ReferenceDataReleaseStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" VARCHAR(500),
  "createdByAdminId" TEXT NOT NULL,
  "activatedByAdminId" TEXT,
  "activatedAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReferenceDataRelease_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferenceDataReleaseActivation" (
  "id" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "replacedReleaseId" TEXT,
  "actorAdminId" TEXT NOT NULL,
  "action" "ReferenceDataActivationAction" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferenceDataReleaseActivation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FoodConsumptionStat" (
  "id" TEXT NOT NULL,
  "releaseId" TEXT NOT NULL,
  "sourceRowKey" VARCHAR(191) NOT NULL,
  "populationGroup" VARCHAR(120) NOT NULL,
  "geographyLevel" "ConsumptionGeographyLevel" NOT NULL,
  "regionCode" VARCHAR(40),
  "regionName" VARCHAR(120),
  "provinceHucCode" VARCHAR(40),
  "provinceHucName" VARCHAR(160),
  "placeType" VARCHAR(40),
  "foodNameRaw" VARCHAR(240) NOT NULL,
  "foodItemId" TEXT,
  "mappingStatus" "ConsumptionMappingStatus" NOT NULL,
  "rank" INTEGER,
  "percentConsuming" DOUBLE PRECISION,
  "meanIntakeG" DOUBLE PRECISION,
  "sampleSize" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FoodConsumptionStat_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FoodAlias"
  ADD COLUMN "normalizedAlias" VARCHAR(180),
  ADD COLUMN "verifiedByAdminId" TEXT,
  ADD COLUMN "verifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "ReferenceDataSource_code_key" ON "ReferenceDataSource"("code");
CREATE INDEX "ReferenceDataSource_domain_isEnabled_idx" ON "ReferenceDataSource"("domain", "isEnabled");
CREATE UNIQUE INDEX "ReferenceDataRelease_sourceId_versionLabel_key" ON "ReferenceDataRelease"("sourceId", "versionLabel");
CREATE INDEX "ReferenceDataRelease_sourceId_status_createdAt_idx" ON "ReferenceDataRelease"("sourceId", "status", "createdAt");
CREATE INDEX "ReferenceDataRelease_status_activatedAt_idx" ON "ReferenceDataRelease"("status", "activatedAt");
CREATE UNIQUE INDEX "ReferenceDataRelease_one_active_per_source" ON "ReferenceDataRelease"("sourceId") WHERE "status" = 'ACTIVE';
CREATE INDEX "ReferenceDataReleaseActivation_releaseId_createdAt_idx" ON "ReferenceDataReleaseActivation"("releaseId", "createdAt");
CREATE INDEX "ReferenceDataReleaseActivation_actorAdminId_createdAt_idx" ON "ReferenceDataReleaseActivation"("actorAdminId", "createdAt");
CREATE UNIQUE INDEX "FoodConsumptionStat_releaseId_sourceRowKey_key" ON "FoodConsumptionStat"("releaseId", "sourceRowKey");
CREATE INDEX "FoodConsumptionStat_release_geo_population_rank_idx" ON "FoodConsumptionStat"("releaseId", "geographyLevel", "populationGroup", "rank");
CREATE INDEX "FoodConsumptionStat_foodItemId_geographyLevel_idx" ON "FoodConsumptionStat"("foodItemId", "geographyLevel");
CREATE INDEX "FoodConsumptionStat_mappingStatus_releaseId_idx" ON "FoodConsumptionStat"("mappingStatus", "releaseId");
CREATE UNIQUE INDEX "FoodAlias_normalizedAlias_key" ON "FoodAlias"("normalizedAlias");
CREATE INDEX "FoodAlias_foodItemId_verifiedAt_idx" ON "FoodAlias"("foodItemId", "verifiedAt");

ALTER TABLE "ReferenceDataRelease"
  ADD CONSTRAINT "ReferenceDataRelease_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "ReferenceDataSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferenceDataRelease"
  ADD CONSTRAINT "ReferenceDataRelease_createdByAdminId_fkey"
  FOREIGN KEY ("createdByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferenceDataRelease"
  ADD CONSTRAINT "ReferenceDataRelease_activatedByAdminId_fkey"
  FOREIGN KEY ("activatedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferenceDataReleaseActivation"
  ADD CONSTRAINT "ReferenceDataReleaseActivation_releaseId_fkey"
  FOREIGN KEY ("releaseId") REFERENCES "ReferenceDataRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferenceDataReleaseActivation"
  ADD CONSTRAINT "ReferenceDataReleaseActivation_replacedReleaseId_fkey"
  FOREIGN KEY ("replacedReleaseId") REFERENCES "ReferenceDataRelease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferenceDataReleaseActivation"
  ADD CONSTRAINT "ReferenceDataReleaseActivation_actorAdminId_fkey"
  FOREIGN KEY ("actorAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FoodConsumptionStat"
  ADD CONSTRAINT "FoodConsumptionStat_releaseId_fkey"
  FOREIGN KEY ("releaseId") REFERENCES "ReferenceDataRelease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FoodConsumptionStat"
  ADD CONSTRAINT "FoodConsumptionStat_foodItemId_fkey"
  FOREIGN KEY ("foodItemId") REFERENCES "FoodItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FoodAlias"
  ADD CONSTRAINT "FoodAlias_verifiedByAdminId_fkey"
  FOREIGN KEY ("verifiedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferenceDataRelease" ADD CONSTRAINT "ReferenceDataRelease_survey_year_range" CHECK (
  "surveyYear" IS NULL OR "surveyYear" BETWEEN 1970 AND 2100
);
ALTER TABLE "ReferenceDataRelease" ADD CONSTRAINT "ReferenceDataRelease_sha256_shape" CHECK (
  "contentSha256" IS NULL OR "contentSha256" ~ '^[0-9a-f]{64}$'
);
ALTER TABLE "ReferenceDataRelease" ADD CONSTRAINT "ReferenceDataRelease_status_timestamps" CHECK (
  ("status" IN ('DRAFT', 'STAGED') AND "activatedAt" IS NULL AND "retiredAt" IS NULL) OR
  ("status" = 'ACTIVE' AND "activatedAt" IS NOT NULL AND "retiredAt" IS NULL) OR
  ("status" = 'RETIRED' AND "activatedAt" IS NOT NULL AND "retiredAt" IS NOT NULL)
);
ALTER TABLE "ReferenceDataReleaseActivation" ADD CONSTRAINT "ReferenceDataReleaseActivation_no_self_replacement" CHECK (
  "replacedReleaseId" IS NULL OR "replacedReleaseId" <> "releaseId"
);
ALTER TABLE "FoodConsumptionStat" ADD CONSTRAINT "FoodConsumptionStat_measure_ranges" CHECK (
  ("rank" IS NULL OR "rank" > 0) AND
  ("percentConsuming" IS NULL OR ("percentConsuming" >= 0 AND "percentConsuming" <= 100)) AND
  ("meanIntakeG" IS NULL OR "meanIntakeG" >= 0) AND
  ("sampleSize" IS NULL OR "sampleSize" > 0)
);
ALTER TABLE "FoodConsumptionStat" ADD CONSTRAINT "FoodConsumptionStat_geography_shape" CHECK (
  ("geographyLevel" = 'NATIONAL' AND "regionName" IS NULL AND "provinceHucName" IS NULL) OR
  ("geographyLevel" = 'REGION' AND "regionName" IS NOT NULL AND "provinceHucName" IS NULL) OR
  ("geographyLevel" = 'PROVINCE_HUC' AND "regionName" IS NOT NULL AND "provinceHucName" IS NOT NULL)
);

CREATE OR REPLACE FUNCTION prevent_published_consumption_stat_mutation()
RETURNS TRIGGER AS $$
DECLARE
  release_status "ReferenceDataReleaseStatus";
BEGIN
  SELECT "status" INTO release_status
  FROM "ReferenceDataRelease"
  WHERE "id" = OLD."releaseId";

  IF release_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Food consumption statistics are immutable after staging';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "FoodConsumptionStat_draft_only_update"
BEFORE UPDATE OR DELETE ON "FoodConsumptionStat"
FOR EACH ROW EXECUTE FUNCTION prevent_published_consumption_stat_mutation();
