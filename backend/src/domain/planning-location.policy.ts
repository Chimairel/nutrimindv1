export type PlanningGeographyLevel = 'NATIONAL' | 'REGION' | 'PROVINCE_HUC';
export type MealLocalityPreference = 'NATIONAL' | 'REGIONAL' | 'LOCAL';

export interface PlanningLocation {
  planningGeographyLevel?: PlanningGeographyLevel | null;
  planningRegionName?: string | null;
  planningProvinceHucName?: string | null;
  mealLocalityPreference?: MealLocalityPreference | null;
}

export interface ConsumptionScope {
  level: PlanningGeographyLevel;
  regionName: string | null;
  provinceHucName: string | null;
  label: string;
}

export interface ScopedConsumptionResult<T> {
  scope: ConsumptionScope | null;
  rows: T[];
}

interface MealWithGroundedIngredients {
  ingredients: Array<{ foodItemId?: string | null }>;
}

function clean(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

/**
 * Produces the only allowed locality fallback order. Location is deliberately
 * coarse and affects familiarity evidence only; it is not a clinical input.
 */
export function buildConsumptionScopeChain(location?: PlanningLocation | null): ConsumptionScope[] {
  const preference = location?.mealLocalityPreference ?? 'NATIONAL';
  const regionName = clean(location?.planningRegionName);
  const provinceHucName = clean(location?.planningProvinceHucName);
  const scopes: ConsumptionScope[] = [];

  if (preference === 'LOCAL' && regionName && provinceHucName) {
    scopes.push({
      level: 'PROVINCE_HUC',
      regionName,
      provinceHucName,
      label: `${provinceHucName}, ${regionName}`,
    });
  }

  if ((preference === 'REGIONAL' || preference === 'LOCAL') && regionName) {
    scopes.push({ level: 'REGION', regionName, provinceHucName: null, label: regionName });
  }

  scopes.push({ level: 'NATIONAL', regionName: null, provinceHucName: null, label: 'Philippines (national)' });
  return scopes;
}

export function formatPlanningLocation(location?: PlanningLocation | null): string {
  const regionName = clean(location?.planningRegionName);
  const provinceHucName = clean(location?.planningProvinceHucName);
  if (provinceHucName && regionName) return `${provinceHucName}, ${regionName}`;
  return regionName ?? 'Philippines';
}

export function formatMealLocalityPreference(location?: PlanningLocation | null): string {
  const preference = location?.mealLocalityPreference ?? 'NATIONAL';
  if (preference === 'LOCAL' && clean(location?.planningProvinceHucName)) {
    return clean(location?.planningProvinceHucName)!;
  }
  if (preference === 'REGIONAL' && clean(location?.planningRegionName)) {
    return clean(location?.planningRegionName)!;
  }
  return 'Philippines';
}

/**
 * Resolves aggregate evidence through the approved locality chain and stops at
 * the first scope that actually has rows. Keeping this decision pure and
 * injectable makes the fallback behavior deterministic and independently
 * testable without a database.
 */
export async function resolveFirstAvailableConsumptionScope<T>(
  location: PlanningLocation | null | undefined,
  loadRows: (scope: ConsumptionScope) => Promise<T[]>
): Promise<ScopedConsumptionResult<T>> {
  for (const scope of buildConsumptionScopeChain(location)) {
    const rows = await loadRows(scope);
    if (rows.length > 0) return { scope, rows };
  }

  return { scope: null, rows: [] };
}

/**
 * Applies locality only after callers have completed their safety and calorie
 * eligibility filters. The stable sort preserves the caller's existing
 * ranking among meals with equal grounded-local ingredient coverage.
 */
export function rankMealsByLocalizedFoodEvidence<TMeal extends MealWithGroundedIngredients>(
  meals: readonly TMeal[],
  localizedFoodIds: ReadonlySet<string>
): TMeal[] {
  const score = (meal: TMeal) =>
    meal.ingredients.reduce(
      (total, ingredient) => total + (ingredient.foodItemId && localizedFoodIds.has(ingredient.foodItemId) ? 1 : 0),
      0
    );

  return [...meals].sort((left, right) => score(right) - score(left));
}
