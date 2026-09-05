import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMMON_MEAL_CATALOGUE,
  CONDITION_AWARE_CATALOGUE_RULES,
  assertCommonMealCatalogue,
  deriveCatalogueConditionSuitability,
  getCatalogueDietaryTags,
  type SupportedLibraryAllergen,
} from '../src/data/common-meal-catalogue';
import { calculateCatalogueNutrition } from '../src/domain/catalogue-nutrition.policy';

const ingredientAllergens: Record<string, SupportedLibraryAllergen[]> = {
  'Egg, chicken, whole': ['EGGS'],
  'Egg, chicken, whole, boiled': ['EGGS'],
  'Bread, pan de sal': ['GLUTEN'],
  'Oats, quick-cooking, ckd': ['GLUTEN'],
  'Peanut butter': ['NUTS'],
  'Milk, cow': ['DAIRY'],
};

test('common library catalogue has enough complete, unique meals per main slot', () => {
  assert.doesNotThrow(assertCommonMealCatalogue);
  const expected = { BREAKFAST: 15, LUNCH: 18, DINNER: 18 } as const;
  for (const mealType of ['BREAKFAST', 'LUNCH', 'DINNER'] as const) {
    assert.equal(COMMON_MEAL_CATALOGUE.filter((meal) => meal.mealType === mealType).length, expected[mealType]);
  }
});

test('[TEST-076] two exact FNRI-backed additions close the diabetes vegetarian egg-free slot gaps', () => {
  const evidence = new Map([
    ['Rice, well-milled, boiled', { id: 'A020', name: 'Rice, well-milled, boiled', calories: 129, proteinG: 2.1, fatG: 0.2, carbsG: 29.7, sodium: 3 }],
    ['Soybean cheese, hard curd', { id: 'C064', name: 'Soybean cheese, hard curd', calories: 123, proteinG: 12.9, fatG: 7, carbsG: 2, sodium: 114 }],
    ['Bitter melon/gourd fruit, boiled', { id: 'D019', name: 'Bitter melon/gourd fruit, boiled', calories: 19, proteinG: 0.4, fatG: 0.2, carbsG: 3.8, sodium: 1 }],
    ['Tomato', { id: 'D257', name: 'Tomato', calories: 25, proteinG: 0.8, fatG: 0.1, carbsG: 5.2, sodium: 11 }],
    ['Onion, Bombay bulb', { id: 'D141', name: 'Onion, Bombay bulb', calories: 52, proteinG: 1.7, fatG: 0.3, carbsG: 10.5, sodium: 11 }],
    ['Chayote fruit, boiled', { id: 'D051', name: 'Chayote fruit, boiled', calories: 16, proteinG: 0.3, fatG: 0.1, carbsG: 3.5, sodium: 5 }],
    ['String/Yard long bean pod, green, boiled', { id: 'D233', name: 'String/Yard long bean pod, green, boiled', calories: 52, proteinG: 4, fatG: 0.5, carbsG: 7.9, sodium: 4 }],
    ['Sweet potato, purple, boiled', { id: 'B010', name: 'Sweet potato, purple, boiled', calories: 122, proteinG: 0.6, fatG: 0.2, carbsG: 29.5, sodium: 43 }],
  ]);
  const expectedNutrition = {
    'Tokwa Ampalaya Rice Bowl': { calories: 412.7, proteinG: 24.7, carbsG: 51.6, fatG: 11.8, sodiumMg: 196.3 },
    'Tokwa Sayote and Sitaw Dinner Plate': { calories: 435.8, proteinG: 26.3, carbsG: 55.2, fatG: 12.2, sodiumMg: 252.6 },
  } as const;

  for (const [mealName, nutrition] of Object.entries(expectedNutrition)) {
    const meal = COMMON_MEAL_CATALOGUE.find((candidate) => candidate.mealName === mealName);
    assert.ok(meal, `Missing proposed catalogue meal: ${mealName}`);
    assert.ok(meal.diets.includes('VEGETARIAN'));
    assert.ok(!meal.allergensPresent.includes('EGGS'));
    assert.deepEqual(calculateCatalogueNutrition(meal, evidence), nutrition);
    assert.ok(deriveCatalogueConditionSuitability(nutrition).includes('DIABETES'));
  }

  assert.deepEqual(
    Object.keys(expectedNutrition).map((mealName) => {
      const meal = COMMON_MEAL_CATALOGUE.find((candidate) => candidate.mealName === mealName);
      return { mealName, mealType: meal?.mealType };
    }),
    [
      { mealName: 'Tokwa Ampalaya Rice Bowl', mealType: 'LUNCH' },
      { mealName: 'Tokwa Sayote and Sitaw Dinner Plate', mealType: 'DINNER' },
    ],
  );
});

test('catalogue allergen declarations match its known allergenic ingredients', () => {
  for (const meal of COMMON_MEAL_CATALOGUE) {
    const inferred = [...new Set(
      meal.ingredients.flatMap((item) => ingredientAllergens[item.foodName] || [])
    )].sort();
    assert.deepEqual([...meal.allergensPresent].sort(), inferred, meal.mealName);
  }
});

test('every catalogue meal can match every supported healthy-profile goal', () => {
  for (const meal of COMMON_MEAL_CATALOGUE) {
    const tags = getCatalogueDietaryTags(meal);
    for (const goal of ['LOSE_WEIGHT', 'GAIN_WEIGHT', 'MAINTAIN', 'BUILD_MUSCLE']) {
      assert.ok(tags.includes(goal), `${meal.mealName} is missing ${goal}`);
    }
    assert.ok(tags.includes('OMNIVORE'), `${meal.mealName} must be available to omnivores`);
  }
});

test('vegetarian, pescatarian, and each supported single-allergy profile have seven options per slot', () => {
  for (const mealType of ['BREAKFAST', 'LUNCH', 'DINNER'] as const) {
    for (const diet of ['VEGETARIAN', 'PESCATARIAN'] as const) {
      const count = COMMON_MEAL_CATALOGUE.filter(
        (meal) => meal.mealType === mealType && meal.diets.includes(diet)
      ).length;
      assert.ok(count >= 7, `${diet} has only ${count} ${mealType} options`);
    }
    for (const allergen of ['SHELLFISH', 'NUTS', 'DAIRY', 'GLUTEN', 'EGGS'] as const) {
      const count = COMMON_MEAL_CATALOGUE.filter(
        (meal) => meal.mealType === mealType && !meal.allergensPresent.includes(allergen)
      ).length;
      assert.ok(count >= 7, `${allergen}-free has only ${count} ${mealType} options`);
    }
  }
});

test('condition suitability applies only the bounded diabetes and hypertension catalogue rules', () => {
  assert.deepEqual(deriveCatalogueConditionSuitability({
    carbsG: CONDITION_AWARE_CATALOGUE_RULES.diabetesMaxCarbsGPerMeal,
    sodiumMg: CONDITION_AWARE_CATALOGUE_RULES.hypertensionMaxSodiumMgPerMeal,
  }), ['DIABETES', 'HYPERTENSION']);
  assert.deepEqual(deriveCatalogueConditionSuitability({ carbsG: 60.1, sodiumMg: 600.1 }), []);
  assert.deepEqual(deriveCatalogueConditionSuitability({ carbsG: 40, sodiumMg: null }), ['DIABETES']);
});
