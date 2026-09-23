import { createHash } from 'node:crypto';

export type ObservedIngredient = { name: string; quantity: number; unit: string };

export function normalizeObservedName(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

export function assertShareableText(value: string): boolean {
  return !/@|\b\+?\d[\d\s()-]{8,}\d\b/u.test(value);
}

const round = (value: number) => Math.round(value * 1000) / 1000;

export function observedContentSignature(input: {
  kind: 'FOOD_REFERENCE' | 'RECIPE_CANDIDATE';
  name: string;
  servingGrams: number;
  macros: { calories: number; proteinG: number; carbsG: number; fatG: number };
  ingredients?: ObservedIngredient[];
  preparation?: string;
}): string {
  const ingredients = (input.ingredients ?? []).map((row) => ({
    name: normalizeObservedName(row.name), quantity: round(row.quantity), unit: normalizeObservedName(row.unit),
  })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHash('sha256').update(JSON.stringify({
    version: 'OBSERVED_CONTENT_V1', kind: input.kind, name: normalizeObservedName(input.name),
    servingGrams: round(input.servingGrams),
    macros: Object.fromEntries(Object.entries(input.macros).map(([key, value]) => [key, round(value)])),
    ingredients, preparation: normalizeObservedName(input.preparation ?? ''),
  })).digest('hex');
}
