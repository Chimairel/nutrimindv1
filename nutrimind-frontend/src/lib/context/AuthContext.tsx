'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
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
  login: (token: string, refreshToken?: string) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateUserSession: (updates: Partial<UserSession>) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  // Refresh user profile details from backend to ensure state accuracy
  const refreshSession = async () => {
    try {
      const response = await api.get('/user/profile');
      if (response.data && response.data.success) {
        const { id, name, email, role, emailVerified, onboardingDone, tosAccepted, image, nutritionReport } = response.data.data;
        
        setUser({
          userId: id,
          name,
          email,
          role: role as Role,
          emailVerified: emailVerified ?? false,
          onboardingDone,
          tosAccepted,
          image,
          reportAcknowledged: !!nutritionReport?.acknowledgedAt,
        });
      }
    } catch (error) {
      console.warn('[AuthContext] Failed to fetch live profile status, using token fallbacks.', error);
      // If we fail because we are unauthenticated, clear session
      setUser(null);
    } finally {
      setIsLoading(false);
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

  const login = (token: string, refreshToken?: string) => {
    // Save token in cookie for the client middleware & interceptor
    cookieHelper.set('nutrimind_session', token, 7);
    if (refreshToken) {
      cookieHelper.set('nutrimind_refresh', refreshToken, 7);
    }
    const decoded = decodeToken(token);
    
    if (decoded) {
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
      
      // Load real status parameters then reroute based on actual state
      refreshSession().then(() => {
        // We need to read the latest state, so we use a setter callback
        setUser((currentUser) => {
          if (!currentUser) return null;
          
          // Route based on actual verified/onboarding state
          if (!currentUser.emailVerified) {
            router.push('/verify-email');
          } else if (decoded.role === 'ADMIN') {
            router.push('/admin/overview');
          } else if (decoded.role === 'NUTRITIONIST') {
            router.push('/nutritionist/reviews');
          } else if (!currentUser.onboardingDone) {
            router.push('/onboarding/stats');
          } else if (!currentUser.tosAccepted) {
            router.push('/onboarding/tos');
          } else if (!currentUser.reportAcknowledged) {
            router.push('/nutrition-report');
          } else {
            router.push('/dashboard');
          }
          
          return currentUser; // don't change state, just read it
        });
      });
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('[AuthContext] Failed backend logout call:', error);
    } finally {
      // Clear client caches anyway
      cookieHelper.clear('nutrimind_session');
      cookieHelper.clear('nutrimind_refresh');
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
