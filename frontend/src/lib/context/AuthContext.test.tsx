import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useContext } from 'react';
import { AuthContext, AuthProvider, type AuthContextType } from './AuthContext';

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  clear: vi.fn(),
  replace: vi.fn(),
  clinical: vi.fn(),
  cookie: 'fixture',
  owner: 'fixture-owner',
  post: vi.fn().mockResolvedValue({}),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/lib/axios', () => ({ default: { post: mocks.post }, setSessionRefreshSuppressed: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  decodeToken: () => ({ userId: mocks.owner, email: 'fixture@preview.invalid', role: 'USER' }),
  cookieHelper: {
    get: () => mocks.cookie,
    set: vi.fn(),
    clear: () => {
      mocks.cookie = '';
    },
  },
}));
vi.mock('@/lib/session-resource-cache', () => ({ clearSessionResourceCache: mocks.clear }));
vi.mock('@/lib/user-profile-resource', () => ({ refreshUserProfile: mocks.read }));
vi.mock('@/lib/clinical-profile-status', () => ({ refreshClinicalProfileStatus: mocks.clinical }));

describe('authoritative session refresh coordination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cookie = 'fixture';
    mocks.owner = 'fixture-owner';
  });
  it('returns the same confirmed result to the live refresh and acknowledgment continuation', async () => {
    let finish!: (value: unknown) => void;
    mocks.read.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    let auth!: AuthContextType;
    const Consumer = () => {
      auth = useContext(AuthContext)!;
      return null;
    };
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await waitFor(() => expect(mocks.read).toHaveBeenCalledTimes(1));
    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    await act(async () => {
      first = auth.refreshSession({ showLoader: false });
      second = auth.refreshSession();
    });
    expect(first).toBe(second);
    await act(async () =>
      finish({
        id: 'fixture-owner',
        name: 'Fixture',
        email: 'fixture@preview.invalid',
        role: 'USER',
        emailVerified: true,
        onboardingDone: false,
        tosAccepted: false,
        userProfile: { revision: 2 },
        nutritionReport: { acknowledgedAt: '2026-10-02T13:00:00Z', isStale: false, profileRevision: 2 },
      })
    );
    expect(((await first) as { reportAcknowledged: boolean }).reportAcknowledged).toBe(true);
    expect(((await second) as { reportAcknowledged: boolean }).reportAcknowledged).toBe(true);
    expect(mocks.read).toHaveBeenCalledTimes(1);
  });
  it('cannot restore a logged-out account when the joined read completes late', async () => {
    let finish!: (value: unknown) => void;
    mocks.read.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    let auth!: AuthContextType;
    const Consumer = () => {
      auth = useContext(AuthContext)!;
      return null;
    };
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    const pending = auth.refreshSession();
    await act(async () => {
      await auth.logout();
    });
    await act(async () => finish({ id: 'fixture-owner', role: 'USER', email: 'fixture@preview.invalid' }));
    expect(await pending).toBeNull();
    expect(auth.profileLoadFailure).toBeNull();
    expect(auth.user).toBeNull();
    expect(mocks.replace).toHaveBeenCalledWith('/login');
  });
  it('reports a failed post-login profile read as unresolved instead of a confirmed OTP requirement', async () => {
    mocks.cookie = '';
    mocks.read.mockRejectedValue({ code: 'ETIMEDOUT', deadlineSeconds: 60 });
    let auth!: AuthContextType;
    const Consumer = () => {
      auth = useContext(AuthContext)!;
      return null;
    };
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await act(async () => {
      expect(await auth.login('fixture-token')).toBeNull();
    });
    expect(auth.profileLoadError).toBe(true);
    expect(auth.profileLoadFailure).toEqual({ kind: 'timeout', deadlineSeconds: 60 });
    expect(auth.isLoading).toBe(false);
    expect(auth.user?.emailVerified).toBe(false);
    mocks.read.mockResolvedValue({
      id: 'fixture-owner',
      email: 'fixture@preview.invalid',
      role: 'USER',
      emailVerified: true,
    });
    await act(async () => {
      await auth.refreshSession({ showLoader: true });
    });
    expect(auth.profileLoadError).toBe(false);
    expect(auth.profileLoadFailure).toBeNull();
    expect(auth.user?.emailVerified).toBe(true);
  });
  it('treats omitted verification metadata as a failed check', async () => {
    mocks.cookie = '';
    mocks.read.mockResolvedValue({ id: 'fixture-owner', email: 'fixture@preview.invalid', role: 'USER' });
    let auth!: AuthContextType;
    const Consumer = () => {
      auth = useContext(AuthContext)!;
      return null;
    };
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await act(async () => {
      await auth.login('fixture-token');
    });
    expect(auth.profileLoadError).toBe(true);
    expect(auth.isLoading).toBe(false);
    expect(auth.profileLoadFailure).toEqual({ kind: 'response' });
  });

  it('keeps quiet recovery blocked until the temporary token session has a confirmed profile', async () => {
    mocks.read.mockRejectedValueOnce(new Error('Synthetic API interruption'));
    let auth!: AuthContextType;
    const Consumer = () => {
      auth = useContext(AuthContext)!;
      return null;
    };
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await waitFor(() => expect(auth.profileLoadError).toBe(true));
    let finish!: (value: unknown) => void;
    mocks.read.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    let recovery!: Promise<unknown>;
    await act(async () => {
      recovery = auth.refreshSession({ showLoader: false });
    });
    expect(auth.isLoading || auth.profileLoadError).toBe(true);
    await act(async () =>
      finish({
        id: 'fixture-owner',
        email: 'fixture@preview.invalid',
        role: 'USER',
        emailVerified: true,
      })
    );
    await recovery;
    expect(auth.isLoading).toBe(false);
    expect(auth.profileLoadError).toBe(false);
    expect(auth.profileLoadFailure).toBeNull();
    expect(auth.user?.emailVerified).toBe(true);
  });

  it('keeps session callbacks stable as profile state changes, so form effects do not repeat submissions', async () => {
    mocks.read.mockResolvedValue({ id: 'fixture-owner', role: 'USER', emailVerified: true });
    let auth!: AuthContextType;
    const Consumer = () => {
      auth = useContext(AuthContext)!;
      return null;
    };
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    await waitFor(() => expect(auth.isLoading).toBe(false));
    const refresh = auth.refreshSession,
      login = auth.login,
      logout = auth.logout;
    await act(async () => {
      auth.updateUserSession({ name: 'Changed name' });
      await auth.refreshSession();
    });
    expect(auth.refreshSession).toBe(refresh);
    expect(auth.login).toBe(login);
    expect(auth.logout).toBe(logout);
  });

  it('does not publish a late profile after the account cookie changes elsewhere', async () => {
    let finish!: (profile: unknown) => void;
    mocks.read.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    let auth!: AuthContextType;
    const Consumer = () => {
      auth = useContext(AuthContext)!;
      return null;
    };
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );
    mocks.owner = 'other-account';
    await act(async () => finish({ id: 'fixture-owner', role: 'USER', emailVerified: true }));
    expect(auth.user?.emailVerified).toBe(false);
    expect(auth.profileLoadError).toBe(true);
    expect(auth.profileLoadFailure).toEqual({ kind: 'account-changed' });
  });
});
