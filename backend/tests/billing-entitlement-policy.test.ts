import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FREE_WEEKLY_SWAP_CAP,
  PREMIUM_WEEKLY_SWAP_CAP,
  resolveBillingEntitlement,
  weeklySwapCapForTier,
  type PremiumGrantEvidence,
} from '../src/domain/billing-entitlement.policy';

const paidGrant: PremiumGrantEvidence = {
  id: 'grant-paid-september',
  subscriptionId: 'sub-1',
  source: 'PAID_INVOICE',
  invoiceStatus: 'PAID',
  effectiveFrom: new Date('2026-09-01T00:00:00Z'),
  effectiveUntil: new Date('2026-10-01T00:00:00Z'),
};

test('[TEST-080] Free is the default and keeps the existing three-swap cap', () => {
  const result = resolveBillingEntitlement({ at: new Date('2026-09-15T00:00:00Z'), grants: [] });
  assert.deepEqual(result, { tier: 'FREE', reason: 'FREE_DEFAULT', grantId: null, effectiveUntil: null });
  assert.equal(weeklySwapCapForTier(result.tier), FREE_WEEKLY_SWAP_CAP);
  assert.equal(FREE_WEEKLY_SWAP_CAP, 3);
});

test('[TEST-080] a verified paid period grants Premium and six safety-bounded swaps', () => {
  const result = resolveBillingEntitlement({
    at: new Date('2026-09-15T00:00:00Z'),
    grants: [paidGrant],
    subscriptions: [{ id: 'sub-1', status: 'ACTIVE' }],
  });
  assert.equal(result.tier, 'PREMIUM');
  assert.equal(result.reason, 'ACTIVE_PAID_GRANT');
  assert.equal(result.grantId, paidGrant.id);
  assert.equal(weeklySwapCapForTier(result.tier), PREMIUM_WEEKLY_SWAP_CAP);
  assert.equal(PREMIUM_WEEKLY_SWAP_CAP, 6);
});

test('[TEST-080] provider subscription status or a browser return cannot replace paid grant evidence', () => {
  const result = resolveBillingEntitlement({
    at: new Date('2026-09-15T00:00:00Z'),
    grants: [],
    subscriptions: [{ id: 'sub-1', status: 'ACTIVE' }],
  });
  assert.equal(result.tier, 'FREE');
});

test('[TEST-080] cancellation does not remove access during an already-paid period', () => {
  const result = resolveBillingEntitlement({
    at: new Date('2026-09-30T23:59:59Z'),
    grants: [paidGrant],
    subscriptions: [{ id: 'sub-1', status: 'CANCELLED' }],
  });
  assert.equal(result.tier, 'PREMIUM');
  assert.equal(result.reason, 'ACTIVE_PAID_GRANT');
});

test('[TEST-080] the paid period expires at an exclusive end instant', () => {
  const result = resolveBillingEntitlement({ at: new Date('2026-10-01T00:00:00Z'), grants: [paidGrant] });
  assert.equal(result.tier, 'FREE');
});

test('[TEST-080] a refund or administrative reversal revokes a grant from its effective instant', () => {
  const result = resolveBillingEntitlement({
    at: new Date('2026-09-20T00:00:00Z'),
    grants: [{ ...paidGrant, revokedAt: new Date('2026-09-18T00:00:00Z') }],
  });
  assert.equal(result.tier, 'FREE');
});

test('[TEST-080] past-due grace is linked to the last paid period and bounded to 72 hours', () => {
  const inGrace = resolveBillingEntitlement({
    at: new Date('2026-10-02T00:00:00Z'),
    grants: [paidGrant],
    subscriptions: [{ id: 'sub-1', status: 'PAST_DUE', pastDueAt: new Date('2026-10-01T00:00:00Z') }],
  });
  const afterGrace = resolveBillingEntitlement({
    at: new Date('2026-10-04T00:00:00Z'),
    grants: [paidGrant],
    subscriptions: [{ id: 'sub-1', status: 'PAST_DUE', pastDueAt: new Date('2026-10-01T00:00:00Z') }],
  });
  assert.equal(inGrace.reason, 'PAST_DUE_GRACE');
  assert.equal(inGrace.tier, 'PREMIUM');
  assert.equal(afterGrace.tier, 'FREE');
});

test('[TEST-080] unpaid state and unverified invoice evidence never receive grace or Premium', () => {
  const unpaid = resolveBillingEntitlement({
    at: new Date('2026-10-02T00:00:00Z'),
    grants: [paidGrant],
    subscriptions: [{ id: 'sub-1', status: 'UNPAID', pastDueAt: new Date('2026-10-01T00:00:00Z') }],
  });
  const openInvoice = resolveBillingEntitlement({
    at: new Date('2026-09-15T00:00:00Z'),
    grants: [{ ...paidGrant, invoiceStatus: 'OPEN' }],
  });
  assert.equal(unpaid.tier, 'FREE');
  assert.equal(openInvoice.tier, 'FREE');
});

test('[TEST-080] grace configuration cannot exceed the approved maximum', () => {
  assert.throws(
    () => resolveBillingEntitlement({ at: new Date(), grants: [], pastDueGraceHours: 73 }),
    /between 0 and 72/,
  );
});
