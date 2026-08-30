import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateGroceryIngredients,
  groceryItemKey,
  normalizeGroceryUnit,
} from '../src/domain/grocery-quantity.policy';

test('[TEST-059] grocery units normalize deterministically', () => {
  assert.equal(normalizeGroceryUnit('grams'), 'g');
  assert.equal(normalizeGroceryUnit('ML'), 'mL');
  assert.equal(groceryItemKey('  Brown   Rice ', 'grams'), 'brown rice|g');
});

test('[TEST-060] grocery aggregation sums compatible quantities and records meal coverage', () => {
  assert.deepEqual(aggregateGroceryIngredients([
    { ingredientName: 'brown rice', category: 'Cereals', quantity: 100, unit: 'g' },
    { ingredientName: 'Brown Rice', category: 'Cereals', quantity: 150, unit: 'grams' },
  ]), [{
    key: 'brown rice|g',
    ingredientName: 'Brown rice',
    category: 'Cereals',
    quantity: 250,
    unit: 'g',
    sourceMealCount: 2,
  }]);
});

test('[TEST-061] missing quantities remain honestly unspecified', () => {
  const [item] = aggregateGroceryIngredients([
    { ingredientName: 'egg', quantity: 2, unit: 'piece' },
    { ingredientName: 'egg', quantity: null, unit: 'piece' },
  ]);
  assert.equal(item.quantity, null);
  assert.equal(item.sourceMealCount, 2);
});

