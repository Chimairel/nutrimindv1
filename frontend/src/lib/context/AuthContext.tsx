'use client';

import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@/types';
import { decodeToken, cookieHelper } from '@/lib/auth';
import api, { setSessionRefreshSuppressed } from '@/lib/axios';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';

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
  const sessionRequestId = useRef(0);
  const router = useRouter();

  // Refresh user profile details from backend to ensure state accuracy
  const refreshSession = async (options?: { showLoader?: boolean }) => {
    const requestId = ++sessionRequestId.current;
    if (options?.showLoader || !user) {
      setIsLoading(true);
    }
    setProfileLoadError(false);

    try {
      const response = await api.get('/user/profile');
      if (response.data && response.data.success) {
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
        } = response.data.data;

        const isReportAcknowledged = Boolean(
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
          emailVerified: emailVerified ?? false,
          onboardingDone,
          tosAccepted,
          image,
          googleImage,
          authMethods: authMethods ?? { password: true, google: false },
          reportAcknowledged: isReportAcknowledged,
          onboardingNextPath: onboardingStatus?.nextPath,
        };

        if (requestId !== sessionRequestId.current) return null;

        setUser(refreshedUser);
        setProfileLoadError(false);
        return refreshedUser;
      }
      if (requestId === sessionRequestId.current) setProfileLoadError(true);
      return null;
    } catch (error) {
      if (requestId !== sessionRequestId.current) return null;

      console.warn('[AuthContext] Failed to fetch live profile status, using token fallbacks.', error);
      // If we fail because we are unauthenticated, clear session
      if ((error as { response?: { status?: number } }).response?.status === 401) {
        clearSessionResourceCache();
        setUser(null);
        setProfileLoadError(false);
      } else {
        setProfileLoadError(true);
      }
      return null;
    } finally {
      if (requestId === sessionRequestId.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    // Initial verification on mount
    const checkAuthCookie = async () => {
      const clientToken = cookieHelper.get('nutrimind_session');

      if (clientToken) {
        const decoded = decodeToken(clientToken);
        if (decoded) {
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

  const login = async (token: string) => {
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
  };

  const logout = async () => {
    sessionRequestId.current += 1;
    setIsLoading(true);
    setProfileLoadError(false);
    setSessionRefreshSuppressed(true);
    try {
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
      router.replace('/login');
    }
  };

  const completeAccountDeletion = () => {
    sessionRequestId.current += 1;
    setSessionRefreshSuppressed(true);
    setProfileLoadError(false);
    cookieHelper.clear('nutrimind_session');
    clearSessionResourceCache();
    setUser(null);
    setIsLoading(false);
    router.replace('/login?accountDeleted=1');
  };

  const updateUserSession = (updates: Partial<UserSession>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        profileLoadError,
        login,
        logout,
        completeAccountDeletion,
        refreshSession,
        updateUserSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
