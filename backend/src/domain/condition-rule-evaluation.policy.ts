export type RuleEvaluationDecision = 'PASS' | 'FAIL' | 'NOT_EVALUABLE';

export interface ConditionRuleLike {
  id: string;
  nutrient: string;
  operator: string;
  threshold: number;
  unit?: string;
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
  /**
   * The personalized value used for this evaluation. For a dynamic rule this
   * is derived from the user's daily energy or body weight.
   */
  threshold: number | null;
  /** The coefficient stored on the reviewed rule version. */
  sourceThreshold: number;
  thresholdUnit: string;
  calculation: RuleThresholdCalculation;
  severity: string;
  reason: string;
}

export interface RuleThresholdCalculation {
  method: string;
  formula: string;
  inputs: Record<string, number>;
  coefficient: number;
  result: number | null;
  resultUnit: string;
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

function nutrientCaloriesPerGram(nutrient: string): number | null {
  if (nutrient === 'SATURATED_FAT_G') return 9;
  if (nutrient === 'PROTEIN_G' || nutrient === 'CARBOHYDRATE_G' || nutrient === 'SUGAR_G') return 4;
  return null;
}

function fixedCalculation(rule: ConditionRuleLike): RuleThresholdCalculation {
  const result = Number.isFinite(rule.threshold) ? rule.threshold : null;
  const baseUnit = rule.unit || (rule.nutrient.endsWith('_MG') ? 'mg' : 'g');
  const resultUnit = rule.basis === 'DAILY_TOTAL' ? `${baseUnit}/day` : `${baseUnit}/serving`;
  return {
    method: rule.basis,
    formula: 'threshold = coefficient',
    inputs: {},
    coefficient: rule.threshold,
    result,
    resultUnit,
  };
}

function positiveFinite(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0;
}

/**
 * Resolve the reviewed rule coefficient into the threshold for this exact
 * user context. This deliberately supports a closed set of calculation
 * methods; database content is never executed as code.
 */
export function resolveConditionRuleThreshold(
  rule: ConditionRuleLike,
  context: { dailyTotals?: RuleNutrientEvidence; bodyWeightKg?: number | null }
): RuleThresholdCalculation {
  if (rule.basis === 'PER_SERVING' || rule.basis === 'DAILY_TOTAL') return fixedCalculation(rule);
  if (rule.basis === 'PER_1000_KCAL') {
    const dailyCalories = context.dailyTotals?.calories;
    const result =
      positiveFinite(dailyCalories) && Number.isFinite(rule.threshold) ? (rule.threshold * dailyCalories) / 1000 : null;
    return {
      method: rule.basis,
      formula: 'threshold = coefficient × dailyCalories ÷ 1000',
      inputs: positiveFinite(dailyCalories) ? { dailyCalories } : {},
      coefficient: rule.threshold,
      result,
      resultUnit: rule.nutrient.endsWith('_MG') ? 'mg/day' : 'g/day',
    };
  }
  if (rule.basis === 'PERCENT_OF_DAILY_CALORIES') {
    const dailyCalories = context.dailyTotals?.calories;
    const kcalPerGram = nutrientCaloriesPerGram(rule.nutrient);
    const result =
      positiveFinite(dailyCalories) && kcalPerGram && Number.isFinite(rule.threshold)
        ? (dailyCalories * (rule.threshold / 100)) / kcalPerGram
        : null;
    return {
      method: rule.basis,
      formula: 'thresholdGrams = dailyCalories × (coefficientPercent ÷ 100) ÷ nutrientKcalPerGram',
      inputs: positiveFinite(dailyCalories) && kcalPerGram ? { dailyCalories, nutrientKcalPerGram: kcalPerGram } : {},
      coefficient: rule.threshold,
      result,
      resultUnit: 'g/day',
    };
  }
  if (rule.basis === 'PER_KG_BODY_WEIGHT_DAILY') {
    const weight = context.bodyWeightKg;
    const result = positiveFinite(weight) && Number.isFinite(rule.threshold) ? rule.threshold * weight : null;
    return {
      method: rule.basis,
      formula: 'threshold = coefficient × bodyWeightKg',
      inputs: positiveFinite(weight) ? { bodyWeightKg: weight } : {},
      coefficient: rule.threshold,
      result,
      resultUnit: rule.nutrient.endsWith('_MG') ? 'mg/day' : 'g/day',
    };
  }
  return {
    method: rule.basis,
    formula: 'unsupported calculation method',
    inputs: {},
    coefficient: rule.threshold,
    result: null,
    resultUnit: 'unknown',
  };
}

function measuredValueFor(
  rule: ConditionRuleLike,
  evidence: RuleNutrientEvidence,
  context: { dailyTotals?: RuleNutrientEvidence; bodyWeightKg?: number | null }
): number | null {
  const field = NUTRIENT_FIELD[rule.nutrient];
  if (!field) return null;
  const source = rule.basis === 'PER_SERVING' ? evidence : context.dailyTotals;
  const measured = source?.[field];
  return measured !== null && measured !== undefined && Number.isFinite(measured) ? measured : null;
}

export function evaluateConditionNutrientRule(
  rule: ConditionRuleLike,
  evidence: RuleNutrientEvidence,
  context: { dailyTotals?: RuleNutrientEvidence; bodyWeightKg?: number | null } = {}
): ConditionRuleEvaluation {
  const calculation = resolveConditionRuleThreshold(rule, context);
  if (rule.reviewStatus !== 'APPROVED' || !rule.active || !rule.approvedByNutritionistId) {
    return {
      ruleId: rule.id,
      decision: 'NOT_EVALUABLE',
      measuredValue: null,
      threshold: calculation.result,
      sourceThreshold: rule.threshold,
      thresholdUnit: calculation.resultUnit,
      calculation,
      severity: rule.severity,
      reason: 'RULE_NOT_ACTIVE_AND_APPROVED',
    };
  }
  const measuredValue = measuredValueFor(rule, evidence, context);
  if (measuredValue === null || calculation.result === null) {
    return {
      ruleId: rule.id,
      decision: 'NOT_EVALUABLE',
      measuredValue,
      threshold: calculation.result,
      sourceThreshold: rule.threshold,
      thresholdUnit: calculation.resultUnit,
      calculation,
      severity: rule.severity,
      reason: 'REQUIRED_NUTRIENT_OR_CONTEXT_MISSING',
    };
  }
  const passes = compare(measuredValue, rule.operator, calculation.result);
  return {
    ruleId: rule.id,
    decision: passes ? 'PASS' : 'FAIL',
    measuredValue,
    threshold: calculation.result,
    sourceThreshold: rule.threshold,
    thresholdUnit: calculation.resultUnit,
    calculation,
    severity: rule.severity,
    reason: passes ? 'THRESHOLD_SATISFIED' : 'THRESHOLD_VIOLATED',
  };
}
