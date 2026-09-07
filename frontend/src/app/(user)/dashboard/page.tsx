'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import CheckinModal from '@/components/user/CheckinModal';
import MealPlanGenerationProgress from '@/components/user/MealPlanGenerationProgress';
import { MealPlan, MealType } from '@/types';
import axios from 'axios';
import { Calendar, Plus, AlertTriangle, Utensils, Sparkles } from 'lucide-react';
import { formatManilaDate, getManilaDateKey } from '@/lib/manila-date';
import type { UserProfileData } from '@/hooks/useProfile';
import { DashboardMealSchedule } from '@/features/dashboard/DashboardMealSchedule';
import { DashboardSummary } from '@/features/dashboard/DashboardSummary';
import { OutsideMealModal } from '@/features/dashboard/OutsideMealModal';
import {
  calculateDashboardMetrics,
  type OutsideMealLog,
  type OutsideMealWarning,
  type PendingReview,
} from '@/features/dashboard/model';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';

interface CurrentPlanSnapshot {
  meals: MealPlan[];
  pendingReview: PendingReview | null;
  swapsUsed: number;
  swapCap: number;
}

interface CheckinSnapshot {
  isDue: boolean;
  streak: number;
  lastCheckinAt: string | null;
}

const currentPlanResource = 'user-meals-current';

export default function DashboardPage() {
  const { user } = useAuth();
  const ownerId = user?.userId;
  const cachedPlan = readSessionResource<CurrentPlanSnapshot>(ownerId, currentPlanResource);
  const cachedProfile = readSessionResource<UserProfileData>(ownerId, 'user-profile');
  const cachedOutsideMeals = readSessionResource<OutsideMealLog[]>(ownerId, 'dashboard-outside-meals');
  const cachedWater = readSessionResource<number>(ownerId, 'dashboard-water');
  const cachedCheckin = readSessionResource<CheckinSnapshot>(ownerId, 'dashboard-checkin');
  const router = useRouter();
  const [currentMeals, setCurrentMeals] = useState<MealPlan[]>(cachedPlan?.meals ?? []);
  const [selectedDayOffset, setSelectedDayOffset] = useState(0); // Index of selected date in uniqueDates
  const [isLoading, setIsLoading] = useState(!cachedPlan);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0);
  const [generationStageMessage, setGenerationStageMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(cachedPlan?.pendingReview ?? null);
  const generationRequestInFlight = useRef(false);
  const currentPlanRequestInFlight = useRef(false);

  // Extract unique scheduledDate values in chronological order
  const uniqueDates = React.useMemo(() => {
    const scheduledMeals = [...currentMeals, ...(pendingReview?.meals ?? [])];

    if (scheduledMeals.length === 0) return [];
    const todayKey = getManilaDateKey();
    const dateKeys = Array.from(new Set(scheduledMeals.map((meal) => getManilaDateKey(meal.scheduledDate)))).filter(
      (dateKey) => dateKey && dateKey >= todayKey
    );
    return dateKeys.map((dateKey) => new Date(`${dateKey}T00:00:00+08:00`)).sort((a, b) => a.getTime() - b.getTime());
  }, [currentMeals, pendingReview]);

  // Sync selected day offset to today if present in the plan
  useEffect(() => {
    if (uniqueDates.length > 0) {
      const todayKey = getManilaDateKey();
      const todayIdx = uniqueDates.findIndex((date) => getManilaDateKey(date) === todayKey);
      const nextIdx = uniqueDates.findIndex((date) => getManilaDateKey(date) > todayKey);
      setSelectedDayOffset(todayIdx !== -1 ? todayIdx : Math.max(0, nextIdx));
    }
  }, [uniqueDates]);

  // Outside Meal Modal State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logMealName, setLogMealName] = useState('');
  const [logMealType, setLogMealType] = useState<MealType>('BREAKFAST');
  const [logNotes, setLogNotes] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);

  // Warning Pre-check State
  const [warningData, setWarningData] = useState<OutsideMealWarning | null>(null);

  // Check-in status
  const [isCheckinDue, setIsCheckinDue] = useState(Boolean(cachedCheckin?.isDue));
  const [checkinInfo, setCheckinInfo] = useState<CheckinSnapshot | null>(cachedCheckin);

  // User Profile details
  const [userProfile, setUserProfile] = useState<UserProfileData['userProfile']>(cachedProfile?.userProfile ?? null);
  const [outsideMealLogs, setOutsideMealLogs] = useState<OutsideMealLog[]>(cachedOutsideMeals ?? []);

  // Water intake state
  const [waterIntake, setWaterIntake] = useState(cachedWater ?? 0);

  const applyCurrentPlan = useCallback(
    (snapshot: CurrentPlanSnapshot) => {
      setCurrentMeals(snapshot.meals);
      setPendingReview(snapshot.pendingReview);
      writeSessionResource(ownerId, currentPlanResource, snapshot);
    },
    [ownerId]
  );

  // Fetch user profile metrics
  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get('/user/profile');
      if (res.data?.success) {
        setUserProfile(res.data.data.userProfile);
        writeSessionResource(ownerId, 'user-profile', res.data.data);
      }
    } catch (err) {
      console.error('[Dashboard] Failed to fetch user profile', err);
    }
  }, [ownerId]);

  // Hydration is persisted by the backend using the Manila business day.
  useEffect(() => {
    if (!user) return;
    void api
      .get('/user/water/today')
      .then((response) => {
        if (response.data?.success) {
          const totalMl = response.data.data.totalMl || 0;
          setWaterIntake(totalMl);
          writeSessionResource(ownerId, 'dashboard-water', totalMl);
        }
      })
      .catch(() => undefined);
  }, [user, ownerId]);

  const handleAddWater = async (amount: number) => {
    const nextWater = Math.max(0, waterIntake + amount);
    setWaterIntake(nextWater);
    try {
      if (amount > 0) {
        const response = await api.post('/user/water', { amountMl: amount });
        const totalMl = response.data?.data?.totalMl ?? nextWater;
        setWaterIntake(totalMl);
        writeSessionResource(ownerId, 'dashboard-water', totalMl);
      } else {
        const response = await api.post('/user/water/remove', { amountMl: Math.abs(amount) });
        const totalMl = response.data?.data?.totalMl ?? nextWater;
        setWaterIntake(totalMl);
        writeSessionResource(ownerId, 'dashboard-water', totalMl);
      }
    } catch {
      setWaterIntake((current) => Math.max(0, current - amount));
    }
  };

  const fetchOutsideMealLogs = useCallback(async () => {
    try {
      const res = await api.get('/user/meals/history', {
        params: { source: 'USER_LOGGED', status: 'DONE' },
      });
      if (res.data?.success) {
        const logs = Array.isArray(res.data.data) ? res.data.data : [];
        setOutsideMealLogs(logs);
        writeSessionResource(ownerId, 'dashboard-outside-meals', logs);
      }
    } catch (err) {
      console.error('[Dashboard] Failed to fetch outside-meal history', err);
    }
  }, [ownerId]);

  // Load active plan meals
  const fetchCurrentPlan = useCallback(async () => {
    if (currentPlanRequestInFlight.current) return;
    currentPlanRequestInFlight.current = true;
    setError(null);
    try {
      let res = await api.get('/user/meals/current');
      const hasCurrentPlan = (res.data?.data?.length ?? 0) > 0 || Boolean(res.data?.meta?.pendingReview);
      if (!hasCurrentPlan) {
        setGenerationProgress(5);
        setGenerationStageMessage('Checking the current meal-plan cycle.');
        setGenerationElapsedSeconds(0);
        setIsGenerating(true);
        try {
          const rolloverRes = await api.post('/user/meals/rollover');
          if (rolloverRes.data?.data?.rolledOver) {
            res = await api.get('/user/meals/current');
          }
        } finally {
          setIsGenerating(false);
        }
      }
      if (res.data && res.data.success) {
        applyCurrentPlan({
          meals: Array.isArray(res.data.data) ? res.data.data : [],
          pendingReview: res.data.meta?.pendingReview ?? null,
          swapsUsed: res.data.meta?.swapsUsed ?? 0,
          swapCap: res.data.meta?.swapCap ?? 3,
        });
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || "Failed to load today's scheduled plan.");
      } else {
        setError('Failed to contact backend API.');
      }
    } finally {
      currentPlanRequestInFlight.current = false;
      setIsLoading(false);
    }
  }, [applyCurrentPlan]);

  const checkCheckinStatus = useCallback(async () => {
    try {
      const res = await api.get('/user/checkin/status');
      if (res.data?.success) {
        setCheckinInfo(res.data.data);
        setIsCheckinDue(Boolean(res.data.data?.isDue));
        writeSessionResource(ownerId, 'dashboard-checkin', res.data.data);
      }
    } catch (err) {
      console.error('[Dashboard] Failed to fetch checkin status', err);
    }
  }, [ownerId]);

  useEffect(() => {
    if (user) {
      fetchCurrentPlan();
      checkCheckinStatus();
      fetchProfile();
      fetchOutsideMealLogs();

      let activeDateKey = getManilaDateKey();
      const refreshForDateRollover = () => {
        const nextDateKey = getManilaDateKey();
        if (nextDateKey !== activeDateKey) {
          activeDateKey = nextDateKey;
          fetchCurrentPlan();
        }
      };
      const refreshOnFocus = () => fetchCurrentPlan();
      const refreshOnVisibility = () => {
        if (document.visibilityState === 'visible') fetchCurrentPlan();
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
  }, [user, fetchCurrentPlan, checkCheckinStatus, fetchProfile, fetchOutsideMealLogs]);

  // Handles scheduled meal checkoff toggles
  const handleMealStatusToggle = async (mealPlanId: string, newStatus: 'DONE' | 'SKIPPED' | 'PENDING') => {
    try {
      await api.patch(`/user/meals/${mealPlanId}/status`, { status: newStatus });
      // Fetch plan again to sync local UI check marks and total calories
      const res = await api.get('/user/meals/current');
      if (res.data && res.data.success) {
        applyCurrentPlan({
          meals: Array.isArray(res.data.data) ? res.data.data : [],
          pendingReview: res.data.meta?.pendingReview ?? null,
          swapsUsed: res.data.meta?.swapsUsed ?? 0,
          swapCap: res.data.meta?.swapCap ?? 3,
        });
      }
    } catch (err) {
      console.error('[Dashboard] Status toggle failed:', err);
    }
  };

  useEffect(() => {
    if (!isGenerating) return;

    const startedAt = Date.now();
    let pollInFlight = false;
    const updateServerProgress = async () => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      setGenerationElapsedSeconds(elapsedSeconds);
      if (pollInFlight) return;
      pollInFlight = true;
      try {
        const response = await api.get('/user/meals/generation-status');
        const job = response.data?.data;
        if (job) {
          setGenerationProgress(job.progressPct ?? 0);
          setGenerationStageMessage(job.stageMessage ?? null);
        }
      } catch {
        // The generation request remains authoritative; a transient status poll
        // failure must not cancel it or fabricate progress.
      } finally {
        pollInFlight = false;
      }
    };

    void updateServerProgress();
    const interval = window.setInterval(() => void updateServerProgress(), 1000);
    return () => window.clearInterval(interval);
  }, [isGenerating]);

  // Triggers 7-day meal plan generation
  const handleGeneratePlan = async () => {
    if (generationRequestInFlight.current || pendingReview) return;

    generationRequestInFlight.current = true;
    setGenerationProgress(5);
    setGenerationStageMessage('Preparing your nutrition profile.');
    setGenerationElapsedSeconds(0);
    setIsGenerating(true);
    setError(null);
    try {
      const res = await api.post('/user/meals/generate');
      if (res.data && res.data.success) {
        setGenerationProgress(100);
        setGenerationStageMessage('Your plan is ready for review.');
        await new Promise<void>((resolve) => window.setTimeout(resolve, 700));
        applyCurrentPlan({
          meals: res.data.data.meals,
          pendingReview: res.data.data.pendingReview ?? null,
          swapsUsed: 0,
          swapCap: 3,
        });
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Gemini failed to generate standard plan.');
      } else {
        setError('Generation execution failed.');
      }
    } finally {
      generationRequestInFlight.current = false;
      setIsGenerating(false);
    }
  };

  // Submits the outside meal log (handles precheck warning cascades)
  const handleLogOutsideMeal = async (forceAcknowledge = false) => {
    setLogError(null);
    setIsLogging(true);
    try {
      const res = await api.post('/user/meals/log-outside', {
        mealName: logMealName.trim(),
        mealType: logMealType,
        warningAcknowledged: forceAcknowledge,
        confirmationId: forceAcknowledge ? warningData?.confirmationId : undefined,
        notes: logNotes.trim(),
      });

      if (res.data && res.data.success) {
        const payload = res.data.data;
        if (payload.warningRequired) {
          // Warning detected: trigger conflict view
          setWarningData({
            confirmationId: payload.confirmationId,
            warnings: payload.warnings,
            reasons: payload.reasons,
            estimate: payload.estimate,
          });
        } else {
          // Logged successfully! Close modal and refresh data
          setIsLogModalOpen(false);
          setLogMealName('');
          setLogNotes('');
          setWarningData(null);
          await Promise.all([fetchCurrentPlan(), fetchOutsideMealLogs()]);
        }
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setLogError(err.response?.data?.error || 'Failed to check outside meal.');
      } else {
        setLogError('Failed to contact server.');
      }
    } finally {
      setIsLogging(false);
    }
  };

  if (isGenerating) {
    return (
      <MealPlanGenerationProgress
        progress={generationProgress}
        elapsedSeconds={generationElapsedSeconds}
        stageMessage={generationStageMessage}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-brand-muted animate-pulse font-display font-semibold">
            Synchronizing dynamic clinical context...
          </p>
        </div>
      </div>
    );
  }

  const activeDate = uniqueDates[selectedDayOffset] ?? new Date();
  const metrics = calculateDashboardMetrics({
    activeDate,
    currentMeals,
    dailyCalorieTarget: userProfile?.dailyCalorieTarget,
    outsideMealLogs,
    pendingMeals: pendingReview?.meals ?? [],
  });
  const daySelectors = uniqueDates.map((date, index) => ({
    offset: index,
    dayLabel: formatManilaDate(date, { weekday: 'short' }),
    dateLabel: formatManilaDate(date, { day: 'numeric' }),
    isPast: getManilaDateKey(date) < getManilaDateKey(),
  }));

  const closeOutsideMealModal = () => {
    setIsLogModalOpen(false);
    setWarningData(null);
    setLogError(null);
    setLogMealName('');
    setLogNotes('');
  };

  return (
    <div className="portal-page select-none pb-32 text-brand-text">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <PortalPageHeader
          icon={Sparkles}
          eyebrow="Daily nutrition cockpit"
          title={<>Mabuhay, {user?.name.split(' ')[0]}.</>}
          description="Your accessible, culturally aware meal plan, daily targets, and review-aware nutrition progress in one connected view."
          actions={
            <Button
              variant="primary"
              onClick={() => router.push('/meals')}
              className="flex items-center gap-2 text-xs font-bold"
            >
              <Calendar className="h-4 w-4" />
              <span>Open weekly plan</span>
            </Button>
          }
        />

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-left text-sm font-semibold text-status-error-text">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {currentMeals.length === 0 && !pendingReview ? (
          <div className="py-12">
            <EmptyState
              icon={<Utensils className="h-8 w-8 text-brand-green" />}
              title="No Active Meal Plan"
              description="You do not have a meal plan scheduled. Generate an affordable, varied plan shaped by your nutrition needs, preferences, and locally available food choices."
              actionText="Generate Meal Plan"
              onAction={handleGeneratePlan}
            />
          </div>
        ) : (
          <>
            {daySelectors.length > 0 && (
              <div
                className="order-1 mx-auto flex max-w-full gap-1.5 overflow-x-auto rounded-[24px] border border-brand-border/60 bg-brand-surface/75 p-2 shadow-card scrollbar-none"
                aria-label="Meal plan dates"
              >
                {daySelectors.map((item) => {
                  const isSelected = selectedDayOffset === item.offset;
                  return (
                    <button
                      key={item.offset}
                      onClick={() => setSelectedDayOffset(item.offset)}
                      aria-pressed={isSelected}
                      className={`flex min-w-[76px] flex-col items-center justify-center rounded-2xl border px-4 py-3 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg ${isSelected ? 'border-brand-border bg-brand-accent text-black shadow-md shadow-brand-accent/10' : item.isPast ? 'border-transparent bg-brand-bgAlt/70 text-brand-muted/70 hover:border-brand-border hover:text-brand-text' : 'border-transparent bg-transparent text-brand-muted hover:border-brand-border hover:bg-brand-bgAlt/60 hover:text-brand-text'}`}
                    >
                      <span className="text-[9px] font-extrabold uppercase tracking-[0.14em]">{item.dayLabel}</span>
                      <span className="mt-1 font-display text-xl font-black leading-none">{item.dateLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <DashboardSummary
              checkinDue={isCheckinDue}
              checkinStreak={checkinInfo?.streak ?? 0}
              metrics={metrics}
              onAddWater={handleAddWater}
              onOpenCheckin={() => setIsCheckinDue(true)}
              profile={userProfile}
              waterIntake={waterIntake}
            />
            <DashboardMealSchedule
              activeDate={activeDate}
              approvedMeals={metrics.mealsList}
              onStatusToggle={handleMealStatusToggle}
              pendingReview={pendingReview}
            />
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setIsLogModalOpen(true)}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-brand-green/30 bg-brand-accent text-brand-black shadow-xl shadow-brand-accent/20 outline-none transition-all duration-200 hover:scale-105 hover:bg-brand-accent/90 focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg active:scale-95 md:bottom-8 md:right-8 md:h-16 md:w-16"
        aria-label="Log an outside meal"
        title="Log an outside meal"
      >
        <Plus className="h-7 w-7 stroke-[3px] md:h-8 md:w-8" />
      </button>

      <OutsideMealModal
        error={logError}
        isLoading={isLogging}
        isOpen={isLogModalOpen}
        mealName={logMealName}
        mealType={logMealType}
        notes={logNotes}
        onClose={closeOutsideMealModal}
        onMealNameChange={setLogMealName}
        onMealTypeChange={setLogMealType}
        onNotesChange={setLogNotes}
        onSubmit={handleLogOutsideMeal}
        onWarningCancel={() => setWarningData(null)}
        warning={warningData}
      />

      <CheckinModal isOpen={isCheckinDue} onClose={() => setIsCheckinDue(false)} onPlanRegenerated={fetchCurrentPlan} />
    </div>
  );
}
