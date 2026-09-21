import type { HealthConditionType } from '@prisma/client';
import { AssuranceTier } from '@prisma/client';
import { getMaximumAssuranceTier } from './assurance-tier.policy';

export const MEAL_PLAN_SAFETY_POLICY_VERSION = 'NUTRIMIND_PLAN_SAFETY_V2';

export function requiresEscalatedMealReview(
  conditions: readonly (HealthConditionType | string)[],
  otherConditions?: string | null
): boolean {
  if (getMaximumAssuranceTier(conditions) === AssuranceTier.ENHANCED) {
    return true;
  }

  const custom = (otherConditions || '').toLowerCase();
  return /\b(renal|kidney|dialysis|heart|cardiac|pregnan\w*|lactat\w*|breastfeed\w*)\b/.test(custom);
}
