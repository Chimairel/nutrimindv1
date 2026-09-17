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
          payouts.map((payout) => {
            const profile = payout.statement?.nutritionistProfile;
            return (
              <div key={payout.id} className="rounded-2xl border border-brand-border p-4">
                <div className="flex items-center justify-between">
                  <strong>{peso(payout.amountMinor)}</strong>
                  <span className="rounded-full bg-brand-bgAlt px-2.5 py-1 text-[10px] font-bold text-brand-muted">
                    {payout.status}
                  </span>
                </div>
                {profile && (
                  <div className="mt-2.5 rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <span className="text-brand-muted">
                        Disburse to: <strong className="text-brand-text">{profile.user?.name || 'Nutritionist'}</strong>
                      </span>
                      {profile.payoutChannel ? (
                        <span className="rounded-md border border-brand-cyan/30 bg-brand-cyan/10 px-2 py-0.5 text-[10px] font-bold text-brand-cyan">
                          {profile.payoutChannel}
                          {profile.payoutBankName ? ` (${profile.payoutBankName})` : ''}
                        </span>
                      ) : (
                        <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                          No payout method linked
                        </span>
                      )}
                    </div>
                    {profile.payoutChannel && (
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-brand-muted">
                        <span>
                          Account No:{' '}
                          <strong className="font-mono text-brand-text">{profile.payoutAccountNumber}</strong>
                        </span>
                        {profile.payoutAccountName && (
                          <span>
                            Account Name:{' '}
                            <strong className="text-brand-text">{profile.payoutAccountName}</strong>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {payout.externalReference && (
                  <p className="mt-2 text-xs text-brand-muted">
                    Transaction Ref:{' '}
                    <span className="font-mono font-semibold text-brand-text">{payout.externalReference}</span>
                  </p>
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
                      Record GCash / Bank reference
                    </Button>
                  )}
                </div>
              </div>
            );
          })
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
  const externalReference = window.prompt(
    'Enter GCash / Maya / Bank reference number (e.g. GCash Ref 1029384756):'
  );
  if (externalReference)
    void act(
      `payout-record-${id}`,
      () => api.post(`/admin/compensation/payouts/${id}/record`, { externalReference }),
      'Off-platform payout evidence recorded.'
    );
}
