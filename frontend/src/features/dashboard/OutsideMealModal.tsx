'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import type { MealType } from '@/types';
import type { OutsideMealInputItem, OutsideMealWarning } from './model';
import api from '@/lib/axios';

type SubmitOptions = {
  useAiEstimate: boolean;
  items: OutsideMealInputItem[];
  consumedAt: string;
  estimationContext: string;
  imageFile: File | null;
};
type Suggestion = { kind: string; id: string; name: string; label: string; serving?: string;
  macros?: { calories: number; proteinG: number; carbsG: number; fatG: number } };

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
  savedSafety?: { status: string; messages: string[] } | null;
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
  USER_ADJUSTED_LIBRARY: 'Library recipe, values adjusted by you',
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
        {props.savedSafety ? (
          <div className="space-y-4 rounded-xl border border-brand-border p-4 text-sm">
            <h3 className="font-bold text-brand-text">Meal recorded</h3>
            <p className="text-brand-muted">
              {props.savedSafety.status === 'CONFLICT_DETECTED'
                ? 'A possible conflict was found in what you recorded. The entry remains in your tracker.'
                : props.savedSafety.status === 'NO_KNOWN_CONFLICT'
                  ? 'The entry is in your tracker.'
                  : 'There is not enough evidence to assess full compatibility. The entry remains in your tracker.'}
            </p>
            {props.savedSafety.messages.length > 0 && <ul className="list-disc space-y-1 pl-5 text-brand-muted">
              {props.savedSafety.messages.map((message) => <li key={message}>{message}</li>)}
            </ul>}
            <Button variant="primary" onClick={props.onClose}>Done</Button>
          </div>
        ) : props.warning ? <PreviewConfirmation {...props} warning={props.warning} /> : <OutsideMealForm {...props} />}
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
            {Math.round(summary.provisionalCalories)} kcal is estimated or based on an unconfirmed reference.
            It will change only if this entry is corrected or reviewed.
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
            {item.portionGrams && <p className="mt-1 text-brand-muted">Portion: about {item.portionGrams} g</p>}
            {!item.portionGrams && item.servingDescription && <p className="mt-1 text-brand-muted">Serving: {item.servingDescription}</p>}
            {item.includedInTotals && <p className="mt-1 text-brand-muted">
              Protein {Math.round(item.proteinG)}g · Carbs {Math.round(item.carbsG)}g · Fat {Math.round(item.fatG)}g
            </p>}
            {item.calorieLow !== null && item.calorieHigh !== null && (
              <p className="mt-1 text-brand-muted">
                Estimated range: {Math.round(item.calorieLow)}–{Math.round(item.calorieHigh)} kcal
              </p>
            )}
          </div>
        ))}
      </div>

      {summary.unresolvedItemCount > 0 && <p className="text-xs text-status-pending-text">
        {summary.unresolvedItemCount} unresolved item(s) are excluded from this partial total.
      </p>}

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
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [suggestions, setSuggestions] = useState<{ eligible: Suggestion[]; otherKnown: Suggestion[] } | null>(null);
  const [portionInput, setPortionInput] = useState('');
  const [estimationContext, setEstimationContext] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [consumedLocal, setConsumedLocal] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });
  const items = useMemo(() => selectedSuggestion?.name === props.mealName.trim()
    ? [{ name: selectedSuggestion.name }]
    : parseItems(props.mealName), [props.mealName, selectedSuggestion]);
  const canUseManual = items.length === 1;

  useEffect(() => {
    if (!props.isOpen || props.mealName.includes(',') || props.mealName.trim().length < 2 ||
        selectedSuggestion?.name === props.mealName.trim()) {
      setSuggestions(null);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const response = await api.get('/user/meals/outside-suggestions', { params: { search: props.mealName.trim() } });
        if (active) setSuggestions(response.data.data);
      } catch { if (active) setSuggestions(null); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [props.isOpen, props.mealName, selectedSuggestion]);

  const submit = () => {
    const submittedItems = items.map((item) => ({ ...item }));
    if (canUseManual && (selectedSuggestion?.kind === 'ELIGIBLE_LIBRARY' || selectedSuggestion?.kind === 'KNOWN_CATALOG')) {
      submittedItems[0].mealLibraryId = selectedSuggestion.id;
    }
    if (canUseManual && selectedSuggestion?.kind !== 'ELIGIBLE_LIBRARY' && !submittedItems[0].portionGrams && Number(portionInput) > 0) {
      submittedItems[0].portionGrams = Number(portionInput);
    }
    if (useManualValues && canUseManual) {
      const reported = {
        calories: Number(manual.calories),
        proteinG: Number(manual.proteinG),
        carbsG: Number(manual.carbsG),
        fatG: Number(manual.fatG),
      };
      const reference = selectedSuggestion?.macros;
      if (!reference || (Object.keys(reported) as Array<keyof typeof reported>).some((key) => reported[key] !== reference[key])) {
        submittedItems[0].reportedNutrition = reported;
      }
    }
    props.onSubmit(false, {
      useAiEstimate,
      items: submittedItems,
      consumedAt: new Date(consumedLocal).toISOString(),
      estimationContext,
      imageFile,
    });
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
        onChange={(event) => { setSelectedSuggestion(null); props.onMealNameChange(event.target.value); }}
        disabled={props.isLoading}
        required
      />
      {suggestions && (suggestions.eligible.length > 0 || suggestions.otherKnown.length > 0) && <div className="-mt-3 max-h-44 space-y-1 overflow-y-auto rounded-xl border border-brand-border p-2 text-xs">
        {suggestions.eligible.map((suggestion) => <button type="button" key={`eligible-${suggestion.id}`}
          className="block w-full rounded-lg p-2 text-left hover:bg-brand-green/10" onClick={() => {
            setSelectedSuggestion(suggestion); props.onMealNameChange(suggestion.name); setSuggestions(null);
            if (suggestion.macros) {
              setManual(Object.fromEntries(Object.entries(suggestion.macros).map(([key, value]) => [key, String(value)])) as typeof manual);
              setUseManualValues(true);
            }
          }}><strong>{suggestion.name}</strong> · {suggestion.label} · {suggestion.serving}</button>)}
        {suggestions.otherKnown.map((suggestion) => <button type="button" key={`${suggestion.kind}-${suggestion.id}`}
          className="block w-full rounded-lg p-2 text-left hover:bg-brand-border/30" onClick={() => {
            setSelectedSuggestion(suggestion); props.onMealNameChange(suggestion.name); setSuggestions(null);
            setUseManualValues(false);
          }}><strong>{suggestion.name}</strong> · {suggestion.label}</button>)}
      </div>}
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
      {canUseManual && selectedSuggestion?.kind !== 'ELIGIBLE_LIBRARY' && <Input id="portionGrams" type="number" min="1" max="5000" step="0.1"
        label="Approximate portion in grams (if known)" value={portionInput}
        onChange={(event) => setPortionInput(event.target.value)} />}
      <Input id="consumedAt" type="datetime-local" label="When you ate it" value={consumedLocal}
        onChange={(event) => setConsumedLocal(event.target.value)} required />

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
            <Sparkles className="h-3.5 w-3.5" /> Use AI if unresolved
          </strong>
          <span className="text-brand-muted">
            Add a portion and preparation details below. AI values count immediately as estimates and may enter nutritionist review. Limits: 5 items/day and 30/30
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
          <strong className="block text-brand-text">{selectedSuggestion?.kind === 'ELIGIBLE_LIBRARY' ? 'Library serving macros (editable)' : 'I have nutrition-label or menu values'}</strong>
          <span className="text-brand-muted">
            {selectedSuggestion?.kind === 'ELIGIBLE_LIBRARY' ? 'Changing these values records a user-adjusted estimate.' : 'Counted immediately. Log one food at a time when entering manual values.'}
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
      <Input id="estimationContext" label="Serving and preparation details (for estimation)" value={estimationContext}
        placeholder="Ingredients, cooking method, sauces, sugar, or drinks" onChange={(event) => setEstimationContext(event.target.value)} />
      <Input
        id="notes"
        label="Private personal note (optional)"
        placeholder="A note for your own record"
        value={props.notes}
        onChange={(event) => props.onNotesChange(event.target.value)}
        disabled={props.isLoading}
      />
      <label className="text-xs font-semibold text-brand-text">Photo (optional)
        <input className="mt-2 block w-full text-xs" type="file" accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            if (file && (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024)) {
              setImageFile(null);
              setImageError('Choose a JPG, PNG, or WebP image under 2 MB.');
            } else {
              setImageFile(file);
              setImageError(null);
            }
          }} />
        <span className="mt-1 block text-brand-muted">JPG, PNG, or WebP, up to 2 MB. Only your account can retrieve it.</span>
        {imageError && <span className="mt-1 block text-status-error-text">{imageError}</span>}
      </label>
      <Button
        type="submit"
        variant="primary"
        className="w-full py-3.5 text-xs font-bold"
        disabled={items.length === 0 || items.length > 10 || Boolean(imageError)}
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
