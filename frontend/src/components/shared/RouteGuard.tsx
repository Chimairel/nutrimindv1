'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import { getPostAuthDestination } from '@/lib/post-auth-destination';

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
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const publicRoutes = [
    '/login',
    '/register',
    '/unauthorized',
    '/forgot-password',
    '/reset-password',
    '/nutritionist-apply',
    '/nutritionist-invitation',
  ];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
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
    '/onboarding',
    '/nutrition-report',
  ].some((route) => pathname.startsWith(route));

  let redirectTarget: string | null = null;
  if (!isLoading) {
    if (!user && !isPublicRoute) {
      redirectTarget = '/login';
    } else if (user) {
      const isEntryRoute = pathname === '/' || pathname === '/login' || pathname === '/register';
      if (isEntryRoute) {
        redirectTarget = getPostAuthDestination(user);
      } else if (!user.emailVerified && !isVerifyPage && !isPublicRoute && !isAccountPrivacyRoute) {
        redirectTarget = '/verify-email';
      } else if (isVerifyPage && user.emailVerified) {
        redirectTarget = getPostAuthDestination(user);
      } else if (!isPublicRoute && isAdminRoute && user.role !== 'ADMIN') {
        redirectTarget = '/unauthorized';
      } else if (!isPublicRoute && isNutritionistRoute && user.role !== 'NUTRITIONIST') {
        redirectTarget = '/unauthorized';
      } else if (isUserRoute && user.role !== 'USER') {
        redirectTarget = '/unauthorized';
      } else if (!isPublicRoute && user.role === 'USER') {
        if (!user.onboardingDone && !isOnboardingPage && !isAccountPrivacyRoute) {
          redirectTarget = user.onboardingNextPath || '/onboarding/stats';
        } else if (user.onboardingDone && !user.tosAccepted && !pathname.endsWith('/tos') && !isAccountPrivacyRoute) {
          redirectTarget = '/onboarding/tos';
        }
      }
    }
  }

  useEffect(() => {
    if (redirectTarget) router.replace(redirectTarget);
  }, [redirectTarget, router]);

  // Render a full-screen loading spinner while the status is being resolved
  if (isLoading || redirectTarget) {
    return <PortalLoadingState fullScreen />;
  }

  // Double-check authorization matching before rendering sensitive components
  const isProtectedPath = !isPublicRoute;

  if (isProtectedPath && !user) {
    return <PortalLoadingState fullScreen />;
  }

  return <>{children}</>;
};

export default RouteGuard;
