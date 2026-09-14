const READ_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
]);

function isConnectionReset(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as { code?: unknown; message?: unknown };
  return (
    code === 'P1017' ||
    (typeof message === 'string' && /closed the connection|forcibly closed|ConnectionReset|10054/.test(message))
  );
}

/** Retry reads only: a failed write may have committed before the connection dropped. */
export async function retryDatabaseRead<T>(
  operation: string,
  query: () => Promise<T>,
  pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await query();
    } catch (error: unknown) {
      if (!READ_OPERATIONS.has(operation) || !isConnectionReset(error) || attempt >= 3) throw error;
      // Keep the shared pool alive for unrelated requests and transactions.
      await pause(250 * (attempt + 1));
    }
  }
}
