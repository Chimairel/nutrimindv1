import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decideInvoiceTransition,
  decidePaymentAttemptTransition,
  decideRefundTransition,
  decideSubscriptionTransition,
} from '../src/domain/billing-state.policy';

test('[TEST-080] subscription state transitions allow activation, retry recovery, and cancellation', () => {
  assert.equal(decideSubscriptionTransition({ current: 'INCOMPLETE', incoming: 'ACTIVE' }), 'APPLY');
  assert.equal(decideSubscriptionTransition({ current: 'ACTIVE', incoming: 'PAST_DUE' }), 'APPLY');
  assert.equal(decideSubscriptionTransition({ current: 'PAST_DUE', incoming: 'ACTIVE' }), 'APPLY');
  assert.equal(decideSubscriptionTransition({ current: 'PAST_DUE', incoming: 'UNPAID' }), 'APPLY');
  assert.equal(decideSubscriptionTransition({ current: 'UNPAID', incoming: 'CANCELLED' }), 'APPLY');
});

test('[TEST-080] duplicate transitions are idempotent and older provider evidence is stale', () => {
  assert.equal(decideSubscriptionTransition({ current: 'ACTIVE', incoming: 'ACTIVE' }), 'IDEMPOTENT');
  assert.equal(decideSubscriptionTransition({
    current: 'PAST_DUE',
    incoming: 'ACTIVE',
    currentProviderUpdatedAt: new Date('2026-09-05T10:00:00Z'),
    incomingProviderUpdatedAt: new Date('2026-09-05T09:59:59Z'),
  }), 'STALE');
});

test('[TEST-080] terminal and out-of-order subscription regressions are invalid', () => {
  assert.equal(decideSubscriptionTransition({ current: 'CANCELLED', incoming: 'ACTIVE' }), 'INVALID');
  assert.equal(decideSubscriptionTransition({ current: 'ACTIVE', incoming: 'INCOMPLETE' }), 'INVALID');
  assert.equal(decideSubscriptionTransition({ current: 'UNKNOWN', incoming: 'ACTIVE' }), 'INVALID');
});

test('[TEST-080] invoice and payment attempt transitions deny terminal regression', () => {
  assert.equal(decideInvoiceTransition({ current: 'DRAFT', incoming: 'OPEN' }), 'APPLY');
  assert.equal(decideInvoiceTransition({ current: 'OPEN', incoming: 'PAID' }), 'APPLY');
  assert.equal(decideInvoiceTransition({ current: 'PAID', incoming: 'OPEN' }), 'INVALID');
  assert.equal(decidePaymentAttemptTransition({ current: 'CREATED', incoming: 'REQUIRES_ACTION' }), 'APPLY');
  assert.equal(decidePaymentAttemptTransition({ current: 'PROCESSING', incoming: 'SUCCEEDED' }), 'APPLY');
  assert.equal(decidePaymentAttemptTransition({ current: 'SUCCEEDED', incoming: 'FAILED' }), 'INVALID');
});

test('[TEST-080] refund transitions require review and permit retry only after failure', () => {
  assert.equal(decideRefundTransition({ current: 'REQUESTED', incoming: 'REVIEWED' }), 'APPLY');
  assert.equal(decideRefundTransition({ current: 'REVIEWED', incoming: 'APPROVED' }), 'APPLY');
  assert.equal(decideRefundTransition({ current: 'APPROVED', incoming: 'SUBMITTED' }), 'APPLY');
  assert.equal(decideRefundTransition({ current: 'FAILED', incoming: 'SUBMITTED' }), 'APPLY');
  assert.equal(decideRefundTransition({ current: 'SUCCEEDED', incoming: 'SUBMITTED' }), 'INVALID');
  assert.equal(decideRefundTransition({ current: 'REQUESTED', incoming: 'SUCCEEDED' }), 'INVALID');
});
