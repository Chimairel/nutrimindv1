export const MAX_PAGE_SIZE = 100;
export const MAX_SEARCH_LENGTH = 200;

export function normalizePagination(page: unknown, limit: unknown, defaultLimit: number) {
  const parsedPage = typeof page === 'number' ? page : Number(page);
  const parsedLimit = typeof limit === 'number' ? limit : Number(limit);
  const safePage = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const requestedLimit = Number.isSafeInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : defaultLimit;
  return { page: safePage, limit: Math.min(MAX_PAGE_SIZE, requestedLimit) };
}

export function normalizeSearch(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().slice(0, MAX_SEARCH_LENGTH);
  return normalized || undefined;
}
