import { DietaryPreference } from '@prisma/client';

const excludedAnimalGroups: Record<DietaryPreference, ReadonlySet<string>> = {
  OMNIVORE: new Set(),
  PESCATARIAN: new Set(['MEAT', 'POULTRY']),
  VEGETARIAN: new Set(['MEAT', 'POULTRY', 'SEAFOOD']),
  VEGAN: new Set(['MEAT', 'POULTRY', 'SEAFOOD', 'DAIRY', 'EGGS']),
};

/** True only when the new diet introduces at least one new hard exclusion. */
export function introducesHardDietRestriction(
  previous: DietaryPreference | null | undefined,
  next: DietaryPreference | null | undefined
): boolean {
  if (!previous || !next || previous === next) return false;
  const before = excludedAnimalGroups[previous];
  return [...excludedAnimalGroups[next]].some((group) => !before.has(group));
}
