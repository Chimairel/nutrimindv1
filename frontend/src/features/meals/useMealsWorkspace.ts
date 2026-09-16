import { summarizeMealIntake } from '@/lib/meal-history-summary';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import type { MealPlan, PublicMealImage, PublicVerifier } from '@/types';
import type { PendingMealPreview } from '@/components/user/PendingMealPreviewCard';
import { formatManilaDate, getManilaDateKey, manilaDateFromKey } from '@/lib/manila-date';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import { useMealGenerationProgress } from '@/features/meals/useMealGenerationProgress';

export interface SwapOption {
  id: string;
  mealName: string;
  description?: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  verifiedBy: string;
  prcLicenseNumber: string;
  verifier?: PublicVerifier | null;
  image?: PublicMealImage | null;
}

export interface MealHistoryLog {
  id: string;
  loggedAt: string;
  mealName: string;
  source: 'SYSTEM_GENERATED' | 'USER_LOGGED' | 'USER_SWAPPED';
  status: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  calorieDelta?: number | null;
  notes?: string | null;
  mealType?: string | null;
  outsideItems?: Array<{
    id?: string;
    name: string;
    portionGrams?: number | null;
    calories?: number | null;
    proteinG?: number | null;
  }>;
}

interface PendingReviewState {
  mealCount: number;
  planType: 'STARTER' | 'WEEKLY';
  reviewStatus: 'PENDING_REVIEW';
  meals: PendingMealPreview[];
}

interface CurrentPlanSnapshot {
  meals: MealPlan[];
  pendingReview: PendingReviewState | null;
  swapsUsed: number;
  swapCap: number;
}

const planResource = 'user-meals-current';
const historyResource = (search: string, source: string, status: string) =>
  `user-meals-history:${search}:${source}:${status}`;
const libraryResource = (search: string, mealType: string) => `user-meals-library:${search}:${mealType}`;

export function useMealsWorkspace() {
  const { user } = useAuth();
  const ownerId = user?.userId;
  const [planView, setPlanView] = useState<'current' | 'next'>('current');
  const currentPlanResource = planResource + ':' + planView;
  const cachedPlan = readSessionResource<CurrentPlanSnapshot>(ownerId, currentPlanResource);
  const cachedHistory = readSessionResource<MealHistoryLog[]>(ownerId, historyResource('', 'All', 'All'));
  const cachedLibrary = readSessionResource<SwapOption[]>(ownerId, libraryResource('', 'All'));
  // Tab state
  const [activeTab, setActiveTab] = useState<'plan' | 'history' | 'library'>('plan');

  // Meal Plan states
  const hasPlanData = Boolean(cachedPlan && (cachedPlan.meals.length > 0 || cachedPlan.pendingReview));
  const [meals, setMeals] = useState<MealPlan[]>(cachedPlan?.meals ?? []);
  const [isLoading, setIsLoading] = useState(!hasPlanData);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const regenerationProgress = useMealGenerationProgress(isRegenerating);
  const [error, setError] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState<PendingReviewState | null>(cachedPlan?.pendingReview ?? null);
  const [selectedPlanDateKey, setSelectedPlanDateKey] = useState<string | null>(null);
  const currentPlanRequestInFlight = useRef(false);
  const secondaryDataPrefetchedForUserRef = useRef<string | null>(null);

  // Meal swap states
  const [swapsUsed, setSwapsUsed] = useState(cachedPlan?.swapsUsed ?? 0);
  const [swapCap, setSwapCap] = useState(cachedPlan?.swapCap ?? 3);
  const [activeSwapMeal, setActiveSwapMeal] = useState<MealPlan | null>(null);
  const [swapOptions, setSwapOptions] = useState<SwapOption[]>([]);
  const [isOptionsLoading, setIsOptionsLoading] = useState(false);
  const [swapOptionsError, setSwapOptionsError] = useState<string | null>(null);
  const [confirmSwapMeal, setConfirmSwapMeal] = useState<SwapOption | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);

  // Swap preview/warning states
  const [swapPreview, setSwapPreview] = useState<{
    originalMealName: string;
    originalCalories: number;
    newMealName: string;
    newCalories: number;
    calorieDelta: number;
    projectedDayTotal: number;
    dailyTarget: number;
    warningRequired: boolean;
    previewToken: string;
    requestKey: string;
    shoppingNeeds: Array<{
      ingredientName: string;
      unit: string | null;
      additionalQuantity: number | null;
      remainingQuantity: number | null;
    }>;
  } | null>(null);
  const [isCheckingPreview, setIsCheckingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // History Tab states
  const [historyLogs, setHistoryLogs] = useState<MealHistoryLog[]>(cachedHistory ?? []);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyTotalCount, setHistoryTotalCount] = useState<number | null>(cachedHistory?.length ?? null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historySource, setHistorySource] = useState('All');
  const [historyStatus, setHistoryStatus] = useState('All');
  const [selectedHistoryDateKey, setSelectedHistoryDateKey] = useState<string | null>(null);

  // Library Tab states
  const [libraryMeals, setLibraryMeals] = useState<SwapOption[]>(cachedLibrary ?? []);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [libraryTotalCount, setLibraryTotalCount] = useState<number | null>(cachedLibrary?.length ?? null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [librarySearch, setLibrarySearch] = useState('');
  const [selectedVerifier, setSelectedVerifier] = useState<PublicVerifier | null>(null);
  const [libraryMealType, setLibraryMealType] = useState('All');

  const applyCurrentPlan = useCallback(
    (snapshot: CurrentPlanSnapshot) => {
      setMeals(snapshot.meals);
      setPendingReview(snapshot.pendingReview);
      setSwapsUsed(snapshot.swapsUsed);
      setSwapCap(snapshot.swapCap);
      writeSessionResource(ownerId, currentPlanResource, snapshot);
    },
    [ownerId, currentPlanResource]
  );

  const fetchMeals = useCallback(async () => {
    if (currentPlanRequestInFlight.current) return;
    currentPlanRequestInFlight.current = true;
    setError(null);
    try {
      const res = await api.get('/user/meals/current', { params: { view: planView } });
      if (res.data && res.data.success) {
        applyCurrentPlan({
          meals: Array.isArray(res.data.data) ? res.data.data : [],
          pendingReview: res.data.meta?.pendingReview ?? null,
          swapsUsed: res.data.meta?.swapsUsed ?? 0,
          swapCap: res.data.meta?.swapCap ?? 3,
        });
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to fetch weekly plan menu.'));
    } finally {
      currentPlanRequestInFlight.current = false;
      setIsLoading(false);
    }
  }, [applyCurrentPlan, planView]);

  const fetchHistory = useCallback(async () => {
    const resource = historyResource(historySearch, historySource, historyStatus);
    const cached = readSessionResource<MealHistoryLog[]>(user?.userId, resource);
    if (cached) setHistoryLogs(cached);
    setIsHistoryLoading(!cached);
    setHistoryError(null);
    try {
      const params: Record<string, string> = {};
      if (historySearch) params.search = historySearch;
      if (historySource !== 'All') params.source = historySource;
      if (historyStatus !== 'All') params.status = historyStatus;

      const res = await api.get('/user/meals/history', { params });
      if (res.data && res.data.success) {
        setHistoryLogs(res.data.data);
        writeSessionResource(user?.userId, resource, res.data.data);
        if (!historySearch && historySource === 'All' && historyStatus === 'All') {
          setHistoryTotalCount(res.data.data.length);
        }
      }
    } catch (err: unknown) {
      setHistoryError(getApiErrorMessage(err, 'Failed to fetch meal history.'));
    } finally {
      setIsHistoryLoading(false);
    }
  }, [user?.userId, historySearch, historySource, historyStatus]);

  const libraryDate = selectedPlanDateKey ?? getManilaDateKey(meals[0]?.scheduledDate ?? new Date());
  const fetchLibrary = useCallback(async () => {
    const resource = libraryResource(librarySearch, libraryMealType) + ':' + libraryDate;
    const cached = readSessionResource<SwapOption[]>(user?.userId, resource);
    if (cached) setLibraryMeals(cached);
    setIsLibraryLoading(!cached);
    setLibraryError(null);
    try {
      const params: Record<string, string> = {};
      params.date = libraryDate;
      if (libraryMealType !== 'All') params.mealType = libraryMealType;
      if (librarySearch) params.search = librarySearch;

      const res = await api.get('/user/meals/compatible-library', { params });
      if (res.data && res.data.success) {
        setLibraryMeals(res.data.data);
        writeSessionResource(user?.userId, resource, res.data.data);
        if (!librarySearch && libraryMealType === 'All') {
          setLibraryTotalCount(res.data.data.length);
        }
      }
    } catch (err: unknown) {
      setLibraryError(getApiErrorMessage(err, 'Failed to load library meals.'));
    } finally {
      setIsLibraryLoading(false);
    }
  }, [user?.userId, libraryMealType, librarySearch, libraryDate]);

  useEffect(() => {
    if (user) {
      fetchMeals();

      let activeDateKey = getManilaDateKey();
      const refreshForDateRollover = () => {
        const nextDateKey = getManilaDateKey();
        if (nextDateKey !== activeDateKey) {
          activeDateKey = nextDateKey;
          fetchMeals();
        }
      };
      const refreshOnFocus = () => fetchMeals();
      const refreshOnVisibility = () => {
        if (document.visibilityState === 'visible') fetchMeals();
      };
      const rolloverInterval = window.setInterval(refreshForDateRollover, 60_000);
      window.addEventListener('focus', refreshOnFocus);
      document.addEventListener('visibilitychange', refreshOnVisibility);

      return () => {
        window.clearInterval(rolloverInterval);
        window.removeEventListener('focus', refreshOnFocus);
        document.removeEventListener('visibilitychange', refreshOnVisibility);
      };
    }
  }, [user, fetchMeals]);

  useEffect(() => {
    if (!user) {
      secondaryDataPrefetchedForUserRef.current = null;
      return;
    }

    if (secondaryDataPrefetchedForUserRef.current === user.userId) return;
    secondaryDataPrefetchedForUserRef.current = user.userId;
    fetchHistory();
    fetchLibrary();
  }, [user, fetchHistory, fetchLibrary]);

  useEffect(() => {
    if (user) {
      if (activeTab === 'history') {
        fetchHistory();
      } else if (activeTab === 'library') {
        fetchLibrary();
      }
    }
  }, [user, activeTab, fetchHistory, fetchLibrary]);

  useEffect(() => {
    const sourceMeals = [...meals, ...(pendingReview?.meals ?? [])];
    const availableDateKeys = Array.from(new Set(sourceMeals.map((meal) => getManilaDateKey(meal.scheduledDate))))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));

    if (availableDateKeys.length === 0) {
      setSelectedPlanDateKey(null);
      return;
    }

    setSelectedPlanDateKey((currentDateKey) => {
      if (currentDateKey && availableDateKeys.includes(currentDateKey)) return currentDateKey;
      const todayKey = getManilaDateKey();
      return (
        availableDateKeys.find((dateKey) => dateKey >= todayKey) ?? availableDateKeys[availableDateKeys.length - 1]
      );
    });
  }, [meals, pendingReview]);

  // Open Swap options modal and fetch eligible replacement meals
  const handleSwapClick = async (mealId: string, preferred?: SwapOption) => {
    const meal = meals.find((m) => m.id === mealId);
    if (!meal) return;

    setActiveSwapMeal(meal);
    setIsOptionsLoading(true);
    setSwapOptionsError(null);
    setConfirmSwapMeal(null);
    setSwapPreview(null);

    try {
      const res = await api.get(`/user/meals/${mealId}/swap-options`);
      if (res.data?.success) {
        setSwapOptions(res.data.data.swapOptions);
        setSwapsUsed(res.data.data.swapsUsed);
        setSwapCap(res.data.data.swapCap ?? 3);
        if (preferred) {
          if (!res.data.data.swapOptions.some((option: SwapOption) => option.id === preferred.id))
            throw new Error('This recipe is not eligible for that slot.');
          const preview = await api.get('/user/meals/' + mealId + '/swap-preview', {
            params: { libraryMealId: preferred.id },
          });
          setConfirmSwapMeal(preferred);
          setSwapPreview({ ...preview.data.data, requestKey: crypto.randomUUID() });
        }
      }
    } catch (err: unknown) {
      setSwapOptionsError(getApiErrorMessage(err, 'Failed to load eligible swap options.'));
    } finally {
      setIsOptionsLoading(false);
    }
  };

  // Select a replacement meal options and call preview check
  const handleSelectSwapOption = async (option: SwapOption) => {
    if (!activeSwapMeal) return;

    setConfirmSwapMeal(option);
    setIsCheckingPreview(true);
    setPreviewError(null);
    setSwapPreview(null);

    try {
      const res = await api.get(`/user/meals/${activeSwapMeal.id}/swap-preview`, {
        params: { libraryMealId: option.id },
      });
      if (res.data?.success) {
        const preview = res.data.data;
        setSwapPreview({ ...preview, requestKey: crypto.randomUUID() });
      }
    } catch (err: unknown) {
      setPreviewError(getApiErrorMessage(err, 'Failed to check swap preview.'));
    } finally {
      setIsCheckingPreview(false);
      setIsSwapping(false);
    }
  };

  // Submits the swap with warning acknowledged
  const handleConfirmSwapAnyway = async () => {
    if (!activeSwapMeal || !confirmSwapMeal || !swapPreview) return;

    setIsSwapping(true);
    setSwapOptionsError(null);

    try {
      const res = await api.post(`/user/meals/${activeSwapMeal.id}/swap`, {
        newLibraryMealId: confirmSwapMeal.id,
        previewToken: swapPreview.previewToken,
        requestKey: swapPreview.requestKey,
        warningShown: swapPreview.warningRequired,
        warningAcknowledged: true,
      });

      if (res.data?.success) {
        setSwapsUsed(res.data.data.swapsUsed);
        setSwapCap(res.data.data.swapCap ?? swapCap);
        setActiveSwapMeal(null);
        setSwapOptions([]);
        setConfirmSwapMeal(null);
        setSwapPreview(null);
        // Refresh full meals plan
        await fetchMeals();
      }
    } catch (err: unknown) {
      setSwapOptionsError(getApiErrorMessage(err, 'Failed to complete swap.'));
    } finally {
      setIsSwapping(false);
    }
  };

  // Handles scheduled status checkoff toggles in the weekly view
  const handleMealStatusToggle = async (mealPlanId: string, newStatus: 'DONE' | 'SKIPPED' | 'PENDING') => {
    try {
      await api.patch(`/user/meals/${mealPlanId}/status`, { status: newStatus });
      // Reload current meals to update checkboxes and macro sums
      const res = await api.get('/user/meals/current', { params: { view: planView } });
      if (res.data && res.data.success) {
        applyCurrentPlan({
          meals: Array.isArray(res.data.data) ? res.data.data : [],
          pendingReview: res.data.meta?.pendingReview ?? null,
          swapsUsed: res.data.meta?.swapsUsed ?? 0,
          swapCap: res.data.meta?.swapCap ?? 3,
        });
      }
      // Reload history so history tab and heatmap immediately update
      await fetchHistory();
    } catch (err) {
      console.error('[WeeklyPlan] Status toggle failed:', err);
    }
  };

  // Triggers full 7-day meal plan regeneration
  const handleRegeneratePlan = useCallback(
    async (options?: { replaceExisting?: boolean; skipConfirm?: boolean }) => {
      if (pendingReview) return;

      if (planView === 'current' && meals.length > 0 && !options?.skipConfirm) {
        if (!confirm('Are you sure you want to cancel your current plan and generate a completely new 7-day AI plan?'))
          return;
      }

      setIsRegenerating(true);
      regenerationProgress.begin('Preparing a replacement weekly plan.');
      setError(null);
      try {
        if (planView === 'next') {
          await api.post('/user/meals/next/generate', {});
          await fetchMeals();
          regenerationProgress.complete('Next week is ready for review.');
          return;
        }
        const res = await api.post('/user/meals/generate', { replaceExisting: meals.length > 0 });
        if (res.data && res.data.success) {
          regenerationProgress.complete('Your replacement plan is ready for review.');
          applyCurrentPlan({
            meals: res.data.data.meals,
            pendingReview: res.data.data.pendingReview ?? null,
            swapsUsed: 0,
            swapCap,
          });
        }
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, 'Gemini failed to regenerate weekly plan.'));
      } finally {
        setIsRegenerating(false);
      }
    },
    [pendingReview, planView, meals.length, regenerationProgress, fetchMeals, applyCurrentPlan, swapCap]
  );

  const autoRegeneratedRef = useRef(false);
  useEffect(() => {
    if (typeof window === 'undefined' || autoRegeneratedRef.current) return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('regenerate') === 'true') {
        autoRegeneratedRef.current = true;
        window.history.replaceState({}, '', window.location.pathname);
        handleRegeneratePlan({ replaceExisting: true, skipConfirm: true });
      }
    } catch {
      // Safe fallback in non-browser environments
    }
  }, [handleRegeneratePlan]);

  const handleHistorySearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  const handleLibrarySearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLibrary();
  };

  // Group meals by date
  const groupMealsByDate = () => {
    const grouped: Record<string, MealPlan[]> = {};

    meals.forEach((meal) => {
      const dateKey = getManilaDateKey(meal.scheduledDate);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(meal);
    });

    // Sort the keys chronologically
    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .map((dateKey) => {
        const dayMeals = grouped[dateKey];
        const parsedDate = manilaDateFromKey(dateKey);
        const weekday = formatManilaDate(parsedDate, { weekday: 'long' });
        const dateStr = formatManilaDate(parsedDate, { month: 'short', day: 'numeric' });

        // Sum calories and macros targets for the day
        const dayCalories = dayMeals.reduce((sum, m) => sum + m.calories, 0);
        const dayProtein = dayMeals.reduce((sum, m) => sum + m.proteinG, 0);
        const dayCarbs = dayMeals.reduce((sum, m) => sum + m.carbsG, 0);
        const dayFat = dayMeals.reduce((sum, m) => sum + m.fatG, 0);

        return {
          dateKey,
          weekday,
          dateStr,
          mealsList: dayMeals,
          dayCalories,
          dayProtein,
          dayCarbs,
          dayFat,
        };
      });
  };

  const groupPendingMealsByDate = () => {
    const grouped: Record<string, PendingMealPreview[]> = {};

    pendingReview?.meals.forEach((meal) => {
      const dateKey = getManilaDateKey(meal.scheduledDate);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(meal);
    });

    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .map((dateKey) => {
        const parsedDate = manilaDateFromKey(dateKey);
        return {
          dateKey,
          weekday: formatManilaDate(parsedDate, { weekday: 'long' }),
          dateStr: formatManilaDate(parsedDate, { month: 'short', day: 'numeric' }),
          mealsList: grouped[dateKey],
        };
      });
  };

  const handleUpdateLogNotes = async (logId: string, notes: string | null) => {
    try {
      const res = await api.patch(`/user/meals/logs/${logId}/notes`, { notes });
      if (res.data?.success) {
        const updatedNotes = res.data.data.notes;
        setHistoryLogs((prev) => prev.map((log) => (log.id === logId ? { ...log, notes: updatedNotes } : log)));
        const resource = historyResource(historySearch, historySource, historyStatus);
        const cached = readSessionResource<MealHistoryLog[]>(user?.userId, resource);
        if (cached) {
          writeSessionResource(
            user?.userId,
            resource,
            cached.map((log) => (log.id === logId ? { ...log, notes: updatedNotes } : log))
          );
        }
      }
    } catch (err: unknown) {
      console.error('[useMealsWorkspace] Failed to update log notes:', err);
      throw err;
    }
  };

  const groupHistoryByDate = () => {
    const grouped: Record<string, MealHistoryLog[]> = {};
    historyLogs.forEach((log) => {
      const dateKey = getManilaDateKey(log.loggedAt);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(log);
    });

    return Object.keys(grouped)
      .sort((a, b) => b.localeCompare(a))
      .map((dateKey) => {
        const logsList = grouped[dateKey];
        const parsedDate = manilaDateFromKey(dateKey);
        const weekday = formatManilaDate(parsedDate, { weekday: 'long' });
        const dateStr = formatManilaDate(parsedDate, { month: 'short', day: 'numeric', year: 'numeric' });
        const { totalCalories, totalProtein, totalCarbs, totalFat } = summarizeMealIntake(logsList);
        return {
          dateKey,
          weekday,
          dateStr,
          logsList,
          totalCalories,
          totalProtein,
          totalCarbs,
          totalFat,
          mealCount: logsList.length,
        };
      });
  };
  const groupedDays = groupMealsByDate();
  const groupedPendingDays = groupPendingMealsByDate();
  const displayedPlanDays = Array.from(
    new Set([...groupedDays.map((day) => day.dateKey), ...groupedPendingDays.map((day) => day.dateKey)])
  )
    .sort((a, b) => a.localeCompare(b))
    .map((dateKey) => {
      const approvedDay = groupedDays.find((day) => day.dateKey === dateKey);
      const pendingDay = groupedPendingDays.find((day) => day.dateKey === dateKey);
      const parsedDate = manilaDateFromKey(dateKey);
      return {
        dateKey,
        weekday: approvedDay?.weekday ?? pendingDay?.weekday ?? formatManilaDate(parsedDate, { weekday: 'long' }),
        dateStr:
          approvedDay?.dateStr ??
          pendingDay?.dateStr ??
          formatManilaDate(parsedDate, { month: 'short', day: 'numeric' }),
        mealsList: [...(approvedDay?.mealsList ?? []), ...(pendingDay?.mealsList ?? [])],
      };
    });
  const selectedPlanDayIndex = Math.max(
    0,
    displayedPlanDays.findIndex((day) => day.dateKey === selectedPlanDateKey)
  );
  const selectedPlanDay = displayedPlanDays[selectedPlanDayIndex] ?? null;
  const isStarterPlan = meals[0]?.planType === 'STARTER' || pendingReview?.planType === 'STARTER';

  const starterFirstDate =
    isStarterPlan && displayedPlanDays.length > 0 ? manilaDateFromKey(displayedPlanDays[0].dateKey) : null;
  const starterLastDate =
    isStarterPlan && displayedPlanDays.length > 0
      ? manilaDateFromKey(displayedPlanDays[displayedPlanDays.length - 1].dateKey)
      : null;

  const nextCycleDay = (() => {
    if (!isStarterPlan || !starterLastDate) return null;
    const dayAfter = new Date(starterLastDate);
    dayAfter.setDate(dayAfter.getDate() + 1);
    return formatManilaDate(dayAfter, { weekday: 'long', month: 'short', day: 'numeric' });
  })();
  const displayedMealCount = meals.length + (pendingReview?.mealCount ?? 0);
  const completedMealCount = meals.filter((meal) => meal.mealLogs?.some((log) => log.status === 'DONE')).length;
  const remainingSwapCount = Math.max(0, swapCap - swapsUsed);

  return {
    planView,
    setPlanView: (view: 'current' | 'next') => {
      setMeals([]);
      setPendingReview(null);
      setIsLoading(true);
      setSelectedPlanDateKey(null);
      setPlanView(view);
    },
    user,
    activeTab,
    setActiveTab,
    meals,
    isLoading,
    isRegenerating,
    regenerationProgress,
    error,
    pendingReview,
    selectedPlanDateKey,
    setSelectedPlanDateKey,
    swapsUsed,
    swapCap,
    activeSwapMeal,
    setActiveSwapMeal,
    swapOptions,
    setSwapOptions,
    isOptionsLoading,
    swapOptionsError,
    setSwapOptionsError,
    confirmSwapMeal,
    setConfirmSwapMeal,
    isSwapping,
    swapPreview,
    setSwapPreview,
    isCheckingPreview,
    previewError,
    historyLogs,
    isHistoryLoading,
    historyTotalCount,
    historyError,
    historySearch,
    setHistorySearch,
    historySource,
    setHistorySource,
    historyStatus,
    setHistoryStatus,
    selectedHistoryDateKey,
    setSelectedHistoryDateKey,
    handleUpdateLogNotes,
    libraryMeals,
    isLibraryLoading,
    libraryTotalCount,
    libraryError,
    librarySearch,
    setLibrarySearch,
    selectedVerifier,
    setSelectedVerifier,
    libraryMealType,
    setLibraryMealType,
    handleSwapClick,
    handleSelectSwapOption,
    handleConfirmSwapAnyway,
    handleMealStatusToggle,
    handleRegeneratePlan,
    handleHistorySearchSubmit,
    handleLibrarySearchSubmit,
    groupHistoryByDate,
    groupedDays,
    groupedPendingDays,
    displayedPlanDays,
    selectedPlanDayIndex,
    selectedPlanDay,
    isStarterPlan,
    starterFirstDate,
    starterLastDate,
    nextCycleDay,
    displayedMealCount,
    completedMealCount,
    remainingSwapCount,
  };
}
