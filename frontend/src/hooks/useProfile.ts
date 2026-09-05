import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/axios';
import type { SafetyProfileEntry } from '@/types';

export interface UserProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
  tosAccepted: boolean;
  acceptedTermsVersion?: string;
  acceptedPrivacyVersion?: string;
  healthDataConsentedAt?: string;
  onboardingDone: boolean;
  createdAt: string;
  userProfile: {
    age?: number;
    biologicalSex?: string;
    heightCm?: number;
    weightKg?: number;
    targetWeightKg?: number;
    goal?: string;
    activityLevel?: string;
    dietaryPreference?: string;
    carbPreference?: string;
    foodCulture?: string;
    dailyCalorieTarget?: number;
    otherConditions?: string;
    otherAllergies?: string;
    shoppingDayGroup?: string;
    shoppingDayOfWeek?: number;
    lastCheckinAt?: string;
    checkinStreak?: number;
  } | null;
  healthConditions: string[];
  allergies: string[];
  safetyEntries: SafetyProfileEntry[];
  nutritionReport: { id: string; generatedAt: string; acknowledgedAt?: string } | null;
  onboardingStatus?: {
    nextPath: string;
    readyToComplete: boolean;
    missingFields: string[];
    currentTermsVersion: string;
    currentPrivacyVersion: string;
    acceptedCurrentConsent: boolean;
  };
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/user/profile');
      if (res.data?.success) {
        setProfile(res.data.data);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to fetch profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, isLoading, error, refresh: fetchProfile };
}
