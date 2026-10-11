import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AuthenticatedEntryRedirect from './AuthenticatedEntryRedirect';
import type { UserSession } from '@/lib/context/AuthContext';

const unresolvedUser: UserSession = {
  userId: 'fixture-user',
  name: 'Fixture User',
  email: 'fixture@example.test',
  role: 'USER',
  emailVerified: false,
  onboardingDone: false,
  tosAccepted: false,
  reportAcknowledged: false,
};

const replace = vi.fn();
const router = { replace };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

describe('AuthenticatedEntryRedirect', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it('allows a cold route to open before offering bounded navigation recovery', () => {
    vi.useFakeTimers();
    render(<AuthenticatedEntryRedirect user={{ ...unresolvedUser, emailVerified: true }} logout={vi.fn()} inline />);
    act(() => vi.advanceTimersByTime(18_000));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Redirecting to your workspace...')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(12_000));
    expect(screen.getByRole('alert')).toHaveTextContent('Your workspace took too long to open');
  });

  it('waits for authoritative profile status instead of redirecting a failed read to OTP', () => {
    const retryProfile = vi.fn().mockResolvedValue(null);
    const logout = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <AuthenticatedEntryRedirect
        user={unresolvedUser}
        logout={logout}
        profileLoadError
        profileLoadFailure={{ kind: 'connection' }}
        retryProfile={retryProfile}
      />
    );

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByText('Could not load your account')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('received no response from the server');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retryProfile).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(logout).toHaveBeenCalledOnce();

    rerender(
      <AuthenticatedEntryRedirect
        user={{ ...unresolvedUser, emailVerified: true, onboardingNextPath: '/onboarding/stats' }}
        logout={logout}
        profileLoadError={false}
        retryProfile={retryProfile}
      />
    );
    expect(replace).toHaveBeenCalledExactlyOnceWith('/onboarding/stats');
  });

  it('still requires OTP when the loaded profile confirms an unverified email', () => {
    render(<AuthenticatedEntryRedirect user={unresolvedUser} logout={vi.fn()} profileLoadError={false} />);
    expect(replace).toHaveBeenCalledExactlyOnceWith('/verify-email');
  });

  it('keeps an inline pending state until the authoritative profile is resolved', () => {
    const { rerender } = render(
      <AuthenticatedEntryRedirect user={unresolvedUser} logout={vi.fn()} isResolving inline />
    );
    expect(screen.getByText('Checking your account…')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
    expect(document.querySelector('.fixed.inset-0')).toBeNull();
    rerender(
      <AuthenticatedEntryRedirect
        user={{ ...unresolvedUser, emailVerified: true, onboardingNextPath: '/onboarding/stats' }}
        logout={vi.fn()}
        inline
      />
    );
    expect(replace).toHaveBeenCalledExactlyOnceWith('/onboarding/stats');
    expect(screen.getByText('Redirecting to your workspace...')).toBeInTheDocument();
    expect(document.querySelector('.fixed.inset-0')).toBeNull();
  });

  it('keeps failed-profile recovery inline and stops navigation during retry', () => {
    const retryProfile = vi.fn().mockResolvedValue(null);
    const { rerender } = render(
      <AuthenticatedEntryRedirect
        user={unresolvedUser}
        logout={vi.fn()}
        profileLoadError
        retryProfile={retryProfile}
        inline
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load your account');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retryProfile).toHaveBeenCalledOnce();
    expect(replace).not.toHaveBeenCalled();
    rerender(<AuthenticatedEntryRedirect user={unresolvedUser} logout={vi.fn()} isResolving inline />);
    expect(screen.getByText('Checking your account…')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('offers recovery instead of leaving a new account on an infinite redirect spinner', async () => {
    render(
      <AuthenticatedEntryRedirect
        user={{
          userId: 'new-user',
          name: 'New User',
          email: 'new@example.test',
          role: 'USER',
          emailVerified: true,
          onboardingDone: false,
          tosAccepted: false,
          reportAcknowledged: false,
          onboardingNextPath: '/onboarding/stats',
        }}
        logout={vi.fn()}
        recoveryDelayMs={1}
      />
    );

    expect(replace).toHaveBeenCalledWith('/onboarding/stats');
    expect(screen.getByText('Redirecting to your workspace...')).toBeInTheDocument();

    expect(await screen.findByText('Your workspace took too long to open')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});
