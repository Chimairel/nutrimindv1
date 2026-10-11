import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { refreshUserProfile } from './user-profile-resource';
import { clearSessionResourceCache } from './session-resource-cache';
const mocks = vi.hoisted(() => ({ get: vi.fn(), owner: 'member' }));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get } }));
vi.mock('@/lib/auth', () => ({
  cookieHelper: { get: () => 'synthetic' },
  decodeToken: () => ({ userId: mocks.owner }),
}));
beforeEach(() => {
  vi.useFakeTimers();
  clearSessionResourceCache();
  vi.clearAllMocks();
  mocks.owner = 'member';
});
afterEach(() => vi.useRealTimers());
it('shares one bounded transient retry and returns only the fresh successful profile', async () => {
  mocks.get
    .mockRejectedValueOnce({ code: 'ECONNABORTED' })
    .mockResolvedValueOnce({ data: { success: true, data: { id: 'member' } } });
  const first = refreshUserProfile('member');
  const second = refreshUserProfile('member');
  expect(first).toBe(second);
  await vi.advanceTimersByTimeAsync(1_000);
  await expect(first).resolves.toEqual({ id: 'member' });
  expect(mocks.get.mock.calls.map((call) => call[1].timeout)).toEqual([45000, 15000]);
});
it('does not retry authorization failures or switch the retry into another account', async () => {
  mocks.get.mockRejectedValueOnce({ response: { status: 401 } });
  await expect(refreshUserProfile('member')).rejects.toMatchObject({ response: { status: 401 } });
  expect(mocks.get).toHaveBeenCalledOnce();
  mocks.get.mockClear();
  mocks.owner = 'other';
  mocks.get.mockRejectedValueOnce({ code: 'ERR_NETWORK' });
  await expect(refreshUserProfile('member')).rejects.toMatchObject({ code: 'ERR_NETWORK' });
  expect(mocks.get).toHaveBeenCalledOnce();
});
it('exhausted spaced retries remain unresolved and never return a cached profile', async () => {
  mocks.get.mockRejectedValue({ response: { status: 503 } });
  const result = expect(refreshUserProfile('member')).rejects.toMatchObject({ response: { status: 503 } });
  await vi.advanceTimersByTimeAsync(6_000);
  await result;
  expect(mocks.get).toHaveBeenCalledTimes(4);
});

it('survives two immediate API disconnects and only accepts the recovered live profile', async () => {
  mocks.get
    .mockRejectedValueOnce({ code: 'ERR_NETWORK' })
    .mockRejectedValueOnce({ response: { status: 503 } })
    .mockResolvedValueOnce({ data: { success: true, data: { id: 'member', emailVerified: true } } });
  const result = refreshUserProfile('member');
  await vi.advanceTimersByTimeAsync(999);
  expect(mocks.get).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(2_001);
  await expect(result).resolves.toMatchObject({ id: 'member', emailVerified: true });
  expect(mocks.get).toHaveBeenCalledTimes(3);
});

it('does not issue a retry after the account changes during the reconnect delay', async () => {
  mocks.get.mockRejectedValue({ code: 'ERR_NETWORK' });
  const result = expect(refreshUserProfile('member')).rejects.toMatchObject({ code: 'ERR_NETWORK' });
  await vi.advanceTimersByTimeAsync(500);
  mocks.owner = 'other';
  await vi.advanceTimersByTimeAsync(500);
  await result;
  expect(mocks.get).toHaveBeenCalledTimes(1);
});

it('ends a stalled profile or interceptor at the overall deadline and aborts the read', async () => {
  mocks.get.mockImplementation(() => new Promise(() => {}));
  const result = expect(refreshUserProfile('member')).rejects.toMatchObject({ code: 'ETIMEDOUT' });
  await vi.advanceTimersByTimeAsync(60_000);
  await result;
  expect(mocks.get.mock.calls[0][1].signal.aborted).toBe(true);
  expect(mocks.get).toHaveBeenCalledTimes(1);
});

it('never resets the overall deadline when a slow first attempt fails', async () => {
  mocks.get
    .mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          setTimeout(() => reject({ response: { status: 503 } }), 58_000);
        })
    )
    .mockImplementationOnce(() => new Promise(() => {}));
  const result = expect(refreshUserProfile('member')).rejects.toMatchObject({ code: 'ETIMEDOUT' });
  await vi.advanceTimersByTimeAsync(60_000);
  await result;
  expect(mocks.get).toHaveBeenCalledTimes(2);
  expect(mocks.get.mock.calls[1][1].timeout).toBe(1_000);
});

it('rejects a successful HTTP response with missing profile data without retrying it', async () => {
  mocks.get.mockResolvedValue({ data: { success: true, data: null } });
  await expect(refreshUserProfile('member')).rejects.toMatchObject({ code: 'PROFILE_INVALID' });
  expect(mocks.get).toHaveBeenCalledOnce();
});

it('reports a confirmed database quota block immediately instead of repeating hopeless requests', async () => {
  mocks.get.mockRejectedValue({
    response: { status: 503, data: { errorCode: 'DATABASE_QUOTA_EXCEEDED', requestId: 'quota-request' } },
  });
  await expect(refreshUserProfile('member')).rejects.toMatchObject({
    response: { data: { errorCode: 'DATABASE_QUOTA_EXCEEDED' } },
  });
  expect(mocks.get).toHaveBeenCalledOnce();
});
