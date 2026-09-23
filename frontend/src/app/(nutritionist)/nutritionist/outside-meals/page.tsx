'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, RefreshCw } from 'lucide-react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/shared/EmptyState';
import PortalPageHeader from '@/components/shared/PortalPageHeader';

type QueueRow = {
  id: string;
  priority: number;
  status: string;
  queueReason: string | null;
  claimedRevision: number | null;
  messages: Array<{ id: string; sender: 'USER' | 'NUTRITIONIST'; itemRevision: number;
    content: string; createdAt: string }>;
  claimStatus: { claimedByMe: boolean; claimedByOther: boolean; claimedByName: string | null };
  outsideMealLogItem: {
    id: string;
    name: string;
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    calorieLow: number | null;
    calorieHigh: number | null;
    compatibilityStatus: string;
    nutritionStatus: string;
    includedInTotals: boolean;
    currentRevision: number;
    ingredients: string[] | null;
    mealLog: { mealName: string; mealType: string | null; loggedAt: string;
      estimationContext?: string | null; outsideImageMime?: string | null };
  };
};

type ObservedSubmission = {
  id: string;
  sourceRevision: number;
  createdAt: string;
  sourceOutsideMealItem: {
    name: string; portionGrams: number | null; calories: number | null;
    proteinG: number | null; carbsG: number | null; fatG: number | null;
    currentRevision: number; nutritionStatus: string;
    ingredients: unknown;
    mealLog: { mealType: string | null; estimationContext: string | null; status: string };
  } | null;
};

const emptyCorrection = { calories: '', proteinG: '', carbsG: '', fatG: '', reason: '' };

export default function OutsideMealReviewsPage() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [selected, setSelected] = useState<QueueRow | null>(null);
  const [correction, setCorrection] = useState(emptyCorrection);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submissions, setSubmissions] = useState<ObservedSubmission[]>([]);
  const [observed, setObserved] = useState<ObservedSubmission | null>(null);
  const [observedKind, setObservedKind] = useState<'FOOD_REFERENCE' | 'RECIPE_CANDIDATE'>('FOOD_REFERENCE');
  const [canonicalName, setCanonicalName] = useState('');
  const [ingredientLines, setIngredientLines] = useState('');
  const [preparation, setPreparation] = useState('');
  const [applicableTypes, setApplicableTypes] = useState<string[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [reviews, observations] = await Promise.all([
        api.get('/nutritionist/outside-meal-reviews'),
        api.get('/nutritionist/observed-meal-submissions'),
      ]);
      setRows(reviews.data?.data ?? []);
      setSubmissions(observations.data?.data ?? []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load outside-meal reviews.'));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const claim = async (row: QueueRow) => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.post(`/nutritionist/outside-meal-reviews/${row.id}/claim`);
      setSelected({ ...response.data.data,
        claimStatus: { claimedByMe: true, claimedByOther: false, claimedByName: null } });
      setCorrection({
        calories: String(row.outsideMealLogItem.calories ?? ''),
        proteinG: String(row.outsideMealLogItem.proteinG ?? ''),
        carbsG: String(row.outsideMealLogItem.carbsG ?? ''),
        fatG: String(row.outsideMealLogItem.fatG ?? ''),
        reason: '',
      });
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not claim this review.'));
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (action: 'VERIFY' | 'CORRECT' | 'NEEDS_MORE_INFO' | 'UNVERIFIABLE') => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/nutritionist/outside-meal-reviews/${selected.id}`, {
        action,
        reason: correction.reason,
        ...(action === 'CORRECT'
          ? {
              calories: Number(correction.calories),
              proteinG: Number(correction.proteinG),
              carbsG: Number(correction.carbsG),
              fatG: Number(correction.fatG),
            }
          : {}),
      });
      setSelected(null);
      setCorrection(emptyCorrection);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to submit the review.'));
    } finally {
      setBusy(false);
    }
  };

  const selectObserved = (row: ObservedSubmission) => {
    setObserved(row);
    setObservedKind('FOOD_REFERENCE');
    setCanonicalName(row.sourceOutsideMealItem?.name ?? '');
    const ingredients = row.sourceOutsideMealItem?.ingredients;
    setIngredientLines(Array.isArray(ingredients) ? ingredients.flatMap((item) => {
      if (!item || typeof item !== 'object' || !('name' in item)) return [];
      const ingredient = item as { name: string; quantity?: number; unit?: string };
      return [`${ingredient.name} | ${ingredient.quantity ?? ''} | ${ingredient.unit ?? ''}`];
    }).join('\n') : '');
    setPreparation(row.sourceOutsideMealItem?.mealLog.estimationContext ?? '');
    setApplicableTypes(row.sourceOutsideMealItem?.mealLog.mealType &&
      ['BREAKFAST', 'LUNCH', 'DINNER'].includes(row.sourceOutsideMealItem.mealLog.mealType)
      ? [row.sourceOutsideMealItem.mealLog.mealType] : []);
  };

  const admitObserved = async () => {
    if (!observed) return;
    setBusy(true); setError(null);
    try {
      const ingredients = ingredientLines.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
        const [name, amount, unit] = line.split('|').map((part) => part.trim());
        return { name, quantity: Number(amount), unit };
      });
      await api.post(`/nutritionist/observed-meal-submissions/${observed.id}/admit`, {
        kind: observedKind, canonicalName: canonicalName.trim(),
        ...(observedKind === 'RECIPE_CANDIDATE' ? {
          ingredients, preparation: preparation.trim(), mealTypes: applicableTypes,
        } : {}),
      });
      setObserved(null);
      await load();
    } catch (err) { setError(getApiErrorMessage(err, 'Could not classify this observation.')); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader
        icon={ClipboardCheck}
        eyebrow="Nutrition review"
        title="Outside meal estimates"
        description="Confirm an intake estimate, correct it, ask for detail, or mark it unverifiable. This does not certify a reusable recipe."
      />
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-status-error-text/30 bg-status-error-bg/10 p-4 text-sm text-status-error-text">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.8fr)]">
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
          {rows.length === 0 ? (
            <EmptyState
              title="No outside-meal estimates waiting"
              description="User requests and selected uncertain or conflicting entries will appear here."
            />
          ) : (
            rows.map((row) => (
              <button
                key={row.id}
                type="button"
                disabled={row.claimStatus.claimedByOther || busy}
                onClick={() => void claim(row)}
                className="text-left disabled:opacity-50"
              >
                <Card className="p-4 transition hover:border-brand-green">
                  <div className="flex justify-between gap-3">
                    <div>
                      <strong>{row.outsideMealLogItem.name}</strong>
                      <p className="text-xs text-brand-muted">
                        {row.outsideMealLogItem.mealLog.mealType ?? 'Meal'} ·{' '}
                        {new Date(row.outsideMealLogItem.mealLog.loggedAt).toLocaleString()}
                      </p>
                    </div>
                    <span className="text-xs font-bold">{row.queueReason?.replaceAll('_', ' ').toLowerCase() ?? 'Review'} · priority {row.priority}</span>
                  </div>
                  <p className="mt-2 text-sm">
                    {Math.round(row.outsideMealLogItem.calories ?? 0)} kcal · P {row.outsideMealLogItem.proteinG ?? 0}g
                    · C {row.outsideMealLogItem.carbsG ?? 0}g · F {row.outsideMealLogItem.fatG ?? 0}g
                  </p>
                  {row.claimStatus.claimedByOther && (
                    <p className="mt-2 text-xs text-status-pending-text">
                      Claimed by {row.claimStatus.claimedByName ?? 'another nutritionist'}
                    </p>
                  )}
                </Card>
              </button>
            ))
          )}
        </div>
        <Card className="h-fit p-5">
          {!selected ? (
            <EmptyState
              title="Select an estimate"
              description="Claim one queue item to verify it, correct its macros, or request more information."
            />
          ) : (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="font-display text-xl font-extrabold">{selected.outsideMealLogItem.name}</h2>
                <p className="text-xs text-brand-muted">Reviewing revision {selected.claimedRevision ?? selected.outsideMealLogItem.currentRevision} · {selected.queueReason?.replaceAll('_', ' ').toLowerCase()}</p>
                <p className="text-xs text-brand-muted">
                  Estimated range: {selected.outsideMealLogItem.calorieLow ?? '—'}–
                  {selected.outsideMealLogItem.calorieHigh ?? '—'} kcal
                </p>
                {selected.outsideMealLogItem.mealLog.estimationContext &&
                  <p className="mt-2 rounded-lg bg-brand-bgAlt p-2 text-xs">Preparation context: {selected.outsideMealLogItem.mealLog.estimationContext}</p>}
                {selected.outsideMealLogItem.ingredients?.length ?
                  <p className="mt-2 text-xs text-brand-muted">Recorded ingredients: {selected.outsideMealLogItem.ingredients.join(', ')}</p> : null}
                {selected.outsideMealLogItem.mealLog.outsideImageMime && <button type="button" className="mt-2 text-xs text-brand-green underline"
                  onClick={async () => {
                    try {
                      const response = await api.get(`/nutritionist/outside-meal-reviews/${selected.id}/image`, { responseType: 'blob' });
                      const url = URL.createObjectURL(response.data);
                      window.open(url, '_blank', 'noopener,noreferrer');
                      setTimeout(() => URL.revokeObjectURL(url), 60_000);
                    } catch (err) { setError(getApiErrorMessage(err, 'Could not open this review image.')); }
                  }}>View attached photo</button>}
              </div>
              {selected.messages?.length > 0 && <div className="space-y-2 rounded-xl border border-brand-border p-3 text-xs">
                <p className="font-bold">Clarification history</p>
                {selected.messages.map((message) => <p key={message.id}>
                  <strong>{message.sender === 'NUTRITIONIST' ? 'Nutritionist' : 'User'}:</strong> {message.content}
                  <span className="ml-2 text-brand-muted">revision {message.itemRevision}</span>
                </p>)}
              </div>}
              <div className="grid grid-cols-2 gap-3">
                {(['calories', 'proteinG', 'carbsG', 'fatG'] as const).map((field) => (
                  <label key={field} className="text-xs font-bold">
                    {field}
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={correction[field]}
                      onChange={(event) => setCorrection((value) => ({ ...value, [field]: event.target.value }))}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-brand-surface p-3"
                    />
                  </label>
                ))}
              </div>
              <label className="text-xs font-bold">
                Review reason
                <textarea
                  value={correction.reason}
                  onChange={(event) => setCorrection((value) => ({ ...value, reason: event.target.value }))}
                  className="mt-1 min-h-24 w-full rounded-xl border border-brand-border bg-brand-surface p-3"
                  placeholder="Evidence and rationale (required)"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={correction.reason.trim().length < 3}
                  isLoading={busy}
                  onClick={() => void resolve('VERIFY')}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirm estimate
                </Button>
                <Button
                  variant="secondary"
                  disabled={correction.reason.trim().length < 3}
                  onClick={() => void resolve('CORRECT')}
                >
                  Save correction
                </Button>
                <Button
                  variant="secondary"
                  disabled={correction.reason.trim().length < 3}
                  onClick={() => void resolve('NEEDS_MORE_INFO')}
                >
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Need info
                </Button>
                <Button variant="secondary" disabled={correction.reason.trim().length < 3}
                  onClick={() => void resolve('UNVERIFIABLE')}>Mark unverifiable</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
      <section className="space-y-3" aria-label="Observed food admissions">
        <h2 className="font-display text-xl font-extrabold">Consented food observations</h2>
        <p className="text-sm text-brand-muted">Only current, confirmed estimates with explicit user permission appear here. Admission creates a reference or an unverified recipe candidate; it never certifies a meal.</p>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-2 p-4">
            {submissions.length === 0 && <p className="text-sm text-brand-muted">No observations awaiting classification.</p>}
            {submissions.map((row) => <button type="button" key={row.id}
              onClick={() => selectObserved(row)} className="block w-full rounded-xl border border-brand-border p-3 text-left text-sm hover:border-brand-green">
              <strong>{row.sourceOutsideMealItem?.name ?? 'Source no longer available'}</strong>
              <span className="ml-2 text-brand-muted">{row.sourceOutsideMealItem?.portionGrams ?? 'Unknown'} g · revision {row.sourceRevision}</span>
            </button>)}
          </Card>
          <Card className="space-y-3 p-4">
            {!observed ? <p className="text-sm text-brand-muted">Select a consented observation to classify.</p> : <>
              <p className="text-xs text-brand-muted">{observed.sourceOutsideMealItem?.calories} kcal · P {observed.sourceOutsideMealItem?.proteinG} g · C {observed.sourceOutsideMealItem?.carbsG} g · F {observed.sourceOutsideMealItem?.fatG} g. Source identity and private notes are excluded.</p>
              <label className="block text-sm">Outcome<select value={observedKind}
                onChange={(event) => setObservedKind(event.target.value as typeof observedKind)}
                className="mt-1 w-full rounded-xl border border-brand-border bg-brand-surface p-2">
                <option value="FOOD_REFERENCE">Observed food reference</option>
                <option value="RECIPE_CANDIDATE">Reproducible recipe candidate</option>
              </select></label>
              <label className="block text-sm">Deidentified canonical name<input value={canonicalName}
                onChange={(event) => setCanonicalName(event.target.value)}
                className="mt-1 w-full rounded-xl border border-brand-border bg-brand-surface p-2" /></label>
              {observedKind === 'RECIPE_CANDIDATE' && <>
                <label className="block text-sm">Ingredients, one per line: name | quantity | unit<textarea
                  value={ingredientLines} onChange={(event) => setIngredientLines(event.target.value)}
                  className="mt-1 min-h-24 w-full rounded-xl border border-brand-border bg-brand-surface p-2" /></label>
                <label className="block text-sm">Preparation method<textarea value={preparation}
                  onChange={(event) => setPreparation(event.target.value)}
                  className="mt-1 min-h-24 w-full rounded-xl border border-brand-border bg-brand-surface p-2" /></label>
                <div className="flex gap-3">{['BREAKFAST', 'LUNCH', 'DINNER'].map((type) => <label key={type} className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={applicableTypes.includes(type)} onChange={(event) =>
                    setApplicableTypes((previous) => event.target.checked ? [...previous, type] : previous.filter((value) => value !== type))} />
                  {type.toLowerCase()}</label>)}</div>
              </>}
              <Button disabled={canonicalName.trim().length < 2 || busy} onClick={() => void admitObserved()}>
                Admit deidentified {observedKind === 'FOOD_REFERENCE' ? 'reference' : 'candidate'}
              </Button>
            </>}
          </Card>
        </div>
      </section>
    </div>
  );
}
