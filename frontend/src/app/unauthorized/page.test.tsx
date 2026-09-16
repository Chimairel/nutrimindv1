import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UnauthorizedPage from './page';

const mockState = vi.hoisted(() => ({
  user: null as { role: 'USER' | 'NUTRITIONIST' | 'ADMIN' } | null,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockState.user, isLoading: false }),
}));

describe('UnauthorizedPage', () => {
  it('renders Access Denied with Go to Login for unauthenticated users', () => {
    mockState.user = null;
    render(<UnauthorizedPage />);

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('Access Restricted')).toBeInTheDocument();
    const loginLink = screen.getByRole('link', { name: /go to login/i });
    expect(loginLink).toHaveAttribute('href', '/login');
  });

  it('renders Return to Workspace pointing to /dashboard for USER', () => {
    mockState.user = { role: 'USER' };
    render(<UnauthorizedPage />);

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    const workspaceLink = screen.getByRole('link', { name: /return to workspace/i });
    expect(workspaceLink).toHaveAttribute('href', '/dashboard');
  });

  it('renders Return to Workspace pointing to /admin/overview for ADMIN', () => {
    mockState.user = { role: 'ADMIN' };
    render(<UnauthorizedPage />);

    const workspaceLink = screen.getByRole('link', { name: /return to workspace/i });
    expect(workspaceLink).toHaveAttribute('href', '/admin/overview');
  });

  it('renders Return to Workspace pointing to /nutritionist/reviews for NUTRITIONIST', () => {
    mockState.user = { role: 'NUTRITIONIST' };
    render(<UnauthorizedPage />);

    const workspaceLink = screen.getByRole('link', { name: /return to workspace/i });
    expect(workspaceLink).toHaveAttribute('href', '/nutritionist/reviews');
  });
});
