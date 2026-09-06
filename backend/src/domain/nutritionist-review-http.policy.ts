const REVIEW_CONFLICT_FRAGMENTS = [
  'already claimed',
  'already reviewed',
  'active claim',
  'Unable to acquire an active claim',
  'Only PENDING_REVIEW',
  'different nutritionist',
] as const;

export function isNutritionistReviewConflict(message: string): boolean {
  return REVIEW_CONFLICT_FRAGMENTS.some((fragment) => message.includes(fragment));
}
