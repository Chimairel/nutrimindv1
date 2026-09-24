'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import DashboardSkeleton from '@/features/dashboard/DashboardSkeleton';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { toast } from '@/components/ui/Sonner';
import StateNotice from '@/components/shared/StateNotice';
import CheckinModal from '@/components/user/CheckinModal';
import MealPlanGenerationProgress from '@/components/user/MealPlanGenerationProgress';
import { MealPlan, MealType } from '@/types';
import { getApiErrorMessage } from '@/lib/api-error';
import { Calendar, Plus, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatManilaDate, getManilaDateKey } from '@/lib/manila-date';
import type { UserProfileData } from '@/hooks/useProfile';
import { CockpitDashboard } from '@/features/dashboard/CockpitDashboard';
import { NutritionistGuidanceCard } from '@/features/dashboard/NutritionistGuidanceCard';
import { GroceryPreviewCard } from '@/features/dashboard/GroceryPreviewCard';
import { OutsideMealModal } from '@/features/dashboard/OutsideMealModal';
import {
  calculateDashboardMetrics,
  getDashboardCycleDates,
  type CycleMetaSnapshot,
  type OutsideMealLog,
  type OutsideMealInputItem,
  type OutsideMealWarning,
  type PendingReview,
} from '@/features/dashboard/model';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import { useMealGenerationProgress } from '@/features/meals/useMealGenerationProgress';

interface CurrentPlanSnapshot {
  meals: MealPlan[];
  pendingReview: PendingReview | null;
  planSnapshot: {
    dailyCalorieTarget: number;
    dailyMacroTargets: Record<string, { calories: number; proteinG: number; carbsG: number; fatG: number }>;
  } | null;
  cycle?: CycleMetaSnapshot;
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
  const {
    progress: generationProgress,
    elapsedSeconds: generationElapsedSeconds,
    stageMessage: generationStageMessage,
    begin: beginGenerationProgress,
    complete: completeGenerationProgress,
  } = useMealGenerationProgress(isGenerating);
  const [error, setError] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState<PendingReview | null>(cachedPlan?.pendingReview ?? null);
  const [planSnapshot, setPlanSnapshot] = useState<CurrentPlanSnapshot['planSnapshot']>(
    cachedPlan?.planSnapshot ?? null
  );
  const [currentCycle, setCurrentCycle] = useState<CycleMetaSnapshot>(cachedPlan?.cycle ?? null);
  const generationRequestInFlight = useRef(false);
  const currentPlanRequestInFlight = useRef(false);
  const notifiedPendingReview = useRef(false);

  useEffect(() => {
    if (pendingReview && !notifiedPendingReview.current) {
      notifiedPendingReview.current = true;
      toast.info('Your meal plan is currently in preview while a nutritionist verifies it.', {
        id: 'dashboard-clinical-review-preview',
      });
    }
  }, [pendingReview]);

  // Extract unique scheduledDate values in chronological order, keeping full 7-day cycle with past days visible
  const uniqueDates = React.useMemo(() => {
    return getDashboardCycleDates(currentMeals, pendingReview?.meals ?? [], currentCycle);
  }, [currentMeals, pendingReview, currentCycle]);

  // Sync selected day offset to today if present in the plan
  useEffect(() => {
    if (uniqueDates.length > 0) {
      const todayKey = getManilaDateKey();
      const todayIdx = uniqueDates.findIndex((date) => getManilaDateKey(date) === todayKey);
      const nextIdx = uniqueDates.findIndex((date) => getManilaDateKey(date) > todayKey);
      setSelectedDayOffset(todayIdx !== -1 ? todayIdx : Math.max(0, nextIdx));
    }
  }, [uniqueDates]);

  const activeDashboardPillRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (activeDashboardPillRef.current) {
      activeDashboardPillRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedDayOffset]);

  // Outside Meal Modal State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [logMealName, setLogMealName] = useState('');
  const [logMealType, setLogMealType] = useState<MealType>('BREAKFAST');
  const [logNotes, setLogNotes] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const outsideMealRequestKey = useRef<string | null>(null);

  // Warning Pre-check State
  const [warningData, setWarningData] = useState<OutsideMealWarning | null>(null);
  const [savedSafety, setSavedSafety] = useState<{ status: string; messages: string[] } | null>(null);
  const outsideImageFile = useRef<File | null>(null);

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
      setPlanSnapshot(snapshot.planSnapshot);
      setCurrentCycle(snapshot.cycle ?? null);
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
      console.warn('[Dashboard] Failed to fetch user profile', err);
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
      console.warn('[Dashboard] Failed to fetch outside-meal history', err);
    }
  }, [ownerId]);

  const isReportPending = Boolean(
    (user?.onboardingDone && user?.tosAccepted && !user?.reportAcknowledged) ||
    (error && error.toLowerCase().includes('nutrition report'))
  );

  // Load active plan meals
  const fetchCurrentPlan = useCallback(async () => {
    if (currentPlanRequestInFlight.current) return;
    if (user?.onboardingDone && user?.tosAccepted && !user?.reportAcknowledged) {
      setIsLoading(false);
      return;
    }
    currentPlanRequestInFlight.current = true;
    try {
      const res = await api.get('/user/meals/current');
      if (res.data && res.data.success) {
        setError(null);
        applyCurrentPlan({
          meals: Array.isArray(res.data.data) ? res.data.data : [],
          pendingReview: res.data.meta?.pendingReview ?? null,
          planSnapshot: res.data.meta?.planSnapshot ?? null,
          cycle: res.data.meta?.cycle ?? null,
        });
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, "Failed to load today's scheduled plan."));
    } finally {
      currentPlanRequestInFlight.current = false;
      setIsLoading(false);
    }
  }, [applyCurrentPlan, user]);

  const checkCheckinStatus = useCallback(async () => {
    try {
      const res = await api.get('/user/checkin/status');
      if (res.data?.success) {
        setCheckinInfo(res.data.data);
        setIsCheckinDue(Boolean(res.data.data?.isDue));
        writeSessionResource(ownerId, 'dashboard-checkin', res.data.data);
      }
    } catch (err) {
      console.warn('[Dashboard] Failed to fetch checkin status', err);
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
          planSnapshot: res.data.meta?.planSnapshot ?? null,
          cycle: res.data.meta?.cycle ?? null,
        });
      }
    } catch (err) {
      console.error('[Dashboard] Status toggle failed:', err);
    }
  };

  // Triggers 7-day meal plan generation
  const handleGeneratePlan = async () => {
    if (generationRequestInFlight.current || pendingReview) return;

    generationRequestInFlight.current = true;
    beginGenerationProgress();
    setIsGenerating(true);
    setError(null);
    try {
      const res = await api.post('/user/meals/generate');
      if (res.data && res.data.success) {
        completeGenerationProgress();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 700));
        applyCurrentPlan({
          meals: res.data.data.meals,
          pendingReview: res.data.data.pendingReview ?? null,
          planSnapshot: res.data.data.planSnapshot ?? null,
          cycle: res.data.data.cycle ?? null,
        });
      }
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Gemini failed to generate standard plan.'));
    } finally {
      generationRequestInFlight.current = false;
      setIsGenerating(false);
    }
  };

  // Submits the outside meal log (handles precheck warning cascades)
  const handleLogOutsideMeal = async (
    forceAcknowledge = false,
    options?: {
      useAiEstimate: boolean;
      items: OutsideMealInputItem[];
      consumedAt: string;
      estimationContext: string;
      imageFile: File | null;
    }
  ) => {
    setLogError(null);
    setIsLogging(true);
    try {
      if (!forceAcknowledge) outsideImageFile.current = options?.imageFile ?? null;
      const res = await api.post('/user/meals/log-outside', {
        mealName: logMealName.trim(),
        items: forceAcknowledge ? undefined : options?.items,
        mealType: logMealType,
        useAiEstimate: forceAcknowledge ? undefined : options?.useAiEstimate,
        requestKey: (outsideMealRequestKey.current ??= crypto.randomUUID()),
        warningAcknowledged: forceAcknowledge,
        confirmationId: forceAcknowledge ? warningData?.confirmationId : undefined,
        notes: logNotes.trim(),
        estimationContext: forceAcknowledge ? undefined : options?.estimationContext,
        consumedAt: forceAcknowledge ? undefined : options?.consumedAt,
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
            items: payload.items,
            summary: payload.summary,
            usedAi: payload.usedAi,
          });
        } else {
          // The retrospective fact is committed before the safety follow-up.
          let imageUploadFailed = false;
          if (outsideImageFile.current && payload.log?.id) {
            const form = new FormData();
            form.append('image', outsideImageFile.current);
            try {
              await api.post(`/user/meals/logs/${payload.log.id}/image`, form);
            } catch (imageError) {
              imageUploadFailed = true;
              setLogError(
                getApiErrorMessage(imageError, 'Meal was saved, but the optional photo could not be attached.')
              );
            }
          }
          const followUp = payload.safetyFollowUp as { status: string; messages: string[] } | undefined;
          if (followUp && followUp.status !== 'NO_KNOWN_CONFLICT') setSavedSafety(followUp);
          else if (imageUploadFailed) setSavedSafety({ status: 'NO_KNOWN_CONFLICT', messages: [] });
          else setIsLogModalOpen(false);
          setLogMealName('');
          setLogNotes('');
          setWarningData(null);
          outsideMealRequestKey.current = null;
          outsideImageFile.current = null;
          await Promise.all([fetchCurrentPlan(), fetchOutsideMealLogs()]);
        }
      }
    } catch (err: unknown) {
      setLogError(getApiErrorMessage(err, 'Failed to check outside meal.'));
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

  const activeDate = uniqueDates[selectedDayOffset] ?? new Date();
  const metrics = calculateDashboardMetrics({
    activeDate,
    currentMeals,
    dailyCalorieTarget: planSnapshot?.dailyCalorieTarget ?? userProfile?.dailyCalorieTarget,
    dailyMacroTargets: planSnapshot?.dailyMacroTargets,
    outsideMealLogs,
    pendingMeals: pendingReview?.meals ?? [],
  });
  const todayKey = getManilaDateKey();
  const daySelectors = uniqueDates.map((date, index) => {
    const dateKey = getManilaDateKey(date);
    return {
      offset: index,
      dayLabel: formatManilaDate(date, { weekday: 'short' }),
      dateLabel: formatManilaDate(date, { day: 'numeric' }),
      isPast: dateKey < todayKey,
      isToday: dateKey === todayKey,
    };
  });

  const closeOutsideMealModal = () => {
    setIsLogModalOpen(false);
    setWarningData(null);
    setSavedSafety(null);
    outsideImageFile.current = null;
    outsideMealRequestKey.current = null;
    setLogError(null);
    setLogMealName('');
    setLogNotes('');
  };

  return (
    <div className="portal-page select-none pb-32 text-brand-text">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {error && !error.toLowerCase().includes('nutrition report') ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-left text-sm font-semibold text-status-error-text">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        ) : null}

        {/* Permanent Top Greeting Header */}
        <PortalPageHeader
          title={<>Mabuhay, {user?.name ? user.name.split(' ')[0] : 'Friend'}.</>}
          description="Your meals, daily intake, and next steps — all in one place."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => setIsLogModalOpen(true)}>
                <Plus className="h-4 w-4" /> Log an outside meal
              </Button>
              <Button variant="secondary" onClick={() => router.push('/meals')}>
                <Calendar className="h-4 w-4" /> Weekly plan
              </Button>
            </div>
          }
        />

        {isLoading ? (
          <DashboardSkeleton />
        ) : isReportPending ? (
          <StateNotice
            variant="action-needed"
            description="Please review and acknowledge your personalized nutrition report before meal plans can be generated or viewed."
            action={{
              label: 'View Nutrition Report',
              href: '/profile/nutrition-report',
            }}
          />
        ) : currentMeals.length === 0 && !pendingReview ? (
          <StateNotice
            variant="no-meal-plan"
            title="No Active Meal Plan"
            description="You do not have a meal plan scheduled. Generate an affordable, varied plan shaped by your nutrition needs, preferences, and locally available food choices."
            action={{
              label: isGenerating ? 'Generating Plan...' : 'Generate Meal Plan',
              onClick: handleGeneratePlan,
              isLoading: isGenerating,
            }}
          />
        ) : (
          <>
            {daySelectors.length > 0 && (
              <div
                className="mx-auto flex max-w-full items-center gap-1.5 sm:gap-2 rounded-[24px] border border-brand-border/60 bg-brand-surface/75 p-2 shadow-card"
                aria-label="Meal plan dates"
              >
                <button
                  type="button"
                  onClick={() => {
                    const currentIndex = daySelectors.findIndex((item) => item.offset === selectedDayOffset);
                    if (currentIndex > 0) setSelectedDayOffset(daySelectors[currentIndex - 1].offset);
                  }}
                  disabled={daySelectors.findIndex((item) => item.offset === selectedDayOffset) === 0}
                  className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border border-brand-border/70 bg-brand-bgAlt/60 text-brand-text outline-none transition hover:border-brand-green/30 hover:text-brand-green focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Previous day"
                >
                  <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                </button>

                <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto scrollbar-none snap-x snap-mandatory scroll-smooth">
                  {daySelectors.map((item) => {
                    const isSelected = selectedDayOffset === item.offset;
                    return (
                      <button
                        key={item.offset}
                        ref={isSelected ? activeDashboardPillRef : undefined}
                        onClick={() => setSelectedDayOffset(item.offset)}
                        aria-pressed={isSelected}
                        className={`flex min-w-[66px] sm:min-w-[76px] flex-1 snap-center flex-col items-center justify-center rounded-xl sm:rounded-2xl border px-2 sm:px-4 py-2 sm:py-3 outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg ${
                          isSelected
                            ? 'border-transparent bg-brand-accent text-black font-extrabold shadow-md shadow-brand-accent/20'
                            : item.isPast
                              ? 'border-transparent bg-black/[0.04] text-slate-400 hover:bg-black/[0.07] hover:text-slate-600 dark:bg-white/[0.03] dark:text-zinc-500 dark:hover:bg-white/[0.07] dark:hover:text-zinc-300'
                              : 'border-transparent bg-transparent text-brand-muted hover:bg-brand-bgAlt/60 hover:text-brand-text'
                        }`}
                      >
                        <span className="flex items-center gap-1 text-[8px] sm:text-[9px] font-extrabold uppercase tracking-[0.14em]">
                          {item.dayLabel}
                          {item.isToday && !isSelected && (
                            <span className="h-1.5 w-1.5 rounded-full bg-brand-green" title="Today" />
                          )}
                        </span>
                        <span className="mt-0.5 sm:mt-1 font-display text-lg sm:text-xl font-black leading-none">
                          {item.dateLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const currentIndex = daySelectors.findIndex((item) => item.offset === selectedDayOffset);
                    if (currentIndex >= 0 && currentIndex < daySelectors.length - 1) {
                      setSelectedDayOffset(daySelectors[currentIndex + 1].offset);
                    }
                  }}
                  disabled={
                    daySelectors.findIndex((item) => item.offset === selectedDayOffset) === daySelectors.length - 1
                  }
                  className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl border border-brand-border/70 bg-brand-bgAlt/60 text-brand-text outline-none transition hover:border-brand-green/30 hover:text-brand-green focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label="Next day"
                >
                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                </button>
              </div>
            )}

            <CockpitDashboard
              activeDate={activeDate}
              meals={metrics.mealsList}
              pendingMeals={
                pendingReview?.meals.filter(
                  (meal) => activeDate && getManilaDateKey(meal.scheduledDate) === getManilaDateKey(activeDate)
                ) ?? []
              }
              metrics={metrics}
              profile={userProfile}
              waterIntake={waterIntake}
              checkinStreak={checkinInfo?.streak ?? 0}
              checkinDue={isCheckinDue}
              onAddWater={handleAddWater}
              onOpenCheckin={() => setIsCheckinDue(true)}
              onMealClick={(mealId) => router.push(`/dashboard/${mealId}`)}
              onStatusToggle={handleMealStatusToggle}
              onOpenWeeklyPlan={() => router.push('/meals')}
            />

            <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-2">
              <NutritionistGuidanceCard isPendingReview={Boolean(pendingReview)} />
              <GroceryPreviewCard ownerId={ownerId} onNavigateToGrocery={() => router.push('/grocery')} />
            </div>
          </>
        )}
      </div>

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
        onWarningCancel={() => {
          setWarningData(null);
          outsideMealRequestKey.current = null;
        }}
        warning={warningData}
        savedSafety={savedSafety}
      />

      <CheckinModal isOpen={isCheckinDue} onClose={() => setIsCheckinDue(false)} />
    </div>
  );
}
