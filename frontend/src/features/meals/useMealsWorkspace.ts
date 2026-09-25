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
import type { CycleMetaSnapshot } from '@/features/dashboard/model';

export interface SwapOption {
  id: string;
  mealName: string;
  description?: string;
  mealType: string;
  mealTypes: string[];
  riceRole?: 'PAIR_WITH_RICE' | 'STANDALONE' | 'INCLUDES_RICE' | null;
  riceRoleReviewStatus?: 'NOT_REVIEWED' | 'PROPOSED' | 'REVIEWED';
  includedRiceG?: number | null;
  servingDescription?: string;
  isFavorite: boolean;
  alreadyPlannedInCycle?: boolean;
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
  nutritionCompleteness?: 'COMPLETE' | 'PARTIAL' | 'UNRESOLVED';
  provisionalCalories?: number;
  hasImage?: boolean;
  voidedAt?: string | null;
  mealType?: string | null;
  outsideItems?: Array<{
    id: string;
    name: string;
    portionGrams?: number | null;
    calories?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    nutritionStatus?: string;
    source?: string;
    includedInTotals?: boolean;
    currentRevision?: number;
    revisions?: Array<{ revision: number; reason?: string | null }>;
    observedSubmissions?: Array<{
      id: string;
      sourceRevision: number;
      status: string;
      imageReuseConsentedAt?: string | null;
    }>;
    review?: {
      id: string;
      status: string;
      queueReason?: string | null;
      reviewedRevision?: number | null;
      reviewedAt?: string | null;
      messages: Array<{
        id: string;
        sender: 'USER' | 'NUTRITIONIST';
        itemRevision: number;
        content: string;
        createdAt: string;
      }>;
    } | null;
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
  cycles?: {
    current?: CycleMetaSnapshot | null;
    upcoming?: CycleMetaSnapshot | null;
  } | null;
  isStarterPlan?: boolean;
  nextCycleDay?: string | null;
}

const planResource = 'user-meals-workspace';
const historyResource = (search: string, source: string, status: string) =>
  `user-meals-history:${search}:${source}:${status}`;
const libraryResource = (search: string, mealType: string, favoriteOnly = false, riceRole = 'All') =>
  `user-meals-library:${search}:${mealType}:${favoriteOnly}:${riceRole}`;

export function useMealsWorkspace() {
  const { user } = useAuth();
  const ownerId = user?.userId;
  const currentPlanResource = planResource;
  const cachedPlan = readSessionResource<CurrentPlanSnapshot>(ownerId, currentPlanResource);
  const cachedHistory = readSessionResource<MealHistoryLog[]>(ownerId, historyResource('', 'All', 'All'));
  const cachedLibrary = readSessionResource<SwapOption[]>(ownerId, libraryResource('', 'All'));
  // Tab state
  const [activeTab, setActiveTab] = useState<'plan' | 'history' | 'library'>('plan');

  // Meal Plan states
  const hasPlanData = Boolean(cachedPlan && (cachedPlan.meals.length > 0 || cachedPlan.pendingReview));
  const [meals, setMeals] = useState<MealPlan[]>(cachedPlan?.meals ?? []);
  const [cycles, setCycles] = useState<{
    current?: CycleMetaSnapshot | null;
    upcoming?: CycleMetaSnapshot | null;
  } | null>(cachedPlan?.cycles ?? null);
  const [isLoading, setIsLoading] = useState(!hasPlanData);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const regenerationProgress = useMealGenerationProgress(isRegenerating);
  const [error, setError] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState<PendingReviewState | null>(cachedPlan?.pendingReview ?? null);
  const [selectedPlanDateKey, setSelectedPlanDateKey] = useState<string | null>(null);
  const currentPlanRequestInFlight = useRef(false);
  const secondaryDataPrefetchedForUserRef = useRef<string | null>(null);

  // Meal swap states
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
    expiresAt: string;
    shoppingStarted: boolean;
    groceryDeltaAcknowledgmentRequired: boolean;
    alreadyPlannedInCycle: boolean;
    shoppingRemovals: Array<{
      ingredientName: string;
      unit: string | null;
      removableQuantity: number | null;
    }>;
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
  const [libraryFavoriteOnly, setLibraryFavoriteOnly] = useState(false);
  const [libraryRiceRole, setLibraryRiceRole] = useState('All');
  const [libraryNextCursor, setLibraryNextCursor] = useState<string | null>(null);

  const applyCurrentPlan = useCallback(
    (snapshot: CurrentPlanSnapshot) => {
      setMeals(snapshot.meals);
      setPendingReview(snapshot.pendingReview);
      setCycles(snapshot.cycles ?? null);
      writeSessionResource(ownerId, currentPlanResource, snapshot);
    },
    [ownerId, currentPlanResource]
  );

  const fetchMeals = useCallback(async () => {
    if (currentPlanRequestInFlight.current) return;
    currentPlanRequestInFlight.current = true;
    setError(null);
    try {
      const res = await api.get('/user/meals/workspace');
      if (res.data && res.data.success) {
        applyCurrentPlan({
          meals: Array.isArray(res.data.data) ? res.data.data : [],
          pendingReview: res.data.meta?.pendingReview ?? null,
          cycles: res.data.meta?.cycles ?? null,
        });
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to fetch weekly plan menu.'));
    } finally {
      currentPlanRequestInFlight.current = false;
      setIsLoading(false);
    }
  }, [applyCurrentPlan]);

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
  const fetchLibrary = useCallback(
    async (cursor?: string) => {
      const resource =
        libraryResource(librarySearch, libraryMealType, libraryFavoriteOnly, libraryRiceRole) + ':' + libraryDate;
      const cached = readSessionResource<SwapOption[]>(user?.userId, resource);
      if (!cursor && cached) setLibraryMeals(cached);
      setIsLibraryLoading(!cursor && !cached);
      setLibraryError(null);
      try {
        const params: Record<string, string> = {};
        params.date = libraryDate;
        if (libraryMealType !== 'All') params.mealType = libraryMealType;
        if (librarySearch) params.search = librarySearch;
        if (libraryFavoriteOnly) params.favoriteOnly = 'true';
        if (libraryRiceRole !== 'All') params.riceRole = libraryRiceRole;
        if (cursor) params.cursor = cursor;
        params.limit = '24';

        const res = await api.get('/user/meals/compatible-library', { params });
        if (res.data && res.data.success) {
          const incoming: SwapOption[] = Array.isArray(res.data.data) ? res.data.data : [];
          setLibraryMeals((current) => {
            const next = cursor
              ? [...current, ...incoming.filter((meal) => !current.some((existing) => existing.id === meal.id))]
              : incoming;
            writeSessionResource(user?.userId, resource, next);
            return next;
          });
          setLibraryTotalCount(Number(res.data.meta?.total ?? incoming.length));
          setLibraryNextCursor(res.data.meta?.nextCursor ?? null);
        }
      } catch (err: unknown) {
        setLibraryError(getApiErrorMessage(err, 'Failed to load library meals.'));
      } finally {
        setIsLibraryLoading(false);
      }
    },
    [user?.userId, libraryMealType, librarySearch, libraryFavoriteOnly, libraryRiceRole, libraryDate]
  );

  const toggleLibraryFavorite = useCallback(
    async (meal: SwapOption) => {
      const nextFavorite = !meal.isFavorite;
      if (nextFavorite) await api.post(`/user/meals/library/${meal.id}/favorite`);
      else await api.delete(`/user/meals/library/${meal.id}/favorite`);
      setLibraryMeals((current) =>
        current
          .map((entry) => (entry.id === meal.id ? { ...entry, isFavorite: nextFavorite } : entry))
          .filter((entry) => !libraryFavoriteOnly || entry.isFavorite)
      );
      if (libraryFavoriteOnly && !nextFavorite) setLibraryTotalCount((current) => Math.max(0, (current ?? 1) - 1));
    },
    [libraryFavoriteOnly]
  );

  const toggleSwapFavorite = async (meal: SwapOption) => {
    if (meal.isFavorite) await api.delete(`/user/meals/library/${meal.id}/favorite`);
    else await api.post(`/user/meals/library/${meal.id}/favorite`);
    setSwapOptions((current) =>
      current.map((entry) => (entry.id === meal.id ? { ...entry, isFavorite: !meal.isFavorite } : entry))
    );
    setLibraryMeals((current) =>
      current.map((entry) => (entry.id === meal.id ? { ...entry, isFavorite: !meal.isFavorite } : entry))
    );
  };

  useEffect(() => {
    if (ownerId) {
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
  }, [ownerId, fetchMeals]);

  useEffect(() => {
    if (!ownerId) {
      secondaryDataPrefetchedForUserRef.current = null;
      return;
    }

    if (secondaryDataPrefetchedForUserRef.current === ownerId) return;
    secondaryDataPrefetchedForUserRef.current = ownerId;
    fetchHistory();
    fetchLibrary();
  }, [ownerId, fetchHistory, fetchLibrary]);

  useEffect(() => {
    if (ownerId) {
      if (activeTab === 'history') {
        fetchHistory();
      } else if (activeTab === 'library') {
        fetchLibrary();
      }
    }
  }, [ownerId, activeTab, fetchHistory, fetchLibrary]);

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
        if (preferred) {
          if (!res.data.data.swapOptions.some((option: SwapOption) => option.id === preferred.id))
            throw new Error('This recipe is not eligible for that slot.');
          const preview = await api.get('/user/meals/' + mealId + '/swap-preview', {
            params: { libraryMealId: preferred.id },
          });
          setConfirmSwapMeal(preferred);
          setSwapPreview(preview.data.data);
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
        setSwapPreview(preview);
      }
    } catch (err: unknown) {
      setPreviewError(getApiErrorMessage(err, 'Failed to check swap preview.'));
    } finally {
      setIsCheckingPreview(false);
      setIsSwapping(false);
    }
  };

  // Submits the swap with warning acknowledged
  const handleConfirmSwapAnyway = async (groceryDeltaAcknowledged = false) => {
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
        groceryDeltaAcknowledged,
      });

      if (res.data?.success) {
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
      const res = await api.get('/user/meals/workspace');
      if (res.data && res.data.success) {
        applyCurrentPlan({
          meals: Array.isArray(res.data.data) ? res.data.data : [],
          pendingReview: res.data.meta?.pendingReview ?? null,
          cycles: res.data.meta?.cycles ?? null,
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

      if (meals.length > 0 && !options?.skipConfirm) {
        if (!confirm('Are you sure you want to cancel your current plan and generate a completely new 7-day AI plan?'))
          return;
      }

      setIsRegenerating(true);
      regenerationProgress.begin('Preparing a replacement weekly plan.');
      setError(null);
      try {
        const res = await api.post('/user/meals/generate', { replaceExisting: meals.length > 0 });
        if (res.data && res.data.success) {
          regenerationProgress.complete('Your replacement plan is ready for review.');
          applyCurrentPlan({
            meals: res.data.data.meals,
            pendingReview: res.data.data.pendingReview ?? null,
          });
          setIsRegenerating(false);
        }
      } catch (err: unknown) {
        const msg = getApiErrorMessage(err, 'Gemini failed to regenerate weekly plan.');
        regenerationProgress.fail(msg);
        setError(msg);
      }
    },
    [pendingReview, meals.length, regenerationProgress, applyCurrentPlan]
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

  const handleEditOutsideItem = async (
    logId: string,
    itemId: string,
    input: {
      name: string;
      portionGrams: number | null;
      reportedNutrition?: { calories: number; proteinG: number; carbsG: number; fatG: number };
      unresolved?: boolean;
      reason: string;
    }
  ) => {
    await api.patch(`/user/meals/logs/${logId}/items/${itemId}`, input);
    await Promise.all([fetchHistory(), fetchMeals()]);
  };

  const handleVoidOutsideLog = async (logId: string, reason: string) => {
    await api.post(`/user/meals/logs/${logId}/void`, { reason });
    await Promise.all([fetchHistory(), fetchMeals()]);
  };

  const handleRequestOutsideReview = async (logId: string, itemId: string) => {
    await api.post(`/user/meals/logs/${logId}/items/${itemId}/request-review`);
    await fetchHistory();
  };

  const handleReplyToOutsideReview = async (logId: string, itemId: string, message: string) => {
    await api.post(`/user/meals/logs/${logId}/items/${itemId}/reply`, { message });
    await fetchHistory();
  };

  const handleObservedConsent = async (logId: string, itemId: string, imageReuseConsent: boolean) => {
    await api.post(`/user/meals/logs/${logId}/items/${itemId}/observed-consent`, {
      detailsConsent: true,
      imageReuseConsent,
      imageRightsConfirmed: imageReuseConsent,
    });
    await fetchHistory();
  };

  const handleObservedWithdraw = async (submissionId: string) => {
    await api.post(`/user/meals/observed-submissions/${submissionId}/withdraw`);
    await fetchHistory();
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
  const isStarterPlan =
    cycles?.current?.planType === 'STARTER' ||
    (!cycles?.current && (meals[0]?.planType === 'STARTER' || pendingReview?.planType === 'STARTER'));

  const starterMeals = [
    ...meals.filter((m) => m.planType === 'STARTER'),
    ...(pendingReview?.meals?.filter((m) => m.planType === 'STARTER') ?? []),
  ].sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

  const starterFirstDate =
    isStarterPlan && starterMeals.length > 0
      ? manilaDateFromKey(getManilaDateKey(starterMeals[0].scheduledDate))
      : isStarterPlan && cycles?.current?.startDate
        ? manilaDateFromKey(getManilaDateKey(cycles.current.startDate))
        : null;

  const starterLastDate =
    isStarterPlan && starterMeals.length > 0
      ? manilaDateFromKey(getManilaDateKey(starterMeals[starterMeals.length - 1].scheduledDate))
      : isStarterPlan && cycles?.current?.endDate
        ? manilaDateFromKey(getManilaDateKey(cycles.current.endDate))
        : null;

  const nextCycleDay = (() => {
    if (!isStarterPlan) return null;
    if (cycles?.upcoming?.startDate) {
      return formatManilaDate(manilaDateFromKey(getManilaDateKey(cycles.upcoming.startDate)), {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
    const weeklyMeals = [
      ...meals.filter((m) => m.planType === 'WEEKLY'),
      ...(pendingReview?.meals?.filter((m) => m.planType === 'WEEKLY') ?? []),
    ].sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
    if (weeklyMeals.length > 0) {
      return formatManilaDate(manilaDateFromKey(getManilaDateKey(weeklyMeals[0].scheduledDate)), {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
    if (starterLastDate) {
      const dayAfter = new Date(starterLastDate);
      dayAfter.setDate(dayAfter.getDate() + 1);
      return formatManilaDate(dayAfter, { weekday: 'long', month: 'short', day: 'numeric' });
    }
    return null;
  })();
  const displayedMealCount = meals.length + (pendingReview?.mealCount ?? 0);
  const completedMealCount = meals.filter((meal) => meal.mealLogs?.some((log) => log.status === 'DONE')).length;
  return {
    user,
    activeTab,
    setActiveTab,
    meals,
    isLoading,
    isRegenerating,
    regenerationProgress,
    error,
    pendingReview,
    cycles,
    selectedPlanDateKey,
    setSelectedPlanDateKey,
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
    handleEditOutsideItem,
    handleVoidOutsideLog,
    handleRequestOutsideReview,
    handleReplyToOutsideReview,
    handleObservedConsent,
    handleObservedWithdraw,
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
    libraryFavoriteOnly,
    setLibraryFavoriteOnly,
    libraryRiceRole,
    setLibraryRiceRole,
    libraryNextCursor,
    loadMoreLibrary: () => (libraryNextCursor ? fetchLibrary(libraryNextCursor) : Promise.resolve()),
    toggleLibraryFavorite,
    toggleSwapFavorite,
    handleSwapClick,
    handleSelectSwapOption,
    handleConfirmSwapAnyway,
    handleMealStatusToggle,
    handleRegeneratePlan,
    setIsRegenerating,
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
  };
}
