ALTER TABLE "ConditionNutrientRule" DROP CONSTRAINT "ConditionNutrientRule_approval_integrity";
ALTER TABLE "ConditionNutrientRule" ADD CONSTRAINT "ConditionNutrientRule_approval_integrity" CHECK (
  ("reviewStatus" = 'DRAFT' AND "active" = false AND "approvedByNutritionistId" IS NULL)
  OR ("reviewStatus" = 'APPROVED' AND "approvedByNutritionistId" IS NOT NULL)
  OR ("reviewStatus" = 'RETIRED' AND "active" = false)
);

ALTER TABLE "ConditionIngredientRule" DROP CONSTRAINT "ConditionIngredientRule_approval_integrity";
ALTER TABLE "ConditionIngredientRule" ADD CONSTRAINT "ConditionIngredientRule_approval_integrity" CHECK (
  ("reviewStatus" = 'DRAFT' AND "active" = false AND "approvedByNutritionistId" IS NULL)
  OR ("reviewStatus" = 'APPROVED' AND "approvedByNutritionistId" IS NOT NULL)
  OR ("reviewStatus" = 'RETIRED' AND "active" = false)
);
