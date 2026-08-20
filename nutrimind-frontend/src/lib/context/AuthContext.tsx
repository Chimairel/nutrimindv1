'use client';

import React, { createContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Role } from '@/types';
import { decodeToken, cookieHelper } from '@/lib/auth';
import api from '@/lib/axios';

export interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  onboardingDone: boolean;
  tosAccepted: boolean;
  reportAcknowledged: boolean;
  image?: string;
}

export interface AuthContextType {
  user: UserSession | null;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<UserSession | null>;
  updateUserSession: (updates: Partial<UserSession>) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const sessionRequestId = useRef(0);
  const router = useRouter();

  // Refresh user profile details from backend to ensure state accuracy
  const refreshSession = async () => {
    const requestId = ++sessionRequestId.current;

    try {
      const response = await api.get('/user/profile');
      if (response.data && response.data.success) {
        const { id, name, email, role, emailVerified, onboardingDone, tosAccepted, image, nutritionReport } = response.data.data;
        const refreshedUser: UserSession = {
          userId: id,
          name,
          email,
          role: role as Role,
          emailVerified: emailVerified ?? false,
          onboardingDone,
          tosAccepted,
          image,
          reportAcknowledged: !!nutritionReport?.acknowledgedAt,
        };

        if (requestId !== sessionRequestId.current) return null;

        setUser(refreshedUser);
        return refreshedUser;
      }
      return null;
    } catch (error) {
      if (requestId !== sessionRequestId.current) return null;

      console.warn('[AuthContext] Failed to fetch live profile status, using token fallbacks.', error);
      // If we fail because we are unauthenticated, clear session
      setUser(null);
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
  }, []);

  const login = async (token: string) => {
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
      });
      
      // Load the authoritative profile before navigating. The request id inside
      // refreshSession prevents an older hydration response from restoring the
      // role that was active before this login.
      const currentUser = await refreshSession();
      if (!currentUser) return;

      if (!currentUser.emailVerified) {
        router.replace('/verify-email');
      } else if (currentUser.role === 'ADMIN') {
        router.replace('/admin/overview');
      } else if (currentUser.role === 'NUTRITIONIST') {
        router.replace('/nutritionist/reviews');
      } else if (!currentUser.onboardingDone) {
        router.replace('/onboarding/stats');
      } else if (!currentUser.tosAccepted) {
        router.replace('/onboarding/tos');
      } else if (!currentUser.reportAcknowledged) {
        router.replace('/nutrition-report');
      } else {
        router.replace('/dashboard');
      }
    }
  };

  const logout = async () => {
    sessionRequestId.current += 1;
    setIsLoading(true);
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('[AuthContext] Failed backend logout call:', error);
    } finally {
      // Clear client access token cache
      // Refresh token HttpOnly cookie is cleared by the backend logout endpoint
      cookieHelper.clear('nutrimind_session');
      setUser(null);
      setIsLoading(false);
      router.push('/login');
    }
  };

  const updateUserSession = (updates: Partial<UserSession>) => {
    setUser((prev) => (prev ? { ...prev, ...updates } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        refreshSession,
        updateUserSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
