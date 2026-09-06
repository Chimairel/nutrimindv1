'use client';

import Link from 'next/link';
import { ArrowLeft, ShieldCheck, XCircle } from 'lucide-react';
import Card from '@/components/ui/Card';

export default function BillingCancelPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-2xl items-center px-5 py-10">
      <Card className="w-full p-8 text-center sm:p-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-bgAlt text-brand-muted">
          <XCircle className="h-8 w-8" />
        </span>
        <p className="mt-6 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand-muted">
          Checkout return
        </p>
        <h1 className="mt-3 font-display text-3xl font-extrabold">Checkout closed</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-brand-muted">
          This return page made no billing or access change. You can return to the Premium page and safely reopen the
          same checkout attempt when it is available.
        </p>
        <Link
          href="/billing"
          className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-brand-border/80 bg-brand-surface px-5 py-2.5 font-display text-sm font-extrabold text-brand-text shadow-sm outline-none hover:border-brand-green/40 focus:ring-2 focus:ring-brand-green/60"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Premium access
        </Link>
        <div className="mt-7 flex items-start gap-3 rounded-2xl bg-brand-bgAlt p-4 text-left text-xs text-brand-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-green" />
          <p>
            Closing or returning from PayMongo does not cancel, confirm, or create a NutriMind payment record by itself.
          </p>
        </div>
      </Card>
    </div>
  );
}
