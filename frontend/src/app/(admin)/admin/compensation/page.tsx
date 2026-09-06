'use client';

import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { Calculator, FileCheck2, Plus, Receipt, RefreshCw, ShieldCheck, WalletCards } from 'lucide-react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PortalPageHeader from '@/components/shared/PortalPageHeader';

type Policy = { id: string; version: string; status: string; currency: string; baseRetainerMinor: number; workloadUnitCapMillis: number; workloadBands: Array<{ minimumUnitsMillis: number; allowanceMinor: number }>; effectiveFrom: string };
type Period = { id: string; status: string; periodStart: string; periodEnd: string; policy: { version: string }; _count: { statements: number } };
type Adjustment = { id: string; amountMinor: number; currency: string; reasonCode: string; note?: string; status: string };
type Payout = { id: string; status: string; amountMinor: number; currency: string; externalReference?: string | null };
type Statement = { id: string; status: string; grossMinor: number; creditedUnitsMillis: number; workloadAllowanceMinor: number; adjustmentMinor: number; currency: string; nutritionistProfile: { user: { name: string } }; period: { policy: { version: string }; periodStart: string; periodEnd: string }; adjustments: Adjustment[]; payouts: Payout[] };
type Workspace = {
  policies: Policy[];
  periods: Period[];
  statements: Statement[];
  pendingAdjustments: Array<Adjustment & { statement: { nutritionistProfile: { user: { name: string } } } }>;
  payouts: Payout[];
  reconciliation: { approvedStatementGrossMinor: number; committedPayoutMinor: number; recordedPaidMinor: number; outstandingApprovedMinor: number; mismatchMinor: number; currency: string };
};

const peso = (minor: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(minor / 100);
const date = (value: string) => new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value));
const field = 'min-h-11 w-full rounded-2xl border border-brand-border bg-brand-bgAlt px-4 text-sm text-brand-text outline-none focus:border-brand-green';
const apiError = (error: unknown, fallback: string) => {
  const candidate = error as { response?: { data?: { error?: unknown } } };
  return typeof candidate.response?.data?.error === 'string' ? candidate.response.data.error : fallback;
};

export default function AdminCompensationPage() {
  const [data, setData] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [policyForm, setPolicyForm] = useState({ version: '', baseRetainer: '', capUnits: '40', bands: '10:1000,20:2500,40:5000', effectiveFrom: '' });
  const [periodForm, setPeriodForm] = useState({ policyId: '', start: '', end: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/compensation');
      setData(response.data.data);
    } catch (error: unknown) {
      setNotice({ tone: 'error', text: apiError(error, 'Could not load compensation operations.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (key: string, request: () => Promise<unknown>, success: string) => {
    setBusy(key); setNotice(null);
    try { await request(); setNotice({ tone: 'ok', text: success }); await load(); }
    catch (error: unknown) { setNotice({ tone: 'error', text: apiError(error, 'The action could not be completed.') }); }
    finally { setBusy(null); }
  };

  const createPolicy = (event: FormEvent) => {
    event.preventDefault();
    const workloadBands = policyForm.bands.split(',').filter(Boolean).map((entry) => {
      const [units, php] = entry.trim().split(':').map(Number);
      return { minimumUnitsMillis: Math.round(units * 1000), allowanceMinor: Math.round(php * 100) };
    });
    void act('policy-new', () => api.post('/admin/compensation/policies', {
      version: policyForm.version,
      currency: 'PHP',
      baseRetainerMinor: Math.round(Number(policyForm.baseRetainer) * 100),
      workloadUnitCapMillis: Math.round(Number(policyForm.capUnits) * 1000),
      workloadBands,
      effectiveFrom: new Date(policyForm.effectiveFrom).toISOString(),
    }), 'Draft policy created. Another administrator must activate it.');
  };

  const createPeriod = (event: FormEvent) => {
    event.preventDefault();
    void act('period-new', () => api.post('/admin/compensation/periods', {
      policyId: periodForm.policyId,
      periodStart: new Date(periodForm.start).toISOString(),
      periodEnd: new Date(periodForm.end).toISOString(),
    }), 'Compensation period opened.');
  };

  const proposeAdjustment = (statement: Statement) => {
    const amount = window.prompt('Signed adjustment in PHP (use a minus sign for a deduction):');
    if (!amount) return;
    const reason = window.prompt('Reason code (letters, numbers, dots, underscores, colons, or hyphens):', 'ADMIN_CORRECTION');
    if (!reason) return;
    void act(`adjust-${statement.id}`, () => api.post(`/admin/compensation/statements/${statement.id}/adjustments`, {
      amountMinor: Math.round(Number(amount) * 100), currency: 'PHP', reasonCode: reason,
      idempotencyKey: `adjustment:${statement.id}:${crypto.randomUUID()}`,
    }), 'Adjustment proposed for independent decision.');
  };

  if (loading && !data) return <div className="flex min-h-[60vh] items-center justify-center text-brand-muted">Loading compensation ledger…</div>;

  return (
    <div className="portal-page space-y-7">
      <PortalPageHeader icon={Receipt} eyebrow="Administration · Compensation" title="Nutritionist compensation ledger" description="Prepare deterministic period statements, apply maker-checker controls, and record off-platform payout evidence." meta={<Button size="sm" variant="secondary" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Refresh</Button>} />

      <div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/5 p-4 text-sm text-brand-muted">
        <strong className="text-brand-text">Separate accounting domain.</strong> Subscription revenue does not fund or trigger a nutritionist payout. This workspace records manual evidence only and stores no bank or e-wallet details.
      </div>
      {notice && <div role="status" className={`rounded-2xl border p-4 text-sm ${notice.tone === 'ok' ? 'border-brand-green/30 bg-brand-green/10 text-brand-green' : 'border-red-400/30 bg-red-500/10 text-red-300'}`}>{notice.text}</div>}

      {data && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Approved gross', data.reconciliation.approvedStatementGrossMinor],
          ['Committed', data.reconciliation.committedPayoutMinor],
          ['Recorded paid', data.reconciliation.recordedPaidMinor],
          ['Outstanding', data.reconciliation.outstandingApprovedMinor],
          ['Mismatch', data.reconciliation.mismatchMinor],
        ].map(([label, value]) => <Card key={String(label)} className="p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">{label}</p><p className="mt-3 font-display text-xl font-black text-brand-text">{peso(Number(value))}</p></Card>)}
      </div>}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-6">
          <div className="mb-5 flex items-center gap-3"><Plus className="h-5 w-5 text-brand-green" /><div><h2 className="font-display text-lg font-black">Draft policy</h2><p className="text-xs text-brand-muted">Amounts are inactive until another admin activates this version.</p></div></div>
          <form onSubmit={createPolicy} className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-brand-muted">Version<input required className={`${field} mt-1`} value={policyForm.version} onChange={(e) => setPolicyForm({ ...policyForm, version: e.target.value })} placeholder="2026-Q4-demo" /></label>
            <label className="text-xs text-brand-muted">Base retainer · PHP<input required min="0" step="0.01" type="number" className={`${field} mt-1`} value={policyForm.baseRetainer} onChange={(e) => setPolicyForm({ ...policyForm, baseRetainer: e.target.value })} /></label>
            <label className="text-xs text-brand-muted">Workload cap · units<input required min="0" step="0.001" type="number" className={`${field} mt-1`} value={policyForm.capUnits} onChange={(e) => setPolicyForm({ ...policyForm, capUnits: e.target.value })} /></label>
            <label className="text-xs text-brand-muted">Effective from<input required type="datetime-local" className={`${field} mt-1`} value={policyForm.effectiveFrom} onChange={(e) => setPolicyForm({ ...policyForm, effectiveFrom: e.target.value })} /></label>
            <label className="text-xs text-brand-muted sm:col-span-2">Bands · units:PHP, comma separated<input required className={`${field} mt-1`} value={policyForm.bands} onChange={(e) => setPolicyForm({ ...policyForm, bands: e.target.value })} /></label>
            <Button className="sm:col-span-2" isLoading={busy === 'policy-new'}><Plus className="h-4 w-4" /> Create inactive draft</Button>
          </form>
        </Card>

        <Card className="p-6">
          <div className="mb-5 flex items-center gap-3"><Calculator className="h-5 w-5 text-brand-cyan" /><div><h2 className="font-display text-lg font-black">Open period</h2><p className="text-xs text-brand-muted">The active policy is locked to the new period.</p></div></div>
          <form onSubmit={createPeriod} className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-brand-muted sm:col-span-2">Active policy<select required className={`${field} mt-1`} value={periodForm.policyId} onChange={(e) => setPeriodForm({ ...periodForm, policyId: e.target.value })}><option value="">Select policy</option>{data?.policies.filter((p) => p.status === 'ACTIVE').map((p) => <option key={p.id} value={p.id}>{p.version}</option>)}</select></label>
            <label className="text-xs text-brand-muted">Start<input required type="datetime-local" className={`${field} mt-1`} value={periodForm.start} onChange={(e) => setPeriodForm({ ...periodForm, start: e.target.value })} /></label>
            <label className="text-xs text-brand-muted">End<input required type="datetime-local" className={`${field} mt-1`} value={periodForm.end} onChange={(e) => setPeriodForm({ ...periodForm, end: e.target.value })} /></label>
            <Button className="sm:col-span-2" isLoading={busy === 'period-new'}><Plus className="h-4 w-4" /> Open period</Button>
          </form>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-display text-lg font-black">Policy versions</h2>
        <div className="mt-4 space-y-3">{data?.policies.length ? data.policies.map((policy) => <div key={policy.id} className="flex flex-col gap-3 rounded-2xl border border-brand-border p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><strong>{policy.version}</strong><span className="rounded-full bg-brand-bgAlt px-2 py-1 text-[10px] font-bold">{policy.status}</span></div><p className="mt-1 text-xs text-brand-muted">{peso(policy.baseRetainerMinor)} base · cap {(policy.workloadUnitCapMillis / 1000).toFixed(3)} units · effective {date(policy.effectiveFrom)}</p></div>{policy.status === 'DRAFT' && <Button size="sm" variant="secondary" isLoading={busy === `activate-${policy.id}`} onClick={() => void act(`activate-${policy.id}`, () => api.post(`/admin/compensation/policies/${policy.id}/activate`), 'Policy activated.')}>Activate as checker</Button>}</div>) : <p className="text-sm text-brand-muted">No compensation policies yet.</p>}</div>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-lg font-black">Periods</h2>
        <div className="mt-4 space-y-3">{data?.periods.length ? data.periods.map((period) => <div key={period.id} className="flex flex-col gap-3 rounded-2xl border border-brand-border p-4 lg:flex-row lg:items-center lg:justify-between"><div><strong>{date(period.periodStart)} – {date(period.periodEnd)}</strong><p className="text-xs text-brand-muted">{period.policy.version} · {period.status} · {period._count.statements} statements</p></div><div className="flex flex-wrap gap-2">{period.status === 'OPEN' && <Button size="sm" variant="secondary" onClick={() => void act(`close-${period.id}`, () => api.post(`/admin/compensation/periods/${period.id}/close`), 'Period closed for calculation.')}>Close period</Button>}{period.status === 'CALCULATING' && <Button size="sm" onClick={() => void act(`calculate-${period.id}`, () => api.post(`/admin/compensation/periods/${period.id}/statements`), 'Statements calculated from locked credits.')}>Calculate statements</Button>}</div></div>) : <p className="text-sm text-brand-muted">No periods yet.</p>}</div>
      </Card>

      <Card className="p-6">
        <div className="flex items-center gap-3"><FileCheck2 className="h-5 w-5 text-brand-green" /><div><h2 className="font-display text-lg font-black">Statements</h2><p className="text-xs text-brand-muted">Preparation, review, approval, and payout preparation require distinct administrators.</p></div></div>
        <div className="mt-4 space-y-3">{data?.statements.length ? data.statements.map((statement) => <div key={statement.id} className="rounded-2xl border border-brand-border p-4"><div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between"><div><div className="flex flex-wrap items-center gap-2"><strong>{statement.nutritionistProfile.user.name}</strong><span className="rounded-full bg-brand-bgAlt px-2 py-1 text-[10px] font-bold">{statement.status}</span></div><p className="mt-1 text-xs text-brand-muted">Policy {statement.period.policy.version} · {(statement.creditedUnitsMillis / 1000).toFixed(3)} units · allowance {peso(statement.workloadAllowanceMinor)} · adjustments {peso(statement.adjustmentMinor)}</p><p className="mt-2 font-display text-lg font-black">{peso(statement.grossMinor)}</p></div><div className="flex max-w-xl flex-wrap gap-2">{statement.status === 'CALCULATED' && <><Button size="sm" variant="secondary" onClick={() => proposeAdjustment(statement)}>Propose adjustment</Button><Button size="sm" onClick={() => void act(`review-${statement.id}`, () => api.post(`/admin/compensation/statements/${statement.id}/review`), 'Statement independently reviewed.')}>Review</Button></>}{statement.status === 'REVIEWED' && <Button size="sm" onClick={() => void act(`approve-${statement.id}`, () => api.post(`/admin/compensation/statements/${statement.id}/approve`), 'Statement independently approved.')}>Approve</Button>}{statement.status === 'APPROVED' && <Button size="sm" onClick={() => void act(`payout-${statement.id}`, () => api.post(`/admin/compensation/statements/${statement.id}/payouts`, { idempotencyKey: `manual-payout:${statement.id}:${crypto.randomUUID()}` }), 'Manual payout evidence prepared for checker approval.')}>Prepare payout evidence</Button>}</div></div></div>) : <p className="text-sm text-brand-muted">No statements calculated.</p>}</div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="p-6"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-brand-cyan" /><h2 className="font-display text-lg font-black">Adjustment decisions</h2></div><div className="mt-4 space-y-3">{data?.pendingAdjustments.length ? data.pendingAdjustments.map((adjustment) => <div key={adjustment.id} className="rounded-2xl border border-brand-border p-4"><strong>{adjustment.statement.nutritionistProfile.user.name} · {peso(adjustment.amountMinor)}</strong><p className="text-xs text-brand-muted">{adjustment.reasonCode}</p><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => void act(`adjust-ok-${adjustment.id}`, () => api.post(`/admin/compensation/adjustments/${adjustment.id}/decision`, { decision: 'APPROVE' }), 'Adjustment approved.')}>Approve</Button><Button size="sm" variant="danger" onClick={() => { const reason = window.prompt('Rejection reason:'); if (reason) void act(`adjust-no-${adjustment.id}`, () => api.post(`/admin/compensation/adjustments/${adjustment.id}/decision`, { decision: 'REJECT', reason }), 'Adjustment rejected.'); }}>Reject</Button></div></div>) : <p className="text-sm text-brand-muted">No pending adjustments.</p>}</div></Card>
        <Card className="p-6"><div className="flex items-center gap-3"><WalletCards className="h-5 w-5 text-brand-green" /><h2 className="font-display text-lg font-black">Manual payout evidence</h2></div><div className="mt-4 space-y-3">{data?.payouts.length ? data.payouts.map((payout) => <div key={payout.id} className="rounded-2xl border border-brand-border p-4"><div className="flex items-center justify-between"><strong>{peso(payout.amountMinor)}</strong><span className="text-[10px] font-bold text-brand-muted">{payout.status}</span></div>{payout.externalReference && <p className="mt-1 text-xs text-brand-muted">Evidence: {payout.externalReference}</p>}<div className="mt-3">{payout.status === 'DRAFT' && <Button size="sm" onClick={() => void act(`payout-ok-${payout.id}`, () => api.post(`/admin/compensation/payouts/${payout.id}/approve`), 'Manual payout evidence approved.')}>Approve as checker</Button>}{payout.status === 'APPROVED' && <Button size="sm" onClick={() => { const ref = window.prompt('Off-platform evidence reference (no account details):'); if (ref) void act(`payout-record-${payout.id}`, () => api.post(`/admin/compensation/payouts/${payout.id}/record`, { externalReference: ref }), 'Off-platform payout evidence recorded.'); }}>Record evidence</Button>}</div></div>) : <p className="text-sm text-brand-muted">No payout records.</p>}</div></Card>
      </div>
    </div>
  );
}
