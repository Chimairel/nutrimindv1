'use client';

import Button from '@/components/ui/Button';
import { useMembership } from './MembershipProvider';

/** The API remains authoritative; loading membership never silently permits a request. */
export default function OutsideReviewRequestButton({
  onRequest,
  busy,
  inverse = false,
}: {
  onRequest: () => void;
  busy: boolean;
  inverse?: boolean;
}) {
  const { data, isLoading, error, refresh } = useMembership();
  const allowance = data?.enabled ? data.usage.OUTSIDE_REVIEW : null;
  const eligible = !!data && (!data.enabled || (data.enhanced && data.healthAccess === true));
  const available = eligible && (!allowance || allowance.remaining > 0);
  const reset = data?.enabled
    ? new Date(data.resetsAt).toLocaleDateString('en-PH', {
        timeZone: 'Asia/Manila',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="secondary"
        onClick={onRequest}
        disabled={busy || isLoading || !!error || !available}
      >
        Ask RND to review
      </Button>
      <p aria-live="polite" className={`text-xs leading-relaxed ${inverse ? 'text-white/90' : 'text-brand-muted'}`}>
        {isLoading || (!data && !error)
          ? 'Checking your review allowance…'
          : error
            ? 'Review allowance could not be loaded. You can still save the estimate.'
            : !eligible
              ? 'RND estimate reviews are included with the Health Plan.'
              : allowance
                ? `${allowance.remaining} of ${allowance.cap} meal reviews left. Resets ${reset} (Philippine time).`
                : 'One request covers all food items in this logged meal.'}
      </p>
      {error && (
        <Button type="button" variant="secondary" size="sm" onClick={refresh} disabled={busy}>
          Retry allowance
        </Button>
      )}
    </div>
  );
}
