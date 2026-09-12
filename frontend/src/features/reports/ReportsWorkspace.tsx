'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import api from '@/lib/axios';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import ReportHistory, { type ReportVersion } from './ReportHistory';
export default function ReportsWorkspace() {
  const [history, setHistory] = useState<ReportVersion[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    api
      .get('/user/nutrition-report/history')
      .then((r) => {
        if (active) {
          setHistory(r.data.data);
          setState('ready');
        }
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="portal-page max-w-5xl space-y-4">
      <Link href="/progress" className="text-sm font-semibold text-brand-green">
        ← Progress
      </Link>
      <PortalPageHeader
        icon={ClipboardList}
        eyebrow="Your records"
        title="Reports & history"
        description="Guidance saved with the information you provided at the time."
      />
      <div className="flex flex-wrap gap-3">
        <Link
          href="/nutrition-report"
          className="rounded-xl bg-brand-accent px-4 py-3 text-sm font-bold text-[#07100d]"
        >
          Open current guidance
        </Link>
        <Link
          href="/export"
          className="rounded-xl border border-brand-border bg-brand-surface px-4 py-3 text-sm font-semibold"
        >
          Download nutrition summary
        </Link>
      </div>
      {state === 'loading' ? (
        <p role="status">Loading saved reports…</p>
      ) : state === 'error' ? (
        <p role="alert">Reports could not be loaded. Refresh to try again.</p>
      ) : (
        <ReportHistory history={history} />
      )}
    </div>
  );
}
