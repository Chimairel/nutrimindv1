import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMealGenerationResponseSchema } from '../src/validation/meal-generation-response.schema';
import { assertMealSlotCalories, validateGeneratedDayCalories } from '../src/domain/generated-plan-calories.policy';

const slot = { dayNumber: 1, mealType: 'DINNER' as const };
const food = { id: 'reference', source: 'FNRI', calories: 1110.9, proteinG: 38, carbsG: 100, fatG: 62 };
const meal = {
  ...slot,
  mealName: 'Regression dinner',
  description: 'Synthetic',
  calories: 834,
  proteinG: 30,
  carbsG: 100,
  fatG: 35,
  ingredients: [{ foodItemId: food.id, name: 'Reference', quantity: 100, unit: 'g' as const }],
};

test('calorie validation rejects an in-range AI claim when ingredient totals exceed the dinner band', () => {
  const schema = buildMealGenerationResponseSchema([slot], 2779, [food]);
  assert.equal(schema.safeParse({ meals: [meal] }).success, false);
  assert.throws(() => assertMealSlotCalories(1110.9, 2779, 'DINNER'), /708–960/);
  assert.doesNotThrow(() => assertMealSlotCalories(858.9, 2779, 'BREAKFAST'));
  assert.doesNotThrow(() => assertMealSlotCalories(1140.8, 2779, 'LUNCH'));
});

test('realistic portion corrections pass without rewriting the authoritative composition', () => {
  const schema = buildMealGenerationResponseSchema([slot], 2779, [food]);
  assert.equal(
    schema.safeParse({ meals: [{ ...meal, ingredients: [{ ...meal.ingredients[0], quantity: 75 }] }] }).success,
    true
  );
  assert.equal(food.calories, 1110.9);
});

test('invented food identities and missing or duplicate slots are rejected', () => {
  const schema = buildMealGenerationResponseSchema([slot, { dayNumber: 2, mealType: 'DINNER' }], 2779, [food]);
  const corrected = { ...meal, ingredients: [{ ...meal.ingredients[0], quantity: 75 }] };
  assert.equal(schema.safeParse({ meals: [corrected, corrected] }).success, false);
  assert.equal(buildMealGenerationResponseSchema([slot], 2779, []).safeParse({ meals: [corrected] }).success, false);
});

test('partial FNRI coverage remains estimated and requires the existing review flow', () => {
  const estimated = { ...meal, ingredients: [{ ...meal.ingredients[0], foodItemId: null, unit: 'piece' }] };
  assert.equal(buildMealGenerationResponseSchema([slot], 2779, []).safeParse({ meals: [estimated] }).success, true);
  assert.equal(
    buildMealGenerationResponseSchema([slot], 2779, []).safeParse({ meals: [{ ...estimated, calories: 1111 }] })
      .success,
    false
  );
});

test('daily aggregation includes library meals and catches accumulated upper-bound rounding', () => {
  assert.deepEqual(
    validateGeneratedDayCalories(
      [
        { dayNumber: 1, mealType: 'BREAKFAST', calories: 858.9 },
        { dayNumber: 1, mealType: 'LUNCH', calories: 1140.8 },
        { dayNumber: 1, mealType: 'DINNER', calories: 1110.9 },
      ],
      2779
    ),
    []
  ); // Daily tolerance alone cannot catch the dinner-slot defect.
  const schema = buildMealGenerationResponseSchema(
    [slot],
    2779,
    [],
    [
      { dayNumber: 1, mealType: 'BREAKFAST', calories: 960 },
      { dayNumber: 1, mealType: 'LUNCH', calories: 1279 },
    ]
  );
  assert.equal(
    schema.safeParse({
      meals: [{ ...meal, calories: 960, ingredients: [{ ...meal.ingredients[0], foodItemId: null }] }],
    }).success,
    false
  );
});
