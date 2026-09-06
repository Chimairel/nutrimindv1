'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Stethoscope } from 'lucide-react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { NutritionistApplicationCard } from '@/features/admin-nutritionists/NutritionistApplicationCard';
import { ProfessionalGrid } from '@/features/admin-nutritionists/ProfessionalGrid';
import type {
  ApplicationActionResponse,
  NutritionistApplication,
  NutritionistRow,
  ScheduleDraft,
} from '@/features/admin-nutritionists/model';

export default function AdminNutritionistsPage() {
  const [applications, setApplications] = useState<NutritionistApplication[]>([]);
  const [nutritionists, setNutritionists] = useState<NutritionistRow[]>([]);
  const [tab, setTab] = useState<'applications' | 'professionals'>('applications');
  const [isLoading, setIsLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, ScheduleDraft>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  const fetchData = useCallback(async () => {
    try {
      const [applicationResponse, nutritionistResponse] = await Promise.all([
        api.get('/admin/nutritionist-applications'),
        api.get('/admin/nutritionists'),
      ]);
      setApplications(applicationResponse.data?.data || []);
      setNutritionists(nutritionistResponse.data?.data || []);
    } catch (caught) {
      setError(getAdminApplicationError(caught, 'Professional records could not be loaded.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const act = async (
    id: string,
    request: () => Promise<ApplicationActionResponse>,
    successMessage: string | ((result: ApplicationActionResponse) => string)
  ) => {
    setWorkingId(id);
    setError(null);
    setNotice(null);
    try {
      const result = await request();
      setNotice(typeof successMessage === 'function' ? successMessage(result) : successMessage);
      await fetchData();
    } catch (caught) {
      setError(getAdminApplicationError(caught, 'The application could not be updated.'));
    } finally {
      setWorkingId(null);
    }
  };

  const activeApplications = useMemo(
    () => applications.filter((item) => !['REJECTED', 'ACTIVATED'].includes(item.status)),
    [applications]
  );
  const completedApplications = useMemo(
    () => applications.filter((item) => ['REJECTED', 'ACTIVATED'].includes(item.status)),
    [applications]
  );
  const verified = nutritionists.filter((item) => item.isVerified);

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="animate-pulse text-brand-muted">Loading professional governance records...</span>
      </div>
    );
  }

  const applicationCards = (items: NutritionistApplication[]) =>
    items.map((application) => (
      <NutritionistApplicationCard
        key={application.id}
        application={application}
        onAction={act}
        onRejectionReasonChange={(id, value) => setRejectionReasons((current) => ({ ...current, [id]: value }))}
        onScheduleChange={(id, draft) => setScheduleDrafts((current) => ({ ...current, [id]: draft }))}
        rejectionReason={rejectionReasons[application.id] || ''}
        scheduleDraft={scheduleDrafts[application.id]}
        workingId={workingId}
      />
    ));

  return (
    <div className="portal-page space-y-7">
      <PortalPageHeader
        icon={Stethoscope}
        eyebrow="Professional governance"
        title="Nutritionist onboarding"
        description="Review applications, conduct required verification calls, and control professional access."
        meta={
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-white/50">
            {activeApplications.length} active · {verified.length} professionals
          </span>
        }
      />
      <PageMessages error={error} notice={notice} />
      <TabSelector tab={tab} applicationCount={applications.length} verifiedCount={verified.length} onChange={setTab} />
      {tab === 'applications' ? (
        <>
          <ApplicationSection
            label="Active pipeline"
            items={activeApplications}
            cards={applicationCards(activeApplications)}
          />
          {completedApplications.length > 0 && (
            <ApplicationSection
              label="Completed applications"
              items={completedApplications}
              cards={applicationCards(completedApplications)}
            />
          )}
        </>
      ) : (
        <section>
          <ProfessionalGrid nutritionists={verified} />
        </section>
      )}
    </div>
  );
}

function PageMessages({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text"
        >
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border border-brand-green/20 bg-brand-green/[0.07] p-4 text-sm font-semibold text-brand-green">
          {notice}
        </div>
      )}
    </>
  );
}

function TabSelector({
  tab,
  applicationCount,
  verifiedCount,
  onChange,
}: {
  tab: 'applications' | 'professionals';
  applicationCount: number;
  verifiedCount: number;
  onChange: (tab: 'applications' | 'professionals') => void;
}) {
  return (
    <div className="flex rounded-2xl border border-brand-border bg-brand-surface/60 p-1">
      {(['applications', 'professionals'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold ${tab === option ? 'bg-brand-accent text-[#07100d]' : 'text-brand-muted'}`}
        >
          {option === 'applications' ? `Applications (${applicationCount})` : `Active professionals (${verifiedCount})`}
        </button>
      ))}
    </div>
  );
}

function ApplicationSection({
  label,
  items,
  cards,
}: {
  label: string;
  items: NutritionistApplication[];
  cards: React.ReactNode[];
}) {
  return (
    <section>
      <p className="portal-section-label mb-4">
        {label} · {items.length}
      </p>
      {items.length ? (
        <div className="grid gap-5 xl:grid-cols-2">{cards}</div>
      ) : (
        <Card className="p-10 text-center text-sm text-brand-muted">No active applications.</Card>
      )}
    </section>
  );
}

function getAdminApplicationError(caught: unknown, fallback: string) {
  return axios.isAxiosError(caught) ? caught.response?.data?.error || fallback : fallback;
}
