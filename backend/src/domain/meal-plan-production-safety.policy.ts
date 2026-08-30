import type { HealthConditionType } from '@prisma/client';

export const MEAL_PLAN_SAFETY_POLICY_VERSION = 'NUTRIMIND_PLAN_SAFETY_V1';

const ESCALATED_REVIEW_CONDITIONS = new Set<string>([
  'KIDNEY_DISEASE',
  'PREGNANT',
]);

export function requiresEscalatedMealReview(
  conditions: readonly (HealthConditionType | string)[],
  otherConditions?: string | null
): boolean {
  if (conditions.some((condition) => ESCALATED_REVIEW_CONDITIONS.has(String(condition)))) {
    return true;
  }

  const custom = (otherConditions || '').toLowerCase();
  return /\b(renal|kidney|dialysis|pregnan\w*|lactat\w*|breastfeed\w*)\b/.test(custom);
}
