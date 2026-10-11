import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProfileLoadFailure } from '@/lib/profile-load-failure';
import RouteGuard from './RouteGuard';

const state = vi.hoisted(() => ({
  path: '/profile',
  replace: vi.fn(),
  profileLoadError: false,
  profileLoadFailure: null as ProfileLoadFailure | null,
  isLoading: false,
  refreshSession: vi.fn(),
  logout: vi.fn(),
  user: { role: 'USER', emailVerified: true, onboardingDone: true, tosAccepted: true, reportAcknowledged: false },
}));
vi.mock('next/navigation', () => ({ usePathname: () => state.path, useRouter: () => ({ replace: state.replace }) }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: state.user,
    isLoading: state.isLoading,
    profileLoadError: state.profileLoadError,
    profileLoadFailure: state.profileLoadFailure,
    refreshSession: state.refreshSession,
    logout: state.logout,
  }),
}));

describe('report access within the profile', () => {
  it.each(['/login', '/register', '/forgot-password', '/reset-password'])(
    'keeps %s mounted during session loading',
    (path) => {
      state.path = path;
      state.isLoading = true;
      state.user = null as unknown as typeof state.user;
      render(
        <RouteGuard>
          <p>Auth form</p>
        </RouteGuard>
      );
      expect(screen.getByText('Auth form')).toBeInTheDocument();
      expect(state.replace).not.toHaveBeenCalled();
    }
  );
  beforeEach(() => {
    state.replace.mockClear();
    state.profileLoadError = false;
    state.profileLoadFailure = null;
    state.isLoading = false;
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
  it.each(['/docs', '/sources'])('keeps the public %s page open without a session', (path) => {
    state.path = path;
    state.user = null as unknown as typeof state.user;
    render(
      <RouteGuard>
        <p>Public information</p>
      </RouteGuard>
    );
    expect(screen.getByText('Public information')).toBeInTheDocument();
    expect(state.replace).not.toHaveBeenCalled();
  });
  it('renders legal information while an old session is still being checked', () => {
    state.path = '/docs';
    state.isLoading = true;
    state.user = null as unknown as typeof state.user;
    render(
      <RouteGuard>
        <p>Public information</p>
      </RouteGuard>
    );
    expect(screen.getByText('Public information')).toBeInTheDocument();
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
    state.profileLoadFailure = { kind: 'server', status: 503, requestId: 'safe-profile-request' };
    render(
      <RouteGuard>
        <p>Workspace</p>
      </RouteGuard>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load your account profile');
    expect(screen.getByRole('alert')).toHaveTextContent('HTTP 503');
    expect(screen.getByRole('alert')).toHaveTextContent('Request ID: safe-profile-request');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(state.replace).not.toHaveBeenCalled();
  });
  it('offers a retry when profile loading fails before a session placeholder exists', () => {
    state.path = '/dashboard';
    state.user = null as unknown as typeof state.user;
    state.profileLoadError = true;
    render(
      <RouteGuard>
        <p>Workspace</p>
      </RouteGuard>
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load your account profile');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
  it.each(['/login', '/register', '/'])(
    'blocks the temporary unverified entry redirect on %s after a failed profile read',
    (path) => {
      state.path = path;
      state.user.emailVerified = false;
      state.profileLoadError = true;
      render(
        <RouteGuard>
          <p>Entry redirect with placeholder</p>
        </RouteGuard>
      );
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load your account profile');
      expect(screen.queryByText('Entry redirect with placeholder')).not.toBeInTheDocument();
      expect(state.replace).not.toHaveBeenCalled();
    }
  );
  it('still sends an authoritatively unverified account to OTP', () => {
    state.path = '/login';
    state.user.emailVerified = false;
    render(
      <RouteGuard>
        <p>Entry</p>
      </RouteGuard>
    );
    expect(state.replace).toHaveBeenCalledWith('/verify-email');
  });
  it('redirects a verified account away from OTP without rendering its form', () => {
    state.path = '/verify-email';
    state.user.reportAcknowledged = true;
    render(
      <RouteGuard>
        <p>OTP form</p>
      </RouteGuard>
    );
    expect(state.replace).toHaveBeenCalledWith('/dashboard');
    expect(screen.queryByText('OTP form')).not.toBeInTheDocument();
  });
  it('keeps an unverified member on OTP before enforcing onboarding', () => {
    state.path = '/verify-email';
    state.user.emailVerified = false;
    state.user.onboardingDone = false;
    render(
      <RouteGuard>
        <p>OTP form</p>
      </RouteGuard>
    );
    expect(screen.getByText('OTP form')).toBeInTheDocument();
    expect(state.replace).not.toHaveBeenCalled();
  });
});
