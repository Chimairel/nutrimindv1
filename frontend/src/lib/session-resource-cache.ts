interface SessionResourceEntry<T> {
  cachedAt: number;
  value: T;
}

const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;
const entries = new Map<string, SessionResourceEntry<unknown>>();

const cacheKey = (ownerId: string, resource: string) => `${ownerId}:${resource}`;

/**
 * Keeps recently rendered, authenticated API data available while the user
 * navigates between client routes. This cache is deliberately memory-only:
 * it is cleared by a page reload and never writes health data to web storage.
 */
export function readSessionResource<T>(
  ownerId: string | undefined,
  resource: string,
  maxAgeMs = DEFAULT_MAX_AGE_MS
): T | null {
  if (!ownerId) return null;

  const key = cacheKey(ownerId, resource);
  const entry = entries.get(key) as SessionResourceEntry<T> | undefined;
  if (!entry) return null;

  if (Date.now() - entry.cachedAt > maxAgeMs) {
    entries.delete(key);
    return null;
  }

  return entry.value;
}

export function writeSessionResource<T>(ownerId: string | undefined, resource: string, value: T): void {
  if (!ownerId) return;
  entries.set(cacheKey(ownerId, resource), { cachedAt: Date.now(), value });
}

export function invalidateSessionResource(ownerId: string | undefined, resource: string): void {
  if (!ownerId) return;
  entries.delete(cacheKey(ownerId, resource));
}

export function clearSessionResourceCache(): void {
  entries.clear();
}
