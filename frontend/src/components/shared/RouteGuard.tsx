'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface RouteGuardProps {
  children: React.ReactNode;
}

const getRoleHome = (role: 'USER' | 'NUTRITIONIST' | 'ADMIN') => {
  if (role === 'ADMIN') return '/admin/overview';
  if (role === 'NUTRITIONIST') return '/nutritionist/reviews';
  return '/dashboard';
};

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
 * 6. Is report acknowledged? No → /nutrition-report
 */
export const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const publicRoutes = ['/login', '/register', '/unauthorized', '/forgot-password', '/reset-password', '/nutritionist-apply', '/nutritionist-invitation'];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));
  const isVerifyPage = pathname.startsWith('/verify-email');
  const isOnboardingPage = pathname.startsWith('/onboarding');
  const isNutritionReportPage = pathname.startsWith('/nutrition-report');
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
      if (!user.emailVerified && !isVerifyPage && !isPublicRoute) {
        redirectTarget = '/verify-email';
      } else if (isVerifyPage && user.emailVerified) {
        redirectTarget = getRoleHome(user.role);
      } else if (isAdminRoute && user.role !== 'ADMIN') {
        redirectTarget = '/unauthorized';
      } else if (isNutritionistRoute && user.role !== 'NUTRITIONIST') {
        redirectTarget = '/unauthorized';
      } else if (isUserRoute && user.role !== 'USER') {
        redirectTarget = '/unauthorized';
      } else if (user.role === 'USER') {
        if (!user.onboardingDone && !isOnboardingPage && !isNutritionReportPage) {
          redirectTarget = user.onboardingNextPath || '/onboarding/stats';
        } else if (user.onboardingDone && !user.tosAccepted && !pathname.endsWith('/tos') && !isNutritionReportPage) {
          redirectTarget = '/onboarding/tos';
        } else if (user.onboardingDone && user.tosAccepted && !user.reportAcknowledged && !isNutritionReportPage) {
          redirectTarget = '/nutrition-report';
        }
      }
    }
  }

  useEffect(() => {
    if (redirectTarget) router.replace(redirectTarget);
  }, [redirectTarget, router]);

  // Render a full-screen loading spinner while the status is being resolved
  if (isLoading || redirectTarget) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-brand-bg">
        <LoadingSpinner />
      </div>
    );
  }

  // Double-check authorization matching before rendering sensitive components
  const isProtectedPath = !isPublicRoute;
  
  if (isProtectedPath && !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-brand-bg">
        <LoadingSpinner />
      </div>
    );
  }

  return <>{children}</>;
};

export default RouteGuard;
