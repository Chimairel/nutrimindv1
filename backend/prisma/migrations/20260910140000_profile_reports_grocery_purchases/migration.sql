ALTER TABLE "UserProfile" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "NutritionReport" ADD COLUMN "profileRevision" INTEGER NOT NULL DEFAULT 0,
 ADD COLUMN "isStale" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
CREATE TABLE "NutritionReportVersion" (
 "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
 "version" INTEGER NOT NULL, "profileRevision" INTEGER NOT NULL,
 "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "acknowledgedAt" TIMESTAMP(3),
 "content" JSONB NOT NULL, "profileSnapshot" JSONB NOT NULL,
 "policyVersion" TEXT NOT NULL DEFAULT 'NUTRIMIND_REPORT_V2'
);
CREATE UNIQUE INDEX "NutritionReportVersion_userId_version_key" ON "NutritionReportVersion"("userId", "version");
INSERT INTO "NutritionReportVersion" ("id", "userId", "version", "profileRevision", "generatedAt", "acknowledgedAt", "content", "profileSnapshot", "policyVersion")
 SELECT 'legacy-' || r.id, r."userId", 1, 0, r."generatedAt", r."acknowledgedAt", to_jsonb(r), '{}'::jsonb, 'LEGACY_UNVERSIONED' FROM "NutritionReport" r;
UPDATE "NutritionReport" SET "isStale" = true, "acknowledgedAt" = NULL;
ALTER TABLE "GroceryList" ADD COLUMN "planGroupId" TEXT, ADD COLUMN "isStale" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "GroceryItem" ADD COLUMN "purchasedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0;
UPDATE "GroceryItem" SET "purchasedQuantity" = GREATEST(0, COALESCE(quantity, 0)) WHERE "isChecked";
ALTER TABLE "GroceryItem" ADD CONSTRAINT "GroceryItem_purchased_quantity_valid" CHECK ("purchasedQuantity" >= 0 AND "purchasedQuantity" < 'Infinity'::float8);
ALTER TABLE "SwapLog" ADD COLUMN "requestKey" TEXT;
CREATE UNIQUE INDEX "SwapLog_requestKey_key" ON "SwapLog"("requestKey");
