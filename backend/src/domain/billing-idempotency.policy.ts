export type BillingProvider = 'PAYMONGO';
export type BillingEnvironment = 'TEST' | 'LIVE';

export interface ProviderEventIdentity {
  provider: BillingProvider;
  environment: BillingEnvironment;
  providerEventId: string;
  payloadHash: string;
}

export type ProviderEventDecision =
  | { decision: 'INSERT'; eventKey: string }
  | { decision: 'DUPLICATE'; eventKey: string }
  | { decision: 'CONFLICT'; eventKey: string; reason: 'EVENT_ID_PAYLOAD_MISMATCH' };

const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,190}$/;
const OPERATION_PART_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

function assertProviderEventIdentity(event: ProviderEventIdentity): void {
  if (event.provider !== 'PAYMONGO') throw new TypeError('Unsupported billing provider.');
  if (event.environment !== 'TEST' && event.environment !== 'LIVE') {
    throw new TypeError('Unsupported billing environment.');
  }
  if (!IDENTIFIER_PATTERN.test(event.providerEventId)) {
    throw new TypeError('Provider event ID is invalid.');
  }
  if (!SHA256_PATTERN.test(event.payloadHash)) {
    throw new TypeError('Provider payload hash must be a lowercase SHA-256 hex digest.');
  }
}

export function buildProviderEventKey(event: ProviderEventIdentity): string {
  assertProviderEventIdentity(event);
  return `${event.provider}:${event.environment}:${event.providerEventId}`;
}

export function classifyProviderEvent(
  incoming: ProviderEventIdentity,
  existing?: ProviderEventIdentity | null,
): ProviderEventDecision {
  const eventKey = buildProviderEventKey(incoming);
  if (!existing) return { decision: 'INSERT', eventKey };

  const existingKey = buildProviderEventKey(existing);
  if (existingKey !== eventKey) {
    throw new Error('Existing provider event identity does not match the incoming event key.');
  }
  if (existing.payloadHash === incoming.payloadHash) {
    return { decision: 'DUPLICATE', eventKey };
  }
  return { decision: 'CONFLICT', eventKey, reason: 'EVENT_ID_PAYLOAD_MISMATCH' };
}

export function buildOperationIdempotencyKey(input: {
  operation: string;
  aggregateId: string;
  version: number;
}): string {
  if (!OPERATION_PART_PATTERN.test(input.operation)) {
    throw new TypeError('Operation is not a valid idempotency-key component.');
  }
  if (!OPERATION_PART_PATTERN.test(input.aggregateId)) {
    throw new TypeError('Aggregate ID is not a valid idempotency-key component.');
  }
  if (!Number.isSafeInteger(input.version) || input.version < 1) {
    throw new RangeError('Idempotency-key version must be a positive safe integer.');
  }
  const key = `nutrimind:${input.operation}:${input.aggregateId}:v${input.version}`;
  if (key.length > 160) throw new RangeError('Operation idempotency key exceeds the persistence limit.');
  return key;
}
