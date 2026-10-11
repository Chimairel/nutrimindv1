'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RefreshCw, ScrollText } from 'lucide-react';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import AuditHistoryList, { type AuditRow } from '@/components/shared/AuditHistoryList';
import WorkspaceTabs from '@/components/ui/WorkspaceTabs';
import Dropdown from '@/components/ui/Dropdown';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import GovernanceQueuePanel from '../reviews/GovernanceQueuePanel';
import { formatBadgeCount } from '@/lib/badge-count';
import { useReviewWorkCounts } from '@/features/nutritionist-reviews/useReviewWorkCounts';

type History = { rows: (AuditRow & { nutritionist?: string })[]; page: number; total: number; totalPages: number };

export default function NutritionistAuditPage() {
  const ownerId = useAuth().user?.userId;
  const [view, setView] = useState<'history' | 'rechecks'>('history');
  const [page, setPage] = useState(1);
  const [mine, setMine] = useState(false);
  const counts = useReviewWorkCounts();
  const history = useSessionQuery<History>({
    ownerId,
    resource: `nutritionist-audit:${page}:${mine}`,
    enabled: view === 'history',
    errorMessage: 'Audit history could not be loaded. Please try again.',
    fetcher: async () => {
      const response = await api.get('/nutritionist/audit-history', {
        params: { page, limit: 20, ...(mine ? { mine: 'true' } : {}) },
      });
      if (!response.data?.success) throw new Error('Audit history could not be loaded. Please try again.');
      return response.data.data;
    },
  });
  return (
    <div className="portal-page space-y-5 pb-20 text-brand-text">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <PortalPageHeader
          icon={ScrollText}
          eyebrow="Clinical workspace"
          title="Audit"
          description="Review decisions and recorded details."
          meta={
            <Link
              href="/nutritionist/approved"
              className="inline-flex min-h-11 items-center text-xs font-bold text-brand-green underline"
            >
              Reviewed plans
            </Link>
          }
        />
        <WorkspaceTabs
          value={view}
          label="Audit views"
          onChange={setView}
          items={[
            { value: 'history', label: 'Activity history' },
            {
              value: 'rechecks',
              label: 'Flagged approvals',
              count: counts?.audit ? formatBadgeCount(counts.audit) : undefined,
            },
          ]}
        />
        {view === 'rechecks' ? (
          <GovernanceQueuePanel tab="audit" />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-brand-border/70 bg-brand-surface shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border/70 p-4">
              <h2 className="font-display font-bold">Activity history</h2>
              <div className="flex items-center gap-2">
                <Dropdown
                  aria-label="Staff filter"
                  value={mine ? 'me' : 'all'}
                  className="!w-36"
                  onChange={(value) => {
                    setMine(value === 'me');
                    setPage(1);
                  }}
                >
                  <option value="all">All staff</option>
                  <option value="me">Me</option>
                </Dropdown>
                <Button
                  variant="secondary"
                  className="!px-3"
                  onClick={() => void history.refetch()}
                  aria-label="Refresh history"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {history.error && (
              <p role="alert" className="p-4 text-sm text-status-error-text">
                {history.error}
              </p>
            )}
            {history.isLoading && !history.data && (
              <p role="status" className="p-6 text-sm text-brand-muted">
                Loading activity...
              </p>
            )}
            {history.data && (
              <>
                <AuditHistoryList
                  key={`${ownerId}:${page}:${mine}`}
                  ownerId={ownerId}
                  endpoint="/nutritionist/audit-history"
                  rows={history.data.rows.map((row) => ({
                    ...row,
                    actor: row.actor ?? row.nutritionist ?? 'Actor not recorded',
                  }))}
                />
                <div className="border-t border-brand-border/70 p-4 text-xs text-brand-muted">
                  <p>{history.data.total} records</p>
                  <Pagination
                    page={history.data.page}
                    pageCount={history.data.totalPages}
                    onPageChange={setPage}
                    label="Audit pages"
                  />
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
