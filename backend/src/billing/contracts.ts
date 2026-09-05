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
  | { decision: 'CREATE'; referenceNumber: string; providerIdempotencyKey: string }
  | { decision: 'REPLAY'; session: HostedCheckoutSession }
  | { decision: 'CONFLICT' };

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
    session: HostedCheckoutSession;
  }): Promise<void>;
  release(input: {
    userId: string;
    priceId: string;
    requestIdempotencyKey: string;
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
