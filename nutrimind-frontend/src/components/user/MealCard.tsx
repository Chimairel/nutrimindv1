import React, { useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Checkbox from '@/components/ui/Checkbox';
import { MealType, MealPlanStatus, AIConfidenceFlag } from '@/types';

interface Ingredient {
  id: string;
  ingredientName: string;
  category?: string;
}

interface MealLog {
  id: string;
  status: 'DONE' | 'SKIPPED' | 'PENDING';
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
  onStatusToggle?: (mealId: string, newStatus: 'DONE' | 'PENDING') => Promise<void>;
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
}: MealCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  // Check if meal is logged as DONE
  const activeLog = mealLogs.find((l) => l.status === 'DONE');
  const isCompleted = !!activeLog;

  const handleCheckedChange = async (checked: boolean) => {
    if (!onStatusToggle || isUpdating) return;
    
    setIsUpdating(true);
    try {
      await onStatusToggle(id, checked ? 'DONE' : 'PENDING');
    } catch (err) {
      console.error('[MealCard] Status toggle error:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const mealTypeLabels: Record<MealType, { label: string; icon: string }> = {
    BREAKFAST: { label: 'Breakfast', icon: '🍳' },
    LUNCH: { label: 'Lunch', icon: '☀️' },
    DINNER: { label: 'Dinner', icon: '🌙' },
    SNACK: { label: 'Snack', icon: '🍎' },
  };

  return (
    <Card 
      className={`
        p-6 border-brand-border/60 bg-[#1a1a1e] relative overflow-hidden transition-all duration-300 select-none
        ${isCompleted ? 'border-brand-green/40 shadow-lg shadow-brand-green/5 opacity-80' : 'hover:border-brand-border/90'}
      `}
    >
      {/* Background shadow glow */}
      {isCompleted && (
        <div className="absolute top-0 right-0 h-12 w-24 bg-brand-green/5 blur-lg rounded-full" />
      )}

      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">{mealTypeLabels[mealType].icon}</span>
          <span className="text-xs font-extrabold tracking-wider text-brand-muted uppercase">
            {mealTypeLabels[mealType].label}
          </span>
        </div>

        {/* Status Checkbox */}
        {onStatusToggle && (
          <div className="scale-105 flex items-center">
            <Checkbox
              id={`check-${id}`}
              checked={isCompleted}
              disabled={isUpdating}
              onCheckedChange={handleCheckedChange}
              label=""
            />
          </div>
        )}
      </div>

      {/* Meal Title and Description */}
      <h3 
        className={`
          text-base font-extrabold font-display tracking-tight leading-snug mb-1 transition-all
          ${isCompleted ? 'line-through text-brand-muted' : 'text-brand-text'}
        `}
      >
        {mealName}
      </h3>
      
      {description && (
        <p className="text-xs text-brand-muted leading-relaxed mb-4">
          {description}
        </p>
      )}

      {/* Macros Chips Grid */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Badge variant="user" showIcon={false} className="text-[10px] font-bold py-0.5 px-2 bg-blue-400/10 text-blue-400 border-blue-400/20">
          {Math.round(calories)} kcal
        </Badge>
        <Badge variant="verified" showIcon={false} className="text-[10px] font-bold py-0.5 px-2 bg-[#52B788]/10 text-brand-green border-brand-green/20">
          {Math.round(proteinG)}g P
        </Badge>
        <Badge variant="pending" showIcon={false} className="text-[10px] font-bold py-0.5 px-2 bg-amber-400/10 text-amber-500 border-amber-500/20">
          {Math.round(carbsG)}g C
        </Badge>
        <Badge variant="user" showIcon={false} className="text-[10px] font-bold py-0.5 px-2 bg-blue-400/10 text-blue-400 border-blue-400/20">
          {Math.round(fatG)}g F
        </Badge>
      </div>

      {/* Ingredients List */}
      {ingredients.length > 0 && (
        <div className="mt-4 pt-4 border-t border-brand-border/40">
          <span className="text-[10px] tracking-wider font-extrabold text-brand-muted uppercase block mb-2">
            Ingredients
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ingredients.map((ing) => (
              <span 
                key={ing.id} 
                className="text-[10px] bg-brand-bgAlt/55 border border-brand-border/60 text-brand-text px-2 py-1 rounded-lg leading-none"
              >
                {ing.ingredientName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Clinical Warning Banner (Legal layer 3 & 4) */}
      {status === 'PENDING_REVIEW' && (
        <div className="mt-5 p-3 rounded-xl bg-status-pending-bg/10 border border-status-pending-text/30 text-status-pending-text text-[10px] font-semibold leading-relaxed flex items-start gap-2">
          <span className="text-xs">⚠️</span>
          <span>
            <strong>AI Estimation Warning</strong>: This plan is still pending verification by a licensed Registered Nutritionist-Dietitian. Use with caution.
          </span>
        </div>
      )}
    </Card>
  );
}
