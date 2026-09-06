'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Receipt, RefreshCw } from 'lucide-react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { CompensationForms, type PeriodForm, type PolicyForm } from '@/features/compensation-admin/CompensationForms';
import { CompensationDecisionSections } from '@/features/compensation-admin/CompensationDecisionSections';
import {
  PeriodList,
  PolicyList,
  ReconciliationCards,
  StatementList,
} from '@/features/compensation-admin/CompensationLedgerSections';
import { compensationApiError, type CompensationAction, type Workspace } from '@/features/compensation-admin/model';

const initialPolicyForm: PolicyForm = {
  version: '',
  baseRetainer: '',
  capUnits: '40',
  bands: '10:1000,20:2500,40:5000',
  effectiveFrom: '',
};

export default function AdminCompensationPage() {
  const [data, setData] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [policyForm, setPolicyForm] = useState(initialPolicyForm);
  const [periodForm, setPeriodForm] = useState<PeriodForm>({ policyId: '', start: '', end: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/compensation');
      setData(response.data.data);
    } catch (error: unknown) {
      setNotice({ tone: 'error', text: compensationApiError(error, 'Could not load compensation operations.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act: CompensationAction = async (key, request, success) => {
    setBusy(key);
    setNotice(null);
    try {
      await request();
      setNotice({ tone: 'ok', text: success });
      await load();
    } catch (error: unknown) {
      setNotice({ tone: 'error', text: compensationApiError(error, 'The action could not be completed.') });
    } finally {
      setBusy(null);
    }
  };

  const createPolicy = (event: FormEvent) => {
    event.preventDefault();
    const workloadBands = policyForm.bands
      .split(',')
      .filter(Boolean)
      .map((entry) => {
        const [units, php] = entry.trim().split(':').map(Number);
        return { minimumUnitsMillis: Math.round(units * 1000), allowanceMinor: Math.round(php * 100) };
      });
    void act(
      'policy-new',
      () =>
        api.post('/admin/compensation/policies', {
          version: policyForm.version,
          currency: 'PHP',
          baseRetainerMinor: Math.round(Number(policyForm.baseRetainer) * 100),
          workloadUnitCapMillis: Math.round(Number(policyForm.capUnits) * 1000),
          workloadBands,
          effectiveFrom: new Date(policyForm.effectiveFrom).toISOString(),
        }),
      'Draft policy created. Another administrator must activate it.'
    );
  };

  const createPeriod = (event: FormEvent) => {
    event.preventDefault();
    void act(
      'period-new',
      () =>
        api.post('/admin/compensation/periods', {
          policyId: periodForm.policyId,
          periodStart: new Date(periodForm.start).toISOString(),
          periodEnd: new Date(periodForm.end).toISOString(),
        }),
      'Compensation period opened.'
    );
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-brand-muted">Loading compensation ledger…</div>
    );
  }

  return (
    <div className="portal-page space-y-7">
      <PortalPageHeader
        icon={Receipt}
        eyebrow="Administration · Compensation"
        title="Nutritionist compensation ledger"
        description="Prepare deterministic period statements, apply maker-checker controls, and record off-platform payout evidence."
        meta={
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
      />
      <div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/5 p-4 text-sm text-brand-muted">
        <strong className="text-brand-text">Separate accounting domain.</strong> Subscription revenue does not fund or
        trigger a nutritionist payout. This workspace records manual evidence only and stores no bank or e-wallet
        details.
      </div>
      {notice && (
        <div
          role="status"
          className={`rounded-2xl border p-4 text-sm ${notice.tone === 'ok' ? 'border-brand-green/30 bg-brand-green/10 text-brand-green' : 'border-red-400/30 bg-red-500/10 text-red-300'}`}
        >
          {notice.text}
        </div>
      )}
      {data && (
        <>
          <ReconciliationCards reconciliation={data.reconciliation} />
          <CompensationForms
            activePolicies={data.policies.filter((policy) => policy.status === 'ACTIVE')}
            busy={busy}
            onPeriodChange={setPeriodForm}
            onPeriodSubmit={createPeriod}
            onPolicyChange={setPolicyForm}
            onPolicySubmit={createPolicy}
            periodForm={periodForm}
            policyForm={policyForm}
          />
          <PolicyList policies={data.policies} busy={busy} act={act} />
          <PeriodList periods={data.periods} act={act} />
          <StatementList statements={data.statements} act={act} />
          <CompensationDecisionSections data={data} act={act} />
        </>
      )}
    </div>
  );
}
