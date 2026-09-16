'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useBreadcrumb } from '@/lib/context/BreadcrumbContext';
import Button from '@/components/ui/Button';
import ProgressSkeleton from '@/features/progress/ProgressSkeleton';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import StructuredSafetyIntake from '@/components/user/StructuredSafetyIntake';
import PlanningLocationFields from '@/components/user/PlanningLocationFields';
import MealLocalityPreferenceControl from '@/components/user/MealLocalityPreferenceControl';
import api from '@/lib/axios';
import { safetyInputsFromProfile } from '@/lib/safety-intake';
import {
  TrendingUp,
  Plus,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  Heart,
  Settings,
  Scale,
  ChevronDown,
  Check,
  Activity,
  ClipboardList,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

import { useProgressWorkspace, type ProgressWorkspaceMode } from '@/features/progress/useProgressWorkspace';

export function ProgressWorkspace({ mode = 'progress' }: { mode?: ProgressWorkspaceMode }) {
  const {
    router,
    activeSection,
    setActiveSection,
    history,
    profileData,
    setProfileData,
    isLoading,
    error,
    timeframe,
    setTimeframe,
    isTimeframeDropdownOpen,
    setIsTimeframeDropdownOpen,
    age,
    setAge,
    heightCm,
    setHeightCm,
    weightKg,
    setWeightKg,
    targetWeightKg,
    setTargetWeightKg,
    biologicalSex,
    setBiologicalSex,
    goal,
    setGoal,
    activityLevel,
    setActivityLevel,
    dietaryPreference,
    setDietaryPreference,
    carbPreference,
    setCarbPreference,
    foodCulture,
    setFoodCulture,
    planningGeographyLevel,
    setPlanningGeographyLevel,
    planningRegionName,
    setPlanningRegionName,
    planningProvinceHucName,
    setPlanningProvinceHucName,
    mealLocalityPreference,
    setMealLocalityPreference,
    shoppingDayOfWeek,
    setShoppingDayOfWeek,
    isSavingBiometrics,
    biometricsSuccess,
    biometricsError,
    showRegenerateModal,
    setShowRegenerateModal,
    healthSuccess,
    setHealthSuccess,
    isLogFormOpen,
    setIsLogFormOpen,
    weightInput,
    setWeightInput,
    noteInput,
    setNoteInput,
    isSubmittingWeight,
    weightFormError,
    setWeightFormError,
    weightSuccess,
    setWeightSuccess,
    handleBiometricsSubmit,
    handleLogWeightSubmit,
    groupedLogs,
    targetWeight,
    currentWeight,
    dailyCalorieTarget,
    fetchPageData,
  } = useProgressWorkspace(mode);

  const { setSubTab } = useBreadcrumb();

  // Read initial tab from URL if present
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['overview', 'history', 'adherence', 'profile', 'safety'].includes(tabParam.toLowerCase())) {
      const mapped = tabParam.toLowerCase() === 'adherence' ? 'history' : (tabParam.toLowerCase() as typeof activeSection);
      setActiveSection(mapped);
    }
  }, [setActiveSection]);

  // Sync activeSection with breadcrumb and URL
  useEffect(() => {
    const label = activeSection === 'history' ? 'adherence' : activeSection;
    setSubTab(label);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (activeSection === 'overview') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', label);
      }
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  }, [activeSection, setSubTab]);

  // Custom SVG Weight Graph calculations
  const renderWeightGraph = () => {
    if (groupedLogs.length === 0) {
      return (
        <div className="flex h-48 items-center justify-center border border-dashed border-brand-border rounded-2xl bg-brand-surface/20 text-brand-muted text-xs font-semibold">
          <TrendingUp className="w-4 h-4 text-brand-green mr-1.5" />
          <span>Log your weight to generate progress graphs</span>
        </div>
      );
    }

    // Graph Dimensions
    const width = 500;
    const height = 180;
    const padding = 25;

    // Resolve min/max weights for scale
    const weights = groupedLogs.map((log) => log.weightKg);
    if (targetWeight > 0) {
      weights.push(targetWeight);
    }
    const maxW = Math.max(...weights) + 4;
    const minW = Math.max(0, Math.min(...weights) - 4);
    const rangeW = maxW - minW || 10;

    // Map logs to coordinates
    const points = groupedLogs.map((log, idx) => {
      const ratio = groupedLogs.length > 1 ? idx / (groupedLogs.length - 1) : 0.5;
      const x = padding + ratio * (width - padding * 2);
      const y = height - padding - ((log.weightKg - minW) / rangeW) * (height - padding * 2);
      return { x, y, weight: log.weightKg, date: log.dateLabel };
    });

    // Create Path commands
    let linePath = '';
    let areaPath = '';
    if (points.length > 0) {
      linePath =
        `M ${points[0].x} ${points[0].y} ` +
        points
          .slice(1)
          .map((p) => `L ${p.x} ${p.y}`)
          .join(' ');
      areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
    }

    const targetY = targetWeight > 0 ? height - padding - ((targetWeight - minW) / rangeW) * (height - padding * 2) : 0;

    return (
      <div className="w-full bg-brand-surface/30 border border-brand-border/60 p-4 rounded-2xl shadow-inner relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/5 blur-3xl pointer-events-none rounded-full" />
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand-green)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--brand-green)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--brand-green)" />
              <stop offset="100%" stopColor="var(--brand-cyan)" />
            </linearGradient>
          </defs>

          {/* Dotted Grid lines */}
          <line
            x1={padding}
            y1={padding}
            x2={width - padding}
            y2={padding}
            stroke="var(--brand-border)"
            strokeDasharray="3"
          />
          <line
            x1={padding}
            y1={height / 2}
            x2={width - padding}
            y2={height / 2}
            stroke="var(--brand-border)"
            strokeDasharray="3"
          />
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="var(--brand-border)"
          />

          {/* Target Weight Baseline */}
          {targetWeight > 0 && targetY > padding && targetY < height - padding && (
            <>
              <line
                x1={padding}
                y1={targetY}
                x2={width - padding}
                y2={targetY}
                stroke="rgba(239, 68, 68, 0.45)"
                strokeDasharray="4 4"
                strokeWidth="1.5"
              />
              <text
                x={width - padding - 6}
                y={targetY - 5}
                fill="rgba(239, 68, 68, 0.7)"
                fontSize="8"
                fontWeight="black"
                textAnchor="end"
              >
                Target: {targetWeight} kg
              </text>
            </>
          )}

          {/* Filled Area */}
          {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

          {/* Stroke Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="url(#lineGrad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Graph Nodes */}
          {points.map((p, idx) => (
            <g key={idx}>
              <circle
                cx={p.x}
                cy={p.y}
                r="5"
                fill="var(--brand-surface)"
                stroke="var(--brand-green)"
                strokeWidth="2.5"
                className="transition-all duration-200 hover:r-7 cursor-pointer"
              />
              <text
                x={p.x}
                y={p.y - 9}
                fill="var(--brand-text)"
                fontSize="8"
                fontWeight="extrabold"
                textAnchor="middle"
              >
                {p.weight}
              </text>
              <text
                x={p.x}
                y={height - padding + 13}
                fill="var(--brand-muted)"
                fontSize="7"
                fontWeight="bold"
                textAnchor="middle"
              >
                {p.date}
              </text>
            </g>
          ))}
        </svg>
      </div>
    );
  };

  return (
    <div className="portal-page max-w-5xl text-brand-text">
      {mode !== 'progress' && (
        <Link href="/profile" className="mb-4 inline-block text-sm font-semibold text-brand-green">
          ← Profile
        </Link>
      )}
      {/* HEADER SECTION */}
      <PortalPageHeader
        icon={mode === 'health' ? Heart : TrendingUp}
        eyebrow={
          mode === 'planning' ? 'Your preferences' : mode === 'health' ? 'Personal health context' : 'Health trajectory'
        }
        title={mode === 'planning' ? 'Food & planning' : mode === 'health' ? 'Health & goals' : 'Progress'}
        description={
          mode === 'health'
            ? 'Update your body measurements, goals, conditions and allergies whenever they change.'
            : mode === 'planning'
              ? 'Choose your food preferences, location and shopping schedule.'
              : 'Your weight, daily intake and progress over time.'
        }
        className="mb-6"
        actions={
          mode === 'progress' ? (
            <Button
              variant="primary"
              onClick={() => {
                setIsLogFormOpen(activeSection === 'overview' ? !isLogFormOpen : true);
                setActiveSection('overview');
                setWeightFormError(null);
                setWeightSuccess(null);
              }}
              className="text-xs font-bold py-2 shadow-lg shadow-brand-green/10 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Log today&apos;s weight</span>
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-status-error-text/30 bg-status-error-bg/20 p-4 text-status-error-text">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="secondary" onClick={() => fetchPageData()} className="h-8 px-3 text-xs">
            Retry
          </Button>
        </div>
      )}

      {mode !== 'planning' && (
        <nav
          className="mb-6 grid grid-cols-2 gap-1 rounded-[22px] border border-brand-border/70 bg-brand-surface/85 p-1.5 shadow-sm"
          aria-label={mode === 'health' ? 'Health profile sections' : 'Progress sections'}
        >
          {(mode === 'health'
            ? ([
                ['profile', 'Body & goals', Settings],
                ['safety', 'Conditions & allergies', Heart],
              ] as const)
            : ([
                ['overview', 'Overview', TrendingUp],
                ['history', 'Daily Adherence', ClipboardList],
              ] as const)
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveSection(value)}
              aria-current={activeSection === value ? 'page' : undefined}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl px-3 text-xs font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-brand-green/30 ${activeSection === value ? 'bg-brand-accent text-[#07100d] shadow-neon' : 'text-brand-muted hover:bg-brand-bgAlt hover:text-brand-text'}`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
      {mode === 'progress' && (
        <div className="mb-5 flex flex-wrap gap-4 text-sm font-semibold text-brand-green">
          <Link href="/progress/reports">Reports & history →</Link>
          <Link href="/profile/health">Update health information →</Link>
        </div>
      )}

      {weightSuccess && (
        <div className="p-4 rounded-xl bg-status-verified-bg/10 border border-status-verified-text/25 text-status-verified-text text-sm font-semibold flex items-center gap-2 text-left mb-6">
          <CheckCircle className="w-4 h-4 text-status-verified-text shrink-0" />
          <span>{weightSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2 text-left mb-6">
          <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <ProgressSkeleton />
      ) : (
        <>
          {activeSection === 'overview' && (
            <>
              {/* WEIGHT LOGGER COLLAPSIBLE BLOCK */}
              {isLogFormOpen && (
                <Card className="p-5 border-brand-border bg-brand-surface/40 backdrop-blur-md text-left mb-8 shadow-2xl transition-all duration-300">
                  <h3 className="text-base font-bold text-brand-text mb-4">LOG TODAY&apos;S WEIGHT</h3>

                  {weightFormError && (
                    <div className="p-3.5 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-xs font-bold mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
                      <span>{weightFormError}</span>
                    </div>
                  )}

                  <form onSubmit={handleLogWeightSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Weight (kg)"
                        type="number"
                        step="0.1"
                        placeholder="e.g. 68.5"
                        value={weightInput}
                        onChange={(e) => setWeightInput(e.target.value)}
                        required
                      />
                      <Input
                        label="Note / Comments (Optional)"
                        type="text"
                        placeholder="e.g. Logged empty stomach in the morning"
                        value={noteInput}
                        onChange={(e) => setNoteInput(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 justify-end mt-2">
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => setIsLogFormOpen(false)}
                        className="text-xs py-2 px-4"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        type="submit"
                        disabled={isSubmittingWeight}
                        className="text-xs py-2 px-4"
                      >
                        {isSubmittingWeight ? 'Recording...' : 'Save Reading'}
                      </Button>
                    </div>
                  </form>
                </Card>
              )}

              <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: 'Current weight', value: currentWeight ? `${currentWeight} kg` : '--', icon: Scale },
                  { label: 'Target weight', value: targetWeight ? `${targetWeight} kg` : '--', icon: TrendingUp },
                  {
                    label: 'Distance to goal',
                    value:
                      currentWeight && targetWeight ? `${Math.abs(targetWeight - currentWeight).toFixed(1)} kg` : '--',
                    icon: Activity,
                  },
                  {
                    label: 'Daily calorie target',
                    value: dailyCalorieTarget ? `${dailyCalorieTarget} kcal` : '--',
                    icon: Lightbulb,
                  },
                ].map((metric) => {
                  const MetricIcon = metric.icon;
                  return (
                    <div
                      key={metric.label}
                      className="rounded-[20px] border border-brand-border/70 bg-brand-surface p-4 shadow-sm"
                    >
                      <MetricIcon className="h-4 w-4 text-brand-green" />
                      <p className="mt-4 font-display text-xl font-black text-brand-text">{metric.value}</p>
                      <p className="mt-1 text-[10px] font-semibold text-brand-muted">{metric.label}</p>
                    </div>
                  );
                })}
              </section>

              {/* GRAPH & SUMMARY BLOCKS */}
              <div className="mb-8 text-left">
                {/* Graph Card */}
                <Card className="p-5 border-brand-border/70 bg-brand-surface shadow-card">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-extrabold text-brand-green uppercase tracking-wide font-display flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-brand-green" />
                      <span>Weight Progress Chart</span>
                    </h3>
                    <div className="relative inline-block text-left select-none">
                      <button
                        type="button"
                        onClick={() => setIsTimeframeDropdownOpen(!isTimeframeDropdownOpen)}
                        className="inline-flex justify-between items-center w-40 rounded-xl border border-brand-border bg-brand-bgAlt px-3 py-1.5 text-xs font-extrabold text-brand-text shadow-sm hover:border-brand-border/80 focus:outline-none transition-all"
                        aria-haspopup="true"
                        aria-expanded={isTimeframeDropdownOpen}
                      >
                        <span>
                          {timeframe === 'week' && 'Weekly Progress'}
                          {timeframe === 'month' && 'Monthly Progress'}
                          {timeframe === 'year' && 'Yearly Progress'}
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-brand-muted ml-1" />
                      </button>

                      {isTimeframeDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setIsTimeframeDropdownOpen(false)} />
                          <div className="origin-top-right absolute right-0 mt-1.5 w-40 rounded-xl shadow-xl bg-brand-bgAlt border border-brand-border focus:outline-none z-20 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="py-1">
                              <button
                                onClick={() => {
                                  setTimeframe('week');
                                  setIsTimeframeDropdownOpen(false);
                                }}
                                className={`flex items-center justify-between w-full text-left px-3 py-2 text-xs font-bold transition-colors ${
                                  timeframe === 'week'
                                    ? 'bg-brand-green/10 text-brand-green'
                                    : 'text-brand-text hover:bg-brand-surface/80'
                                }`}
                              >
                                <span>Weekly Progress</span>
                                {timeframe === 'week' && <Check className="w-3 h-3 text-brand-green" />}
                              </button>
                              <button
                                onClick={() => {
                                  setTimeframe('month');
                                  setIsTimeframeDropdownOpen(false);
                                }}
                                className={`flex items-center justify-between w-full text-left px-3 py-2 text-xs font-bold transition-colors ${
                                  timeframe === 'month'
                                    ? 'bg-brand-green/10 text-brand-green'
                                    : 'text-brand-text hover:bg-brand-surface/80'
                                }`}
                              >
                                <span>Monthly Progress</span>
                                {timeframe === 'month' && <Check className="w-3 h-3 text-brand-green" />}
                              </button>
                              <button
                                onClick={() => {
                                  setTimeframe('year');
                                  setIsTimeframeDropdownOpen(false);
                                }}
                                className={`flex items-center justify-between w-full text-left px-3 py-2 text-xs font-bold transition-colors ${
                                  timeframe === 'year'
                                    ? 'bg-brand-green/10 text-brand-green'
                                    : 'text-brand-text hover:bg-brand-surface/80'
                                }`}
                              >
                                <span>Yearly Progress</span>
                                {timeframe === 'year' && <Check className="w-3 h-3 text-brand-green" />}
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  {renderWeightGraph()}
                </Card>
              </div>
            </>
          )}

          {/* EDITABLE BIOMETRICS & PREFERENCES */}
          {activeSection === 'profile' && (
            <Card className="p-6 border-brand-border/70 bg-brand-surface shadow-card text-left mb-8">
              <h3 className="text-sm font-extrabold text-brand-green uppercase tracking-wide mb-5 font-display flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-brand-green" />
                <span>{mode === 'planning' ? 'Food preferences & shopping' : 'Body measurements & goals'}</span>
              </h3>

              {biometricsSuccess && (
                <div className="p-3.5 rounded-xl bg-status-verified-bg/10 border border-status-verified-text/25 text-status-verified-text text-xs font-bold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-status-verified-text shrink-0" />
                  <span>{biometricsSuccess}</span>
                </div>
              )}

              {biometricsError && (
                <div className="p-3.5 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-xs font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
                  <span>{biometricsError}</span>
                </div>
              )}

              <form onSubmit={handleBiometricsSubmit} className="flex flex-col gap-5">
                {mode === 'health' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <Input
                        id="profile-age"
                        label="Age (Years)"
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        required
                      />
                      <Input
                        id="profile-height"
                        label="Height (cm)"
                        type="number"
                        step="0.1"
                        value={heightCm}
                        onChange={(e) => setHeightCm(e.target.value)}
                        required
                      />
                      <Input
                        id="profile-weight"
                        label="Weight (kg)"
                        type="number"
                        step="0.1"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        required
                      />
                      <Input
                        id="profile-target-weight"
                        label="Target Weight (kg)"
                        type="number"
                        step="0.1"
                        value={targetWeightKg}
                        onChange={(e) => setTargetWeightKg(e.target.value)}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label
                          htmlFor="profile-biological-sex"
                          className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                        >
                          Biological Sex
                        </label>
                        <select
                          id="profile-biological-sex"
                          value={biologicalSex}
                          onChange={(e) => setBiologicalSex(e.target.value)}
                          className="w-full rounded-xl bg-brand-bgAlt border border-brand-border px-4 py-2.5 text-sm text-brand-text focus:border-brand-green outline-none"
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="profile-goal"
                          className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                        >
                          Primary Goal
                        </label>
                        <select
                          id="profile-goal"
                          value={goal}
                          onChange={(e) => setGoal(e.target.value)}
                          className="w-full rounded-xl bg-brand-bgAlt border border-brand-border px-4 py-2.5 text-sm text-brand-text focus:border-brand-green outline-none"
                        >
                          <option value="LOSE_WEIGHT">Lose Weight</option>
                          <option value="GAIN_WEIGHT">Gain Weight</option>
                          <option value="MAINTAIN">Maintain Weight</option>
                          <option value="BUILD_MUSCLE">Build Muscle</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="profile-activity"
                          className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                        >
                          Activity Level
                        </label>
                        <select
                          id="profile-activity"
                          value={activityLevel}
                          onChange={(e) => setActivityLevel(e.target.value)}
                          className="w-full rounded-xl bg-brand-bgAlt border border-brand-border px-4 py-2.5 text-sm text-brand-text focus:border-brand-green outline-none"
                        >
                          <option value="SEDENTARY">Sedentary (Little/no exercise)</option>
                          <option value="LIGHTLY_ACTIVE">Lightly Active (1-3 days/week)</option>
                          <option value="ACTIVE">Active (3-5 days/week)</option>
                          <option value="VERY_ACTIVE">Very Active (6-7 days/week)</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
                {mode === 'planning' && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label
                          htmlFor="profile-diet"
                          className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                        >
                          Dietary Preference
                        </label>
                        <select
                          id="profile-diet"
                          value={dietaryPreference}
                          onChange={(e) => setDietaryPreference(e.target.value)}
                          className="w-full rounded-xl bg-brand-bgAlt border border-brand-border px-4 py-2.5 text-sm text-brand-text focus:border-brand-green outline-none"
                        >
                          <option value="OMNIVORE">Omnivore</option>
                          <option value="VEGETARIAN">Vegetarian</option>
                          <option value="VEGAN">Vegan</option>
                          <option value="PESCATARIAN">Pescatarian</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="profile-carb"
                          className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                        >
                          Carb Preference
                        </label>
                        <select
                          id="profile-carb"
                          value={carbPreference}
                          onChange={(e) => setCarbPreference(e.target.value)}
                          className="w-full rounded-xl bg-brand-bgAlt border border-brand-border px-4 py-2.5 text-sm text-brand-text focus:border-brand-green outline-none"
                        >
                          <option value="LOW">Low Carb</option>
                          <option value="MODERATE">Moderate Carb</option>
                          <option value="HIGH">High Carb</option>
                        </select>
                      </div>
                      <Input
                        id="profile-food-culture"
                        label="Cooking/Food Culture"
                        type="text"
                        value={foodCulture}
                        onChange={(e) => setFoodCulture(e.target.value)}
                        placeholder="e.g. Filipino, Asian"
                      />
                      <div className="md:col-span-2">
                        <PlanningLocationFields
                          level={planningGeographyLevel}
                          regionName={planningRegionName}
                          provinceHucName={planningProvinceHucName}
                          onLevelChange={setPlanningGeographyLevel}
                          onRegionNameChange={setPlanningRegionName}
                          onProvinceHucNameChange={setPlanningProvinceHucName}
                          disabled={isSavingBiometrics}
                          idPrefix="profile-planning-location"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <MealLocalityPreferenceControl
                          value={mealLocalityPreference}
                          regionName={planningRegionName}
                          provinceHucName={planningProvinceHucName}
                          onChange={setMealLocalityPreference}
                          disabled={isSavingBiometrics}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="profile-shopping-day"
                          className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2"
                        >
                          Grocery Shopping Day
                        </label>
                        <select
                          id="profile-shopping-day"
                          value={shoppingDayOfWeek}
                          onChange={(e) => setShoppingDayOfWeek(Number(e.target.value))}
                          className="w-full rounded-xl bg-brand-bgAlt border border-brand-border px-4 py-2.5 text-sm text-brand-text focus:border-brand-green outline-none"
                        >
                          <option value={0}>Sunday (Monday - Sunday plan)</option>
                          <option value={1}>Monday (Tuesday - Monday plan)</option>
                          <option value={2}>Tuesday (Wednesday - Tuesday plan)</option>
                          <option value={3}>Wednesday (Thursday - Wednesday plan)</option>
                          <option value={4}>Thursday (Friday - Thursday plan)</option>
                          <option value={5}>Friday (Saturday - Friday plan)</option>
                          <option value={6}>Saturday (Sunday - Saturday plan)</option>
                        </select>
                      </div>
                    </div>
                  </>
                )}
                {/* Plan Cycle & Regeneration Notice */}
                <div className="flex items-start gap-3 rounded-2xl border border-brand-green/25 bg-brand-green/[0.06] p-4 text-xs leading-relaxed text-brand-muted mt-2">
                  <Sparkles className="h-4 w-4 shrink-0 text-brand-green mt-0.5" />
                  <div>
                    <strong className="text-brand-text block mb-0.5">Plan Cycle Notice</strong>
                    Changes made here will take effect starting on your next weekly meal cycle, or immediately if you choose to regenerate your current week&apos;s meal plan.
                  </div>
                </div>

                <div className="flex justify-end mt-2">
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={isSavingBiometrics}
                    className="text-xs font-bold py-2.5 px-6 shadow-md"
                  >
                    {isSavingBiometrics ? 'Saving Profile...' : 'Save Profile Details'}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* HEALTH CONDITIONS & CLINICAL SAFETY */}
          {activeSection === 'safety' && (
            <Card className="p-6 border-brand-border/70 bg-brand-surface shadow-card text-left mb-8">
              <h3 className="text-sm font-extrabold text-brand-green uppercase tracking-wide mb-2 font-display flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-brand-green" />
                <span>Conditions, allergies & foods to avoid</span>
              </h3>
              <p className="text-xs text-brand-muted mb-6 leading-relaxed">
                Save these together so your meals can be checked against your latest information. You can update them at
                any time.
              </p>

              {healthSuccess && (
                <div className="p-3.5 rounded-xl bg-status-verified-bg/10 border border-status-verified-text/25 text-status-verified-text text-xs font-bold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-status-verified-text shrink-0" />
                  <span>{healthSuccess}</span>
                </div>
              )}

              <StructuredSafetyIntake
                initialEntries={safetyInputsFromProfile(profileData)}
                editableDomains={['CONDITION', 'ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT']}
                submitLabel="Save safety changes"
                onSaved={async (_entries, changed) => {
                  setHealthSuccess(
                    changed
                      ? 'Safety settings saved. Affected meals are being checked again and your nutrition report must be refreshed.'
                      : 'Your safety settings are already up to date.'
                  );
                  if (changed) {
                    router.push('/nutrition-report');
                    return;
                  }
                  const response = await api.get('/user/profile');
                  if (response.data?.success) setProfileData(response.data.data);
                }}
              />
            </Card>
          )}

          {/* ADHERENCE CALENDAR BLOCK */}
          {activeSection === 'history' && (() => {
            const logs = history?.dailyNutritionLogs || [];
            const averageAdherence =
              logs.length > 0
                ? Math.round(logs.reduce((acc, curr) => acc + curr.adherencePct, 0) / logs.length)
                : null;
            const onTargetDays = logs.filter(
              (log) => log.adherencePct >= 90 && log.adherencePct <= 110
            ).length;

            return (
              <div className="text-left space-y-6">
                {/* Educational Banner */}
                <div className="rounded-2xl border border-brand-green/20 bg-brand-green/5 p-5 shadow-sm">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
                      <Lightbulb className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-extrabold text-brand-text font-display">
                        Understanding Calorie Adherence
                      </h4>
                      <p className="text-xs text-brand-muted leading-relaxed">
                        Daily adherence measures how closely your total food intake matched your prescribed metabolic target.
                        Scores compile automatically every night based on meals you mark as eaten on your daily dashboard.
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          90%–110%: Target Achieved
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          70%–89%: Acceptable Buffer
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          &lt;70% or &gt;110%: Off Track
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Summary Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-brand-muted">Average Consistency</span>
                      <BarChart3 className="h-4 w-4 text-brand-green" />
                    </div>
                    <p className="mt-3 font-display text-2xl font-black text-brand-text">
                      {averageAdherence !== null ? `${averageAdherence}%` : '--'}
                    </p>
                    <p className="mt-1 text-[11px] text-brand-muted">Across all logged days</p>
                  </div>

                  <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-brand-muted">Optimal Target Days</span>
                      <CheckCircle className="h-4 w-4 text-brand-green" />
                    </div>
                    <p className="mt-3 font-display text-2xl font-black text-brand-text">
                      {logs.length > 0 ? `${onTargetDays} / ${logs.length}` : '--'}
                    </p>
                    <p className="mt-1 text-[11px] text-brand-muted">Days within 90%–110% zone</p>
                  </div>

                  <div className="rounded-2xl border border-brand-border/70 bg-brand-surface p-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-brand-muted">Logged Days</span>
                      <Activity className="h-4 w-4 text-brand-cyan" />
                    </div>
                    <p className="mt-3 font-display text-2xl font-black text-brand-text">
                      {logs.length}
                    </p>
                    <p className="mt-1 text-[11px] text-brand-muted">Historical compilations</p>
                  </div>
                </div>

                {/* Table or Empty State Card */}
                <Card className="p-5 border-brand-border/70 bg-brand-surface shadow-card">
                  <h3 className="text-sm font-extrabold text-brand-green uppercase tracking-wide mb-5 font-display flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-brand-green" />
                    <span>Daily Intake Log History</span>
                  </h3>

                  {logs.length === 0 ? (
                    <div className="p-8 text-center border border-dashed border-brand-border rounded-2xl text-brand-muted flex flex-col items-center justify-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
                        <BarChart3 className="w-6 h-6" />
                      </div>
                      <div className="max-w-md">
                        <h4 className="text-sm font-bold text-brand-text">No Overnight Adherence Records Yet</h4>
                        <p className="mt-1 text-xs text-brand-muted leading-relaxed">
                          Adherence scores compile automatically overnight from your logged meals.
                          Mark today&apos;s scheduled meals as eaten or log outside meals to record your first score.
                        </p>
                      </div>
                      <Link
                        href="/dashboard"
                        className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand-accent px-4 py-2 text-xs font-extrabold text-[#07100d] shadow-sm hover:brightness-105"
                      >
                        Go to Today&apos;s Dashboard
                      </Link>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-brand-border/60 text-brand-muted uppercase font-bold tracking-wider text-[10px]">
                            <th className="pb-3 px-3">Date</th>
                            <th className="pb-3 px-3">Calories Consumed</th>
                            <th className="pb-3 px-3">Daily Target</th>
                            <th className="pb-3 px-3 text-center">Adherence</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logs.map((log) => {
                            let badgeVar: 'verified' | 'pending' | 'rejected' = 'verified';
                            if (log.adherencePct < 70 || log.adherencePct > 110) badgeVar = 'rejected';
                            else if (log.adherencePct < 90) badgeVar = 'pending';

                            return (
                              <tr
                                key={log.id}
                                className="border-b border-brand-border/40 hover:bg-brand-surface/30 transition-all duration-150"
                              >
                                <td className="py-3 px-3 font-semibold">
                                  {new Date(log.logDate).toLocaleDateString(undefined, {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </td>
                                <td className="py-3 px-3 font-bold text-brand-text">
                                  {Math.round(log.totalCalories)} kcal
                                </td>
                                <td className="py-3 px-3 font-bold text-brand-muted">
                                  {Math.round(log.targetCalories)} kcal
                                </td>
                                <td className="py-3 px-3 text-center">
                                  <Badge variant={badgeVar} showIcon={false} className="py-0.5 px-2.5 font-bold">
                                    {Math.round(log.adherencePct)}% Adherence
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            );
          })()}
        </>
      )}

      {/* Regeneration prompt modal after saving profile details */}
      <Modal
        isOpen={showRegenerateModal}
        onClose={() => setShowRegenerateModal(false)}
        title="Profile Details Saved"
        description="Your health context and planning preferences have been updated."
        size="md"
        footer={
          <div className="flex w-full flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
            <Button
              variant="secondary"
              onClick={() => setShowRegenerateModal(false)}
              className="text-xs font-bold w-full sm:w-auto"
            >
              OK
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setShowRegenerateModal(false);
                router.push('/meals?regenerate=true');
              }}
              className="text-xs font-bold flex items-center justify-center gap-2 w-full sm:w-auto shadow-md"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Regenerate Plan</span>
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-brand-green/20 bg-brand-green/[0.06] p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-brand-green shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed text-brand-muted">
              <strong className="text-brand-text block mb-1">When will your changes take effect?</strong>
              Any changes you made will automatically start to affect your <strong>next weekly meal plan cycle</strong>.
              <br className="mb-2" />
              If you want your <strong>current week&apos;s plan</strong> to immediately match your new goals, calories, or preferences, click <strong>Regenerate Plan</strong>.
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
