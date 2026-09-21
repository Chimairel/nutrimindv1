import { createHash } from 'node:crypto';

export const MEAL_LIBRARY_SIGNATURE_VERSION = 'RECIPE_SIGNATURE_V1';

export interface RecipeSignatureInput {
  mealName: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: readonly {
    ingredientName: string;
    foodItemId?: string | null;
    quantity?: number | null;
    unit?: string | null;
  }[];
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function rounded(value: number | null | undefined): number | null {
  return value === null || value === undefined || !Number.isFinite(value) ? null : Math.round(value * 1000) / 1000;
}

export function buildMealLibraryRecipeSignature(input: RecipeSignatureInput): string {
  const ingredients = input.ingredients
    .map((ingredient) => ({
      identity: ingredient.foodItemId
        ? `food:${ingredient.foodItemId}`
        : `name:${normalizeText(ingredient.ingredientName)}`,
      quantity: rounded(ingredient.quantity),
      unit: normalizeText(ingredient.unit ?? ''),
    }))
    .sort(
      (left, right) =>
        left.identity.localeCompare(right.identity) ||
        (left.quantity ?? -1) - (right.quantity ?? -1) ||
        left.unit.localeCompare(right.unit)
    );
  const canonical = JSON.stringify({
    version: MEAL_LIBRARY_SIGNATURE_VERSION,
    mealName: normalizeText(input.mealName),
    mealType: input.mealType,
    calories: rounded(input.calories),
    proteinG: rounded(input.proteinG),
    carbsG: rounded(input.carbsG),
    fatG: rounded(input.fatG),
    ingredients,
  });
  return createHash('sha256').update(canonical).digest('hex');
}
