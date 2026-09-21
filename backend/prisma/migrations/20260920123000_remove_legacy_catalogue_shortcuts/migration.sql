-- Remove legacy fixture-only goal tags and nutrient-cutoff condition claims.
-- Base nutrition/allergen certification remains intact; condition coverage is
-- independently absent until a governed ruleset or RND review establishes it.
WITH "managedCatalogue" AS (
  SELECT DISTINCT "mealLibraryId"
  FROM "MealLibrarySafetyReview"
  WHERE "reasonCode" IN (
    'NUTRIMIND_COMMON_LIBRARY_V1',
    'NUTRIMIND_COMMON_LIBRARY_V2',
    'NUTRIMIND_COMMON_LIBRARY_V3',
    'NUTRIMIND_COMMON_LIBRARY_V4'
  )
)
DELETE FROM "MealLibrarySafetyDeclaration"
WHERE "mealLibraryId" IN (SELECT "mealLibraryId" FROM "managedCatalogue")
  AND "declarationType" IN ('CONDITION_REVIEWED', 'CONDITION_RULESET_CLEARED');

WITH "managedCatalogue" AS (
  SELECT DISTINCT "mealLibraryId"
  FROM "MealLibrarySafetyReview"
  WHERE "reasonCode" IN (
    'NUTRIMIND_COMMON_LIBRARY_V1',
    'NUTRIMIND_COMMON_LIBRARY_V2',
    'NUTRIMIND_COMMON_LIBRARY_V3',
    'NUTRIMIND_COMMON_LIBRARY_V4'
  )
)
UPDATE "MealLibrary"
SET
  "suitableConditions" = '[]'::jsonb,
  "conditionDeclarationState" = 'REVIEWED_NONE_DECLARED',
  "dietaryTags" = ((("dietaryTags" - 'LOSE_WEIGHT') - 'GAIN_WEIGHT') - 'MAINTAIN') - 'BUILD_MUSCLE'
WHERE "id" IN (SELECT "mealLibraryId" FROM "managedCatalogue");
