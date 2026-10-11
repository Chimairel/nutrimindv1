'use client';
import type { LandingMedia } from '@/features/website-content/types';

import { useAuth } from '@/hooks/useAuth';

import { getRoleHome } from './LandingHome.shared';
export function useLandingHomeModel({ initialMedia }: { initialMedia: LandingMedia | null }) {
  const { user, isLoading, profileLoadError, profileLoadFailure, logout, refreshSession } = useAuth();

  const isPendingVerification = Boolean(user && !user.emailVerified);
  const workspaceHref = user ? (isPendingVerification ? '/verify-email' : getRoleHome(user.role)) : '/register';
  const workspaceLabel = user
    ? isPendingVerification
      ? 'Continue email verification'
      : user.role === 'USER'
        ? 'Go to Dashboard'
        : 'Open Portal'
    : 'Build my profile';

  // Pending verification can browse the public home page. Its call to action
  // still leads back to verification; protected routes remain gated.
  if (user && (user.emailVerified || profileLoadError)) {
    return {
      kind: 'early' as const,
      redirectProps: {
        user,
        isResolving: isLoading,
        profileLoadError,
        profileLoadFailure,
        logout,
        retryProfile: () => refreshSession({ showLoader: true }),
      },
    };
  }

  return { kind: 'ready' as const, workspaceHref, workspaceLabel, initialMedia };
}
