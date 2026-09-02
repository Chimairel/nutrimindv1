export const SUPPORTED_LIBRARY_ALLERGENS = [
  'SHELLFISH',
  'NUTS',
  'DAIRY',
  'GLUTEN',
  'EGGS',
] as const;

export type SupportedLibraryAllergen = typeof SUPPORTED_LIBRARY_ALLERGENS[number];
export type CatalogueMealType = 'BREAKFAST' | 'LUNCH' | 'DINNER';
export type CatalogueDiet = 'OMNIVORE' | 'VEGETARIAN' | 'VEGAN' | 'PESCATARIAN';
export type CatalogueSupportedCondition = 'DIABETES' | 'HYPERTENSION';

export const CONDITION_AWARE_CATALOGUE_RULES = Object.freeze({
  diabetesMaxCarbsGPerMeal: 60,
  hypertensionMaxSodiumMgPerMeal: 600,
});

export function deriveCatalogueConditionSuitability(nutrition: {
  carbsG: number;
  sodiumMg: number | null;
}): CatalogueSupportedCondition[] {
  const suitable: CatalogueSupportedCondition[] = [];
  if (nutrition.carbsG <= CONDITION_AWARE_CATALOGUE_RULES.diabetesMaxCarbsGPerMeal) {
    suitable.push('DIABETES');
  }
  if (
    nutrition.sodiumMg !== null &&
    nutrition.sodiumMg <= CONDITION_AWARE_CATALOGUE_RULES.hypertensionMaxSodiumMgPerMeal
  ) {
    suitable.push('HYPERTENSION');
  }
  return suitable;
}

export interface CommonMealIngredient {
  foodName: string;
  grams: number;
  category: 'GRAINS' | 'PROTEIN' | 'VEGETABLES' | 'FRUITS' | 'DAIRY' | 'PANTRY';
}

export interface CommonMealDefinition {
  mealName: string;
  description: string;
  mealType: CatalogueMealType;
  diets: CatalogueDiet[];
  allergensPresent: SupportedLibraryAllergen[];
  ingredients: CommonMealIngredient[];
}

const allGoals = ['LOSE_WEIGHT', 'GAIN_WEIGHT', 'MAINTAIN', 'BUILD_MUSCLE'] as const;

export function getCatalogueDietaryTags(meal: CommonMealDefinition): string[] {
  return [...meal.diets, ...allGoals];
}

const omnivore: CatalogueDiet[] = ['OMNIVORE'];
const pescatarian: CatalogueDiet[] = ['OMNIVORE', 'PESCATARIAN'];
const vegetarian: CatalogueDiet[] = ['OMNIVORE', 'PESCATARIAN', 'VEGETARIAN'];
const vegan: CatalogueDiet[] = ['OMNIVORE', 'PESCATARIAN', 'VEGETARIAN', 'VEGAN'];

const ingredient = (
  foodName: string,
  grams: number,
  category: CommonMealIngredient['category']
): CommonMealIngredient => ({ foodName, grams, category });

/**
 * A managed catalogue of familiar, practical meals for supported profiles.
 * Quantities are edible cooked weights where the FNRI item is a cooked food.
 * Nutrients and bounded condition suitability are calculated from the linked
 * FNRI rows by the population script.
 */
export const COMMON_MEAL_CATALOGUE: CommonMealDefinition[] = [
  {
    mealName: 'Scrambled Egg and Rice Plate',
    description: 'Soft scrambled egg served with steamed rice and fresh tomato.',
    mealType: 'BREAKFAST', diets: omnivore, allergensPresent: ['EGGS'],
    ingredients: [ingredient('Rice, well-milled, boiled', 160, 'GRAINS'), ingredient('Egg, chicken, whole', 100, 'PROTEIN'), ingredient('Tomato', 60, 'VEGETABLES')],
  },
  {
    mealName: 'Pandesal, Egg and Tomato Breakfast',
    description: 'Warm pandesal with sliced boiled egg and tomato.',
    mealType: 'BREAKFAST', diets: omnivore, allergensPresent: ['GLUTEN', 'EGGS'],
    ingredients: [ingredient('Bread, pan de sal', 70, 'GRAINS'), ingredient('Egg, chicken, whole, boiled', 55, 'PROTEIN'), ingredient('Tomato', 50, 'VEGETABLES')],
  },
  {
    mealName: 'Banana Peanut Butter Oatmeal',
    description: 'Cooked oats topped with saba banana and peanut butter.',
    mealType: 'BREAKFAST', diets: vegetarian, allergensPresent: ['GLUTEN', 'NUTS'],
    ingredients: [ingredient('Oats, quick-cooking, ckd', 250, 'GRAINS'), ingredient('Banana, saba', 80, 'FRUITS'), ingredient('Peanut butter', 20, 'PROTEIN')],
  },
  {
    mealName: 'Papaya Milk Oatmeal',
    description: 'Creamy cooked oats with cow milk and ripe papaya.',
    mealType: 'BREAKFAST', diets: vegetarian, allergensPresent: ['GLUTEN', 'DAIRY'],
    ingredients: [ingredient('Oats, quick-cooking, ckd', 250, 'GRAINS'), ingredient('Milk, cow', 150, 'DAIRY'), ingredient('Papaya fruit, ripe', 100, 'FRUITS')],
  },
  {
    mealName: 'Tuna Pandesal Sandwich',
    description: 'Tuna flakes in brine with cucumber and tomato in pandesal.',
    mealType: 'BREAKFAST', diets: pescatarian, allergensPresent: ['GLUTEN'],
    ingredients: [ingredient('Bread, pan de sal', 70, 'GRAINS'), ingredient('Tuna flakes, in brine, cnd', 80, 'PROTEIN'), ingredient('Cucumber', 50, 'VEGETABLES'), ingredient('Tomato', 50, 'VEGETABLES')],
  },
  {
    mealName: 'Tofu Tomato Breakfast Rice Bowl',
    description: 'Soft tofu, tomato, and onion over steamed rice.',
    mealType: 'BREAKFAST', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Rice, well-milled, boiled', 160, 'GRAINS'), ingredient('Soybean cheese, soft curd', 120, 'PROTEIN'), ingredient('Tomato', 70, 'VEGETABLES'), ingredient('Onion, Bombay bulb', 20, 'VEGETABLES')],
  },
  {
    mealName: 'Sardines and Rice Breakfast Plate',
    description: 'Canned sardines in tomato sauce served with steamed rice and tomato.',
    mealType: 'BREAKFAST', diets: pescatarian, allergensPresent: [],
    ingredients: [ingredient('Rice, well-milled, boiled', 160, 'GRAINS'), ingredient('Sardines, in tomato sce, cnd', 100, 'PROTEIN'), ingredient('Tomato', 50, 'VEGETABLES')],
  },
  {
    mealName: 'Sweet Potato and Egg Plate',
    description: 'Boiled purple sweet potato with boiled egg and cucumber.',
    mealType: 'BREAKFAST', diets: omnivore, allergensPresent: ['EGGS'],
    ingredients: [ingredient('Sweet potato, purple, boiled', 180, 'GRAINS'), ingredient('Egg, chicken, whole, boiled', 55, 'PROTEIN'), ingredient('Cucumber', 70, 'VEGETABLES')],
  },
  {
    mealName: 'Corn and Egg Breakfast Bowl',
    description: 'Boiled yellow corn with boiled egg and tomato.',
    mealType: 'BREAKFAST', diets: omnivore, allergensPresent: ['EGGS'],
    ingredients: [ingredient('Corn on cob, yellow, boiled', 150, 'GRAINS'), ingredient('Egg, chicken, whole, boiled', 55, 'PROTEIN'), ingredient('Tomato', 50, 'VEGETABLES')],
  },
  {
    mealName: 'Peanut Butter Pandesal with Apple',
    description: 'Pandesal spread with peanut butter and served with red apple.',
    mealType: 'BREAKFAST', diets: vegetarian, allergensPresent: ['GLUTEN', 'NUTS'],
    ingredients: [ingredient('Bread, pan de sal', 70, 'GRAINS'), ingredient('Peanut butter', 20, 'PROTEIN'), ingredient('Apple, red', 120, 'FRUITS')],
  },
  {
    mealName: 'Sweet Potato Banana Breakfast Bowl',
    description: 'Boiled purple sweet potato with sliced saba banana for a simple plant-based breakfast.',
    mealType: 'BREAKFAST', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Sweet potato, purple, boiled', 120, 'GRAINS'), ingredient('Banana, saba', 80, 'FRUITS')],
  },
  {
    mealName: 'Corn Papaya Breakfast Bowl',
    description: 'Boiled yellow corn served with ripe papaya.',
    mealType: 'BREAKFAST', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Corn on cob, yellow, boiled', 130, 'GRAINS'), ingredient('Papaya fruit, ripe', 120, 'FRUITS')],
  },
  {
    mealName: 'Tofu Potato Tomato Breakfast',
    description: 'Soft tofu with boiled potato and fresh tomato.',
    mealType: 'BREAKFAST', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Soybean cheese, soft curd', 150, 'PROTEIN'), ingredient('Potato, boiled', 160, 'GRAINS'), ingredient('Tomato', 70, 'VEGETABLES')],
  },

  {
    mealName: 'Chicken Rice and Pechay Bowl',
    description: 'Chicken breast with steamed rice, boiled pechay, and tomato.',
    mealType: 'LUNCH', diets: omnivore, allergensPresent: [],
    ingredients: [ingredient('Rice, well-milled, boiled', 180, 'GRAINS'), ingredient('Chicken breast', 130, 'PROTEIN'), ingredient('Pechay lvs, boiled', 100, 'VEGETABLES'), ingredient('Tomato', 50, 'VEGETABLES')],
  },
  {
    mealName: 'Beef Rice Bowl with Cabbage',
    description: 'Boiled lean beef with steamed rice, cabbage, and onion.',
    mealType: 'LUNCH', diets: omnivore, allergensPresent: [],
    ingredients: [ingredient('Rice, well-milled, boiled', 180, 'GRAINS'), ingredient('Beef lean meat, boiled', 120, 'PROTEIN'), ingredient('Cabbage, green, boiled', 100, 'VEGETABLES'), ingredient('Onion, Bombay bulb, boiled', 25, 'VEGETABLES')],
  },
  {
    mealName: 'Pork Rice Bowl with Carrots',
    description: 'Lean boiled pork with steamed rice, carrot, and cabbage.',
    mealType: 'LUNCH', diets: omnivore, allergensPresent: [],
    ingredients: [ingredient('Rice, well-milled, boiled', 170, 'GRAINS'), ingredient('Pork Boston butt, lean, boiled', 110, 'PROTEIN'), ingredient('Carrot, boiled', 80, 'VEGETABLES'), ingredient('Cabbage, green, boiled', 80, 'VEGETABLES')],
  },
  {
    mealName: 'Grilled Milkfish Rice Plate',
    description: 'Broiled milkfish with steamed rice, tomato, and cucumber.',
    mealType: 'LUNCH', diets: pescatarian, allergensPresent: [],
    ingredients: [ingredient('Rice, well-milled, boiled', 180, 'GRAINS'), ingredient('Milkfish, broiled', 130, 'PROTEIN'), ingredient('Tomato', 70, 'VEGETABLES'), ingredient('Cucumber', 70, 'VEGETABLES')],
  },
  {
    mealName: 'Tilapia Rice and Fresh Vegetable Plate',
    description: 'Tilapia with steamed rice, tomato, cucumber, and lettuce.',
    mealType: 'LUNCH', diets: pescatarian, allergensPresent: [],
    ingredients: [ingredient('Rice, well-milled, boiled', 180, 'GRAINS'), ingredient('Tilapia', 130, 'PROTEIN'), ingredient('Tomato', 60, 'VEGETABLES'), ingredient('Cucumber', 60, 'VEGETABLES'), ingredient('Lettuce lvs & petioles', 40, 'VEGETABLES')],
  },
  {
    mealName: 'Tuna Cucumber Rice Bowl',
    description: 'Tuna flakes in brine over steamed rice with cucumber and tomato.',
    mealType: 'LUNCH', diets: pescatarian, allergensPresent: [],
    ingredients: [ingredient('Rice, well-milled, boiled', 180, 'GRAINS'), ingredient('Tuna flakes, in brine, cnd', 110, 'PROTEIN'), ingredient('Cucumber', 70, 'VEGETABLES'), ingredient('Tomato', 60, 'VEGETABLES')],
  },
  {
    mealName: 'Munggo, Kangkong and Rice Bowl',
    description: 'Boiled green mung beans with kangkong and steamed rice.',
    mealType: 'LUNCH', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Rice, well-milled, boiled', 160, 'GRAINS'), ingredient('Mung bean seed, green, dried, boiled', 180, 'PROTEIN'), ingredient('Swamp cabbage lvs, boiled', 100, 'VEGETABLES'), ingredient('Tomato', 50, 'VEGETABLES')],
  },
  {
    mealName: 'Tofu Vegetable Rice Bowl',
    description: 'Soft tofu with steamed rice, cabbage, carrot, and tomato.',
    mealType: 'LUNCH', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Rice, well-milled, boiled', 170, 'GRAINS'), ingredient('Soybean cheese, soft curd', 160, 'PROTEIN'), ingredient('Cabbage, green, boiled', 80, 'VEGETABLES'), ingredient('Carrot, boiled', 60, 'VEGETABLES'), ingredient('Tomato', 50, 'VEGETABLES')],
  },
  {
    mealName: 'Sardines, Pechay and Rice Bowl',
    description: 'Canned sardines in tomato sauce with steamed rice and pechay.',
    mealType: 'LUNCH', diets: pescatarian, allergensPresent: [],
    ingredients: [ingredient('Rice, well-milled, boiled', 180, 'GRAINS'), ingredient('Sardines, in tomato sce, cnd', 120, 'PROTEIN'), ingredient('Pechay lvs, boiled', 100, 'VEGETABLES')],
  },
  {
    mealName: 'Chicken Potato and Carrot Bowl',
    description: 'Chicken breast with boiled potato, carrot, and cabbage.',
    mealType: 'LUNCH', diets: omnivore, allergensPresent: [],
    ingredients: [ingredient('Chicken breast', 140, 'PROTEIN'), ingredient('Potato, boiled', 220, 'GRAINS'), ingredient('Carrot, boiled', 80, 'VEGETABLES'), ingredient('Cabbage, green, boiled', 80, 'VEGETABLES')],
  },
  {
    mealName: 'Tofu Pechay Potato Bowl',
    description: 'Soft tofu, boiled potato, pechay, and tomato in a practical plant-based plate.',
    mealType: 'LUNCH', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Soybean cheese, soft curd', 170, 'PROTEIN'), ingredient('Potato, boiled', 180, 'GRAINS'), ingredient('Pechay lvs, boiled', 100, 'VEGETABLES'), ingredient('Tomato', 50, 'VEGETABLES')],
  },
  {
    mealName: 'Munggo Cabbage Vegetable Bowl',
    description: 'A lighter serving of boiled mung beans with cabbage, carrot, and tomato.',
    mealType: 'LUNCH', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Mung bean seed, green, dried, boiled', 100, 'PROTEIN'), ingredient('Cabbage, green, boiled', 100, 'VEGETABLES'), ingredient('Carrot, boiled', 70, 'VEGETABLES'), ingredient('Tomato', 60, 'VEGETABLES')],
  },
  {
    mealName: 'Corn Tofu Vegetable Bowl',
    description: 'Boiled corn and soft tofu with cabbage and tomato.',
    mealType: 'LUNCH', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Corn on cob, yellow, boiled', 130, 'GRAINS'), ingredient('Soybean cheese, soft curd', 160, 'PROTEIN'), ingredient('Cabbage, green, boiled', 90, 'VEGETABLES'), ingredient('Tomato', 60, 'VEGETABLES')],
  },
  {
    mealName: 'Tofu Sweet Potato Cucumber Plate',
    description: 'Soft tofu with boiled purple sweet potato, cucumber, and tomato.',
    mealType: 'LUNCH', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Soybean cheese, soft curd', 170, 'PROTEIN'), ingredient('Sweet potato, purple, boiled', 150, 'GRAINS'), ingredient('Cucumber', 70, 'VEGETABLES'), ingredient('Tomato', 50, 'VEGETABLES')],
  },
  {
    mealName: 'Egg Potato and Pechay Bowl',
    description: 'Boiled egg and potato with pechay, carrot, and tomato.',
    mealType: 'LUNCH', diets: vegetarian, allergensPresent: ['EGGS'],
    ingredients: [ingredient('Egg, chicken, whole, boiled', 100, 'PROTEIN'), ingredient('Potato, boiled', 170, 'GRAINS'), ingredient('Pechay lvs, boiled', 100, 'VEGETABLES'), ingredient('Carrot, boiled', 60, 'VEGETABLES'), ingredient('Tomato', 50, 'VEGETABLES')],
  },

  {
    mealName: 'Chicken Vegetable Rice Soup Bowl',
    description: 'A light bowl of chicken, rice, carrot, and cabbage simmered together.',
    mealType: 'DINNER', diets: omnivore, allergensPresent: [],
    ingredients: [ingredient('Rice, well-milled, boiled', 140, 'GRAINS'), ingredient('Chicken breast', 110, 'PROTEIN'), ingredient('Carrot, boiled', 60, 'VEGETABLES'), ingredient('Cabbage, green, boiled', 80, 'VEGETABLES')],
  },
  {
    mealName: 'Beef Potato and Pechay Bowl',
    description: 'Boiled lean beef with potato, pechay, and onion.',
    mealType: 'DINNER', diets: omnivore, allergensPresent: [],
    ingredients: [ingredient('Beef lean meat, boiled', 120, 'PROTEIN'), ingredient('Potato, boiled', 220, 'GRAINS'), ingredient('Pechay lvs, boiled', 100, 'VEGETABLES'), ingredient('Onion, Bombay bulb, boiled', 25, 'VEGETABLES')],
  },
  {
    mealName: 'Pork Squash Rice Bowl',
    description: 'Lean boiled pork with soft squash and steamed rice.',
    mealType: 'DINNER', diets: omnivore, allergensPresent: [],
    ingredients: [ingredient('Rice, well-milled, boiled', 150, 'GRAINS'), ingredient('Pork Boston butt, lean, boiled', 100, 'PROTEIN'), ingredient('Squash fruit, boiled', 140, 'VEGETABLES'), ingredient('Tomato', 50, 'VEGETABLES')],
  },
  {
    mealName: 'Milkfish and Sweet Potato Plate',
    description: 'Broiled milkfish with boiled purple sweet potato and cucumber.',
    mealType: 'DINNER', diets: pescatarian, allergensPresent: [],
    ingredients: [ingredient('Milkfish, broiled', 130, 'PROTEIN'), ingredient('Sweet potato, purple, boiled', 200, 'GRAINS'), ingredient('Cucumber', 80, 'VEGETABLES'), ingredient('Tomato', 50, 'VEGETABLES')],
  },
  {
    mealName: 'Tilapia Corn and Vegetable Plate',
    description: 'Tilapia with boiled yellow corn, pechay, and tomato.',
    mealType: 'DINNER', diets: pescatarian, allergensPresent: [],
    ingredients: [ingredient('Tilapia', 140, 'PROTEIN'), ingredient('Corn on cob, yellow, boiled', 180, 'GRAINS'), ingredient('Pechay lvs, boiled', 90, 'VEGETABLES'), ingredient('Tomato', 50, 'VEGETABLES')],
  },
  {
    mealName: 'Tuna Potato Salad Bowl',
    description: 'Tuna flakes with boiled potato, cucumber, tomato, and lettuce.',
    mealType: 'DINNER', diets: pescatarian, allergensPresent: [],
    ingredients: [ingredient('Tuna flakes, in brine, cnd', 120, 'PROTEIN'), ingredient('Potato, boiled', 220, 'GRAINS'), ingredient('Cucumber', 60, 'VEGETABLES'), ingredient('Tomato', 60, 'VEGETABLES'), ingredient('Lettuce lvs & petioles', 40, 'VEGETABLES')],
  },
  {
    mealName: 'Munggo Squash Rice Bowl',
    description: 'Boiled mung beans and squash served over steamed rice.',
    mealType: 'DINNER', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Rice, well-milled, boiled', 150, 'GRAINS'), ingredient('Mung bean seed, green, dried, boiled', 170, 'PROTEIN'), ingredient('Squash fruit, boiled', 120, 'VEGETABLES'), ingredient('Tomato', 50, 'VEGETABLES')],
  },
  {
    mealName: 'Tofu Cabbage Rice Bowl',
    description: 'Soft tofu with cabbage, carrot, and steamed rice.',
    mealType: 'DINNER', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Rice, well-milled, boiled', 160, 'GRAINS'), ingredient('Soybean cheese, soft curd', 170, 'PROTEIN'), ingredient('Cabbage, green, boiled', 100, 'VEGETABLES'), ingredient('Carrot, boiled', 60, 'VEGETABLES')],
  },
  {
    mealName: 'Sardines Sweet Potato and Pechay Plate',
    description: 'Canned sardines in tomato sauce with sweet potato and pechay.',
    mealType: 'DINNER', diets: pescatarian, allergensPresent: [],
    ingredients: [ingredient('Sardines, in tomato sce, cnd', 120, 'PROTEIN'), ingredient('Sweet potato, purple, boiled', 190, 'GRAINS'), ingredient('Pechay lvs, boiled', 100, 'VEGETABLES')],
  },
  {
    mealName: 'Chicken Corn Tomato Rice Bowl',
    description: 'Chicken breast with corn, tomato, and a smaller serving of steamed rice.',
    mealType: 'DINNER', diets: omnivore, allergensPresent: [],
    ingredients: [ingredient('Rice, well-milled, boiled', 120, 'GRAINS'), ingredient('Chicken breast', 120, 'PROTEIN'), ingredient('Corn on cob, yellow, boiled', 100, 'GRAINS'), ingredient('Tomato', 70, 'VEGETABLES')],
  },
  {
    mealName: 'Tofu Sweet Potato Pechay Plate',
    description: 'Soft tofu with boiled purple sweet potato, pechay, and tomato.',
    mealType: 'DINNER', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Soybean cheese, soft curd', 170, 'PROTEIN'), ingredient('Sweet potato, purple, boiled', 150, 'GRAINS'), ingredient('Pechay lvs, boiled', 100, 'VEGETABLES'), ingredient('Tomato', 50, 'VEGETABLES')],
  },
  {
    mealName: 'Munggo Cabbage Tomato Soup Bowl',
    description: 'A light mung bean bowl with cabbage, tomato, and onion.',
    mealType: 'DINNER', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Mung bean seed, green, dried, boiled', 100, 'PROTEIN'), ingredient('Cabbage, green, boiled', 120, 'VEGETABLES'), ingredient('Tomato', 70, 'VEGETABLES'), ingredient('Onion, Bombay bulb, boiled', 20, 'VEGETABLES')],
  },
  {
    mealName: 'Corn Tofu Tomato Dinner Bowl',
    description: 'Soft tofu with boiled yellow corn, tomato, and cucumber.',
    mealType: 'DINNER', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Corn on cob, yellow, boiled', 130, 'GRAINS'), ingredient('Soybean cheese, soft curd', 170, 'PROTEIN'), ingredient('Tomato', 70, 'VEGETABLES'), ingredient('Cucumber', 60, 'VEGETABLES')],
  },
  {
    mealName: 'Egg Potato Cabbage Dinner Plate',
    description: 'Boiled egg and potato with cabbage, carrot, and tomato.',
    mealType: 'DINNER', diets: vegetarian, allergensPresent: ['EGGS'],
    ingredients: [ingredient('Egg, chicken, whole, boiled', 100, 'PROTEIN'), ingredient('Potato, boiled', 170, 'GRAINS'), ingredient('Cabbage, green, boiled', 100, 'VEGETABLES'), ingredient('Carrot, boiled', 60, 'VEGETABLES'), ingredient('Tomato', 50, 'VEGETABLES')],
  },
  {
    mealName: 'Tofu Pechay Rice Soup Bowl',
    description: 'A light bowl of soft tofu, rice, pechay, carrot, and onion.',
    mealType: 'DINNER', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Rice, well-milled, boiled', 120, 'GRAINS'), ingredient('Soybean cheese, soft curd', 160, 'PROTEIN'), ingredient('Pechay lvs, boiled', 100, 'VEGETABLES'), ingredient('Carrot, boiled', 50, 'VEGETABLES'), ingredient('Onion, Bombay bulb, boiled', 20, 'VEGETABLES')],
  },
  {
    mealName: 'Tofu Papaya and Sweet Potato Breakfast',
    description: 'Soft tofu with ripe papaya and boiled purple sweet potato.',
    mealType: 'BREAKFAST', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Soybean cheese, soft curd', 170, 'PROTEIN'), ingredient('Papaya fruit, ripe', 140, 'FRUITS'), ingredient('Sweet potato, purple, boiled', 100, 'GRAINS')],
  },
  {
    mealName: 'Munggo Sweet Potato Breakfast Bowl',
    description: 'Boiled mung beans and purple sweet potato with fresh tomato.',
    mealType: 'BREAKFAST', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Mung bean seed, green, dried, boiled', 100, 'PROTEIN'), ingredient('Sweet potato, purple, boiled', 100, 'GRAINS'), ingredient('Tomato', 60, 'VEGETABLES')],
  },
  {
    mealName: 'Tofu Squash Potato Lunch Plate',
    description: 'Soft tofu with boiled potato, squash, and tomato.',
    mealType: 'LUNCH', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Soybean cheese, soft curd', 180, 'PROTEIN'), ingredient('Potato, boiled', 180, 'GRAINS'), ingredient('Squash fruit, boiled', 120, 'VEGETABLES'), ingredient('Tomato', 60, 'VEGETABLES')],
  },
  {
    mealName: 'Munggo Pechay Sweet Potato Bowl',
    description: 'Boiled mung beans with pechay, purple sweet potato, and tomato.',
    mealType: 'LUNCH', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Mung bean seed, green, dried, boiled', 90, 'PROTEIN'), ingredient('Sweet potato, purple, boiled', 80, 'GRAINS'), ingredient('Pechay lvs, boiled', 110, 'VEGETABLES'), ingredient('Tomato', 60, 'VEGETABLES')],
  },
  {
    mealName: 'Tofu Kangkong Potato Dinner Bowl',
    description: 'Soft tofu with boiled potato, kangkong, and tomato.',
    mealType: 'DINNER', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Soybean cheese, soft curd', 180, 'PROTEIN'), ingredient('Potato, boiled', 180, 'GRAINS'), ingredient('Swamp cabbage lvs, boiled', 110, 'VEGETABLES'), ingredient('Tomato', 60, 'VEGETABLES')],
  },
  {
    mealName: 'Munggo Squash Sweet Potato Dinner Bowl',
    description: 'Boiled mung beans with squash, purple sweet potato, and pechay.',
    mealType: 'DINNER', diets: vegan, allergensPresent: [],
    ingredients: [ingredient('Mung bean seed, green, dried, boiled', 90, 'PROTEIN'), ingredient('Sweet potato, purple, boiled', 65, 'GRAINS'), ingredient('Squash fruit, boiled', 120, 'VEGETABLES'), ingredient('Pechay lvs, boiled', 100, 'VEGETABLES')],
  },
];

export function assertCommonMealCatalogue(): void {
  const names = new Set<string>();
  for (const meal of COMMON_MEAL_CATALOGUE) {
    if (names.has(meal.mealName)) throw new Error(`Duplicate catalogue meal: ${meal.mealName}`);
    names.add(meal.mealName);
    if (!meal.description.trim()) throw new Error(`Missing description: ${meal.mealName}`);
    if (meal.ingredients.length === 0) throw new Error(`Missing ingredients: ${meal.mealName}`);
    if (new Set(meal.allergensPresent).size !== meal.allergensPresent.length) {
      throw new Error(`Duplicate allergen declaration: ${meal.mealName}`);
    }
    for (const item of meal.ingredients) {
      if (!item.foodName.trim() || !Number.isFinite(item.grams) || item.grams <= 0) {
        throw new Error(`Invalid ingredient in ${meal.mealName}`);
      }
    }
  }
}
