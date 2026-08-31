const KNOWN_FOOD_CULTURES = [
  'Filipino',
  'Ilocano',
  'Visayan',
  'Kapampangan',
  'Bicolano',
  'Asian',
  'Western',
  'Mediterranean',
] as const;

/**
 * Older profiles may contain NONE alongside a real restriction. NONE is only
 * meaningful when it is the sole selection, so real restrictions always win.
 */
export function normalizeExclusiveNone<T extends string>(values: readonly T[] | null | undefined): T[] {
  const unique = Array.from(new Set(values ?? []));
  const realSelections = unique.filter((value) => value !== 'NONE');
  return realSelections.length > 0 ? realSelections : unique;
}

/**
 * Repairs a known legacy value such as "FilipinoFilipino" without guessing at
 * arbitrary user-entered cultures (for example, "Bora Bora" remains intact).
 */
export function normalizeFoodCulture(value: string | null | undefined): string {
  const trimmed = value?.trim() || 'Filipino';

  for (const culture of KNOWN_FOOD_CULTURES) {
    if (trimmed.toLocaleLowerCase() === `${culture}${culture}`.toLocaleLowerCase()) {
      return culture;
    }
  }

  return trimmed;
}
