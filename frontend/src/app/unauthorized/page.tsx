'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import UnauthorizedState from '@/components/shared/UnauthorizedState';

const getRoleHome = (role: 'USER' | 'NUTRITIONIST' | 'ADMIN') => {
  if (role === 'ADMIN') return '/admin/overview';
  if (role === 'NUTRITIONIST') return '/nutritionist/reviews';
  return '/dashboard';
};

/**
 * Unauthorized Page — shown when a user tries to access a route
 * their role doesn't have permission for (e.g., USER trying /nutritionist or /admin).
 */
export default function UnauthorizedPage() {
  const { user } = useAuth();
  const primaryHref = user ? getRoleHome(user.role) : '/login';
  const primaryLabel = user ? 'Return to Workspace' : 'Go to Login';

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg px-4 py-8">
      <UnauthorizedState
        variant="page"
        eyebrow="Access Restricted"
        title="Access Denied"
        description="You don't have permission to access this page. This area is restricted to a different account role. If you believe this is a mistake, please contact support."
        action={{
          label: primaryLabel,
          href: primaryHref,
        }}
        secondaryAction={{
          label: 'Go Back',
          onClick: () => window.history.back(),
        }}
      />
    </div>
  );
}
