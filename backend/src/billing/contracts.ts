export type PaymongoPaymentMethod = 'card' | 'paymaya';

export interface HostedCheckoutRequest {
  idempotencyKey: string;
  referenceNumber: string;
  item: {
    name: string;
    amountMinor: number;
    currency: 'PHP';
  };
  paymentMethods: readonly PaymongoPaymentMethod[];
  successUrl: string;
  cancelUrl: string;
}

export interface HostedCheckoutSession {
  provider: 'PAYMONGO';
  environment: 'TEST';
  providerSessionId: string;
  checkoutUrl: string;
  livemode: false;
  entitlementGranted: false;
}

export interface BillingGateway {
  createHostedCheckout(request: HostedCheckoutRequest): Promise<HostedCheckoutSession>;
}

export interface BillingHttpRequest {
  method: 'POST';
  url: string;
  headers: Readonly<Record<string, string>>;
  body: string;
  timeoutMs: number;
  maxResponseBytes: number;
  redirect: 'error';
}

export interface BillingHttpResponse {
  status: number;
  body: Uint8Array;
}

export interface BillingHttpTransport {
  send(request: BillingHttpRequest): Promise<BillingHttpResponse>;
}

export interface CheckoutPrice {
  id: string;
  productCode: string;
  displayName: string;
  amountMinor: number;
  currency: 'PHP';
  environment: 'TEST';
  active: true;
}

export type CheckoutIntentClaim =
  | { decision: 'CREATE'; referenceNumber: string; providerIdempotencyKey: string; claimToken: string }
  | { decision: 'REPLAY'; session: HostedCheckoutSession }
  | { decision: 'CONFLICT' }
  | { decision: 'IN_PROGRESS' }
  | { decision: 'FAILED'; failureCode: string };

export interface CheckoutIntentRepository {
  findEligiblePrice(input: {
    userId: string;
    priceCode: string;
    environment: 'TEST';
  }): Promise<CheckoutPrice | null>;
  claim(input: {
    userId: string;
    priceId: string;
    requestIdempotencyKey: string;
    requestHash: string;
  }): Promise<CheckoutIntentClaim>;
  complete(input: {
    userId: string;
    priceId: string;
    requestIdempotencyKey: string;
    claimToken: string;
    session: HostedCheckoutSession;
  }): Promise<void>;
  release(input: {
    userId: string;
    priceId: string;
    requestIdempotencyKey: string;
    claimToken: string;
    failureCode: string;
  }): Promise<void>;
}

export interface WebhookInboxRecord {
  provider: 'PAYMONGO';
  environment: 'TEST' | 'LIVE';
  providerEventId: string;
  eventType: string;
  livemode: boolean;
  payloadHash: string;
  providerCreatedAt: Date;
  receivedAt: Date;
  signatureKeyVersion: string;
  resource: { id: string; type: string };
  disposition: 'PENDING' | 'IGNORED_UNKNOWN';
}

export type WebhookIngestDecision = 'INSERTED' | 'DUPLICATE' | 'CONFLICT' | 'OUT_OF_ORDER';

export interface WebhookInboxRepository {
  /** Atomically compares provider/environment/event ID and payload hash, then inserts the immutable envelope and pending work item. */
  ingest(record: WebhookInboxRecord): Promise<WebhookIngestDecision>;
}

export interface ReconciledPaymongoCheckout {
  provider: 'PAYMONGO';
  environment: 'TEST';
  livemode: false;
  providerSessionId: string;
  referenceNumber: string;
  paymentStatus: 'PAID' | 'UNPAID' | 'FAILED' | 'UNKNOWN';
  paymentIntentStatus: 'SUCCEEDED' | 'PROCESSING' | 'FAILED' | 'UNKNOWN';
  providerPaymentIntentId: string;
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  paidAt: Date;
  providerUpdatedAt: Date;
}

export interface CheckoutReconciliationGateway {
  /** Retrieve one exact Checkout session. Implementations must return an allowlisted projection only. */
  retrieveCheckoutSession(providerSessionId: string): Promise<ReconciledPaymongoCheckout>;
}

export interface PaymentProjectionBinding {
  checkoutFound: boolean;
  processingId: string;
  claimToken: string;
  webhookEventId: string;
  providerEventId: string;
  eventType: string;
  eventLivemode: boolean;
  eventProviderCreatedAt: Date;
  eventReceivedAt: Date;
  providerSessionId: string;
  checkoutRequestId: string;
  checkoutUserId: string | null;
  userEligible: boolean;
  billingSubjectKey: string;
  billingPriceId: string;
  productCode: string;
  productStatus: 'ACTIVE' | 'INACTIVE';
  priceEnvironment: 'TEST' | 'LIVE';
  priceAmountMinor: number;
  priceCurrency: string;
  priceInterval: 'MONTH';
  priceIntervalCount: number;
  checkoutStatus: 'CLAIMED' | 'RETRYABLE' | 'FAILED' | 'SUCCEEDED';
  requestHash: string;
  referenceNumber: string;
  checkoutCreatedAt: Date;
  checkoutCompletedAt: Date | null;
  latestProviderUpdatedAt: Date | null;
}

export type PaymentProjectionClaim =
  | { decision: 'NO_WORK' }
  | { decision: 'CLAIMED'; binding: PaymentProjectionBinding };

export interface PaymentProjectionResult {
  subscriptionId: string;
  invoiceId: string;
  paymentAttemptId: string;
  transactionId: string;
  entitlementGrantId: string;
  effectiveFrom: Date;
  effectiveUntil: Date;
  replayed: boolean;
}

export interface PaymentProjectionRepository {
  claimNext(): Promise<PaymentProjectionClaim>;
  project(
    binding: PaymentProjectionBinding,
    evidence: ReconciledPaymongoCheckout,
    period: { effectiveFrom: Date; effectiveUntil: Date },
  ): Promise<PaymentProjectionResult>;
  fail(
    binding: PaymentProjectionBinding,
    failure: { code: string; retryable: boolean; details?: Readonly<Record<string, string>> },
  ): Promise<void>;
}
