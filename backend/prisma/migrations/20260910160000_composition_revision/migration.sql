ALTER TABLE "FoodItem" ADD COLUMN "compositionRevision" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "FoodCompositionRevision" (
 "id" TEXT PRIMARY KEY,
 "foodItemId" TEXT NOT NULL REFERENCES "FoodItem"("id") ON DELETE RESTRICT,
 "baseRevision" INTEGER NOT NULL,
 "previousValues" JSONB NOT NULL,
 "proposedValues" JSONB NOT NULL,
 "sourceUrl" VARCHAR(500) NOT NULL,
 "sourcePublishedAt" TIMESTAMP(3) NOT NULL,
 "reason" VARCHAR(1000) NOT NULL,
 "createdByAdminId" TEXT NOT NULL,
 "publishedByAdminId" TEXT,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "publishedAt" TIMESTAMP(3)
);
CREATE INDEX "FoodCompositionRevision_foodItemId_createdAt_idx" ON "FoodCompositionRevision"("foodItemId", "createdAt");
