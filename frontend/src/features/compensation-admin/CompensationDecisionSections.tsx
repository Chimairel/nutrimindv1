import { ShieldCheck, WalletCards } from 'lucide-react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { peso, type CompensationAction, type Workspace } from './model';

export function CompensationDecisionSections({ data, act }: { data: Workspace; act: CompensationAction }) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <AdjustmentDecisions adjustments={data.pendingAdjustments} act={act} />
      <PayoutEvidence payouts={data.payouts} act={act} />
    </div>
  );
}

function AdjustmentDecisions({
  adjustments,
  act,
}: {
  adjustments: Workspace['pendingAdjustments'];
  act: CompensationAction;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-5 w-5 text-brand-cyan" />
        <h2 className="font-display text-lg font-black">Adjustment decisions</h2>
      </div>
      <div className="mt-4 space-y-3">
        {adjustments.length ? (
          adjustments.map((adjustment) => (
            <div key={adjustment.id} className="rounded-2xl border border-brand-border p-4">
              <strong>
                {adjustment.statement.nutritionistProfile.user.name} · {peso(adjustment.amountMinor)}
              </strong>
              <p className="text-xs text-brand-muted">{adjustment.reasonCode}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    void act(
                      `adjust-ok-${adjustment.id}`,
                      () =>
                        api.post(`/admin/compensation/adjustments/${adjustment.id}/decision`, { decision: 'APPROVE' }),
                      'Adjustment approved.'
                    )
                  }
                >
                  Approve
                </Button>
                <Button size="sm" variant="danger" onClick={() => rejectAdjustment(adjustment.id, act)}>
                  Reject
                </Button>
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-brand-muted">No pending adjustments.</p>
        )}
      </div>
    </Card>
  );
}

function PayoutEvidence({ payouts, act }: { payouts: Workspace['payouts']; act: CompensationAction }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <WalletCards className="h-5 w-5 text-brand-green" />
        <h2 className="font-display text-lg font-black">Manual payout evidence</h2>
      </div>
      <div className="mt-4 space-y-3">
        {payouts.length ? (
          payouts.map((payout) => (
            <div key={payout.id} className="rounded-2xl border border-brand-border p-4">
              <div className="flex items-center justify-between">
                <strong>{peso(payout.amountMinor)}</strong>
                <span className="text-[10px] font-bold text-brand-muted">{payout.status}</span>
              </div>
              {payout.externalReference && (
                <p className="mt-1 text-xs text-brand-muted">Evidence: {payout.externalReference}</p>
              )}
              <div className="mt-3">
                {payout.status === 'DRAFT' && (
                  <Button
                    size="sm"
                    onClick={() =>
                      void act(
                        `payout-ok-${payout.id}`,
                        () => api.post(`/admin/compensation/payouts/${payout.id}/approve`),
                        'Manual payout evidence approved.'
                      )
                    }
                  >
                    Approve as checker
                  </Button>
                )}
                {payout.status === 'APPROVED' && (
                  <Button size="sm" onClick={() => recordPayout(payout.id, act)}>
                    Record evidence
                  </Button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-brand-muted">No payout records.</p>
        )}
      </div>
    </Card>
  );
}

function rejectAdjustment(id: string, act: CompensationAction) {
  const reason = window.prompt('Rejection reason:');
  if (reason)
    void act(
      `adjust-no-${id}`,
      () => api.post(`/admin/compensation/adjustments/${id}/decision`, { decision: 'REJECT', reason }),
      'Adjustment rejected.'
    );
}

function recordPayout(id: string, act: CompensationAction) {
  const externalReference = window.prompt('Off-platform evidence reference (no account details):');
  if (externalReference)
    void act(
      `payout-record-${id}`,
      () => api.post(`/admin/compensation/payouts/${id}/record`, { externalReference }),
      'Off-platform payout evidence recorded.'
    );
}
