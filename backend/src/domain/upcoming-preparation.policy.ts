import { createHash } from 'node:crypto';
import { AssuranceTier, RecipeRiceRole, RicePreference, RiceRoleReviewStatus } from '@prisma/client';

export const UPCOMING_PREPARATION_POLICY_VERSION = 'UPCOMING_PREPARATION_V1';
export const STANDARD_PREPARATION_LEAD_DAYS = 3;
export const ENHANCED_PREPARATION_LEAD_DAYS = 5;
export const DEADLINE_FALLBACK_CALORIE_TOLERANCE = 0.3;

export type PreparationRankingReasonCode =
  | 'ACTIVE_CLEARANCE_COVERAGE'
  | 'ALLERGEN_DECLARATIONS_COMPLETE'
  | 'INGREDIENTS_RESOLVED'
  | 'NUTRIENTS_COMPLETE'
  | 'DIET_MATCH'
  | 'NO_REVIEW_REMAINING'
  | 'SINGLE_REVIEW_REMAINING'
  | 'TWO_REVIEWS_REMAINING'
  | 'CALORIE_FIT'
  | 'MEAL_TYPE_MATCH'
  | 'RICE_PREFERENCE_MATCH'
  | 'LOCALITY_EVIDENCE_MATCH'
  | 'VARIETY_PREFERRED';

export interface PreparationCandidateScoreInput {
  activeClearanceCoverage: boolean;
  allergenDeclarationsComplete: boolean;
  ingredientsResolved: boolean;
  nutrientsComplete: boolean;
  dietCompatible: boolean;
  remainingReviews: 0 | 1 | 2;
  calorieDeviationRatio: number;
  mealTypeMatch: boolean;
  ricePreference?: RicePreference | null;
  riceRole?: RecipeRiceRole | null;
  riceRoleReviewStatus?: RiceRoleReviewStatus | null;
  localityScore?: number;
  usedInRecentCycle?: boolean;
}

export function getPreparationLeadDays(tier: AssuranceTier): number {
  return tier === AssuranceTier.ENHANCED
    ? ENHANCED_PREPARATION_LEAD_DAYS
    : STANDARD_PREPARATION_LEAD_DAYS;
}

export function scorePreparationCandidate(input: PreparationCandidateScoreInput): {
  score: number;
  reasonCodes: PreparationRankingReasonCode[];
} {
  const reasons: PreparationRankingReasonCode[] = [];
  let score = 0;
  const add = (condition: boolean, points: number, reason: PreparationRankingReasonCode) => {
    if (!condition) return;
    score += points;
    reasons.push(reason);
  };

  add(input.activeClearanceCoverage, 30, 'ACTIVE_CLEARANCE_COVERAGE');
  add(input.allergenDeclarationsComplete, 18, 'ALLERGEN_DECLARATIONS_COMPLETE');
  add(input.ingredientsResolved, 14, 'INGREDIENTS_RESOLVED');
  add(input.nutrientsComplete, 10, 'NUTRIENTS_COMPLETE');
  add(input.dietCompatible, 12, 'DIET_MATCH');
  add(input.mealTypeMatch, 12, 'MEAL_TYPE_MATCH');

  if (input.remainingReviews === 0) {
    score += 24;
    reasons.push('NO_REVIEW_REMAINING');
  } else if (input.remainingReviews === 1) {
    score += 8;
    reasons.push('SINGLE_REVIEW_REMAINING');
  } else {
    reasons.push('TWO_REVIEWS_REMAINING');
  }

  const deviation = Number.isFinite(input.calorieDeviationRatio)
    ? Math.max(0, input.calorieDeviationRatio)
    : 1;
  add(deviation <= 0.15, Math.max(0, 12 - deviation * 40), 'CALORIE_FIT');

  const reviewedRiceRole = input.riceRoleReviewStatus === RiceRoleReviewStatus.REVIEWED;
  const riceMatches =
    input.ricePreference === RicePreference.NO_RICE
      ? reviewedRiceRole && input.riceRole === RecipeRiceRole.STANDALONE
      : input.ricePreference === RicePreference.WITH_RICE
        ? reviewedRiceRole &&
          (input.riceRole === RecipeRiceRole.PAIR_WITH_RICE || input.riceRole === RecipeRiceRole.INCLUDES_RICE)
        : reviewedRiceRole;
  add(riceMatches, 5, 'RICE_PREFERENCE_MATCH');
  add((input.localityScore ?? 0) > 0, Math.min(5, input.localityScore ?? 0), 'LOCALITY_EVIDENCE_MATCH');
  add(!input.usedInRecentCycle, 4, 'VARIETY_PREFERRED');

  return { score: Math.round(score * 1000) / 1000, reasonCodes: reasons };
}

export function buildReviewWorkKey(input: {
  recipeSignature: string;
  evidenceRevision: number;
  conditions: readonly string[];
  allergens: readonly string[];
  policyVersion: string;
  requiredReviewerCount: number;
}): string {
  const canonical = JSON.stringify({
    version: 'REVIEW_WORK_KEY_V1',
    recipeSignature: input.recipeSignature,
    evidenceRevision: input.evidenceRevision,
    conditions: [...new Set(input.conditions.filter((value) => value !== 'NONE'))].sort(),
    allergens: [...new Set(input.allergens.filter((value) => value !== 'NONE'))].sort(),
    policyVersion: input.policyVersion,
    requiredReviewerCount: input.requiredReviewerCount,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function chooseCookedRicePortionG(input: {
  baseCalories: number;
  riceCaloriesPer100G: number;
  slotTargetCalories: number;
  slotMinimumCalories: number;
  slotMaximumCalories: number;
}): number | null {
  const portions = [75, 150, 225] as const;
  const eligible = portions
    .map((grams) => ({
      grams,
      calories: input.baseCalories + (input.riceCaloriesPer100G * grams) / 100,
    }))
    .filter((item) => item.calories >= input.slotMinimumCalories && item.calories <= input.slotMaximumCalories)
    .sort(
      (left, right) =>
        Math.abs(left.calories - input.slotTargetCalories) - Math.abs(right.calories - input.slotTargetCalories) ||
        left.grams - right.grams
    );
  return eligible[0]?.grams ?? null;
}

export function compareDeadlineReviewPriority(
  left: { shoppingDeadlineAt: Date; scheduledDate: Date; enhancedSecondReview: boolean; createdAt: Date },
  right: { shoppingDeadlineAt: Date; scheduledDate: Date; enhancedSecondReview: boolean; createdAt: Date }
): number {
  return (
    left.shoppingDeadlineAt.getTime() - right.shoppingDeadlineAt.getTime() ||
    left.scheduledDate.getTime() - right.scheduledDate.getTime() ||
    Number(right.enhancedSecondReview) - Number(left.enhancedSecondReview) ||
    left.createdAt.getTime() - right.createdAt.getTime()
  );
}
