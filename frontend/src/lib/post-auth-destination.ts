import type { UserSession } from '@/lib/context/AuthContext';

export function getPostAuthDestination(
  user: Pick<
    UserSession,
    'role' | 'emailVerified' | 'onboardingDone' | 'onboardingNextPath' | 'tosAccepted' | 'reportAcknowledged'
  >
): string {
  if (!user.emailVerified) return '/verify-email';
  if (user.role === 'ADMIN') return '/admin/overview';
  if (user.role === 'NUTRITIONIST') return '/nutritionist/reviews';
  if (!user.onboardingDone) return user.onboardingNextPath || '/onboarding/stats';
  if (!user.tosAccepted) return '/onboarding/tos';
  if (!user.reportAcknowledged) return '/profile/nutrition-report';
  return '/dashboard';
}
