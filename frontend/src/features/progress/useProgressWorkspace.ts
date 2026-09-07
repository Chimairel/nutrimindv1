import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import { normalizeFoodCulture } from '@/lib/profile-normalization';
import { useAuth } from '@/hooks/useAuth';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import type { UserProfileData } from '@/hooks/useProfile';

export type ProgressSection = 'overview' | 'profile' | 'safety' | 'history';
export type ProgressWorkspaceMode = 'progress' | 'health';

export interface WeightLog {
  id: string;
  weightKg: number;
  note: string | null;
  loggedAt: string;
}

export interface DailyNutritionLog {
  id: string;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  targetCalories: number;
  adherencePct: number;
  logDate: string;
}

export type ProfileDetails = UserProfileData;

export interface ProgressHistory {
  weightLogs: WeightLog[];
  dailyNutritionLogs: DailyNutritionLog[];
}

interface ProgressPageSnapshot {
  history: ProgressHistory | null;
  profileData: ProfileDetails | null;
}

export function useProgressWorkspace(mode: ProgressWorkspaceMode) {
  const router = useRouter();
  const { user } = useAuth();
  const ownerId = user?.userId;
  const cachedPage = readSessionResource<ProgressPageSnapshot>(ownerId, 'user-progress-page');
  const cachedProfile = cachedPage?.profileData?.userProfile;
  const [activeSection, setActiveSection] = useState<ProgressSection>(mode === 'health' ? 'profile' : 'overview');
  const [history, setHistory] = useState<ProgressHistory | null>(cachedPage?.history ?? null);
  const [profileData, setProfileData] = useState<ProfileDetails | null>(cachedPage?.profileData ?? null);
  const [isLoading, setIsLoading] = useState(!cachedPage);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('week');
  const [isTimeframeDropdownOpen, setIsTimeframeDropdownOpen] = useState(false);

  // Form State - Biometrics & Preferences
  const [age, setAge] = useState(String(cachedProfile?.age || ''));
  const [heightCm, setHeightCm] = useState(String(cachedProfile?.heightCm || ''));
  const [weightKg, setWeightKg] = useState(String(cachedProfile?.weightKg || ''));
  const [targetWeightKg, setTargetWeightKg] = useState(String(cachedProfile?.targetWeightKg || ''));
  const [biologicalSex, setBiologicalSex] = useState(cachedProfile?.biologicalSex || 'MALE');
  const [goal, setGoal] = useState(cachedProfile?.goal || 'MAINTAIN');
  const [activityLevel, setActivityLevel] = useState(cachedProfile?.activityLevel || 'SEDENTARY');
  const [dietaryPreference, setDietaryPreference] = useState(cachedProfile?.dietaryPreference || 'OMNIVORE');
  const [carbPreference, setCarbPreference] = useState(cachedProfile?.carbPreference || 'MODERATE');
  const [foodCulture, setFoodCulture] = useState(normalizeFoodCulture(cachedProfile?.foodCulture));
  const [shoppingDayOfWeek, setShoppingDayOfWeek] = useState(
    typeof cachedProfile?.shoppingDayOfWeek === 'number'
      ? cachedProfile.shoppingDayOfWeek
      : cachedProfile?.shoppingDayGroup === 'WEEKDAY'
        ? 0
        : 6
  );
  const [isSavingBiometrics, setIsSavingBiometrics] = useState(false);
  const [biometricsSuccess, setBiometricsSuccess] = useState<string | null>(null);
  const [biometricsError, setBiometricsError] = useState<string | null>(null);

  const [healthSuccess, setHealthSuccess] = useState<string | null>(null);

  // Form State - New Weight Reading
  const [isLogFormOpen, setIsLogFormOpen] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [isSubmittingWeight, setIsSubmittingWeight] = useState(false);
  const [weightFormError, setWeightFormError] = useState<string | null>(null);
  const [weightSuccess, setWeightSuccess] = useState<string | null>(null);

  // Fetch progress history and profile info
  const fetchPageData = useCallback(async () => {
    setError(null);
    try {
      const [historyRes, profileRes] = await Promise.all([api.get('/user/progress/history'), api.get('/user/profile')]);

      const nextHistory = historyRes.data?.success ? (historyRes.data.data as ProgressHistory) : null;
      const nextProfile = profileRes.data?.success ? (profileRes.data.data as ProfileDetails) : null;

      if (historyRes.data && historyRes.data.success) {
        setHistory(nextHistory);
      }
      if (profileRes.data && profileRes.data.success) {
        const data = nextProfile as ProfileDetails;
        setProfileData(data);

        // Pre-populate biometric form states
        if (data.userProfile) {
          setAge(String(data.userProfile.age || ''));
          setHeightCm(String(data.userProfile.heightCm || ''));
          setWeightKg(String(data.userProfile.weightKg || ''));
          setTargetWeightKg(String(data.userProfile.targetWeightKg || ''));
          setBiologicalSex(data.userProfile.biologicalSex || 'MALE');
          setGoal(data.userProfile.goal || 'MAINTAIN');
          setActivityLevel(data.userProfile.activityLevel || 'SEDENTARY');
          setDietaryPreference(data.userProfile.dietaryPreference || 'OMNIVORE');
          setCarbPreference(data.userProfile.carbPreference || 'MODERATE');
          setFoodCulture(normalizeFoodCulture(data.userProfile.foodCulture));
          setShoppingDayOfWeek(
            typeof data.userProfile.shoppingDayOfWeek === 'number'
              ? data.userProfile.shoppingDayOfWeek
              : data.userProfile.shoppingDayGroup === 'WEEKDAY'
                ? 0
                : 6
          );
        }
      }
      writeSessionResource(ownerId, 'user-progress-page', {
        history: nextHistory,
        profileData: nextProfile,
      });
      if (nextProfile) writeSessionResource(ownerId, 'user-profile', nextProfile);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to fetch progress metrics.'));
    } finally {
      setIsLoading(false);
    }
  }, [ownerId]);

  useEffect(() => {
    if (user) {
      fetchPageData();
    }
  }, [user, fetchPageData]);

  useEffect(() => {
    if (!ownerId || (!history && !profileData)) return;
    writeSessionResource(ownerId, 'user-progress-page', { history, profileData });
  }, [ownerId, history, profileData]);

  // Handles updating biometrics and preferences form
  const handleBiometricsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBiometrics(true);
    setBiometricsError(null);
    setBiometricsSuccess(null);

    try {
      // 1. Save general profile stats
      const profileUpdate = await api.put('/user/profile', {
        age: parseInt(age),
        heightCm: parseFloat(heightCm),
        weightKg: parseFloat(weightKg),
        targetWeightKg: parseFloat(targetWeightKg),
        biologicalSex,
        goal,
        activityLevel,
        dietaryPreference,
        carbPreference,
        foodCulture,
      });

      // 2. Save the exact shopping day preference
      await api.post('/user/onboarding/shopping-day', {
        shoppingDayOfWeek,
      });

      if (profileUpdate.data && profileUpdate.data.success) {
        setBiometricsSuccess('Biometrics and dietary preferences updated successfully! Calorie budget recalculated.');
        setProfileData(profileUpdate.data.data);
        writeSessionResource(ownerId, 'user-progress-page', {
          history,
          profileData: profileUpdate.data.data,
        });
        writeSessionResource(ownerId, 'user-profile', profileUpdate.data.data);
      }
    } catch (err: unknown) {
      setBiometricsError(getApiErrorMessage(err, 'Failed to update biometrics.'));
    } finally {
      setIsSavingBiometrics(false);
    }
  };

  // Handles logging a new weight reading
  const handleLogWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const weightNum = parseFloat(weightInput);
    if (isNaN(weightNum) || weightNum <= 0) {
      setWeightFormError('Please enter a valid positive weight.');
      return;
    }

    setIsSubmittingWeight(true);
    setWeightFormError(null);
    setWeightSuccess(null);
    try {
      const res = await api.post('/user/progress/weight', {
        weightKg: weightNum,
        note: noteInput || null,
      });

      if (res.data && res.data.success) {
        setWeightSuccess('Weight logged! Your daily calorie target has been recalculated.');
        setWeightInput('');
        setNoteInput('');
        setIsLogFormOpen(false);

        // Reload history & profile info to update graphs and target labels
        const [historyRes, profileRes] = await Promise.all([
          api.get('/user/progress/history'),
          api.get('/user/profile'),
        ]);

        if (historyRes.data && historyRes.data.success) {
          setHistory(historyRes.data.data);
        }
        if (profileRes.data && profileRes.data.success) {
          setProfileData(profileRes.data.data);
        }
        writeSessionResource(ownerId, 'user-progress-page', {
          history: historyRes.data?.success ? historyRes.data.data : history,
          profileData: profileRes.data?.success ? profileRes.data.data : profileData,
        });
        if (profileRes.data?.success) {
          writeSessionResource(ownerId, 'user-profile', profileRes.data.data);
        }
      }
    } catch (err: unknown) {
      setWeightFormError(getApiErrorMessage(err, 'Failed to log weight.'));
    } finally {
      setIsSubmittingWeight(false);
    }
  };

  const groupedLogs = React.useMemo(() => {
    if (!history?.weightLogs || history.weightLogs.length === 0) return [];

    // Group logs
    const groups: Record<string, { sum: number; count: number; date: Date }> = {};

    history.weightLogs.forEach((log) => {
      const d = new Date(log.loggedAt);
      let key = '';
      if (timeframe === 'week') {
        const day = d.getDay();
        const diff = d.getDate() - day;
        const sunday = new Date(d.setDate(diff));
        sunday.setHours(0, 0, 0, 0);
        key = sunday.toDateString();
      } else if (timeframe === 'month') {
        key = `${d.getFullYear()}-${d.getMonth()}`;
      } else {
        key = `${d.getFullYear()}`;
      }

      if (!groups[key]) {
        groups[key] = { sum: 0, count: 0, date: new Date(log.loggedAt) };
      }
      groups[key].sum += log.weightKg;
      groups[key].count += 1;
    });

    return Object.keys(groups)
      .sort((a, b) => {
        if (timeframe === 'week') {
          return new Date(a).getTime() - new Date(b).getTime();
        } else if (timeframe === 'month') {
          const [ay, am] = a.split('-').map(Number);
          const [by, bm] = b.split('-').map(Number);
          return ay !== by ? ay - by : am - bm;
        } else {
          return Number(a) - Number(b);
        }
      })
      .map((key) => {
        const item = groups[key];
        const avgWeight = Math.round((item.sum / item.count) * 10) / 10;

        let label = '';
        if (timeframe === 'week') {
          const sunday = new Date(key);
          label = `Wk of ${sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
        } else if (timeframe === 'month') {
          label = item.date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        } else {
          label = item.date.getFullYear().toString();
        }

        return {
          weightKg: avgWeight,
          dateLabel: label,
        };
      });
  }, [history?.weightLogs, timeframe]);

  const targetWeight = profileData?.userProfile?.targetWeightKg || 0;
  const currentWeight = profileData?.userProfile?.weightKg || 0;
  const dailyCalorieTarget = profileData?.userProfile?.dailyCalorieTarget || 0;

  return {
    router,
    user,
    activeSection,
    setActiveSection,
    history,
    profileData,
    setProfileData,
    isLoading,
    error,
    timeframe,
    setTimeframe,
    isTimeframeDropdownOpen,
    setIsTimeframeDropdownOpen,
    age,
    setAge,
    heightCm,
    setHeightCm,
    weightKg,
    setWeightKg,
    targetWeightKg,
    setTargetWeightKg,
    biologicalSex,
    setBiologicalSex,
    goal,
    setGoal,
    activityLevel,
    setActivityLevel,
    dietaryPreference,
    setDietaryPreference,
    carbPreference,
    setCarbPreference,
    foodCulture,
    setFoodCulture,
    shoppingDayOfWeek,
    setShoppingDayOfWeek,
    isSavingBiometrics,
    biometricsSuccess,
    biometricsError,
    healthSuccess,
    setHealthSuccess,
    isLogFormOpen,
    setIsLogFormOpen,
    weightInput,
    setWeightInput,
    noteInput,
    setNoteInput,
    isSubmittingWeight,
    weightFormError,
    setWeightFormError,
    weightSuccess,
    setWeightSuccess,
    handleBiometricsSubmit,
    handleLogWeightSubmit,
    groupedLogs,
    targetWeight,
    currentWeight,
    dailyCalorieTarget,
  };
}
