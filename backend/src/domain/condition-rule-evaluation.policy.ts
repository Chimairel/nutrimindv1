export type RuleEvaluationDecision = 'PASS' | 'FAIL' | 'NOT_EVALUABLE';

export interface ConditionRuleLike {
  id: string;
  nutrient: string;
  operator: string;
  threshold: number;
  basis: string;
  severity: string;
  reviewStatus: string;
  active: boolean;
  approvedByNutritionistId?: string | null;
}

export interface RuleNutrientEvidence {
  calories?: number | null;
  sodiumMg?: number | null;
  sugarG?: number | null;
  fiberG?: number | null;
  potassiumMg?: number | null;
  phosphorusMg?: number | null;
  proteinG?: number | null;
  saturatedFatG?: number | null;
  carbsG?: number | null;
}

export interface ConditionRuleEvaluation {
  ruleId: string;
  decision: RuleEvaluationDecision;
  measuredValue: number | null;
  threshold: number;
  severity: string;
  reason: string;
}

const NUTRIENT_FIELD: Record<string, keyof RuleNutrientEvidence> = {
  SODIUM_MG: 'sodiumMg',
  SUGAR_G: 'sugarG',
  FIBER_G: 'fiberG',
  POTASSIUM_MG: 'potassiumMg',
  PHOSPHORUS_MG: 'phosphorusMg',
  PROTEIN_G: 'proteinG',
  SATURATED_FAT_G: 'saturatedFatG',
  CARBOHYDRATE_G: 'carbsG',
};

function compare(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case 'GREATER_THAN':
      return value > threshold;
    case 'GREATER_THAN_OR_EQUAL':
      return value >= threshold;
    case 'LESS_THAN':
      return value < threshold;
    case 'LESS_THAN_OR_EQUAL':
      return value <= threshold;
    case 'EQUAL':
      return value === threshold;
    default:
      return false;
  }
}

function normalizeValue(
  rule: ConditionRuleLike,
  evidence: RuleNutrientEvidence,
  context: { dailyTotals?: RuleNutrientEvidence; bodyWeightKg?: number | null }
): number | null {
  const field = NUTRIENT_FIELD[rule.nutrient];
  if (!field) return null;

  if (rule.basis === 'DAILY_TOTAL') return context.dailyTotals?.[field] ?? null;
  const raw = evidence[field];
  if (raw === null || raw === undefined || !Number.isFinite(raw)) return null;
  if (rule.basis === 'PER_SERVING') return raw;
  if (rule.basis === 'PER_1000_KCAL') {
    return evidence.calories && evidence.calories > 0 ? (raw * 1000) / evidence.calories : null;
  }
  if (rule.basis === 'PERCENT_OF_DAILY_CALORIES') {
    if (rule.nutrient !== 'SATURATED_FAT_G' || !context.dailyTotals?.calories) return null;
    return ((context.dailyTotals.saturatedFatG ?? 0) * 9 * 100) / context.dailyTotals.calories;
  }
  if (rule.basis === 'PER_KG_BODY_WEIGHT_DAILY') {
    const weight = context.bodyWeightKg;
    const dailyValue = context.dailyTotals?.[field];
    return weight && weight > 0 && dailyValue !== null && dailyValue !== undefined ? dailyValue / weight : null;
  }
  return null;
}

export function evaluateConditionNutrientRule(
  rule: ConditionRuleLike,
  evidence: RuleNutrientEvidence,
  context: { dailyTotals?: RuleNutrientEvidence; bodyWeightKg?: number | null } = {}
): ConditionRuleEvaluation {
  if (rule.reviewStatus !== 'APPROVED' || !rule.active || !rule.approvedByNutritionistId) {
    return {
      ruleId: rule.id,
      decision: 'NOT_EVALUABLE',
      measuredValue: null,
      threshold: rule.threshold,
      severity: rule.severity,
      reason: 'RULE_NOT_ACTIVE_AND_APPROVED',
    };
  }
  const measuredValue = normalizeValue(rule, evidence, context);
  if (measuredValue === null) {
    return {
      ruleId: rule.id,
      decision: 'NOT_EVALUABLE',
      measuredValue,
      threshold: rule.threshold,
      severity: rule.severity,
      reason: 'REQUIRED_NUTRIENT_OR_CONTEXT_MISSING',
    };
  }
  const passes = compare(measuredValue, rule.operator, rule.threshold);
  return {
    ruleId: rule.id,
    decision: passes ? 'PASS' : 'FAIL',
    measuredValue,
    threshold: rule.threshold,
    severity: rule.severity,
    reason: passes ? 'THRESHOLD_SATISFIED' : 'THRESHOLD_VIOLATED',
  };
}
