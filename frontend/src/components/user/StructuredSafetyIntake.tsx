'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Plus,
  X,
  ShieldAlert,
  Activity,
  Ban,
  Stethoscope,
} from 'lucide-react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import type { SafetyEntryDomain, SafetyProfileEntry, SafetySupportState } from '@/types';
import type { SafetyInputValue } from '@/lib/safety-intake';
import { getApiErrorMessage } from '@/lib/api-error';

interface CatalogueItem {
  code: string;
  displayName: string;
  aliases: string[];
  searchTerms: string[];
  domains: SafetyEntryDomain[];
  supportState: SafetySupportState;
  policyReference: string;
}

interface PreviewResult {
  entries: SafetyProfileEntry[];
  errors: string[];
  canSave: boolean;
  requiresReview: boolean;
}

const labels: Record<SafetyEntryDomain, string> = {
  CONDITION: 'Medical conditions',
  ALLERGY: 'Food allergies',
  INTOLERANCE: 'Food intolerances',
  AVOIDED_INGREDIENT: 'Foods or ingredients to avoid',
};

const domainConfig: Record<
  SafetyEntryDomain,
  { title: string; subtitle: string; icon: React.ComponentType<{ className?: string }> }
> = {
  CONDITION: { title: 'Medical Conditions', subtitle: 'Diagnosed health considerations', icon: Stethoscope },
  ALLERGY: { title: 'Food Allergies', subtitle: 'Immune reactions (peanuts, shellfish...)', icon: ShieldAlert },
  INTOLERANCE: { title: 'Intolerances', subtitle: 'Digestive sensitivities (lactose, gluten...)', icon: Activity },
  AVOIDED_INGREDIENT: { title: 'Foods to Avoid', subtitle: 'Personal or religious exclusions (pork, beef...)', icon: Ban },
};

const stateLabel: Record<SafetySupportState, string> = {
  SUPPORTED: 'Supported',
  RECOGNIZED_UNSUPPORTED: 'Individual review required',
  NEEDS_CLARIFICATION: 'Needs clarification',
  PENDING_REVIEW: 'Pending review',
  INVALID: 'Invalid',
};

function inputKey(input: SafetyInputValue) {
  return `${input.domain}:${input.provenance}:${input.value.trim().toLocaleLowerCase()}`;
}

export default function StructuredSafetyIntake({
  initialEntries,
  editableDomains,
  submitLabel,
  onSaved,
}: {
  initialEntries: SafetyInputValue[];
  editableDomains: SafetyEntryDomain[];
  submitLabel: string;
  onSaved: (entries: SafetyProfileEntry[], changed: boolean) => void | Promise<void>;
}) {
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [inputs, setInputs] = useState<SafetyInputValue[]>(initialEntries);
  const [activeDomain, setActiveDomain] = useState<SafetyEntryDomain>(editableDomains[0]);
  const [customText, setCustomText] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [modalConfirmed, setModalConfirmed] = useState(false);

  useEffect(() => {
    api
      .get('/user/onboarding/safety-catalogue')
      .then((response) =>
        setCatalogue([...(response.data?.data?.conditions || []), ...(response.data?.data?.foodSafety || [])])
      )
      .catch(() => setError('The safety catalogue could not be loaded.'));
  }, []);

  const options = useMemo(
    () => catalogue.filter((item) => item.domains.includes(activeDomain)),
    [activeDomain, catalogue]
  );

  const selectedCodes = new Set(
    inputs
      .filter((entry) => entry.domain === activeDomain && entry.provenance === 'PREDEFINED')
      .map((entry) => entry.value)
  );

  const isNoneSelected = selectedCodes.has('NONE');

  const activeCategoryEntries = useMemo(
    () => inputs.filter((entry) => entry.domain === activeDomain),
    [activeDomain, inputs]
  );

  const togglePredefined = (item: CatalogueItem) => {
    setError(null);
    const exact = inputs.some(
      (entry) => entry.domain === activeDomain && entry.provenance === 'PREDEFINED' && entry.value === item.code
    );
    let next = exact
      ? inputs.filter(
          (entry) => !(entry.domain === activeDomain && entry.provenance === 'PREDEFINED' && entry.value === item.code)
        )
      : [...inputs, { domain: activeDomain, value: item.code, provenance: 'PREDEFINED' as const }];
    if (item.code === 'NONE' && !exact) {
      next = next.filter((entry) => entry.domain !== activeDomain || entry.value === 'NONE');
      setCustomText('');
    }
    if (item.code !== 'NONE' && !exact) {
      next = next.filter((entry) => !(entry.domain === activeDomain && entry.value === 'NONE'));
    }
    setInputs(next);
  };

  const addCustom = () => {
    if (isNoneSelected) return;
    if (!customText.trim()) return;
    const proposed = customText
      .split(/[,;\/\n\r]+/)
      .map((value) => value.trim().toLocaleLowerCase())
      .filter(Boolean);
    const existing = inputs
      .filter((entry) => entry.domain === activeDomain)
      .flatMap((entry) =>
        entry.value
          .split(/[,;\/\n\r]+/)
          .map((value) => value.trim().toLocaleLowerCase())
          .filter(Boolean)
      );
    if (proposed.length > 0 && proposed.every((value) => existing.includes(value))) {
      setError('Those entries are already in this category.');
      return;
    }
    const next = [
      ...inputs.filter((entry) => !(entry.domain === activeDomain && entry.value === 'NONE')),
      {
        domain: activeDomain,
        value: customText,
        provenance: 'CUSTOM' as const,
      },
    ];
    setInputs(Array.from(new Map(next.map((entry) => [inputKey(entry), entry])).values()));
    setCustomText('');
    setError(null);
  };

  const removeEntry = (entryToRemove: SafetyInputValue) => {
    setInputs((current) =>
      current.filter(
        (candidate) =>
          !(
            candidate.domain === entryToRemove.domain &&
            candidate.provenance === entryToRemove.provenance &&
            candidate.value.toLocaleLowerCase() === entryToRemove.value.toLocaleLowerCase()
          )
      )
    );
  };

  const handleInitiateSave = async () => {
    setError(null);
    const relevantEntries = inputs.filter((entry) => editableDomains.includes(entry.domain));

    // If nothing selected across these editable domains, check if 'NONE' is an option
    if (relevantEntries.length === 0) {
      const noneOption = options.find((opt) => opt.code === 'NONE');
      if (noneOption) {
        setError(`Please select your entries or choose "${noneOption.displayName}" to proceed.`);
        return;
      }
    }

    setIsBusy(true);
    try {
      const response = await api.post('/user/onboarding/safety-preview', { entries: inputs });
      setPreview(response.data.data);
      setModalConfirmed(false);
      setShowConfirmModal(true);
    } catch (caught: unknown) {
      setError(getApiErrorMessage(caught, 'Unable to review these entries. Please check your connection.'));
    } finally {
      setIsBusy(false);
    }
  };

  const handleFinalSave = async () => {
    if (!modalConfirmed) return;
    setIsBusy(true);
    setError(null);
    try {
      const response = await api.post('/user/onboarding/safety', { entries: inputs, confirmed: true });
      setShowConfirmModal(false);
      await onSaved(response.data.data.entries, response.data.data.changed);
    } catch (caught: unknown) {
      setError(getApiErrorMessage(caught, 'Unable to save these entries.'));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* 3-Section Category Cards (When multiple domains exist, e.g. Food Safety) */}
      {editableDomains.length > 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="tablist" aria-label="Food safety categories">
          {editableDomains.map((domain) => {
            const config = domainConfig[domain];
            const Icon = config.icon;
            const count = inputs.filter((entry) => entry.domain === domain).length;
            const isActive = activeDomain === domain;
            return (
              <button
                key={domain}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setActiveDomain(domain);
                  setCustomText('');
                  setError(null);
                }}
                className={`flex flex-col items-start p-3 rounded-2xl border-2 text-left transition-all duration-200 outline-none ${
                  isActive
                    ? 'border-brand-green bg-brand-green/10 text-brand-green dark:border-brand-accent dark:bg-brand-accent/15 dark:text-brand-accent shadow-sm ring-1 ring-brand-green/30'
                    : 'border-brand-border/80 bg-brand-bgAlt/50 text-brand-muted hover:border-brand-border hover:text-brand-text'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-bold tracking-tight">{config.title}</span>
                  </div>
                  {count > 0 && (
                    <span className="rounded-full bg-brand-green/20 px-2 py-0.5 text-[10px] font-black text-brand-green dark:bg-brand-accent/25 dark:text-brand-accent">
                      {count}
                    </span>
                  )}
                </div>
                <span className="text-[11px] leading-snug text-brand-muted line-clamp-1">{config.subtitle}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Common Choices Buttons */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-muted">
          Common {labels[activeDomain].toLowerCase()}
        </span>
        <div className="flex flex-wrap gap-2" aria-label={`${labels[activeDomain]} common choices`}>
          {options.map((item) => {
            const isSelected = selectedCodes.has(item.code);
            return (
              <button
                key={`${activeDomain}-${item.code}`}
                type="button"
                aria-pressed={isSelected}
                onClick={() => togglePredefined(item)}
                className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3.5 py-2 text-xs font-bold transition-all outline-none ${
                  isSelected
                    ? 'border-brand-green bg-brand-green text-white dark:border-brand-accent dark:bg-brand-accent dark:text-black font-bold shadow-md'
                    : 'border-brand-border bg-brand-surface text-brand-text hover:border-brand-green/40'
                }`}
              >
                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] shrink-0" />}
                <span>{item.displayName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Entry Input */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={`safety-${activeDomain}`}
          className="block text-xs font-bold uppercase tracking-wider text-brand-muted"
        >
          Add other {labels[activeDomain].toLowerCase()}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={`safety-${activeDomain}`}
            list={`safety-options-${activeDomain}`}
            value={isNoneSelected ? '' : customText}
            disabled={isBusy || isNoneSelected}
            onChange={(event) => setCustomText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addCustom();
              }
            }}
            className={`min-w-0 flex-1 rounded-xl border-2 px-3.5 py-2.5 text-xs sm:text-sm text-brand-text outline-none transition-colors ${
              isNoneSelected
                ? 'border-brand-border/40 bg-brand-bgAlt/30 text-brand-muted cursor-not-allowed opacity-60'
                : 'border-brand-border bg-brand-bgAlt focus:border-brand-green'
            }`}
            placeholder={
              isNoneSelected
                ? 'Disabled because "None" is selected above'
                : 'Type an entry and press Add (e.g. Soy, Walnuts)'
            }
          />
          <datalist id={`safety-options-${activeDomain}`}>
            {options
              .filter((item) => item.code !== 'NONE')
              .flatMap((item) =>
                [item.displayName, ...item.searchTerms].map((value) => (
                  <option key={`${item.code}-${value}`} value={value} />
                ))
              )}
          </datalist>
          <Button
            type="button"
            variant="secondary"
            onClick={addCustom}
            disabled={isBusy || isNoneSelected || !customText.trim()}
            className="shrink-0 text-xs py-2 px-3.5"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add to list
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-brand-muted">
          Separate multiple entries with commas, semicolons, or line breaks.
        </p>
      </div>

      {/* Selected Items Tray for Active Category */}
      {activeCategoryEntries.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">
            Selected in {labels[activeDomain].toLowerCase()}:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {activeCategoryEntries.map((entry) => {
              const matchedOption = options.find((opt) => opt.code === entry.value);
              const labelText = matchedOption ? matchedOption.displayName : entry.value;
              return (
                <span
                  key={inputKey(entry)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-green/30 bg-brand-green/10 px-3 py-1 text-xs font-semibold text-brand-green dark:border-brand-accent/30 dark:bg-brand-accent/15 dark:text-brand-accent"
                >
                  <span>{labelText}</span>
                  <button
                    type="button"
                    onClick={() => removeEntry(entry)}
                    className="hover:text-status-error-text transition-colors"
                    aria-label={`Remove ${labelText}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-status-error-text/30 bg-status-error-bg/10 p-3 text-xs font-semibold text-status-error-text"
        >
          {error}
        </div>
      )}

      {/* Action Button: Direct Save and Continue */}
      <div className="flex flex-col sm:flex-row sm:justify-end pt-2">
        <Button
          type="button"
          variant="primary"
          onClick={handleInitiateSave}
          disabled={isBusy}
          isLoading={isBusy && !showConfirmModal}
          className="w-full sm:w-auto px-6 py-3 font-bold text-sm"
        >
          {submitLabel}
        </Button>
      </div>

      {/* Review Confirmation Pop-up Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setModalConfirmed(false);
        }}
        title="Review Your Declarations"
        description="Please confirm your declared health and safety entries before proceeding."
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowConfirmModal(false);
                setModalConfirmed(false);
              }}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleFinalSave}
              disabled={!modalConfirmed || isBusy}
              isLoading={isBusy}
            >
              Continue
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Entries list */}
          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {(preview?.entries || []).length === 0 ? (
              <p className="text-xs text-brand-muted italic">No specific restrictions declared.</p>
            ) : (
              (preview?.entries || []).map((entry) => (
                <div
                  key={`${entry.domain}:${entry.canonicalCode || entry.normalizedText}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-brand-border bg-brand-bgAlt/50 p-3"
                >
                  <div>
                    <p className="text-sm font-bold text-brand-text">{entry.displayName}</p>
                    <p className="text-xs text-brand-muted">
                      {labels[entry.domain]} · {stateLabel[entry.supportState]}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      entry.supportState === 'SUPPORTED'
                        ? 'bg-status-verified-bg text-status-verified-text'
                        : 'bg-status-pending-bg text-status-pending-text'
                    }`}
                  >
                    {stateLabel[entry.supportState]}
                  </span>
                </div>
              ))
            )}
          </div>

          {preview?.requiresReview && (
            <div className="flex gap-2 rounded-xl border border-status-pending-text/30 bg-status-pending-bg/10 p-3 text-xs text-status-pending-text">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Some entries require individual review. They will remain active and will route automatic compatibility to
                nutritionist review.
              </span>
            </div>
          )}

          {/* Mandatory Checkbox */}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-brand-border bg-brand-bgAlt/60 p-3.5 text-xs sm:text-sm font-medium text-brand-text select-none">
            <input
              type="checkbox"
              checked={modalConfirmed}
              onChange={(e) => setModalConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-brand-green shrink-0"
            />
            <span>
              <strong>I reviewed these entries.</strong> I understand that unsupported or pending entries require
              individual review.
            </span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
