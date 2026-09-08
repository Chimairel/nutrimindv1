'use client';

import { useCallback, useEffect, useState } from 'react';
import { DatabaseZap, RefreshCw, ShieldCheck } from 'lucide-react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import DataForms from '@/features/admin-data/DataForms';
import DataSummary from '@/features/admin-data/DataSummary';
import FoodCatalogue from '@/features/admin-data/FoodCatalogue';
import ReleaseOperations from '@/features/admin-data/ReleaseOperations';
import type { ApiEnvelope, DataWorkspace, FoodPage } from '@/features/admin-data/types';
import { getApiError } from '@/features/admin-data/types';

export default function AdminDataPage() {
  const [workspace, setWorkspace] = useState<DataWorkspace | null>(null);
  const [foods, setFoods] = useState<FoodPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [workspaceResponse, foodsResponse] = await Promise.all([
        api.get<ApiEnvelope<DataWorkspace>>('/admin/data'),
        api.get<ApiEnvelope<FoodPage>>('/admin/data/foods', { params: { page: 1, limit: 25 } }),
      ]);
      setWorkspace(workspaceResponse.data.data);
      setFoods(foodsResponse.data.data);
    } catch (error) {
      setNotice({ tone: 'error', message: getApiError(error, 'Could not load the data administration workspace.') });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changed(message: string) {
    setNotice({ tone: 'success', message });
    await load(true);
  }

  function failed(message: string) {
    setNotice({ tone: 'error', message });
  }

  if (loading && (!workspace || !foods)) return <PortalLoadingState message="Loading governed nutrition data..." />;
  if (!workspace || !foods) {
    return (
      <div className="portal-page">
        <p className="rounded-2xl bg-red-500/10 p-5 text-sm text-status-error-text">
          {notice?.message || 'Data workspace unavailable.'}
        </p>
        <Button className="mt-4" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="portal-page space-y-7">
      <PortalPageHeader
        icon={DatabaseZap}
        eyebrow="Data governance"
        title="Nutrition data center"
        description="Version official datasets, reconcile them with FNRI records, and publish traceable releases without changing application code."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void load(true)}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        }
        meta={
          <div className="flex items-center gap-2 rounded-full border border-brand-green/20 bg-brand-green/10 px-3 py-2 text-brand-green">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]">Admin governed · audited</span>
          </div>
        }
      />

      {notice && (
        <div
          role={notice.tone === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-sm font-semibold ${notice.tone === 'error' ? 'border-red-500/25 bg-red-500/10 text-status-error-text' : 'border-brand-green/25 bg-brand-green/10 text-brand-green'}`}
        >
          <span>{notice.message}</span>
          <button type="button" className="text-xs opacity-70 hover:opacity-100" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}

      <DataSummary summary={workspace.summary} />
      <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-800 dark:text-amber-200">
        <p className="font-bold">Separation of responsibilities</p>
        <p className="mt-1 leading-relaxed">
          Admins govern source provenance, releases, aggregate survey data, and FNRI aliases. Nutritionists remain the
          only role that can clinically approve meals. Raw FNRI nutrient values are intentionally read-only here.
        </p>
      </div>
      <DataForms sources={workspace.sources} onChanged={changed} onError={failed} />
      <ReleaseOperations
        releases={workspace.releases}
        csvTemplate={workspace.consumptionCsvTemplate}
        onChanged={changed}
        onError={failed}
      />
      <FoodCatalogue initialFoods={foods} onChanged={changed} onError={failed} />
    </div>
  );
}
