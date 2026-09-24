import { normalizeFoodName, scoreStrongFNRIMatch, type FNRIMatchCandidate } from './fnri-match.policy';

export const SOURCE_INGREDIENT_FNRI_MAPPING_VERSION = 'PANLASANG_FNRI_IDENTITY_V1';

export type SourceIngredientMatchMethod = 'CANONICAL_NAME' | 'CURATED_EQUIVALENT' | 'UNIQUE_LEXICAL_MATCH';

export interface SourceIngredientFnriMatch<T extends FNRIMatchCandidate> {
  food: T;
  method: SourceIngredientMatchMethod;
  normalizedSourceName: string;
  lookupName: string;
}

export interface SourceIngredientFnriMatcher<T extends FNRIMatchCandidate> {
  match(sourceName: string): SourceIngredientFnriMatch<T> | null;
}

const FRACTION_OR_NUMBER = String.raw`(?:\d+(?:\s*[./⁄]\s*\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])`;
const LEADING_MEASURE = new RegExp(
  String.raw`^(?:(?:about|approximately|approx\.?|around|a)\s+)?${FRACTION_OR_NUMBER}\s*(?:(?:fl\.?\s*)?oz\.?|ounces?|lbs?\.?|pounds?|kgs?\.?|kilograms?|grams?|g|ml|liters?|litres?|cups?|tablespoons?|tbsp\.?|teaspoons?|tsp\.?|cans?|packs?|pieces?|pcs?\.?)?\s+`,
  'iu'
);

const PREPARATION_WORDS = new Set([
  'beaten',
  'chopped',
  'coarsely',
  'crushed',
  'cubed',
  'cut',
  'diced',
  'divided',
  'drained',
  'finely',
  'grated',
  'julienne',
  'julienned',
  'large',
  'medium',
  'melted',
  'minced',
  'optional',
  'peeled',
  'quartered',
  'rinsed',
  'roughly',
  'seeded',
  'serving',
  'shredded',
  'sifted',
  'sliced',
  'small',
  'softened',
  'strips',
  'thinly',
  'washed',
  'wedged',
]);

const INVALID_SOURCE_LABELS = new Set([
  '',
  'beaten',
  'chopped',
  'cooking procedure',
  'cubed',
  'diced',
  'ingredients',
  'minced',
  'sliced',
  'wedged',
]);

/**
 * These are identity-preserving equivalents for common recipe language. They
 * intentionally do not include generic meats, oils, cheeses, stocks, branded
 * seasonings, or mixed ingredients because those do not identify one FNRI row.
 */
const CURATED_TARGETS: Readonly<Record<string, string>> = Object.freeze({
  'all purpose flour': 'Wheat flour, all-purpose',
  'ap flour': 'Wheat flour, all-purpose',
  butter: 'Butter',
  'coconut oil': 'Oil, coconut',
  'corn oil': 'Oil, corn',
  'cooked rice': 'Rice, well-milled, boiled',
  'cooked white rice': 'Rice, well-milled, boiled',
  'steamed rice': 'Rice, well-milled, boiled',
  'leftover rice': 'Rice, well-milled, boiled',
  'white rice cooked': 'Rice, well-milled, boiled',
  egg: 'Egg, chicken, whole',
  eggs: 'Egg, chicken, whole',
  'raw egg': 'Egg, chicken, whole',
  'raw eggs': 'Egg, chicken, whole',
  'chicken egg': 'Egg, chicken, whole',
  'chicken eggs': 'Egg, chicken, whole',
  'boiled egg': 'Egg, chicken, whole, boiled',
  'boiled eggs': 'Egg, chicken, whole, boiled',
  'hard boiled egg': 'Egg, chicken, whole, boiled',
  'hard boiled eggs': 'Egg, chicken, whole, boiled',
  garlic: 'Garlic bulb',
  'garlic clove': 'Garlic bulb',
  'garlic cloves': 'Garlic bulb',
  onion: 'Onion, Bombay bulb',
  onions: 'Onion, Bombay bulb',
  'yellow onion': 'Onion, Bombay bulb',
  'yellow onions': 'Onion, Bombay bulb',
  'white onion': 'Onion, Bombay bulb',
  'white onions': 'Onion, Bombay bulb',
  'red onion': 'Onion, Bombay bulb',
  'red onions': 'Onion, Bombay bulb',
  scallion: 'Onion, spring',
  scallions: 'Onion, spring',
  'green onion': 'Onion, spring',
  'green onions': 'Onion, spring',
  'spring onion': 'Onion, spring',
  'spring onions': 'Onion, spring',
  carrot: 'Carrot',
  carrots: 'Carrot',
  potato: 'Potato',
  potatoes: 'Potato',
  'baking potato': 'Potato',
  tomato: 'Tomato',
  tomatoes: 'Tomato',
  'plum tomato': 'Tomato',
  'plum tomatoes': 'Tomato',
  eggplant: 'Eggplant',
  eggplants: 'Eggplant',
  'chinese eggplant': 'Eggplant',
  'chinese eggplants': 'Eggplant',
  'green cabbage': 'Cabbage, green',
  cabbage: 'Cabbage, green',
  'red cabbage': 'Cabbage, red',
  'granulated sugar': 'Sugar, white, refined',
  'granulated white sugar': 'Sugar, white, refined',
  'white sugar': 'Sugar, white, refined',
  sugar: 'Sugar, white, refined',
  'brown sugar': 'Sugar, brown',
  'dark brown sugar': 'Sugar, brown',
  'powdered sugar': 'Sugar, pwdr',
  'confectioners sugar': 'Sugar, pwdr',
  'fish sauce': 'Fish sauce',
  patis: 'Fish sauce',
  mayonnaise: 'Mayonnaise',
  'ladys choice mayonnaise': 'Mayonnaise',
  'fresh milk': 'Milk, cow',
  'whole milk': 'Milk, cow',
  'cow milk': 'Milk, cow',
  'evaporated milk': 'Milk, evaporated',
  'condensed milk': 'Milk, sweetn, cond, filled',
  calamansi: 'Calamansi/Philippine lemon',
  'philippine lemon': 'Calamansi/Philippine lemon',
  macaroni: 'Pasta, macaroni',
  'elbow macaroni': 'Pasta, macaroni',
  'chicken cube': 'Bouillon cube, chicken',
  'chicken bouillon cube': 'Bouillon cube, chicken',
});

const AMBIGUOUS_BASES = new Set([
  'beef',
  'cashew',
  'cheese',
  'chicken',
  'cooking oil',
  'fish',
  'meat',
  'milk',
  'oil',
  'pork',
  'rice',
  'seafood',
  'vegetable oil',
]);

function stripPreparationParentheticals(value: string): string {
  return value.replace(/\(([^)]*)\)/gu, (_whole, contents: string) => {
    const words = normalizeFoodName(contents).split(' ').filter(Boolean);
    if (
      words.length === 0 ||
      words.every((word) => PREPARATION_WORDS.has(word) || ['and', 'into', 'to', 'taste'].includes(word))
    ) {
      return ' ';
    }
    // Common bilingual recipe labels do not change the food identity.
    if (['patis', 'gata'].includes(normalizeFoodName(contents))) return ' ';
    return ` ${contents} `;
  });
}

export function normalizeSourceIngredientName(value: string): string {
  let cleaned = value.normalize('NFKC').trim();
  for (let index = 0; index < 2; index += 1) cleaned = cleaned.replace(LEADING_MEASURE, '');
  cleaned = cleaned
    .replace(
      /^(?:(?:fl\.?\s*)?oz\.?|ounces?|lbs?\.?|pounds?|kgs?\.?|kilograms?|grams?|g|ml|liters?|litres?|cups?|tablespoons?|tbsp\.?|teaspoons?|tsp\.?|cans?|packs?|pieces?|pcs?\.?)\s+/iu,
      ''
    )
    .replace(/^a\s+(?:dash|pinch)\s+of\s+/iu, '')
    .replace(/\b(?:to taste|for (?:deep )?frying|for boiling|for garnish|as needed)\b.*$/iu, '')
    .replace(/\b(?:cut\s+into\s+serving\s+pieces|sliced\s+into\s+(?:thin\s+)?strips)\b/giu, ' ');
  cleaned = stripPreparationParentheticals(cleaned);
  const words = normalizeFoodName(cleaned)
    .split(' ')
    .filter((word) => word && !PREPARATION_WORDS.has(word));
  return words.join(' ').trim();
}

export function isInvalidSourceIngredientLabel(value: string): boolean {
  return INVALID_SOURCE_LABELS.has(normalizeSourceIngredientName(value));
}

function uniqueLexicalMatch<T extends FNRIMatchCandidate>(lookupName: string, foods: readonly T[]): T | null {
  if (!lookupName || AMBIGUOUS_BASES.has(lookupName)) return null;
  const scored = foods
    .map((food) => ({ food, score: scoreStrongFNRIMatch(lookupName, food.name) }))
    .filter((entry): entry is { food: T; score: number } => entry.score !== null)
    .sort((left, right) => right.score - left.score || left.food.name.localeCompare(right.food.name));
  if (!scored.length) return null;
  if (scored[1]?.score === scored[0].score) return null;
  const queryTokens = new Set(normalizeFoodName(lookupName).split(' ').filter(Boolean));
  const addedTokens = normalizeFoodName(scored[0].food.name)
    .split(' ')
    .filter((token) => token && !queryTokens.has(token));
  // A lexical match may only add identity-neutral FNRI descriptors. Product,
  // processing, cooking-state, and preservation words can materially change
  // the composition and therefore require an explicit curated mapping.
  const safeAddedTokens = new Set(['bulb', 'fruit', 'leaf', 'leaves', 'lvs', 'meat', 'raw', 'whole']);
  if (addedTokens.some((token) => !safeAddedTokens.has(token))) return null;
  return scored[0].food;
}

export function createSourceIngredientFnriMatcher<T extends FNRIMatchCandidate>(
  foods: readonly T[]
): SourceIngredientFnriMatcher<T> {
  const byCanonicalName = new Map(foods.map((food) => [normalizeFoodName(food.name), food]));
  return {
    match(sourceName: string): SourceIngredientFnriMatch<T> | null {
      const normalizedSourceName = normalizeSourceIngredientName(sourceName);
      if (INVALID_SOURCE_LABELS.has(normalizedSourceName)) return null;

      const exact = byCanonicalName.get(normalizedSourceName);
      if (exact) {
        return { food: exact, method: 'CANONICAL_NAME', normalizedSourceName, lookupName: exact.name };
      }

      const curatedTargetName = CURATED_TARGETS[normalizedSourceName];
      const curated = curatedTargetName ? byCanonicalName.get(normalizeFoodName(curatedTargetName)) : undefined;
      if (curated) {
        return { food: curated, method: 'CURATED_EQUIVALENT', normalizedSourceName, lookupName: curatedTargetName };
      }

      const lexical = uniqueLexicalMatch(normalizedSourceName, foods);
      return lexical
        ? { food: lexical, method: 'UNIQUE_LEXICAL_MATCH', normalizedSourceName, lookupName: normalizedSourceName }
        : null;
    },
  };
}

export function matchSourceIngredientToFnri<T extends FNRIMatchCandidate>(
  sourceName: string,
  foods: readonly T[]
): SourceIngredientFnriMatch<T> | null {
  return createSourceIngredientFnriMatcher(foods).match(sourceName);
}
