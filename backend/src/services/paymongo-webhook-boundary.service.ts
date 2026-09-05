import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { WebhookInboxRecord, WebhookInboxRepository, WebhookIngestDecision } from '@/billing/contracts';
import { PaymongoConfig } from '@/domain/paymongo-config.policy';

export const PAYMONGO_EVENT_ALLOW_LIST = new Set([
  'checkout_session.payment.paid',
  'subscription.activated',
  'subscription.past_due',
  'subscription.unpaid',
  'subscription.updated',
  'subscription.invoice.created',
  'subscription.invoice.finalized',
  'subscription.invoice.paid',
  'subscription.invoice.payment_failed',
  'subscription.invoice.updated',
]);

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,190}$/;
const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9_.]{2,119}$/;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/;

export type WebhookBoundaryErrorCode =
  | 'WEBHOOK_UNAVAILABLE'
  | 'WEBHOOK_SIGNATURE_INVALID'
  | 'WEBHOOK_SIGNATURE_STALE'
  | 'WEBHOOK_BODY_INVALID'
  | 'WEBHOOK_ENVIRONMENT_MISMATCH'
  | 'WEBHOOK_EVENT_CONFLICT'
  | 'WEBHOOK_INGESTION_UNAVAILABLE';

export class WebhookBoundaryError extends Error {
  constructor(readonly code: WebhookBoundaryErrorCode) {
    super(code);
    this.name = 'WebhookBoundaryError';
  }
}

interface ParsedSignature {
  timestamp: number;
  signature: string;
}

function parseSignatureHeader(header: string, environment: 'TEST' | 'LIVE'): ParsedSignature {
  if (header.length === 0 || header.length > 512) {
    throw new WebhookBoundaryError('WEBHOOK_SIGNATURE_INVALID');
  }
  const values = new Map<string, string>();
  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator < 1) throw new WebhookBoundaryError('WEBHOOK_SIGNATURE_INVALID');
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!['t', 'te', 'li'].includes(key) || values.has(key)) {
      throw new WebhookBoundaryError('WEBHOOK_SIGNATURE_INVALID');
    }
    values.set(key, value);
  }
  if (values.size !== 3 || !/^\d{1,12}$/.test(values.get('t') || '')) {
    throw new WebhookBoundaryError('WEBHOOK_SIGNATURE_INVALID');
  }
  const signature = values.get(environment === 'TEST' ? 'te' : 'li') || '';
  if (!SIGNATURE_PATTERN.test(signature)) throw new WebhookBoundaryError('WEBHOOK_SIGNATURE_INVALID');
  return { timestamp: Number(values.get('t')), signature };
}

export function verifyPaymongoSignature(input: {
  rawBody: Buffer;
  signatureHeader: string;
  environment: 'TEST' | 'LIVE';
  secret: string;
  now: Date;
  toleranceSeconds: number;
}): void {
  const parsed = parseSignatureHeader(input.signatureHeader, input.environment);
  const nowSeconds = Math.floor(input.now.getTime() / 1000);
  if (!Number.isSafeInteger(parsed.timestamp) || Math.abs(nowSeconds - parsed.timestamp) > input.toleranceSeconds) {
    throw new WebhookBoundaryError('WEBHOOK_SIGNATURE_STALE');
  }
  const expected = createHmac('sha256', input.secret)
    .update(String(parsed.timestamp), 'utf8')
    .update('.', 'utf8')
    .update(input.rawBody)
    .digest();
  const supplied = Buffer.from(parsed.signature, 'hex');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new WebhookBoundaryError('WEBHOOK_SIGNATURE_INVALID');
  }
}

function parseEnvelope(rawBody: Buffer): {
  providerEventId: string;
  eventType: string;
  livemode: boolean;
  providerCreatedAt: Date;
  resource: { id: string; type: string };
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(rawBody));
  } catch {
    throw new WebhookBoundaryError('WEBHOOK_BODY_INVALID');
  }
  if (!parsed || typeof parsed !== 'object') throw new WebhookBoundaryError('WEBHOOK_BODY_INVALID');
  const data = (parsed as Record<string, unknown>).data;
  if (!data || typeof data !== 'object') throw new WebhookBoundaryError('WEBHOOK_BODY_INVALID');
  const event = data as Record<string, unknown>;
  const attributes = event.attributes;
  if (event.type !== 'event' || !IDENTIFIER_PATTERN.test(String(event.id || '')) || !attributes || typeof attributes !== 'object') {
    throw new WebhookBoundaryError('WEBHOOK_BODY_INVALID');
  }
  const values = attributes as Record<string, unknown>;
  const resource = values.data;
  if (!EVENT_TYPE_PATTERN.test(String(values.type || '')) || typeof values.livemode !== 'boolean' ||
      !Number.isSafeInteger(values.created_at) || Number(values.created_at) <= 0 ||
      !resource || typeof resource !== 'object') {
    throw new WebhookBoundaryError('WEBHOOK_BODY_INVALID');
  }
  const resourceValues = resource as Record<string, unknown>;
  if (!IDENTIFIER_PATTERN.test(String(resourceValues.id || '')) || !IDENTIFIER_PATTERN.test(String(resourceValues.type || ''))) {
    throw new WebhookBoundaryError('WEBHOOK_BODY_INVALID');
  }
  const providerCreatedAt = new Date(Number(values.created_at) * 1000);
  if (Number.isNaN(providerCreatedAt.getTime())) throw new WebhookBoundaryError('WEBHOOK_BODY_INVALID');
  return {
    providerEventId: String(event.id),
    eventType: String(values.type),
    livemode: values.livemode,
    providerCreatedAt,
    resource: { id: String(resourceValues.id), type: String(resourceValues.type) },
  };
}

export type WebhookBoundaryResult = {
  decision: WebhookIngestDecision;
  knownEvent: boolean;
  entitlementGranted: false;
};

export class PaymongoWebhookBoundary {
  constructor(
    private readonly config: PaymongoConfig,
    private readonly repository: WebhookInboxRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async ingest(rawBody: Buffer, signatureHeader: string): Promise<WebhookBoundaryResult> {
    if (!this.config.enabled) throw new WebhookBoundaryError('WEBHOOK_UNAVAILABLE');
    if (!Buffer.isBuffer(rawBody) || rawBody.length === 0 || rawBody.length > this.config.webhookBodyLimitBytes) {
      throw new WebhookBoundaryError('WEBHOOK_BODY_INVALID');
    }
    verifyPaymongoSignature({
      rawBody,
      signatureHeader,
      environment: this.config.environment,
      secret: this.config.webhookSecret,
      now: this.clock(),
      toleranceSeconds: this.config.signatureToleranceSeconds,
    });
    const envelope = parseEnvelope(rawBody);
    if (envelope.livemode !== false) throw new WebhookBoundaryError('WEBHOOK_ENVIRONMENT_MISMATCH');

    const knownEvent = PAYMONGO_EVENT_ALLOW_LIST.has(envelope.eventType);
    const record: WebhookInboxRecord = {
      provider: 'PAYMONGO',
      environment: 'TEST',
      providerEventId: envelope.providerEventId,
      eventType: envelope.eventType,
      livemode: envelope.livemode,
      payloadHash: createHash('sha256').update(rawBody).digest('hex'),
      providerCreatedAt: envelope.providerCreatedAt,
      receivedAt: this.clock(),
      signatureKeyVersion: this.config.webhookSecretVersion,
      resource: envelope.resource,
      disposition: knownEvent ? 'PENDING' : 'IGNORED_UNKNOWN',
    };
    let decision: WebhookIngestDecision;
    try {
      decision = await this.repository.ingest(record);
    } catch {
      throw new WebhookBoundaryError('WEBHOOK_INGESTION_UNAVAILABLE');
    }
    if (decision === 'CONFLICT') throw new WebhookBoundaryError('WEBHOOK_EVENT_CONFLICT');
    return { decision, knownEvent, entitlementGranted: false };
  }
}
