'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Crown } from 'lucide-react';
import api from '@/lib/axios';
import Badge from '@/components/ui/Badge';

type Estimate = {
  amountMinCentavos: number | null;
  amountMaxCentavos: number | null;
  knownItemCount: number;
  totalItemCount: number;
  explanation: string;
  availabilityReason?: string;
  missingPrices: Array<{ ingredientId: string; ingredientName: string }>;
  evidence: Array<{ ingredientId: string; sourceUrl: string; observedTo: string; locality: string }>;
};

export default function GroceryCostSummary({ revision }: { revision: string }) {
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [failed, setFailed] = useState(false);
  const [isPremiumRequired, setIsPremiumRequired] = useState(false);

  useEffect(() => {
    let active = true;
    setEstimate(null);
    setFailed(false);
    setIsPremiumRequired(false);

    api
      .get('/user/grocery/cost')
      .then((response) => {
        if (active) setEstimate(response.data.data);
      })
      .catch((err) => {
        if (active) {
          if (err?.response?.data?.code === 'PREMIUM_REQUIRED') {
            setIsPremiumRequired(true);
          } else {
            setFailed(true);
          }
        }
      });

    return () => {
      active = false;
    };
  }, [revision]);

  if (isPremiumRequired) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-brand-accent/40 bg-gradient-to-r from-brand-accent/10 via-brand-surface to-brand-surface p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-brand-accent/20 p-2.5 text-brand-green shrink-0">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-display font-extrabold text-sm text-brand-text">
                  Shopping Cost & Budget Estimates
                </h4>
                <Badge variant="pending">Premium</Badge>
              </div>
              <p className="mt-1 text-xs text-brand-muted max-w-xl leading-relaxed">
                Access available published Philippine market reference prices, subtotal estimates for covered
                ingredients, and official commodity price evidence.
              </p>
            </div>
          </div>
          <Link
            href="/profile/membership"
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-accent px-4 py-2 text-xs font-bold text-brand-black shadow-neon transition hover:opacity-95"
          >
            Upgrade to Premium <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <details className="rounded-2xl border border-brand-border bg-brand-surface p-4 text-sm">
      <summary className="cursor-pointer font-semibold">
        Shopping cost estimate{' '}
        {estimate?.availabilityReason === 'PRICE_DATA_NOT_CONFIGURED' ? '· Price data not configured' : ''}
        {estimate?.amountMinCentavos !== null && estimate
          ? '· ₱' +
            (estimate.amountMinCentavos / 100).toFixed(2) +
            '–₱' +
            ((estimate.amountMaxCentavos ?? 0) / 100).toFixed(2) +
            ' covered subtotal'
          : ''}
      </summary>
      {!estimate ? (
        <p className="mt-2">
          {failed ? 'Price estimates are currently unavailable.' : 'Checking available price evidence…'}
        </p>
      ) : (
        <>
          <p className="mt-2">
            {estimate.knownItemCount} of {estimate.totalItemCount} remaining ingredients have usable prices. Missing
            prices are excluded from the subtotal.
          </p>
          <p className="mt-2 text-brand-muted">{estimate.explanation}</p>
          {estimate.missingPrices.length > 0 && (
            <p className="mt-2">
              Price needed: {estimate.missingPrices.map((item) => item.ingredientName).join(', ')}.
            </p>
          )}
          {estimate.evidence.map((item) => (
            <p key={item.ingredientId} className="mt-1 text-xs">
              <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="underline">
                Price source
              </a>{' '}
              · {item.locality} · observed {item.observedTo.slice(0, 10)}
            </p>
          ))}
        </>
      )}
    </details>
  );
}
