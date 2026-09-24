export type RiceReference = {
  fnriCode: string;
  name: string;
  per100g: { calories: number; proteinG: number; carbsG: number; fatG: number };
};

export type NullableMacros = {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export const COOKED_RICE_PORTIONS_GRAMS = [0, 75, 150, 225] as const;

export function ricePlateNutrition(base: NullableMacros, cookedGrams: number, rice: RiceReference) {
  if (Object.values(base).some((value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0)) return null;
  if (!Number.isFinite(cookedGrams) || cookedGrams < 0) return null;
  const factor = cookedGrams / 100;
  return {
    calories: base.calories! + rice.per100g.calories * factor,
    proteinG: base.proteinG! + rice.per100g.proteinG * factor,
    carbsG: base.carbsG! + rice.per100g.carbsG * factor,
    fatG: base.fatG! + rice.per100g.fatG * factor,
  };
}
