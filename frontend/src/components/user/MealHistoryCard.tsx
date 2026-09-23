'use client';

import React, { useState } from 'react';
import { Apple, Check, ChevronDown, Egg, FileText, Flame, Loader2, Save, UtensilsCrossed, X } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import type { MealHistoryLog } from '@/features/meals/useMealsWorkspace';
import api from '@/lib/axios';

interface MealHistoryCardProps {
  log: MealHistoryLog;
  onUpdateNotes?: (logId: string, notes: string | null) => Promise<void>;
  onEditOutsideItem?: (logId: string, itemId: string, input: {
    name: string; portionGrams: number | null;
    reportedNutrition?: { calories: number; proteinG: number; carbsG: number; fatG: number };
    unresolved?: boolean; reason: string;
  }) => Promise<void>;
  onVoidOutsideLog?: (logId: string, reason: string) => Promise<void>;
  onRequestOutsideReview?: (logId: string, itemId: string) => Promise<void>;
  onReplyToOutsideReview?: (logId: string, itemId: string, message: string) => Promise<void>;
  onObservedConsent?: (logId: string, itemId: string, imageReuseConsent: boolean) => Promise<void>;
  onObservedWithdraw?: (submissionId: string) => Promise<void>;
  className?: string;
}

export default function MealHistoryCard({ log, onUpdateNotes, onEditOutsideItem, onVoidOutsideLog,
  onRequestOutsideReview, onReplyToOutsideReview, onObservedConsent, onObservedWithdraw,
  className = '' }: MealHistoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [noteInput, setNoteInput] = useState(log.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ name: '', portionGrams: '', calories: '', proteinG: '', carbsG: '', fatG: '', reason: '' });
  const [markUnresolved, setMarkUnresolved] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isChanging, setIsChanging] = useState(false);
  const [clarification, setClarification] = useState('');
  const [consentItemId, setConsentItemId] = useState<string | null>(null);
  const [shareImage, setShareImage] = useState(false);

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
  const isVoided = log.status === 'VOIDED';
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
              isDone ? '' : isSkipped || isVoided ? 'line-through text-brand-muted dark:text-white/40' : ''
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
            {isVoided ? 'VOIDED' : log.status}
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
              {log.nutritionCompleteness && log.nutritionCompleteness !== 'COMPLETE' &&
                <p className="mb-2 text-brand-muted">Partial total: unresolved items are excluded, not counted as zero.</p>}
              {log.provisionalCalories ? <p className="mb-2 text-amber-600">{Math.round(log.provisionalCalories)} kcal remains estimated.</p> : null}
              <div className="space-y-2">
                {log.outsideItems.map((item, idx) => (
                  <div
                    key={`${item.name}-${idx}`}
                    className="rounded-lg border border-brand-border/80 bg-brand-bgAlt px-2.5 py-2 text-xs text-brand-text dark:border-white/10 dark:bg-white/5 dark:text-white"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span>{item.name}{item.portionGrams ? ` (${item.portionGrams}g)` : ''} · {item.includedInTotals ? `${Math.round(item.calories ?? 0)} kcal` : 'Unresolved'} · {item.source?.replaceAll('_', ' ').toLowerCase()} · revision {item.currentRevision ?? 0}</span>
                      {log.source === 'USER_LOGGED' && !isVoided && onEditOutsideItem && <button type="button" className="text-brand-green underline" onClick={() => {
                        setEditingItemId(item.id);
                        setEditDraft({ name: item.name, portionGrams: String(item.portionGrams ?? ''),
                          calories: String(item.calories ?? ''), proteinG: String(item.proteinG ?? ''),
                          carbsG: String(item.carbsG ?? ''), fatG: String(item.fatG ?? ''), reason: '' });
                        setMarkUnresolved(!item.includedInTotals);
                      }}>Correct</button>}
                    </div>
                    {editingItemId === item.id && <form className="mt-3 grid grid-cols-2 gap-2" onSubmit={async (event) => {
                      event.preventDefault();
                      if (!onEditOutsideItem) return;
                      setIsChanging(true); setSaveError(null);
                      try {
                        await onEditOutsideItem(log.id, item.id, {
                          name: editDraft.name, portionGrams: editDraft.portionGrams ? Number(editDraft.portionGrams) : null,
                          ...(markUnresolved ? { unresolved: true } : { reportedNutrition: {
                            calories: Number(editDraft.calories), proteinG: Number(editDraft.proteinG),
                            carbsG: Number(editDraft.carbsG), fatG: Number(editDraft.fatG),
                          } }), reason: editDraft.reason || 'User corrected this record',
                        });
                        setEditingItemId(null);
                      } catch { setSaveError('Could not revise this item. Reload and try again.'); }
                      finally { setIsChanging(false); }
                    }}>
                      <input className="col-span-2 rounded border p-2" aria-label="Corrected food name" value={editDraft.name} onChange={(event) => setEditDraft((draft) => ({ ...draft, name: event.target.value }))} required />
                      <input className="rounded border p-2" type="number" min="1" max="5000" step="0.1" aria-label="Corrected portion grams" placeholder="Portion g" value={editDraft.portionGrams} onChange={(event) => setEditDraft((draft) => ({ ...draft, portionGrams: event.target.value }))} />
                      <label className="flex items-center gap-1"><input type="checkbox" checked={markUnresolved} onChange={(event) => setMarkUnresolved(event.target.checked)} /> Unknown nutrition</label>
                      {!markUnresolved && (['calories', 'proteinG', 'carbsG', 'fatG'] as const).map((field) => <input key={field} className="rounded border p-2" type="number" min="0" step="0.1" required aria-label={`Corrected ${field}`} placeholder={field} value={editDraft[field]} onChange={(event) => setEditDraft((draft) => ({ ...draft, [field]: event.target.value }))} />)}
                      <input className="col-span-2 rounded border p-2" aria-label="Reason for correction" placeholder="What changed?" value={editDraft.reason} onChange={(event) => setEditDraft((draft) => ({ ...draft, reason: event.target.value }))} />
                      <button disabled={isChanging} className="rounded bg-brand-green p-2 font-bold text-white" type="submit">Save revision</button>
                      <button type="button" onClick={() => setEditingItemId(null)}>Cancel</button>
                    </form>}
                    {log.source === 'USER_LOGGED' && <div className="mt-2 space-y-2 border-t border-brand-border/60 pt-2">
                      <p className="font-semibold text-brand-muted">
                        {item.review?.status === 'PENDING' ? 'Queued for nutrition estimate review' :
                          item.review?.status === 'CLAIMED' ? 'Nutrition estimate under review' :
                          item.review?.status === 'VERIFIED' ? 'Nutrition estimate confirmed' :
                          item.review?.status === 'CORRECTED' ? 'Corrected and confirmed nutrition estimate' :
                          item.review?.status === 'NEEDS_MORE_INFO' ? 'Nutritionist needs more information' :
                          item.review?.status === 'UNVERIFIABLE' ? 'Estimate could not be confirmed; it remains estimated' :
                          'No nutritionist review requested'}
                      </p>
                      {item.review && ['VERIFIED', 'CORRECTED', 'UNVERIFIABLE'].includes(item.review.status) &&
                        item.revisions?.[0]?.revision === (item.review.reviewedRevision ?? -1) + 1 && item.revisions[0].reason &&
                        <p className="rounded-lg bg-brand-surface p-2 text-brand-muted">
                          Nutritionist rationale: {item.revisions[0].reason}
                        </p>}
                      {item.review?.messages?.map((message) => <p key={message.id} className="rounded-lg bg-brand-surface p-2 text-brand-muted">
                        <strong>{message.sender === 'NUTRITIONIST' ? 'Nutritionist' : 'You'}:</strong> {message.content}
                        <span className="ml-2 text-[10px]">Revision {message.itemRevision}</span>
                      </p>)}
                      {!isVoided && item.review?.status === 'NEEDS_MORE_INFO' && onReplyToOutsideReview &&
                        <form className="space-y-2" onSubmit={async (event) => {
                          event.preventDefault(); setIsChanging(true); setSaveError(null);
                          try { await onReplyToOutsideReview(log.id, item.id, clarification.trim()); setClarification(''); }
                          catch { setSaveError('Could not send your clarification.'); }
                          finally { setIsChanging(false); }
                        }}>
                          <textarea className="w-full rounded border p-2" maxLength={1000} value={clarification}
                            onChange={(event) => setClarification(event.target.value)}
                            placeholder="Answer the specific nutritionist question" aria-label="Clarification reply" />
                          <button type="submit" disabled={isChanging || clarification.trim().length < 3}
                            className="rounded bg-brand-green px-3 py-1 font-bold text-white disabled:opacity-50">Send clarification</button>
                        </form>}
                      {!isVoided && onRequestOutsideReview &&
                        (!item.review || ['VERIFIED', 'CORRECTED', 'UNVERIFIABLE'].includes(item.review.status)) &&
                        <button type="button" disabled={isChanging} className="text-brand-green underline" onClick={async () => {
                          setIsChanging(true); setSaveError(null);
                          try { await onRequestOutsideReview(log.id, item.id); }
                          catch { setSaveError('Could not request estimate review.'); }
                          finally { setIsChanging(false); }
                        }}>{item.review ? 'Request another estimate review' : 'Request nutrition estimate review'}</button>}
                      {!isVoided && ['VERIFIED', 'CORRECTED'].includes(item.review?.status ?? '') &&
                        item.portionGrams && item.portionGrams > 0 && (() => {
                          const submission = item.observedSubmissions?.find((row) =>
                            row.sourceRevision === item.currentRevision && row.status !== 'WITHDRAWN');
                          return submission ? <div className="text-xs text-brand-muted">
                            <p>Deidentified food-detail reuse: {submission.status.replaceAll('_', ' ').toLowerCase()}.
                              This does not certify a recipe or reuse your private notes.</p>
                            {onObservedWithdraw && <button type="button" className="text-brand-green underline"
                              disabled={isChanging} onClick={async () => {
                                setIsChanging(true); setSaveError(null);
                                try { await onObservedWithdraw(submission.id); }
                                catch { setSaveError('Could not withdraw reuse permission.'); }
                                finally { setIsChanging(false); }
                              }}>Withdraw future reuse</button>}
                          </div> : consentItemId === item.id ? <div className="space-y-2 rounded-lg border border-brand-border p-3 text-xs">
                            <p>Allow a nutritionist to turn this confirmed estimate into a deidentified food reference or recipe candidate. Your identity and private notes will not be shared. This is optional.</p>
                            {log.hasImage && <label className="flex items-start gap-2"><input type="checkbox"
                              checked={shareImage} onChange={(event) => setShareImage(event.target.checked)} />
                              I own this photo and separately allow its reuse. Photos are not currently copied into the shared corpus.</label>}
                            <div className="flex gap-3"><button type="button" disabled={isChanging}
                              className="text-brand-green underline" onClick={async () => {
                                if (!onObservedConsent) return;
                                setIsChanging(true); setSaveError(null);
                                try { await onObservedConsent(log.id, item.id, shareImage); setConsentItemId(null); }
                                catch { setSaveError('Could not submit reuse permission.'); }
                                finally { setIsChanging(false); }
                              }}>Allow deidentified details</button>
                              <button type="button" onClick={() => setConsentItemId(null)}>Cancel</button></div>
                          </div> : onObservedConsent && <button type="button"
                            className="text-brand-green underline" onClick={() => { setShareImage(false); setConsentItemId(item.id); }}>
                            Optionally share deidentified food details
                          </button>;
                        })()}
                    </div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {log.source === 'USER_LOGGED' && log.hasImage && <button type="button" className="mb-3 text-xs text-brand-green underline" onClick={async () => {
            try {
              const response = await api.get(`/user/meals/logs/${log.id}/image`, { responseType: 'blob' });
              const url = URL.createObjectURL(response.data);
              window.open(url, '_blank', 'noopener,noreferrer');
              setTimeout(() => URL.revokeObjectURL(url), 60_000);
            } catch { setSaveError('Could not open the image.'); }
          }}>View attached photo</button>}
          {log.source === 'USER_LOGGED' && !isVoided && onVoidOutsideLog && <div className="mb-4 rounded-xl border border-red-500/30 p-3 text-xs">
            <p className="font-bold text-red-600">Remove this entry from active totals</p>
            <p className="mb-2 text-brand-muted">The original record and corrections remain in your history.</p>
            <input className="w-full rounded border p-2" aria-label="Reason for voiding" placeholder="Reason for voiding this entry" value={voidReason} onChange={(event) => setVoidReason(event.target.value)} />
            <button type="button" disabled={isChanging || voidReason.trim().length < 3} className="mt-2 rounded border border-red-500 px-3 py-1 text-red-600 disabled:opacity-50" onClick={async () => {
              setIsChanging(true); setSaveError(null);
              try { await onVoidOutsideLog(log.id, voidReason.trim()); }
              catch { setSaveError('Could not void this entry.'); }
              finally { setIsChanging(false); }
            }}>Void outside meal</button>
          </div>}

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
