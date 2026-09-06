'use client';

import { useRef, useState } from 'react';
import axios from 'axios';
import { ArrowRight, CalendarClock, Check, Crown, RefreshCw, Repeat2, ShieldCheck, Sparkles } from 'lucide-react';
import api from '@/lib/axios';
import {
  clearPremiumCheckoutAttemptKey,
  getOrCreatePremiumCheckoutAttemptKey,
  validateHostedCheckoutUrl,
} from '@/lib/billing-checkout';
import { useBillingAccess } from '@/hooks/useBillingAccess';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import PortalPageHeader from '@/components/shared/PortalPageHeader';

const formatDateTime = (value: string) => new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', dateStyle: 'long', timeStyle: 'short',
}).format(new Date(value));

const formatMoney = (amountMinor: number) => new Intl.NumberFormat('en-PH', {
  style: 'currency', currency: 'PHP', minimumFractionDigits: 2,
}).format(amountMinor / 100);

export default function BillingPage() {
  const { data, isLoading, error, refresh } = useBillingAccess();
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const submitting = useRef(false);

  const startCheckout = async () => {
    if (!data?.checkout.available || submitting.current) return;
    submitting.current = true;
    setIsStartingCheckout(true);
    setCheckoutError(null);
    try {
      const response = await api.post('/billing/subscriptions', { priceCode: 'PREMIUM' }, {
        headers: { 'Idempotency-Key': getOrCreatePremiumCheckoutAttemptKey() },
      });
      const checkoutUrl = validateHostedCheckoutUrl(response.data?.data?.checkoutUrl);
      window.location.assign(checkoutUrl);
    } catch (caught: unknown) {
      const code = axios.isAxiosError(caught) ? caught.response?.data?.errorCode : null;
      if (code === 'CHECKOUT_PROVIDER_REJECTED' || code === 'CHECKOUT_REQUEST_INVALID') {
        clearPremiumCheckoutAttemptKey();
      }
      setCheckoutError(code === 'PAYMENTS_UNAVAILABLE'
        ? 'Sandbox checkout is currently disabled.'
        : code === 'CHECKOUT_IN_PROGRESS'
          ? 'This checkout attempt is still being prepared. Please try again in a moment.'
          : 'Sandbox checkout could not be opened. No access change was made. You can safely try again.');
      submitting.current = false;
      setIsStartingCheckout(false);
    }
  };

  if (isLoading) {
    return <div className="flex min-h-[60vh] items-center justify-center" aria-label="Loading billing access"><LoadingSpinner /></div>;
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg items-center px-5">
        <Card className="w-full p-7 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-brand-green" />
          <h1 className="mt-4 font-display text-2xl font-extrabold">Billing status unavailable</h1>
          <p className="mt-2 text-sm text-brand-muted" role="alert">{error || 'Your billing status could not be loaded.'}</p>
          <Button className="mt-6" variant="secondary" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" />Try again</Button>
        </Card>
      </div>
    );
  }

  const premium = data.catalogue.find((plan) => plan.tier === 'PREMIUM');
  const active = data.current.tier === 'PREMIUM';
  const verificationCopy = data.current.verification === 'RECONCILIATION_REQUIRED'
    ? 'Payment verification needs review. Your current access remains based on verified server records.'
    : data.current.verification !== 'NONE'
      ? 'Payment verification is pending. This page will show Premium only after server confirmation.'
      : null;
  const checkoutUnavailable = data.checkout.reason === 'ACTIVE_ACCESS'
    ? 'Premium access is already active.'
    : data.checkout.reason === 'PAYMENT_PENDING'
      ? 'A payment attempt is awaiting verification.'
      : data.checkout.reason === 'PRICE_UNAVAILABLE'
        ? 'The sandbox demo price is unavailable.'
        : data.checkout.reason === 'DISABLED'
          ? 'Sandbox checkout is currently disabled.'
          : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 sm:px-7 md:py-8">
      <PortalPageHeader
        icon={Crown}
        eyebrow="Premium access"
        title={<>More choice in your <span className="text-brand-green">weekly plan</span></>}
        description="Compare the exact meal-swap allowance available to your account. Nutrition safety, grocery tools, exports, and privacy controls stay available on Free."
        meta={<Badge variant={active ? 'verified' : 'user'}>{active ? 'Premium active' : 'Free plan'}</Badge>}
      />

      <section className="mt-7 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]" aria-labelledby="current-access-title">
        <Card className="relative overflow-hidden border-brand-green/25 bg-[linear-gradient(135deg,rgba(82,183,136,0.13),rgba(255,255,255,0.88))] p-7 dark:bg-[linear-gradient(135deg,rgba(82,183,136,0.14),rgba(15,25,20,0.92))]">
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-brand-accent/20 blur-3xl" />
          <div className="relative">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand-green">Current access</p>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="current-access-title" className="font-display text-4xl font-extrabold tracking-tight">{data.current.tier === 'PREMIUM' ? 'Premium' : 'Free'}</h2>
                <p className="mt-2 max-w-xl text-sm text-brand-muted">
                  {active && data.current.access
                    ? `One-time Premium access. It ends ${formatDateTime(data.current.access.expiresAt)} and does not renew automatically.`
                    : 'Free includes three meal swaps for each weekly plan.'}
                </p>
              </div>
              <div className="rounded-2xl border border-brand-border/70 bg-brand-surface/80 px-5 py-4 text-right shadow-sm">
                <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-brand-muted">Swaps remaining</p>
                <p className="mt-1 font-display text-3xl font-extrabold text-brand-green">{data.current.swaps.remaining}<span className="text-base text-brand-muted">/{data.current.swaps.cap}</span></p>
              </div>
            </div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-brand-border/60" aria-label={`${data.current.swaps.used} of ${data.current.swaps.cap} swaps used`}>
              <div className="h-full rounded-full bg-brand-green transition-all" style={{ width: `${Math.min(100, (data.current.swaps.used / data.current.swaps.cap) * 100)}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-brand-muted">
              <span>{data.current.swaps.used} used in this weekly plan</span>
              {data.current.swaps.cycleEndsAtExclusive && <span>Cycle resets {formatDateTime(data.current.swaps.cycleEndsAtExclusive)}</span>}
            </div>
          </div>
        </Card>

        <Card className="p-7">
          <div className="flex items-center gap-3"><CalendarClock className="h-5 w-5 text-brand-green" /><h2 className="font-display text-lg font-extrabold">Access details</h2></div>
          <dl className="mt-5 space-y-4 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-brand-muted">Status</dt><dd className="font-semibold">{active ? 'Non-renewing' : 'Free'}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-brand-muted">Automatic renewal</dt><dd className="font-semibold">No</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-brand-muted">Payment mode</dt><dd className="font-semibold">TEST sandbox</dd></div>
            {data.current.access && <div className="border-t border-brand-border/60 pt-4"><dt className="text-brand-muted">Exact expiry</dt><dd className="mt-1 font-semibold">{formatDateTime(data.current.access.expiresAt)}</dd></div>}
          </dl>
        </Card>
      </section>

      {verificationCopy && (
        <div className="mt-5 rounded-2xl border border-status-pending-text/20 bg-status-pending-bg px-5 py-4 text-sm text-status-pending-text" role="status" aria-live="polite">
          {verificationCopy}
        </div>
      )}

      <section className="mt-8" aria-labelledby="compare-title">
        <div className="flex items-end justify-between gap-4">
          <div><p className="portal-kicker">Plan comparison</p><h2 id="compare-title" className="mt-2 font-display text-2xl font-extrabold">One clear difference</h2></div>
          <span className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-brand-muted sm:block">No safety features are paywalled</span>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Card className="p-7">
            <div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-widest text-brand-muted">Always available</p><h3 className="mt-2 font-display text-3xl font-extrabold">Free</h3></div><Repeat2 className="h-7 w-7 text-brand-muted" /></div>
            <p className="mt-8 font-display text-5xl font-extrabold">₱0</p>
            <div className="mt-7 flex items-center gap-3 rounded-2xl bg-brand-bgAlt p-4"><Check className="h-5 w-5 text-brand-green" /><span className="font-semibold">3 meal swaps per weekly plan</span></div>
          </Card>
          <Card className="relative border-brand-accent/50 p-7 shadow-neon">
            <div className="absolute right-5 top-5"><Badge variant="pending">TEST demo</Badge></div>
            <div><p className="font-mono text-[10px] uppercase tracking-widest text-brand-green">One-time access</p><h3 className="mt-2 font-display text-3xl font-extrabold">Premium</h3></div>
            <p className="mt-8 font-display text-5xl font-extrabold">{premium?.price ? formatMoney(premium.price.amountMinor) : 'Unavailable'}</p>
            <p className="mt-2 text-xs text-brand-muted">Sandbox demo price for 30 days. No automatic renewal.</p>
            <div className="mt-7 flex items-center gap-3 rounded-2xl bg-brand-accent/15 p-4"><Sparkles className="h-5 w-5 text-brand-green" /><span className="font-semibold">6 meal swaps per weekly plan</span></div>
            <Button className="mt-6 w-full" size="lg" disabled={!data.checkout.available} isLoading={isStartingCheckout} onClick={() => void startCheckout()}>
              Open TEST checkout <ArrowRight className="h-4 w-4" />
            </Button>
            {checkoutUnavailable && <p className="mt-3 text-center text-xs text-brand-muted">{checkoutUnavailable}</p>}
            {checkoutError && <p className="mt-3 text-center text-sm text-status-error-text" role="alert" aria-live="assertive">{checkoutError}</p>}
          </Card>
        </div>
      </section>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-brand-border/70 bg-brand-surface/70 p-5 text-sm text-brand-muted">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" />
        <p>Checkout returns never activate Premium by themselves. Access appears only after NutriMind verifies the payment on the server.</p>
      </div>
    </div>
  );
}
