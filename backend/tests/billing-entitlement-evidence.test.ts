import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPremiumEntitlementGrantWhere,
  mapPremiumEntitlementEvidence,
  type PremiumEntitlementGrantRow,
} from '../src/domain/billing-entitlement-evidence';

test('[TEST-167] premium entitlement readers share the same bounded evidence window', () => {
  const at = new Date('2026-09-07T00:00:00.000Z');
  const where = buildPremiumEntitlementGrantWhere(at);

  assert.equal(where.entitlementKey, 'PREMIUM');
  assert.deepEqual(where.effectiveFrom, { lte: at });
  assert.ok(where.effectiveUntil && typeof where.effectiveUntil === 'object');
  assert.ok('gt' in (where.effectiveUntil as Record<string, unknown>));
  assert.deepEqual(where.OR, [{ revokedAt: null }, { revokedAt: { gt: at } }]);
});

test('[TEST-167] entitlement evidence mapping keeps grant and subscription projections aligned', () => {
  const row = {
    id: 'grant-1',
    source: 'PAID_INVOICE',
    effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
    effectiveUntil: new Date('2026-10-01T00:00:00.000Z'),
    revokedAt: null,
    invoice: { status: 'PAID' },
    subscription: { id: 'sub-1', status: 'ACTIVE', pastDueAt: null },
  } as PremiumEntitlementGrantRow;

  const evidence = mapPremiumEntitlementEvidence([row]);
  assert.equal(evidence.grants[0]?.subscriptionId, 'sub-1');
  assert.equal(evidence.grants[0]?.invoiceStatus, 'PAID');
  assert.deepEqual(evidence.subscriptions, [{ id: 'sub-1', status: 'ACTIVE', pastDueAt: null }]);
});
