import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseState } from '../src/domain/grocery-purchase.policy';
import { additionalShoppingNeeds } from '../src/domain/swap-shopping.policy';
import { rankLibraryMeals } from '../src/domain/library-ranking.policy';
import { reconcileFnriMealTotals } from '../src/domain/fnri-meal-totals.policy';
import { aggregateGroceryIngredients } from '../src/domain/grocery-quantity.policy';

test('purchased quantities survive changed requirements and partial purchases never alter recipe amounts', () => {
  assert.deepEqual(purchaseState(450, 300), { purchasedQuantity: 300, remainingQuantity: 150, isChecked: false });
  assert.deepEqual(purchaseState(300, 200), { purchasedQuantity: 200, remainingQuantity: 100, isChecked: false });
  assert.deepEqual(purchaseState(100, 300), { purchasedQuantity: 300, remainingQuantity: 0, isChecked: true });
  assert.throws(() => purchaseState(300, NaN));
  assert.throws(() => purchaseState(300, -1));
});
test('shopping preview includes only extra needs and subtracts purchases, with mass normalization', () => {
  const before = [
    { ingredientName: 'Chicken', quantity: 0.3, unit: 'kg' },
    { ingredientName: 'Egg', quantity: 4, unit: 'piece' },
  ];
  const after = [
    { ingredientName: 'Chicken', quantity: 450, unit: 'g' },
    { ingredientName: 'Egg', quantity: 3, unit: 'piece' },
  ];
  assert.deepEqual(
    additionalShoppingNeeds(before, after, [{ ingredientName: 'Chicken', unit: 'g', purchasedQuantity: 300 }]),
    [{ ingredientName: 'Chicken', unit: 'g', additionalQuantity: 150, remainingQuantity: 150 }]
  );
  assert.deepEqual(
    additionalShoppingNeeds(before, after, [{ ingredientName: 'Chicken', unit: 'g', purchasedQuantity: 500 }]),
    []
  );
  assert.equal(aggregateGroceryIngredients([...before.slice(0, 1), after[0]])[0].quantity, 750);
});
test('all-types library prioritizes one best per type, then remaining groups and excludes oversized portions', () => {
  const meals = [
    { id: 'b2', mealType: 'BREAKFAST', calories: 630 },
    { id: 'd2', mealType: 'DINNER', calories: 620 },
    { id: 'b1', mealType: 'BREAKFAST', calories: 600 },
    { id: 'l1', mealType: 'LUNCH', calories: 800 },
    { id: 'd1', mealType: 'DINNER', calories: 600 },
    { id: 'too-large', mealType: 'BREAKFAST', calories: 3000 },
  ];
  assert.deepEqual(
    rankLibraryMeals(meals, 2000).map((meal) => meal.id),
    ['b1', 'l1', 'd1', 'b2', 'd2']
  );
});
test('FNRI totals use measured portions; unknown cups do not silently become grams', () => {
  const foods = [{ id: 'food', source: 'FNRI', calories: 200, proteinG: 10, carbsG: 20, fatG: 5 }];
  const resolved = reconcileFnriMealTotals([{ foodItemId: 'food', quantity: 0.25, unit: 'kg' }], foods);
  assert.equal(resolved.complete, true);
  assert.deepEqual(resolved.totals, { calories: 500, proteinG: 25, carbsG: 50, fatG: 12.5 });
  assert.equal(reconcileFnriMealTotals([{ foodItemId: 'food', quantity: 1, unit: 'cup' }], foods).complete, false);
});
