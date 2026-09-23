import { createHash } from 'node:crypto';

function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function finite(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric * 1000) / 1000 : null;
}

export function buildRawRecipeContentSignature(input: {
  name: unknown;
  category?: unknown;
  nutrition?: Record<string, unknown> | null;
  ingredients?: readonly { name?: unknown; text?: unknown; quantity?: unknown; unit?: unknown }[];
}): string {
  const nutrition = input.nutrition ?? {};
  const ingredients = (input.ingredients ?? [])
    .map((ingredient) => ({
      name: normalize(ingredient.name ?? ingredient.text),
      quantity: finite(ingredient.quantity),
      unit: normalize(ingredient.unit),
    }))
    .filter((ingredient) => Boolean(ingredient.name))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right), 'en', { sensitivity: 'base' }));
  return createHash('sha256')
    .update(
      JSON.stringify({
        version: 'RAW_RECIPE_SIGNATURE_V1',
        name: normalize(input.name),
        category: normalize(input.category),
        calories: finite(nutrition.calories),
        proteinG: finite(nutrition.proteinG),
        carbsG: finite(nutrition.carbsG),
        fatG: finite(nutrition.fatG),
        ingredients,
      })
    )
    .digest('hex');
}
