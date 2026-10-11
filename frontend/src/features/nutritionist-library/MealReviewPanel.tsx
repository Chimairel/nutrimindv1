'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Dropdown from '@/components/ui/Dropdown';
import MealReviewTimeline, { reviewStateLabel, type ReviewIncident } from './MealReviewTimeline';
import RecipeDerivationForm from './RecipeDerivationForm';
import type { LibraryMeal } from './useNutritionistLibrary';

export type ReviewCase = {
  recipeVersion: string;
  reviewVersion: string;
  state: string;
  incidentCount: number;
  legacyHistoryUnknown: boolean;
  incident: (ReviewIncident & { claimedByNutritionistId: string | null }) | null;
  history: ReviewIncident[];
  validConfirmations: unknown[];
  canAdminRelease: boolean;
};
const field = 'min-h-11 w-full rounded-xl border border-brand-border bg-brand-bg p-3 text-sm text-brand-text';
export default function MealReviewPanel({
  meal,
  isAdmin,
  refresh,
}: {
  meal: LibraryMeal;
  isAdmin: boolean;
  refresh: () => Promise<void>;
}) {
  const ownerId = useAuth().user?.userId;
  const base = isAdmin ? '/admin' : '/nutritionist';
  const query = useSessionQuery<ReviewCase>({
    ownerId,
    resource: `recipe-review:${base}:${meal.id}:${meal.safetyEvidenceRevision}`,
    fetcher: async () => (await api.get(`${base}/meal-review-cases/${meal.id}`)).data.data,
    errorMessage: 'Review history could not be loaded.',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('NUTRITION');
  const [affected, setAffected] = useState('');
  const [explanation, setExplanation] = useState('');
  const [reference, setReference] = useState('');
  const [correction, setCorrection] = useState('');
  const [rationale, setRationale] = useState('');
  const [evidenceReviewed, setEvidenceReviewed] = useState(false);
  const [resolutions, setResolutions] = useState<Record<string, string>>({});
  const data = query.data;
  useEffect(() => {
    setEvidenceReviewed(false);
    setResolutions({});
    setRationale('');
  }, [data?.reviewVersion]);
  const held = data?.state === 'PENDING_REREVIEW' || data?.state === 'QUARANTINED';
  async function mutate(action: 'flag' | 'claim' | 'confirm' | 'release' | 'archive') {
    if (!data || busy) return;
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      const url =
        action === 'flag' ? `${base}/library/${meal.id}/flag` : `${base}/meal-review-cases/${meal.id}/${action}`;
      const payload =
        action === 'flag'
          ? {
              expectedVersion: data.recipeVersion,
              notes: {
                category,
                affectedFields: affected
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
                explanation,
                reference,
                proposedCorrection: correction,
              },
            }
          : {
              expectedVersion: data.reviewVersion,
              ...(action !== 'claim' ? { rationale } : {}),
              ...(action === 'confirm'
                ? {
                    evidenceReviewed,
                    riceRoleReviewed: evidenceReviewed,
                    resolutions: (data.incident?.reports ?? []).map((report) => ({
                      reportId: report.id,
                      rationale: resolutions[report.id] ?? '',
                    })),
                  }
                : {}),
            };
      await api.post(url, payload);
      setMessage(
        action === 'claim' ? 'Claimed for 30 minutes. Review every concern before confirming.' : 'Decision recorded.'
      );
      const updated = await query.refetch();
      if (!updated) setMessage('Decision recorded. Reload the history to see the current review state.');
      await refresh();
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
          'The review action failed. Refresh and try again.'
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      id="meal-wide-review"
      aria-label="Meal-wide review"
      className="scroll-mt-20 space-y-5 rounded-2xl border border-brand-border bg-brand-surface/60 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold">Meal-wide review</h2>
        {data && <strong className="rounded-full bg-brand-bg px-3 py-2 text-sm">{reviewStateLabel(data.state)}</strong>}
      </div>
      {(error || query.error) && (
        <p role="alert" className="text-sm text-status-error-text">
          {error || query.error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-brand-green">
          {message}
        </p>
      )}
      {query.isLoading && !data && <p role="status">Loading recorded review history…</p>}
      {query.error && (
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Retry history
        </Button>
      )}
      {data && (
        <>
          <p className="text-sm text-brand-muted">
            {held
              ? 'This recipe and its serving variants are unavailable. Existing member slots still need fresh safety checks after release.'
              : 'A flag immediately withholds this recipe and its serving variants from member use.'}{' '}
            Profile and condition approval concerns are handled separately.
          </p>
          {held && data.incident && (
            <div className="space-y-4">
              <p className="text-sm font-semibold">
                {data.state === 'QUARANTINED'
                  ? 'Quarantined after repeated flags. Only an admin can release or archive this recipe.'
                  : 'One uninvolved eligible RND can re-verify the current version.'}
              </p>
              {data.incident.reports.map((report) => (
                <section key={report.id} className="space-y-2 rounded-xl border border-amber-500/30 p-3 text-sm">
                  <h3 className="font-bold">
                    {report.notes.category ?? 'Legacy concern'} · {report.actorSnapshot.name ?? 'Actor not recorded'}
                  </h3>
                  <p className="text-xs text-brand-muted">
                    {report.notes.affectedFields?.join(', ') ?? 'Affected fields not recorded'}
                  </p>
                  <p className="whitespace-pre-wrap">{report.notes.explanation}</p>
                  <p>
                    <strong>Evidence:</strong> {report.notes.reference ?? 'Not recorded'}
                  </p>
                  <p>
                    <strong>Proposed correction:</strong> {report.notes.proposedCorrection ?? 'Not recorded'}
                  </p>
                  {!isAdmin && data.state !== 'QUARANTINED' && (
                    <label className="block font-semibold">
                      Resolution of this concern
                      <textarea
                        className={`${field} mt-2`}
                        rows={3}
                        minLength={20}
                        maxLength={3000}
                        value={resolutions[report.id] ?? ''}
                        onChange={(event) => setResolutions({ ...resolutions, [report.id]: event.target.value })}
                      />
                    </label>
                  )}
                </section>
              ))}
              {(isAdmin || data.state !== 'QUARANTINED') && (
                <>
                  <label className="block text-sm font-semibold">
                    {isAdmin ? 'Administrative rationale' : 'Independent review findings'}
                    <textarea
                      className={`${field} mt-2`}
                      minLength={20}
                      maxLength={3000}
                      rows={3}
                      value={rationale}
                      onChange={(event) => setRationale(event.target.value)}
                    />
                  </label>
                  {!isAdmin && (
                    <label className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="checkbox"
                        checked={evidenceReviewed}
                        onChange={(event) => setEvidenceReviewed(event.target.checked)}
                      />
                      I reviewed the nutrition evidence, measured ingredients, preparation and rice role for every
                      serving variant.
                    </label>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {isAdmin ? (
                      <>
                        <Button
                          disabled={busy || !data.canAdminRelease || rationale.trim().length < 20}
                          onClick={() => void mutate('release')}
                        >
                          Release quarantine
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busy || rationale.trim().length < 20}
                          onClick={() => void mutate('archive')}
                        >
                          Archive unresolved recipe
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="secondary" disabled={busy} onClick={() => void mutate('claim')}>
                          Claim re-review
                        </Button>
                        <Button
                          disabled={
                            busy ||
                            !evidenceReviewed ||
                            rationale.trim().length < 20 ||
                            data.incident.reports.some((report) => (resolutions[report.id]?.trim().length ?? 0) < 20)
                          }
                          onClick={() => void mutate('confirm')}
                        >
                          Re-verify recipe
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
              <p className="text-xs text-brand-muted">
                {data.state === 'QUARANTINED'
                  ? 'Admin release records an administrative decision. Member-specific clinical approvals still require RND review.'
                  : 'Authors, flaggers and challenged verifiers cannot re-verify this incident. Corrections and new evidence invalidate prior confirmations.'}
              </p>
              {!isAdmin && (
                <RecipeDerivationForm
                  key={`correction-${data.reviewVersion}`}
                  meal={meal}
                  correctionVersion={data.reviewVersion}
                  onCreated={() => {
                    void query.refetch();
                    void refresh();
                  }}
                />
              )}
            </div>
          )}
          {data.state !== 'ARCHIVED' && (
            <details className="rounded-xl border border-brand-border p-3" open={!held}>
              <summary className="min-h-11 cursor-pointer text-sm font-bold">
                {held ? 'Add evidence to this incident' : 'Flag recipe'}
              </summary>
              <div className="space-y-3 pt-3">
                <label className="block text-sm">
                  Concern category
                  <Dropdown value={category} onChange={setCategory}>
                    {['INGREDIENT', 'NUTRITION', 'ALLERGEN', 'PREPARATION', 'EVIDENCE', 'OTHER'].map((value) => (
                      <option key={value} value={value}>
                        {value.toLowerCase()}
                      </option>
                    ))}
                  </Dropdown>
                </label>
                <label className="block text-sm">
                  Affected ingredients or nutrition fields, separated by commas
                  <input
                    className={field}
                    value={affected}
                    onChange={(event) => setAffected(event.target.value)}
                    maxLength={2000}
                  />
                </label>
                {(
                  [
                    ['Explanation', explanation, setExplanation, 3000],
                    ['Supporting evidence or reference', reference, setReference, 2000],
                    ['Proposed correction', correction, setCorrection, 2000],
                  ] as const
                ).map(([label, value, setter, maximum]) => (
                  <label className="block text-sm" key={label}>
                    {label}
                    <textarea
                      className={field}
                      rows={3}
                      value={value}
                      onChange={(event) => setter(event.target.value)}
                      maxLength={maximum}
                    />
                  </label>
                ))}
                <Button
                  variant="secondary"
                  disabled={
                    busy ||
                    !affected.trim() ||
                    explanation.trim().length < 20 ||
                    reference.trim().length < 10 ||
                    correction.trim().length < 10
                  }
                  onClick={() => void mutate('flag')}
                >
                  {held ? 'Record additional evidence' : 'Flag and withhold recipe'}
                </Button>
              </div>
            </details>
          )}
          <MealReviewTimeline
            history={data.history}
            legacyHistoryUnknown={data.legacyHistoryUnknown}
            displayedReportIds={data.incident?.reports.map((report) => report.id)}
          />
        </>
      )}
    </section>
  );
}
