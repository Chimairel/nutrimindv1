import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AuthenticatedEntryRedirect from './AuthenticatedEntryRedirect';

const replace = vi.fn();
const router = { replace };
vi.mock('next/navigation', () => ({
  useRouter: () => router,
}));

describe('AuthenticatedEntryRedirect', () => {
  afterEach(() => {
    vi.clearAllMocks();
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
