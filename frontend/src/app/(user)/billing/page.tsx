'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarClock, Check, Crown, RefreshCw, Repeat2, ShieldCheck, Sparkles } from 'lucide-react';
import api from '@/lib/axios';
import {
  clearPremiumCheckoutAttemptKey,
  getOrCreatePremiumCheckoutAttemptKey,
  validateHostedCheckoutUrl,
} from '@/lib/billing-checkout';
import { useBillingAccess } from '@/hooks/useBillingAccess';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { getApiErrorCode } from '@/lib/api-error';
import { formatPhpMinor as formatMoney, formatPhilippineDateTime as formatDateTime } from '@/lib/formatters';
import { toast } from '@/components/ui/Sonner';

export default function BillingPage() {
  const router = useRouter();
  const { user, refreshSession } = useAuth();
  const { data, isLoading, error, refresh } = useBillingAccess();

  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isStartingCheckout, setIsStartingCheckout] = useState(false);
  const [isTestCheckoutModalOpen, setIsTestCheckoutModalOpen] = useState(false);
  const [isProcessingTestPayment, setIsProcessingTestPayment] = useState(false);
  const [isProcessingRevocation, setIsProcessingRevocation] = useState(false);
  const submitting = useRef(false);

  const startCheckout = async () => {
    if (!data?.checkout.available || submitting.current) return;
    submitting.current = true;
    setIsStartingCheckout(true);
    setCheckoutError(null);
    try {
      const response = await api.post(
        '/billing/subscriptions',
        { priceCode: 'PREMIUM' },
        {
          headers: { 'Idempotency-Key': getOrCreatePremiumCheckoutAttemptKey() },
        }
      );
      const checkoutUrl = validateHostedCheckoutUrl(response.data?.data?.checkoutUrl);
      window.location.assign(checkoutUrl);
    } catch (caught: unknown) {
      const code = getApiErrorCode(caught);
      if (code === 'CHECKOUT_PROVIDER_REJECTED' || code === 'CHECKOUT_REQUEST_INVALID') {
        clearPremiumCheckoutAttemptKey();
      }
      setCheckoutError(
        code === 'PAYMENTS_UNAVAILABLE'
          ? 'Sandbox checkout is currently disabled.'
          : code === 'CHECKOUT_IN_PROGRESS'
            ? 'This checkout attempt is still being prepared. Please try again in a moment.'
            : 'Sandbox checkout could not be opened. No access change was made. You can safely try again.'
      );
      submitting.current = false;
      setIsStartingCheckout(false);
    }
  };

  const handleTestCheckout = async () => {
    setIsProcessingTestPayment(true);
    setCheckoutError(null);
    try {
      const response = await api.post('/user/test-premium', { action: 'grant' });
      if (response.data?.success) {
        clearPremiumCheckoutAttemptKey();
        await refresh();
        await refreshSession();
        setIsTestCheckoutModalOpen(false);
        toast.success('🎉 Premium Activated! 30 days of Premium access is now active on your account.');
        router.push('/billing/success');
      }
    } catch {
      setCheckoutError('Test payment simulation failed. Please try again.');
      toast.error('Test payment simulation failed. Please try again.');
    } finally {
      setIsProcessingTestPayment(false);
    }
  };

  const handleRevokeTestPremium = async () => {
    setIsProcessingRevocation(true);
    setCheckoutError(null);
    try {
      const response = await api.post('/user/test-premium', { action: 'revoke' });
      if (response.data?.success) {
        await refresh();
        await refreshSession();
        toast.info('Test access revoked. Other Premium access is preserved.');
      }
    } catch {
      setCheckoutError('Failed to revoke test premium.');
      toast.error('Failed to revoke test premium.');
    } finally {
      setIsProcessingRevocation(false);
    }
  };

  if (isLoading) {
    return <PortalLoadingState message="Loading billing access..." />;
  }

  if (error || !data) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-lg items-center px-5">
        <Card className="w-full p-7 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-brand-green" />
          <h1 className="mt-4 font-display text-2xl font-extrabold">Billing status unavailable</h1>
          <p className="mt-2 text-sm text-brand-muted" role="alert">
            {error || 'Your billing status could not be loaded.'}
          </p>
          <Button className="mt-6" variant="secondary" onClick={() => void refresh()}>
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  const premium = data.catalogue.find((plan) => plan.tier === 'PREMIUM');
  const active = data.current.tier === 'PREMIUM';
  const verificationCopy =
    data.current.verification === 'RECONCILIATION_REQUIRED'
      ? 'Payment verification needs review. Your current access remains based on verified server records.'
      : data.current.verification !== 'NONE'
        ? 'Payment verification is pending. This page will show Premium only after server confirmation.'
        : null;

  return (
    <div className="mx-auto max-w-6xl px-5 py-6 sm:px-7 md:py-8">
      <PortalPageHeader
        icon={Crown}
        eyebrow="Premium access"
        title={
          <>
            More choice in your <span className="text-brand-green">weekly plan</span>
          </>
        }
        description="Compare meal-swap and outside-food AI allowances. Nutrition safety, grocery tools, exports, and privacy controls stay available on Free, together with FNRI and manual nutrition-label logging."
        meta={<Badge variant={active ? 'verified' : 'user'}>{active ? 'Premium active' : 'Free plan'}</Badge>}
      />

      <section className="mt-7 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]" aria-labelledby="current-access-title">
        <Card className="relative overflow-hidden border-brand-green/25 bg-[linear-gradient(135deg,rgba(82,183,136,0.13),rgba(255,255,255,0.88))] p-7 dark:bg-[linear-gradient(135deg,rgba(82,183,136,0.14),rgba(15,25,20,0.92))]">
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-brand-accent/20 blur-3xl" />
          <div className="relative">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand-green">
              Current access
            </p>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="current-access-title" className="font-display text-4xl font-extrabold tracking-tight">
                  {data.current.tier === 'PREMIUM' ? 'Premium' : 'Free'}
                </h2>
                <p className="mt-2 max-w-xl text-sm text-brand-muted">
                  {active && data.current.access
                    ? `One-time Premium access. It ends ${formatDateTime(data.current.access.expiresAt)} and does not renew automatically.`
                    : 'Free includes three meal swaps plus FNRI, verified-library, and nutrition-label outside-food logging.'}
                </p>
              </div>
              <div className="rounded-2xl border border-brand-border/70 bg-brand-surface/80 px-5 py-4 text-right shadow-sm">
                <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-brand-muted">
                  Swaps remaining
                </p>
                <p className="mt-1 font-display text-3xl font-extrabold text-brand-green">
                  {data.current.swaps.remaining}
                  <span className="text-base text-brand-muted">/{data.current.swaps.cap}</span>
                </p>
              </div>
            </div>
            <div
              className="mt-6 h-2 overflow-hidden rounded-full bg-brand-border/60"
              aria-label={`${data.current.swaps.used} of ${data.current.swaps.cap} swaps used`}
            >
              <div
                className="h-full rounded-full bg-brand-green transition-all"
                style={{ width: `${Math.min(100, (data.current.swaps.used / data.current.swaps.cap) * 100)}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs text-brand-muted">
              <span>{data.current.swaps.used} used in this weekly plan</span>
              {data.current.swaps.cycleEndsAtExclusive && (
                <span>Cycle resets {formatDateTime(data.current.swaps.cycleEndsAtExclusive)}</span>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-7">
          <div className="flex items-center gap-3">
            <CalendarClock className="h-5 w-5 text-brand-green" />
            <h2 className="font-display text-lg font-extrabold">Access details</h2>
          </div>
          <dl className="mt-5 space-y-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-brand-muted">Status</dt>
              <dd className="font-semibold">{active ? 'Premium Active' : 'Free'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-brand-muted">Automatic renewal</dt>
              <dd className="font-semibold">No</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-brand-muted">Payment mode</dt>
              <dd className="font-semibold">TEST sandbox</dd>
            </div>
            {data.current.access && (
              <div className="border-t border-brand-border/60 pt-4">
                <dt className="text-brand-muted">Exact expiry</dt>
                <dd className="mt-1 font-semibold">{formatDateTime(data.current.access.expiresAt)}</dd>
              </div>
            )}
          </dl>
          {active && user?.testPremiumAllowed && (
            <div className="mt-5 border-t border-brand-border/60 pt-4">
              <Button
                variant="secondary"
                size="sm"
                className="w-full text-xs text-status-error-text hover:bg-status-error-bg/20"
                isLoading={isProcessingRevocation}
                onClick={() => void handleRevokeTestPremium()}
              >
                Revoke test access
              </Button>
            </div>
          )}
        </Card>
      </section>

      {verificationCopy && (
        <div
          className="mt-5 rounded-2xl border border-status-pending-text/20 bg-status-pending-bg px-5 py-4 text-sm text-status-pending-text"
          role="status"
          aria-live="polite"
        >
          {verificationCopy}
        </div>
      )}

      <section className="mt-8" aria-labelledby="compare-title">
        <div className="grid items-end gap-5 md:grid-cols-2">
          <div>
            <p className="portal-kicker">Plan comparison</p>
            <h2 id="compare-title" className="mt-2 font-display text-2xl font-extrabold">
              Clear, bounded differences
            </h2>
          </div>
          <div className="flex items-center justify-start pb-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-brand-muted">
              No safety features are paywalled
            </span>
          </div>
        </div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          {/* FREE PLAN CARD */}
          <Card className="p-7 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-brand-muted">Always available</p>
                  <h3 className="mt-2 font-display text-3xl font-extrabold">Free</h3>
                </div>
                <Repeat2 className="h-7 w-7 text-brand-muted" />
              </div>
              <p className="mt-6 font-display text-5xl font-extrabold">₱0</p>

              <div className="mt-7 space-y-3">
                <div className="flex items-start gap-3 rounded-2xl bg-brand-bgAlt p-3.5 text-sm">
                  <Check className="h-5 w-5 text-brand-green shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-brand-text">3 meal swaps per weekly plan</p>
                    <p className="text-xs text-brand-muted mt-0.5">Swap within clinical macro and calorie boundaries</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-brand-bgAlt p-3.5 text-sm">
                  <Check className="h-5 w-5 text-brand-green shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-brand-text">FNRI Philippine Food Database</p>
                    <p className="text-xs text-brand-muted mt-0.5">
                      1,500+ authentic local Filipino food composition items
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-brand-bgAlt p-3.5 text-sm">
                  <Check className="h-5 w-5 text-brand-green shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-brand-text">Manual outside-food logging</p>
                    <p className="text-xs text-brand-muted mt-0.5">
                      Track external meals with manual nutrition label macros
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-brand-bgAlt p-3.5 text-sm">
                  <Check className="h-5 w-5 text-brand-green shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-brand-text">Full clinical contraindication safety</p>
                    <p className="text-xs text-brand-muted mt-0.5">
                      Allergy, diabetes & hypertension guardrails with RND review
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-brand-bgAlt p-3.5 text-sm">
                  <Check className="h-5 w-5 text-brand-green shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-brand-text">Current-week grocery checklist</p>
                    <p className="text-xs text-brand-muted mt-0.5">Category-sorted ingredient list with PDF export</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-brand-border/60">
              <span className="block text-center text-xs font-semibold text-brand-muted">
                Standard baseline account
              </span>
            </div>
          </Card>

          {/* PREMIUM PLAN CARD WITH SALAKOT HAT OVERLAY */}
          <Card className="relative overflow-visible border border-brand-accent/40 p-7 shadow-neon flex flex-col justify-between bg-[linear-gradient(135deg,rgba(82,183,136,0.06),rgba(255,255,255,0.01))]">
            {/* Salakot hat overlay perched on top-right of container */}
            <div className="pointer-events-none absolute -top-12 -right-5 z-20 select-none sm:-top-14 sm:-right-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/salakot.svg"
                alt="Traditional Filipino Salakot"
                className="h-24 w-24 -rotate-12 drop-shadow-2xl sm:h-32 sm:w-32"
              />
            </div>

            <div>
              <div className="flex items-start justify-between pr-14 sm:pr-24">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-brand-green">One-time access</p>
                  <h3 className="mt-2 font-display text-3xl font-extrabold">Premium</h3>
                </div>
                <Badge variant="pending">TEST demo</Badge>
              </div>

              <p className="mt-6 font-display text-5xl font-extrabold text-brand-text">
                {premium?.price ? formatMoney(premium.price.amountMinor) : 'Unavailable'}
              </p>
              <p className="mt-2 text-xs text-brand-muted">Sandbox demo price for 30 days. No automatic renewal.</p>

              <div className="mt-7 space-y-3">
                <div className="flex items-start gap-3 rounded-2xl bg-brand-bgAlt p-3.5 text-sm">
                  <Sparkles className="h-5 w-5 text-brand-green shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-brand-text">6 meal swaps per weekly plan</p>
                    <p className="text-xs text-brand-muted mt-0.5">
                      Swap up to two full days of meals with compatibility checks and calorie-change warnings
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-brand-bgAlt p-3.5 text-sm">
                  <Sparkles className="h-5 w-5 text-brand-green shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-brand-text">Gemini AI Outside-Meal Estimator</p>
                    <p className="text-xs text-brand-muted mt-0.5">
                      Type any dish (&ldquo;1 cup chicken adobo with rice&rdquo;) for estimated macros and restriction
                      checks (5/day, 30 per 30 days)
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-brand-bgAlt p-3.5 text-sm">
                  <Sparkles className="h-5 w-5 text-brand-green shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-brand-text">Early Next-Week Plan Access</p>
                    <p className="text-xs text-brand-muted mt-0.5">
                      Preview, generate, and customize upcoming 7-day plans ahead of schedule
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-brand-bgAlt p-3.5 text-sm">
                  <Sparkles className="h-5 w-5 text-brand-green shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-brand-text">Next-Week Smart Grocery & PDF Export</p>
                    <p className="text-xs text-brand-muted mt-0.5">
                      Shop prepared before market day with next week&apos;s categorized checklist
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-brand-bgAlt p-3.5 text-sm">
                  <Sparkles className="h-5 w-5 text-brand-green shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-brand-text">PSA Market Shopping Cost & Budget Estimates</p>
                    <p className="text-xs text-brand-muted mt-0.5">
                      Published commodity reference pricing, subtotal estimates, and price source evidence for your
                      shopping list
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-2xl bg-brand-bgAlt p-3.5 text-sm">
                  <Sparkles className="h-5 w-5 text-brand-green shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-brand-text">Exclusive Salakot Crown Profile Badge</p>
                    <p className="text-xs text-brand-muted mt-0.5">
                      Proudly wear the traditional Filipino Salakot crown on your avatar across KAINARA
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-brand-border/60">
              <Button
                className="w-full shadow-neon font-display font-extrabold"
                size="lg"
                disabled={!data.checkout.available && !user?.testPremiumAllowed}
                isLoading={isStartingCheckout || isProcessingTestPayment}
                onClick={() => {
                  if (data.checkout.available) {
                    void startCheckout();
                  } else {
                    setIsTestCheckoutModalOpen(true);
                  }
                }}
              >
                {data.checkout.available
                  ? 'Open TEST checkout'
                  : user?.testPremiumAllowed
                    ? 'Activate test Premium'
                    : 'Admin permission required for testing'}{' '}
                <ArrowRight className="h-4 w-4" />
              </Button>
              {checkoutError && (
                <p className="mt-3 text-center text-sm text-status-error-text" role="alert" aria-live="assertive">
                  {checkoutError}
                </p>
              )}
            </div>
          </Card>
        </div>
      </section>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-brand-border/70 bg-brand-surface/70 p-5 text-sm text-brand-muted">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" />
        <p>
          Checkout returns never activate Premium by themselves. Access appears only after KAINARA verifies the payment
          on the server.
        </p>
      </div>

      {/* TEST CHECKOUT MODAL */}
      <Modal
        isOpen={isTestCheckoutModalOpen}
        onClose={() => setIsTestCheckoutModalOpen(false)}
        title="KAINARA Sandbox Demo Checkout"
        description="Simulate testing one-time 30-day Premium access without moving real money or entering credit cards."
        size="md"
        footer={
          <div className="flex w-full items-center justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => setIsTestCheckoutModalOpen(false)}
              disabled={isProcessingTestPayment}
            >
              Cancel
            </Button>
            <Button variant="primary" isLoading={isProcessingTestPayment} onClick={() => void handleTestCheckout()}>
              Activate test access <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-4 rounded-2xl border border-brand-accent/30 bg-brand-accent/10 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/salakot.svg" alt="Salakot Hat" className="h-14 w-14 -rotate-6 drop-shadow-md" />
            <div>
              <p className="font-display font-extrabold text-base text-brand-text">30-Day Premium Access</p>
              <p className="text-xs text-brand-muted">Administrator-authorized test access · No payment</p>
            </div>
          </div>

          <div className="space-y-2 text-xs text-brand-muted">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-brand-green shrink-0" />
              <span>Unlocks 6 weekly meal swaps (double allowance)</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-brand-green shrink-0" />
              <span>Unlocks Gemini AI outside-meal nutrition estimation</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-brand-green shrink-0" />
              <span>Unlocks Next-Week meal planning and grocery exports</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-brand-green shrink-0" />
              <span>Unlocks PSA grocery shopping cost and budget estimates</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-brand-green shrink-0" />
              <span>Adds the exclusive Filipino Salakot crown to your profile avatar</span>
            </div>
          </div>

          <div className="rounded-xl bg-brand-bgAlt p-3 text-[11px] text-brand-muted flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-green shrink-0 mt-0.5" />
            <span>
              Clicking complete creates an administrator-authorized test grant, not a payment, and enables 30 days of
              active Premium entitlement to your account on the server.
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}
