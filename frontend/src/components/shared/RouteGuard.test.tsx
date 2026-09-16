import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RouteGuard from './RouteGuard';

const state = vi.hoisted(() => ({
  path: '/profile',
  replace: vi.fn(),
  user: { role: 'USER', emailVerified: true, onboardingDone: true, tosAccepted: true, reportAcknowledged: false },
}));
vi.mock('next/navigation', () => ({ usePathname: () => state.path, useRouter: () => ({ replace: state.replace }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user, isLoading: false }) }));

describe('report access within the profile', () => {
  beforeEach(() => {
    state.replace.mockClear();
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
});
