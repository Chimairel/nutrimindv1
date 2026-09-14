'use client';

import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import MealPlanGenerationProgress from '@/components/user/MealPlanGenerationProgress';
import EmptyState from '@/components/shared/EmptyState';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import MealCard from '@/components/user/MealCard';
import MealActivityCalendar from '@/components/user/MealActivityCalendar';
import MealHistoryCard from '@/components/user/MealHistoryCard';
import UnloggedMealCatchUpCard from '@/components/user/UnloggedMealCatchUpCard';
import LibraryMealCard from '@/features/meals/LibraryMealCard';
import PendingMealPreviewCard from '@/components/user/PendingMealPreviewCard';
import ClinicalReviewBanner from '@/components/shared/ClinicalReviewBanner';
import MealPlanSkeleton from '@/features/meals/MealPlanSkeleton';
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
import { formatManilaDate, getManilaDateKey, manilaDateFromKey } from '@/lib/manila-date';

import { useMealsWorkspace } from '@/features/meals/useMealsWorkspace';
import { MealsWorkspaceModals } from '@/features/meals/MealsWorkspaceModals';
import MotionActiveIndicator from '@/components/ui/motion/MotionActiveIndicator';
import { Select, SelectOption } from '@/components/ui/Select';

const HISTORY_SOURCE_OPTIONS: SelectOption[] = [
  {
    value: 'All',
    label: 'All Sources',
    icon: <Sparkles className="h-3.5 w-3.5 text-brand-green dark:text-brand-accent" />,
  },
  {
    value: 'SYSTEM_GENERATED',
    label: 'NutriMind',
    icon: <ShieldCheck className="h-3.5 w-3.5 text-brand-green dark:text-brand-accent" />,
  },
  {
    value: 'USER_LOGGED',
    label: 'Outside Meal',
    icon: <FileText className="h-3.5 w-3.5 text-brand-muted dark:text-white/40" />,
  },
  {
    value: 'USER_SWAPPED',
    label: 'Swapped',
    icon: <Repeat2 className="h-3.5 w-3.5 text-brand-green dark:text-brand-accent" />,
  },
];

const HISTORY_STATUS_OPTIONS: SelectOption[] = [
  {
    value: 'All',
    label: 'All Statuses',
    icon: <ListChecks className="h-3.5 w-3.5 text-brand-muted dark:text-white/40" />,
  },
  {
    value: 'DONE',
    label: 'Done',
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-brand-green dark:text-brand-accent" />,
  },
  {
    value: 'SKIPPED',
    label: 'Skipped',
    icon: <Clock3 className="h-3.5 w-3.5 text-amber-500" />,
  },
];

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
    selectedHistoryDateKey,
    setSelectedHistoryDateKey,
    handleUpdateLogNotes,
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

  return (
    <div className="portal-page select-none pb-32 text-brand-text">
      {/* Main Container */}
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        {pendingReview && <ClinicalReviewBanner />}
        {/* Starter Plan Banner — shown only for STARTER plans and when activeTab is plan */}
        {activeTab === 'plan' && !isLoading && isStarterPlan && starterFirstDate && starterLastDate && nextCycleDay && (
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
              <span className="font-mono text-[9px] uppercase tracking-wider text-brand-muted">
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
                <details className="relative">
                  <summary className="cursor-pointer rounded-xl border border-brand-border bg-brand-surface px-4 py-2 text-sm font-semibold">
                    Plan options
                  </summary>
                  <div className="mt-2 max-w-xs rounded-xl border border-brand-border bg-brand-surface p-3">
                    <p className="mb-3 text-xs text-brand-muted">
                      Whole-plan replacement is available before shopping or logging. After that, choose individual meal
                      swaps.
                    </p>
                    <Button
                      variant="secondary"
                      onClick={handleRegeneratePlan}
                      className="flex items-center gap-1.5 text-xs font-bold"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Replace entire plan</span>
                    </Button>
                  </div>
                </details>
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
              aria-pressed={activeTab === value}
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

        {activeTab !== 'history' && (
          <div className="mb-4 flex items-center gap-3">
            {(['current', 'next'] as const).map((view) => (
              <button
                key={view}
                type="button"
                disabled={isRegenerating || isLoading}
                aria-pressed={workspace.planView === view}
                onClick={() => workspace.setPlanView(view)}
                className="rounded-xl border border-brand-border bg-brand-surface px-4 py-2 text-sm font-semibold aria-pressed:bg-brand-green aria-pressed:text-white"
              >
                {view === 'current' ? 'This week' : 'Next week · Premium'}
              </button>
            ))}
            {workspace.planView === 'next' && (
              <span className="text-xs text-brand-muted">
                Prepare one upcoming cycle. Meals still need review before use.
              </span>
            )}
          </div>
        )}
        {activeTab === 'plan' && !isLoading && displayedMealCount > 0 && (
          <section className="flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-brand-border bg-brand-surface px-4 py-3">
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
                <div key={metric.label} className="flex items-center gap-2 text-sm">
                  <MetricIcon className="h-4 w-4 text-brand-green" />
                  <p className="font-bold text-brand-text">{metric.value}</p>
                  <p className="text-xs text-brand-muted">{metric.label}</p>
                </div>
              );
            })}
          </section>
        )}

        {activeTab === 'plan' && !isLoading && displayedPlanDays.length > 0 && selectedPlanDay && (
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
          (isLoading ? (
            <MealPlanSkeleton />
          ) : groupedDays.length === 0 ? (
            pendingReview ? (
              <section className="flex flex-col gap-6 text-left" aria-label="Pending meal plan review">
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
                          {pendingReview ? 'Approved subtotal' : 'Planned'}: {Math.round(day.dayCalories)} kcal
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
                          image={meal.image}
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
                      className="rounded-[26px] bg-status-pending-bg/20 p-4 shadow-sm sm:p-5"
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

        {activeTab === 'history' && (() => {
          const historyDays = groupHistoryByDate();
          const effectiveDateKey =
            selectedHistoryDateKey || (historyDays.length > 0 ? historyDays[0].dateKey : getManilaDateKey());
          const activeDay = historyDays.find((day) => day.dateKey === effectiveDateKey);

          // Check if there are scheduled plan meals matching effectiveDateKey
          const scheduledForDate = effectiveDateKey
            ? meals.filter((m) => getManilaDateKey(m.scheduledDate) === effectiveDateKey)
            : [];

          // An unlogged meal is one where none of its mealLogs have status DONE or SKIPPED
          const unloggedScheduledMeals = scheduledForDate.filter((m) => {
            return !m.mealLogs?.some((l) => l.status === 'DONE' || l.status === 'SKIPPED');
          });

          const todayKey = getManilaDateKey();
          const parsedEffectiveDate = effectiveDateKey ? manilaDateFromKey(effectiveDateKey) : null;
          const isDateInPastOrToday = Boolean(effectiveDateKey && effectiveDateKey <= todayKey);

          // Check if within the 7-day grace window
          const isWithinGraceWindow = Boolean(
            effectiveDateKey &&
              parsedEffectiveDate &&
              (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const d = new Date(parsedEffectiveDate);
                d.setHours(0, 0, 0, 0);
                const diffDays = Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
                return diffDays >= 0 && diffDays <= 7;
              })()
          );

          const hasUnloggedToCatchUp = unloggedScheduledMeals.length > 0 && isDateInPastOrToday && isWithinGraceWindow;
          const weekday = parsedEffectiveDate ? formatManilaDate(parsedEffectiveDate, { weekday: 'long' }) : 'Selected Day';
          const dateStr = parsedEffectiveDate ? formatManilaDate(parsedEffectiveDate, { month: 'short', day: 'numeric', year: 'numeric' }) : '';

          return (
            <div className="space-y-6 text-left">
              {/* Activity Heatmap Calendar Matrix */}
              <MealActivityCalendar
                logs={historyLogs}
                selectedDateKey={effectiveDateKey}
                onSelectDateKey={(dateKey) => setSelectedHistoryDateKey(dateKey)}
              />

              {/* Filters block */}
              <div className="flex flex-col items-center justify-between gap-3 rounded-[22px] border border-brand-border/70 bg-brand-surface/90 p-3 shadow-sm md:flex-row dark:border-white/10 dark:bg-white/[0.035]">
                <form onSubmit={handleHistorySearchSubmit} className="flex w-full gap-2 md:max-w-sm">
                  <label className="relative min-w-0 flex-1">
                    <span className="sr-only">Search meal history</span>
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                    <input
                      type="text"
                      placeholder="Search history..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="h-10 w-full rounded-xl border border-brand-border bg-brand-bgAlt/60 pl-10 pr-3 text-xs text-brand-text outline-none focus:border-brand-green dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </label>
                  <Button type="submit" variant="secondary" className="h-10 px-4 text-xs">
                    Apply
                  </Button>
                </form>
                <div className="grid w-full grid-cols-2 gap-2 md:w-auto md:flex md:items-center">
                  <div className="w-full md:w-40">
                    <Select
                      value={historySource}
                      onChange={setHistorySource}
                      options={HISTORY_SOURCE_OPTIONS}
                      aria-label="Filter history by source"
                    />
                  </div>
                  <div className="w-full md:w-36">
                    <Select
                      value={historyStatus}
                      onChange={setHistoryStatus}
                      options={HISTORY_STATUS_OPTIONS}
                      aria-label="Filter history by status"
                    />
                  </div>
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
              ) : historyLogs.length === 0 && !hasUnloggedToCatchUp ? (
                <div className="p-12 text-center border border-brand-border/40 bg-brand-surface/30 rounded-2xl dark:border-white/10 dark:bg-white/[0.02]">
                  <FileText className="w-8 h-8 text-brand-green dark:text-brand-accent mx-auto mb-2" />
                  <p className="text-sm text-brand-text dark:text-white font-semibold">No Meal Logs Found</p>
                  <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto">
                    You haven&apos;t logged any meals matching the selected filters yet.
                  </p>
                </div>
              ) : activeDay ? (
                /* Selected Day Section with Macro Summary, Catch-Up Card (if any unlogged), and Logged Meal Cards */
                <section className="space-y-4">
                  {/* Day Header Banner with Macro Summary */}
                  <div className="flex flex-col justify-between gap-3 rounded-[24px] border border-brand-border/70 bg-brand-surface p-4 sm:p-5 shadow-sm md:flex-row md:items-center dark:border-white/10 dark:bg-white/[0.035]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-brand-green dark:text-brand-accent font-display uppercase tracking-wider">
                          {activeDay.weekday}
                        </span>
                        <span className="text-xs font-semibold text-brand-muted dark:text-white/40">·</span>
                        <span className="text-xs font-bold text-brand-text dark:text-white/80">{activeDay.dateStr}</span>
                      </div>
                      <p className="text-xs text-brand-muted dark:text-white/40 mt-0.5">
                        {activeDay.mealCount} meal{activeDay.mealCount !== 1 ? 's' : ''} logged
                        {hasUnloggedToCatchUp ? ` · ${unloggedScheduledMeals.length} planned awaiting log` : ''}
                      </p>
                    </div>

                    {/* Day Macro Badges */}
                    <div className="flex flex-wrap gap-2 text-xs font-bold">
                      <span className="rounded-xl border border-brand-border bg-brand-bgAlt px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-brand-green dark:border-white/10 dark:bg-white/5 dark:text-brand-accent">
                        {Math.round(activeDay.totalCalories)} kcal
                      </span>
                      <span
                        className="rounded-xl border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
                        style={{
                          backgroundColor: 'var(--macro-protein-bg)',
                          borderColor: 'var(--macro-protein-border)',
                          color: 'var(--macro-protein)',
                        }}
                      >
                        {Math.round(activeDay.totalProtein)}g P
                      </span>
                      <span
                        className="rounded-xl border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
                        style={{
                          backgroundColor: 'var(--macro-carbs-bg)',
                          borderColor: 'var(--macro-carbs-border)',
                          color: 'var(--macro-carbs)',
                        }}
                      >
                        {Math.round(activeDay.totalCarbs)}g C
                      </span>
                      <span
                        className="rounded-xl border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
                        style={{
                          backgroundColor: 'var(--macro-fat-bg)',
                          borderColor: 'var(--macro-fat-border)',
                          color: 'var(--macro-fat)',
                        }}
                      >
                        {Math.round(activeDay.totalFat)}g F
                      </span>
                    </div>
                  </div>

                  {/* Catch-up Section for Unlogged Scheduled Meals on this day */}
                  {hasUnloggedToCatchUp && (
                    <div className="rounded-[24px] border border-amber-500/25 bg-amber-500/[0.04] p-4 sm:p-5 dark:border-amber-500/20 dark:bg-amber-500/[0.03]">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3.5">
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                          <h4 className="font-display text-sm font-extrabold text-brand-text dark:text-white">
                            Missed / Unlogged Plan Meals ({unloggedScheduledMeals.length})
                          </h4>
                        </div>
                        <span className="text-[11px] text-brand-muted dark:text-white/40">
                          Log within your 7-day grace window to keep your adherence accurate.
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        {unloggedScheduledMeals.map((meal) => (
                          <UnloggedMealCatchUpCard
                            key={meal.id}
                            meal={meal}
                            onStatusToggle={handleMealStatusToggle}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Logged Meal Cards List with note editor */}
                  <div className="space-y-3">
                    {activeDay.logsList.map((log) => (
                      <MealHistoryCard
                        key={log.id}
                        log={log}
                        onUpdateNotes={handleUpdateLogNotes}
                      />
                    ))}
                  </div>
                </section>
              ) : hasUnloggedToCatchUp ? (
                /* Unlogged Scheduled Day (0 meals logged yet, but has plan meals) */
                <section className="space-y-4">
                  {/* Day Header Banner */}
                  <div className="flex flex-col justify-between gap-3 rounded-[24px] border border-brand-border/70 bg-brand-surface p-4 sm:p-5 shadow-sm md:flex-row md:items-center dark:border-white/10 dark:bg-white/[0.035]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-brand-green dark:text-brand-accent font-display uppercase tracking-wider">
                          {weekday}
                        </span>
                        <span className="text-xs font-semibold text-brand-muted dark:text-white/40">·</span>
                        <span className="text-xs font-bold text-brand-text dark:text-white/80">{dateStr}</span>
                      </div>
                      <p className="text-xs text-brand-muted dark:text-white/40 mt-0.5">
                        0 meals logged · {unloggedScheduledMeals.length} planned awaiting log
                      </p>
                    </div>

                    <span className="self-start md:self-auto rounded-xl border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-300">
                      Catch-up available
                    </span>
                  </div>

                  {/* Catch-up Section */}
                  <div className="rounded-[24px] border border-amber-500/25 bg-amber-500/[0.04] p-4 sm:p-5 dark:border-amber-500/20 dark:bg-amber-500/[0.03]">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-3.5">
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        <h4 className="font-display text-sm font-extrabold text-brand-text dark:text-white">
                          Missed / Unlogged Plan Meals ({unloggedScheduledMeals.length})
                        </h4>
                      </div>
                      <span className="text-[11px] text-brand-muted dark:text-white/40">
                        Select whether you ate or skipped these meals to record your intake.
                      </span>
                    </div>
                    <div className="space-y-2.5">
                      {unloggedScheduledMeals.map((meal) => (
                        <UnloggedMealCatchUpCard
                          key={meal.id}
                          meal={meal}
                          onStatusToggle={handleMealStatusToggle}
                        />
                      ))}
                    </div>
                  </div>
                </section>
              ) : (
                /* Empty state when clicking a calendar day that has 0 meals and no planned meals */
                <div className="p-8 text-center border border-dashed border-brand-border/80 bg-brand-surface/40 rounded-2xl dark:border-white/10 dark:bg-white/[0.02]">
                  <Calendar className="w-8 h-8 text-brand-muted mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-brand-text dark:text-white font-semibold">
                    No Meals Logged on {effectiveDateKey ? formatManilaDate(manilaDateFromKey(effectiveDateKey), { weekday: 'long', month: 'short', day: 'numeric' }) : 'this date'}
                  </p>
                  <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto">
                    Select any highlighted day on the activity matrix above to view its meals, or click below to view your most recent day.
                  </p>
                  {historyDays.length > 0 && (
                    <Button
                      variant="secondary"
                      onClick={() => setSelectedHistoryDateKey(historyDays[0].dateKey)}
                      className="mt-4 text-xs font-bold"
                    >
                      View Most Recent Day ({historyDays[0].dateStr})
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })()}

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
                {['All', 'BREAKFAST', 'LUNCH', 'DINNER'].map((type) => (
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
                  <LibraryMealCard
                    key={meal.id}
                    meal={meal}
                    meals={meals}
                    planView={workspace.planView}
                    onSwap={handleSwapClick}
                    onVerifier={setSelectedVerifier}
                  />
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
