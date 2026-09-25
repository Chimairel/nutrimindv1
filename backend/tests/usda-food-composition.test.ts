import assert from 'node:assert/strict';
import test from 'node:test';
import { createUsdaCompositionMatcher } from '../src/domain/usda-food-composition.policy';
import { reconcileFnriMealTotals } from '../src/domain/fnri-meal-totals.policy';

const foods = [
  { id: 'USDA_FDC_1', name: 'Olive oil', source: 'USDA_FDC', sourceRecordId: '1' },
  { id: 'USDA_FDC_2', name: 'Tofu, firm', source: 'USDA_FDC', sourceRecordId: '2' },
  { id: 'USDA_FDC_3', name: 'Tofu, firm', source: 'USDA_FDC', sourceRecordId: '3' },
  { id: 'FNRI_1', name: 'Rice', source: 'FNRI', sourceRecordId: null },
];

test('USDA fallback permits unique exact labels and verified aliases only', () => {
  const match = createUsdaCompositionMatcher(foods, [
    { alias: 'extra virgin olive oil', foodItemId: 'USDA_FDC_1', verifiedAt: new Date() },
    { alias: 'firm bean curd', foodItemId: 'USDA_FDC_2', verifiedAt: null },
  ]);
  assert.equal(match('olive oil')?.id, 'USDA_FDC_1');
  assert.equal(match('extra virgin olive oil')?.id, 'USDA_FDC_1');
  assert.equal(match('tofu, firm'), null, 'two same-name records are ambiguous');
  assert.equal(match('firm bean curd'), null, 'unverified alias is ignored');
  assert.equal(match('Rice'), null, 'FNRI identities are not USDA fallback rows');
});

test('USDA nutrient totals require explicit source opt-in and measured grams', () => {
  const composition = [{ id: 'USDA_FDC_1', source: 'USDA_FDC', calories: 100, proteinG: 2, carbsG: 3, fatG: 8 }];
  const grams = [{ foodItemId: 'USDA_FDC_1', quantity: 50, unit: 'g' }];
  assert.equal(reconcileFnriMealTotals(grams, composition).complete, false);
  assert.deepEqual(reconcileFnriMealTotals(grams, composition, ['FNRI', 'USDA_FDC']).totals, {
    calories: 50,
    proteinG: 1,
    carbsG: 1.5,
    fatG: 4,
  });
  assert.equal(
    reconcileFnriMealTotals([{ foodItemId: 'USDA_FDC_1', quantity: 1, unit: 'cup' }], composition, ['USDA_FDC'])
      .complete,
    false
  );
});
