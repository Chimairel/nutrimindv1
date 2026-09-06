import type {
  BillingTier,
  EntitlementResolution,
  PremiumGrantEvidence,
  SubscriptionEntitlementEvidence,
} from '@/domain/billing-entitlement.policy';
import { resolveBillingEntitlement, weeklySwapCapForTier } from '@/domain/billing-entitlement.policy';
import { PREMIUM_ACCESS_DURATION_DAYS } from '@/domain/paymongo-payment-reconciliation.policy';

export type BillingVerificationState =
  'NONE' | 'PAYMENT_VERIFICATION_PENDING' | 'RECONCILIATION_PENDING' | 'RECONCILIATION_REQUIRED';

export interface BillingAccessEvidence {
  userEligible: boolean;
  grants: readonly PremiumGrantEvidence[];
  subscriptions: readonly SubscriptionEntitlementEvidence[];
  activeTestPrice: {
    amountMinor: number;
    currency: 'PHP';
  } | null;
  latestCheckout: {
    status: 'CLAIMED' | 'RETRYABLE' | 'FAILED' | 'SUCCEEDED';
    createdAt: Date;
    completedAt: Date | null;
    projected: boolean;
  } | null;
  latestProcessing: {
    status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'IGNORED';
    nextAttemptAt: Date | null;
  } | null;
  hasOpenReconciliationIssue: boolean;
  swapCycle: {
    startsAt: Date;
    endsAtExclusive: Date;
    swapsUsed: number;
  } | null;
}

export interface BillingAccessRepository {
  readForUser(userId: string, at: Date): Promise<BillingAccessEvidence | null>;
}

export interface BillingPlanComparison {
  tier: BillingTier;
  name: string;
  weeklySwapCap: number;
  benefit: string;
  price: null | {
    amountMinor: number;
    currency: 'PHP';
    environment: 'TEST';
    label: 'SANDBOX_DEMO_PRICE';
  };
  accessDays: null | 30;
  renewsAutomatically: false;
}

export interface UserBillingAccessView {
  serverTime: string;
  environment: 'TEST';
  catalogue: readonly [BillingPlanComparison, BillingPlanComparison];
  current: {
    tier: BillingTier;
    access: null | {
      startsAt: string;
      expiresAt: string;
      status: 'NON_RENEWING';
      renewsAutomatically: false;
    };
    swaps: {
      used: number;
      cap: number;
      remaining: number;
      cycleStartsAt: string | null;
      cycleEndsAtExclusive: string | null;
    };
    verification: BillingVerificationState;
  };
  checkout: {
    available: boolean;
    reason: 'AVAILABLE' | 'ACTIVE_ACCESS' | 'PAYMENT_PENDING' | 'DISABLED' | 'PRICE_UNAVAILABLE';
  };
}

export class BillingAccessUnavailableError extends Error {
  constructor() {
    super('BILLING_ACCESS_UNAVAILABLE');
    this.name = 'BillingAccessUnavailableError';
  }
}

function verificationState(evidence: BillingAccessEvidence, tier: BillingTier): BillingVerificationState {
  if (tier === 'PREMIUM') return 'NONE';
  if (evidence.hasOpenReconciliationIssue) return 'RECONCILIATION_REQUIRED';
  if (evidence.latestProcessing?.status === 'FAILED' && !evidence.latestProcessing.nextAttemptAt) {
    return 'RECONCILIATION_REQUIRED';
  }
  if (evidence.latestProcessing && ['PENDING', 'PROCESSING', 'FAILED'].includes(evidence.latestProcessing.status)) {
    return 'RECONCILIATION_PENDING';
  }
  if (
    evidence.latestCheckout &&
    ['CLAIMED', 'RETRYABLE', 'SUCCEEDED'].includes(evidence.latestCheckout.status) &&
    !evidence.latestCheckout.projected
  ) {
    return 'PAYMENT_VERIFICATION_PENDING';
  }
  return 'NONE';
}

function activeGrantStart(evidence: BillingAccessEvidence, resolution: EntitlementResolution): Date | null {
  if (!resolution.grantId) return null;
  return evidence.grants.find((grant) => grant.id === resolution.grantId)?.effectiveFrom ?? null;
}

export function buildUserBillingAccessView(input: {
  at: Date;
  evidence: BillingAccessEvidence;
  checkoutEnabled: boolean;
}): UserBillingAccessView {
  const resolution = resolveBillingEntitlement({
    at: input.at,
    grants: input.evidence.grants,
    subscriptions: input.evidence.subscriptions,
  });
  const cap = weeklySwapCapForTier(resolution.tier);
  const used = Math.max(0, input.evidence.swapCycle?.swapsUsed ?? 0);
  const verification = verificationState(input.evidence, resolution.tier);
  const price = input.evidence.activeTestPrice;
  const checkoutReason = !input.checkoutEnabled
    ? 'DISABLED'
    : !price
      ? 'PRICE_UNAVAILABLE'
      : resolution.tier === 'PREMIUM'
        ? 'ACTIVE_ACCESS'
        : verification !== 'NONE'
          ? 'PAYMENT_PENDING'
          : 'AVAILABLE';
  const start = activeGrantStart(input.evidence, resolution);

  return {
    serverTime: input.at.toISOString(),
    environment: 'TEST',
    catalogue: [
      {
        tier: 'FREE',
        name: 'Free',
        weeklySwapCap: 3,
        benefit: '3 meal swaps per weekly plan',
        price: null,
        accessDays: null,
        renewsAutomatically: false,
      },
      {
        tier: 'PREMIUM',
        name: 'Premium',
        weeklySwapCap: 6,
        benefit: '6 meal swaps per weekly plan',
        price: price ? { ...price, environment: 'TEST', label: 'SANDBOX_DEMO_PRICE' } : null,
        accessDays: PREMIUM_ACCESS_DURATION_DAYS,
        renewsAutomatically: false,
      },
    ],
    current: {
      tier: resolution.tier,
      access:
        resolution.tier === 'PREMIUM' && start && resolution.effectiveUntil
          ? {
              startsAt: start.toISOString(),
              expiresAt: resolution.effectiveUntil.toISOString(),
              status: 'NON_RENEWING',
              renewsAutomatically: false,
            }
          : null,
      swaps: {
        used,
        cap,
        remaining: Math.max(0, cap - used),
        cycleStartsAt: input.evidence.swapCycle?.startsAt.toISOString() ?? null,
        cycleEndsAtExclusive: input.evidence.swapCycle?.endsAtExclusive.toISOString() ?? null,
      },
      verification,
    },
    checkout: { available: checkoutReason === 'AVAILABLE', reason: checkoutReason },
  };
}

export class UserBillingAccessService {
  constructor(
    private readonly repository: BillingAccessRepository,
    private readonly checkoutEnabled: boolean,
    private readonly clock: () => Date = () => new Date()
  ) {}

  async getForUser(userId: string): Promise<UserBillingAccessView> {
    if (!userId) throw new BillingAccessUnavailableError();
    const at = this.clock();
    const evidence = await this.repository.readForUser(userId, at);
    if (!evidence?.userEligible) throw new BillingAccessUnavailableError();
    return buildUserBillingAccessView({ at, evidence, checkoutEnabled: this.checkoutEnabled });
  }
}
