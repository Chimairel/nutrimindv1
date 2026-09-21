import axios, { type AxiosAdapter } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import api, { setSessionRefreshSuppressed } from './axios';
import { cookieHelper } from './auth';

describe('session recovery during background requests', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setSessionRefreshSuppressed(false);
    cookieHelper.clear('nutrimind_session');
  });

  it.each([503, 429, undefined])('preserves the session when refresh fails with %s', async (status) => {
    cookieHelper.set('nutrimind_session', 'existing-session');
    const clear = vi.spyOn(cookieHelper, 'clear');
    const refresh = vi.spyOn(axios, 'post').mockRejectedValue({ response: status ? { status } : undefined });
    const adapter = vi.fn<AxiosAdapter>(async (config) => Promise.reject({ config, response: { status: 401 } }));

    await expect(api.get('/user/meals/generation-status', { adapter })).rejects.toBeDefined();
    expect(clear).not.toHaveBeenCalled();
    expect(cookieHelper.get('nutrimind_session')).toBe('existing-session');

    refresh.mockResolvedValue({ data: { success: true, data: { accessToken: 'renewed-session' } } });
    adapter.mockImplementationOnce(async (config) => Promise.reject({ config, response: { status: 401 } }));
    adapter.mockImplementationOnce(async (config) => ({
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }));
    await expect(api.get('/user/meals/generation-status', { adapter })).resolves.toMatchObject({ status: 200 });
    expect(cookieHelper.get('nutrimind_session')).toBe('renewed-session');
  });

  it('does not start a refresh race while a session is being deliberately terminated', async () => {
    cookieHelper.set('nutrimind_session', 'ending-session');
    setSessionRefreshSuppressed(true);
    const refresh = vi.spyOn(axios, 'post');
    const adapter = vi.fn<AxiosAdapter>(async (config) => Promise.reject({ config, response: { status: 401 } }));

    await expect(api.get('/user/notifications', { adapter })).rejects.toBeDefined();
    expect(refresh).not.toHaveBeenCalled();
    expect(cookieHelper.get('nutrimind_session')).toBe('ending-session');
  });
});
