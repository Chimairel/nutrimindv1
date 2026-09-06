'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock3, Crown, RefreshCw, ShieldCheck } from 'lucide-react';
import { useBillingAccess } from '@/hooks/useBillingAccess';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

const MAX_POLLS = 10;
const POLL_INTERVAL_MS = 2_000;

const formatExpiry = (value: string) =>
  new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value));

export default function BillingSuccessPage() {
  const { data, isLoading, error, refresh } = useBillingAccess();
  const [polls, setPolls] = useState(0);
  const polling = useRef(false);

  useEffect(() => {
    if (!data || data.current.tier === 'PREMIUM' || polls >= MAX_POLLS || polling.current) return;
    const timer = window.setTimeout(async () => {
      polling.current = true;
      await refresh();
      polling.current = false;
      setPolls((value) => value + 1);
    }, POLL_INTERVAL_MS);
    return () => window.clearTimeout(timer);
  }, [data, polls, refresh]);

  if (isLoading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" aria-label="Checking payment verification">
        <LoadingSpinner />
      </div>
    );
  }

  const active = data?.current.tier === 'PREMIUM';
  const needsReview = data?.current.verification === 'RECONCILIATION_REQUIRED';
  const timedOut = !active && polls >= MAX_POLLS;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-5 py-10">
      <Card className="w-full p-8 text-center sm:p-10">
        <span
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-3xl ${active ? 'bg-brand-accent text-[#07100d]' : 'bg-status-pending-bg text-status-pending-text'}`}
        >
          {active ? <CheckCircle2 className="h-8 w-8" /> : <Clock3 className="h-8 w-8" />}
        </span>
        <p className="mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand-green">
          Checkout return
        </p>
        <h1 className="mt-3 font-display text-3xl font-extrabold">
          {active ? 'Premium access is active' : 'Payment received — verification pending'}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-brand-muted" role="status" aria-live="polite">
          {active && data?.current.access
            ? `Your one-time access is verified through ${formatExpiry(data.current.access.expiresAt)}. It will not renew automatically.`
            : needsReview
              ? 'NutriMind could not finish automatic verification. Your access still follows the latest verified server record.'
              : timedOut
                ? 'Verification is taking longer than expected. No access was granted from this return page; you can check status again safely.'
                : 'NutriMind is checking verified server records. This browser return cannot grant Premium.'}
        </p>
        {error && (
          <p className="mt-4 text-sm text-status-error-text" role="alert">
            {error}
          </p>
        )}
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          {!active && (
            <Button variant="secondary" onClick={() => void refresh()}>
              <RefreshCw className="h-4 w-4" />
              Check status
            </Button>
          )}
          <Link
            href="/billing"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-brand-accent/70 bg-brand-accent px-5 py-2.5 font-display text-sm font-extrabold text-brand-black shadow-neon outline-none focus:ring-2 focus:ring-brand-green/60"
          >
            <Crown className="h-4 w-4" />
            View access
          </Link>
        </div>
        <div className="mt-7 flex items-start gap-3 rounded-2xl bg-brand-bgAlt p-4 text-left text-xs text-brand-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
          <p>URL parameters and redirects are ignored for entitlement decisions.</p>
        </div>
      </Card>
    </div>
  );
}
