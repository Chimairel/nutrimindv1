'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import CalorieRing from '@/components/user/CalorieRing';
import MealCard from '@/components/user/MealCard';
import CheckinModal from '@/components/user/CheckinModal';
import { MealPlan, MealType } from '@/types';
import axios from 'axios';

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [currentMeals, setCurrentMeals] = useState<MealPlan[]>([]);
  const [selectedDayOffset, setSelectedDayOffset] = useState(0); // 0 = Today, 1 = Tomorrow, etc.
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Load active plan meals
  const fetchCurrentPlan = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/user/meals/current');
      if (res.data && res.data.success) {
        setCurrentMeals(res.data.data);
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
      if (res.data?.success && res.data.data?.isDue) {
        setIsCheckinDue(true);
      }
    } catch (err) {
      console.error('[Dashboard] Failed to fetch checkin status', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCurrentPlan();
      checkCheckinStatus();
    }
  }, [user]);

  // Handles scheduled meal checkoff toggles
  const handleMealStatusToggle = async (mealPlanId: string, newStatus: 'DONE' | 'PENDING') => {
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
    setIsGenerating(true);
    setError(null);
    try {
      const res = await api.post('/user/meals/generate');
      if (res.data && res.data.success) {
        setCurrentMeals(res.data.data.meals);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Gemini failed to generate standard plan.');
      } else {
        setError('Generation execution failed.');
      }
    } finally {
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
    // Filter scheduled meals matching the selected day offset
    const activeDate = new Date();
    activeDate.setDate(activeDate.getDate() + selectedDayOffset);
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
    const caloriesTarget = dayMeals.reduce((sum, m) => sum + m.calories, 0) || 2000;
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
      <div className="min-h-screen bg-brand-bg flex items-center justify-center">
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

  // Generate 7-day selectors starting from today
  const daySelectors = Array.from({ length: 7 }).map((_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() + idx);
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dateLabel = d.getDate();
    return { offset: idx, dayLabel, dateLabel, dateStr: d.toDateString() };
  });

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text p-6 md:p-12 pb-32 select-none relative">
      <div className="absolute top-[10%] left-[50%] translate-x-[-50%] h-[300px] w-[500px] rounded-full bg-[#52B788]/5 blur-[120px] pointer-events-none -z-10" />

      {/* Main Container */}
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border/60 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-display text-brand-green">
              MABUHAY, {user?.name.split(' ')[0].toUpperCase()}!
            </h1>
            <p className="text-xs text-brand-muted mt-1 uppercase tracking-wider font-bold">
              Personalized Philippine Nutrition & Safe AI Meal Plans
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => router.push('/meals')} className="text-xs font-semibold py-2">
              📅 Weekly Plan
            </Button>
            <Button variant="primary" onClick={() => setIsLogModalOpen(true)} className="text-xs font-bold py-2 shadow-lg shadow-brand-green/10">
              ➕ Log Outside Meal
            </Button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2 text-left">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Empty State / Trigger Plan Generation */}
        {currentMeals.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon="🍽️"
              title="No Active Meal Plan"
              description="You do not have a meal plan scheduled. Generate a customized 7-day plan (21 meals) mapped to your clinical target calories and Filipino food culture."
              actionText="Generate 7-Day Plan"
              onAction={handleGeneratePlan}
            />
          </div>
        ) : (
          <>
            {/* Horizontal Date Switcher */}
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none justify-start md:justify-center">
              {daySelectors.map((item) => {
                const isSelected = selectedDayOffset === item.offset;
                return (
                  <button
                    key={item.offset}
                    onClick={() => setSelectedDayOffset(item.offset)}
                    className={`
                      flex flex-col items-center justify-center p-3 rounded-2xl min-w-[70px] border transition-all duration-200 outline-none
                      ${isSelected 
                        ? 'border-brand-green bg-brand-green/10 text-brand-green shadow-lg shadow-brand-green/5' 
                        : 'border-brand-border bg-brand-surface/40 text-brand-muted hover:text-brand-text'
                      }
                    `}
                  >
                    <span className="text-[10px] uppercase font-bold tracking-wider">{item.dayLabel}</span>
                    <span className="text-lg font-extrabold mt-1 font-display leading-none">{item.dateLabel}</span>
                  </button>
                );
              })}
            </div>

            {/* Analytics Dashboard Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center mt-4">
              
              {/* Calorie Ring Gauge Card */}
              <Card className="p-8 border-brand-border/60 bg-[#1a1a1e]/40 flex items-center justify-center md:col-span-1 min-h-[300px]">
                <CalorieRing consumed={caloriesConsumed} target={caloriesTarget} />
              </Card>

              {/* Macros Target Progress Card */}
              <Card className="p-8 border-brand-border/60 bg-[#1a1a1e]/40 md:col-span-2 min-h-[300px] flex flex-col justify-center gap-6">
                <div>
                  <h3 className="text-sm font-bold tracking-wider text-brand-muted uppercase mb-4">
                    Daily Macronutrient Budgets
                  </h3>
                </div>
                
                {/* Protein Bar */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-brand-green uppercase tracking-wider">Protein</span>
                    <span className="text-brand-text">{Math.round(proteinConsumed)}g / {Math.round(proteinTarget)}g</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-brand-border/40 overflow-hidden">
                    <div 
                      className="h-full bg-brand-green rounded-full transition-all duration-1000" 
                      style={{ width: `${Math.min(100, (proteinConsumed / Math.max(1, proteinTarget)) * 100)}%` }} 
                    />
                  </div>
                </div>

                {/* Carbs Bar */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-amber-500 uppercase tracking-wider">Carbohydrates</span>
                    <span className="text-brand-text">{Math.round(carbsConsumed)}g / {Math.round(carbsTarget)}g</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-brand-border/40 overflow-hidden">
                    <div 
                      className="h-full bg-amber-400 rounded-full transition-all duration-1000" 
                      style={{ width: `${Math.min(100, (carbsConsumed / Math.max(1, carbsTarget)) * 100)}%` }} 
                    />
                  </div>
                </div>

                {/* Fat Bar */}
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-blue-400 uppercase tracking-wider">Fat</span>
                    <span className="text-brand-text">{Math.round(fatConsumed)}g / {Math.round(fatTarget)}g</span>
                  </div>
                  <div className="w-full h-3 rounded-full bg-brand-border/40 overflow-hidden">
                    <div 
                      className="h-full bg-blue-400 rounded-full transition-all duration-1000" 
                      style={{ width: `${Math.min(100, (fatConsumed / Math.max(1, fatTarget)) * 100)}%` }} 
                    />
                  </div>
                </div>
              </Card>
            </div>

            {/* Today's Meals Section */}
            <div className="flex flex-col gap-4 mt-4 text-left">
              <h2 className="text-lg font-extrabold tracking-tight font-display text-brand-green uppercase">
                {selectedDayOffset === 0 ? 'Today\'s' : 'Scheduled'} Menu
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
                    />
                  ))}
                </div>
              )}
            </div>
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
              <span>⚠️</span>
              <span>{logError}</span>
            </div>
          )}

          {/* WARNING SCREEN CASCADE (Acknowledging clinical alerts) */}
          {warningData ? (
            <div className="flex flex-col gap-5">
              <div className="p-4 rounded-xl bg-status-pending-bg/10 border border-status-pending-text/30 text-status-pending-text flex flex-col gap-2.5 leading-relaxed">
                <span className="font-extrabold text-sm flex items-center gap-1.5 uppercase font-display">
                  <span>🚨</span> Clinical Guardrail Alert!
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
                  <div className="bg-brand-green/10 text-brand-green p-2.5 rounded-lg">
                    <span className="text-brand-muted block text-[9px] uppercase mb-0.5">Prot</span>
                    <span>{Math.round(warningData.estimate.proteinG)}g</span>
                  </div>
                  <div className="bg-amber-400/10 text-amber-500 p-2.5 rounded-lg">
                    <span className="text-brand-muted block text-[9px] uppercase mb-0.5">Carb</span>
                    <span>{Math.round(warningData.estimate.carbsG)}g</span>
                  </div>
                  <div className="bg-blue-400/10 text-blue-400 p-2.5 rounded-lg">
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
