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
  const expected = { BREAKFAST: 15, LUNCH: 17, DINNER: 17 } as const;
  for (const mealType of ['BREAKFAST', 'LUNCH', 'DINNER'] as const) {
    assert.equal(COMMON_MEAL_CATALOGUE.filter((meal) => meal.mealType === mealType).length, expected[mealType]);
  }
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
