import { normalizeFoodName } from './fnri-match.policy';

export const USDA_FDC_SOURCE = 'USDA_FDC';

export interface UsdaCompositionCandidate {
  id: string;
  name: string;
  source: string;
  sourceRecordId?: string | null;
}

export interface VerifiedUsdaAlias {
  alias: string;
  foodItemId: string;
  verifiedAt: Date | null;
}

/** USDA is a fallback only for one exact record or an explicitly verified alias. */
export function createUsdaCompositionMatcher<T extends UsdaCompositionCandidate>(
  foods: readonly T[],
  aliases: readonly VerifiedUsdaAlias[]
): (name: string) => T | null {
  const byId = new Map(foods.filter((food) => food.source === USDA_FDC_SOURCE).map((food) => [food.id, food]));
  const exact = new Map<string, T | null>();
  const verified = new Map<string, T | null>();
  const insert = (index: Map<string, T | null>, name: string, food: T) => {
    const key = normalizeFoodName(name);
    if (!key) return;
    if (index.has(key) && index.get(key)?.id !== food.id) index.set(key, null);
    else if (!index.has(key)) index.set(key, food);
  };
  for (const food of byId.values()) insert(exact, food.name, food);
  for (const alias of aliases) {
    const food = alias.verifiedAt ? byId.get(alias.foodItemId) : null;
    if (food) insert(verified, alias.alias, food);
  }
  return (name) => {
    const key = normalizeFoodName(name);
    if (!key) return null;
    const exactMatch = exact.get(key);
    if (exactMatch) return exactMatch;
    if (exact.has(key)) return null;
    return verified.get(key) ?? null;
  };
}
