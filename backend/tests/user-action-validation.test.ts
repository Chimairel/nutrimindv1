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
