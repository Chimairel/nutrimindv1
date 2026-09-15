'use client';

import React, { useState } from 'react';
import { Apple, Check, ChevronDown, Egg, FileText, Flame, Loader2, Save, UtensilsCrossed, X } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { MealHistoryLog } from '@/features/meals/useMealsWorkspace';

interface MealHistoryCardProps {
  log: MealHistoryLog;
  onUpdateNotes?: (logId: string, notes: string | null) => Promise<void>;
  className?: string;
}

export default function MealHistoryCard({ log, onUpdateNotes, className = '' }: MealHistoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [noteInput, setNoteInput] = useState(log.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Normalize mealType from log.mealType or guess from mealName
  const normalizedType = (log.mealType || '').toUpperCase();
  const mealType = normalizedType.includes('BREAKFAST')
    ? 'BREAKFAST'
    : normalizedType.includes('DINNER')
      ? 'DINNER'
      : normalizedType.includes('SNACK')
        ? 'SNACK'
        : 'LUNCH';

  // Styling & Icons inspired by Image 3
  const mealTypeConfigs: Record<
    string,
    {
      label: string;
      icon: React.ComponentType<LucideProps>;
      iconColor: string;
      glowSurface: string;
    }
  > = {
    BREAKFAST: {
      label: 'Breakfast',
      icon: Egg,
      iconColor: 'text-amber-700 dark:text-amber-400',
      glowSurface:
        'bg-gradient-to-br from-amber-100 via-amber-50 to-white/90 border border-amber-200/80 shadow-[0_4px_14px_rgba(245,158,11,0.12)] dark:from-amber-950/40 dark:via-amber-900/15 dark:to-transparent dark:border-amber-700/30',
    },
    LUNCH: {
      label: 'Lunch',
      icon: Flame,
      iconColor: 'text-rose-600 dark:text-rose-400',
      glowSurface:
        'bg-gradient-to-br from-rose-100 via-rose-50 to-white/90 border border-rose-200/80 shadow-[0_4px_14px_rgba(244,63,94,0.12)] dark:from-rose-950/40 dark:via-rose-900/15 dark:to-transparent dark:border-rose-700/30',
    },
    DINNER: {
      label: 'Dinner',
      icon: Flame,
      iconColor: 'text-rose-600 dark:text-rose-400',
      glowSurface:
        'bg-gradient-to-br from-rose-100 via-rose-50 to-white/90 border border-rose-200/80 shadow-[0_4px_14px_rgba(244,63,94,0.12)] dark:from-rose-950/40 dark:via-rose-900/15 dark:to-transparent dark:border-rose-700/30',
    },
    SNACK: {
      label: 'Snack',
      icon: Apple,
      iconColor: 'text-brand-green dark:text-brand-accent',
      glowSurface:
        'bg-gradient-to-br from-emerald-100 via-emerald-50 to-white/90 border border-emerald-200/80 shadow-[0_4px_14px_rgba(16,185,129,0.12)] dark:from-emerald-950/40 dark:via-emerald-900/15 dark:to-transparent dark:border-emerald-700/30',
    },
  };

  const config = mealTypeConfigs[mealType] || {
    label: 'Meal',
    icon: UtensilsCrossed,
    iconColor: 'text-brand-green',
    glowSurface: 'bg-brand-bgAlt border border-brand-border',
  };

  const IconComponent = config.icon;

  const handleSaveNotes = async () => {
    if (!onUpdateNotes || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await onUpdateNotes(log.id, noteInput.trim() ? noteInput.trim() : null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch {
      setSaveError('Failed to save note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const isDone = log.status === 'DONE';
  const isSkipped = log.status === 'SKIPPED';
  const deltaVal = log.calorieDelta;
  const hasDelta = deltaVal !== null && deltaVal !== undefined;

  return (
    <article
      className={`rounded-[24px] border bg-brand-surface text-left transition-all duration-200 ${
        isExpanded
          ? 'border-brand-green ring-1 ring-brand-green/30 shadow-card'
          : 'border-brand-border/80 hover:border-brand-green/40 hover:shadow-sm'
      } dark:border-white/10 dark:bg-white/[0.035] ${className}`}
    >
      {/* Primary Card Row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        aria-expanded={isExpanded}
        className="flex cursor-pointer items-center justify-between gap-4 p-4 sm:p-5 outline-none focus-visible:ring-2 focus-visible:ring-brand-green rounded-[24px]"
      >
        {/* Left Glowing Icon Box */}
        <div
          className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${config.glowSurface}`}
        >
          <IconComponent className={`h-7 w-7 ${config.iconColor} stroke-[2]`} />
        </div>

        {/* Center Details */}
        <div className="min-w-0 flex-1">
          {/* Top Label (Green Category Text) */}
          <div className="flex items-center gap-2">
            <span className="font-display text-xs font-extrabold text-brand-green dark:text-brand-accent tracking-wide">
              {config.label}
            </span>
            {log.source === 'SYSTEM_GENERATED' && (
              <span className="rounded bg-brand-green/10 px-1.5 py-0.5 font-mono text-[8px] font-extrabold uppercase tracking-wider text-brand-green dark:bg-brand-accent/15 dark:text-brand-accent">
                KAINARA
              </span>
            )}
            {log.source === 'USER_LOGGED' && (
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[8px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Outside Meal
              </span>
            )}
            {log.source === 'USER_SWAPPED' && (
              <span className="rounded bg-brand-cyan/10 px-1.5 py-0.5 font-mono text-[8px] font-extrabold uppercase tracking-wider text-brand-green dark:text-brand-cyan">
                Swapped
              </span>
            )}
          </div>

          {/* Meal Title */}
          <h4
            className={`mt-1 font-display text-sm sm:text-base font-bold leading-snug text-brand-text dark:text-white truncate ${
              isDone ? '' : isSkipped ? 'line-through text-brand-muted dark:text-white/40' : ''
            }`}
          >
            {log.mealName}
          </h4>

          {/* Macro Line */}
          <p className="mt-1 font-mono text-xs text-brand-muted dark:text-white/50">
            <span className="font-bold text-brand-text dark:text-white/90">{Math.round(log.calories)} kcal</span>
            <span className="mx-1.5">·</span>
            <span>{Math.round(log.proteinG)}g protein</span>
            <span className="mx-1.5 hidden sm:inline">·</span>
            <span className="hidden sm:inline">{Math.round(log.carbsG)}g carbs</span>
            <span className="mx-1.5 hidden sm:inline">·</span>
            <span className="hidden sm:inline">{Math.round(log.fatG)}g fat</span>
          </p>

          {/* Subtext / Notes preview */}
          <div className="mt-1.5 flex items-center gap-2 text-[11px]">
            {log.notes ? (
              <span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
                <FileText className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[240px] sm:max-w-md italic">&ldquo;{log.notes}&rdquo;</span>
              </span>
            ) : (
              <span className="font-medium text-brand-muted/75 dark:text-white/35 hover:underline">
                {isDone ? 'Add notes to this meal' : 'View meal details'}
              </span>
            )}
          </div>
        </div>

        {/* Right Status Badge & Chevron */}
        <div className="flex shrink-0 items-center gap-3">
          {hasDelta && log.source === 'USER_SWAPPED' && (
            <span
              className={`hidden sm:inline-block rounded-lg px-2 py-1 font-mono text-[10px] font-bold border ${
                deltaVal > 0
                  ? 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'border-brand-green/25 bg-brand-green/10 text-brand-green dark:text-brand-accent'
              }`}
            >
              {deltaVal > 0 ? `+${Math.round(deltaVal)}` : Math.round(deltaVal)} kcal
            </span>
          )}

          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wider ${
              isDone
                ? 'bg-brand-green/15 text-brand-green border border-brand-green/30 dark:bg-brand-accent/15 dark:text-brand-accent dark:border-brand-accent/30'
                : isSkipped
                  ? 'bg-red-500/15 text-red-600 border border-red-500/30 dark:bg-red-500/20 dark:text-red-400'
                  : 'bg-amber-500/15 text-amber-600 border border-amber-500/30'
            }`}
          >
            {isDone ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : <X className="h-2.5 w-2.5 stroke-[3]" />}
            {log.status}
          </span>

          <ChevronDown
            className={`h-4 w-4 text-brand-muted transition-transform duration-200 dark:text-white/40 ${
              isExpanded ? 'rotate-180 text-brand-green dark:text-brand-accent' : ''
            }`}
          />
        </div>
      </div>

      {/* Expandable Drawer: Notes & Detailed Breakdown */}
      {isExpanded && (
        <div className="border-t border-brand-border/60 bg-brand-bgAlt/30 p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.015] rounded-b-[24px]">
          {/* Macros Detailed Strip */}
          <div className="mb-4 grid grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded-xl border border-brand-border/60 bg-brand-surface p-2 dark:border-white/5 dark:bg-white/[0.04]">
              <span className="font-mono text-[9px] text-brand-muted uppercase tracking-wider block">Calories</span>
              <span className="font-display font-extrabold text-brand-text dark:text-white">
                {Math.round(log.calories)} kcal
              </span>
            </div>
            <div className="rounded-xl border border-brand-border/60 bg-brand-surface p-2 dark:border-white/5 dark:bg-white/[0.04]">
              <span className="font-mono text-[9px] text-brand-muted uppercase tracking-wider block">Protein</span>
              <span className="font-display font-extrabold text-brand-green dark:text-brand-accent">
                {Math.round(log.proteinG)}g
              </span>
            </div>
            <div className="rounded-xl border border-brand-border/60 bg-brand-surface p-2 dark:border-white/5 dark:bg-white/[0.04]">
              <span className="font-mono text-[9px] text-brand-muted uppercase tracking-wider block">Carbs</span>
              <span className="font-display font-extrabold text-amber-600 dark:text-amber-400">
                {Math.round(log.carbsG)}g
              </span>
            </div>
            <div className="rounded-xl border border-brand-border/60 bg-brand-surface p-2 dark:border-white/5 dark:bg-white/[0.04]">
              <span className="font-mono text-[9px] text-brand-muted uppercase tracking-wider block">Fat</span>
              <span className="font-display font-extrabold text-rose-600 dark:text-rose-400">
                {Math.round(log.fatG)}g
              </span>
            </div>
          </div>

          {/* Outside Items list if available */}
          {log.outsideItems && log.outsideItems.length > 0 && (
            <div className="mb-4 rounded-xl border border-brand-border/60 bg-brand-surface/70 p-3 text-xs dark:border-white/5 dark:bg-white/[0.03]">
              <p className="font-bold text-brand-muted uppercase tracking-wider text-[10px] mb-1.5">
                Logged Food Items
              </p>
              <div className="flex flex-wrap gap-1.5">
                {log.outsideItems.map((item, idx) => (
                  <span
                    key={`${item.name}-${idx}`}
                    className="rounded-lg border border-brand-border/80 bg-brand-bgAlt px-2.5 py-1 text-xs text-brand-text dark:border-white/10 dark:bg-white/5 dark:text-white"
                  >
                    {item.name}
                    {item.portionGrams ? ` (${item.portionGrams}g)` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Note Editor Area */}
          <div className="rounded-2xl border border-brand-border/80 bg-brand-surface p-4 shadow-sm dark:border-white/10 dark:bg-[#121e19]">
            <div className="flex items-center justify-between mb-2">
              <label
                htmlFor={`meal-note-${log.id}`}
                className="flex items-center gap-1.5 font-display text-xs font-bold text-brand-text dark:text-white"
              >
                <FileText className="h-3.5 w-3.5 text-brand-green dark:text-brand-accent" />
                Personal Meal Notes
              </label>
              <span className="font-mono text-[10px] text-brand-muted dark:text-white/40">
                {noteInput.length} / 1000
              </span>
            </div>

            <textarea
              id={`meal-note-${log.id}`}
              rows={2}
              maxLength={1000}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Add personal note (e.g. portion adjustment, how you felt, substitutions made)..."
              className="w-full rounded-xl border border-brand-border bg-brand-bgAlt/50 p-3 text-xs text-brand-text outline-none transition focus:border-brand-green focus:bg-brand-surface dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-brand-accent resize-none"
            />

            {saveError && <p className="mt-1 text-[11px] font-semibold text-status-error-text">{saveError}</p>}

            <div className="mt-3 flex items-center justify-between">
              {saveSuccess ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-brand-green dark:text-brand-accent animate-fadeIn">
                  <Check className="h-3.5 w-3.5 stroke-[3]" /> Note saved
                </span>
              ) : (
                <span className="text-[10px] text-brand-muted dark:text-white/40">
                  Notes are private to your personal timeline.
                </span>
              )}

              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={isSaving || noteInput === (log.notes || '')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-green bg-brand-green px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-green/90 disabled:cursor-not-allowed disabled:opacity-40 dark:border-brand-accent dark:bg-brand-accent dark:text-[#07100d]"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                <span>Save Note</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
