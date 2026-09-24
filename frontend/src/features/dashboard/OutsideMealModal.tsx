'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChefHat,
  Info,
  Loader2,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import api from '@/lib/axios';
import type { MealType } from '@/types';
import type { OutsideMealInputItem, OutsideMealWarning } from './model';
import RiceAccompanimentSelect from '@/components/user/RiceAccompanimentSelect';
import { ricePlateNutrition, type RiceReference } from '@/lib/rice-accompaniment';

type SubmitOptions = {
  useAiEstimate: boolean;
  items: OutsideMealInputItem[];
  consumedAt?: string;
  estimationContext?: string;
  imageFile?: File | null;
};

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

interface Suggestion {
  kind: string;
  id: string;
  name: string;
  label: string;
  serving?: string;
  macros?: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  ricePairing?: 'ULAM' | 'RICE_INCLUDED' | 'STANDALONE';
  riceReference?: RiceReference;
}

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
    <Modal isOpen={props.isOpen} onClose={props.onClose} title="MANUALLY LOG A MEAL">
      <div className="flex max-h-[82vh] flex-col gap-5 overflow-y-auto p-1 sm:p-2 text-left">
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
            {props.savedSafety.messages.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-brand-muted">
                {props.savedSafety.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            )}
            <Button variant="primary" onClick={props.onClose}>
              Done
            </Button>
          </div>
        ) : props.warning ? (
          <PreviewConfirmation {...props} warning={props.warning} />
        ) : (
          <OutsideMealForm {...props} />
        )}
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
  // Autocomplete state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Nutritional values (editable numbers)
  const [manual, setManual] = useState({ calories: '', proteinG: '', carbsG: '', fatG: '' });
  const [baseNutrition, setBaseNutrition] = useState<{
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  } | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [riceReference, setRiceReference] = useState<RiceReference | null>(null);
  const [selectedRicePairing, setSelectedRicePairing] = useState<'ULAM' | 'RICE_INCLUDED' | 'STANDALONE' | null>(null);
  const [riceGrams, setRiceGrams] = useState(0);

  // Photo & Camera state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [consumedLocal] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });

  const parsedItems = useMemo(() => parseItems(props.mealName), [props.mealName]);
  const ricePlatePreview =
    riceReference && riceGrams > 0
      ? ricePlateNutrition(
          {
            calories: manual.calories.trim() ? Number(manual.calories) : null,
            proteinG: manual.proteinG.trim() ? Number(manual.proteinG) : null,
            carbsG: manual.carbsG.trim() ? Number(manual.carbsG) : null,
            fatG: manual.fatG.trim() ? Number(manual.fatG) : null,
          },
          riceGrams,
          riceReference
        )
      : null;

  // Handle outside click to dismiss autocomplete dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search against /api/user/meals/outside-suggestions
  const handleInputChange = useCallback(
    (value: string) => {
      props.onMealNameChange(value);
      if (selectedSuggestion && value.trim() !== selectedSuggestion.name.trim()) {
        setSelectedSuggestion(null);
        setRiceReference(null);
        setSelectedRicePairing(null);
        setRiceGrams(0);
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      const query = value.trim();
      if (query.length < 2) {
        setSuggestions([]);
        setShowDropdown(false);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      debounceTimerRef.current = setTimeout(async () => {
        try {
          const res = await api.get('/user/meals/outside-suggestions', {
            params: { search: query },
          });
          if (res.data?.success && res.data.data) {
            const eligible: Suggestion[] = res.data.data.eligible || [];
            const otherKnown: Suggestion[] = res.data.data.otherKnown || [];
            const combined = [...eligible, ...otherKnown];
            setSuggestions(combined);
            setShowDropdown(combined.length > 0);
          } else {
            setSuggestions([]);
            setShowDropdown(false);
          }
        } catch {
          setSuggestions([]);
          setShowDropdown(false);
        } finally {
          setIsSearching(false);
        }
      }, 250);
    },
    [props, selectedSuggestion]
  );

  // Auto-fill values when a dish suggestion is selected
  const handleSelectSuggestion = (dish: Suggestion) => {
    props.onMealNameChange(dish.name);
    setSelectedSuggestion(dish);
    setSelectedRicePairing(dish.ricePairing ?? null);
    setRiceReference(
      dish.ricePairing === 'ULAM' || dish.ricePairing === 'RICE_INCLUDED' ? dish.riceReference ?? null : null
    );
    setRiceGrams(0);

    if (dish.macros) {
      setBaseNutrition(dish.macros);
      setManual({
        calories: String(Math.round(dish.macros.calories)),
        proteinG: String(Math.round(dish.macros.proteinG * 10) / 10),
        carbsG: String(Math.round(dish.macros.carbsG * 10) / 10),
        fatG: String(Math.round(dish.macros.fatG * 10) / 10),
      });
    }
    setShowDropdown(false);
  };

  // Quick portion multiplier presets (keeps all values freely editable!)
  const applyPortionMultiplier = (multiplier: number) => {
    if (!baseNutrition) return;
    setManual({
      calories: String(Math.round(baseNutrition.calories * multiplier)),
      proteinG: String(Math.round(baseNutrition.proteinG * multiplier * 10) / 10),
      carbsG: String(Math.round(baseNutrition.carbsG * multiplier * 10) / 10),
      fatG: String(Math.round(baseNutrition.fatG * multiplier * 10) / 10),
    });
  };

  // Handle Photo selection from camera or file picker
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
        setImageFile(null);
        setImagePreview(null);
        setImageError('Choose a JPG, PNG, or WebP image under 2 MB.');
        return;
      }
      setImageFile(file);
      setImageError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit with user-entered or auto-filled editable manual values
  const handleSubmit = (useAi = false) => {
    const hasManual =
      manual.calories.trim() !== '' ||
      manual.proteinG.trim() !== '' ||
      manual.carbsG.trim() !== '' ||
      manual.fatG.trim() !== '';

    let submittedItems: OutsideMealInputItem[];

    if (hasManual && !useAi) {
      const singleItem: OutsideMealInputItem = {
        name: props.mealName.trim() || 'Custom Meal',
        reportedNutrition: {
          calories: Number(manual.calories) || 0,
          proteinG: Number(manual.proteinG) || 0,
          carbsG: Number(manual.carbsG) || 0,
          fatG: Number(manual.fatG) || 0,
        },
      };
      if (
        selectedSuggestion?.id &&
        (selectedSuggestion.kind === 'ELIGIBLE_LIBRARY' || selectedSuggestion.kind === 'KNOWN_CATALOG')
      ) {
        singleItem.mealLibraryId = selectedSuggestion.id;
      }
      submittedItems = [singleItem];
    } else {
      submittedItems = parsedItems.length > 0 ? parsedItems.map((item) => ({ ...item })) : [{ name: props.mealName.trim() }];
      if (
        selectedSuggestion?.id &&
        (selectedSuggestion.kind === 'ELIGIBLE_LIBRARY' || selectedSuggestion.kind === 'KNOWN_CATALOG') &&
        submittedItems.length === 1
      ) {
        submittedItems[0].mealLibraryId = selectedSuggestion.id;
      }
    }

    if (riceReference && riceGrams > 0) {
      submittedItems.push({ name: riceReference.name, portionGrams: riceGrams });
    }

    props.onSubmit(false, {
      useAiEstimate: useAi,
      items: submittedItems,
      consumedAt: new Date(consumedLocal).toISOString(),
      estimationContext: props.notes,
      imageFile,
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(false);
      }}
      className="flex flex-col gap-4 text-left"
    >
      {/* 1. Meal Category Segmented Control */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-xs font-bold tracking-wide text-brand-text/90">Meal category (required)</legend>
        <div className="grid grid-cols-4 gap-2 text-center text-xs font-semibold">
          {(Object.keys(mealLabels) as MealType[]).map((type) => {
            const isSelected = props.mealType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => props.onMealTypeChange(type)}
                className={`rounded-xl border py-2 px-1 outline-none transition-all ${
                  isSelected
                    ? 'border-brand-green bg-brand-green/15 font-extrabold text-brand-green shadow-sm'
                    : 'border-brand-border/70 bg-brand-surface/50 text-brand-muted hover:border-brand-border hover:text-brand-text'
                }`}
              >
                {mealLabels[type]}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 2. Food or Meal Eaten with Autocomplete */}
      <div ref={searchContainerRef} className="relative flex flex-col gap-1">
        <label htmlFor="mealNameInput" className="text-xs font-bold tracking-wide text-brand-text/90">
          Food or Meal Eaten (required)
        </label>
        <div className="relative">
          <input
            id="mealNameInput"
            type="text"
            placeholder="e.g. small apple, chicken adobo (150g), brown rice"
            value={props.mealName}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowDropdown(true);
            }}
            disabled={props.isLoading}
            required
            className="w-full rounded-xl border border-brand-border/80 bg-brand-surface/80 px-3.5 py-2.5 text-xs text-brand-text placeholder-brand-muted/70 outline-none transition focus:border-brand-green focus:ring-1 focus:ring-brand-green"
          />
          {isSearching ? (
            <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-brand-green" />
          ) : props.mealName ? (
            <button
              type="button"
              onClick={() => {
                props.onMealNameChange('');
                setSuggestions([]);
                setShowDropdown(false);
                setSelectedSuggestion(null);
                setBaseNutrition(null);
                setRiceReference(null);
                setSelectedRicePairing(null);
                setRiceGrams(0);
                setManual({ calories: '', proteinG: '', carbsG: '', fatG: '' });
              }}
              className="absolute right-3 top-2.5 text-brand-muted hover:text-brand-text"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <p className="mt-0.5 text-[10px] text-brand-muted">
          For multiple foods, separate each one with a comma. Add a measured portion like <strong>rice (150g)</strong> for
          FNRI matching.
        </p>

        {/* Autocomplete Dropdown List */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-brand-border bg-brand-surface shadow-2xl backdrop-blur-md">
            <div className="p-1 text-[10px] font-bold uppercase tracking-wider text-brand-muted px-2 pt-1.5 pb-1">
              Matching Recipes & Foods ({suggestions.length})
            </div>
            {suggestions.map((dish) => (
              <button
                key={`${dish.kind}-${dish.id}`}
                type="button"
                onClick={() => handleSelectSuggestion(dish)}
                className="flex w-full items-center justify-between gap-2 border-b border-brand-border/40 px-3 py-2 text-left text-xs transition hover:bg-brand-green/10"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {dish.kind === 'ELIGIBLE_LIBRARY' || dish.kind === 'KNOWN_CATALOG' ? (
                      <ChefHat className="h-3.5 w-3.5 shrink-0 text-brand-green" />
                    ) : (
                      <Search className="h-3.5 w-3.5 shrink-0 text-brand-muted" />
                    )}
                    <span className="truncate font-semibold text-brand-text">{dish.name}</span>
                  </div>
                  <span className="text-[10px] text-brand-muted">
                    {dish.serving ? `${dish.label} · ${dish.serving}` : dish.label}
                  </span>
                </div>
                {dish.macros && (
                  <div className="shrink-0 text-right">
                    <span className="font-extrabold text-brand-green">{Math.round(dish.macros.calories)} kcal</span>
                    <span className="block text-[10px] text-brand-muted">
                      {Math.round(dish.macros.proteinG * 10) / 10}g P · {Math.round(dish.macros.carbsG * 10) / 10}g C
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 3. Nutritional Values (Estimated) - Open by default & fully editable */}
      <div className="rounded-xl border border-brand-border/70 bg-brand-surface/50 p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-bold text-brand-text/90">Nutritional Values (Estimated)</span>
          {selectedSuggestion && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-brand-green">
              <CheckCircle2 className="h-3 w-3" />
              {selectedSuggestion.kind === 'ELIGIBLE_LIBRARY'
                ? 'From verified recipe'
                : selectedSuggestion.kind === 'KNOWN_CATALOG'
                  ? 'Auto-filled from verified recipe'
                  : selectedSuggestion.kind === 'FNRI_FOOD'
                    ? 'From FNRI · per 100g reference'
                    : 'From observed reference'}
            </span>
          )}
        </div>

        {/* 4 Numeric Inputs side-by-side */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold text-brand-muted">Calories (kcal)</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={manual.calories}
                onChange={(e) => setManual((prev) => ({ ...prev, calories: e.target.value }))}
                className="w-full rounded-lg border border-brand-border/80 bg-brand-bgAlt/80 px-3 py-2 text-xs font-bold text-brand-text outline-none focus:border-brand-green"
              />
              <span className="absolute right-2.5 top-2 text-[10px] font-semibold text-brand-muted pointer-events-none">
                kcal
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold text-brand-muted">Protein (g)</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="0"
                value={manual.proteinG}
                onChange={(e) => setManual((prev) => ({ ...prev, proteinG: e.target.value }))}
                className="w-full rounded-lg border border-brand-border/80 bg-brand-bgAlt/80 px-3 py-2 text-xs font-bold text-macro-protein outline-none focus:border-brand-green"
              />
              <span className="absolute right-2.5 top-2 text-[10px] font-semibold text-brand-muted pointer-events-none">
                g
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold text-brand-muted">Carbs (g)</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="0"
                value={manual.carbsG}
                onChange={(e) => setManual((prev) => ({ ...prev, carbsG: e.target.value }))}
                className="w-full rounded-lg border border-brand-border/80 bg-brand-bgAlt/80 px-3 py-2 text-xs font-bold text-macro-carbs outline-none focus:border-brand-green"
              />
              <span className="absolute right-2.5 top-2 text-[10px] font-semibold text-brand-muted pointer-events-none">
                g
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold text-brand-muted">Fat (g)</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="0"
                value={manual.fatG}
                onChange={(e) => setManual((prev) => ({ ...prev, fatG: e.target.value }))}
                className="w-full rounded-lg border border-brand-border/80 bg-brand-bgAlt/80 px-3 py-2 text-xs font-bold text-macro-fat outline-none focus:border-brand-green"
              />
              <span className="absolute right-2.5 top-2 text-[10px] font-semibold text-brand-muted pointer-events-none">
                g
              </span>
            </div>
          </div>
        </div>

        {/* Portion multiplier pills for easy scaling while keeping inputs editable */}
        {baseNutrition && (
          <div className="mt-2.5 flex items-center justify-between border-t border-brand-border/40 pt-2 text-[11px]">
            <span className="text-brand-muted">Quick portion scaling:</span>
            <div className="flex gap-1.5">
              {[0.5, 1, 1.5, 2].map((factor) => (
                <button
                  key={factor}
                  type="button"
                  onClick={() => applyPortionMultiplier(factor)}
                  className="rounded-md border border-brand-border/70 bg-brand-surface px-2 py-0.5 font-bold text-brand-muted hover:border-brand-green hover:text-brand-green transition"
                >
                  {factor}x
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-2 flex items-center gap-1 text-[10px] text-brand-muted">
          <Info className="h-3 w-3 shrink-0" />
          Values are editable. Tweak any numbers above or enter your own nutrition-label or menu values.
        </p>
      </div>

      {riceReference && baseNutrition && (
        <div className="space-y-2">
          {selectedRicePairing === 'RICE_INCLUDED' && (
            <p className="text-xs text-brand-muted">
              The recipe estimate already includes its listed rice. If your rice portion within the dish differs,
              edit the nutrition estimate above. Use this field only for rice added beyond the recipe serving.
            </p>
          )}
          <RiceAccompanimentSelect
            id="outside-meal-rice"
            grams={riceGrams}
            onChange={setRiceGrams}
            rice={riceReference}
            extra={selectedRicePairing === 'RICE_INCLUDED'}
          />
          {ricePlatePreview && (
            <p className="text-xs font-semibold text-brand-text">
              Plate preview: {Math.round(ricePlatePreview.calories)} kcal ·{' '}
              {Math.round(ricePlatePreview.carbsG * 10) / 10}g carbs. Rice appears as its own FNRI item in the confirmation.
            </p>
          )}
        </div>
      )}

      {/* 4. Side-by-Side Dual Reference Block: Photo Upload on Left, Notes on Right */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Left: Add Image / Camera Capture */}
        <div className="flex flex-col gap-1">
          <span className="text-xs font-bold text-brand-text/90">Add photo (optional)</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={handleImageChange}
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="group relative flex h-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand-border/70 bg-brand-surface/40 p-3 text-center transition hover:border-brand-green/60 hover:bg-brand-surface/60 overflow-hidden"
          >
            {imagePreview ? (
              <>
                {/* A local blob/data URL preview cannot use the Next image optimizer. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Meal photo preview" className="h-full w-full object-cover rounded-lg" />
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white hover:bg-black transition"
                  title="Remove photo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-bgAlt/90 text-brand-muted group-hover:text-brand-green transition">
                  <Plus className="h-4 w-4" />
                </div>
                <span className="text-[11px] font-semibold text-brand-muted group-hover:text-brand-text transition">
                  Upload Photo or Use Camera (Optional)
                </span>
                <span className="text-[9px] text-brand-muted/70">Tap to capture or upload</span>
              </>
            )}
          </div>
          {imageError && <span className="text-[10px] text-status-error-text">{imageError}</span>}
        </div>

        {/* Right: Notes */}
        <div className="flex flex-col gap-1">
          <label htmlFor="mealNotes" className="text-xs font-bold text-brand-text/90">
            Notes (optional)
          </label>
          <textarea
            id="mealNotes"
            rows={4}
            placeholder="e.g. restaurant, preparation, serving details"
            value={props.notes}
            onChange={(e) => props.onNotesChange(e.target.value)}
            disabled={props.isLoading}
            className="h-28 w-full resize-none rounded-xl border border-brand-border/80 bg-brand-surface/80 p-2.5 text-xs text-brand-text placeholder-brand-muted/70 outline-none transition focus:border-brand-green focus:ring-1 focus:ring-brand-green"
          />
        </div>
      </div>

      {/* 5. AI Assistant Fallback ("Still not sure?") */}
      <div className="rounded-xl border border-brand-border/60 bg-brand-surface/30 p-3 text-center">
        <span className="mb-1.5 block text-[11px] font-semibold text-brand-muted">Still not sure?</span>
        <button
          type="button"
          onClick={() => handleSubmit(true)}
          disabled={props.isLoading || !props.mealName.trim()}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-brand-green/40 bg-brand-green/10 py-2.5 px-4 text-xs font-extrabold text-brand-green transition hover:bg-brand-green/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="h-4 w-4" />
          HELP ME FIND VALUES WITH PREMIUM AI
        </button>
        <p className="mt-1.5 text-[10px] text-brand-muted">
          Use AI if unresolved — AI values count immediately as provisional and enter nutritionist review.
        </p>
      </div>

      {/* 6. Primary Action: LOG THIS MEAL */}
      <Button
        type="submit"
        variant="primary"
        className="w-full py-3.5 text-xs font-extrabold uppercase tracking-wider"
        disabled={!props.mealName.trim() || Boolean(imageError)}
        isLoading={props.isLoading}
      >
        LOG THIS MEAL
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

export default OutsideMealModal;
