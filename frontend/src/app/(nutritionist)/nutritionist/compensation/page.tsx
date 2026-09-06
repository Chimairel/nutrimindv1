'use client';

import React, { useEffect, useState } from 'react';
import { Clock3, Receipt, ShieldCheck, WalletCards } from 'lucide-react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import PortalPageHeader from '@/components/shared/PortalPageHeader';

type Credit = {
  id: string;
  entryType: string;
  creditKind: string;
  sourceOutcome: string;
  unitsMillis: number;
  earnedAt: string;
  reasonCode: string;
};
type Adjustment = { id: string; amountMinor: number; status: string; reasonCode: string; note?: string | null };
type Payout = { id: string; amountMinor: number; status: string; externalReference?: string | null };
type Statement = {
  id: string;
  status: string;
  currency: string;
  grossMinor: number;
  baseRetainerMinor: number;
  workloadAllowanceMinor: number;
  adjustmentMinor: number;
  creditedUnitsMillis: number;
  period: { periodStart: string; periodEnd: string; policy: { version: string } };
  adjustments: Adjustment[];
  payouts: Payout[];
};
type CompensationData = {
  summary: {
    lifetimeNetUnitsMillis: number;
    availableUnitsMillis: number;
    statementCount: number;
    approvedGrossMinor: number;
    recordedPaidMinor: number;
    currency: string;
  };
  credits: Credit[];
  statements: Statement[];
};
const peso = (minor: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(minor / 100);
const date = (value: string) => new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value));

export default function NutritionistCompensationPage() {
  const [data, setData] = useState<CompensationData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .get('/nutritionist/compensation')
      .then((response) => setData(response.data.data))
      .catch((reason) => setError(reason.response?.data?.error || 'Could not load your compensation records.'));
  }, []);
  if (error) return <div className="portal-page mt-16 text-center text-red-400">{error}</div>;
  if (!data)
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-brand-muted">
        Loading your compensation records…
      </div>
    );
  return (
    <div className="portal-page space-y-7">
      <PortalPageHeader
        icon={Receipt}
        eyebrow="Private workspace"
        title="My compensation"
        description="Review your credited work, period statements, signed adjustments, and manual payout evidence."
        meta={
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-white/50">
            Only your records
          </span>
        }
      />
      <div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/5 p-4 text-sm text-brand-muted">
        <strong className="text-brand-text">Work credit is outcome-neutral.</strong> A valid completed ordinary review
        receives the same credit whether it is approved, rejected, or escalated. Claims and expired or abandoned work do
        not count.
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Lifetime work units', (data.summary.lifetimeNetUnitsMillis / 1000).toFixed(3)],
          ['Unstatemented units', (data.summary.availableUnitsMillis / 1000).toFixed(3)],
          ['Approved gross', peso(data.summary.approvedGrossMinor)],
          ['Recorded paid', peso(data.summary.recordedPaidMinor)],
        ].map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">{label}</p>
            <p className="mt-3 font-display text-2xl font-black text-brand-text">{value}</p>
          </Card>
        ))}
      </div>
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-brand-green" />
          <div>
            <h2 className="font-display text-lg font-black">Period statements</h2>
            <p className="text-xs text-brand-muted">Amounts use the policy locked to each period.</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {data.statements.length ? (
            data.statements.map((statement) => (
              <div key={statement.id} className="rounded-2xl border border-brand-border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <strong>
                      {date(statement.period.periodStart)} – {date(statement.period.periodEnd)}
                    </strong>
                    <p className="mt-1 text-xs text-brand-muted">
                      Policy {statement.period.policy.version} · {(statement.creditedUnitsMillis / 1000).toFixed(3)}{' '}
                      credited units
                    </p>
                    <p className="mt-2 text-xs text-brand-muted">
                      Base {peso(statement.baseRetainerMinor)} + workload {peso(statement.workloadAllowanceMinor)} +
                      adjustments {peso(statement.adjustmentMinor)}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <span className="rounded-full bg-brand-bgAlt px-2 py-1 text-[10px] font-bold">
                      {statement.status}
                    </span>
                    <p className="mt-2 font-display text-xl font-black">{peso(statement.grossMinor)}</p>
                  </div>
                </div>
                {statement.adjustments.length > 0 && (
                  <div className="mt-3 border-t border-brand-border pt-3 text-xs text-brand-muted">
                    {statement.adjustments.map((adjustment) => (
                      <p key={adjustment.id}>
                        {adjustment.reasonCode}: {peso(adjustment.amountMinor)} · {adjustment.status}
                      </p>
                    ))}
                  </div>
                )}
                {statement.payouts.length > 0 && (
                  <div className="mt-3 border-t border-brand-border pt-3 text-xs text-brand-muted">
                    {statement.payouts.map((payout) => (
                      <p key={payout.id}>
                        Manual payout: {peso(payout.amountMinor)} · {payout.status}
                        {payout.externalReference ? ` · ${payout.externalReference}` : ''}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-brand-muted">No statements have been prepared yet.</p>
          )}
        </div>
      </Card>
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Clock3 className="h-5 w-5 text-brand-cyan" />
          <div>
            <h2 className="font-display text-lg font-black">Work-credit history</h2>
            <p className="text-xs text-brand-muted">
              Corrections appear as linked negative reversals; prior evidence is never overwritten.
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {data.credits.length ? (
            data.credits.map((credit) => (
              <div
                key={credit.id}
                className="flex flex-col gap-2 rounded-2xl border border-brand-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <strong className="text-sm">{credit.creditKind.replaceAll('_', ' ')}</strong>
                  <p className="text-xs text-brand-muted">
                    {credit.sourceOutcome} · {credit.reasonCode} · {date(credit.earnedAt)}
                  </p>
                </div>
                <span
                  className={`font-mono text-sm font-bold ${credit.unitsMillis < 0 ? 'text-red-400' : 'text-brand-green'}`}
                >
                  {credit.unitsMillis > 0 ? '+' : ''}
                  {(credit.unitsMillis / 1000).toFixed(3)}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-brand-muted">No eligible completed work credits yet.</p>
          )}
        </div>
      </Card>
      <div className="flex items-center gap-2 text-xs text-brand-muted">
        <WalletCards className="h-4 w-4" /> Questions or disputes remain an administrative review; this page does not
        collect payout account details.
      </div>
    </div>
  );
}
