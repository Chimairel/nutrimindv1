'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, DatabaseZap, FileInput, LayoutDashboard, RefreshCw, ShieldCheck, Waypoints } from 'lucide-react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import DataForms from '@/features/admin-data/DataForms';
import DataWorkspaceOverview from '@/features/admin-data/DataWorkspaceOverview';
import FoodCatalogue from '@/features/admin-data/FoodCatalogue';
import ReleaseOperations from '@/features/admin-data/ReleaseOperations';
import type { AdminDataSection, ApiEnvelope, DataWorkspace, FoodPage } from '@/features/admin-data/types';
import { getApiError } from '@/features/admin-data/types';

export default function AdminDataPage() {
  const [workspace, setWorkspace] = useState<DataWorkspace | null>(null);
  const [foods, setFoods] = useState<FoodPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<AdminDataSection>('overview');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [workspaceResponse, foodsResponse] = await Promise.all([
        api.get<ApiEnvelope<DataWorkspace>>('/admin/data'),
        api.get<ApiEnvelope<FoodPage>>('/admin/data/foods', { params: { page: 1, limit: 12 } }),
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

      <Tabs value={section} onValueChange={(value) => setSection(value as AdminDataSection)}>
        <TabsList
          aria-label="Nutrition data workspace"
          className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <TabsTrigger value="overview" className="min-w-fit flex-1 gap-2">
            <LayoutDashboard className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="sources" className="min-w-fit flex-1 gap-2">
            <Waypoints className="h-4 w-4" /> Sources & releases
          </TabsTrigger>
          <TabsTrigger value="imports" className="min-w-fit flex-1 gap-2">
            <FileInput className="h-4 w-4" /> Import & publish
          </TabsTrigger>
          <TabsTrigger value="catalogue" className="min-w-fit flex-1 gap-2">
            <BookOpen className="h-4 w-4" /> FNRI catalogue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <DataWorkspaceOverview
            summary={workspace.summary}
            releaseCount={workspace.releases.length}
            releases={workspace.releases}
            onNavigate={setSection}
          />
        </TabsContent>
        <TabsContent value="sources">
          <DataForms sources={workspace.sources} onChanged={changed} onError={failed} />
        </TabsContent>
        <TabsContent value="imports">
          <ReleaseOperations
            releases={workspace.releases}
            csvTemplate={workspace.consumptionCsvTemplate}
            onChanged={changed}
            onError={failed}
          />
        </TabsContent>
        <TabsContent value="catalogue">
          <FoodCatalogue
            initialFoods={foods}
            canonicalFoodCount={workspace.summary.foodItems}
            onChanged={changed}
            onError={failed}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
