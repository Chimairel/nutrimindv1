type Composition = { id: string; calories: number; proteinG: number; carbsG: number; fatG: number; source: string };
type Portion = { foodItemId: string | null; quantity?: number | null; unit?: string | null };

/** FNRI composition is per 100 g of the named food/preparation. No guessed cup/piece conversions. */
export function reconcileFnriMealTotals(
  ingredients: readonly Portion[],
  foods: readonly Composition[],
  acceptedSources: readonly string[] = ['FNRI']
) {
  const byId = new Map(foods.map((food) => [food.id, food]));
  const totals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  let resolved = 0;
  for (const item of ingredients) {
    const food = item.foodItemId ? byId.get(item.foodItemId) : undefined;
    const unit = item.unit?.trim().toLowerCase();
    const factor = ['g', 'gram', 'grams'].includes(unit ?? '')
      ? 1
      : ['kg', 'kilogram', 'kilograms'].includes(unit ?? '')
        ? 1000
        : null;
    if (
      !food ||
      !acceptedSources.includes(food.source) ||
      factor === null ||
      !item.quantity ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0
    )
      continue;
    if (
      Object.keys(totals).some(
        (key) => !Number.isFinite(food[key as keyof typeof totals]) || food[key as keyof typeof totals] < 0
      )
    )
      continue;
    for (const key of Object.keys(totals) as Array<keyof typeof totals>)
      totals[key] += (food[key] * item.quantity * factor) / 100;
    resolved++;
  }
  return {
    complete: ingredients.length > 0 && resolved === ingredients.length,
    resolved,
    total: ingredients.length,
    totals: Object.fromEntries(
      Object.entries(totals).map(([key, value]) => [key, Math.round(value * 10) / 10])
    ) as typeof totals,
  };
}
