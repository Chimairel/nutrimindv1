import type { LibraryMeal } from './useNutritionistLibrary';

export function libraryEvidenceStatus(meal: LibraryMeal) {
  if (meal.status === 'ARCHIVED') return { label: 'Archived', next: 'This recipe is not available for reuse.' };
  if (meal.status === 'FLAGGED' || (meal.flags?.length ?? 0) > 0)
    return { label: 'Flagged', next: 'Resolve the flag before reviewing this recipe.' };
  if (meal.safetyEvidenceStatus === 'COMPLETE' && meal.certifiedEvidenceRevision === meal.safetyEvidenceRevision) {
    return {
      label: 'Verified for reuse',
      next: 'Current recipe evidence was signed off. Each user’s restrictions are still checked.',
    };
  }
  if (!meal.ingredients?.length)
    return { label: 'Needs recipe details', next: 'Add a stable ingredient list before this recipe can be reviewed.' };
  if (meal.preparedNutritionRevision === meal.safetyEvidenceRevision) {
    return {
      label: meal.safetyEvidenceStatus === 'STALE' ? 'Needs re-review' : 'Ready for nutritionist review',
      next: 'Review allergen and preparation evidence, then sign off on this recipe revision.',
    };
  }
  const unidentified = meal.ingredients.filter((item) => !item.foodItemId).length;
  const unmeasured = meal.ingredients.filter(
    (item) => item.unit !== 'g' || !item.quantity || item.quantity <= 0
  ).length;
  const steps = [
    unidentified ? `match ${unidentified} ingredient${unidentified === 1 ? '' : 's'} to a food record` : null,
    unmeasured ? `record edible grams for ${unmeasured} ingredient${unmeasured === 1 ? '' : 's'}` : null,
    'calculate nutrition for this serving',
  ]
    .filter(Boolean)
    .join(', ');
  return { label: 'Needs recipe details', next: `Next: ${steps}.` };
}
