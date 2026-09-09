'use client';

import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import MealPlanGenerationProgress from '@/components/user/MealPlanGenerationProgress';
import EmptyState from '@/components/shared/EmptyState';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import MealCard from '@/components/user/MealCard';
import PendingMealPreviewCard from '@/components/user/PendingMealPreviewCard';
import {
  Sprout,
  Calendar,
  History,
  BookOpen,
  RefreshCw,
  AlertTriangle,
  Search,
  FileText,
  Salad,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  Sparkles,
  CircleCheckBig,
  Repeat2,
  ListChecks,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { formatManilaDate, manilaDateFromKey } from '@/lib/manila-date';

import { useMealsWorkspace } from '@/features/meals/useMealsWorkspace';
import { MealsWorkspaceModals } from '@/features/meals/MealsWorkspaceModals';
import MotionActiveIndicator from '@/components/ui/motion/MotionActiveIndicator';

export default function WeeklyPlanPage() {
  const workspace = useMealsWorkspace();
  const {
    activeTab,
    setActiveTab,
    meals,
    isLoading,
    isRegenerating,
    regenerationProgress,
    error,
    pendingReview,
    setSelectedPlanDateKey,
    swapsUsed,
    swapCap,
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
    libraryMeals,
    isLibraryLoading,
    libraryTotalCount,
    libraryError,
    librarySearch,
    setLibrarySearch,
    setSelectedVerifier,
    libraryMealType,
    setLibraryMealType,
    handleSwapClick,
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
  } = workspace;

  if (isRegenerating) {
    return (
      <MealPlanGenerationProgress
        progress={regenerationProgress.progress}
        elapsedSeconds={regenerationProgress.elapsedSeconds}
        stageMessage={regenerationProgress.stageMessage}
      />
    );
  }

  if (isLoading) return <PortalLoadingState message="Analyzing weekly schedule..." />;

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
              Your full 7-day plan begins on <span className="font-semibold text-brand-text/80">{nextCycleDay}</span>,
              matching your preferred shopping day.
            </p>
          </div>
        )}

        {/* Header Block */}
        <PortalPageHeader
          icon={activeTab === 'plan' && isStarterPlan ? Sprout : activeTab === 'history' ? History : BookOpen}
          eyebrow={
            activeTab === 'plan'
              ? 'Personal meal intelligence'
              : activeTab === 'history'
                ? 'Nutrition timeline'
                : 'Verified collection'
          }
          title={
            activeTab === 'plan'
              ? isStarterPlan
                ? 'Starter meal plan'
                : 'Weekly meal plan'
              : activeTab === 'history'
                ? 'Meal history'
                : 'Meal library'
          }
          description={
            activeTab === 'plan'
              ? isStarterPlan
                ? `${displayedPlanDays.length}-day kickoff plan. Your full weekly cycle starts ${nextCycleDay}.`
                : 'Your complete scheduled breakdown, macro targets, and meal review states.'
              : activeTab === 'history'
                ? 'Your logged intake history, completion states, and swapped items.'
                : 'Browse compatible, nutritionist-verified recipes for your profile.'
          }
          className="mb-1"
          meta={
            activeTab === 'plan' && meals.length > 0 ? (
              <span className="font-mono text-[9px] uppercase tracking-wider text-white/45">
                {swapsUsed} of {swapCap} swaps used
              </span>
            ) : undefined
          }
          actions={
            activeTab === 'plan' ? (
              pendingReview ? (
                <Badge variant="pending" className="px-3 py-2">
                  Pending verification
                </Badge>
              ) : (
                <Button
                  variant="primary"
                  onClick={handleRegeneratePlan}
                  className="flex items-center gap-1.5 bg-red-500 text-xs font-bold text-white hover:bg-red-600"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate plan</span>
                </Button>
              )
            ) : undefined
          }
        />

        {/* Tab Bar */}
        <nav
          className="grid grid-cols-3 gap-1 rounded-[22px] border border-brand-border/70 bg-brand-surface/85 p-1.5 text-left shadow-sm"
          aria-label="Meal workspace sections"
        >
          {(
            [
              ['plan', 'Plan', Calendar, displayedMealCount],
              ['history', 'History', History, historyTotalCount ?? '…'],
              ['library', 'Library', BookOpen, libraryTotalCount ?? '…'],
            ] as const
          ).map(([value, label, Icon, count]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              aria-current={activeTab === value ? 'page' : undefined}
              className={`group relative flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 font-display text-xs font-extrabold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-surface sm:text-sm ${
                activeTab === value
                  ? 'text-[#07100d]'
                  : 'text-brand-muted hover:bg-brand-bgAlt/70 hover:text-brand-text'
              }`}
            >
              {activeTab === value && (
                <MotionActiveIndicator
                  layoutId="meals-workspace-tab-indicator"
                  className="rounded-2xl bg-brand-accent shadow-neon"
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{label}</span>
                <span
                  className={`hidden rounded-full px-1.5 py-0.5 font-mono text-[8px] sm:inline ${
                    activeTab === value ? 'bg-[#07100d]/10' : 'bg-brand-bgAlt'
                  }`}
                >
                  {count}
                </span>
              </span>
            </button>
          ))}
        </nav>

        {activeTab === 'plan' && displayedMealCount > 0 && (
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Scheduled meals', value: displayedMealCount, icon: ListChecks },
              { label: 'Plan days', value: displayedPlanDays.length, icon: Calendar },
              {
                label: pendingReview ? 'Awaiting review' : 'Completed',
                value: pendingReview ? pendingReview.mealCount : completedMealCount,
                icon: pendingReview ? ShieldCheck : CircleCheckBig,
              },
              { label: 'Swaps available', value: remainingSwapCount, icon: Repeat2 },
            ].map((metric) => {
              const MetricIcon = metric.icon;
              return (
                <div
                  key={metric.label}
                  className="rounded-[20px] border border-brand-border/70 bg-brand-surface p-4 shadow-sm"
                >
                  <MetricIcon className="h-4 w-4 text-brand-green" />
                  <p className="mt-4 font-display text-2xl font-black text-brand-text">{metric.value}</p>
                  <p className="mt-1 text-[10px] font-semibold text-brand-muted">{metric.label}</p>
                </div>
              );
            })}
          </section>
        )}

        {activeTab === 'plan' && displayedPlanDays.length > 0 && selectedPlanDay && (
          <section
            className="rounded-[26px] border border-brand-border/70 bg-brand-surface/85 p-2 shadow-card"
            aria-label="Select a meal-plan day"
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setSelectedPlanDateKey(
                    displayedPlanDays[selectedPlanDayIndex - 1]?.dateKey ?? selectedPlanDay.dateKey
                  )
                }
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
                      className={`group relative flex min-w-[88px] flex-1 flex-col items-center justify-center rounded-2xl border px-3 py-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-green ${
                        isSelected
                          ? 'border-brand-accent text-[#07100d]'
                          : 'border-transparent text-brand-muted hover:border-brand-border hover:bg-brand-bgAlt/70 hover:text-brand-text'
                      }`}
                    >
                      {isSelected && (
                        <MotionActiveIndicator
                          layoutId="meals-day-selector-indicator"
                          className="rounded-2xl bg-brand-accent shadow-neon"
                        />
                      )}
                      <span className="relative z-10 flex flex-col items-center justify-center w-full">
                        <span className="text-[9px] font-extrabold uppercase tracking-[0.14em]">
                          {formatManilaDate(parsedDate, { weekday: 'short' })}
                        </span>
                        <span className="mt-0.5 font-display text-lg font-black leading-none">
                          {formatManilaDate(parsedDate, { day: 'numeric' })}
                        </span>
                        <span
                          className={`mt-1 font-mono text-[8px] font-bold uppercase tracking-wider ${
                            isSelected ? 'text-[#07100d]/60' : 'text-brand-muted/70'
                          }`}
                        >
                          Day {index + 1}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedPlanDateKey(
                    displayedPlanDays[selectedPlanDayIndex + 1]?.dateKey ?? selectedPlanDay.dateKey
                  )
                }
                disabled={selectedPlanDayIndex === displayedPlanDays.length - 1}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-brand-border/70 bg-brand-bgAlt/60 text-brand-text outline-none transition hover:border-brand-green/30 hover:text-brand-green focus-visible:ring-2 focus-visible:ring-brand-green disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Next plan day"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center justify-between px-3 pb-1 pt-2 text-[10px] font-bold text-brand-muted">
              <span>
                {selectedPlanDay.weekday}, {selectedPlanDay.dateStr}
              </span>
              <span className="font-mono uppercase tracking-wider">
                {selectedPlanDayIndex + 1} of {displayedPlanDays.length}
              </span>
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
        {activeTab === 'plan' &&
          (groupedDays.length === 0 ? (
            pendingReview ? (
              <section className="flex flex-col gap-8 text-left" aria-labelledby="pending-plan-heading">
                <div className="relative overflow-hidden rounded-[30px] border border-brand-green/20 bg-gradient-to-br from-brand-surface via-brand-surface to-brand-green/10 p-5 shadow-card md:p-7">
                  <div
                    className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-brand-accent/15 blur-3xl"
                    aria-hidden="true"
                  />
                  <div className="relative flex flex-col gap-6">
                    <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
                      <div className="max-w-2xl">
                        <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-brand-green">
                          <Sparkles className="h-4 w-4" aria-hidden="true" />
                          AI plan generated
                        </div>
                        <h2
                          id="pending-plan-heading"
                          className="mt-3 font-display text-2xl font-black tracking-tight text-brand-text md:text-3xl"
                        >
                          Your plan is in clinical review
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                          All {pendingReview.mealCount} meals are connected across {groupedPendingDays.length} scheduled
                          days. You can preview them now while a nutritionist verifies the recommendations.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:min-w-[250px]">
                        <div className="rounded-2xl border border-brand-border/60 bg-brand-bg/70 p-3.5">
                          <span className="block font-display text-2xl font-black text-brand-text">
                            {pendingReview.mealCount}
                          </span>
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-brand-muted">
                            Meals
                          </span>
                        </div>
                        <div className="rounded-2xl border border-brand-border/60 bg-brand-bg/70 p-3.5">
                          <span className="block font-display text-2xl font-black text-brand-text">
                            {groupedPendingDays.length}
                          </span>
                          <span className="text-[9px] font-extrabold uppercase tracking-wider text-brand-muted">
                            Days
                          </span>
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
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-status-pending-text">
                            Current
                          </p>
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
                        Preview only. Logging, swaps, regeneration, nutrition totals, and groceries remain disabled
                        until approval.
                      </p>
                    </div>
                  </div>
                </div>

                {groupedPendingDays
                  .filter((day) => day.dateKey === selectedPlanDay?.dateKey)
                  .map((day, dayIndex) => (
                    <div
                      key={day.dateKey}
                      className="rounded-[30px] border border-brand-border/60 bg-brand-surface/45 p-4 shadow-card md:p-5"
                    >
                      <div className="mb-5 flex flex-col gap-3 border-b border-brand-border/50 pb-4 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-brand-green/20 bg-brand-green/10 font-display text-sm font-black text-brand-green">
                            {String(selectedPlanDayIndex + dayIndex + 1).padStart(2, '0')}
                          </div>
                          <div>
                            <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-brand-muted">
                              Plan day
                            </p>
                            <h3 className="mt-0.5 font-display text-lg font-black leading-none text-brand-text">
                              {day.weekday}
                            </h3>
                            <span className="mt-1 block text-[10px] font-bold text-brand-muted">{day.dateStr}</span>
                          </div>
                        </div>
                        <Badge variant="pending" className="self-start px-3 py-1.5 text-[10px] md:self-auto">
                          {day.mealsList.length} meals pending verification
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        {day.mealsList.map((meal, index) => (
                          <PendingMealPreviewCard key={`${meal.scheduledDate}-${meal.mealType}-${index}`} meal={meal} />
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
              {groupedDays
                .filter((day) => day.dateKey === selectedPlanDay?.dateKey)
                .map((day) => (
                  <section
                    key={day.dateKey}
                    className="overflow-hidden rounded-[26px] border border-brand-border/70 bg-brand-surface shadow-sm"
                  >
                    {/* Day Header with sum targets */}
                    <div className="flex flex-col justify-between gap-3 border-b border-brand-border/60 bg-brand-bgAlt/35 px-4 py-4 md:flex-row md:items-center sm:px-5">
                      <div>
                        <h3 className="text-base font-extrabold font-display text-brand-green uppercase leading-none">
                          {day.weekday}
                        </h3>
                        <span className="text-[10px] text-brand-muted font-bold mt-1 block">{day.dateStr}</span>
                      </div>

                      {/* Macros summing indicators */}
                      <div className="flex gap-3 flex-wrap text-[10px] font-bold text-brand-text">
                        <span className="rounded-full border border-brand-border bg-brand-bgAlt px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-brand-green">
                          {pendingReview ? 'Approved subtotal' : 'Target'}: {Math.round(day.dayCalories)} kcal
                        </span>
                        <span
                          className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em]"
                          style={{
                            backgroundColor: 'var(--macro-protein-bg)',
                            borderColor: 'var(--macro-protein-border)',
                            color: 'var(--macro-protein)',
                          }}
                        >
                          {Math.round(day.dayProtein)}g Protein
                        </span>
                        <span
                          className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em]"
                          style={{
                            backgroundColor: 'var(--macro-carbs-bg)',
                            borderColor: 'var(--macro-carbs-border)',
                            color: 'var(--macro-carbs)',
                          }}
                        >
                          {Math.round(day.dayCarbs)}g Carbs
                        </span>
                        <span
                          className="rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em]"
                          style={{
                            backgroundColor: 'var(--macro-fat-bg)',
                            borderColor: 'var(--macro-fat-border)',
                            color: 'var(--macro-fat)',
                          }}
                        >
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
                          swapCap={swapCap}
                          scheduledDate={meal.scheduledDate}
                          verifier={meal.verifier}
                          explanation={meal.explanation}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              {pendingReview &&
                groupedPendingDays
                  .filter((day) => day.dateKey === selectedPlanDay?.dateKey)
                  .map((day) => (
                    <section
                      key={`pending-${day.dateKey}`}
                      className="rounded-[26px] border border-status-pending-text/25 bg-status-pending-bg/20 p-4 shadow-sm sm:p-5"
                    >
                      <div className="mb-4 flex flex-col gap-2 border-b border-brand-border/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="font-display text-base font-extrabold text-brand-text">
                            Awaiting nutritionist review
                          </h3>
                          <p className="mt-1 text-xs text-brand-muted">
                            These meals remain visible as previews and cannot be logged or swapped until approved.
                          </p>
                        </div>
                        <Badge variant="pending" className="self-start px-3 py-1.5 text-[10px] sm:self-auto">
                          {day.mealsList.length} pending
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        {day.mealsList.map((meal, index) => (
                          <PendingMealPreviewCard key={`${meal.scheduledDate}-${meal.mealType}-${index}`} meal={meal} />
                        ))}
                      </div>
                    </section>
                  ))}
            </div>
          ))}

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
                <Button type="submit" variant="secondary" className="h-10 px-4 text-xs">
                  Apply
                </Button>
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
                  You haven&apos;t logged any meals matching the selected filters yet.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {groupHistoryByDate().map((day) => (
                  <section
                    key={day.dateKey}
                    className="overflow-hidden rounded-[22px] border border-brand-border/70 bg-brand-surface shadow-sm"
                  >
                    <div className="border-b border-brand-border/60 bg-brand-bgAlt/35 px-4 py-3">
                      <span className="text-xs font-extrabold text-brand-green font-display uppercase">
                        {day.weekday}
                      </span>
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
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                    log.status === 'DONE'
                                      ? 'text-brand-green bg-brand-green/10'
                                      : log.status === 'SKIPPED'
                                        ? 'text-red-400 bg-red-400/10'
                                        : 'text-amber-500 bg-amber-500/10'
                                  }`}
                                >
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
                              <div
                                className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
                                  deltaVal > 0
                                    ? 'text-amber-500 bg-amber-500/5 border-amber-500/20'
                                    : deltaVal < 0
                                      ? 'text-brand-green bg-brand-green/5 border-brand-green/20'
                                      : 'text-brand-muted bg-brand-surface border-brand-border'
                                }`}
                              >
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
                <Button type="submit" variant="secondary" className="h-10 px-4 text-xs">
                  Apply
                </Button>
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
                        <span>
                          P:{' '}
                          <span style={{ color: 'var(--macro-protein)' }} className="font-extrabold">
                            {meal.proteinG}g
                          </span>
                        </span>
                        <span>
                          C:{' '}
                          <span style={{ color: 'var(--macro-carbs)' }} className="font-extrabold">
                            {meal.carbsG}g
                          </span>
                        </span>
                        <span>
                          F:{' '}
                          <span style={{ color: 'var(--macro-fat)' }} className="font-extrabold">
                            {meal.fatG}g
                          </span>
                        </span>
                      </div>
                      {/* Verifier PRC Badge */}
                      <button
                        type="button"
                        onClick={() => meal.verifier && setSelectedVerifier(meal.verifier)}
                        disabled={!meal.verifier}
                        className="w-full text-[9px] text-brand-muted flex items-center justify-between gap-1 bg-brand-surface/80 p-1.5 rounded border border-brand-border/40 transition hover:border-brand-green/35 hover:bg-brand-green/[0.05] disabled:cursor-default disabled:hover:border-brand-border/40"
                        aria-label={`View verifier details for ${meal.verifiedBy}`}
                      >
                        <span>
                          Verified by:{' '}
                          <span className="font-semibold text-brand-text underline decoration-brand-green/40 underline-offset-2">
                            {meal.verifiedBy}
                          </span>
                        </span>
                        <span className="text-brand-green font-extrabold bg-brand-green/15 px-1 rounded uppercase tracking-tighter scale-95 origin-right">
                          PRC: {meal.prcLicenseNumber}
                        </span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <MealsWorkspaceModals workspace={workspace} />
    </div>
  );
}
