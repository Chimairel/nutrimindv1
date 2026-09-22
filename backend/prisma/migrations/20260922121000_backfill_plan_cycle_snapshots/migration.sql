WITH daily_totals AS (
  SELECT
    mp."planGroupId",
    mp."userId",
    TO_CHAR(mp."scheduledDate" AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD') AS day_key,
    SUM(mp."calories") AS calories,
    SUM(mp."proteinG") AS protein_g,
    SUM(mp."carbsG") AS carbs_g,
    SUM(mp."fatG") AS fat_g,
    MIN(mp."createdAt") AS generated_at
  FROM "MealPlan" mp
  WHERE mp."status" <> 'CANCELLED'
  GROUP BY mp."planGroupId", mp."userId", day_key
), cycle_totals AS (
  SELECT
    "planGroupId",
    "userId",
    ROUND(AVG(calories))::INTEGER AS daily_calorie_target,
    JSONB_OBJECT_AGG(
      day_key,
      JSONB_BUILD_OBJECT(
        'calories', calories,
        'proteinG', protein_g,
        'carbsG', carbs_g,
        'fatG', fat_g
      )
      ORDER BY day_key
    ) AS daily_macro_targets,
    MIN(generated_at) AS generated_at
  FROM daily_totals
  GROUP BY "planGroupId", "userId"
)
INSERT INTO "MealPlanCycleSnapshot" (
  "id",
  "planGroupId",
  "userId",
  "profileRevision",
  "safetyRevision",
  "weightKg",
  "activityLevel",
  "goal",
  "dailyCalorieTarget",
  "dailyMacroTargets",
  "dietaryPreference",
  "carbPreference",
  "foodCulture",
  "planningGeographyLevel",
  "planningRegionName",
  "planningProvinceHucName",
  "mealLocalityPreference",
  "shoppingDayGroup",
  "shoppingDayOfWeek",
  "generatedAt"
)
SELECT
  'legacy_' || MD5(c."planGroupId"),
  c."planGroupId",
  c."userId",
  p."revision",
  p."safetyRevision",
  p."weightKg",
  p."activityLevel",
  p."goal",
  c.daily_calorie_target,
  c.daily_macro_targets,
  p."dietaryPreference",
  p."carbPreference",
  p."foodCulture",
  p."planningGeographyLevel",
  p."planningRegionName",
  p."planningProvinceHucName",
  p."mealLocalityPreference",
  p."shoppingDayGroup",
  p."shoppingDayOfWeek",
  c.generated_at
FROM cycle_totals c
JOIN "UserProfile" p ON p."userId" = c."userId"
WHERE p."weightKg" IS NOT NULL
  AND p."activityLevel" IS NOT NULL
  AND p."goal" IS NOT NULL
ON CONFLICT ("planGroupId") DO NOTHING;
