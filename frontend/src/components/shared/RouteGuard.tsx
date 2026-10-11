'use client';

import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import AccountProfileFailureDetails from '@/components/shared/AccountProfileFailureDetails';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import { getPostAuthDestination } from '@/lib/post-auth-destination';
import AuthenticatedEntryRedirect from '@/components/auth/AuthenticatedEntryRedirect';
import { finishWorkspaceNavigation } from '@/lib/workspace-navigation-recovery';

interface RouteGuardProps {
  children: React.ReactNode;
}

/**
 * RouteGuard is a layout wrapper component that enforces roles,
 * authentication statuses, and system completion parameters before loading pages.
 *
 * Guard chain:
 * 1. Is user logged in? No → /login
 * 2. Is email verified? No → /verify-email
 * 3. Does role match route? No → /unauthorized
 * 4. Is onboarding done? No → /onboarding/stats
 * 5. Is ToS accepted? No → /onboarding/tos
 * Report acknowledgment gates meal actions on the server, not access to profile/history.
 */
export const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const { user, isLoading, profileLoadError, profileLoadFailure, refreshSession, logout } = useAuth();
  const pathname = usePathname();

  const publicRoutes = [
    '/login',
    '/register',
    '/unauthorized',
    '/forgot-password',
    '/reset-password',
    '/nutritionist-apply',
    '/nutritionist-invitation',
    '/docs',
    '/sources',
    '/pricing',
  ];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  const isEntryRoute = pathname === '/' || pathname === '/login' || pathname === '/register';
  const isVerifyPage = pathname.startsWith('/verify-email');
  const isOnboardingPage = pathname.startsWith('/onboarding');
  const isAccountPrivacyRoute = pathname.startsWith('/profile/security');
  const isAdminRoute = pathname.startsWith('/admin');
  const isNutritionistRoute = pathname.startsWith('/nutritionist');
  const isUserRoute = [
    '/dashboard',
    '/meals',
    '/grocery',
    '/profile',
    '/progress',
    '/health-profile',
    '/export',
    '/membership',
    '/onboarding',
    '/nutrition-report',
  ].some((route) => pathname.startsWith(route));

  let redirectTarget: string | null = null;
  if (!isLoading && !profileLoadError) {
    if (!user && !isPublicRoute) {
      redirectTarget = '/login';
    } else if (user) {
      if (isEntryRoute) {
        redirectTarget = getPostAuthDestination(user);
      } else if (!user.emailVerified && !isVerifyPage && !isPublicRoute && !isAccountPrivacyRoute) {
        redirectTarget = '/verify-email';
      } else if (isVerifyPage) {
        if (user.emailVerified) redirectTarget = getPostAuthDestination(user);
      } else if (!isPublicRoute && isAdminRoute && user.role !== 'ADMIN') {
        redirectTarget = '/unauthorized';
      } else if (!isPublicRoute && isNutritionistRoute && user.role !== 'NUTRITIONIST') {
        redirectTarget = '/unauthorized';
      } else if (isUserRoute && user.role !== 'USER') {
        redirectTarget = '/unauthorized';
      } else if (!isPublicRoute && user.role === 'USER') {
        if (!user.onboardingDone && !isOnboardingPage && !isAccountPrivacyRoute) {
          redirectTarget = user.onboardingNextPath || '/onboarding/stats';
        } else if (
          user.onboardingDone &&
          user.onboardingNextPath?.startsWith('/onboarding/') &&
          !isOnboardingPage &&
          !isAccountPrivacyRoute
        ) {
          redirectTarget = user.onboardingNextPath;
        } else if (user.onboardingDone && !user.tosAccepted && !pathname.endsWith('/tos') && !isAccountPrivacyRoute) {
          redirectTarget = '/onboarding/tos';
        }
      }
    }
  }

  useEffect(() => {
    if (!isLoading && !profileLoadError && !redirectTarget) finishWorkspaceNavigation(user?.userId);
  }, [isLoading, profileLoadError, redirectTarget, user?.userId, pathname]);

  if (redirectTarget) {
    return <AuthenticatedEntryRedirect user={user} destinationOverride={redirectTarget} logout={logout} />;
  }

  // Render a full-screen loading spinner while the status is being resolved
  // Public auth forms can stay mounted while the cookie is checked. Their own
  // readiness controls prevent submission; protected workspaces still wait.
  if (isLoading && !isPublicRoute) {
    return <PortalLoadingState fullScreen />;
  }

  if (profileLoadError && (!isPublicRoute || (isEntryRoute && user))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-bg p-6 text-brand-text">
        <div role="alert" className="w-full max-w-md rounded-2xl border border-brand-border bg-brand-surface p-6">
          <h1 className="font-display text-xl font-bold">Could not load your account profile</h1>
          <AccountProfileFailureDetails failure={profileLoadFailure} />
          <div className="mt-5 flex gap-3">
            <Button type="button" onClick={() => void refreshSession({ showLoader: true })}>
              Try again
            </Button>
            <Button type="button" variant="secondary" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Double-check authorization matching before rendering sensitive components
  const isProtectedPath = !isPublicRoute;

  if (isProtectedPath && !user) {
    return <PortalLoadingState fullScreen />;
  }

  return <>{children}</>;
};

export default RouteGuard;
