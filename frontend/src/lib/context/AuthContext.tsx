'use client';

import React, { createContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@/types';
import { decodeToken, cookieHelper } from '@/lib/auth';
import api, { setSessionRefreshSuppressed } from '@/lib/axios';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import { classifyProfileLoadFailure, profileCheckError, type ProfileLoadFailure } from '@/lib/profile-load-failure';
import { refreshUserProfile } from '@/lib/user-profile-resource';
import { refreshClinicalProfileStatus } from '@/lib/clinical-profile-status';
import { disableDeviceNotifications } from '@/lib/device-notifications';

export interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  onboardingDone: boolean;
  tosAccepted: boolean;
  reportAcknowledged: boolean;
  onboardingNextPath?: string;
  image?: string;
  googleImage?: string;
  authMethods?: {
    password: boolean;
    google: boolean;
  };
}

export interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  profileLoadError: boolean;
  profileLoadFailure: ProfileLoadFailure | null;
  login: (token: string) => Promise<UserSession | null>;
  logout: () => Promise<void>;
  completeAccountDeletion: () => void;
  refreshSession: (options?: { showLoader?: boolean }) => Promise<UserSession | null>;
  updateUserSession: (updates: Partial<UserSession>) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [profileLoadError, setProfileLoadError] = useState(false);
  const [profileLoadFailure, setProfileLoadFailure] = useState<ProfileLoadFailure | null>(null);
  const sessionRequestId = useRef(0);
  const confirmedProfileOwner = useRef<string | null>(null);
  const sessionRefresh = useRef<{
    ownerId: string | undefined;
    requestId: number;
    promise: Promise<UserSession | null>;
  } | null>(null);
  const { replace } = useRouter();

  // Refresh user profile details from backend to ensure state accuracy
  const loadSession = useCallback(async (options?: { showLoader?: boolean }) => {
    const requestId = ++sessionRequestId.current;
    const ownerId = decodeToken(cookieHelper.get('nutrimind_session') || '')?.userId;
    // A quiet retry must never expose provisional token claims to route guards.
    if (options?.showLoader || !ownerId || confirmedProfileOwner.current !== ownerId) {
      setIsLoading(true);
    }
    setProfileLoadError(false);
    setProfileLoadFailure(null);

    try {
      const profile = await refreshUserProfile(ownerId);
      if (profile) {
        // Missing verification metadata is an unresolved check, not an OTP requirement.
        if (typeof profile.emailVerified !== 'boolean') throw profileCheckError('PROFILE_INVALID');
        if (!ownerId || profile.id !== ownerId) throw profileCheckError('PROFILE_INVALID');
        if (decodeToken(cookieHelper.get('nutrimind_session') || '')?.userId !== ownerId) {
          throw profileCheckError('PROFILE_ACCOUNT_CHANGED');
        }
        const {
          id,
          name,
          email,
          role,
          emailVerified,
          onboardingDone,
          tosAccepted,
          image,
          googleImage,
          authMethods,
          userProfile,
          nutritionReport,
          onboardingStatus,
        } = profile;

        const isReportAcknowledged =
          profile.reportAcknowledged ??
          Boolean(
            nutritionReport?.acknowledgedAt &&
            !nutritionReport?.isStale &&
            (nutritionReport?.profileRevision === undefined ||
              userProfile?.revision === undefined ||
              nutritionReport?.profileRevision === userProfile?.revision)
          );

        const refreshedUser: UserSession = {
          userId: id,
          name,
          email,
          role: role as Role,
          emailVerified,
          onboardingDone,
          tosAccepted: Boolean(tosAccepted && onboardingStatus?.acceptedCurrentConsent),
          image,
          googleImage,
          authMethods: authMethods ?? { password: true, google: false },
          reportAcknowledged: isReportAcknowledged,
          onboardingNextPath: onboardingStatus?.nextPath,
        };

        if (requestId !== sessionRequestId.current) return null;

        confirmedProfileOwner.current = id;
        setUser((previous) => (JSON.stringify(previous) === JSON.stringify(refreshedUser) ? previous : refreshedUser));
        setProfileLoadError(false);
        setProfileLoadFailure(null);
        if (role === 'USER' && onboardingDone && tosAccepted && isReportAcknowledged) {
          void refreshClinicalProfileStatus(id, profile).catch(() => undefined);
        }
        return refreshedUser;
      }
      throw profileCheckError('PROFILE_INVALID');
    } catch (error) {
      if (requestId !== sessionRequestId.current) return null;

      const failure = classifyProfileLoadFailure(error, typeof navigator !== 'undefined' && !navigator.onLine);
      console.warn('[AuthContext] Could not confirm live profile status.', failure);
      // If we fail because we are unauthenticated, clear session
      if ((error as { response?: { status?: number } }).response?.status === 401) {
        clearSessionResourceCache();
        confirmedProfileOwner.current = null;
        setUser(null);
        setProfileLoadError(false);
        setProfileLoadFailure(null);
      } else {
        setProfileLoadFailure(failure);
        setProfileLoadError(true);
      }
      return null;
    } finally {
      if (requestId === sessionRequestId.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Live events and explicit continuations join the same authoritative read.
  const refreshSession = useCallback(
    (options?: { showLoader?: boolean }) => {
      const ownerId = decodeToken(cookieHelper.get('nutrimind_session') || '')?.userId;
      const pending = sessionRefresh.current;
      if (pending && pending.ownerId === ownerId && pending.requestId === sessionRequestId.current) {
        if (options?.showLoader) setIsLoading(true);
        return pending.promise;
      }
      const promise = loadSession(options);
      const entry = { ownerId, requestId: sessionRequestId.current, promise };
      sessionRefresh.current = entry;
      void promise.finally(() => {
        if (sessionRefresh.current === entry) sessionRefresh.current = null;
      });
      return promise;
    },
    [loadSession]
  );

  useEffect(() => {
    // Initial verification on mount
    const checkAuthCookie = async () => {
      const clientToken = cookieHelper.get('nutrimind_session');

      if (clientToken) {
        const decoded = decodeToken(clientToken);
        if (decoded) {
          confirmedProfileOwner.current = null;
          setIsLoading(true);
          // Temporarily set session from decoded claims to show loading screens cleanly
          setUser({
            userId: decoded.userId,
            name: decoded.email.split('@')[0], // placeholder name until profile loaded
            email: decoded.email,
            role: decoded.role,
            emailVerified: false, // will load from API
            onboardingDone: false, // will load from API
            tosAccepted: false,
            image: undefined,
            reportAcknowledged: false,
            onboardingNextPath: '/onboarding/stats',
          });

          // Pull full profile to get exact onboarding/ToS variables
          await refreshSession();
        } else {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    };

    checkAuthCookie();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (token: string) => {
      sessionRequestId.current += 1;
      confirmedProfileOwner.current = null;
      setProfileLoadError(false);
      setProfileLoadFailure(null);
      setSessionRefreshSuppressed(false);
      clearSessionResourceCache();
      // Save access token in cookie for the client middleware & interceptor
      // Refresh token is now stored as an HttpOnly cookie by the backend
      cookieHelper.set('nutrimind_session', token, 7);
      const decoded = decodeToken(token);

      if (decoded) {
        setIsLoading(true);
        setUser({
          userId: decoded.userId,
          name: decoded.email.split('@')[0],
          email: decoded.email,
          role: decoded.role,
          emailVerified: false,
          onboardingDone: false,
          tosAccepted: false,
          image: undefined,
          reportAcknowledged: false,
          onboardingNextPath: '/onboarding/stats',
        });

        // Load the authoritative profile before navigating. The request id inside
        // refreshSession prevents an older hydration response from restoring the
        // role that was active before this login.
        return refreshSession();
      }
      cookieHelper.clear('nutrimind_session');
      setUser(null);
      setIsLoading(false);
      return null;
    },
    [refreshSession]
  );

  const logout = useCallback(async () => {
    sessionRequestId.current += 1;
    confirmedProfileOwner.current = null;
    setIsLoading(true);
    setProfileLoadError(false);
    setProfileLoadFailure(null);
    setSessionRefreshSuppressed(true);
    try {
      await disableDeviceNotifications().catch(() => undefined);
      await api.post('/auth/logout');
    } catch (error) {
      console.error('[AuthContext] Failed backend logout call:', error);
    } finally {
      // Clear client access token cache
      // Refresh token HttpOnly cookie is cleared by the backend logout endpoint
      cookieHelper.clear('nutrimind_session');
      clearSessionResourceCache();
      setUser(null);
      setIsLoading(false);
      replace('/login');
    }
  }, [replace]);

  const completeAccountDeletion = useCallback(() => {
    sessionRequestId.current += 1;
    confirmedProfileOwner.current = null;
    setSessionRefreshSuppressed(true);
    setProfileLoadError(false);
    setProfileLoadFailure(null);
    cookieHelper.clear('nutrimind_session');
    clearSessionResourceCache();
    setUser(null);
    // Block the route guard's ordinary signed-out redirect during deletion.
    // A fresh document also discards any in-flight private workspace state.
    setIsLoading(true);
    window.location.replace('/login?accountDeleted=1');
  }, []);

  const updateUserSession = useCallback((updates: Partial<UserSession>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  }, []);

  const context = useMemo(
    () => ({
      user,
      isLoading,
      profileLoadError,
      profileLoadFailure,
      login,
      logout,
      completeAccountDeletion,
      refreshSession,
      updateUserSession,
    }),
    [
      user,
      isLoading,
      profileLoadError,
      profileLoadFailure,
      login,
      logout,
      completeAccountDeletion,
      refreshSession,
      updateUserSession,
    ]
  );

  return <AuthContext.Provider value={context}>{children}</AuthContext.Provider>;
};
