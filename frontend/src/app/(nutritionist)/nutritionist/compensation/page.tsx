'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Edit2, Plus, Receipt, ShieldCheck, WalletCards } from 'lucide-react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatPhpMinor as peso, formatPhilippineDate as date } from '@/lib/formatters';

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
type PayoutMethod = {
  channel: string | null;
  accountName: string | null;
  accountNumber: string | null;
  bankName: string | null;
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
  payoutMethod: PayoutMethod | null;
  credits: Credit[];
  statements: Statement[];
};

type PayoutChannel = 'GCASH' | 'MAYA' | 'BPI' | 'BDO' | 'UNIONBANK' | 'OTHER';

const CHANNEL_CONFIG: Record<PayoutChannel, { label: string; badgeClass: string }> = {
  GCASH: { label: 'GCash', badgeClass: 'border-sky-500/30 bg-sky-500/10 text-sky-400' },
  MAYA: { label: 'Maya', badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  BPI: { label: 'BPI', badgeClass: 'border-red-500/30 bg-red-500/10 text-red-400' },
  BDO: { label: 'BDO', badgeClass: 'border-blue-500/30 bg-blue-500/10 text-blue-400' },
  UNIONBANK: { label: 'UnionBank', badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
  OTHER: { label: 'Other Bank', badgeClass: 'border-brand-border bg-brand-bgAlt text-brand-text' },
};

function maskAccountNumber(number: string): string {
  const clean = number.trim();
  if (clean.length <= 4) return clean;
  if (clean.length <= 8) return `${clean.slice(0, 2)} •••• ${clean.slice(-2)}`;
  return `${clean.slice(0, 4)} •••• ${clean.slice(-4)}`;
}

export default function NutritionistCompensationPage() {
  const [data, setData] = useState<CompensationData | null>(null);
  const [error, setError] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutModalError, setPayoutModalError] = useState('');
  const [payoutForm, setPayoutForm] = useState<{
    channel: PayoutChannel;
    accountName: string;
    accountNumber: string;
    bankName: string;
  }>({
    channel: 'GCASH',
    accountName: '',
    accountNumber: '',
    bankName: '',
  });

  useEffect(() => {
    api
      .get('/nutritionist/compensation')
      .then((response) => setData(response.data.data))
      .catch((reason) => setError(getApiErrorMessage(reason, 'Could not load your compensation records.')));
  }, []);

  const openPayoutModal = () => {
    if (data?.payoutMethod?.channel) {
      setPayoutForm({
        channel: (data.payoutMethod.channel as PayoutChannel) || 'GCASH',
        accountName: data.payoutMethod.accountName || '',
        accountNumber: data.payoutMethod.accountNumber || '',
        bankName: data.payoutMethod.bankName || '',
      });
    } else {
      setPayoutForm({
        channel: 'GCASH',
        accountName: '',
        accountNumber: '',
        bankName: '',
      });
    }
    setPayoutModalError('');
    setIsModalOpen(true);
  };

  const handleSavePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutModalError('');
    if (!payoutForm.accountName.trim()) {
      setPayoutModalError('Account name is required.');
      return;
    }
    if (!payoutForm.accountNumber.trim()) {
      setPayoutModalError('Account or mobile number is required.');
      return;
    }
    if (payoutForm.channel === 'OTHER' && !payoutForm.bankName.trim()) {
      setPayoutModalError('Bank name is required when selecting Other Bank.');
      return;
    }

    setSavingPayout(true);
    try {
      const res = await api.patch('/nutritionist/compensation/payout-method', {
        channel: payoutForm.channel,
        accountName: payoutForm.accountName.trim(),
        accountNumber: payoutForm.accountNumber.trim(),
        bankName: payoutForm.channel === 'OTHER' ? payoutForm.bankName.trim() : null,
      });
      setData((prev) => (prev ? { ...prev, payoutMethod: res.data.data } : prev));
      setIsModalOpen(false);
      setSuccessNotice('Disbursement account updated successfully.');
      setTimeout(() => setSuccessNotice(''), 5000);
    } catch (err: unknown) {
      setPayoutModalError(getApiErrorMessage(err, 'Failed to update disbursement account details.'));
    } finally {
      setSavingPayout(false);
    }
  };
  if (error) return <div className="portal-page mt-16 text-center text-red-400">{error}</div>;
  if (!data) return <PortalLoadingState message="Loading your compensation records..." />;

  const currentChannel = (data.payoutMethod?.channel as PayoutChannel) || null;
  const channelInfo = currentChannel ? CHANNEL_CONFIG[currentChannel] || CHANNEL_CONFIG.OTHER : null;

  return (
    <div className="portal-page space-y-7">
      <PortalPageHeader
        icon={Receipt}
        eyebrow="Private workspace"
        title="My compensation"
        description="Track completed clinical reviews, period cutoff statements, and disbursement payment history."
        meta={
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-brand-muted">
            Only your records
          </span>
        }
      />

      {successNotice && (
        <div className="flex items-center gap-2 rounded-2xl border border-brand-green/30 bg-brand-green/10 p-4 text-sm text-brand-green">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* Outcome neutrality disclosure */}
      <div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/5 p-4 text-sm leading-relaxed text-brand-muted">
        <strong className="text-brand-text">Review compensation is outcome-neutral.</strong> A valid completed ordinary
        review receives the same credit whether it is approved, rejected, or escalated. Claims and expired or abandoned
        work do not count. Payouts are manually disbursed to your nominated GCash, Maya, or Philippine bank account
        after each cutoff.
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [
            'Total Completed Reviews',
            `${(data.summary.lifetimeNetUnitsMillis / 1000).toLocaleString('en-US', {
              maximumFractionDigits: 3,
            })} reviews`,
          ],
          [
            'Pending Period Reviews',
            `${(data.summary.availableUnitsMillis / 1000).toLocaleString('en-US', {
              maximumFractionDigits: 3,
            })} to be paid`,
          ],
          ['Approved Gross Earnings', peso(data.summary.approvedGrossMinor)],
          ['Total Payouts Received', peso(data.summary.recordedPaidMinor)],
        ].map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">{label}</p>
            <p className="mt-3 font-display text-2xl font-black text-brand-text">{value}</p>
          </Card>
        ))}
      </div>

      {/* Payout Account (GCash / Maya / Bank) Card */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-brand-border bg-brand-bgAlt text-brand-green">
              <WalletCards className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-black text-brand-text">Payout Account (GCash / Bank)</h2>
              <p className="text-xs text-brand-muted">
                Nominated account for receiving manual off-platform compensation payouts.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant={data.payoutMethod?.channel ? 'secondary' : 'primary'}
            onClick={openPayoutModal}
            className="self-start sm:self-auto"
          >
            {data.payoutMethod?.channel ? (
              <>
                <Edit2 className="h-3.5 w-3.5" /> Edit Account
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" /> Link Payout Account
              </>
            )}
          </Button>
        </div>

        <div className="mt-5">
          {data.payoutMethod?.channel ? (
            <div className="rounded-2xl border border-brand-border bg-brand-bgAlt/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${channelInfo?.badgeClass || 'bg-brand-bgAlt text-brand-text'}`}
                  >
                    {channelInfo?.label}
                    {data.payoutMethod.bankName ? ` (${data.payoutMethod.bankName})` : ''}
                  </span>
                  <span className="font-mono text-sm font-bold text-brand-text">
                    {maskAccountNumber(data.payoutMethod.accountNumber || '')}
                  </span>
                </div>
                <span className="text-xs text-brand-muted">
                  Registered Name: <strong className="text-brand-text">{data.payoutMethod.accountName}</strong>
                </span>
              </div>
              <p className="mt-3 text-[11px] text-brand-muted">
                Disbursements are sent off-platform by NutriMind administrators directly to this account after statement
                approvals.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs text-brand-muted">
              <p className="font-medium text-amber-300">No disbursement account linked yet</p>
              <p className="mt-1">
                Please link your GCash, Maya, or Philippine bank account so administrators can disburse your earned
                compensation.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Period Statements Card */}
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
                      Policy {statement.period.policy.version} ·{' '}
                      {(statement.creditedUnitsMillis / 1000).toLocaleString('en-US', {
                        maximumFractionDigits: 3,
                      })}{' '}
                      completed reviews
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
                        Disbursed payout: {peso(payout.amountMinor)} · {payout.status}
                        {payout.externalReference ? ` · Ref: ${payout.externalReference}` : ''}
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

      {/* Review Work-credit History Card */}
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <Clock3 className="h-5 w-5 text-brand-cyan" />
          <div>
            <h2 className="font-display text-lg font-black">Clinical review history</h2>
            <p className="text-xs text-brand-muted">
              Completed meal approvals, adjustments, and rejections. Prior evidence is never overwritten.
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
                  {(credit.unitsMillis / 1000).toLocaleString('en-US', { maximumFractionDigits: 3 })} review
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-brand-muted">No eligible completed work credits yet.</p>
          )}
        </div>
      </Card>

      {/* Footer disclaimer */}
      <div className="flex items-center gap-2 text-xs text-brand-muted">
        <WalletCards className="h-4 w-4" /> Payouts are sent manually off-platform to your saved account. Questions
        regarding review counts remain subject to clinical audit.
      </div>

      {/* Payout Account Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !savingPayout && setIsModalOpen(false)}
        title={data?.payoutMethod?.channel ? 'Update Payout Account' : 'Link Payout Account'}
        description="Nominate your GCash, Maya, or Philippine bank account for manual off-platform payouts."
        footer={
          <div className="flex items-center justify-end gap-3">
            <Button type="button" variant="secondary" disabled={savingPayout} onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="payout-method-form" isLoading={savingPayout}>
              Save Account
            </Button>
          </div>
        }
      >
        <form id="payout-method-form" onSubmit={handleSavePayout} className="space-y-4">
          {payoutModalError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {payoutModalError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Payout Channel
            </label>
            <select
              value={payoutForm.channel}
              onChange={(e) =>
                setPayoutForm((prev) => ({
                  ...prev,
                  channel: e.target.value as PayoutChannel,
                }))
              }
              className="mt-1.5 h-11 w-full rounded-2xl border border-brand-border bg-brand-bgAlt px-4 text-sm text-brand-text outline-none focus:border-brand-green"
            >
              <option value="GCASH">GCash (Mobile Wallet)</option>
              <option value="MAYA">Maya / PayMaya</option>
              <option value="BPI">Bank of the Philippine Islands (BPI)</option>
              <option value="BDO">Banco de Oro (BDO)</option>
              <option value="UNIONBANK">UnionBank of the Philippines</option>
              <option value="OTHER">Other Philippine Bank</option>
            </select>
          </div>

          {payoutForm.channel === 'OTHER' && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">Bank Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Landbank, Metrobank, Security Bank"
                value={payoutForm.bankName}
                onChange={(e) => setPayoutForm((prev) => ({ ...prev, bankName: e.target.value }))}
                className="mt-1.5 h-11 w-full rounded-2xl border border-brand-border bg-brand-bgAlt px-4 text-sm text-brand-text outline-none focus:border-brand-green"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Account / Registered Name
            </label>
            <input
              type="text"
              required
              placeholder="Exact name on GCash/Maya/Bank account"
              value={payoutForm.accountName}
              onChange={(e) => setPayoutForm((prev) => ({ ...prev, accountName: e.target.value }))}
              className="mt-1.5 h-11 w-full rounded-2xl border border-brand-border bg-brand-bgAlt px-4 text-sm text-brand-text outline-none focus:border-brand-green"
            />
            <p className="mt-1 text-[11px] text-brand-muted">Must match your verified account name.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Account / Mobile Number
            </label>
            <input
              type="text"
              required
              placeholder={
                payoutForm.channel === 'GCASH' || payoutForm.channel === 'MAYA' ? 'e.g. 09171234567' : 'e.g. 1234567890'
              }
              value={payoutForm.accountNumber}
              onChange={(e) => setPayoutForm((prev) => ({ ...prev, accountNumber: e.target.value }))}
              className="mt-1.5 h-11 w-full rounded-2xl border border-brand-border bg-brand-bgAlt px-4 text-sm font-mono text-brand-text outline-none focus:border-brand-green"
            />
          </div>

          <div className="rounded-xl border border-brand-cyan/20 bg-brand-cyan/5 p-3 text-xs text-brand-muted">
            Please ensure the number and account name are correct. Payouts sent to incorrect numbers cannot be
            automatically reversed.
          </div>
        </form>
      </Modal>
    </div>
  );
}
