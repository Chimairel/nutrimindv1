import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BillingAccessEvidence,
  BillingAccessRepository,
  BillingAccessUnavailableError,
  UserBillingAccessService,
  buildUserBillingAccessView,
} from '../src/services/user-billing-access.service';

const now = new Date('2026-09-06T04:00:00.000Z');

function evidence(overrides: Partial<BillingAccessEvidence> = {}): BillingAccessEvidence {
  return {
    userEligible: true,
    grants: [],
    subscriptions: [],
    activeTestPrice: { amountMinor: 19_900, currency: 'PHP' },
    latestCheckout: null,
    latestProcessing: null,
    hasOpenReconciliationIssue: false,
    swapCycle: {
      startsAt: new Date('2026-09-05T16:00:00.000Z'),
      endsAtExclusive: new Date('2026-09-12T16:00:00.000Z'),
      swapsUsed: 2,
    },
    ...overrides,
  };
}

function paidGrant(overrides: Record<string, unknown> = {}) {
  return {
    id: 'grant_owner_1',
    source: 'PAID_INVOICE' as const,
    invoiceStatus: 'PAID' as const,
    effectiveFrom: new Date('2026-09-01T04:00:00.000Z'),
    effectiveUntil: new Date('2026-10-01T04:00:00.000Z'),
    revokedAt: null,
    ...overrides,
  };
}

test('[TEST-106] billing access defaults to Free with three swaps and exposes only the TEST catalogue', () => {
  const result = buildUserBillingAccessView({ at: now, evidence: evidence(), checkoutEnabled: true });
  assert.equal(result.environment, 'TEST');
  assert.equal(result.current.tier, 'FREE');
  assert.deepEqual(result.current.swaps, {
    used: 2,
    cap: 3,
    remaining: 1,
    cycleStartsAt: '2026-09-05T16:00:00.000Z',
    cycleEndsAtExclusive: '2026-09-12T16:00:00.000Z',
  });
  assert.deepEqual(
    result.catalogue.map((plan) => [plan.tier, plan.weeklySwapCap]),
    [
      ['FREE', 3],
      ['PREMIUM', 6],
    ]
  );
  assert.deepEqual(result.catalogue[1].price, {
    amountMinor: 19_900,
    currency: 'PHP',
    environment: 'TEST',
    label: 'SANDBOX_DEMO_PRICE',
  });
  assert.equal(result.catalogue[1].accessDays, 30);
  assert.equal(result.catalogue[1].renewsAutomatically, false);
  assert.deepEqual(result.checkout, { available: true, reason: 'AVAILABLE' });
});

test('[TEST-107] a paid, current, unrevoked grant yields six swaps and exact nonrenewing access dates', () => {
  const result = buildUserBillingAccessView({
    at: now,
    evidence: evidence({ grants: [paidGrant()], swapCycle: null }),
    checkoutEnabled: true,
  });
  assert.equal(result.current.tier, 'PREMIUM');
  assert.equal(result.current.swaps.cap, 6);
  assert.equal(result.current.swaps.remaining, 6);
  assert.deepEqual(result.current.access, {
    startsAt: '2026-09-01T04:00:00.000Z',
    expiresAt: '2026-10-01T04:00:00.000Z',
    status: 'NON_RENEWING',
    renewsAutomatically: false,
  });
  assert.deepEqual(result.checkout, { available: false, reason: 'ACTIVE_ACCESS' });
});

test('[TEST-108] expired, revoked, missing, and unpaid grants fail closed to Free', () => {
  const cases = [
    [],
    [paidGrant({ effectiveUntil: new Date(now) })],
    [paidGrant({ revokedAt: new Date(now) })],
    [paidGrant({ invoiceStatus: 'OPEN' })],
  ];
  for (const grants of cases) {
    const result = buildUserBillingAccessView({ at: now, evidence: evidence({ grants }), checkoutEnabled: true });
    assert.equal(result.current.tier, 'FREE');
    assert.equal(result.current.access, null);
    assert.equal(result.current.swaps.cap, 3);
  }
});

test('[TEST-109] checkout availability and verification status come only from server evidence', () => {
  const pending = buildUserBillingAccessView({
    at: now,
    evidence: evidence({
      latestCheckout: {
        status: 'SUCCEEDED',
        createdAt: new Date(now),
        completedAt: new Date(now),
        projected: false,
      },
    }),
    checkoutEnabled: true,
  });
  assert.equal(pending.current.verification, 'PAYMENT_VERIFICATION_PENDING');
  assert.deepEqual(pending.checkout, { available: false, reason: 'PAYMENT_PENDING' });

  const reconciliation = buildUserBillingAccessView({
    at: now,
    evidence: evidence({ hasOpenReconciliationIssue: true }),
    checkoutEnabled: true,
  });
  assert.equal(reconciliation.current.verification, 'RECONCILIATION_REQUIRED');

  const noPrice = buildUserBillingAccessView({
    at: now,
    evidence: evidence({ activeTestPrice: null }),
    checkoutEnabled: true,
  });
  assert.deepEqual(noPrice.checkout, { available: false, reason: 'PRICE_UNAVAILABLE' });

  const disabled = buildUserBillingAccessView({ at: now, evidence: evidence(), checkoutEnabled: false });
  assert.deepEqual(disabled.checkout, { available: false, reason: 'DISABLED' });
});

test('[TEST-110] access service reads one authenticated owner at one server instant and rejects ineligible users', async () => {
  const reads: Array<{ userId: string; at: Date }> = [];
  const repository: BillingAccessRepository = {
    async readForUser(userId, at) {
      reads.push({ userId, at });
      return evidence();
    },
  };
  const service = new UserBillingAccessService(repository, true, () => new Date(now));
  const result = await service.getForUser('owner_1');
  assert.equal(result.serverTime, now.toISOString());
  assert.deepEqual(reads, [{ userId: 'owner_1', at: now }]);

  const unavailable = new UserBillingAccessService(
    {
      async readForUser() {
        return null;
      },
    },
    true,
    () => now
  );
  await assert.rejects(() => unavailable.getForUser('missing'), BillingAccessUnavailableError);
  await assert.rejects(() => service.getForUser(''), BillingAccessUnavailableError);
});

test('[TEST-111] public billing serialization omits ledger, provider, and secret fields', () => {
  const serialized = JSON.stringify(
    buildUserBillingAccessView({ at: now, evidence: evidence(), checkoutEnabled: true })
  );
  for (const privateField of [
    'invoiceStatus',
    'subscriptionId',
    'providerSessionId',
    'providerPaymentId',
    'sanitizedPayload',
    'requestHash',
    'secret',
    'healthConditions',
    'allergies',
  ]) {
    assert.equal(serialized.includes(privateField), false, privateField);
  }
});
