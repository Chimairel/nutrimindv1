ALTER TYPE "MealIngredientDataSource" ADD VALUE 'USDA_FDC';

ALTER TABLE "FoodItem"
  ADD COLUMN "sourceRecordId" VARCHAR(80),
  ADD COLUMN "sourceReferenceUrl" VARCHAR(500),
  ADD COLUMN "sourceDataset" VARCHAR(120),
  ADD COLUMN "sourcePublishedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "FoodItem_source_sourceRecordId_key" ON "FoodItem"("source", "sourceRecordId");
