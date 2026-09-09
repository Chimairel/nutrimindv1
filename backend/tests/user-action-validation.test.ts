import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compatibleLibraryQuerySchema,
  fnriLookupQuerySchema,
  mealGenerationBodySchema,
  mealStatusBodySchema,
  outsideMealBodySchema,
  resourceIdParamsSchema,
  swapMealBodySchema,
  weightEntryBodySchema,
} from '../src/validation/user-action.schemas';

test('[TEST-150] user action schemas reject unknown, empty, and oversized input', () => {
  assert.throws(() => resourceIdParamsSchema.parse({ id: '' }));
  assert.throws(() => mealStatusBodySchema.parse({ status: 'EATEN' }));
  assert.throws(() => mealGenerationBodySchema.parse({ replaceExisting: 'yes' }));
  assert.throws(() => fnriLookupQuerySchema.parse({ name: ' '.repeat(5) }));
  assert.throws(() => compatibleLibraryQuerySchema.parse({ search: 'x'.repeat(101) }));
  assert.throws(() => outsideMealBodySchema.parse({ mealName: 'Rice', mealType: 'LUNCH', unexpected: true }));
  assert.throws(() => swapMealBodySchema.parse({ newLibraryMealId: 'meal-1', warningAcknowledged: 'yes' }));
});

test('[TEST-151] user action schemas normalize valid boundary input', () => {
  assert.deepEqual(mealGenerationBodySchema.parse({}), {});
  assert.deepEqual(mealGenerationBodySchema.parse({ replaceExisting: true }), { replaceExisting: true });
  assert.deepEqual(weightEntryBodySchema.parse({ weightKg: '70.5', note: '  Morning measurement  ' }), {
    weightKg: 70.5,
    note: 'Morning measurement',
  });
  assert.deepEqual(outsideMealBodySchema.parse({ mealName: '  Chicken adobo  ', mealType: 'DINNER' }), {
    mealName: 'Chicken adobo',
    mealType: 'DINNER',
  });
});

test('[TEST-180] outside meal item nutrition is strict, bounded, and supports mixed inputs', () => {
  const parsed = outsideMealBodySchema.parse({
    mealType: 'SNACK',
    useAiEstimate: true,
    requestKey: 'outside-meal-123',
    items: [
      { name: 'Rice', portionGrams: 150 },
      { name: 'Packaged yogurt', reportedNutrition: { calories: 120, proteinG: 5, carbsG: 18, fatG: 3 } },
    ],
  });
  assert.equal(parsed.items?.length, 2);
  assert.throws(() => outsideMealBodySchema.parse({ mealType: 'LUNCH' }));
  assert.throws(() => outsideMealBodySchema.parse({ mealType: 'LUNCH', mealName: 'Rice', warningAcknowledged: true }));
  assert.throws(() =>
    outsideMealBodySchema.parse({
      mealType: 'LUNCH',
      items: [{ name: 'Rice', reportedNutrition: { calories: -1, proteinG: 0, carbsG: 0, fatG: 0 } }],
    })
  );
});
