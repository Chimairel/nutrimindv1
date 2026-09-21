import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccountSettings from './AccountSettings';
import type { UserSession } from '@/lib/context/AuthContext';

const mocks = vi.hoisted(() => ({
  user: null as UserSession | null,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: mocks.user,
    logout: vi.fn(),
    completeAccountDeletion: vi.fn(),
    updateUserSession: vi.fn(),
  }),
}));
vi.mock('@/features/profile/AvatarSettings', () => ({ default: () => null }));
vi.mock('@/components/auth/GoogleSignInButton', () => ({
  default: () => <button type="button">Continue with Google</button>,
}));

const baseUser: UserSession = {
  userId: 'fixture-user',
  name: 'Google Fixture',
  email: 'google@example.test',
  role: 'USER',
  emailVerified: true,
  onboardingDone: true,
  tosAccepted: true,
  reportAcknowledged: true,
};

describe('provider-aware account security', () => {
  afterEach(() => {
    mocks.user = null;
  });

  it('keeps password controls visible but disabled for a Google-only account', () => {
    mocks.user = { ...baseUser, authMethods: { password: false, google: true } };
    render(<AccountSettings initialPanel="security" />);

    expect(screen.getByText(/uses Google sign-in and does not have a KAINARA password/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Current Password')).toBeDisabled();
    expect(screen.getByLabelText('New Password')).toBeDisabled();
    expect(screen.getByLabelText('Confirm New Password')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Google sign-in account' })).toBeDisabled();
  });

  it('keeps password controls enabled for a password account', () => {
    mocks.user = { ...baseUser, authMethods: { password: true, google: false } };
    render(<AccountSettings initialPanel="security" />);

    expect(screen.getByLabelText('Current Password')).toBeEnabled();
    expect(screen.getByLabelText('New Password')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Update Password' })).toBeEnabled();
  });
});
