export function normalizeRestrictionContext(values: unknown): string[] {
  return Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().toUpperCase())
        .filter((value) => value && value !== 'NONE')
    )
  ).sort();
}

export function hasSameRestrictionContext(left: unknown, right: unknown): boolean {
  const normalizedLeft = normalizeRestrictionContext(left);
  const normalizedRight = normalizeRestrictionContext(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
}
