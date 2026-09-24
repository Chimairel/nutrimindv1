import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RouteGuard from './RouteGuard';

const state = vi.hoisted(() => ({
  path: '/profile',
  replace: vi.fn(),
  profileLoadError: false,
  refreshSession: vi.fn(),
  logout: vi.fn(),
  user: { role: 'USER', emailVerified: true, onboardingDone: true, tosAccepted: true, reportAcknowledged: false },
}));
vi.mock('next/navigation', () => ({ usePathname: () => state.path, useRouter: () => ({ replace: state.replace }) }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: state.user,
    isLoading: false,
    profileLoadError: state.profileLoadError,
    refreshSession: state.refreshSession,
    logout: state.logout,
  }),
}));

describe('report access within the profile', () => {
  beforeEach(() => {
    state.replace.mockClear();
    state.profileLoadError = false;
    state.user = {
      role: 'USER',
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      reportAcknowledged: false,
    };
  });
  it.each([
    '/profile',
    '/profile/planning',
    '/profile/nutrition-report',
    '/nutrition-report',
    '/dashboard',
    '/progress',
  ])('keeps %s accessible while acknowledgment is pending', (path) => {
    state.path = path;
    render(
      <RouteGuard>
        <p>Workspace</p>
      </RouteGuard>
    );
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(state.replace).not.toHaveBeenCalled();
  });
  it('still enforces onboarding before report access', () => {
    state.path = '/profile/nutrition-report';
    state.user.onboardingDone = false;
    render(
      <RouteGuard>
        <p>Workspace</p>
      </RouteGuard>
    );
    expect(state.replace).toHaveBeenCalledWith('/onboarding/stats');
  });
  it('still rejects a different role', () => {
    state.path = '/profile/nutrition-report';
    state.user.role = 'ADMIN';
    render(
      <RouteGuard>
        <p>Workspace</p>
      </RouteGuard>
    );
    expect(state.replace).toHaveBeenCalledWith('/unauthorized');
  });
  it('offers a retry instead of treating a failed profile read as unverified email', () => {
    state.path = '/meals';
    state.user.emailVerified = false;
    state.profileLoadError = true;
    render(
      <RouteGuard>
        <p>Workspace</p>
      </RouteGuard>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load your account profile');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(state.replace).not.toHaveBeenCalled();
  });
});
