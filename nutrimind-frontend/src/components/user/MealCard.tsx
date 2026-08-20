'use client';

import React, { useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { MealType, MealPlanStatus, AIConfidenceFlag } from '@/types';
import { Check, X, AlertCircle, Coffee, Sun, Moon, Apple, RefreshCw } from 'lucide-react';

interface Ingredient {
  id: string;
  ingredientName: string;
  category?: string;
}

interface MealLog {
  id: string;
  status: 'DONE' | 'SKIPPED' | 'PENDING';
  source?: string;
}

interface MealCardProps {
  id: string;
  mealName: string;
  mealType: MealType;
  description?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  status: MealPlanStatus;
  aiConfidenceFlag: AIConfidenceFlag;
  ingredients?: Ingredient[];
  mealLogs?: MealLog[];
  onStatusToggle?: (mealId: string, newStatus: 'DONE' | 'SKIPPED' | 'PENDING') => Promise<void>;
  onSwapClick?: (mealId: string) => void;
  swapsUsed?: number;
  scheduledDate?: string;
  onCardClick?: () => void;
}

export default function MealCard({
  id,
  mealName,
  mealType,
  description,
  calories,
  proteinG,
  carbsG,
  fatG,
  status,
  ingredients = [],
  mealLogs = [],
  onStatusToggle,
  onSwapClick,
  swapsUsed = 0,
  scheduledDate,
  onCardClick,
}: MealCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Evaluate past date condition
  const isPastDate = React.useMemo(() => {
    if (!scheduledDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(scheduledDate);
    d.setHours(0, 0, 0, 0);
    return d.getTime() < today.getTime();
  }, [scheduledDate]);

  // Check if meal is logged as DONE or SKIPPED (or is a past unlogged meal)
  const isCompleted = mealLogs.some((l) => l.status === 'DONE');
  const isSkipped = mealLogs.some((l) => l.status === 'SKIPPED') ||
    (!mealLogs.some((l) => l.status === 'DONE' || l.status === 'SKIPPED' || (l.status === 'PENDING' && l.source !== 'SAFETY_REPLACED')) && isPastDate);
  const isLogged = isCompleted || isSkipped;

  const handleCheckedChange = async (checked: boolean) => {
    if (!onStatusToggle || isUpdating) return;

    setIsUpdating(true);
    try {
      await onStatusToggle(id, checked ? 'DONE' : 'PENDING');
      setIsOpen(false);
    } catch (err) {
      console.error('[MealCard] Status toggle error:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSkipMeal = async () => {
    if (!onStatusToggle || isUpdating) return;

    setIsUpdating(true);
    try {
      await onStatusToggle(id, 'SKIPPED');
      setIsOpen(false);
    } catch (err) {
      console.error('[MealCard] Skip meal error:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const mealTypeLabels: Record<MealType, { label: string; icon: React.ComponentType<any> }> = {
    BREAKFAST: { label: 'Breakfast', icon: Coffee },
    LUNCH: { label: 'Lunch', icon: Sun },
    DINNER: { label: 'Dinner', icon: Moon },
    SNACK: { label: 'Snack', icon: Apple },
  };

  const activeLabel = mealTypeLabels[mealType];
  const Icon = activeLabel.icon;

  return (
    <>
      {/* Simplified Meal Card inside Grid */}
      <div
        onClick={() => {
          if (onCardClick) {
            onCardClick();
          } else {
            setIsOpen(true);
          }
        }}
        className="block outline-none select-none h-full cursor-pointer"
      >
        <Card
          interactive
          className={`
            border border-brand-border/70 bg-brand-surface h-full transition-all duration-300
            ${isCompleted ? 'border-brand-green/40 shadow-lg shadow-brand-green/5 opacity-80' : ''}
            ${isSkipped ? 'border-red-500/20 opacity-60' : ''}
          `}
          contentClassName="flex h-full flex-col justify-between p-5"
        >
          {/* Card Top Row */}
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Icon className="h-4.5 w-4.5 text-brand-green" />
              <span className="text-[10px] font-extrabold tracking-wider text-brand-muted uppercase">
                {activeLabel.label}
              </span>
            </div>

            {/* Status Indicator Badges */}
            <div className="flex items-center gap-1.5">
              {isCompleted && (
                <Badge variant="verified" showIcon={false} className="text-[9px] font-extrabold py-0.5 px-1.5 bg-brand-green/10 text-brand-green border-brand-green/20 flex items-center gap-0.5 uppercase">
                  <Check className="h-2.5 w-2.5" /> Eaten
                </Badge>
              )}
              {isSkipped && (
                <Badge variant="rejected" showIcon={false} className="text-[9px] font-extrabold py-0.5 px-1.5 bg-red-500/10 text-red-500 border-red-500/20 flex items-center gap-0.5 uppercase">
                  <X className="h-2.5 w-2.5" /> Skipped
                </Badge>
              )}
              {status === 'PENDING_REVIEW' && !isLogged && (
                <Badge variant="pending" showIcon={false} className="text-[9px] font-extrabold py-0.5 px-1.5 bg-amber-500/10 text-amber-500 border-amber-500/20 flex items-center gap-0.5 uppercase">
                  <AlertCircle className="h-2.5 w-2.5" /> Pending
                </Badge>
              )}
            </div>
          </div>

          {/* Card Content */}
          <div className="flex-1 flex flex-col justify-between">
            <h3
              className={`
                text-sm font-extrabold font-display tracking-tight leading-snug mb-1 transition-all
                ${isCompleted ? 'line-through text-brand-muted' : 'text-brand-text'}
                ${isSkipped ? 'text-brand-muted' : ''}
              `}
            >
              {mealName}
            </h3>

            <div className="text-[11px] font-bold text-brand-muted mt-2">
              {Math.round(calories)} kcal · {Math.round(proteinG)}g P · {Math.round(carbsG)}g C · {Math.round(fatG)}g F
            </div>
          </div>
        </Card>
      </div>

      {/* Detailed Info Dialog Popup Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={`${activeLabel.label} Details`}
        size="md"
      >
        <div className="flex flex-col gap-5 text-left select-none p-1">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <Icon className="h-5 w-5 text-brand-green" />
              <h3 className="text-base font-extrabold font-display tracking-tight text-brand-text leading-tight">
                {mealName}
              </h3>
            </div>
            <span className="text-[11px] font-bold text-brand-muted pl-7 block">
              {Math.round(calories)} kcal Total Energy
            </span>
          </div>

          {/* Prototype Macro Badges Side-By-Side */}
          <div className="grid grid-cols-3 gap-3 mb-1">
            <div
              className="border rounded-2xl p-3 text-center"
              style={{
                backgroundColor: 'var(--macro-protein-bg)',
                borderColor: 'var(--macro-protein-border)'
              }}
            >
              <span className="block text-base font-extrabold font-display" style={{ color: 'var(--macro-protein)' }}>
                {Math.round(proteinG)}g
              </span>
              <span className="block text-[9px] uppercase font-bold mt-0.5" style={{ color: 'var(--macro-protein)' }}>
                Protein
              </span>
            </div>

            <div
              className="border rounded-2xl p-3 text-center"
              style={{
                backgroundColor: 'var(--macro-carbs-bg)',
                borderColor: 'var(--macro-carbs-border)'
              }}
            >
              <span className="block text-base font-extrabold font-display" style={{ color: 'var(--macro-carbs)' }}>
                {Math.round(carbsG)}g
              </span>
              <span className="block text-[9px] uppercase font-bold mt-0.5" style={{ color: 'var(--macro-carbs)' }}>
                Carbs
              </span>
            </div>

            <div
              className="border rounded-2xl p-3 text-center"
              style={{
                backgroundColor: 'var(--macro-fat-bg)',
                borderColor: 'var(--macro-fat-border)'
              }}
            >
              <span className="block text-base font-extrabold font-display" style={{ color: 'var(--macro-fat)' }}>
                {Math.round(fatG)}g
              </span>
              <span className="block text-[9px] uppercase font-bold mt-0.5" style={{ color: 'var(--macro-fat)' }}>
                Fat
              </span>
            </div>
          </div>

          {/* Description Text */}
          <p className="text-xs text-brand-muted leading-relaxed">
            {description || "This meal is part of your AI generation plan. Check ingredients and follow the instructions to prepare it."}
          </p>

          {/* YouTube Cooking Tutorial Helper */}
          <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl shrink-0">📺</span>
              <div>
                <h5 className="text-xs font-bold text-brand-text leading-tight">Need cooking help?</h5>
                <p className="text-[10px] text-brand-muted mt-1 leading-snug">Watch Filipino cooking tutorials for this dish on YouTube.</p>
              </div>
            </div>
            <a
              href={`https://www.youtube.com/results?search_query=how+to+cook+${encodeURIComponent(mealName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#ff0000] hover:bg-[#cc0000] text-white text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 shrink-0 select-none cursor-pointer outline-none"
            >
              Watch Video
            </a>
          </div>

          {/* Ingredients list */}
          {ingredients.length > 0 && (
            <div>
              <span className="text-[9px] tracking-wider font-extrabold text-brand-muted uppercase block mb-2">
                Ingredients List
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ingredients.map((ing) => (
                  <span
                    key={ing.id}
                    className="text-[10px] bg-brand-bgAlt border border-brand-border/60 text-brand-text px-2.5 py-1.5 rounded-lg leading-none font-semibold"
                  >
                    {ing.ingredientName}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Clinical Warning Banner (Legal layer 3 & 4) */}
          {status === 'PENDING_REVIEW' && (
            <div className="p-3 rounded-xl bg-status-pending-bg/10 border border-status-pending-text/30 text-status-pending-text text-[10px] font-semibold leading-relaxed flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>AI Estimation Warning</strong>: This plan is still pending verification by a licensed Registered Nutritionist-Dietitian. Use with caution.
              </span>
            </div>
          )}

          {/* Action Buttons Panel */}
          <div className="border-t border-brand-border/60 pt-4 mt-2">
            {!isLogged ? (
              <div className="flex flex-col gap-3">
                {/* Primary: Mark as Eaten */}
                <Button
                  variant="primary"
                  onClick={() => handleCheckedChange(true)}
                  disabled={isUpdating}
                  className="w-full font-bold py-2.5 text-xs"
                >
                  Mark as Eaten
                </Button>

                {/* Secondary: Swap and Skip side-by-side */}
                <div className="flex gap-3">
                  {onSwapClick && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setIsOpen(false);
                        onSwapClick(id);
                      }}
                      disabled={swapsUsed >= 3}
                      className="flex-1 font-bold text-xs py-2 h-9 border-brand-border flex items-center justify-center gap-1"
                      title={swapsUsed >= 3 ? "You've used all 3 swaps for this week." : undefined}
                    >
                      <RefreshCw className="h-3 w-3 animate-spin-hover" /> Swap Meal
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={handleSkipMeal}
                    disabled={isUpdating}
                    className="flex-1 font-bold text-xs py-2 h-9 bg-red-500/10 border border-red-500/25 text-red-500 hover:bg-red-600 hover:text-white"
                  >
                    Skip Meal
                  </Button>
                </div>
              </div>
            ) : (
              /* If logged, show Reset Status button */
              <Button
                variant="secondary"
                onClick={() => handleCheckedChange(false)}
                disabled={isUpdating}
                className="w-full font-bold py-2.5 text-xs border-amber-500/30 text-amber-600 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50"
              >
                Reset Meal Status
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
