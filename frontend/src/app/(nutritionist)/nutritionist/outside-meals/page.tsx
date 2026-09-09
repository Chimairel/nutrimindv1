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
    ingredients: string[] | null;
    mealLog: { mealName: string; mealType: string | null; loggedAt: string };
  };
};

const emptyCorrection = { calories: '', proteinG: '', carbsG: '', fatG: '', reason: '' };

export default function OutsideMealReviewsPage() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [selected, setSelected] = useState<QueueRow | null>(null);
  const [correction, setCorrection] = useState(emptyCorrection);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await api.get('/nutritionist/outside-meal-reviews');
      setRows(response.data?.data ?? []);
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
      await api.post(`/nutritionist/outside-meal-reviews/${row.id}/claim`);
      setSelected({ ...row, claimStatus: { claimedByMe: true, claimedByOther: false, claimedByName: null } });
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

  const resolve = async (action: 'VERIFY' | 'CORRECT' | 'NEEDS_MORE_INFO') => {
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

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader
        icon={ClipboardCheck}
        eyebrow="Nutrition review"
        title="Outside meal estimates"
        description="Review AI estimates in risk order. Corrections automatically update the user's tracker and preserve the original estimate."
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
              title="No AI estimates waiting"
              description="New provisional outside-meal estimates will appear here."
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
                    <span className="text-xs font-bold">Priority {row.priority}</span>
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
                <p className="text-xs text-brand-muted">
                  AI range: {selected.outsideMealLogItem.calorieLow ?? '—'}–
                  {selected.outsideMealLogItem.calorieHigh ?? '—'} kcal
                </p>
              </div>
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
                  Verify
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
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
