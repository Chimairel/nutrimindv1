import { aggregateGroceryIngredients, groceryItemKey, type GroceryIngredientInput } from './grocery-quantity.policy';
import { remainingToBuy } from './grocery-purchase.policy';

export function additionalShoppingNeeds(
  before: GroceryIngredientInput[],
  after: GroceryIngredientInput[],
  purchases: Array<{ ingredientName: string; unit: string | null; purchasedQuantity: number }>
) {
  const old = new Map(aggregateGroceryIngredients(before).map((item) => [item.key, item]));
  const bought = new Map(
    purchases.map((item) => [groceryItemKey(item.ingredientName, item.unit), item.purchasedQuantity])
  );
  return aggregateGroceryIngredients(after).flatMap<{
    ingredientName: string;
    unit: string | null;
    additionalQuantity: number | null;
    remainingQuantity: number | null;
  }>((item) => {
    const previous = old.get(item.key);
    const purchased = bought.get(item.key) ?? 0;
    const remaining = remainingToBuy(item.quantity, purchased);
    const oldRemaining = remainingToBuy(previous?.quantity ?? (previous ? null : 0), purchased);
    if (remaining === null)
      return previous
        ? []
        : [{ ingredientName: item.ingredientName, unit: item.unit, additionalQuantity: null, remainingQuantity: null }];
    const additional = Math.round((remaining - (oldRemaining ?? 0)) * 1000) / 1000;
    return additional > 0
      ? [
          {
            ingredientName: item.ingredientName,
            unit: item.unit,
            additionalQuantity: additional,
            remainingQuantity: remaining,
          },
        ]
      : [];
  });
}

export function buildSwapShoppingDelta(
  before: GroceryIngredientInput[],
  after: GroceryIngredientInput[],
  purchases: Array<{ ingredientName: string; unit: string | null; purchasedQuantity: number }>
) {
  const additions = additionalShoppingNeeds(before, after, purchases);
  const removals = additionalShoppingNeeds(after, before, purchases).map((item) => ({
    ingredientName: item.ingredientName,
    unit: item.unit,
    removableQuantity: item.additionalQuantity,
  }));
  return { additions, removals };
}
