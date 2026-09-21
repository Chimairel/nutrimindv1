import { AssuranceTier, HealthConditionType } from '@prisma/client';

export const CONDITION_ASSURANCE_TIER: Readonly<Record<HealthConditionType, AssuranceTier>> = Object.freeze({
  NONE: AssuranceTier.BASE,
  HYPERTENSION: AssuranceTier.STANDARD,
  DIABETES: AssuranceTier.STANDARD,
  KIDNEY_DISEASE: AssuranceTier.ENHANCED,
  HEART_CONDITION: AssuranceTier.ENHANCED,
  PREGNANT: AssuranceTier.ENHANCED,
});

const TIER_WEIGHT: Readonly<Record<AssuranceTier, number>> = Object.freeze({
  BASE: 0,
  STANDARD: 1,
  ENHANCED: 2,
});

export function getConditionAssuranceTier(condition: HealthConditionType | string): AssuranceTier {
  return CONDITION_ASSURANCE_TIER[condition as HealthConditionType] ?? AssuranceTier.ENHANCED;
}

export function getMaximumAssuranceTier(conditions: readonly (HealthConditionType | string)[]): AssuranceTier {
  return conditions.reduce<AssuranceTier>((highest, condition) => {
    const candidate = getConditionAssuranceTier(condition);
    return TIER_WEIGHT[candidate] > TIER_WEIGHT[highest] ? candidate : highest;
  }, AssuranceTier.BASE);
}

export function conditionAllowsRulesetAutomation(condition: HealthConditionType | string): boolean {
  return condition === HealthConditionType.HYPERTENSION;
}

export function conditionRequiresUserScopedClearance(condition: HealthConditionType | string): boolean {
  return condition === HealthConditionType.KIDNEY_DISEASE || condition === HealthConditionType.HEART_CONDITION;
}

export function tierRequiresLeadSecondReview(tier: AssuranceTier): boolean {
  return tier === AssuranceTier.ENHANCED;
}
