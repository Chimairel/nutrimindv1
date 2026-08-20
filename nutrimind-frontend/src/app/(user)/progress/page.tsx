'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import AutocompleteInput from '@/components/ui/AutocompleteInput';
import axios from 'axios';
import { 
  TrendingUp, 
  Plus, 
  CheckCircle, 
  AlertTriangle, 
  Lightbulb, 
  BarChart3, 
  Heart, 
  Settings,
  Scale,
  ChevronDown,
  Check
} from 'lucide-react';

interface WeightLog {
  id: string;
  weightKg: number;
  note: string | null;
  loggedAt: string;
}

interface DailyNutritionLog {
  id: string;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  targetCalories: number;
  adherencePct: number;
  logDate: string;
}

interface ProfileDetails {
  id: string;
  name: string;
  email: string;
  userProfile?: {
    age?: number;
    biologicalSex?: string;
    heightCm?: number;
    weightKg?: number;
    targetWeightKg?: number;
    goal?: string;
    dailyCalorieTarget?: number;
    activityLevel?: string;
    dietaryPreference?: string;
    carbPreference?: string;
    foodCulture?: string;
    otherConditions?: string;
    otherAllergies?: string;
    shoppingDayGroup?: string;
  };
  healthConditions?: string[];
  allergies?: string[];
}

interface ProgressHistory {
  weightLogs: WeightLog[];
  dailyNutritionLogs: DailyNutritionLog[];
}

export default function ProgressPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState<ProgressHistory | null>(null);
  const [profileData, setProfileData] = useState<ProfileDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'year'>('week');
  const [isTimeframeDropdownOpen, setIsTimeframeDropdownOpen] = useState(false);

  // Auto-complete Suggestions
  const [conditionSuggestions, setConditionSuggestions] = useState<string[]>([]);
  const [allergenSuggestions, setAllergenSuggestions] = useState<string[]>([]);

  // Form State - Biometrics & Preferences
  const [age, setAge] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [targetWeightKg, setTargetWeightKg] = useState('');
  const [biologicalSex, setBiologicalSex] = useState('MALE');
  const [goal, setGoal] = useState('MAINTAIN');
  const [activityLevel, setActivityLevel] = useState('SEDENTARY');
  const [dietaryPreference, setDietaryPreference] = useState('OMNIVORE');
  const [carbPreference, setCarbPreference] = useState('MODERATE');
  const [foodCulture, setFoodCulture] = useState('Filipino');
  const [shoppingDayGroup, setShoppingDayGroup] = useState('WEEKEND');
  const [isSavingBiometrics, setIsSavingBiometrics] = useState(false);
  const [biometricsSuccess, setBiometricsSuccess] = useState<string | null>(null);
  const [biometricsError, setBiometricsError] = useState<string | null>(null);

  // Form State - Health & Allergies
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [otherConditions, setOtherConditions] = useState('');
  const [otherAllergies, setOtherAllergies] = useState('');
  const [isSavingHealth, setIsSavingHealth] = useState(false);
  const [healthSuccess, setHealthSuccess] = useState<string | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Form State - New Weight Reading
  const [isLogFormOpen, setIsLogFormOpen] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [isSubmittingWeight, setIsSubmittingWeight] = useState(false);
  const [weightFormError, setWeightFormError] = useState<string | null>(null);
  const [weightSuccess, setWeightSuccess] = useState<string | null>(null);

  // Fetch progress history and profile info
  const fetchPageData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [historyRes, profileRes, suggestionsRes] = await Promise.all([
        api.get('/user/progress/history'),
        api.get('/user/profile'),
        api.get('/user/onboarding/suggestions'),
      ]);

      if (historyRes.data && historyRes.data.success) {
        setHistory(historyRes.data.data);
      }
      if (profileRes.data && profileRes.data.success) {
        const data: ProfileDetails = profileRes.data.data;
        setProfileData(data);

        // Pre-populate biometric form states
        if (data.userProfile) {
          setAge(String(data.userProfile.age || ''));
          setHeightCm(String(data.userProfile.heightCm || ''));
          setWeightKg(String(data.userProfile.weightKg || ''));
          setTargetWeightKg(String(data.userProfile.targetWeightKg || ''));
          setBiologicalSex(data.userProfile.biologicalSex || 'MALE');
          setGoal(data.userProfile.goal || 'MAINTAIN');
          setActivityLevel(data.userProfile.activityLevel || 'SEDENTARY');
          setDietaryPreference(data.userProfile.dietaryPreference || 'OMNIVORE');
          setCarbPreference(data.userProfile.carbPreference || 'MODERATE');
          setFoodCulture(data.userProfile.foodCulture || 'Filipino');
          setShoppingDayGroup(data.userProfile.shoppingDayGroup || 'WEEKEND');
          setOtherConditions(data.userProfile.otherConditions || '');
          setOtherAllergies(data.userProfile.otherAllergies || '');
        }

        // Pre-populate health enums
        setSelectedConditions(data.healthConditions || []);
        setSelectedAllergies(data.allergies || []);
      }
      if (suggestionsRes.data && suggestionsRes.data.success) {
        setConditionSuggestions(suggestionsRes.data.data.conditions || []);
        setAllergenSuggestions(suggestionsRes.data.data.allergies || []);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to fetch progress metrics.');
      } else {
        setError('Failed to reach backend API.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPageData();
    }
  }, [user]);

  // Handles updating biometrics and preferences form
  const handleBiometricsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBiometrics(true);
    setBiometricsError(null);
    setBiometricsSuccess(null);

    try {
      // 1. Save general profile stats
      const profileUpdate = await api.put('/user/profile', {
        age: parseInt(age),
        heightCm: parseFloat(heightCm),
        weightKg: parseFloat(weightKg),
        targetWeightKg: parseFloat(targetWeightKg),
        biologicalSex,
        goal,
        activityLevel,
        dietaryPreference,
        carbPreference,
        foodCulture,
      });

      // 2. Save shopping day group preference
      await api.post('/user/onboarding/shopping-day', {
        shoppingDayGroup,
      });

      if (profileUpdate.data && profileUpdate.data.success) {
        setBiometricsSuccess('Biometrics and dietary preferences updated successfully! Calorie budget recalculated.');
        setProfileData(profileUpdate.data.data);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setBiometricsError(err.response?.data?.error || 'Failed to update biometrics.');
      } else {
        setBiometricsError('Failed to reach server.');
      }
    } finally {
      setIsSavingBiometrics(false);
    }
  };

  // Handles updating clinical health conditions and food allergies form
  const handleHealthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingHealth(true);
    setHealthError(null);
    setHealthSuccess(null);

    try {
      const [condRes, allerRes] = await Promise.all([
        api.put('/user/profile/conditions', {
          conditions: selectedConditions,
          otherConditions,
        }),
        api.put('/user/profile/allergies', {
          allergies: selectedAllergies,
          otherAllergies,
        }),
      ]);

      if (condRes.data.success && allerRes.data.success) {
        setHealthSuccess('Clinical safety settings saved! Remaining active plan meals scanned and updated for safety.');
        
        // Refresh page details to pull new calorie calculations or status adjustments
        const profileRes = await api.get('/user/profile');
        if (profileRes.data && profileRes.data.success) {
          setProfileData(profileRes.data.data);
        }
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setHealthError(err.response?.data?.error || 'Failed to update safety settings.');
      } else {
        setHealthError('Failed to reach server.');
      }
    } finally {
      setIsSavingHealth(false);
    }
  };

  // Handles logging a new weight reading
  const handleLogWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const weightNum = parseFloat(weightInput);
    if (isNaN(weightNum) || weightNum <= 0) {
      setWeightFormError('Please enter a valid positive weight.');
      return;
    }

    setIsSubmittingWeight(true);
    setWeightFormError(null);
    setWeightSuccess(null);
    try {
      const res = await api.post('/user/progress/weight', {
        weightKg: weightNum,
        note: noteInput || null,
      });

      if (res.data && res.data.success) {
        setWeightSuccess('Weight logged! Your daily calorie target has been recalculated.');
        setWeightInput('');
        setNoteInput('');
        setIsLogFormOpen(false);
        
        // Reload history & profile info to update graphs and target labels
        const [historyRes, profileRes] = await Promise.all([
          api.get('/user/progress/history'),
          api.get('/user/profile'),
        ]);

        if (historyRes.data && historyRes.data.success) {
          setHistory(historyRes.data.data);
        }
        if (profileRes.data && profileRes.data.success) {
          setProfileData(profileRes.data.data);
        }
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setWeightFormError(err.response?.data?.error || 'Failed to log weight.');
      } else {
        setWeightFormError('Failed to reach server.');
      }
    } finally {
      setIsSubmittingWeight(false);
    }
  };

  const toggleCondition = (cond: string) => {
    setSelectedConditions((prev) =>
      prev.includes(cond) ? prev.filter((c) => c !== cond) : [...prev, cond]
    );
  };

  const toggleAllergy = (aller: string) => {
    setSelectedAllergies((prev) =>
      prev.includes(aller) ? prev.filter((a) => a !== aller) : [...prev, aller]
    );
  };

  const groupedLogs = React.useMemo(() => {
    if (!history?.weightLogs || history.weightLogs.length === 0) return [];
    
    // Group logs
    const groups: Record<string, { sum: number; count: number; date: Date }> = {};
    
    history.weightLogs.forEach((log) => {
      const d = new Date(log.loggedAt);
      let key = '';
      if (timeframe === 'week') {
        const day = d.getDay();
        const diff = d.getDate() - day;
        const sunday = new Date(d.setDate(diff));
        sunday.setHours(0, 0, 0, 0);
        key = sunday.toDateString();
      } else if (timeframe === 'month') {
        key = `${d.getFullYear()}-${d.getMonth()}`;
      } else {
        key = `${d.getFullYear()}`;
      }
      
      if (!groups[key]) {
        groups[key] = { sum: 0, count: 0, date: new Date(log.loggedAt) };
      }
      groups[key].sum += log.weightKg;
      groups[key].count += 1;
    });

    return Object.keys(groups)
      .sort((a, b) => {
        if (timeframe === 'week') {
          return new Date(a).getTime() - new Date(b).getTime();
        } else if (timeframe === 'month') {
          const [ay, am] = a.split('-').map(Number);
          const [by, bm] = b.split('-').map(Number);
          return ay !== by ? ay - by : am - bm;
        } else {
          return Number(a) - Number(b);
        }
      })
      .map((key) => {
        const item = groups[key];
        const avgWeight = Math.round((item.sum / item.count) * 10) / 10;
        
        let label = '';
        if (timeframe === 'week') {
          const sunday = new Date(key);
          label = `Wk of ${sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
        } else if (timeframe === 'month') {
          label = item.date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        } else {
          label = item.date.getFullYear().toString();
        }

        return {
          weightKg: avgWeight,
          dateLabel: label,
        };
      });
  }, [history?.weightLogs, timeframe]);

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const targetWeight = profileData?.userProfile?.targetWeightKg || 0;
  const currentWeight = profileData?.userProfile?.weightKg || 0;
  const dailyCalorieTarget = profileData?.userProfile?.dailyCalorieTarget || 0;

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
      const ratio = groupedLogs.length > 1 ? (idx / (groupedLogs.length - 1)) : 0.5;
      const x = padding + ratio * (width - padding * 2);
      const y = height - padding - ((log.weightKg - minW) / rangeW) * (height - padding * 2);
      return { x, y, weight: log.weightKg, date: log.dateLabel };
    });

    // Create Path commands
    let linePath = '';
    let areaPath = '';
    if (points.length > 0) {
      linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
      areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
    }

    const targetY = targetWeight > 0 
      ? height - padding - ((targetWeight - minW) / rangeW) * (height - padding * 2)
      : 0;

    return (
      <div className="w-full bg-brand-surface/30 border border-brand-border/60 p-4 rounded-2xl shadow-inner relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-green/5 blur-3xl pointer-events-none rounded-full" />
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#52B788" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#52B788" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#52B788" />
              <stop offset="100%" stopColor="#74C69D" />
            </linearGradient>
          </defs>

          {/* Dotted Grid lines */}
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(255,255,255,0.04)" strokeDasharray="3" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(255,255,255,0.04)" strokeDasharray="3" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(255,255,255,0.08)" />

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
                fill="#1B4332" 
                stroke="#52B788" 
                strokeWidth="2.5"
                className="transition-all duration-200 hover:r-7 cursor-pointer"
              />
              <text 
                x={p.x} 
                y={p.y - 9} 
                fill="rgba(255, 255, 255, 0.9)" 
                fontSize="8" 
                fontWeight="extrabold" 
                textAnchor="middle"
              >
                {p.weight}
              </text>
              <text 
                x={p.x} 
                y={height - padding + 13} 
                fill="rgba(255, 255, 255, 0.3)" 
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
      
      {/* HEADER SECTION */}
      <PortalPageHeader
        icon={TrendingUp}
        eyebrow="Health trajectory"
        title="Progress and health context"
        description="Track biometrics, nutrition adherence, safety preferences, and calorie-target changes over time."
        className="mb-8"
        actions={<Button
          variant="primary"
          onClick={() => {
            setIsLogFormOpen(!isLogFormOpen);
            setWeightFormError(null);
            setWeightSuccess(null);
          }}
          className="text-xs font-bold py-2 shadow-lg shadow-brand-green/10 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Log today&apos;s weight</span>
        </Button>
        }
      />

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

      {/* GRAPH & SUMMARY BLOCKS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-left">
        {/* Graph Card */}
        <Card className="p-5 border-brand-border/60 bg-brand-surface/20 md:col-span-2 shadow-xl">
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
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsTimeframeDropdownOpen(false)}
                  />
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

        {/* Current Metrics Stats */}
        <Card className="p-5 border-brand-border/60 bg-brand-surface/20 flex flex-col gap-5 shadow-xl justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-brand-green uppercase tracking-wide mb-4 font-display">
              Target Baseline
            </h3>
            <div className="flex flex-col gap-4">
              <div className="bg-brand-background/40 p-4 border border-brand-border/40 rounded-xl flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-muted">Current Weight</span>
                <span className="text-lg font-black text-brand-text font-display">{currentWeight || '--'} kg</span>
              </div>
              <div className="bg-brand-background/40 p-4 border border-brand-border/40 rounded-xl flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-muted">Target Weight</span>
                <span className="text-lg font-black text-brand-text font-display">{targetWeight || '--'} kg</span>
              </div>
              <div className="bg-brand-background/40 p-4 border border-brand-border/40 rounded-xl flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-muted">Calorie Budget</span>
                <span className="text-lg font-black text-brand-green font-display">{dailyCalorieTarget || '--'} kcal</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-brand-muted leading-relaxed font-semibold uppercase tracking-wider border-t border-brand-border/40 pt-4 mt-2 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-brand-green shrink-0 animate-pulse" />
            <span>Recalculations occur dynamically as your body changes</span>
          </p>
        </Card>
      </div>

      {/* EDITABLE BIOMETRICS & PREFERENCES */}
      <Card className="p-6 border-brand-border/60 bg-brand-surface/20 shadow-xl text-left mb-8">
        <h3 className="text-sm font-extrabold text-brand-green uppercase tracking-wide mb-5 font-display flex items-center gap-1.5">
          <Settings className="w-4 h-4 text-brand-green" />
          <span>Biometrics & Dietary Preferences</span>
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              label="Age (Years)"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              required
            />
            <Input
              label="Height (cm)"
              type="number"
              step="0.1"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
              required
            />
            <Input
              label="Weight (kg)"
              type="number"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              required
            />
            <Input
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
              <label className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2">Biological Sex</label>
              <select
                value={biologicalSex}
                onChange={(e) => setBiologicalSex(e.target.value)}
                className="w-full rounded-xl bg-brand-bgAlt border border-brand-border px-4 py-2.5 text-sm text-brand-text focus:border-brand-green outline-none"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2">Primary Goal</label>
              <select
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
              <label className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2">Activity Level</label>
              <select
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

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2">Dietary Preference</label>
              <select
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
              <label className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2">Carb Preference</label>
              <select
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
              label="Cooking/Food Culture"
              type="text"
              value={foodCulture}
              onChange={(e) => setFoodCulture(e.target.value)}
              placeholder="e.g. Filipino, Asian"
            />
            <div>
              <label className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-2">Shopping Day Group</label>
              <select
                value={shoppingDayGroup}
                onChange={(e) => setShoppingDayGroup(e.target.value)}
                className="w-full rounded-xl bg-brand-bgAlt border border-brand-border px-4 py-2.5 text-sm text-brand-text focus:border-brand-green outline-none"
              >
                <option value="WEEKEND">Weekend (Sun - Sat plan cycle)</option>
                <option value="WEEKDAY">Weekday (Mon - Sun plan cycle)</option>
              </select>
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

      {/* HEALTH CONDITIONS & CLINICAL SAFETY */}
      <Card className="p-6 border-brand-border/60 bg-brand-surface/20 shadow-xl text-left mb-8">
        <h3 className="text-sm font-extrabold text-brand-green uppercase tracking-wide mb-2 font-display flex items-center gap-1.5">
          <Heart className="w-4 h-4 text-brand-green" />
          <span>Clinical Safety Safeguards</span>
        </h3>
        <p className="text-xs text-brand-muted mb-6 leading-relaxed">
          Updating your medical conditions or food allergies will immediately trigger a backend safety scan to identify and swap conflicting meals in your current plan.
        </p>

        {healthSuccess && (
          <div className="p-3.5 rounded-xl bg-status-verified-bg/10 border border-status-verified-text/25 text-status-verified-text text-xs font-bold mb-4 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-status-verified-text shrink-0" />
            <span>{healthSuccess}</span>
          </div>
        )}

        {healthError && (
          <div className="p-3.5 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-xs font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
            <span>{healthError}</span>
          </div>
        )}

        <form onSubmit={handleHealthSubmit} className="flex flex-col gap-6">
          {/* Medical Conditions Choice Chips */}
          <div>
            <label className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-3">Health & Medical Conditions</label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'DIABETES', label: 'Diabetes' },
                { id: 'HYPERTENSION', label: 'Hypertension' },
                { id: 'KIDNEY_DISEASE', label: 'Kidney Disease' },
                { id: 'HEART_CONDITION', label: 'Heart Condition' },
                { id: 'PREGNANT', label: 'Pregnant / Lactating' },
              ].map((cond) => {
                const isSelected = selectedConditions.includes(cond.id);
                return (
                  <button
                    key={cond.id}
                    type="button"
                    onClick={() => toggleCondition(cond.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border cursor-pointer outline-none ${
                      isSelected
                        ? 'bg-brand-green/20 border-brand-green text-brand-green shadow-md shadow-brand-green/5'
                        : 'bg-brand-bgAlt border-brand-border text-brand-muted hover:text-brand-text hover:bg-brand-border/40'
                    }`}
                  >
                    {cond.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Autocomplete for Other Conditions */}
          <div className="grid grid-cols-1 gap-1">
            <label className="block text-xs font-bold tracking-wider text-brand-muted uppercase">Additional Medical Conditions</label>
            <span className="text-[10px] text-brand-muted mb-2 font-medium">Type custom conditions (e.g. Gout, Celiac, GERD) and hit enter</span>
            <AutocompleteInput
              value={otherConditions}
              onChange={setOtherConditions}
              suggestions={conditionSuggestions}
              placeholder="Search or add additional clinical conditions..."
            />
          </div>

          {/* Food Allergens Choice Chips */}
          <div>
            <label className="block text-xs font-bold tracking-wider text-brand-muted uppercase mb-3">Primary Food Allergens</label>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'SHELLFISH', label: 'Shellfish' },
                { id: 'NUTS', label: 'Tree Nuts / Peanuts' },
                { id: 'DAIRY', label: 'Dairy' },
                { id: 'GLUTEN', label: 'Wheat / Gluten' },
                { id: 'EGGS', label: 'Eggs' },
              ].map((aller) => {
                const isSelected = selectedAllergies.includes(aller.id);
                return (
                  <button
                    key={aller.id}
                    type="button"
                    onClick={() => toggleAllergy(aller.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 border cursor-pointer outline-none ${
                      isSelected
                        ? 'bg-brand-green/20 border-brand-green text-brand-green shadow-md shadow-brand-green/5'
                        : 'bg-brand-bgAlt border-brand-border text-brand-muted hover:text-brand-text hover:bg-brand-border/40'
                    }`}
                  >
                    {aller.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Autocomplete for Other Allergies */}
          <div className="grid grid-cols-1 gap-1">
            <label className="block text-xs font-bold tracking-wider text-brand-muted uppercase">Additional Food Allergies</label>
            <span className="text-[10px] text-brand-muted mb-2 font-medium">Type custom allergens (e.g. Soy, Sesame, Mustard, Sulfites) and hit enter</span>
            <AutocompleteInput
              value={otherAllergies}
              onChange={setOtherAllergies}
              suggestions={allergenSuggestions}
              placeholder="Search or add additional food allergies..."
            />
          </div>

          <div className="flex justify-end mt-2">
            <Button
              variant="primary"
              type="submit"
              disabled={isSavingHealth}
              className="text-xs font-bold py-2.5 px-6 shadow-md"
            >
              {isSavingHealth ? 'Scanning Plan Safety...' : 'Save Safety Changes'}
            </Button>
          </div>
        </form>
      </Card>

      {/* ADHERENCE CALENDAR BLOCK */}
      <div className="text-left">
        <Card className="p-5 border-brand-border/60 bg-brand-surface/20 shadow-xl">
          <h3 className="text-sm font-extrabold text-brand-green uppercase tracking-wide mb-5 font-display flex items-center gap-1.5">
            <BarChart3 className="w-4 h-4 text-brand-green" />
            <span>Historical Calorie Adherence</span>
          </h3>
          
          {history?.dailyNutritionLogs.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-brand-border rounded-xl text-brand-muted text-xs font-bold flex items-center justify-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-brand-green shrink-0" />
              <span>Yesterday&apos;s adherence scores compile automatically overnight</span>
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
                  {history?.dailyNutritionLogs.map((log) => {
                    let badgeVar: 'verified' | 'pending' | 'rejected' = 'verified';
                    if (log.adherencePct < 70) badgeVar = 'rejected';
                    else if (log.adherencePct < 90) badgeVar = 'pending';

                    return (
                      <tr key={log.id} className="border-b border-brand-border/40 hover:bg-brand-surface/30 transition-all duration-150">
                        <td className="py-3 px-3 font-semibold">
                          {new Date(log.logDate).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
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

    </div>
  );
}
