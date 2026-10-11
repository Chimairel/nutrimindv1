export type ProfileLoadFailureKind =
  | 'timeout'
  | 'offline'
  | 'connection'
  | 'server'
  | 'database-limit'
  | 'database'
  | 'permission'
  | 'rate-limit'
  | 'response'
  | 'account-changed'
  | 'unknown';

export interface ProfileLoadFailure {
  kind: ProfileLoadFailureKind;
  status?: number;
  requestId?: string;
  deadlineSeconds?: number;
}

export function profileCheckError(code: 'PROFILE_INVALID' | 'PROFILE_ACCOUNT_CHANGED') {
  return Object.assign(new Error('Account profile could not be confirmed.'), { code });
}

/** Keep diagnostics useful without retaining response bodies, credentials or raw exceptions. */
export function classifyProfileLoadFailure(error: unknown, offline = false): ProfileLoadFailure {
  const failure = error as {
    code?: unknown;
    deadlineSeconds?: unknown;
    response?: {
      status?: unknown;
      data?: { requestId?: unknown; errorCode?: unknown };
      headers?: Record<string, unknown>;
    };
  } | null;
  const status = failure?.response?.status;
  const requestId = failure?.response?.data?.requestId ?? failure?.response?.headers?.['x-request-id'];
  const details = {
    ...(typeof status === 'number' && Number.isInteger(status) && status >= 400 && status <= 599 ? { status } : {}),
    ...(typeof requestId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(requestId) ? { requestId } : {}),
  };
  if (details.status === 503 && failure?.response?.data?.errorCode === 'DATABASE_QUOTA_EXCEEDED')
    return { kind: 'database-limit', ...details };
  if (details.status === 503 && failure?.response?.data?.errorCode === 'DATABASE_UNAVAILABLE')
    return { kind: 'database', ...details };
  if (details.status) {
    const kind =
      details.status === 403
        ? 'permission'
        : details.status === 429
          ? 'rate-limit'
          : details.status >= 500
            ? 'server'
            : 'response';
    return { kind, ...details };
  }
  if (failure?.code === 'PROFILE_ACCOUNT_CHANGED') return { kind: 'account-changed' };
  if (failure?.code === 'PROFILE_INVALID') return { kind: 'response' };
  if (failure?.code === 'ETIMEDOUT' || failure?.code === 'ECONNABORTED') {
    return { kind: 'timeout', ...(failure.deadlineSeconds === 60 ? { deadlineSeconds: 60 } : {}) };
  }
  if (offline) return { kind: 'offline' };
  if (failure?.code === 'ERR_NETWORK') return { kind: 'connection' };
  return { kind: 'unknown' };
}

export function profileLoadFailureCopy(failure?: ProfileLoadFailure | null) {
  switch (failure?.kind) {
    case 'timeout':
      return {
        reason:
          failure.deadlineSeconds === 60
            ? 'The account check did not finish within 60 seconds.'
            : 'The server did not respond to the account check in time.',
        recovery: 'The server or connection may be slow. Try again in a moment.',
      };
    case 'offline':
      return { reason: 'Your browser is offline.', recovery: 'Reconnect to the internet, then try again.' };
    case 'connection':
      return {
        reason: 'The account check received no response from the server.',
        recovery: 'Check your connection and try again. The API may be restarting or unreachable.',
      };
    case 'database-limit':
      return {
        reason: 'The database service has reached its usage limit.',
        recovery: 'The administrator needs to restore database availability before you can continue.',
      };
    case 'database':
      return {
        reason: 'The API could not access its database.',
        recovery: 'Try again in a moment. If this continues, contact the administrator.',
      };
    case 'server':
      return {
        reason: `The server could not complete the account check (HTTP ${failure.status}).`,
        recovery:
          'Try again in a moment. If this continues, share the request ID with the administrator when available.',
      };
    case 'permission':
      return {
        reason: 'The server denied access to the account profile (HTTP 403).',
        recovery: 'Try again, or contact the administrator if access is still denied.',
      };
    case 'rate-limit':
      return {
        reason: 'Too many account requests were sent (HTTP 429).',
        recovery: 'Wait a minute before trying again.',
      };
    case 'response':
      return {
        reason: failure.status
          ? `The account check failed (HTTP ${failure.status}).`
          : 'The server returned an incomplete or unexpected account profile.',
        recovery: 'Try again. If this continues, contact the administrator.',
      };
    case 'account-changed':
      return {
        reason: 'The signed-in account changed while its profile was loading.',
        recovery: 'Try again to check the account currently signed in.',
      };
    default:
      return {
        reason: 'The account check failed without a specific connection or server error.',
        recovery: 'Try again. If this continues, contact the administrator.',
      };
  }
}
