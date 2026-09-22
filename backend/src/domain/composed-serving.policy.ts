import { createHash } from 'node:crypto';

export const COMPOSED_SERVING_SIGNATURE_VERSION = 'COMPOSED_SERVING_V1';

export interface Macronutrients {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface FnriFoodPer100G extends Macronutrients {
  id: string;
  name: string;
  source: string;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function scaleFnriFoodToGrams(food: FnriFoodPer100G, grams: number): Macronutrients {
  if (!Number.isFinite(grams) || grams <= 0) throw new Error('Cooked rice grams must be a positive number.');
  const factor = grams / 100;
  return {
    calories: round(food.calories * factor),
    proteinG: round(food.proteinG * factor),
    carbsG: round(food.carbsG * factor),
    fatG: round(food.fatG * factor),
  };
}

export function buildComposedServing(input: {
  baseRecipeSignature: string;
  baseNutrition: Macronutrients;
  riceFood: FnriFoodPer100G;
  cookedRiceG: number;
}) {
  if (!/^[a-f0-9]{64}$/u.test(input.baseRecipeSignature)) {
    throw new Error('A composed serving requires a current base recipe signature.');
  }
  if (!/^FNRI/u.test(input.riceFood.source.toUpperCase())) {
    throw new Error('Paired rice nutrition must come from a governed FNRI food record.');
  }
  const riceNutrition = scaleFnriFoodToGrams(input.riceFood, input.cookedRiceG);
  const total = {
    calories: round(input.baseNutrition.calories + riceNutrition.calories),
    proteinG: round(input.baseNutrition.proteinG + riceNutrition.proteinG),
    carbsG: round(input.baseNutrition.carbsG + riceNutrition.carbsG),
    fatG: round(input.baseNutrition.fatG + riceNutrition.fatG),
  };
  const canonical = JSON.stringify({
    version: COMPOSED_SERVING_SIGNATURE_VERSION,
    baseRecipeSignature: input.baseRecipeSignature,
    components: [
      { kind: 'BASE_RECIPE', signature: input.baseRecipeSignature },
      { kind: 'COOKED_RICE', foodItemId: input.riceFood.id, grams: round(input.cookedRiceG) },
    ],
  });
  return {
    riceNutrition,
    total,
    composedServingSignature: createHash('sha256').update(canonical).digest('hex'),
  };
}

export function includedRiceEvidenceIsEvaluable(input: {
  riceRole: string | null | undefined;
  riceRoleReviewStatus: string;
  includedRiceG: number | null | undefined;
}): boolean {
  if (input.riceRoleReviewStatus !== 'REVIEWED' || !input.riceRole) return false;
  return input.riceRole !== 'INCLUDES_RICE' || Boolean(input.includedRiceG && input.includedRiceG > 0);
}
