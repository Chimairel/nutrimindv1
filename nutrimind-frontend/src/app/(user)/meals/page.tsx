'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import MealCard from '@/components/user/MealCard';
import Modal from '@/components/ui/Modal';
import { MealPlan } from '@/types';
import axios from 'axios';
import { Sprout, Calendar, History, BookOpen, RefreshCw, AlertTriangle, Search, FileText, Salad, Utensils } from 'lucide-react';


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
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/user/meals/current');
      if (res.data && res.data.success) {
        setMeals(res.data.data);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to fetch weekly plan menu.');
      } else {
        setError('Failed to reach backend API.');
      }
    } finally {
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
    if (!confirm('Are you sure you want to cancel your current plan and generate a completely new 7-day AI plan?')) return;
    
    setIsRegenerating(true);
    setError(null);
    try {
      const res = await api.post('/user/meals/generate');
      if (res.data && res.data.success) {
        setMeals(res.data.data.meals);
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
      const dateKey = new Date(meal.scheduledDate).toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(meal);
    });

    // Sort the keys chronologically
    return Object.keys(grouped)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((dateKey) => {
        const dayMeals = grouped[dateKey];
        const parsedDate = new Date(dateKey);
        const weekday = parsedDate.toLocaleDateString('en-US', { weekday: 'long' });
        const dateStr = parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

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

  const groupHistoryByDate = () => {
    const grouped: Record<string, any[]> = {};
    historyLogs.forEach((log) => {
      const dateKey = new Date(log.loggedAt).toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(log);
    });

    return Object.keys(grouped)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map((dateKey) => {
        const logsList = grouped[dateKey];
        const parsedDate = new Date(dateKey);
        const weekday = parsedDate.toLocaleDateString('en-US', { weekday: 'long' });
        const dateStr = parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
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
  const isStarterPlan = meals.length > 0 && meals[0].planType === 'STARTER';

  const starterFirstDate = isStarterPlan && groupedDays.length > 0
    ? new Date(groupedDays[0].dateKey)
    : null;
  const starterLastDate = isStarterPlan && groupedDays.length > 0
    ? new Date(groupedDays[groupedDays.length - 1].dateKey)
    : null;

  const nextCycleDay = (() => {
    if (!isStarterPlan || !starterLastDate) return null;
    const dayAfter = new Date(starterLastDate);
    dayAfter.setDate(dayAfter.getDate() + 1);
    return dayAfter.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  })();

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text p-6 md:p-12 pb-32 select-none relative">
      <div className="absolute top-[10%] left-[50%] translate-x-[-50%] h-[300px] w-[500px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      {/* Main Container */}
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
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
              {groupedDays.length} day{groupedDays.length !== 1 ? 's' : ''} ·{' '}
              {starterFirstDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} to{' '}
              {starterLastDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </p>
            <p className="text-[11px] text-brand-text/60 leading-relaxed">
              Your full 7-day plan begins on <span className="font-semibold text-brand-text/80">{nextCycleDay}</span>, matching your preferred shopping day.
            </p>
          </div>
        )}

        {/* Header Block */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border/60 pb-6 text-left">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {activeTab === 'plan' && isStarterPlan ? (
                <Sprout className="w-6 h-6 text-brand-green shrink-0" />
              ) : activeTab === 'history' ? (
                <History className="w-6 h-6 text-brand-green shrink-0" />
              ) : (
                <BookOpen className="w-6 h-6 text-brand-green shrink-0" />
              )}
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-display text-brand-green uppercase">
                {activeTab === 'plan' ? (isStarterPlan ? 'STARTER PLAN' : 'WEEKLY MEAL PLAN') : activeTab === 'history' ? 'MEAL HISTORY' : 'MEAL LIBRARY'}
              </h1>
            </div>
            <p className="text-xs text-brand-muted uppercase tracking-wider font-bold">
              {activeTab === 'plan'
                ? (isStarterPlan
                  ? `${groupedDays.length}-day kickoff plan · Full weekly cycle starts ${nextCycleDay}`
                  : 'Complete 7-day scheduled breakdown and macro targets')
                : activeTab === 'history'
                ? 'Your logged meal intake history and swapped items'
                : 'Browse clinically approved recipes matching your profile'
              }
            </p>
            {activeTab === 'plan' && meals.length > 0 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-brand-muted font-semibold">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{swapsUsed} of 3 swaps used this week</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {activeTab === 'plan' && (
              <Button variant="primary" onClick={handleRegeneratePlan} className="text-xs font-bold py-2 bg-red-500 hover:bg-red-600 border-red-500/20 text-white shadow-xl shadow-red-500/10 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Regenerate Plan</span>
              </Button>
            )}
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b-2 border-brand-border pb-4 gap-2.5 text-left">
          <button
            onClick={() => setActiveTab('plan')}
            className={`py-2.5 px-5 font-display font-extrabold text-sm transition-all border-2 rounded-xl flex items-center gap-2 outline-none ${
              activeTab === 'plan'
                ? 'border-brand-border bg-brand-green text-white shadow-md'
                : 'border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text hover:bg-brand-bgAlt/50'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Plan</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-2.5 px-5 font-display font-extrabold text-sm transition-all border-2 rounded-xl flex items-center gap-2 outline-none ${
              activeTab === 'history'
                ? 'border-brand-border bg-brand-green text-white shadow-md'
                : 'border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text hover:bg-brand-bgAlt/50'
            }`}
          >
            <History className="w-4 h-4" />
            <span>History</span>
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`py-2.5 px-5 font-display font-extrabold text-sm transition-all border-2 rounded-xl flex items-center gap-2 outline-none ${
              activeTab === 'library'
                ? 'border-brand-border bg-brand-green text-white shadow-md'
                : 'border-brand-border bg-brand-surface text-brand-muted hover:text-brand-text hover:bg-brand-bgAlt/50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Library</span>
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2 text-left">
            <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Conditional Content Rendering */}
        {activeTab === 'plan' && (
          groupedDays.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={<Calendar className="h-8 w-8 text-brand-green" />}
                title="No Active Meal Plan"
                description="Generate a customized 7-day plan (21 meals) mapped to your clinical target calories and Filipino food culture."
                actionText="Generate 7-Day Plan"
                onAction={handleRegeneratePlan}

              />
            </div>
          ) : (
            <div className="flex flex-col gap-10 text-left">
              {groupedDays.map((day) => (
                <div key={day.dateKey} className="flex flex-col gap-4">
                  
                  {/* Day Header with sum targets */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-brand-surface/40 p-4 border border-brand-border/60 rounded-2xl">
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
                      <Badge variant="user" showIcon={false} className="py-0.5 px-2 bg-blue-400/10 text-blue-400 border-blue-400/20">
                        Target: {Math.round(day.dayCalories)} kcal
                      </Badge>
                      <Badge variant="verified" showIcon={false} className="py-0.5 px-2 bg-[#52B788]/10 text-brand-green border-brand-green/20">
                        {Math.round(day.dayProtein)}g Protein
                      </Badge>
                      <Badge variant="pending" showIcon={false} className="py-0.5 px-2 bg-amber-400/10 text-amber-500 border-amber-500/20">
                        {Math.round(day.dayCarbs)}g Carbs
                      </Badge>
                      <Badge variant="user" showIcon={false} className="py-0.5 px-2 bg-blue-400/10 text-blue-400 border-blue-400/20">
                        {Math.round(day.dayFat)}g Fat
                      </Badge>
                    </div>
                  </div>

                  {/* Day's 3 Meals Column Stack */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'history' && (
          <div className="space-y-6 text-left">
            {/* Filters block */}
            <div className="bg-brand-surface/40 border border-brand-border/60 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
              <form onSubmit={handleHistorySearchSubmit} className="flex gap-2 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Search history..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="bg-brand-bg border border-brand-border text-brand-text text-xs rounded-lg px-3 py-2 w-full md:w-64 focus:border-brand-green outline-none"
                />
                <Button type="submit" variant="secondary" className="text-xs py-2 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </Button>
              </form>
              <div className="flex gap-3 w-full md:w-auto justify-end">
                <select
                  value={historySource}
                  onChange={(e) => setHistorySource(e.target.value)}
                  className="bg-brand-bg border border-brand-border text-brand-text text-xs rounded-lg px-3 py-2 focus:border-brand-green outline-none"
                >
                  <option value="All">All Sources</option>
                  <option value="SYSTEM_GENERATED">NutriMind</option>
                  <option value="USER_LOGGED">Outside Meal</option>
                  <option value="USER_SWAPPED">Swapped</option>
                </select>
                <select
                  value={historyStatus}
                  onChange={(e) => setHistoryStatus(e.target.value)}
                  className="bg-brand-bg border border-brand-border text-brand-text text-xs rounded-lg px-3 py-2 focus:border-brand-green outline-none"
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
              <div className="flex flex-col gap-8">
                {groupHistoryByDate().map((day) => (
                  <div key={day.dateKey} className="flex flex-col gap-3">
                    <div className="bg-brand-surface/20 px-4 py-2 border-b border-brand-border/40">
                      <span className="text-xs font-extrabold text-brand-green font-display uppercase">{day.weekday}</span>
                      <span className="text-[10px] text-brand-muted font-bold ml-2">{day.dateStr}</span>
                    </div>
                    <div className="flex flex-col gap-3">
                      {day.logsList.map((log) => {
                        const deltaVal = log.calorieDelta;
                        const hasDelta = deltaVal !== null && deltaVal !== undefined;
                        return (
                          <div
                            key={log.id}
                            className="p-4 bg-brand-surface/50 border border-brand-border rounded-xl flex flex-col md:flex-row justify-between md:items-center gap-4 animate-fadeIn"
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
                                  <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded uppercase">
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
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'library' && (
          <div className="space-y-6 text-left">
            <div className="bg-brand-surface/40 border border-brand-border/60 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
              <form onSubmit={handleLibrarySearchSubmit} className="flex gap-2 w-full md:w-auto">
                <input
                  type="text"
                  placeholder="Search recipes..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  className="bg-brand-bg border border-brand-border text-brand-text text-xs rounded-lg px-3 py-2 w-full md:w-64 focus:border-brand-green outline-none"
                />
                <Button type="submit" variant="secondary" className="text-xs py-2 flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5" />
                  <span>Search</span>
                </Button>
              </form>
              <div className="flex gap-2 overflow-x-auto select-none py-1 w-full md:w-auto justify-end">
                {['All', 'BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setLibraryMealType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      libraryMealType === type
                        ? 'bg-brand-green text-brand-bg border-brand-green'
                        : 'bg-brand-surface text-brand-muted border-brand-border hover:border-brand-border-hover hover:text-brand-text'
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {libraryMeals.map((meal) => (
                  <div
                    key={meal.id}
                    className="p-5 bg-brand-surface/50 border border-brand-border rounded-2xl flex flex-col gap-3 justify-between hover:border-brand-border-hover transition-colors animate-fadeIn"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[9px] font-extrabold text-brand-green bg-brand-green/10 border border-brand-green/20 px-2 py-0.5 rounded uppercase font-display tracking-wider">
                          {meal.mealType}
                        </span>
                        <span className="text-[10px] text-blue-400 font-extrabold">{meal.calories} kcal</span>
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
                {new Date(activeSwapMeal.scheduledDate).toLocaleDateString('en-US', {
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
                        <span className="text-[10px] text-blue-400 font-bold">{option.calories} kcal</span>
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
