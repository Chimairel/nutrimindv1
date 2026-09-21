import type { DietaryPreference } from '@prisma/client';
import { classifyMealIngredients, hasDefiniteDietaryConflict } from './meal-ingredient-classification.policy';

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

export interface GeneratedMealValidationInput {
  ingredients: readonly { name: string; category?: string | null }[];
  dietaryPreference: DietaryPreference;
  allergens: readonly string[];
  customAllergies?: readonly string[];
}

export interface GeneratedMealValidationResult {
  accepted: boolean;
  definiteConflicts: string[];
  reviewReasons: string[];
  classification: ReturnType<typeof classifyMealIngredients>;
}

export function validateGeneratedMealCandidate(input: GeneratedMealValidationInput): GeneratedMealValidationResult {
  const classification = classifyMealIngredients(input.ingredients);
  const definiteConflicts: string[] = [];
  const reviewReasons: string[] = [];
  const requestedAllergens = new Set(input.allergens.filter((value) => value !== 'NONE'));
  for (const allergen of classification.detectedAllergens) {
    if (requestedAllergens.has(allergen)) definiteConflicts.push(`ALLERGEN_${allergen}`);
  }

  const ingredientText = input.ingredients.map((ingredient) => normalize(ingredient.name)).join(' | ');
  for (const allergy of input.customAllergies ?? []) {
    const normalized = normalize(allergy);
    if (normalized.length >= 3 && ingredientText.includes(normalized)) {
      definiteConflicts.push(`CUSTOM_ALLERGEN_${normalized.toUpperCase().replace(/ /gu, '_')}`);
    }
  }

  if (hasDefiniteDietaryConflict(classification, input.dietaryPreference)) {
    definiteConflicts.push(`DIETARY_${input.dietaryPreference}`);
  }
  if (classification.status !== 'COMPLETE') {
    reviewReasons.push('INGREDIENT_CLASSIFICATION_INCOMPLETE');
  }

  return {
    accepted: definiteConflicts.length === 0,
    definiteConflicts: [...new Set(definiteConflicts)].sort(),
    reviewReasons,
    classification,
  };
}

export function splitCustomRestrictions(value?: string | null): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
