/**
 * sanitizeError.ts
 * ─────────────────────────────────────────────────────────────
 * Prevents internal implementation details (Prisma table names,
 * constraint violations, stack traces) from leaking to API consumers.
 *
 * Service-layer code intentionally throws human-readable messages
 * (e.g. "Invalid email or password credentials."). Those are safe
 * to forward. Prisma and other infrastructure errors are not.
 */

// Patterns that indicate an internal / infrastructure error whose
// raw message must NOT be sent to the client.
const UNSAFE_PATTERNS = [
  // Prisma ORM identifiers
  'prisma.',
  'PrismaClient',
  'Unique constraint',
  'Foreign key constraint',
  'Record to update not found',
  'Record to delete does not exist',
  'Invalid `prisma.',
  // Node / system level
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'connect ECONNREFUSED',
  // SQL / DB level
  'violates',
  'constraint failed',
  'relation "',
  'column "',
  'prepared statement',
];

/**
 * Returns a client-safe error message.
 *
 * @param error   — The caught error object.
 * @param fallback — A generic, user-friendly message to use when the
 *                   real message is unsafe to expose.
 *
 * @example
 * ```ts
 * catch (error: any) {
 *   return res.status(500).json({
 *     success: false,
 *     error: sanitizeErrorMessage(error, 'Failed to save profile.'),
 *   });
 * }
 * ```
 */
export function sanitizeErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object') return fallback;

  const err = error as Record<string, any>;

  // Prisma typed errors — always suppress their raw messages.
  const constructorName: string = err.constructor?.name ?? '';
  if (
    constructorName === 'PrismaClientKnownRequestError' ||
    constructorName === 'PrismaClientValidationError' ||
    constructorName === 'PrismaClientInitializationError' ||
    constructorName === 'PrismaClientUnknownRequestError'
  ) {
    return fallback;
  }

  const message: string = typeof err.message === 'string' ? err.message : '';
  if (!message) return fallback;

  // Check for unsafe substrings.
  const lower = message.toLowerCase();
  for (const pattern of UNSAFE_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) {
      return fallback;
    }
  }

  // The message looks intentional (service-layer throw) — pass it through.
  return message;
}
