/** Recognize database transport failures without returning vendor messages or connection strings. */
export function databaseAvailabilityFailure(error: unknown): { errorCode: string; message: string } | null {
  const failure = error as { name?: string; code?: string; errorCode?: string; message?: string } | null;
  if (
    !['PrismaClientInitializationError', 'PrismaClientKnownRequestError', 'PrismaClientUnknownRequestError'].includes(
      failure?.name ?? ''
    )
  )
    return null;
  if (
    /account or project has exceeded the quota|compute time quota|data transfer quota/i.test(failure?.message ?? '')
  ) {
    return {
      errorCode: 'DATABASE_QUOTA_EXCEEDED',
      message: 'The database service has reached its usage limit. Please contact the administrator.',
    };
  }
  if (
    failure?.name === 'PrismaClientInitializationError' ||
    ['P1000', 'P1001', 'P1002', 'P1003', 'P1008', 'P1017', 'P2024'].includes(failure?.code ?? failure?.errorCode ?? '')
  ) {
    return {
      errorCode: 'DATABASE_UNAVAILABLE',
      message: 'The API could not access its database. Please try again in a moment.',
    };
  }
  return null;
}
