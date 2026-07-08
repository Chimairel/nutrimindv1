'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

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
 * 6. Is report acknowledged? No → /nutrition-report
 */
export const RouteGuard: React.FC<RouteGuardProps> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // If the authentication context is loading, wait before running guards
    if (isLoading) return;

    const publicRoutes = ['/login', '/register', '/unauthorized', '/forgot-password', '/reset-password'];
    const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

    // 1. Is user logged in? No -> Redirect to Login
    if (!user) {
      if (!isPublicRoute) {
        router.push('/login');
      }
      return;
    }

    // 2. Is email verified? No -> Redirect to verify-email
    const isVerifyPage = pathname.startsWith('/verify-email');
    if (!user.emailVerified) {
      if (!isVerifyPage && !isPublicRoute) {
        router.push('/verify-email');
      }
      return;
    }

    // If already on verify-email but verified, redirect away
    if (isVerifyPage && user.emailVerified) {
      router.push('/dashboard');
      return;
    }

    // 3. Does role match route prefixes?
    const isAdminRoute = pathname.startsWith('/admin');
    const isNutritionistRoute = pathname.startsWith('/nutritionist');
    const isUserRoute = pathname.startsWith('/dashboard') || 
                        pathname.startsWith('/meals') || 
                        pathname.startsWith('/grocery') || 
                        pathname.startsWith('/profile') || 
                        pathname.startsWith('/progress');

    if (isAdminRoute && user.role !== 'ADMIN') {
      router.push('/unauthorized');
      return;
    }
    if (isNutritionistRoute && user.role !== 'NUTRITIONIST') {
      router.push('/unauthorized');
      return;
    }
    if (isUserRoute && user.role !== 'USER') {
      router.push('/unauthorized');
      return;
    }

    // 4. Skip internal checklists for non-USER accounts
    if (user.role !== 'USER') return;

    // We define paths matching specific steps of onboarding & reporting
    const isOnboardingPage = pathname.startsWith('/onboarding');
    const isNutritionReportPage = pathname.startsWith('/nutrition-report');

    // Check 4: Is Onboarding Done?
    if (!user.onboardingDone && !isOnboardingPage && !isNutritionReportPage) {
      router.push('/onboarding/stats');
      return;
    }

    // Check 5: Is ToS Accepted?
    if (user.onboardingDone && !user.tosAccepted && !pathname.endsWith('/tos') && !isNutritionReportPage) {
      router.push('/onboarding/tos');
      return;
    }

    // Check 6: Is Report Acknowledged?
    if (user.onboardingDone && user.tosAccepted && !user.reportAcknowledged && !isNutritionReportPage) {
      router.push('/nutrition-report');
      return;
    }

  }, [user, isLoading, pathname, router]);

  // Render a full-screen loading spinner while the status is being resolved
  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-brand-bg">
        <LoadingSpinner />
      </div>
    );
  }

  // Double-check authorization matching before rendering sensitive components
  const isProtectedPath = !['/login', '/register', '/unauthorized', '/forgot-password', '/reset-password'].some((route) => pathname.startsWith(route));
  
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
