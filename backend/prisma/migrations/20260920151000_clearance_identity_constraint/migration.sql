-- A reusable clearance has one live review stream per exact recipe revision,
-- condition and optional user scope. COALESCE makes the reusable (NULL scope)
-- identity enforceable in PostgreSQL, while the partial predicate permits a
-- new review stream after an earlier clearance is revoked or expires.
CREATE UNIQUE INDEX "MealConditionClearance_live_scope_key"
ON "MealConditionClearance" (
  "mealLibraryId",
  "condition",
  "recipeSignature",
  "evidenceRevision",
  COALESCE("userScopeId", '')
)
WHERE "state" IN ('ACTIVE', 'REVIEW_DUE', 'DISPUTED');
