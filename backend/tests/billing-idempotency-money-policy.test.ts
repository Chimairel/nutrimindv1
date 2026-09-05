import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOperationIdempotencyKey,
  buildProviderEventKey,
  classifyProviderEvent,
  type ProviderEventIdentity,
} from '../src/domain/billing-idempotency.policy';
import {
  MAX_POSTGRES_INTEGER,
  assertLedgerAmount,
  assertPositiveMoney,
  assertRefundAmount,
  sumMinorAmounts,
} from '../src/domain/billing-money.policy';

const event: ProviderEventIdentity = {
  provider: 'PAYMONGO',
  environment: 'TEST',
  providerEventId: 'evt_123',
  payloadHash: 'a'.repeat(64),
};

test('[TEST-081] provider event identity distinguishes insert, duplicate replay, and hash conflict', () => {
  assert.deepEqual(classifyProviderEvent(event), {
    decision: 'INSERT',
    eventKey: 'PAYMONGO:TEST:evt_123',
  });
  assert.equal(classifyProviderEvent(event, { ...event }).decision, 'DUPLICATE');
  assert.deepEqual(classifyProviderEvent({ ...event, payloadHash: 'b'.repeat(64) }, event), {
    decision: 'CONFLICT',
    eventKey: 'PAYMONGO:TEST:evt_123',
    reason: 'EVENT_ID_PAYLOAD_MISMATCH',
  });
});

test('[TEST-081] provider event and outbound operation keys are deterministic and environment-scoped', () => {
  assert.equal(buildProviderEventKey(event), buildProviderEventKey({ ...event }));
  assert.notEqual(buildProviderEventKey(event), buildProviderEventKey({ ...event, environment: 'LIVE' }));
  assert.equal(
    buildOperationIdempotencyKey({ operation: 'subscription-create', aggregateId: 'subject_1', version: 2 }),
    'nutrimind:subscription-create:subject_1:v2',
  );
});

test('[TEST-081] malformed event hashes, identifiers, and operation versions fail closed', () => {
  assert.throws(() => buildProviderEventKey({ ...event, payloadHash: 'ABC' }), /lowercase SHA-256/);
  assert.throws(() => buildProviderEventKey({ ...event, providerEventId: 'evt with spaces' }), /invalid/);
  assert.throws(
    () => buildOperationIdempotencyKey({ operation: 'refund', aggregateId: 'refund-1', version: 0 }),
    /positive safe integer/,
  );
  assert.throws(
    () => buildOperationIdempotencyKey({ operation: 'x'.repeat(80), aggregateId: 'y'.repeat(80), version: 1 }),
    /exceeds the persistence limit/,
  );
});

test('[TEST-081] money accepts integer minor units and rejects floating, zero, negative, and oversized amounts', () => {
  assert.deepEqual(assertPositiveMoney({ amountMinor: 19_900, currency: 'PHP' }), {
    amountMinor: 19_900,
    currency: 'PHP',
  });
  assert.throws(() => assertPositiveMoney({ amountMinor: 199.5, currency: 'PHP' }), /safe integer/);
  assert.throws(() => assertPositiveMoney({ amountMinor: 0, currency: 'PHP' }), /greater than zero/);
  assert.throws(() => assertPositiveMoney({ amountMinor: -1, currency: 'PHP' }), /greater than zero/);
  assert.throws(
    () => assertPositiveMoney({ amountMinor: MAX_POSTGRES_INTEGER + 1, currency: 'PHP' }),
    /PostgreSQL integer range/,
  );
});

test('[TEST-081] currency mismatches and malformed ISO codes fail closed', () => {
  assert.throws(() => assertPositiveMoney({ amountMinor: 100, currency: 'php' }), /uppercase/);
  assert.throws(() => assertPositiveMoney({ amountMinor: 100, currency: 'USD' }, 'PHP'), /Currency mismatch/);
});

test('[TEST-081] cumulative refunds cannot exceed the verified paid amount', () => {
  assert.deepEqual(assertRefundAmount({
    paidMinor: 19_900,
    alreadyRefundedMinor: 4_000,
    requestedMinor: 5_000,
    paymentCurrency: 'PHP',
    refundCurrency: 'PHP',
  }), { remainingBeforeMinor: 15_900, remainingAfterMinor: 10_900 });
  assert.throws(() => assertRefundAmount({
    paidMinor: 19_900,
    alreadyRefundedMinor: 10_000,
    requestedMinor: 10_000,
    paymentCurrency: 'PHP',
    refundCurrency: 'PHP',
  }), /exceeds/);
});

test('[TEST-081] ledger sign and aggregate overflow invariants are explicit', () => {
  assert.equal(assertLedgerAmount('CHARGE', 100), 100);
  assert.equal(assertLedgerAmount('REFUND', -100), -100);
  assert.equal(assertLedgerAmount('ADJUSTMENT', -1), -1);
  assert.throws(() => assertLedgerAmount('REFUND', 100), /Invalid signed amount/);
  assert.throws(() => assertLedgerAmount('ADJUSTMENT', 0), /Invalid signed amount/);
  assert.equal(sumMinorAmounts([100, -25, 5]), 80);
  assert.throws(() => sumMinorAmounts([MAX_POSTGRES_INTEGER, 1]), /PostgreSQL integer range/);
});
