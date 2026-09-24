import type { DietaryPreference } from '@prisma/client';

export const MEAL_INGREDIENT_CLASSIFICATION_VERSION = 'INGREDIENT_CLASSIFIER_V1';

export type CanonicalAllergen = 'SHELLFISH' | 'NUTS' | 'DAIRY' | 'GLUTEN' | 'EGGS';
export type IngredientClassificationStatus = 'COMPLETE' | 'NEEDS_REVIEW';

export interface IngredientClassificationInput {
  name: string;
  category?: string | null;
}

export interface IngredientClassificationResult {
  status: IngredientClassificationStatus;
  detectedAllergens: CanonicalAllergen[];
  compatibleDietaryPreferences: DietaryPreference[];
  unknownIngredients: string[];
  normalizedIngredients: string[];
  findings: Array<{ ingredient: string; facts: string[] }>;
}

const ALLERGEN_PATTERNS: Readonly<Record<CanonicalAllergen, readonly RegExp[]>> = Object.freeze({
  SHELLFISH: [
    /\bshrimp\b/u,
    /\bprawn\b/u,
    /\bcrab\b/u,
    /\blobster\b/u,
    /\bcrayfish\b/u,
    /\bshellfish\b/u,
    /\bmussel\b/u,
    /\boyster\b/u,
    /\bscallop\b/u,
    /\bclam\b/u,
    /\bsquid\b/u,
    /\boctopus\b/u,
    /\bhipon\b/u,
    /\balimango\b/u,
    /\balimasag\b/u,
    /\btahong\b/u,
    /\btalaba\b/u,
    /\balamang\b/u,
  ],
  NUTS: [
    /\bpeanut(?:s)?\b/u,
    /\bcashew(?:s)?\b/u,
    /\balmond(?:s)?\b/u,
    /\bwalnut(?:s)?\b/u,
    /\bpistachio(?:s)?\b/u,
    /\bhazelnut(?:s)?\b/u,
    /\bpecan(?:s)?\b/u,
    /\bmacadamia(?:s)?\b/u,
    /\bnut butter\b/u,
    /\bmani\b/u,
    /\bkasuy\b/u,
  ],
  DAIRY: [
    /(?<!coconut |soy |almond |oat |rice )\bmilk\b/u,
    /\bcheese\b/u,
    /(?<!peanut |cocoa |coconut )\bbutter\b/u,
    /(?<!coconut )\bcream\b/u,
    /\byog(?:h)?urt\b/u,
    /\bwhey\b/u,
    /\bcasein\b/u,
    /\bcondensed milk\b/u,
    /\bevaporated milk\b/u,
    /\bgatas\b/u,
    /\bkeso\b/u,
  ],
  GLUTEN: [
    /\bwheat\b/u,
    /(?<!rice |corn |cassava |tapioca |potato |coconut |almond )\bflour\b/u,
    /\bbread(?:crumbs?)?\b/u,
    /\bpasta\b/u,
    /(?<!rice )\bnoodles?\b/u,
    /\bsoy sauce\b/u,
    /\bseitan\b/u,
    /\bbarley\b/u,
    /\brye\b/u,
  ],
  EGGS: [/\begg(?:s)?\b/u, /\bmayonnaise\b/u, /\bmayo\b/u, /\bitlog\b/u, /\bbalut\b/u, /\bpenoy\b/u],
});

const MEAT_PATTERNS = [
  /\bbeef\b/u,
  /\bpork\b/u,
  /\bchicken\b/u,
  /\bturkey\b/u,
  /\bduck\b/u,
  /\bgoat\b/u,
  /\blamb\b/u,
  /\bmeat\b/u,
  /\bham\b/u,
  /\bbacon\b/u,
  /\bsausage\b/u,
  /\blonggani[sz]a\b/u,
  /\bhotdog\b/u,
  /\btocino\b/u,
  /\btapa\b/u,
  /\bcarne\b/u,
  /\bgelatin\b/u,
  /\blard\b/u,
] as const;

const SEAFOOD_PATTERNS = [
  /\bfish\b/u,
  /\btuna\b/u,
  /\bsalmon\b/u,
  /\btilapia\b/u,
  /\bbangus\b/u,
  /\bgalunggong\b/u,
  /\bsardine(?:s)?\b/u,
  /\banchov(?:y|ies)\b/u,
  /\bseafood\b/u,
  ...ALLERGEN_PATTERNS.SHELLFISH,
] as const;

const ANIMAL_DERIVED_PATTERNS = [
  ...ALLERGEN_PATTERNS.DAIRY,
  ...ALLERGEN_PATTERNS.EGGS,
  /\bhoney\b/u,
  /\bfish sauce\b/u,
  /\boyster sauce\b/u,
  /\bshrimp paste\b/u,
  /\bbagoong\b/u,
] as const;

// These broad food words make a negative diet conclusion possible. An
// unrecognized ingredient keeps the result conservative instead of silently
// being treated as plant based.
const RECOGNIZED_NON_ANIMAL_PATTERNS = [
  /\b(?:rice|corn|oat|quinoa|noodle|pasta|bread|flour|starch|sugar|salt|pepper|spice|seasoning|oil|vinegar|water|stock|broth)\b/u,
  /\b(?:tomato|onion|garlic|ginger|carrots?|potato|sweet potato|kamote|squash|pumpkin|eggplant|okra|cabbage|lettuce|spinach|kangkong|pechay|broccoli|cauliflower|bean|pea|lentil|chickpea|tofu|tempeh|mushroom)\b/u,
  /\b(?:banana|mango|papaya|pineapple|apple|orange|lemon|lime|calamansi|coconut|avocado|strawberry|fruit)\b/u,
  /\b(?:soy|miso|tahini|sesame|cacao|cocoa|chocolate|coffee|tea|herb|basil|oregano|parsley|cilantro|spring onion|chili)\b/u,
] as const;

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

export function classifyMealIngredients(
  ingredients: readonly IngredientClassificationInput[]
): IngredientClassificationResult {
  const detectedAllergens = new Set<CanonicalAllergen>();
  const unknownIngredients: string[] = [];
  const normalizedIngredients: string[] = [];
  const findings: IngredientClassificationResult['findings'] = [];
  let hasMeat = false;
  let hasSeafood = false;
  let hasAnimalDerived = false;

  for (const ingredient of ingredients) {
    const normalized = normalize(ingredient.name ?? '');
    const classificationText = `${normalized} ${normalize(ingredient.category ?? '')}`.trim();
    const facts: string[] = [];
    if (!normalized) {
      unknownIngredients.push(String(ingredient.name ?? ''));
      continue;
    }
    normalizedIngredients.push(normalized);

    for (const [allergen, patterns] of Object.entries(ALLERGEN_PATTERNS) as Array<
      [CanonicalAllergen, readonly RegExp[]]
    >) {
      if (matchesAny(classificationText, patterns)) {
        detectedAllergens.add(allergen);
        facts.push(`ALLERGEN_${allergen}`);
      }
    }

    const meat = matchesAny(classificationText, MEAT_PATTERNS);
    const seafood = matchesAny(classificationText, SEAFOOD_PATTERNS);
    const animalDerived = matchesAny(classificationText, ANIMAL_DERIVED_PATTERNS);
    hasMeat ||= meat;
    hasSeafood ||= seafood;
    hasAnimalDerived ||= animalDerived;
    if (meat) facts.push('MEAT');
    if (seafood) facts.push('SEAFOOD');
    if (animalDerived) facts.push('ANIMAL_DERIVED');

    const recognized =
      meat ||
      seafood ||
      animalDerived ||
      matchesAny(classificationText, RECOGNIZED_NON_ANIMAL_PATTERNS) ||
      Boolean(ingredient.category?.trim());
    if (!recognized) unknownIngredients.push(ingredient.name);
    findings.push({ ingredient: ingredient.name, facts });
  }

  const status: IngredientClassificationStatus =
    ingredients.length > 0 && unknownIngredients.length === 0 ? 'COMPLETE' : 'NEEDS_REVIEW';
  const compatibleDietaryPreferences: DietaryPreference[] = ['OMNIVORE'];
  if (status === 'COMPLETE' && !hasMeat) {
    compatibleDietaryPreferences.push('PESCATARIAN');
    if (!hasSeafood) {
      compatibleDietaryPreferences.push('VEGETARIAN');
      if (!hasAnimalDerived) compatibleDietaryPreferences.push('VEGAN');
    }
  }

  return {
    status,
    detectedAllergens: [...detectedAllergens].sort(),
    compatibleDietaryPreferences,
    unknownIngredients: [...new Set(unknownIngredients)].sort(),
    normalizedIngredients,
    findings,
  };
}

export function hasDefiniteDietaryConflict(
  classification: IngredientClassificationResult,
  preference: DietaryPreference
): boolean {
  if (preference === 'OMNIVORE') return false;
  if (classification.status !== 'COMPLETE') return false;
  return !classification.compatibleDietaryPreferences.includes(preference);
}
