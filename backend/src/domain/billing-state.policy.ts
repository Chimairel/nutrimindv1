export type BillingSubscriptionState =
  | 'INCOMPLETE'
  | 'INCOMPLETE_CANCELLED'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'UNPAID'
  | 'CANCELLED'
  | 'UNKNOWN';

export type BillingInvoiceState = 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNKNOWN';

export type BillingPaymentAttemptState =
  | 'CREATED'
  | 'REQUIRES_ACTION'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNKNOWN';

export type BillingRefundState =
  | 'REQUESTED'
  | 'REVIEWED'
  | 'APPROVED'
  | 'SUBMITTED'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REJECTED'
  | 'CANCELLED';

export type TransitionDecision = 'APPLY' | 'IDEMPOTENT' | 'STALE' | 'INVALID';

const SUBSCRIPTION_TRANSITIONS: Readonly<Record<BillingSubscriptionState, readonly BillingSubscriptionState[]>> = {
  INCOMPLETE: ['ACTIVE', 'INCOMPLETE_CANCELLED', 'CANCELLED'],
  INCOMPLETE_CANCELLED: [],
  ACTIVE: ['PAST_DUE', 'CANCELLED'],
  PAST_DUE: ['ACTIVE', 'UNPAID', 'CANCELLED'],
  UNPAID: ['ACTIVE', 'CANCELLED'],
  CANCELLED: [],
  UNKNOWN: [],
};

const INVOICE_TRANSITIONS: Readonly<Record<BillingInvoiceState, readonly BillingInvoiceState[]>> = {
  DRAFT: ['OPEN', 'VOID'],
  OPEN: ['PAID', 'VOID'],
  PAID: [],
  VOID: [],
  UNKNOWN: [],
};

const PAYMENT_ATTEMPT_TRANSITIONS: Readonly<Record<BillingPaymentAttemptState, readonly BillingPaymentAttemptState[]>> = {
  CREATED: ['REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED'],
  REQUIRES_ACTION: ['PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED'],
  PROCESSING: ['SUCCEEDED', 'FAILED', 'CANCELLED'],
  SUCCEEDED: [],
  FAILED: [],
  CANCELLED: [],
  UNKNOWN: [],
};

const REFUND_TRANSITIONS: Readonly<Record<BillingRefundState, readonly BillingRefundState[]>> = {
  REQUESTED: ['REVIEWED', 'REJECTED', 'CANCELLED'],
  REVIEWED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['SUCCEEDED', 'FAILED'],
  SUCCEEDED: [],
  FAILED: ['SUBMITTED', 'CANCELLED'],
  REJECTED: [],
  CANCELLED: [],
};

function isValidDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function decideTransition<T extends string>(input: {
  current: T;
  incoming: T;
  allowed: Readonly<Record<T, readonly T[]>>;
  currentProviderUpdatedAt?: Date | null;
  incomingProviderUpdatedAt?: Date | null;
}): TransitionDecision {
  if (
    isValidDate(input.currentProviderUpdatedAt) &&
    isValidDate(input.incomingProviderUpdatedAt) &&
    input.incomingProviderUpdatedAt.getTime() < input.currentProviderUpdatedAt.getTime()
  ) {
    return 'STALE';
  }
  if (input.current === input.incoming) return 'IDEMPOTENT';
  return input.allowed[input.current]?.includes(input.incoming) ? 'APPLY' : 'INVALID';
}

type TimedTransition<T> = {
  current: T;
  incoming: T;
  currentProviderUpdatedAt?: Date | null;
  incomingProviderUpdatedAt?: Date | null;
};

export function decideSubscriptionTransition(input: TimedTransition<BillingSubscriptionState>): TransitionDecision {
  return decideTransition({ ...input, allowed: SUBSCRIPTION_TRANSITIONS });
}

export function decideInvoiceTransition(input: TimedTransition<BillingInvoiceState>): TransitionDecision {
  return decideTransition({ ...input, allowed: INVOICE_TRANSITIONS });
}

export function decidePaymentAttemptTransition(input: TimedTransition<BillingPaymentAttemptState>): TransitionDecision {
  return decideTransition({ ...input, allowed: PAYMENT_ATTEMPT_TRANSITIONS });
}

export function decideRefundTransition(input: TimedTransition<BillingRefundState>): TransitionDecision {
  return decideTransition({ ...input, allowed: REFUND_TRANSITIONS });
}
