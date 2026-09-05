'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, CheckCircle2, Plus, X } from 'lucide-react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import type { SafetyEntryDomain, SafetyProfileEntry, SafetySupportState } from '@/types';
import type { SafetyInputValue } from '@/lib/safety-intake';

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
  const [confirmed, setConfirmed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get('/user/onboarding/safety-catalogue')
      .then((response) => setCatalogue([
        ...(response.data?.data?.conditions || []),
        ...(response.data?.data?.foodSafety || []),
      ]))
      .catch(() => setError('The safety catalogue could not be loaded.'));
  }, []);

  const options = useMemo(
    () => catalogue.filter((item) => item.domains.includes(activeDomain)),
    [activeDomain, catalogue]
  );
  const selectedCodes = new Set(inputs
    .filter((entry) => entry.domain === activeDomain && entry.provenance === 'PREDEFINED')
    .map((entry) => entry.value));

  const invalidateReview = () => {
    setPreview(null);
    setConfirmed(false);
    setError(null);
  };

  const togglePredefined = (item: CatalogueItem) => {
    const exact = inputs.some((entry) => entry.domain === activeDomain && entry.provenance === 'PREDEFINED' && entry.value === item.code);
    let next = exact
      ? inputs.filter((entry) => !(entry.domain === activeDomain && entry.provenance === 'PREDEFINED' && entry.value === item.code))
      : [...inputs, { domain: activeDomain, value: item.code, provenance: 'PREDEFINED' as const }];
    if (item.code === 'NONE' && !exact) next = next.filter((entry) => entry.domain !== activeDomain || entry.value === 'NONE');
    if (item.code !== 'NONE' && !exact) next = next.filter((entry) => !(entry.domain === activeDomain && entry.value === 'NONE'));
    setInputs(next);
    invalidateReview();
  };

  const addCustom = () => {
    if (!customText.trim()) return;
    const proposed = customText.split(/[,;\/\n\r]+/).map((value) => value.trim().toLocaleLowerCase()).filter(Boolean);
    const existing = inputs
      .filter((entry) => entry.domain === activeDomain)
      .flatMap((entry) => entry.value.split(/[,;\/\n\r]+/).map((value) => value.trim().toLocaleLowerCase()).filter(Boolean));
    if (proposed.length > 0 && proposed.every((value) => existing.includes(value))) {
      setError('Those entries are already in this category.');
      return;
    }
    const next = [...inputs.filter((entry) => !(entry.domain === activeDomain && entry.value === 'NONE')), {
      domain: activeDomain,
      value: customText,
      provenance: 'CUSTOM' as const,
    }];
    setInputs(Array.from(new Map(next.map((entry) => [inputKey(entry), entry])).values()));
    setCustomText('');
    invalidateReview();
  };

  const review = async () => {
    setIsBusy(true);
    setError(null);
    try {
      const response = await api.post('/user/onboarding/safety-preview', { entries: inputs });
      setPreview(response.data.data);
      setInputs(response.data.data.entries.map((entry: SafetyProfileEntry) => ({
        domain: entry.domain,
        value: entry.provenance === 'PREDEFINED' && entry.canonicalCode ? entry.canonicalCode : entry.originalText,
        provenance: entry.provenance === 'PREDEFINED' ? 'PREDEFINED' : 'CUSTOM',
      })));
      setConfirmed(false);
    } catch (caught: unknown) {
      setError(axios.isAxiosError(caught) ? caught.response?.data?.error || 'Unable to review these entries.' : 'Unable to review these entries.');
    } finally {
      setIsBusy(false);
    }
  };

  const save = async () => {
    if (!preview?.canSave || !confirmed) return;
    setIsBusy(true);
    setError(null);
    try {
      const response = await api.post('/user/onboarding/safety', { entries: inputs, confirmed: true });
      await onSaved(response.data.data.entries, response.data.data.changed);
    } catch (caught: unknown) {
      setError(axios.isAxiosError(caught) ? caught.response?.data?.error || 'Unable to save these entries.' : 'Unable to save these entries.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Safety entry categories">
        {editableDomains.map((domain) => (
          <button key={domain} type="button" role="tab" aria-selected={activeDomain === domain}
            onClick={() => setActiveDomain(domain)}
            className={`rounded-xl border-2 px-3 py-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${activeDomain === domain ? 'border-brand-green bg-brand-green text-white' : 'border-brand-border bg-brand-bgAlt text-brand-text'}`}>
            {labels[domain]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2" aria-label={`${labels[activeDomain]} common choices`}>
        {options.map((item) => (
          <button key={`${activeDomain}-${item.code}`} type="button" aria-pressed={selectedCodes.has(item.code)}
            onClick={() => togglePredefined(item)}
            className={`rounded-full border-2 px-3 py-2 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${selectedCodes.has(item.code) ? 'border-brand-green bg-brand-green/15 text-brand-green' : 'border-brand-border bg-brand-surface text-brand-text'}`}>
            {item.displayName}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor={`safety-${activeDomain}`} className="mb-2 block text-xs font-bold uppercase tracking-wide text-brand-muted">
          Add {labels[activeDomain].toLowerCase()}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id={`safety-${activeDomain}`} list={`safety-options-${activeDomain}`} value={customText}
            onChange={(event) => setCustomText(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustom(); } }}
            className="min-w-0 flex-1 rounded-xl border-2 border-brand-border bg-brand-bgAlt px-4 py-3 text-sm text-brand-text focus:border-brand-green focus:outline-none"
            placeholder="Type one or several entries" />
          <datalist id={`safety-options-${activeDomain}`}>
            {options.filter((item) => item.code !== 'NONE').flatMap((item) => [item.displayName, ...item.searchTerms]
              .map((value) => <option key={`${item.code}-${value}`} value={value} />))}
          </datalist>
          <Button type="button" variant="secondary" onClick={addCustom} className="shrink-0">
            <Plus className="mr-1 h-4 w-4" /> Add to preview
          </Button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-brand-muted">
          Separate entries with commas, semicolons, slashes, or line breaks. Spaces stay inside multi-word terms.
        </p>
      </div>

      <div aria-live="polite" className="space-y-2">
        {(preview?.entries || []).map((entry) => (
          <div key={`${entry.domain}:${entry.canonicalCode || entry.normalizedText}`} className="flex items-start justify-between gap-3 rounded-xl border-2 border-brand-border bg-brand-bgAlt p-3">
            <div>
              <p className="text-sm font-bold text-brand-text">{entry.displayName}</p>
              <p className="text-xs text-brand-muted">{labels[entry.domain]} · {stateLabel[entry.supportState]} · entered as “{entry.originalText}”</p>
            </div>
            {editableDomains.includes(entry.domain) ? (
              <button type="button" aria-label={`Remove ${entry.displayName}`} onClick={() => {
                setInputs((current) => current.filter((candidate) => !(candidate.domain === entry.domain && (
                  candidate.value.toLocaleLowerCase() === entry.originalText.toLocaleLowerCase() || candidate.value === entry.canonicalCode
                ))));
                invalidateReview();
              }} className="rounded-lg p-1 text-brand-muted hover:text-status-error-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green">
                <X className="h-4 w-4" />
              </button>
            ) : <span className="text-[10px] font-bold uppercase text-brand-muted">Retained</span>}
          </div>
        ))}
      </div>

      {preview?.requiresReview && (
        <div className="flex gap-2 rounded-xl border border-status-pending-text/30 bg-status-pending-bg/10 p-3 text-xs text-status-pending-text">
          <AlertTriangle className="h-4 w-4 shrink-0" /> Some entries require individual review. They will remain active and will prevent automatic verified-library claims.
        </div>
      )}
      {(error || preview?.errors.length) ? (
        <div role="alert" className="rounded-xl border border-status-error-text/30 bg-status-error-bg/10 p-3 text-xs font-semibold text-status-error-text">
          {error || preview?.errors.join(' ')}
        </div>
      ) : null}

      {preview?.canSave && (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border-2 border-brand-border bg-brand-surface p-3 text-sm text-brand-text">
          <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-green" />
          <span><strong>I reviewed these entries.</strong> I understand that unsupported or pending entries require individual review.</span>
        </label>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={review} disabled={isBusy}>
          <CheckCircle2 className="mr-1 h-4 w-4" /> Review entries
        </Button>
        <Button type="button" variant="primary" onClick={save} disabled={isBusy || !preview?.canSave || !confirmed} isLoading={isBusy && confirmed}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
