'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import axios from 'axios';

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
    heightCm?: number;
    weightKg?: number;
    targetWeightKg?: number;
    goal?: string;
    dailyCalorieTarget?: number;
    activityLevel?: string;
    dietaryPreference?: string;
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

  // Form State
  const [isLogFormOpen, setIsLogFormOpen] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch progress history and profile info
  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
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
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || 'Failed to fetch history metrics.');
      } else {
        setError('Failed to reach backend API.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user]);

  // Handles logging a new weight reading
  const handleLogWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const weightNum = parseFloat(weightInput);
    if (isNaN(weightNum) || weightNum <= 0) {
      setFormError('Please enter a valid positive weight.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setSuccessMessage(null);
    try {
      const res = await api.post('/user/progress/weight', {
        weightKg: weightNum,
        note: noteInput || null,
      });

      if (res.data && res.data.success) {
        setSuccessMessage('Weight logged! Your daily calorie target has been recalculated.');
        setWeightInput('');
        setNoteInput('');
        setIsLogFormOpen(false);
        
        // Reload history data
        const historyRes = await api.get('/user/progress/history');
        if (historyRes.data && historyRes.data.success) {
          setHistory(historyRes.data.data);
        }
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setFormError(err.response?.data?.error || 'Failed to log weight.');
      } else {
        setFormError('Failed to reach server.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const weightLogs = history?.weightLogs || [];
  const targetWeight = profileData?.userProfile?.targetWeightKg || 0;
  const currentWeight = profileData?.userProfile?.weightKg || 0;
  const dailyCalorieTarget = profileData?.userProfile?.dailyCalorieTarget || 0;

  // Custom SVG Weight Graph calculations
  const renderWeightGraph = () => {
    if (weightLogs.length === 0) {
      return (
        <div className="flex h-48 items-center justify-center border border-dashed border-brand-border rounded-2xl bg-brand-surface/20 text-brand-muted text-xs font-semibold">
          📈 Log your weight to generate progress graphs
        </div>
      );
    }

    // Graph Dimensions
    const width = 500;
    const height = 180;
    const padding = 25;

    // Resolve min/max weights for scale
    const weights = weightLogs.map((log) => log.weightKg);
    if (targetWeight > 0) {
      weights.push(targetWeight);
    }
    const maxW = Math.max(...weights) + 4;
    const minW = Math.max(0, Math.min(...weights) - 4);
    const rangeW = maxW - minW || 10;

    // Map logs to coordinates
    const points = weightLogs.map((log, idx) => {
      const x = padding + (idx / Math.max(1, weightLogs.length - 1)) * (width - padding * 2);
      const y = height - padding - ((log.weightKg - minW) / rangeW) * (height - padding * 2);
      return { x, y, weight: log.weightKg, date: new Date(log.loggedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) };
    });

    // Create Path commands
    let linePath = '';
    let areaPath = '';
    if (points.length > 0) {
      linePath = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ');
      areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
    }

    // Calculate Y height for Target Weight baseline indicator
    const targetY = targetWeight > 0 
      ? height - padding - ((targetWeight - minW) / rangeW) * (height - padding * 2)
      : 0;

    return (
      <div className="w-full bg-brand-surface/30 border border-brand-border/60 p-4 rounded-2xl shadow-inner relative overflow-hidden">
        
        {/* Glow Effects */}
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

          {/* Graph Nodes / Markers */}
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
              {/* Weight Text Label */}
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
              {/* Date Text Label */}
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
    <div className="max-w-4xl mx-auto px-4 py-8 text-brand-text">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-brand-border/60 pb-6 mb-8 text-left">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight font-display text-transparent bg-clip-text bg-gradient-to-r from-brand-text via-brand-green to-brand-green">
            📈 PROGRESS & METRICS
          </h1>
          <p className="text-xs text-brand-muted mt-1 font-semibold uppercase tracking-wider">
            Monitor weight adjustments and dynamic calorie target adherence
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setIsLogFormOpen(!isLogFormOpen);
            setFormError(null);
            setSuccessMessage(null);
          }}
          className="text-xs font-bold py-2 shadow-lg shadow-brand-green/10"
        >
          ➕ Log Today&apos;s Weight
        </Button>
      </div>

      {successMessage && (
        <div className="p-4 rounded-xl bg-status-verified-bg/10 border border-status-verified-text/25 text-status-verified-text text-sm font-semibold flex items-center gap-2 text-left mb-6">
          <span>✅</span>
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2 text-left mb-6">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* WEIGHT LOGGER COLLAPSIBLE BLOCK */}
      {isLogFormOpen && (
        <Card className="p-5 border-brand-border bg-brand-surface/40 backdrop-blur-md text-left mb-8 shadow-2xl transition-all duration-300">
          <h3 className="text-base font-bold text-brand-text mb-4">LOG TODAY&apos;S WEIGHT</h3>
          
          {formError && (
            <div className="p-3.5 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-xs font-bold mb-4 flex items-center gap-2">
              <span>⚠️</span>
              <span>{formError}</span>
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
                disabled={isSubmitting}
                className="text-xs py-2 px-4"
              >
                {isSubmitting ? 'Recording...' : 'Save Reading'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* GRAPH & SUMMARY BLOCKS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 text-left">
        
        {/* Graph Card */}
        <Card className="p-5 border-brand-border/60 bg-brand-surface/20 md:col-span-2 shadow-xl">
          <h3 className="text-sm font-extrabold text-brand-green uppercase tracking-wide mb-4 font-display">
            Weight Progress Chart
          </h3>
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
          
          <p className="text-[10px] text-brand-muted leading-relaxed font-semibold uppercase tracking-wider border-t border-brand-border/40 pt-4 mt-2">
            💡 Recalculations occur dynamically as your body changes
          </p>
        </Card>
      </div>

      {/* ADHERENCE CALENDAR BLOCK */}
      <div className="text-left">
        <Card className="p-5 border-brand-border/60 bg-brand-surface/20 shadow-xl">
          <h3 className="text-sm font-extrabold text-brand-green uppercase tracking-wide mb-5 font-display">
            Historical Calorie Adherence
          </h3>
          
          {history?.dailyNutritionLogs.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-brand-border rounded-xl text-brand-muted text-xs font-bold">
              📊 Yesterday&apos;s adherence scores compile automatically overnight
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
