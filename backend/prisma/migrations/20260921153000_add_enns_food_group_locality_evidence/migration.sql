ALTER TABLE "FoodConsumptionStat"
ADD COLUMN "foodGroupCode" VARCHAR(40),
ADD COLUMN "sourceVariable" VARCHAR(40),
ADD COLUMN "weightedPopulation" DOUBLE PRECISION,
ADD COLUMN "relativeToNational" DOUBLE PRECISION,
ADD COLUMN "surveyYears" VARCHAR(20);

CREATE INDEX "FoodConsumptionStat_release_geo_group_rank_idx"
ON "FoodConsumptionStat"("releaseId", "geographyLevel", "foodGroupCode", "rank");
