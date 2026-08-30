'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import MealCard from '@/components/user/MealCard';
import PendingMealPreviewCard, { PendingMealPreview } from '@/components/user/PendingMealPreviewCard';
import Modal from '@/components/ui/Modal';
import { MealPlan } from '@/types';
import axios from 'axios';
import { Sprout, Calendar, History, BookOpen, RefreshCw, AlertTriangle, Search, FileText, Salad, Utensils, CheckCircle2, Clock3, ShieldCheck, Sparkles, CircleCheckBig, Repeat2, ListChecks, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatManilaDate, getManilaDateKey, manilaDateFromKey } from '@/lib/manila-date';


interface SwapOption {
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
}

export default function WeeklyPlanPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<'plan' | 'history' | 'library'>('plan');

  // Meal Plan states
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState<{
    mealCount: number;
    planType: 'STARTER' | 'WEEKLY';
    reviewStatus: 'PENDING_REVIEW';
    meals: PendingMealPreview[];
  } | null>(null);
  const [selectedPlanDateKey, setSelectedPlanDateKey] = useState<string | null>(null);
  const currentPlanRequestInFlight = useRef(false);

  // Meal swap states
  const [swapsUsed, setSwapsUsed] = useState(0);
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
  } | null>(null);
  const [isCheckingPreview, setIsCheckingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // History Tab states
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historySource, setHistorySource] = useState('All');
  const [historyStatus, setHistoryStatus] = useState('All');

  // Library Tab states
  const [libraryMeals, setLibraryMeals] = useState<SwapOption[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryMealType, setLibraryMealType] = useState('All');

  const fetchMeals = async () => {
    if (currentPlanRequestInFlight.current) return;
    currentPlanRequestInFlight.current = true;
    setIsLoading(true);
    setError(null);
    try {
      let res = await api.get('/user/meals/current');
      const hasCurrentPlan = (res.data?.data?.length ?? 0) > 0 || Boolean(res.data?.meta?.pendingReview);
      if (!hasCurrentPlan) {
        const rolloverRes = await api.post('/user/meals/rollover');
        if (rolloverRes.data?.data?.rolledOver) {
          res = await api.get('/user/meals/current');
        }
      }
      if (res.data && res.data.success) {
        setMeals(res.data.data);
        setPendingReview(res.data.meta?.pendingReview ?? null);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to fetch weekly plan menu.');
      } else {
        setError('Failed to reach backend API.');
      }
    } finally {
      currentPlanRequestInFlight.current = false;
      setIsLoading(false);
    }
  };

  const fetchHistory = async () => {
    setIsHistoryLoading(true);
    setHistoryError(null);
    try {
      const params: any = {};
      if (historySearch) params.search = historySearch;
      if (historySource !== 'All') params.source = historySource;
      if (historyStatus !== 'All') params.status = historyStatus;

      const res = await api.get('/user/meals/history', { params });
      if (res.data && res.data.success) {
        setHistoryLogs(res.data.data);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setHistoryError(err.response?.data?.error || 'Failed to fetch meal history.');
      } else {
        setHistoryError('Failed to fetch meal history.');
      }
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const fetchLibrary = async () => {
    setIsLibraryLoading(true);
    setLibraryError(null);
    try {
      const params: any = {};
      if (libraryMealType !== 'All') params.mealType = libraryMealType;
      if (librarySearch) params.search = librarySearch;

      const res = await api.get('/user/meals/compatible-library', { params });
      if (res.data && res.data.success) {
        setLibraryMeals(res.data.data);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setLibraryError(err.response?.data?.error || 'Failed to load library meals.');
      } else {
        setLibraryError('Failed to load library meals.');
      }
    } finally {
      setIsLibraryLoading(false);
    }
  };

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
  }, [user]);

  useEffect(() => {
    if (user) {
      if (activeTab === 'history') {
        fetchHistory();
      } else if (activeTab === 'library') {
        fetchLibrary();
      }
    }
  }, [user, activeTab, historySource, historyStatus, libraryMealType]);

  // Load swaps count once meals are fetched
  useEffect(() => {
    if (meals.length > 0) {
      api.get(`/user/meals/${meals[0].id}/swap-options`)
        .then((res) => {
          if (res.data?.success) {
            setSwapsUsed(res.data.data.swapsUsed);
          }
        })
        .catch((err) => console.error('Failed to pre-fetch swapsUsed:', err));
    }
  }, [meals]);

  useEffect(() => {
    const sourceMeals = meals.length > 0 ? meals : pendingReview?.meals ?? [];
    const availableDateKeys = Array.from(
      new Set(sourceMeals.map((meal) => getManilaDateKey(meal.scheduledDate)))
    ).filter(Boolean).sort((a, b) => a.localeCompare(b));

    if (availableDateKeys.length === 0) {
      setSelectedPlanDateKey(null);
      return;
    }

    setSelectedPlanDateKey((currentDateKey) => {
      if (currentDateKey && availableDateKeys.includes(currentDateKey)) return currentDateKey;
      const todayKey = getManilaDateKey();
      return availableDateKeys.find((dateKey) => dateKey >= todayKey)
        ?? availableDateKeys[availableDateKeys.length - 1];
    });
  }, [meals, pendingReview]);

  // Open Swap options modal and fetch eligible replacement meals
  const handleSwapClick = async (mealId: string) => {
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
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setSwapOptionsError(err.response?.data?.error || 'Failed to load eligible swap options.');
      } else {
        setSwapOptionsError('Failed to load eligible swap options.');
      }
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

        if (!preview.warningRequired) {
          // Proceed with swap directly!
          setIsSwapping(true);
          const swapRes = await api.post(`/user/meals/${activeSwapMeal.id}/swap`, {
            newLibraryMealId: option.id,
            warningShown: false,
            warningAcknowledged: false,
          });
          if (swapRes.data?.success) {
            setSwapsUsed(swapRes.data.data.swapsUsed);
            setActiveSwapMeal(null);
            setSwapOptions([]);
            setConfirmSwapMeal(null);
            setSwapPreview(null);
            await fetchMeals();
          }
        }
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setPreviewError(err.response?.data?.error || 'Failed to check swap preview.');
      } else {
        setPreviewError('Failed to check swap preview.');
      }
    } finally {
      setIsCheckingPreview(false);
      setIsSwapping(false);
    }
  };

  // Submits the swap with warning acknowledged
  const handleConfirmSwapAnyway = async () => {
    if (!activeSwapMeal || !confirmSwapMeal) return;

    setIsSwapping(true);
    setSwapOptionsError(null);

    try {
      const res = await api.post(`/user/meals/${activeSwapMeal.id}/swap`, {
        newLibraryMealId: confirmSwapMeal.id,
        warningShown: true,
        warningAcknowledged: true,
      });

      if (res.data?.success) {
        setSwapsUsed(res.data.data.swapsUsed);
        setActiveSwapMeal(null);
        setSwapOptions([]);
        setConfirmSwapMeal(null);
        setSwapPreview(null);
        // Refresh full meals plan
        await fetchMeals();
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setSwapOptionsError(err.response?.data?.error || 'Failed to complete swap.');
      } else {
        setSwapOptionsError('Failed to complete swap.');
      }
    } finally {
      setIsSwapping(false);
    }
  };

  // Handles scheduled status checkoff toggles in the weekly view
  const handleMealStatusToggle = async (mealPlanId: string, newStatus: 'DONE' | 'SKIPPED' | 'PENDING') => {
    try {
      await api.patch(`/user/meals/${mealPlanId}/status`, { status: newStatus });
      // Reload current meals to update checkboxes and macro sums
      const res = await api.get('/user/meals/current');
      if (res.data && res.data.success) {
        setMeals(res.data.data);
      }
    } catch (err) {
      console.error('[WeeklyPlan] Status toggle failed:', err);
    }
  };

  // Triggers full 7-day meal plan regeneration
  const handleRegeneratePlan = async () => {
    if (pendingReview) return;

    if (meals.length > 0) {
      if (!confirm('Are you sure you want to cancel your current plan and generate a completely new 7-day AI plan?')) return;
    }
    
    setIsRegenerating(true);
    setError(null);
    try {
      const res = await api.post('/user/meals/generate');
      if (res.data && res.data.success) {
        setMeals(res.data.data.meals);
        setPendingReview(res.data.data.pendingReview ?? null);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Gemini failed to regenerate weekly plan.');
      } else {
        setError('Regeneration failed.');
      }
    } finally {
      setIsRegenerating(false);
    }
  };

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

  const groupHistoryByDate = () => {
    const grouped: Record<string, any[]> = {};
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
        return {
          dateKey,
          weekday,
          dateStr,
          logsList,
        };
      });
  };

  if (isLoading || isRegenerating) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-brand-muted animate-pulse font-display font-semibold">
            {isRegenerating ? 'Regenerating 7-day AI plan...' : 'Analyzing weekly schedule...'}
          </p>
        </div>
      </div>
    );
  }

  const groupedDays = groupMealsByDate();
  const groupedPendingDays = groupPendingMealsByDate();
  const displayedPlanDays = groupedDays.length > 0 ? groupedDays : groupedPendingDays;
  const selectedPlanDayIndex = Math.max(
    0,
    displayedPlanDays.findIndex((day) => day.dateKey === selectedPlanDateKey)
  );
  const selectedPlanDay = displayedPlanDays[selectedPlanDayIndex] ?? null;
  const isStarterPlan = meals[0]?.planType === 'STARTER' || pendingReview?.planType === 'STARTER';

  const starterFirstDate = isStarterPlan && displayedPlanDays.length > 0
    ? manilaDateFromKey(displayedPlanDays[0].dateKey)
    : null;
  const starterLastDate = isStarterPlan && displayedPlanDays.length > 0
    ? manilaDateFromKey(displayedPlanDays[displayedPlanDays.length - 1].dateKey)
    : null;

  const nextCycleDay = (() => {
    if (!isStarterPlan || !starterLastDate) return null;
    const dayAfter = new Date(starterLastDate);
    dayAfter.setDate(dayAfter.getDate() + 1);
    return formatManilaDate(dayAfter, { weekday: 'long', month: 'short', day: 'numeric' });
  })();
  const displayedMealCount = displayedPlanDays.reduce((sum, day) => sum + day.mealsList.length, 0);
  const completedMealCount = meals.filter((meal) => meal.mealLogs?.some((log) => log.status === 'DONE')).length;
  const remainingSwapCount = Math.max(0, 3 - swapsUsed);

  return (
    <div className="portal-page select-none pb-32 text-brand-text">

      {/* Main Container */}
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        
        {/* Starter Plan Banner — shown only for STARTER plans and when activeTab is plan */}
        {activeTab === 'plan' && isStarterPlan && starterFirstDate && starterLastDate && nextCycleDay && (
          <div className="w-full rounded-2xl border border-brand-green/30 bg-brand-green/5 p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Sprout className="w-5 h-5 text-brand-green" />
              <h2 className="text-base font-extrabold text-brand-green font-display tracking-tight">
                Your Starter Plan
              </h2>
            </div>
            <p className="text-xs text-brand-muted">
              {displayedPlanDays.length} day{displayedPlanDays.length !== 1 ? 's' : ''} ·{' '}
              {formatManilaDate(starterFirstDate, { weekday: 'short', month: 'short', day: 'numeric' })} to{' '}
              {formatManilaDate(starterLastDate, { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
            <p className="text-[11px] text-brand-text/60 leading-relaxed">
              Your full 7-day plan begins on <span className="font-semibold text-brand-text/80">{nextCycleDay}</span>, matching your preferred shopping day.
            </p>
          </div>
        )}

        {/* Header Block */}
        <PortalPageHeader
          icon={activeTab === 'plan' && isStarterPlan ? Sprout : activeTab === 'history' ? History : BookOpen}
          eyebrow={activeTab === 'plan' ? 'Personal meal intelligence' : activeTab === 'history' ? 'Nutrition timeline' : 'Verified collection'}
          title={activeTab === 'plan' ? (isStarterPlan ? 'Starter meal plan' : 'Weekly meal plan') : activeTab === 'history' ? 'Meal history' : 'Meal library'}
          description={activeTab === 'plan' ? (isStarterPlan ? `${displayedPlanDays.length}-day kickoff plan. Your full weekly cycle starts ${nextCycleDay}.` : 'Your complete scheduled breakdown, macro targets, and meal review states.') : activeTab === 'history' ? 'Your logged intake history, completion states, and swapped items.' : 'Browse compatible, nutritionist-verified recipes for your profile.'}
          className="mb-1"
          meta={activeTab === 'plan' && meals.length > 0 ? <span className="font-mono text-[9px] uppercase tracking-wider text-white/45">{swapsUsed} of 3 swaps used</span> : undefined}
          actions={activeTab === 'plan' ? (pendingReview ? <Badge variant="pending" className="px-3 py-2">Pending verification</Badge> : (
              <Button variant="primary" onClick={handleRegeneratePlan} className="flex items-center gap-1.5 bg-red-500 text-xs font-bold text-white hover:bg-red-600">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Regenerate plan</span>
              </Button>
          )) : undefined}
        />

        {/* Tab Bar */}
        <nav className="grid grid-cols-3 gap-1 rounded-[22px] border border-brand-border/70 bg-brand-surface/85 p-1.5 text-left shadow-sm" aria-label="Meal workspace sections">
          {([
            ['plan', 'Plan', Calendar, displayedMealCount],
            ['history', 'History', History, historyLogs.length],
            ['library', 'Library', BookOpen, libraryMeals.length],
          ] as const).map(([value, label, Icon, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              aria-current={activeTab === value ? 'page' : undefined}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 font-display text-xs font-extrabold outline-none transition-all sm:text-sm ${activeTab === value ? 'bg-brand-accent text-[#07100d] shadow-neon' : 'text-brand-muted hover:bg-brand-bgAlt/70 hover:text-brand-text'}`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
              <span className={`hidden rounded-full px-1.5 py-0.5 font-mono text-[8px] sm:inline ${activeTab === value ? 'bg-[#07100d]/10' : 'bg-brand-bgAlt'}`}>{count}</span>
            </button>
          ))}
        </nav>

        {activeTab === 'plan' && displayedMealCount > 0 && (
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Scheduled meals', value: displayedMealCount, icon: ListChecks },
              { label: 'Plan days', value: displayedPlanDays.length, icon: Calendar },
              { label: pendingReview ? 'Awaiting review' : 'Completed', value: pendingReview ? displayedMealCount : completedMealCount, icon: pendingReview ? ShieldCheck : CircleCheckBig },
              { label: 'Swaps available', value: remainingSwapCount, icon: Repeat2 },
            ].map((metric) => {
              const MetricIcon = metric.icon;
              return (
                <div key={metric.label} className="rounded-[20px] border border-brand-border/70 bg-brand-surface p-4 shadow-sm">
                  <MetricIcon className="h-4 w-4 text-brand-green" />
                  <p className="mt-4 font-display text-2xl font-black text-brand-text">{metric.value}</p>
                  <p className="mt-1 text-[10px] font-semibold text-brand-muted">{metric.label}</p>
                </div>
              );
            })}
          </section>
        )}

        {activeTab === 'plan' && displayedPlanDays.length > 0 && selectedPlanDay && (
          <section className="rounded-[26px] border border-brand-border/70 bg-brand-surface/85 p-2 shadow-card" aria-label="Select a meal-plan day">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedPlanDateKey(displayedPlanDays[selectedPlanDayIndex - 1]?.dateKey ?? selectedPlanDay.dateKey)}
                disabled={selectedPlanDayIndex === 0}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-brand-border/70 bg-brand-bgAlt/60 text-brand-text outline-none transition hover:border-brand-green/30 hover:text-brand-green focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Previous plan day"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>

              <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scrollbar-none">
                {displayedPlanDays.map((day, index) => {
                  const isSelected = day.dateKey === selectedPlanDay.dateKey;
                  const parsedDate = manilaDateFromKey(day.dateKey);
                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      onClick={() => setSelectedPlanDateKey(day.dateKey)}
                      aria-current={isSelected ? 'date' : undefined}
                      className={`flex min-w-[88px] flex-1 flex-col items-center justify-center rounded-2xl border px-3 py-2.5 outline-none transition-all focus-visible:ring-2 focus-visible:ring-brand-green ${isSelected ? 'border-brand-accent bg-brand-accent text-[#07100d] shadow-neon' : 'border-transparent text-brand-muted hover:border-brand-border hover:bg-brand-bgAlt/70 hover:text-brand-text'}`}
                    >
                      <span className="text-[9px] font-extrabold uppercase tracking-[0.14em]">{formatManilaDate(parsedDate, { weekday: 'short' })}</span>
                      <span className="mt-0.5 font-display text-lg font-black leading-none">{formatManilaDate(parsedDate, { day: 'numeric' })}</span>
                      <span className={`mt-1 font-mono text-[8px] font-bold uppercase tracking-wider ${isSelected ? 'text-[#07100d]/60' : 'text-brand-muted/70'}`}>Day {index + 1}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setSelectedPlanDateKey(displayedPlanDays[selectedPlanDayIndex + 1]?.dateKey ?? selectedPlanDay.dateKey)}
                disabled={selectedPlanDayIndex === displayedPlanDays.length - 1}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-brand-border/70 bg-brand-bgAlt/60 text-brand-text outline-none transition hover:border-brand-green/30 hover:text-brand-green focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Next plan day"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center justify-between px-3 pb-1 pt-2 text-[10px] font-bold text-brand-muted">
              <span>{selectedPlanDay.weekday}, {selectedPlanDay.dateStr}</span>
              <span className="font-mono uppercase tracking-wider">{selectedPlanDayIndex + 1} of {displayedPlanDays.length}</span>
            </div>
          </section>
        )}

        {error && (
          <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2 text-left">
            <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Conditional Content Rendering */}
        {activeTab === 'plan' && (
          groupedDays.length === 0 ? (
            pendingReview ? (
              <section className="flex flex-col gap-8 text-left" aria-labelledby="pending-plan-heading">
                <div className="relative overflow-hidden rounded-[30px] border border-brand-green/20 bg-gradient-to-br from-brand-surface via-brand-surface to-brand-green/10 p-5 shadow-card md:p-7">
                  <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-accent/15 blur-3xl" aria-hidden="true" />
                  <div className="relative flex flex-col gap-6">
                    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
                      <div className="max-w-2xl">
                        <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-green">
                          <Sparkles className="h-4 w-4" aria-hidden="true" />
                          AI plan generated
                        </div>
                        <h2 id="pending-plan-heading" className="mt-3 font-display text-2xl font-black tracking-tight text-brand-text md:text-3xl">
                          Your plan is in clinical review
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                          All {pendingReview.mealCount} meals are connected across {groupedPendingDays.length} scheduled days. You can preview them now while a nutritionist verifies the recommendations.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:min-w-[250px]">
                        <div className="rounded-2xl border border-brand-border/60 bg-brand-bg/70 p-3.5">
                          <span className="block font-display text-2xl font-black text-brand-text">{pendingReview.mealCount}</span>
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-brand-muted">Meals</span>
                        </div>
                        <div className="rounded-2xl border border-brand-border/60 bg-brand-bg/70 p-3.5">
                          <span className="block font-display text-2xl font-black text-brand-text">{groupedPendingDays.length}</span>
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-brand-muted">Days</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-3">
                      <div className="flex items-center gap-3 rounded-2xl border border-brand-green/20 bg-brand-green/5 p-3.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-green text-white">
                          <CheckCircle2 className="h-4.5 w-4.5" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-muted">Step 1</p>
                          <p className="text-xs font-extrabold text-brand-text">Plan generated</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-2xl border border-status-pending-text/25 bg-status-pending-bg/40 p-3.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-status-pending-text text-white">
                          <Clock3 className="h-4.5 w-4.5" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-status-pending-text">Current</p>
                          <p className="text-xs font-extrabold text-brand-text">Nutritionist review</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-2xl border border-brand-border/60 bg-brand-bg/55 p-3.5 opacity-70">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-border bg-brand-surface text-brand-muted">
                          <ShieldCheck className="h-4.5 w-4.5" aria-hidden="true" />
                        </div>
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-muted">Step 3</p>
                          <p className="text-xs font-extrabold text-brand-text">Ready after approval</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 rounded-2xl border border-status-pending-text/20 bg-status-pending-bg/30 px-4 py-3 text-status-pending-text">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <p className="text-[11px] font-semibold leading-relaxed">
                        Preview only. Logging, swaps, regeneration, nutrition totals, and groceries remain disabled until approval.
                      </p>
                    </div>
                  </div>
                </div>

                {groupedPendingDays.slice(selectedPlanDayIndex, selectedPlanDayIndex + 1).map((day, dayIndex) => (
                  <div key={day.dateKey} className="rounded-[30px] border border-brand-border/60 bg-brand-surface/45 p-4 shadow-card md:p-5">
                    <div className="mb-5 flex flex-col gap-3 border-b border-brand-border/50 pb-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand-green/20 bg-brand-green/10 font-display text-sm font-black text-brand-green">
                          {String(selectedPlanDayIndex + dayIndex + 1).padStart(2, '0')}
                        </div>
                        <div>
                          <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-brand-muted">Plan day</p>
                          <h3 className="mt-0.5 font-display text-lg font-black leading-none text-brand-text">
                            {day.weekday}
                          </h3>
                          <span className="mt-1 block text-[10px] font-bold text-brand-muted">
                            {day.dateStr}
                          </span>
                        </div>
                      </div>
                      <Badge variant="pending" className="self-start px-3 py-1.5 text-[10px] md:self-auto">
                        {day.mealsList.length} meals pending verification
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                      {day.mealsList.map((meal, index) => (
                        <PendingMealPreviewCard
                          key={`${meal.scheduledDate}-${meal.mealType}-${index}`}
                          meal={meal}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ) : (
              <div className="py-12">
                <EmptyState
                  icon={<Calendar className="h-8 w-8 text-brand-green" />}
                  title="No Active Meal Plan"
                  description="Generate a customized 7-day plan (21 meals) using varied, affordable food choices matched to your nutrition needs and preferences."
                  actionText="Generate 7-Day Plan"
                  onAction={handleRegeneratePlan}
                />
              </div>
            )
          ) : (
            <div className="flex flex-col gap-4 text-left">
              {groupedDays.slice(selectedPlanDayIndex, selectedPlanDayIndex + 1).map((day) => (
                <section key={day.dateKey} className="overflow-hidden rounded-[26px] border border-brand-border/70 bg-brand-surface shadow-sm">
                  
                  {/* Day Header with sum targets */}
                  <div className="flex flex-col justify-between gap-3 border-b border-brand-border/60 bg-brand-bgAlt/35 px-4 py-4 md:flex-row md:items-center sm:px-5">
                    <div>
                      <h3 className="text-base font-extrabold font-display text-brand-green uppercase leading-none">
                        {day.weekday}
                      </h3>
                      <span className="text-[10px] text-brand-muted font-bold mt-1 block">
                        {day.dateStr}
                      </span>
                    </div>
                    
                    {/* Macros summing indicators */}
                    <div className="flex gap-3 flex-wrap text-[10px] font-bold text-brand-text">
                      <span className="rounded-full border border-brand-border bg-brand-bgAlt px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-brand-green">
                        Target: {Math.round(day.dayCalories)} kcal
                      </span>
                      <span className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em]" style={{ backgroundColor: 'var(--macro-protein-bg)', borderColor: 'var(--macro-protein-border)', color: 'var(--macro-protein)' }}>
                        {Math.round(day.dayProtein)}g Protein
                      </span>
                      <span className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em]" style={{ backgroundColor: 'var(--macro-carbs-bg)', borderColor: 'var(--macro-carbs-border)', color: 'var(--macro-carbs)' }}>
                        {Math.round(day.dayCarbs)}g Carbs
                      </span>
                      <span className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em]" style={{ backgroundColor: 'var(--macro-fat-bg)', borderColor: 'var(--macro-fat-border)', color: 'var(--macro-fat)' }}>
                        {Math.round(day.dayFat)}g Fat
                      </span>
                    </div>
                  </div>

                  {/* Day's 3 Meals Column Stack */}
                  <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-3 sm:p-5">
                    {day.mealsList.map((meal) => (
                      <MealCard
                        key={meal.id}
                        id={meal.id}
                        mealName={meal.mealName}
                        mealType={meal.mealType}
                        description={meal.description || undefined}
                        calories={meal.calories}
                        proteinG={meal.proteinG}
                        carbsG={meal.carbsG}
                        fatG={meal.fatG}
                        status={meal.status}
                        aiConfidenceFlag={meal.aiConfidenceFlag}
                        ingredients={meal.ingredients}
                        mealLogs={meal.mealLogs}
                        onStatusToggle={handleMealStatusToggle}
                        onSwapClick={handleSwapClick}
                        swapsUsed={swapsUsed}
                        scheduledDate={meal.scheduledDate}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )
        )}

        {activeTab === 'history' && (
          <div className="space-y-6 text-left">
            {/* Filters block */}
            <div className="flex flex-col items-center justify-between gap-3 rounded-[22px] border border-brand-border/70 bg-brand-surface/90 p-3 shadow-sm md:flex-row">
              <form onSubmit={handleHistorySearchSubmit} className="flex w-full gap-2 md:max-w-sm">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Search meal history</span>
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                  <input
                  type="text"
                  placeholder="Search history..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="h-10 w-full rounded-xl border border-brand-border bg-brand-bgAlt/60 pl-10 pr-3 text-xs text-brand-text outline-none focus:border-brand-green"
                />
                </label>
                <Button type="submit" variant="secondary" className="h-10 px-4 text-xs">Apply</Button>
              </form>
              <div className="grid w-full grid-cols-2 gap-2 md:w-auto">
                <select
                  value={historySource}
                  onChange={(e) => setHistorySource(e.target.value)}
                  className="h-10 rounded-xl border border-brand-border bg-brand-bgAlt/60 px-3 text-xs text-brand-text outline-none focus:border-brand-green"
                >
                  <option value="All">All Sources</option>
                  <option value="SYSTEM_GENERATED">NutriMind</option>
                  <option value="USER_LOGGED">Outside Meal</option>
                  <option value="USER_SWAPPED">Swapped</option>
                </select>
                <select
                  value={historyStatus}
                  onChange={(e) => setHistoryStatus(e.target.value)}
                  className="h-10 rounded-xl border border-brand-border bg-brand-bgAlt/60 px-3 text-xs text-brand-text outline-none focus:border-brand-green"
                >
                  <option value="All">All Statuses</option>
                  <option value="DONE">Done</option>
                  <option value="SKIPPED">Skipped</option>
                </select>
              </div>
            </div>

            {isHistoryLoading ? (
              <div className="flex flex-col items-center py-12 gap-2">
                <LoadingSpinner size="md" />
                <span className="text-xs text-brand-muted">Loading history logs...</span>
              </div>
            ) : historyError ? (
              <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
                <span>{historyError}</span>
              </div>
            ) : historyLogs.length === 0 ? (
              <div className="p-12 text-center border border-brand-border/40 bg-brand-surface/30 rounded-xl">
                <FileText className="w-8 h-8 text-brand-green mx-auto mb-2" />
                <p className="text-sm text-brand-text font-semibold">No Meal Logs Found</p>
                <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto">
                  You haven't logged any meals matching the selected filters yet.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {groupHistoryByDate().map((day) => (
                  <section key={day.dateKey} className="overflow-hidden rounded-[22px] border border-brand-border/70 bg-brand-surface shadow-sm">
                    <div className="border-b border-brand-border/60 bg-brand-bgAlt/35 px-4 py-3">
                      <span className="text-xs font-extrabold text-brand-green font-display uppercase">{day.weekday}</span>
                      <span className="text-[10px] text-brand-muted font-bold ml-2">{day.dateStr}</span>
                    </div>
                    <div className="grid gap-2 p-3">
                      {day.logsList.map((log) => {
                        const deltaVal = log.calorieDelta;
                        const hasDelta = deltaVal !== null && deltaVal !== undefined;
                        return (
                          <div
                            key={log.id}
                            className="flex flex-col justify-between gap-4 rounded-2xl border border-brand-border/65 bg-brand-surface p-4 transition hover:border-brand-green/20 md:flex-row md:items-center animate-fadeIn"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-brand-text">{log.mealName}</h4>
                                {log.source === 'SYSTEM_GENERATED' && (
                                  <span className="text-[10px] font-bold text-brand-green bg-brand-green/10 border border-brand-green/20 px-2 py-0.5 rounded uppercase">
                                    NutriMind
                                  </span>
                                )}
                                {log.source === 'USER_LOGGED' && (
                                  <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded uppercase">
                                    Outside Meal
                                  </span>
                                )}
                                {log.source === 'USER_SWAPPED' && (
                                  <span className="rounded border border-brand-cyan/25 bg-brand-cyan/10 px-2 py-0.5 text-[10px] font-bold uppercase text-brand-green dark:text-brand-cyan">
                                    Swapped
                                  </span>
                                )}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                  log.status === 'DONE'
                                    ? 'text-brand-green bg-brand-green/10'
                                    : log.status === 'SKIPPED'
                                    ? 'text-red-400 bg-red-400/10'
                                    : 'text-amber-500 bg-amber-500/10'
                                }`}>
                                  {log.status}
                                </span>
                              </div>
                              <div className="flex gap-2 text-[10px] text-brand-muted">
                                <span>{log.calories} kcal</span>
                                <span>·</span>
                                <span>{log.proteinG}g P</span>
                                <span>·</span>
                                <span>{log.carbsG}g C</span>
                                <span>·</span>
                                <span>{log.fatG}g F</span>
                              </div>
                            </div>
                            {log.source === 'USER_SWAPPED' && hasDelta && (
                              <div className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
                                deltaVal > 0
                                  ? 'text-amber-500 bg-amber-500/5 border-amber-500/20'
                                  : deltaVal < 0
                                  ? 'text-brand-green bg-brand-green/5 border-brand-green/20'
                                  : 'text-brand-muted bg-brand-surface border-brand-border'
                              }`}>
                                {deltaVal > 0 ? `+${Math.round(deltaVal)}` : Math.round(deltaVal)} kcal
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'library' && (
          <div className="space-y-6 text-left">
            <div className="flex flex-col items-center justify-between gap-3 rounded-[22px] border border-brand-border/70 bg-brand-surface/90 p-3 shadow-sm md:flex-row">
              <form onSubmit={handleLibrarySearchSubmit} className="flex w-full gap-2 md:max-w-sm">
                <label className="relative min-w-0 flex-1">
                  <span className="sr-only">Search verified recipes</span>
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                  <input
                  type="text"
                  placeholder="Search recipes..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="h-10 w-full rounded-xl border border-brand-border bg-brand-bgAlt/60 pl-10 pr-3 text-xs text-brand-text outline-none focus:border-brand-green"
                />
                </label>
                <Button type="submit" variant="secondary" className="h-10 px-4 text-xs">Apply</Button>
              </form>
              <div className="flex w-full gap-1 overflow-x-auto rounded-xl bg-brand-bgAlt/60 p-1 select-none md:w-auto">
                {['All', 'BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setLibraryMealType(type)}
                    className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                      libraryMealType === type
                        ? 'border-brand-green bg-brand-green text-white shadow-sm'
                        : 'border-transparent text-brand-muted hover:bg-brand-surface hover:text-brand-text'
                    }`}
                  >
                    {type === 'All' ? 'All Types' : type.charAt(0) + type.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            {isLibraryLoading ? (
              <div className="flex flex-col items-center py-12 gap-2">
                <LoadingSpinner size="md" />
                <span className="text-xs text-brand-muted">Loading recipes...</span>
              </div>
            ) : libraryError ? (
              <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
                <span>{libraryError}</span>
              </div>
            ) : libraryMeals.length === 0 ? (
              <div className="p-12 text-center border border-brand-border/40 bg-brand-surface/30 rounded-xl">
                <Salad className="w-8 h-8 text-brand-green mx-auto mb-2" />
                <p className="text-sm text-brand-text font-semibold">No Recipes Found</p>
                <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto">
                  No verified meals of this type match your health profile right now.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {libraryMeals.map((meal) => (
                  <div
                    key={meal.id}
                    className="flex min-h-[220px] flex-col justify-between gap-4 rounded-[22px] border border-brand-border/70 bg-brand-surface p-5 shadow-sm transition hover:-translate-y-1 hover:border-brand-green/25 hover:shadow-card animate-fadeIn"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[9px] font-extrabold text-brand-green bg-brand-green/10 border border-brand-green/20 px-2 py-0.5 rounded uppercase font-display tracking-wider">
                          {meal.mealType}
                        </span>
                        <span className="text-[10px] font-extrabold text-brand-green">{meal.calories} kcal</span>
                      </div>
                      <h4 className="text-sm font-bold text-brand-text leading-snug">{meal.mealName}</h4>
                      {meal.description && (
                        <p className="text-xs text-brand-muted leading-relaxed line-clamp-3">{meal.description}</p>
                      )}
                    </div>
                    <div className="pt-2 border-t border-brand-border/40 space-y-2">
                      {/* Macros */}
                      <div className="flex justify-between text-[10px] font-bold text-brand-muted">
                        <span>P: <span style={{ color: 'var(--macro-protein)' }} className="font-extrabold">{meal.proteinG}g</span></span>
                        <span>C: <span style={{ color: 'var(--macro-carbs)' }} className="font-extrabold">{meal.carbsG}g</span></span>
                        <span>F: <span style={{ color: 'var(--macro-fat)' }} className="font-extrabold">{meal.fatG}g</span></span>
                      </div>
                      {/* Verifier PRC Badge */}
                      <div className="text-[9px] text-brand-muted flex items-center justify-between gap-1 bg-brand-surface/80 p-1.5 rounded border border-brand-border/40">
                        <span>Verified by: <span className="font-semibold text-brand-text">{meal.verifiedBy}</span></span>
                        <span className="text-brand-green font-extrabold bg-brand-green/15 px-1 rounded uppercase tracking-tighter scale-95 origin-right">PRC: {meal.prcLicenseNumber}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Swap Options Modal */}
      {activeSwapMeal && (
        <Modal
          isOpen={true}
          onClose={() => {
            setActiveSwapMeal(null);
            setSwapOptions([]);
            setConfirmSwapMeal(null);
            setSwapOptionsError(null);
            setSwapPreview(null);
          }}
          title={`Swap ${activeSwapMeal.mealName}`}
          size="lg"
        >
          <div className="space-y-4 text-left">
            <p className="text-xs text-brand-muted leading-relaxed">
              Choose a verified alternative for{' '}
              <span className="font-bold text-brand-text">
                {activeSwapMeal.mealType}
              </span>{' '}
              on{' '}
              <span className="font-bold text-brand-text">
                {formatManilaDate(activeSwapMeal.scheduledDate, {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>.
            </p>

            {isOptionsLoading ? (
              <div className="flex flex-col items-center py-12 gap-2">
                <LoadingSpinner size="md" />
                <span className="text-xs text-brand-muted">Finding profile-matched verified meals...</span>
              </div>
            ) : swapOptionsError ? (
              <div className="p-3 bg-red-950/20 border border-red-900/60 rounded-xl text-xs text-red-400">
                {swapOptionsError}
              </div>
            ) : swapOptions.length === 0 ? (
              <div className="p-12 text-center border border-brand-border/40 bg-brand-surface/30 rounded-xl">
                <Utensils className="w-8 h-8 text-brand-green mx-auto mb-2" />
                <p className="text-sm text-brand-text font-semibold">No Alternative Meals Found</p>
                <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto">
                  No alternative verified meals match your profile for this meal type right now.
                </p>
              </div>
            ) : confirmSwapMeal ? (
              /* Confirmation / Warning Screen */
              <div className="space-y-4">
                {isCheckingPreview ? (
                  <div className="flex flex-col items-center py-12 gap-2">
                    <LoadingSpinner size="md" />
                    <span className="text-xs text-brand-muted font-semibold">Calculating daily calorie projection...</span>
                  </div>
                ) : previewError ? (
                  <div className="p-3 bg-red-950/20 border border-red-900/60 rounded-xl text-xs text-red-400">
                    {previewError}
                    <div className="flex justify-end mt-3">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setConfirmSwapMeal(null);
                          setSwapPreview(null);
                        }}
                        className="text-xs"
                      >
                        Back
                      </Button>
                    </div>
                  </div>
                ) : swapPreview && swapPreview.warningRequired ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        <h4 className="text-sm font-bold text-amber-500 font-display uppercase tracking-tight">Calorie Limit Warning</h4>
                      </div>
                      <p className="text-xs text-brand-text leading-relaxed font-sans">
                        This swap puts you at <span className="font-extrabold text-amber-500">{swapPreview.projectedDayTotal} kcal</span> for this day (
                        <span className="font-bold">
                          {swapPreview.calorieDelta >= 0 ? `+${Math.round(swapPreview.calorieDelta)}` : Math.round(swapPreview.calorieDelta)} kcal
                        </span> from your <span className="font-semibold">{swapPreview.dailyTarget} kcal</span> target).
                      </p>
                      <p className="text-[11px] text-brand-muted mt-2 font-sans">
                        This exceeds the recommended ±15% daily calorie target safety window. Do you want to proceed with the swap anyway?
                      </p>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setConfirmSwapMeal(null);
                          setSwapPreview(null);
                        }}
                        disabled={isSwapping}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleConfirmSwapAnyway}
                        disabled={isSwapping}
                        className="text-xs font-bold bg-amber-500 hover:bg-amber-600 border-amber-500/20 text-white"
                      >
                        {isSwapping ? 'Swapping...' : 'Swap Anyway'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              /* Swap Choices List */
              <div className="max-h-[50vh] overflow-y-auto space-y-3 pr-1">
                {swapOptions.map((option) => (
                  <div
                    key={option.id}
                    className="p-4 bg-brand-surface/50 border border-brand-border rounded-xl flex flex-col md:flex-row justify-between md:items-center gap-4 hover:border-brand-border-hover transition-colors"
                  >
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-brand-text leading-snug">{option.mealName}</h4>
                      {option.description && (
                        <p className="text-xs text-brand-muted line-clamp-1">{option.description}</p>
                      )}
                      
                      {/* Macros badges */}
                      <div className="flex gap-2 pt-1">
                        <span className="text-[10px] font-bold text-brand-green">{option.calories} kcal</span>
                        <span className="text-[10px] font-bold" style={{ color: 'var(--macro-protein)' }}>{option.proteinG}g P</span>
                        <span className="text-[10px] font-bold" style={{ color: 'var(--macro-carbs)' }}>{option.carbsG}g C</span>
                        <span className="text-[10px] font-bold" style={{ color: 'var(--macro-fat)' }}>{option.fatG}g F</span>
                      </div>

                      {/* Verifier Badge */}
                      <div className="text-[10px] text-brand-muted pt-1">
                        Verified by: <span className="text-brand-green font-bold">{option.verifiedBy}</span> (PRC: {option.prcLicenseNumber})
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      onClick={() => handleSelectSwapOption(option)}
                      className="text-xs font-semibold py-1.5 h-8 border-brand-border hover:border-brand-green/45 self-start md:self-center"
                    >
                      Select
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
