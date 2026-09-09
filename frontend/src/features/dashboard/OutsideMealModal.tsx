'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import type { MealType } from '@/types';
import type { OutsideMealInputItem, OutsideMealWarning } from './model';

type SubmitOptions = { useAiEstimate: boolean; items: OutsideMealInputItem[] };

type Props = {
  error: string | null;
  isLoading: boolean;
  isOpen: boolean;
  mealName: string;
  mealType: MealType;
  notes: string;
  onClose: () => void;
  onMealNameChange: (value: string) => void;
  onMealTypeChange: (value: MealType) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (acknowledgePreview: boolean, options?: SubmitOptions) => void;
  onWarningCancel: () => void;
  warning: OutsideMealWarning | null;
};

const mealLabels: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snack',
};

const sourceLabels: Record<OutsideMealWarning['items'][number]['source'], string> = {
  VERIFIED_LIBRARY: 'Verified library',
  FNRI: 'FNRI',
  USER_REPORTED: 'Your label values',
  GEMINI_ESTIMATED: 'AI estimate',
  NUTRITIONIST_REVIEWED: 'Nutritionist reviewed',
  UNRESOLVED: 'Unresolved',
};

function parseItems(value: string): OutsideMealInputItem[] {
  return value
    .split(',')
    .map((raw) => raw.trim())
    .filter(Boolean)
    .map((raw) => {
      const match = raw.match(/^(.*?)(?:\s*[-(]\s*)(\d+(?:\.\d+)?)\s*g(?:rams?)?\s*\)?$/i);
      return { name: (match?.[1] ?? raw).trim(), ...(match ? { portionGrams: Number(match[2]) } : {}) };
    });
}

export function OutsideMealModal(props: Props) {
  return (
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="LOG OUTSIDE FOOD">
      <div className="flex max-h-[76vh] flex-col gap-5 overflow-y-auto p-2 text-left">
        {props.error && (
          <div className="flex items-center gap-2 rounded-xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{props.error}</span>
          </div>
        )}
        {props.warning ? <PreviewConfirmation {...props} warning={props.warning} /> : <OutsideMealForm {...props} />}
      </div>
    </Modal>
  );
}

function PreviewConfirmation(props: Props & { warning: OutsideMealWarning }) {
  const { estimate, items, summary } = props.warning;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-brand-border bg-brand-bgAlt/50 p-4">
        <div className="mb-3 flex items-center gap-2 font-display text-sm font-extrabold uppercase">
          <CheckCircle2 className="h-4 w-4 text-brand-green" /> Review before logging
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
          <MacroEstimate label="Cal" value={Math.round(estimate.calories)} />
          <MacroEstimate label="Prot" value={`${Math.round(estimate.proteinG)}g`} tone="protein" />
          <MacroEstimate label="Carb" value={`${Math.round(estimate.carbsG)}g`} tone="carbs" />
          <MacroEstimate label="Fat" value={`${Math.round(estimate.fatG)}g`} tone="fat" />
        </div>
        {summary.provisionalItemCount > 0 && (
          <p className="mt-3 text-xs font-semibold text-status-pending-text">
            {Math.round(summary.provisionalCalories)} kcal is provisional and will update automatically after
            nutritionist review.
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
                <strong className="block text-brand-text">{item.name}</strong>
                <span className="text-brand-muted">{sourceLabels[item.source]}</span>
              </div>
              <span className="font-bold text-brand-text">
                {item.includedInTotals ? `${Math.round(item.calories)} kcal` : 'Not counted'}
              </span>
            </div>
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

      <div className="flex gap-3">
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
          isLoading={props.isLoading}
        >
          Confirm and log
        </Button>
      </div>
    </div>
  );
}

function OutsideMealForm(props: Props) {
  const [useAiEstimate, setUseAiEstimate] = useState(false);
  const [useManualValues, setUseManualValues] = useState(false);
  const [manual, setManual] = useState({ calories: '', proteinG: '', carbsG: '', fatG: '' });
  const items = useMemo(() => parseItems(props.mealName), [props.mealName]);
  const canUseManual = items.length === 1;

  const submit = () => {
    const submittedItems = items.map((item) => ({ ...item }));
    if (useManualValues && canUseManual) {
      submittedItems[0].reportedNutrition = {
        calories: Number(manual.calories),
        proteinG: Number(manual.proteinG),
        carbsG: Number(manual.carbsG),
        fatG: Number(manual.fatG),
      };
    }
    props.onSubmit(false, { useAiEstimate, items: submittedItems });
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-5"
    >
      <Input
        id="mealName"
        label="Foods eaten"
        placeholder="e.g. chicken adobo, rice (150g), banana"
        value={props.mealName}
        onChange={(event) => props.onMealNameChange(event.target.value)}
        disabled={props.isLoading}
        required
      />
      <p className="-mt-3 text-xs text-brand-muted">
        For multiple foods, separate each one with a comma. Add a measured portion like <strong>rice (150g)</strong> for
        FNRI matching.
      </p>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Foods to log">
          {items.map((item, index) => (
            <span
              key={`${item.name}-${index}`}
              className="rounded-full border border-brand-border bg-brand-bgAlt px-3 py-1 text-xs font-semibold"
            >
              {item.name}
              {item.portionGrams ? ` · ${item.portionGrams}g` : ''}
            </span>
          ))}
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-bold tracking-wide text-brand-text/90">Meal category</legend>
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
          {(Object.keys(mealLabels) as MealType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => props.onMealTypeChange(type)}
              className={`rounded-xl border py-2.5 outline-none transition-all ${props.mealType === type ? 'border-brand-green bg-brand-green/10 font-bold text-brand-green' : 'border-brand-border bg-brand-surface/40 text-brand-muted'}`}
            >
              {mealLabels[type]}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-brand-border p-3 text-xs">
        <input
          type="checkbox"
          checked={useAiEstimate}
          onChange={(event) => setUseAiEstimate(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          <strong className="flex items-center gap-1 text-brand-text">
            <Sparkles className="h-3.5 w-3.5" /> Use Premium AI if unresolved
          </strong>
          <span className="text-brand-muted">
            AI values count immediately as provisional and enter nutritionist review. Limits: 5 items/day and 30/30
            days.
          </span>
        </span>
      </label>

      <label
        className={`flex items-start gap-3 rounded-xl border border-brand-border p-3 text-xs ${canUseManual ? 'cursor-pointer' : 'opacity-50'}`}
      >
        <input
          type="checkbox"
          checked={useManualValues}
          disabled={!canUseManual}
          onChange={(event) => setUseManualValues(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          <strong className="block text-brand-text">I have nutrition-label or menu values</strong>
          <span className="text-brand-muted">
            Free and counted immediately. Log one food at a time when entering manual values.
          </span>
        </span>
      </label>
      {useManualValues && canUseManual && (
        <div className="grid grid-cols-2 gap-3">
          {(['calories', 'proteinG', 'carbsG', 'fatG'] as const).map((field) => (
            <Input
              key={field}
              id={`manual-${field}`}
              type="number"
              min="0"
              step="0.1"
              label={{ calories: 'Calories', proteinG: 'Protein (g)', carbsG: 'Carbs (g)', fatG: 'Fat (g)' }[field]}
              value={manual[field]}
              onChange={(event) => setManual((current) => ({ ...current, [field]: event.target.value }))}
              required
            />
          ))}
        </div>
      )}
      <Input
        id="notes"
        label="Notes (optional)"
        placeholder="e.g. restaurant, preparation, serving details"
        value={props.notes}
        onChange={(event) => props.onNotesChange(event.target.value)}
        disabled={props.isLoading}
      />
      <Button
        type="submit"
        variant="primary"
        className="w-full py-3.5 text-xs font-bold"
        disabled={items.length === 0 || items.length > 10}
        isLoading={props.isLoading}
      >
        Check nutrition sources
      </Button>
    </form>
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
