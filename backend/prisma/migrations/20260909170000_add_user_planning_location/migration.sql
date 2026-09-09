-- Additive, coarse meal-planning geography. Exact addresses are deliberately
-- excluded; these fields are used only to select aggregate reference evidence.
ALTER TABLE "UserProfile"
ADD COLUMN "planningGeographyLevel" "ConsumptionGeographyLevel" NOT NULL DEFAULT 'NATIONAL',
ADD COLUMN "planningRegionName" VARCHAR(120),
ADD COLUMN "planningProvinceHucName" VARCHAR(160);

ALTER TABLE "UserProfile"
ADD CONSTRAINT "UserProfile_planning_geography_shape" CHECK (
  ("planningGeographyLevel" = 'NATIONAL'
    AND "planningRegionName" IS NULL
    AND "planningProvinceHucName" IS NULL)
  OR
  ("planningGeographyLevel" = 'REGION'
    AND "planningRegionName" IS NOT NULL
    AND length(btrim("planningRegionName")) > 0
    AND "planningProvinceHucName" IS NULL)
  OR
  ("planningGeographyLevel" = 'PROVINCE_HUC'
    AND "planningRegionName" IS NOT NULL
    AND length(btrim("planningRegionName")) > 0
    AND "planningProvinceHucName" IS NOT NULL
    AND length(btrim("planningProvinceHucName")) > 0)
);

CREATE INDEX "UserProfile_planning_geography_idx"
ON "UserProfile"("planningGeographyLevel", "planningRegionName", "planningProvinceHucName");
