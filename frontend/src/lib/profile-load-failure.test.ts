import { describe, expect, it } from 'vitest';
import { classifyProfileLoadFailure, profileCheckError, profileLoadFailureCopy } from './profile-load-failure';

describe('account check diagnostics', () => {
  it.each([
    [{ code: 'ETIMEDOUT', deadlineSeconds: 60 }, 'timeout'],
    [{ code: 'ECONNABORTED' }, 'timeout'],
    [{ code: 'ERR_NETWORK' }, 'connection'],
    [{ response: { status: 503 } }, 'server'],
    [{ response: { status: 503, data: { errorCode: 'DATABASE_QUOTA_EXCEEDED' } } }, 'database-limit'],
    [{ response: { status: 503, data: { errorCode: 'DATABASE_UNAVAILABLE' } } }, 'database'],
    [{ response: { status: 403 } }, 'permission'],
    [{ response: { status: 429 } }, 'rate-limit'],
    [{ response: { status: 404 } }, 'response'],
    [profileCheckError('PROFILE_INVALID'), 'response'],
    [profileCheckError('PROFILE_ACCOUNT_CHANGED'), 'account-changed'],
    [new Error('SQL password=private; backend exploded'), 'unknown'],
  ])('classifies supported failures without using raw error messages', (error, kind) => {
    const failure = classifyProfileLoadFailure(error);
    expect(failure.kind).toBe(kind);
    expect(JSON.stringify(failure)).not.toContain('private');
    expect(JSON.stringify(profileLoadFailureCopy(failure))).not.toContain('SQL');
  });
  it('separates offline from a network failure and does not override a received server response', () => {
    expect(classifyProfileLoadFailure({ code: 'ERR_NETWORK' }, true).kind).toBe('offline');
    expect(classifyProfileLoadFailure({ response: { status: 503 } }, true).kind).toBe('server');
  });
  it('retains only safe request IDs and valid HTTP statuses for diagnosis', () => {
    expect(
      classifyProfileLoadFailure({
        response: { status: 503, data: { requestId: 'safe-request-123', error: 'private' } },
      })
    ).toEqual({ kind: 'server', status: 503, requestId: 'safe-request-123' });
    expect(
      classifyProfileLoadFailure({ response: { status: NaN, data: { requestId: '<script>private</script>' } } })
    ).toEqual({ kind: 'unknown' });
    expect(classifyProfileLoadFailure(null)).toEqual({ kind: 'unknown' });
  });
  it('identifies the overall deadline without claiming a known backend outage', () => {
    const copy = profileLoadFailureCopy(classifyProfileLoadFailure({ code: 'ETIMEDOUT', deadlineSeconds: 60 }));
    expect(copy.reason).toContain('60 seconds');
    expect(copy.recovery).toContain('may be slow');
  });
});
