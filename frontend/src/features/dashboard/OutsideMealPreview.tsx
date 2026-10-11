import OutsideReviewRequestButton from '@/features/membership/OutsideReviewRequestButton';
import { formatMealTitle } from '@/lib/meal-title';
import Button from '@/components/ui/Button';
import { AlertCircle, Calculator } from 'lucide-react';
import type { OutsideMealWarning } from './model';
import type { OutsideMealModalProps as Props } from './outside-meal-modal.types';

const sourceLabels: Record<OutsideMealWarning['items'][number]['source'], string> = {
  VERIFIED_LIBRARY: 'Verified library',
  FNRI: 'FNRI',
  USER_REPORTED: 'Your label values',
  USER_ADJUSTED_LIBRARY: 'Library recipe, values adjusted by you',
  GEMINI_ESTIMATED: 'AI estimate',
  NUTRITIONIST_REVIEWED: 'RND-reviewed estimate',
  UNRESOLVED: 'Unresolved',
};

export default function PreviewConfirmation(props: Props & { warning: OutsideMealWarning }) {
  const { estimate, items, summary } = props.warning;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-brand-border bg-brand-bgAlt/50 p-4">
        <div className="mb-3 flex items-center gap-2 font-display text-sm font-extrabold uppercase">
          <Calculator className="h-4 w-4 text-brand-green" /> Your nutrition estimate
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
          <MacroEstimate label="Cal" value={Math.round(estimate.calories)} />
          <MacroEstimate label="Prot" value={`${Math.round(estimate.proteinG)}g`} tone="protein" />
          <MacroEstimate label="Carb" value={`${Math.round(estimate.carbsG)}g`} tone="carbs" />
          <MacroEstimate label="Fat" value={`${Math.round(estimate.fatG)}g`} tone="fat" />
        </div>
        {summary.provisionalItemCount > 0 && (
          <p className="mt-3 text-xs font-semibold text-status-pending-text">
            {Math.round(summary.provisionalCalories)} kcal remains estimated. Saving it does not request RND review.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <div
            key={`${item.name}-${index}`}
            className="rounded-xl border border-brand-border/60 bg-brand-surface/60 p-3 text-xs"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <strong className="block text-brand-text">{formatMealTitle(item.name)}</strong>
                <span className="text-brand-muted">{sourceLabels[item.source]}</span>
              </div>
              <span className="font-bold text-brand-text">
                {item.includedInTotals ? `${Math.round(item.calories)} kcal` : 'Not counted'}
              </span>
            </div>
            {item.portionGrams && <p className="mt-1 text-brand-muted">Portion: about {item.portionGrams} g</p>}
            {!item.portionGrams && item.servingDescription && (
              <p className="mt-1 text-brand-muted">Serving: {item.servingDescription}</p>
            )}
            {item.includedInTotals && (
              <p className="mt-1 text-brand-muted">
                Protein {Math.round(item.proteinG)}g · Carbs {Math.round(item.carbsG)}g · Fat {Math.round(item.fatG)}g
              </p>
            )}
            {item.calorieLow !== null && item.calorieHigh !== null && (
              <p className="mt-1 text-brand-muted">
                Estimated range: {Math.round(item.calorieLow)}–{Math.round(item.calorieHigh)} kcal
              </p>
            )}
          </div>
        ))}
      </div>

      {props.warning.reasons.length > 0 && (
        <div className="rounded-xl border border-status-pending-text/30 bg-status-pending-bg/10 p-4 text-status-pending-text">
          <span className="flex items-center gap-1.5 font-display text-xs font-extrabold uppercase">
            <AlertCircle className="h-4 w-4" /> Important context
          </span>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs font-semibold">
            {[...new Set(props.warning.reasons)].map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {summary.unresolvedItemCount > 0 && (
        <p className="text-xs text-status-pending-text">
          {summary.unresolvedItemCount} unresolved item(s) are excluded from this partial total.
        </p>
      )}

      <div className="space-y-4 border-t border-brand-border pt-4">
        <p className="text-sm leading-relaxed text-brand-muted">
          Save these values for tracking, or request an RND review of the whole meal. Reviewed values are still
          estimates.
        </p>
        <div className="flex flex-wrap items-start gap-3">
          <Button
            variant="secondary"
            className="flex-1 text-xs font-bold"
            onClick={props.onWarningCancel}
            disabled={props.isLoading}
          >
            Back
          </Button>
          <Button
            variant="primary"
            className="flex-1 text-xs font-bold"
            onClick={() => props.onSubmit(true)}
            disabled={props.isLoading}
          >
            Use estimate
          </Button>
        </div>
        <OutsideReviewRequestButton busy={props.isLoading} onRequest={() => props.onSubmit(true, undefined, true)} />
      </div>
    </div>
  );
}

function MacroEstimate({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: 'protein' | 'carbs' | 'fat';
}) {
  const style = tone ? { backgroundColor: `var(--macro-${tone}-bg)`, color: `var(--macro-${tone})` } : undefined;
  return (
    <div className="rounded-lg border border-brand-border/20 bg-brand-border/30 p-2.5" style={style}>
      <span className="mb-0.5 block text-[9px] uppercase text-brand-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
