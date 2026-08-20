'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import CalorieRing from '@/components/user/CalorieRing';
import MealCard from '@/components/user/MealCard';
import PendingMealPreviewCard, { PendingMealPreview } from '@/components/user/PendingMealPreviewCard';
import CheckinModal from '@/components/user/CheckinModal';
import { MealPlan, MealType } from '@/types';
import axios from 'axios';
import { Calendar, Plus, AlertTriangle, AlertCircle, Utensils, Droplets, Flame, Scale, Clock3, Sparkles } from 'lucide-react';


export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [currentMeals, setCurrentMeals] = useState<MealPlan[]>([]);
  const [selectedDayOffset, setSelectedDayOffset] = useState(0); // Index of selected date in uniqueDates
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState<{
    mealCount: number;
    planType: 'STARTER' | 'WEEKLY';
    reviewStatus: 'PENDING_REVIEW';
    meals: PendingMealPreview[];
  } | null>(null);
  const generationRequestInFlight = useRef(false);

  // Extract unique scheduledDate values in chronological order
  const uniqueDates = React.useMemo(() => {
    const scheduledMeals = currentMeals.length > 0
      ? currentMeals
      : pendingReview?.meals ?? [];

    if (scheduledMeals.length === 0) return [];
    const dateStrings = Array.from(
      new Set(scheduledMeals.map((meal) => new Date(meal.scheduledDate).toDateString()))
    );
    return dateStrings.map((dStr) => new Date(dStr)).sort((a, b) => a.getTime() - b.getTime());
  }, [currentMeals, pendingReview]);

  // Sync selected day offset to today if present in the plan
  useEffect(() => {
    if (uniqueDates.length > 0) {
      const todayStr = new Date().toDateString();
      const todayIdx = uniqueDates.findIndex((d) => d.toDateString() === todayStr);
      if (todayIdx !== -1) {
        setSelectedDayOffset(todayIdx);
      } else {
        setSelectedDayOffset(0);
      }
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
  const [warningData, setWarningData] = useState<{
    warnings: string[];
    reasons: string[];
    estimate: { calories: number; proteinG: number; carbsG: number; fatG: number };
  } | null>(null);

  // Check-in status
  const [isCheckinDue, setIsCheckinDue] = useState(false);
  const [checkinInfo, setCheckinInfo] = useState<{ isDue: boolean; streak: number; lastCheckinAt: string | null } | null>(null);
  
  // User Profile details
  const [userProfile, setUserProfile] = useState<any>(null);

  // Water intake state
  const [waterIntake, setWaterIntake] = useState(0);

  // Fetch user profile metrics
  const fetchProfile = async () => {
    try {
      const res = await api.get('/user/profile');
      if (res.data?.success) {
        setUserProfile(res.data.data.userProfile);
      }
    } catch (err) {
      console.error('[Dashboard] Failed to fetch user profile', err);
    }
  };

  // Sync water intake from localStorage on client-side mount
  useEffect(() => {
    const savedWater = localStorage.getItem('nutrimind_water_intake');
    if (savedWater) {
      setWaterIntake(parseInt(savedWater, 10));
    }
  }, []);

  const handleAddWater = (amount: number) => {
    const nextWater = Math.max(0, waterIntake + amount);
    setWaterIntake(nextWater);
    localStorage.setItem('nutrimind_water_intake', String(nextWater));
  };

  // Load active plan meals
  const fetchCurrentPlan = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/user/meals/current');
      if (res.data && res.data.success) {
        setCurrentMeals(res.data.data);
        setPendingReview(res.data.meta?.pendingReview ?? null);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to load today\'s scheduled plan.');
      } else {
        setError('Failed to contact backend API.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const checkCheckinStatus = async () => {
    try {
      const res = await api.get('/user/checkin/status');
      if (res.data?.success) {
        setCheckinInfo(res.data.data);
        if (res.data.data?.isDue) {
          setIsCheckinDue(true);
        }
      }
    } catch (err) {
      console.error('[Dashboard] Failed to fetch checkin status', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCurrentPlan();
      checkCheckinStatus();
      fetchProfile();
    }
  }, [user]);

  // Handles scheduled meal checkoff toggles
  const handleMealStatusToggle = async (mealPlanId: string, newStatus: 'DONE' | 'SKIPPED' | 'PENDING') => {
    try {
      await api.patch(`/user/meals/${mealPlanId}/status`, { status: newStatus });
      // Fetch plan again to sync local UI check marks and total calories
      const res = await api.get('/user/meals/current');
      if (res.data && res.data.success) {
        setCurrentMeals(res.data.data);
      }
    } catch (err) {
      console.error('[Dashboard] Status toggle failed:', err);
    }
  };

  // Triggers 7-day meal plan generation
  const handleGeneratePlan = async () => {
    if (generationRequestInFlight.current || pendingReview) return;

    generationRequestInFlight.current = true;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await api.post('/user/meals/generate');
      if (res.data && res.data.success) {
        setCurrentMeals(res.data.data.meals);
        setPendingReview(res.data.data.pendingReview ?? null);
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
        notes: logNotes.trim(),
      });

      if (res.data && res.data.success) {
        const payload = res.data.data;
        if (payload.warningRequired) {
          // Warning detected: trigger conflict view
          setWarningData({
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
          fetchCurrentPlan();
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

  // Calorie & Macros analytics calculations
  const calculateDailyAverages = () => {
    // Filter scheduled meals matching the selected day offset from uniqueDates
    const activeDate = uniqueDates[selectedDayOffset] || new Date();
    const dateStr = activeDate.toDateString();

    const dayMeals = currentMeals.filter(
      (m) => new Date(m.scheduledDate).toDateString() === dateStr
    );

    // Sum calories logged as DONE today
    const caloriesConsumed = dayMeals
      .filter((m) => m.mealLogs?.some((log) => log.status === 'DONE'))
      .reduce((sum, m) => sum + m.calories, 0);

    const proteinConsumed = dayMeals
      .filter((m) => m.mealLogs?.some((log) => log.status === 'DONE'))
      .reduce((sum, m) => sum + m.proteinG, 0);

    const carbsConsumed = dayMeals
      .filter((m) => m.mealLogs?.some((log) => log.status === 'DONE'))
      .reduce((sum, m) => sum + m.carbsG, 0);

    const fatConsumed = dayMeals
      .filter((m) => m.mealLogs?.some((log) => log.status === 'DONE'))
      .reduce((sum, m) => sum + m.fatG, 0);

    // Targets
    const caloriesTarget = dayMeals.reduce((sum, m) => sum + m.calories, 0)
      || userProfile?.dailyCalorieTarget
      || 2000;
    const proteinTarget = dayMeals.reduce((sum, m) => sum + m.proteinG, 0) || 120;
    const carbsTarget = dayMeals.reduce((sum, m) => sum + m.carbsG, 0) || 220;
    const fatTarget = dayMeals.reduce((sum, m) => sum + m.fatG, 0) || 60;

    return {
      mealsList: dayMeals,
      caloriesConsumed,
      caloriesTarget,
      proteinConsumed,
      proteinTarget,
      carbsConsumed,
      carbsTarget,
      fatConsumed,
      fatTarget,
    };
  };

  if (isLoading || isGenerating) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-brand-muted animate-pulse font-display font-semibold">
            {isGenerating ? 'Compiling AI 7-day Filipino meal plan...' : 'Synchronizing dynamic clinical context...'}
          </p>
        </div>
      </div>
    );
  }

  const {
    mealsList,
    caloriesConsumed,
    caloriesTarget,
    proteinConsumed,
    proteinTarget,
    carbsConsumed,
    carbsTarget,
    fatConsumed,
    fatTarget,
  } = calculateDailyAverages();

  // Generate selectors from the actual dates in the active plan group
  const daySelectors = uniqueDates.map((d, idx) => {
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dateLabel = d.getDate();
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dCopy = new Date(d);
    dCopy.setHours(0, 0, 0, 0);
    const isPast = dCopy.getTime() < today.getTime();

    return { offset: idx, dayLabel, dateLabel, dateStr: d.toDateString(), isPast };
  });

  const activePendingDate = uniqueDates[selectedDayOffset];
  const pendingMealsForSelectedDate = pendingReview?.meals.filter(
    (meal) => activePendingDate
      && new Date(meal.scheduledDate).toDateString() === activePendingDate.toDateString()
  ) ?? [];

  return (
    <div className="portal-page select-none pb-32 text-brand-text">

      {/* Main Container */}
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Welcome Header */}
        <PortalPageHeader
          icon={Sparkles}
          eyebrow="Daily nutrition cockpit"
          title={<>Mabuhay, {user?.name.split(' ')[0]}.</>}
          description="Your Filipino meal plan, daily targets, and review-aware nutrition progress in one connected view."
          actions={
            <Button variant="primary" onClick={() => router.push('/meals')} className="flex items-center gap-2 text-xs font-bold">
              <Calendar className="w-4 h-4" />
              <span>Open weekly plan</span>
            </Button>
          }
        />

        {error && (
          <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2 text-left">
            <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty State / Dashboard */}
        {currentMeals.length === 0 && !pendingReview ? (
          <div className="py-12">
            <EmptyState
              icon={<Utensils className="h-8 w-8 text-brand-green" />}
              title="No Active Meal Plan"
              description="You do not have a meal plan scheduled. Generate a customized plan mapped to your clinical target calories and Filipino food culture."
              actionText="Generate Meal Plan"
              onAction={handleGeneratePlan}
            />
          </div>
        ) : (
          <>
            {/* Horizontal Date Switcher */}
            {uniqueDates.length > 0 && (
              <div className="mx-auto flex max-w-full gap-1.5 overflow-x-auto rounded-[24px] border border-brand-border/60 bg-brand-surface/75 p-2 shadow-card scrollbar-none" aria-label="Meal plan dates">
                {daySelectors.map((item) => {
                  const isSelected = selectedDayOffset === item.offset;
                  return (
                    <button
                      key={item.offset}
                      onClick={() => setSelectedDayOffset(item.offset)}
                      aria-pressed={isSelected}
                      className={`
                        flex min-w-[76px] flex-col items-center justify-center rounded-2xl border px-4 py-3 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg
                        ${isSelected
                          ? 'border-brand-border bg-brand-accent text-black shadow-md shadow-brand-accent/10'
                          : item.isPast
                            ? 'border-transparent bg-brand-bgAlt/70 text-brand-muted/70 hover:border-brand-border hover:text-brand-text'
                            : 'border-transparent bg-transparent text-brand-muted hover:border-brand-border hover:bg-brand-bgAlt/60 hover:text-brand-text'
                        }
                      `}
                    >
                      <span className="text-[9px] font-extrabold uppercase tracking-[0.14em]">{item.dayLabel}</span>
                      <span className="mt-1 font-display text-xl font-black leading-none">{item.dateLabel}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Daily Wellness Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mt-2">
              
              {/* Check-In Streak Card */}
              <Card
                className="min-h-[160px] border border-brand-border/60 bg-brand-surface hover:border-brand-green/25 hover:shadow-card-hover"
                contentClassName="flex h-full min-h-[160px] flex-col justify-between p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-muted">Check-In Streak</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-300">
                    <Flame className="h-4.5 w-4.5" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-2">
                  <h4 className="text-2xl font-black font-display text-brand-text">
                    {checkinInfo?.streak ?? 0} {(checkinInfo?.streak ?? 0) === 1 ? 'Week' : 'Weeks'}
                  </h4>
                  <p className="text-xs text-brand-muted mt-1">
                    {isCheckinDue ? 'Your weekly check-in is due today!' : 'Streak active. Keep logging!'}
                  </p>
                </div>
                {isCheckinDue && (
                  <Button 
                    variant="accent" 
                    size="sm" 
                    onClick={() => setIsCheckinDue(true)} 
                    className="w-full mt-3 font-bold text-xs"
                  >
                    Complete Check-In
                  </Button>
                )}
              </Card>

              {/* Weight Progress Card */}
              <Card
                className="min-h-[160px] border border-brand-border/60 bg-brand-surface hover:border-brand-green/25 hover:shadow-card-hover"
                contentClassName="flex h-full min-h-[160px] flex-col justify-between p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-muted">Weight Goals</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-green/20 bg-brand-green/10 text-brand-green">
                    <Scale className="h-4.5 w-4.5" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex items-baseline gap-2">
                    <h4 className="text-2xl font-black font-display text-brand-text">
                      {userProfile?.weightKg ?? '--'} <span className="text-xs font-bold text-brand-muted">kg</span>
                    </h4>
                    {userProfile?.targetWeightKg && (
                      <span className="text-xs font-semibold text-brand-muted">
                        target: {userProfile.targetWeightKg} kg
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-brand-muted mt-1">
                    {userProfile?.weightKg && userProfile?.targetWeightKg ? (
                      (() => {
                        const diff = userProfile.weightKg - userProfile.targetWeightKg;
                        if (diff > 0) return `${diff.toFixed(1)} kg to target`;
                        if (diff < 0) return `${Math.abs(diff).toFixed(1)} kg to target`;
                        return 'Target weight reached!';
                      })()
                    ) : (
                      'Log weight to track progress'
                    )}
                  </p>
                </div>
              </Card>

              {/* Water Intake Tracker */}
              <Card
                className="min-h-[160px] border border-brand-border/60 bg-brand-surface hover:border-blue-500/25 hover:shadow-card-hover"
                contentClassName="flex h-full min-h-[160px] flex-col justify-between p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-muted">Water Intake</span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-300">
                    <Droplets className="h-4.5 w-4.5" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-2">
                  <h4 className="text-2xl font-black font-display text-brand-text">
                    {waterIntake} <span className="text-xs font-bold text-brand-muted">/ 2500 mL</span>
                  </h4>
                  {/* Progress bar */}
                  <div className="w-full bg-brand-bgAlt h-1.5 rounded-full overflow-hidden mt-2">
                    <div 
                      className="bg-blue-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (waterIntake / 2500) * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button 
                    onClick={() => handleAddWater(-250)}
                    className="flex-1 py-1 px-3 text-xs font-bold rounded-lg border border-brand-border bg-brand-surface text-brand-text hover:bg-brand-bgAlt transition-colors"
                  >
                    -250mL
                  </button>
                  <button 
                    onClick={() => handleAddWater(250)}
                    className="flex-1 py-1 px-3 text-xs font-bold rounded-lg border border-transparent bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                  >
                    +250mL
                  </button>
                </div>
              </Card>

            </div>

            {/* Analytics Dashboard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center mt-4">
              
              {/* Calorie Ring Gauge Card */}
              <Card
                className="min-h-[300px] border border-brand-border/60 bg-brand-surface md:col-span-1"
                contentClassName="flex min-h-[300px] items-center justify-center p-6"
              >
                <CalorieRing consumed={caloriesConsumed} target={caloriesTarget} />
              </Card>

              {/* Macros Target Progress Card */}
              <Card
                className="relative min-h-[300px] border border-brand-border/60 bg-brand-surface md:col-span-2 !overflow-visible"
                contentClassName="flex min-h-[300px] flex-col justify-center gap-6 p-6 md:p-8"
              >
                <div>
                  <h3 className="text-sm font-bold tracking-wider text-brand-muted uppercase mb-4">
                    Daily Macronutrient Budgets
                  </h3>
                </div>
                
                {/* Protein Bar */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="uppercase tracking-wider font-extrabold" style={{ color: 'var(--macro-protein)' }}>Protein</span>
                    <span className="text-brand-text">{Math.round(proteinConsumed)}g / {Math.round(proteinTarget)}g</span>
                  </div>
                  <div 
                    className="w-full h-4 rounded-full border-2 border-brand-border overflow-hidden"
                    style={{ backgroundColor: 'var(--macro-track-bg)' }}
                  >
                    <div 
                      className="h-full rounded-full transition-all duration-1000" 
                      style={{ 
                        width: `${Math.min(100, (proteinConsumed / Math.max(1, proteinTarget)) * 100)}%`,
                        backgroundColor: 'var(--macro-protein)'
                      }} 
                    />
                  </div>
                </div>

                {/* Carbs Bar */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="uppercase tracking-wider font-extrabold" style={{ color: 'var(--macro-carbs)' }}>Carbohydrates</span>
                    <span className="text-brand-text">{Math.round(carbsConsumed)}g / {Math.round(carbsTarget)}g</span>
                  </div>
                  <div 
                    className="w-full h-4 rounded-full border-2 border-brand-border overflow-hidden"
                    style={{ backgroundColor: 'var(--macro-track-bg)' }}
                  >
                    <div 
                      className="h-full rounded-full transition-all duration-1000" 
                      style={{ 
                        width: `${Math.min(100, (carbsConsumed / Math.max(1, carbsTarget)) * 100)}%`,
                        backgroundColor: 'var(--macro-carbs)'
                      }} 
                    />
                  </div>
                </div>

                {/* Fat Bar */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="uppercase tracking-wider font-extrabold" style={{ color: 'var(--macro-fat)' }}>Fat</span>
                    <span className="text-brand-text">{Math.round(fatConsumed)}g / {Math.round(fatTarget)}g</span>
                  </div>
                  <div 
                    className="w-full h-4 rounded-full border-2 border-brand-border overflow-hidden"
                    style={{ backgroundColor: 'var(--macro-track-bg)' }}
                  >
                    <div 
                      className="h-full rounded-full transition-all duration-1000" 
                      style={{ 
                        width: `${Math.min(100, (fatConsumed / Math.max(1, fatTarget)) * 100)}%`,
                        backgroundColor: 'var(--macro-fat)'
                      }} 
                    />
                  </div>
                </div>

                {/* Floating Log Outside Meal Circular Button */}
                <div className="absolute bottom-0 translate-y-1/2 right-6 md:right-8 z-10">
                  <button
                    onClick={() => setIsLogModalOpen(true)}
                    className="h-14 w-14 md:h-16 md:w-16 rounded-full border border-brand-border bg-brand-accent text-black shadow-lg shadow-brand-accent/10 flex items-center justify-center hover:scale-105 active:scale-95 transition-all duration-200 hover-pulse outline-none"
                    title="Log Outside Meal"
                  >
                    <Plus className="w-8 h-8 stroke-[3px]" />
                  </button>
                </div>
              </Card>
            </div>

            {pendingReview && currentMeals.length === 0 ? (
              <section className="mt-4 flex flex-col gap-6" aria-labelledby="pending-plan-heading">
                <div className="relative overflow-hidden rounded-[28px] border border-brand-green/20 bg-gradient-to-br from-brand-surface via-brand-surface to-brand-green/10 p-5 text-left shadow-card md:p-6">
                  <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-brand-accent/15 blur-3xl" aria-hidden="true" />
                  <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
                    <div className="max-w-2xl">
                      <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-green">
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                        AI plan generated
                      </div>
                      <h2 id="pending-plan-heading" className="mt-2 font-display text-2xl font-black tracking-tight text-brand-text">
                        Review in progress
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                        Preview the {pendingMealsForSelectedDate.length} meals scheduled for this date while a nutritionist reviews your full {pendingReview.mealCount}-meal {pendingReview.planType === 'STARTER' ? 'starter' : 'weekly'} plan.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-status-pending-text/20 bg-status-pending-bg/40 px-4 py-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-status-pending-text text-white">
                        <Clock3 className="h-4.5 w-4.5" aria-hidden="true" />
                      </div>
                      <div>
                        <p className="text-[9px] font-extrabold uppercase tracking-wider text-status-pending-text">Selected day</p>
                        <p className="text-xs font-extrabold text-brand-text">
                          {activePendingDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="relative mt-4 flex items-start gap-2 border-t border-brand-border/50 pt-4 text-status-pending-text">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <p className="text-[11px] font-semibold leading-relaxed">
                      Pending estimates are preview-only and are not included in the calorie or macronutrient trackers above.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {pendingMealsForSelectedDate.map((meal, index) => (
                    <PendingMealPreviewCard
                      key={`${meal.scheduledDate}-${meal.mealType}-${index}`}
                      meal={meal}
                    />
                  ))}
                </div>
              </section>
            ) : (
              /* Today's Meals Section */
              <div className="flex flex-col gap-4 mt-4 text-left">
                <h2 className="text-lg font-extrabold tracking-tight font-display text-brand-text uppercase">
                  {(() => {
                    const activeDate = uniqueDates[selectedDayOffset];
                    const isTodaySelected = activeDate && activeDate.toDateString() === new Date().toDateString();
                    return isTodaySelected ? "Today's" : "Scheduled";
                  })()} Menu
                </h2>

                {mealsList.length === 0 ? (
                  <Card className="p-8 text-center text-brand-muted border-brand-border/40 bg-brand-surface/20">
                    No meals scheduled for this day offset.
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {mealsList.map((meal) => (
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
                        scheduledDate={meal.scheduledDate}
                        onCardClick={() => router.push(`/dashboard/${meal.id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* --- LOG OUTSIDE MEAL MODAL --- */}
      <Modal isOpen={isLogModalOpen} onClose={() => {
        setIsLogModalOpen(false);
        setWarningData(null);
        setLogError(null);
        setLogMealName('');
        setLogNotes('');
      }} title="LOG OUTSIDE MEAL">
        <div className="flex flex-col gap-5 p-2 text-left">
          
           {logError && (
            <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
              <span>{logError}</span>
            </div>
          )}

          {/* WARNING SCREEN CASCADE (Acknowledging clinical alerts) */}
          {warningData ? (
            <div className="flex flex-col gap-5">
              <div className="p-4 rounded-xl bg-status-pending-bg/10 border border-status-pending-text/30 text-status-pending-text flex flex-col gap-2.5 leading-relaxed">
                <span className="font-extrabold text-sm flex items-center gap-1.5 uppercase font-display">
                  <AlertCircle className="w-4 h-4 text-status-pending-text shrink-0" /> Clinical Guardrail Alert!
                </span>
                <ul className="flex flex-col gap-2 list-disc pl-4 text-xs font-semibold">
                  {warningData.reasons.map((reason, rIdx) => (
                    <li key={rIdx}>{reason}</li>
                  ))}
                </ul>
              </div>

              {/* Estimate Macros Details */}
              <Card className="p-5 border-brand-border/60 bg-brand-bgAlt/50 flex flex-col gap-3">
                <h4 className="text-[10px] tracking-wider font-extrabold text-brand-muted uppercase font-display">
                  AI Nutrition Estimates
                </h4>
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
                  <div className="bg-brand-border/30 p-2.5 rounded-lg">
                    <span className="text-brand-muted block text-[9px] uppercase mb-0.5">Cal</span>
                    <span>{Math.round(warningData.estimate.calories)}</span>
                  </div>
                  <div 
                    className="p-2.5 rounded-lg border border-brand-border/20"
                    style={{ 
                      backgroundColor: 'var(--macro-protein-bg)',
                      color: 'var(--macro-protein)'
                    }}
                  >
                    <span className="text-brand-muted block text-[9px] uppercase mb-0.5">Prot</span>
                    <span>{Math.round(warningData.estimate.proteinG)}g</span>
                  </div>
                  <div 
                    className="p-2.5 rounded-lg border border-brand-border/20"
                    style={{ 
                      backgroundColor: 'var(--macro-carbs-bg)',
                      color: 'var(--macro-carbs)'
                    }}
                  >
                    <span className="text-brand-muted block text-[9px] uppercase mb-0.5">Carb</span>
                    <span>{Math.round(warningData.estimate.carbsG)}g</span>
                  </div>
                  <div 
                    className="p-2.5 rounded-lg border border-brand-border/20"
                    style={{ 
                      backgroundColor: 'var(--macro-fat-bg)',
                      color: 'var(--macro-fat)'
                    }}
                  >
                    <span className="text-brand-muted block text-[9px] uppercase mb-0.5">Fat</span>
                    <span>{Math.round(warningData.estimate.fatG)}g</span>
                  </div>
                </div>
              </Card>

              <div className="flex gap-3 mt-2">
                <Button
                  variant="secondary"
                  className="flex-1 font-bold text-xs"
                  onClick={() => setWarningData(null)}
                  disabled={isLogging}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="flex-1 font-bold text-xs bg-red-500 hover:bg-red-600 border-red-500/20 text-white shadow-xl shadow-red-500/10"
                  onClick={() => handleLogOutsideMeal(true)}
                  isLoading={isLogging}
                >
                  Log Anyway
                </Button>
              </div>
            </div>
          ) : (
            /* REGULAR FORM INPUT */
            <form onSubmit={(e) => { e.preventDefault(); handleLogOutsideMeal(false); }} className="flex flex-col gap-5">
              <Input
                id="mealName"
                label="Meal Name"
                type="text"
                placeholder="e.g. Pork Adobo with Hard Boiled Egg"
                value={logMealName}
                onChange={(e) => setLogMealName(e.target.value)}
                disabled={isLogging}
                required
              />

              {/* Meal Type Select Chips */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold tracking-wide text-brand-text/90">
                  Meal Category
                </label>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold">
                  {(['BREAKFAST', 'LUNCH', 'DINNER'] as MealType[]).map((type) => {
                    const isSelected = logMealType === type;
                    const labels: Record<MealType, string> = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner', SNACK: 'Snack' };
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setLogMealType(type)}
                        className={`
                          py-2.5 rounded-xl border transition-all duration-200 outline-none
                          ${isSelected 
                            ? 'border-brand-green bg-brand-green/10 text-brand-green font-bold' 
                            : 'border-brand-border bg-brand-surface/40 text-brand-muted hover:text-brand-text'
                          }
                        `}
                      >
                        {labels[type]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Input
                id="notes"
                label="Notes / Serving Size (Optional)"
                type="text"
                placeholder="e.g. Ate at Jollibee, standard chicken portion"
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                disabled={isLogging}
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full py-3.5 mt-2 text-xs font-bold tracking-wider"
                disabled={!logMealName.trim()}
                isLoading={isLogging}
              >
                Log Meal Log
              </Button>
            </form>
          )}
        </div>
      </Modal>

      <CheckinModal 
        isOpen={isCheckinDue} 
        onClose={() => setIsCheckinDue(false)} 
        onPlanRegenerated={() => {
          fetchCurrentPlan();
        }}
      />
    </div>
  );
}
