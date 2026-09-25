'use client';

import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import api from '@/lib/axios';

export type ReviewWorkspaceTab = 'pending' | 'second' | 'clinical' | 'audit' | 'disputed';

export function ReviewTabs({
  value,
  onChange,
}: {
  value: ReviewWorkspaceTab;
  onChange: (value: ReviewWorkspaceTab) => void;
}) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-brand-border bg-brand-bg/40 p-1 xl:grid-cols-5">
      {(
        [
          ['pending', 'Pending'],
          ['second', 'Second review'],
          ['clinical', 'Clinical documents'],
          ['audit', 'Audit'],
          ['disputed', 'Disputed'],
        ] as const
      ).map(([tab, label]) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`rounded-lg px-2 py-2 text-[10px] font-bold ${
            value === tab ? 'bg-brand-green text-[#07100d]' : 'text-brand-muted hover:text-brand-text'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

type GovernanceClearance = {
  id: string;
  condition: string;
  assuranceTier: string;
  state: string;
  auditReason?: string;
  uniqueUserExposure?: number;
  mealLibrary: { mealName: string };
};

type DisputedPlan = {
  id: string;
  mealName: string;
  mealType: string;
  scheduledDate: string;
  user: { name: string };
};

export default function GovernanceQueuePanel({
  tab,
  onTabChange,
}: {
  tab: 'audit' | 'disputed';
  onTabChange: (value: ReviewWorkspaceTab) => void;
}) {
  const [data, setData] = useState<{
    canLeadReview: boolean;
    clearances: GovernanceClearance[];
    plans?: DisputedPlan[];
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setMessage(null);
    try {
      const response = await api.get(`/nutritionist/governance/queue?view=${tab}`);
      setData(response.data.data);
    } catch {
      setMessage('Governance queue could not be loaded.');
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (url: string, decision: 'APPROVE' | 'REJECT') => {
    const rationale = window.prompt('Record the clinical rationale for this decision.');
    if (!rationale?.trim()) return;
    try {
      await api.post(url, { decision, rationale: rationale.trim() });
      setMessage('Decision recorded.');
      await load();
    } catch {
      setMessage('The decision could not be recorded. Check Lead eligibility and reviewer independence.');
    }
  };

  const suspend = async (id: string) => {
    const reason = window.prompt('Why should this reusable clearance be suspended?');
    if (!reason?.trim()) return;
    try {
      await api.post(`/nutritionist/condition-clearances/${id}/suspend`, { reason: reason.trim() });
      setMessage('Clearance suspended; future matching now fails closed.');
      await load();
    } catch {
      setMessage('Only an eligible Lead can suspend reusable evidence.');
    }
  };

  return (
    <div className="portal-page space-y-5">
      <div className="rounded-2xl border border-brand-green/20 bg-brand-surface p-5">
        <ReviewTabs value={tab} onChange={onTabChange} />
        <h1 className="font-display text-2xl font-black text-brand-text">
          {tab === 'audit' ? 'Reusable evidence audit queue' : 'Disputed decisions'}
        </h1>
        <p className="mt-2 text-sm text-brand-muted">
          {tab === 'audit'
            ? 'Priority is calculated by suspension, ruleset impact, assurance tier, unique-user exposure, review age, and daily sampling.'
            : 'Disagreements remain blocked until an independent Lead records adjudication.'}
        </p>
      </div>
      {message && (
        <div role="status" className="rounded-xl border border-brand-border p-3 text-sm text-brand-muted">
          {message}
        </div>
      )}
      {!data ? (
        <div className="p-8 text-center text-sm text-brand-muted">Loading governance queue…</div>
      ) : (
        <div className="space-y-3">
          {data.clearances.map((clearance) => (
            <div key={clearance.id} className="rounded-2xl border border-brand-border bg-brand-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-brand-text">{clearance.mealLibrary.mealName}</p>
                  <p className="mt-1 text-xs text-brand-muted">
                    {clearance.condition} · {clearance.assuranceTier} · {clearance.state}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-amber-500">
                    {clearance.auditReason || `Used by ${clearance.uniqueUserExposure ?? 0} users`}
                  </p>
                </div>
                {data.canLeadReview && (
                  <div className="flex gap-2">
                    {tab === 'disputed' ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            void decide(`/nutritionist/condition-clearances/${clearance.id}/resolve`, 'APPROVE')
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void decide(`/nutritionist/condition-clearances/${clearance.id}/resolve`, 'REJECT')
                          }
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => void suspend(clearance.id)}>
                        Suspend
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {tab === 'disputed' &&
            (data.plans || []).map((plan) => (
              <div key={plan.id} className="rounded-2xl border border-status-error-text/25 bg-brand-surface p-4">
                <p className="font-bold text-brand-text">{plan.mealName}</p>
                <p className="mt-1 text-xs text-brand-muted">
                  {plan.user.name} · {plan.mealType}
                </p>
                {data.canLeadReview && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void decide(`/nutritionist/review/${plan.id}/dispute-resolution`, 'APPROVE')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void decide(`/nutritionist/review/${plan.id}/dispute-resolution`, 'REJECT')}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))}
          {data.clearances.length === 0 && (data.plans?.length ?? 0) === 0 && (
            <div className="rounded-2xl border border-dashed border-brand-border p-10 text-center text-sm text-brand-muted">
              Queue is clear.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
