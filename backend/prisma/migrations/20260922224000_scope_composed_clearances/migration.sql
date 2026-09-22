-- A rice-composed serving has a different nutrient and grocery scope from its
-- base recipe. Live clearance identity must therefore include the optional
-- composed-serving signature.
DROP INDEX IF EXISTS "MealConditionClearance_live_scope_key";

CREATE UNIQUE INDEX "MealConditionClearance_live_scope_key"
ON "MealConditionClearance" (
  "mealLibraryId",
  "condition",
  "recipeSignature",
  COALESCE("composedServingSignature", ''),
  "evidenceRevision",
  COALESCE("userScopeId", '')
)
WHERE "state" IN ('ACTIVE', 'REVIEW_DUE', 'DISPUTED');
