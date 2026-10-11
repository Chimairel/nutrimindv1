'use client';

import ReadOnlyFoodReferences from './ReadOnlyFoodReferences';
import { CheckCircle2, ClipboardCheck, Eye } from 'lucide-react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';

import type { useOutsideMealReviewsPanelModel } from './useOutsideMealReviewsPanelModel';
type Model = Extract<ReturnType<typeof useOutsideMealReviewsPanelModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<Model, 'selected' | 'setError' | 'correction' | 'setCorrection' | 'busy' | 'resolve'>;
};
export default function OutsideMealReviewDetail({ model }: SectionProps) {
  const { selected, setError, correction, setCorrection, busy, resolve } = model;

  return (
    <>
      <div>
        {!selected ? (
          <div className="rounded-3xl border border-brand-border/80 bg-brand-surface/90 p-6 sm:p-8 shadow-card space-y-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green/15 text-brand-green">
              <ClipboardCheck className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-black tracking-tight text-brand-text">
                A clear path to outside food review
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                Select an outside food estimate to inspect reported nutrition values, verify against reference ranges,
                and calibrate portions.
              </p>
            </div>
            <div className="grid gap-3 pt-2">
              {[
                {
                  step: '01',
                  title: 'Inspect logged intake',
                  desc: 'Review the member’s reported calories, macro distribution, and preparation context.',
                },
                {
                  step: '02',
                  title: 'Claim review lock',
                  desc: 'Claiming reserves the log for your review, preventing duplicate edits by other clinicians.',
                },
                {
                  step: '03',
                  title: 'Calibrate or clarify',
                  desc: 'Assess the estimate, adjust it against food references, or ask for more detail.',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="flex items-start gap-3.5 rounded-2xl border border-brand-border/60 bg-brand-bgAlt/50 p-4 transition-colors hover:border-brand-green/30"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-green/15 font-mono text-xs font-black text-brand-green">
                    {item.step}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-sm font-bold text-brand-text">{item.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-brand-muted">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-brand-border/80 bg-brand-surface/90 p-6 sm:p-7 shadow-card space-y-5">
            {/* Header */}
            <div className="space-y-3 border-b border-brand-border/60 pb-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-0.5 text-[10px] font-bold text-brand-green">
                    Active review
                  </span>
                  <span className="text-xs text-brand-muted">
                    Revision {selected.claimedRevision ?? selected.outsideMealLogItem.currentRevision}
                  </span>
                </div>
                <span className="rounded-full border border-brand-border/80 bg-brand-bgAlt/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                  {selected.queueReason?.replaceAll('_', ' ').toLowerCase() ?? 'Review'}
                </span>
              </div>
              <div>
                <h2 className="font-display text-2xl font-black text-brand-text">{selected.outsideMealLogItem.name}</h2>
                <p className="mt-1 text-xs text-brand-muted">
                  Logged for {selected.outsideMealLogItem.mealLog.mealType ?? 'meal'} ·{' '}
                  {new Date(selected.outsideMealLogItem.mealLog.loggedAt).toLocaleString()}
                </p>
              </div>
              <p className="text-xs leading-relaxed text-brand-muted">
                Portion:{' '}
                {selected.outsideMealLogItem.portionGrams != null
                  ? `${selected.outsideMealLogItem.portionGrams} g`
                  : 'Not recorded'}
                . Source: {selected.outsideMealLogItem.source?.replaceAll('_', ' ').toLowerCase() ?? 'Not recorded'}.{' '}
                This review assesses an estimate and does not approve a recipe.
              </p>
              {(selected.outsideMealLogItem.calorieLow !== null ||
                selected.outsideMealLogItem.calorieHigh !== null) && (
                <div className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border/70 bg-brand-bgAlt/60 px-3 py-1.5 text-xs text-brand-muted">
                  <span className="font-medium">Estimated range:</span>
                  <span className="font-bold text-brand-text">
                    {selected.outsideMealLogItem.calorieLow ?? '—'}–{selected.outsideMealLogItem.calorieHigh ?? '—'}{' '}
                    kcal
                  </span>
                </div>
              )}
              {selected.outsideMealLogItem.mealLog.estimationContext && (
                <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/70 p-3 text-xs leading-relaxed text-brand-muted">
                  <span className="font-bold text-brand-text">Preparation context: </span>
                  {selected.outsideMealLogItem.mealLog.estimationContext}
                </div>
              )}
              {selected.outsideMealLogItem.ingredients?.length ? (
                <div className="text-xs text-brand-muted">
                  <span className="font-semibold text-brand-text">Recorded ingredients: </span>
                  {selected.outsideMealLogItem.ingredients.join(', ')}
                </div>
              ) : null}
              {selected.outsideMealLogItem.mealLog.outsideImageMime && (
                <div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-brand-green/30 bg-brand-green/10 px-3 py-1.5 text-xs font-bold text-brand-green transition hover:bg-brand-green/20"
                    onClick={async () => {
                      try {
                        const response = await api.get(`/nutritionist/outside-meal-reviews/${selected.id}/image`, {
                          responseType: 'blob',
                        });
                        const url = URL.createObjectURL(response.data);
                        window.open(url, '_blank', 'noopener,noreferrer');
                        setTimeout(() => URL.revokeObjectURL(url), 60_000);
                      } catch (err) {
                        setError(getApiErrorMessage(err, 'Could not open this review image.'));
                      }
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View attached photo
                  </button>
                </div>
              )}
            </div>

            {/* Clarification History */}
            {selected.messages?.length > 0 && (
              <div className="space-y-2 rounded-2xl border border-brand-border/70 bg-brand-bgAlt/40 p-3.5 text-xs">
                <p className="font-display font-bold text-brand-text">Clarification history</p>
                <div className="space-y-2">
                  {selected.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-xl p-2.5 text-xs ${
                        message.sender === 'NUTRITIONIST'
                          ? 'border border-brand-green/25 bg-brand-green/10 text-brand-text'
                          : 'border border-brand-border bg-brand-surface text-brand-text'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-brand-muted mb-1">
                        <span className="font-bold">{message.sender === 'NUTRITIONIST' ? 'RND' : 'Member'}</span>
                        <span>revision {message.itemRevision}</span>
                      </div>
                      <p>{message.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Macro Calibration Form */}
            <div className="space-y-3">
              <h3 className="font-display text-sm font-bold text-brand-text">Calibrate macronutrients</h3>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-brand-text">
                  <span className="flex items-center gap-1 text-brand-muted mb-1">🔥 Calories (kcal)</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={correction.calories}
                    onChange={(e) => setCorrection((v) => ({ ...v, calories: e.target.value }))}
                    className="w-full rounded-xl border border-brand-border bg-brand-surface p-2.5 text-sm font-bold text-brand-text focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
                  />
                </label>
                <label className="text-xs font-bold text-brand-text">
                  <span className="flex items-center gap-1 text-[#08705b] dark:text-[#34d399] mb-1">Protein (g)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={correction.proteinG}
                    onChange={(e) => setCorrection((v) => ({ ...v, proteinG: e.target.value }))}
                    className="w-full rounded-xl border border-brand-border bg-brand-surface p-2.5 text-sm font-bold text-brand-text focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
                  />
                </label>
                <label className="text-xs font-bold text-brand-text">
                  <span className="flex items-center gap-1 text-[#0b7788] dark:text-[#38bdf8] mb-1">
                    Carbohydrates (g)
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={correction.carbsG}
                    onChange={(e) => setCorrection((v) => ({ ...v, carbsG: e.target.value }))}
                    className="w-full rounded-xl border border-brand-border bg-brand-surface p-2.5 text-sm font-bold text-brand-text focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
                  />
                </label>
                <label className="text-xs font-bold text-brand-text">
                  <span className="flex items-center gap-1 text-[#c74614] dark:text-[#f09e6c] mb-1">Fat (g)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={correction.fatG}
                    onChange={(e) => setCorrection((v) => ({ ...v, fatG: e.target.value }))}
                    className="w-full rounded-xl border border-brand-border bg-brand-surface p-2.5 text-sm font-bold text-brand-text focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
                  />
                </label>
              </div>
            </div>

            <ReadOnlyFoodReferences />

            {/* Review Reason */}
            <label className="block text-xs font-bold text-brand-text">
              <span className="block mb-1">Reference and review notes (required)</span>
              <textarea
                value={correction.reason}
                onChange={(e) => setCorrection((v) => ({ ...v, reason: e.target.value }))}
                className="w-full rounded-xl border border-brand-border bg-brand-surface p-3 text-xs leading-relaxed text-brand-text placeholder:text-brand-muted focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green min-h-24"
                placeholder="e.g. Compared with the cooked-food reference and the reported portion"
              />
            </label>

            {/* Actions */}
            <div className="flex flex-wrap gap-2.5 pt-1">
              <Button
                variant="primary"
                disabled={correction.reason.trim().length < 3 || busy}
                isLoading={busy}
                onClick={() => void resolve('VERIFY')}
                className="flex-1 sm:flex-initial"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Keep estimate
              </Button>
              <Button
                variant="secondary"
                disabled={correction.reason.trim().length < 3 || busy}
                onClick={() => void resolve('CORRECT')}
                className="flex-1 sm:flex-initial"
              >
                Save correction
              </Button>
              <Button
                variant="secondary"
                disabled={correction.reason.trim().length < 3 || busy}
                onClick={() => void resolve('NEEDS_MORE_INFO')}
              >
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Need info
              </Button>
              <Button
                variant="secondary"
                disabled={correction.reason.trim().length < 3 || busy}
                onClick={() => void resolve('UNVERIFIABLE')}
              >
                Mark unverifiable
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
