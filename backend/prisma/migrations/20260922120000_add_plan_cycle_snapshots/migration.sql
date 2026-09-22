ALTER TABLE "UserProfile"
ADD COLUMN "safetyRevision" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "MealPlanCycleSnapshot" (
    "id" TEXT NOT NULL,
    "planGroupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileRevision" INTEGER NOT NULL,
    "safetyRevision" INTEGER NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "activityLevel" "ActivityLevel" NOT NULL,
    "goal" "Goal" NOT NULL,
    "dailyCalorieTarget" INTEGER NOT NULL,
    "dailyMacroTargets" JSONB NOT NULL,
    "dietaryPreference" "DietaryPreference",
    "carbPreference" "CarbPreference",
    "foodCulture" TEXT,
    "planningGeographyLevel" "ConsumptionGeographyLevel" NOT NULL,
    "planningRegionName" TEXT,
    "planningProvinceHucName" TEXT,
    "mealLocalityPreference" "MealLocalityPreference" NOT NULL,
    "shoppingDayGroup" "ShoppingDayGroup",
    "shoppingDayOfWeek" INTEGER,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MealPlanCycleSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MealPlanCycleSnapshot_planGroupId_key" ON "MealPlanCycleSnapshot"("planGroupId");
CREATE INDEX "MealPlanCycleSnapshot_userId_generatedAt_idx" ON "MealPlanCycleSnapshot"("userId", "generatedAt");

ALTER TABLE "MealPlanCycleSnapshot"
ADD CONSTRAINT "MealPlanCycleSnapshot_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
