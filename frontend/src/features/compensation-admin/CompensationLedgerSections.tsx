import { FileCheck2 } from 'lucide-react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { peso, shortDate, type CompensationAction, type Period, type Policy, type Statement } from './model';

export function ReconciliationCards({
  reconciliation,
}: {
  reconciliation: {
    approvedStatementGrossMinor: number;
    committedPayoutMinor: number;
    recordedPaidMinor: number;
    outstandingApprovedMinor: number;
    mismatchMinor: number;
  };
}) {
  const values = [
    ['Approved gross', reconciliation.approvedStatementGrossMinor],
    ['Committed', reconciliation.committedPayoutMinor],
    ['Recorded paid', reconciliation.recordedPaidMinor],
    ['Outstanding', reconciliation.outstandingApprovedMinor],
    ['Mismatch', reconciliation.mismatchMinor],
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {values.map(([label, value]) => (
        <Card key={String(label)} className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">{label}</p>
          <p className="mt-3 font-display text-xl font-black text-brand-text">{peso(Number(value))}</p>
        </Card>
      ))}
    </div>
  );
}

export function PolicyList({
  policies,
  busy,
  act,
}: {
  policies: Policy[];
  busy: string | null;
  act: CompensationAction;
}) {
  return (
    <Card className="p-6">
      <h2 className="font-display text-lg font-black">Policy versions</h2>
      <div className="mt-4 space-y-3">
        {policies.length ? (
          policies.map((policy) => (
            <div
              key={policy.id}
              className="flex flex-col gap-3 rounded-2xl border border-brand-border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex items-center gap-2">
                  <strong>{policy.version}</strong>
                  <span className="rounded-full bg-brand-bgAlt px-2 py-1 text-[10px] font-bold">{policy.status}</span>
                </div>
                <p className="mt-1 text-xs text-brand-muted">
                  {peso(policy.baseRetainerMinor)} base · cap {(policy.workloadUnitCapMillis / 1000).toFixed(3)} units ·
                  effective {shortDate(policy.effectiveFrom)}
                </p>
              </div>
              {policy.status === 'DRAFT' && (
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={busy === `activate-${policy.id}`}
                  onClick={() =>
                    void act(
                      `activate-${policy.id}`,
                      () => api.post(`/admin/compensation/policies/${policy.id}/activate`),
                      'Policy activated.'
                    )
                  }
                >
                  Activate as checker
                </Button>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-brand-muted">No compensation policies yet.</p>
        )}
      </div>
    </Card>
  );
}

export function PeriodList({ periods, act }: { periods: Period[]; act: CompensationAction }) {
  return (
    <Card className="p-6">
      <h2 className="font-display text-lg font-black">Periods</h2>
      <div className="mt-4 space-y-3">
        {periods.length ? (
          periods.map((period) => (
            <div
              key={period.id}
              className="flex flex-col gap-3 rounded-2xl border border-brand-border p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div>
                <strong>
                  {shortDate(period.periodStart)} – {shortDate(period.periodEnd)}
                </strong>
                <p className="text-xs text-brand-muted">
                  {period.policy.version} · {period.status} · {period._count.statements} statements
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {period.status === 'OPEN' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      void act(
                        `close-${period.id}`,
                        () => api.post(`/admin/compensation/periods/${period.id}/close`),
                        'Period closed for calculation.'
                      )
                    }
                  >
                    Close period
                  </Button>
                )}
                {period.status === 'CALCULATING' && (
                  <Button
                    size="sm"
                    onClick={() =>
                      void act(
                        `calculate-${period.id}`,
                        () => api.post(`/admin/compensation/periods/${period.id}/statements`),
                        'Statements calculated from locked credits.'
                      )
                    }
                  >
                    Calculate statements
                  </Button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-brand-muted">No periods yet.</p>
        )}
      </div>
    </Card>
  );
}

export function StatementList({ statements, act }: { statements: Statement[]; act: CompensationAction }) {
  const proposeAdjustment = (statement: Statement) => {
    const amount = window.prompt('Signed adjustment in PHP (use a minus sign for a deduction):');
    if (!amount) return;
    const reason = window.prompt(
      'Reason code (letters, numbers, dots, underscores, colons, or hyphens):',
      'ADMIN_CORRECTION'
    );
    if (!reason) return;
    void act(
      `adjust-${statement.id}`,
      () =>
        api.post(`/admin/compensation/statements/${statement.id}/adjustments`, {
          amountMinor: Math.round(Number(amount) * 100),
          currency: 'PHP',
          reasonCode: reason,
          idempotencyKey: `adjustment:${statement.id}:${crypto.randomUUID()}`,
        }),
      'Adjustment proposed for independent decision.'
    );
  };
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <FileCheck2 className="h-5 w-5 text-brand-green" />
        <div>
          <h2 className="font-display text-lg font-black">Statements</h2>
          <p className="text-xs text-brand-muted">
            Preparation, review, approval, and payout preparation require distinct administrators.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {statements.length ? (
          statements.map((statement) => (
            <StatementRow
              key={statement.id}
              statement={statement}
              act={act}
              onAdjust={() => proposeAdjustment(statement)}
            />
          ))
        ) : (
          <p className="text-sm text-brand-muted">No statements calculated.</p>
        )}
      </div>
    </Card>
  );
}

function StatementRow({
  statement,
  act,
  onAdjust,
}: {
  statement: Statement;
  act: CompensationAction;
  onAdjust: () => void;
}) {
  return (
    <div className="rounded-2xl border border-brand-border p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <strong>{statement.nutritionistProfile.user.name}</strong>
            <span className="rounded-full bg-brand-bgAlt px-2 py-1 text-[10px] font-bold">{statement.status}</span>
          </div>
          <p className="mt-1 text-xs text-brand-muted">
            Policy {statement.period.policy.version} · {(statement.creditedUnitsMillis / 1000).toFixed(3)} units ·
            allowance {peso(statement.workloadAllowanceMinor)} · adjustments {peso(statement.adjustmentMinor)}
          </p>
          <p className="mt-2 font-display text-lg font-black">{peso(statement.grossMinor)}</p>
        </div>
        <div className="flex max-w-xl flex-wrap gap-2">
          {statement.status === 'CALCULATED' && (
            <>
              <Button size="sm" variant="secondary" onClick={onAdjust}>
                Propose adjustment
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  void act(
                    `review-${statement.id}`,
                    () => api.post(`/admin/compensation/statements/${statement.id}/review`),
                    'Statement independently reviewed.'
                  )
                }
              >
                Review
              </Button>
            </>
          )}
          {statement.status === 'REVIEWED' && (
            <Button
              size="sm"
              onClick={() =>
                void act(
                  `approve-${statement.id}`,
                  () => api.post(`/admin/compensation/statements/${statement.id}/approve`),
                  'Statement independently approved.'
                )
              }
            >
              Approve
            </Button>
          )}
          {statement.status === 'APPROVED' && (
            <Button
              size="sm"
              onClick={() =>
                void act(
                  `payout-${statement.id}`,
                  () =>
                    api.post(`/admin/compensation/statements/${statement.id}/payouts`, {
                      idempotencyKey: `manual-payout:${statement.id}:${crypto.randomUUID()}`,
                    }),
                  'Manual payout evidence prepared for checker approval.'
                )
              }
            >
              Prepare payout evidence
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
