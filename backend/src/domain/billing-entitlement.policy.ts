import type { BillingInvoiceState, BillingSubscriptionState } from './billing-state.policy';

export type BillingTier = 'FREE' | 'PREMIUM';
export type EntitlementResolutionReason = 'FREE_DEFAULT' | 'ACTIVE_PAID_GRANT' | 'PAST_DUE_GRACE';

export interface PremiumGrantEvidence {
  id: string;
  subscriptionId?: string | null;
  source: 'PAID_INVOICE' | 'ADMIN_ADJUSTMENT';
  invoiceStatus?: BillingInvoiceState | null;
  effectiveFrom: Date;
  effectiveUntil: Date;
  revokedAt?: Date | null;
}

export interface SubscriptionEntitlementEvidence {
  id: string;
  status: BillingSubscriptionState;
  pastDueAt?: Date | null;
}

export interface EntitlementResolution {
  tier: BillingTier;
  reason: EntitlementResolutionReason;
  grantId: string | null;
  effectiveUntil: Date | null;
}

export const FREE_WEEKLY_SWAP_CAP = 3;
export const PREMIUM_WEEKLY_SWAP_CAP = 6;
export const MAX_PAST_DUE_GRACE_HOURS = 72;

function validDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function isVerifiedGrant(grant: PremiumGrantEvidence): boolean {
  if (!grant.id || !validDate(grant.effectiveFrom) || !validDate(grant.effectiveUntil)) return false;
  if (grant.effectiveUntil.getTime() <= grant.effectiveFrom.getTime()) return false;
  if (grant.source === 'PAID_INVOICE') return grant.invoiceStatus === 'PAID';
  return grant.source === 'ADMIN_ADJUSTMENT';
}

function isRevokedAt(grant: PremiumGrantEvidence, atMs: number): boolean {
  return validDate(grant.revokedAt) && grant.revokedAt.getTime() <= atMs;
}

export function resolveBillingEntitlement(input: {
  at: Date;
  grants: readonly PremiumGrantEvidence[];
  subscriptions?: readonly SubscriptionEntitlementEvidence[];
  pastDueGraceHours?: number;
}): EntitlementResolution {
  if (!validDate(input.at)) throw new TypeError('Entitlement resolution requires a valid instant.');
  const graceHours = input.pastDueGraceHours ?? MAX_PAST_DUE_GRACE_HOURS;
  if (!Number.isFinite(graceHours) || graceHours < 0 || graceHours > MAX_PAST_DUE_GRACE_HOURS) {
    throw new RangeError(`Past-due grace must be between 0 and ${MAX_PAST_DUE_GRACE_HOURS} hours.`);
  }

  const atMs = input.at.getTime();
  const grants = input.grants.filter(isVerifiedGrant);
  const active = grants
    .filter((grant) =>
      grant.effectiveFrom.getTime() <= atMs &&
      atMs < grant.effectiveUntil.getTime() &&
      !isRevokedAt(grant, atMs),
    )
    .sort((a, b) => b.effectiveUntil.getTime() - a.effectiveUntil.getTime())[0];

  if (active) {
    return {
      tier: 'PREMIUM',
      reason: 'ACTIVE_PAID_GRANT',
      grantId: active.id,
      effectiveUntil: new Date(active.effectiveUntil),
    };
  }

  const subscriptions = new Map((input.subscriptions ?? []).map((subscription) => [subscription.id, subscription]));
  const graceMs = graceHours * 60 * 60 * 1000;
  const graceGrant = grants
    .filter((grant) => {
      if (!grant.subscriptionId || grant.source !== 'PAID_INVOICE' || isRevokedAt(grant, atMs)) return false;
      const subscription = subscriptions.get(grant.subscriptionId);
      if (subscription?.status !== 'PAST_DUE' || !validDate(subscription.pastDueAt)) return false;
      const graceUntil = Math.min(
        grant.effectiveUntil.getTime() + graceMs,
        subscription.pastDueAt.getTime() + graceMs,
      );
      return grant.effectiveUntil.getTime() <= atMs && atMs < graceUntil;
    })
    .sort((a, b) => b.effectiveUntil.getTime() - a.effectiveUntil.getTime())[0];

  if (graceGrant) {
    const subscription = subscriptions.get(graceGrant.subscriptionId!);
    const effectiveUntil = new Date(Math.min(
      graceGrant.effectiveUntil.getTime() + graceMs,
      subscription!.pastDueAt!.getTime() + graceMs,
    ));
    return { tier: 'PREMIUM', reason: 'PAST_DUE_GRACE', grantId: graceGrant.id, effectiveUntil };
  }

  return { tier: 'FREE', reason: 'FREE_DEFAULT', grantId: null, effectiveUntil: null };
}

export function weeklySwapCapForTier(tier: BillingTier): number {
  return tier === 'PREMIUM' ? PREMIUM_WEEKLY_SWAP_CAP : FREE_WEEKLY_SWAP_CAP;
}
