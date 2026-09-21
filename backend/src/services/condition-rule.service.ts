import { ConditionRuleReviewStatus, HealthConditionType } from '@prisma/client';
import prisma from '@/lib/prisma';
import { evaluateConditionNutrientRule, type RuleNutrientEvidence } from '@/domain/condition-rule-evaluation.policy';

export async function evaluateApprovedConditionRules(input: {
  conditions: readonly string[];
  ingredientNames: readonly string[];
  nutrients: RuleNutrientEvidence;
  dailyTotals?: RuleNutrientEvidence;
  bodyWeightKg?: number | null;
}) {
  const conditions = [...new Set(input.conditions.filter((condition) => condition !== 'NONE'))].filter((condition) =>
    Object.values(HealthConditionType).includes(condition as HealthConditionType)
  ) as HealthConditionType[];
  if (conditions.length === 0) return { nutrientEvaluations: [], ingredientMatches: [], uncoveredConditions: [] };

  const [nutrientRules, ingredientRules] = await Promise.all([
    prisma.conditionNutrientRule.findMany({
      where: {
        condition: { in: conditions },
        reviewStatus: ConditionRuleReviewStatus.APPROVED,
        active: true,
        approvedByNutritionistId: { not: null },
      },
      orderBy: [{ condition: 'asc' }, { nutrient: 'asc' }, { id: 'asc' }],
      take: 100,
    }),
    prisma.conditionIngredientRule.findMany({
      where: {
        condition: { in: conditions },
        reviewStatus: ConditionRuleReviewStatus.APPROVED,
        active: true,
        approvedByNutritionistId: { not: null },
      },
      orderBy: [{ condition: 'asc' }, { ingredientCategory: 'asc' }, { id: 'asc' }],
      take: 100,
    }),
  ]);

  const nutrientEvaluations = nutrientRules.map((rule) => ({
    condition: rule.condition,
    rule,
    evaluation: evaluateConditionNutrientRule(rule, input.nutrients, {
      dailyTotals: input.dailyTotals,
      bodyWeightKg: input.bodyWeightKg,
    }),
  }));
  const normalizedIngredients = input.ingredientNames.map((value) => value.normalize('NFKC').toLowerCase());
  const ingredientMatches = ingredientRules.flatMap((rule) => {
    const terms = Array.isArray(rule.matchingTerms)
      ? rule.matchingTerms.filter((term): term is string => typeof term === 'string')
      : [];
    const matches = normalizedIngredients.filter((ingredient) =>
      terms.some((term) => ingredient.includes(term.normalize('NFKC').toLowerCase()))
    );
    return matches.length ? [{ condition: rule.condition, rule, matches }] : [];
  });
  const covered = new Set([
    ...nutrientRules.map((rule) => rule.condition),
    ...ingredientRules.map((rule) => rule.condition),
  ]);

  return {
    nutrientEvaluations,
    ingredientMatches,
    uncoveredConditions: conditions.filter((condition) => !covered.has(condition)),
  };
}
