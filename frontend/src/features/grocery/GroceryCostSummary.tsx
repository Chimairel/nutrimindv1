'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/axios';
type Estimate = {
  amountMinCentavos: number | null;
  amountMaxCentavos: number | null;
  knownItemCount: number;
  totalItemCount: number;
  explanation: string;
  missingPrices: Array<{ ingredientId: string; ingredientName: string }>;
  evidence: Array<{ ingredientId: string; sourceUrl: string; observedTo: string; locality: string }>;
};
export default function GroceryCostSummary({ revision }: { revision: string }) {
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setEstimate(null);
    setFailed(false);
    api
      .get('/user/grocery/cost')
      .then((response) => {
        if (active) setEstimate(response.data.data);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  return (
    <details className="rounded-2xl border border-brand-border bg-brand-surface p-4 text-sm">
      <summary className="cursor-pointer font-semibold">
        Shopping cost estimate{' '}
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
