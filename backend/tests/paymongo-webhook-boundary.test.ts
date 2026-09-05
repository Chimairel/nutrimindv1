import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import test from 'node:test';
import { WebhookInboxRecord, WebhookInboxRepository, WebhookIngestDecision } from '../src/billing/contracts';
import { EnabledPaymongoConfig, loadPaymongoConfig } from '../src/domain/paymongo-config.policy';
import {
  PAYMONGO_EVENT_ALLOW_LIST,
  PaymongoWebhookBoundary,
  WebhookBoundaryError,
  verifyPaymongoSignature,
} from '../src/services/paymongo-webhook-boundary.service';

const NOW_SECONDS = 1_800_000_000;

function enabledConfig(): EnabledPaymongoConfig {
  return loadPaymongoConfig({
    NODE_ENV: 'test',
    PAYMONGO_INTEGRATION_ENABLED: 'true',
    PAYMONGO_ENVIRONMENT: 'TEST',
    PAYMONGO_SECRET_KEY: `sk_${'test'}_${'a'.repeat(24)}`,
    PAYMONGO_WEBHOOK_SECRET: `whsk_${'b'.repeat(24)}`,
    PAYMONGO_WEBHOOK_SECRET_VERSION: 'sandbox-v1',
    PAYMONGO_CHECKOUT_SUCCESS_URL: 'https://nutrimind.example.invalid/billing/success',
    PAYMONGO_CHECKOUT_CANCEL_URL: 'https://nutrimind.example.invalid/billing/cancel',
  }) as EnabledPaymongoConfig;
}

function body(eventType = 'checkout_session.payment.paid', livemode = false): Buffer {
  return Buffer.from(JSON.stringify({
    data: {
      id: 'evt_synthetic_12345678',
      type: 'event',
      attributes: {
        type: eventType,
        livemode,
        created_at: NOW_SECONDS - 30,
        data: { id: 'cs_synthetic_12345678', type: 'checkout_session', attributes: { ignored: 'provider payload' } },
      },
    },
  }, null, 2));
}

function signature(raw: Buffer, mode: 'TEST' | 'LIVE' = 'TEST', timestamp = NOW_SECONDS): string {
  const secret = enabledConfig().webhookSecret;
  const digest = createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest('hex');
  return `t=${timestamp},te=${mode === 'TEST' ? digest : ''},li=${mode === 'LIVE' ? digest : ''}`;
}

class FakeWebhookRepository implements WebhookInboxRepository {
  decision: WebhookIngestDecision = 'INSERTED';
  record?: WebhookInboxRecord;
  async ingest(record: WebhookInboxRecord) {
    this.record = record;
    return this.decision;
  }
}

function service(repository: WebhookInboxRepository = new FakeWebhookRepository()) {
  return new PaymongoWebhookBoundary(enabledConfig(), repository, () => new Date(NOW_SECONDS * 1000));
}

test('[TEST-088] test signatures verify over the exact raw bytes and produce a minimal sanitized inbox record', async () => {
  const raw = body();
  const repository = new FakeWebhookRepository();
  const result = await service(repository).ingest(raw, signature(raw));
  assert.deepEqual(result, { decision: 'INSERTED', knownEvent: true, entitlementGranted: false });
  assert.equal(repository.record?.payloadHash, createHash('sha256').update(raw).digest('hex'));
  assert.equal(repository.record?.environment, 'TEST');
  assert.equal(repository.record?.disposition, 'PENDING');
  assert.deepEqual(repository.record?.resource, { id: 'cs_synthetic_12345678', type: 'checkout_session' });
  assert.equal(Object.prototype.hasOwnProperty.call(repository.record || {}, 'rawBody'), false);
  assert.equal(JSON.stringify(repository.record).includes('provider payload'), false);
});

test('[TEST-088] raw-body tampering fails signature verification before repository access', async () => {
  const original = body();
  const tampered = Buffer.concat([original, Buffer.from(' ')]);
  const repository = new FakeWebhookRepository();
  await assert.rejects(() => service(repository).ingest(tampered, signature(original)),
    (error: unknown) => error instanceof WebhookBoundaryError && error.code === 'WEBHOOK_SIGNATURE_INVALID');
  assert.equal(repository.record, undefined);
});

test('[TEST-088] missing-mode, malformed, duplicate-part, and incorrect signatures fail closed', async () => {
  const raw = body();
  for (const header of [
    `t=${NOW_SECONDS},te=,li=`,
    `t=${NOW_SECONDS},te=${'0'.repeat(64)},li=`,
    `t=${NOW_SECONDS},t=${NOW_SECONDS},te=${'0'.repeat(64)},li=`,
    `timestamp=${NOW_SECONDS},te=${'0'.repeat(64)},li=`,
  ]) {
    await assert.rejects(() => service().ingest(raw, header), /WEBHOOK_SIGNATURE_INVALID/);
  }
});

test('[TEST-088] stale and excessively future timestamps are rejected with bounded tolerance', async () => {
  const raw = body();
  await assert.rejects(() => service().ingest(raw, signature(raw, 'TEST', NOW_SECONDS - 301)), /WEBHOOK_SIGNATURE_STALE/);
  await assert.rejects(() => service().ingest(raw, signature(raw, 'TEST', NOW_SECONDS + 301)), /WEBHOOK_SIGNATURE_STALE/);
});

test('[TEST-088] signature selection distinguishes official test and live header slots', () => {
  const raw = body();
  const config = enabledConfig();
  assert.doesNotThrow(() => verifyPaymongoSignature({
    rawBody: raw,
    signatureHeader: signature(raw, 'TEST'),
    environment: 'TEST',
    secret: config.webhookSecret,
    now: new Date(NOW_SECONDS * 1000),
    toleranceSeconds: 300,
  }));
  assert.doesNotThrow(() => verifyPaymongoSignature({
    rawBody: raw,
    signatureHeader: signature(raw, 'LIVE'),
    environment: 'LIVE',
    secret: config.webhookSecret,
    now: new Date(NOW_SECONDS * 1000),
    toleranceSeconds: 300,
  }));
  assert.throws(() => verifyPaymongoSignature({
    rawBody: raw,
    signatureHeader: signature(raw, 'LIVE'),
    environment: 'TEST',
    secret: config.webhookSecret,
    now: new Date(NOW_SECONDS * 1000),
    toleranceSeconds: 300,
  }), /WEBHOOK_SIGNATURE_INVALID/);
});

test('[TEST-088] validly signed live events cannot enter the forced TEST inbox', async () => {
  const raw = body('checkout_session.payment.paid', true);
  const repository = new FakeWebhookRepository();
  await assert.rejects(() => service(repository).ingest(raw, signature(raw)), /WEBHOOK_ENVIRONMENT_MISMATCH/);
  assert.equal(repository.record, undefined);
});

test('[TEST-088] malformed signed envelopes fail closed after signature verification', async () => {
  const raw = Buffer.from('{"data":{"id":"evt_missing_attributes"}}');
  await assert.rejects(() => service().ingest(raw, signature(raw)), /WEBHOOK_BODY_INVALID/);
});

test('[TEST-088] explicit event allow-list excludes unrelated valid provider events', () => {
  assert.equal(PAYMONGO_EVENT_ALLOW_LIST.has('checkout_session.payment.paid'), true);
  assert.equal(PAYMONGO_EVENT_ALLOW_LIST.has('subscription.invoice.paid'), true);
  assert.equal(PAYMONGO_EVENT_ALLOW_LIST.has('payment.paid'), false);
  assert.equal(PAYMONGO_EVENT_ALLOW_LIST.has('payout.deposited'), false);
});

test('[TEST-088] unknown valid event types are acknowledged only as ignored quarantine records', async () => {
  const raw = body('merchant.activated');
  const repository = new FakeWebhookRepository();
  const result = await service(repository).ingest(raw, signature(raw));
  assert.equal(result.knownEvent, false);
  assert.equal(result.entitlementGranted, false);
  assert.equal(repository.record?.disposition, 'IGNORED_UNKNOWN');
});

test('[TEST-088] exact duplicate and out-of-order decisions have no entitlement effect', async () => {
  for (const decision of ['DUPLICATE', 'OUT_OF_ORDER'] as const) {
    const raw = body();
    const repository = new FakeWebhookRepository();
    repository.decision = decision;
    const result = await service(repository).ingest(raw, signature(raw));
    assert.equal(result.decision, decision);
    assert.equal(result.entitlementGranted, false);
  }
});

test('[TEST-088] reused event IDs with a different payload hash fail as conflicts', async () => {
  const raw = body();
  const repository = new FakeWebhookRepository();
  repository.decision = 'CONFLICT';
  await assert.rejects(() => service(repository).ingest(raw, signature(raw)), /WEBHOOK_EVENT_CONFLICT/);
});

test('[TEST-088] disabled and unavailable inboxes return stable errors without raw payload detail', async () => {
  const raw = body();
  await assert.rejects(
    () => new PaymongoWebhookBoundary({ enabled: false, environment: 'TEST' }, new FakeWebhookRepository()).ingest(raw, signature(raw)),
    /WEBHOOK_UNAVAILABLE/,
  );
  const repository: WebhookInboxRepository = { async ingest() { throw new Error('database connection detail'); } };
  let caught: unknown;
  try {
    await service(repository).ingest(raw, signature(raw));
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof WebhookBoundaryError);
  assert.equal(caught.code, 'WEBHOOK_INGESTION_UNAVAILABLE');
  assert.doesNotMatch(caught.message, /database connection detail/);
});

test('[TEST-088] empty and oversized bodies fail before signature or repository work', async () => {
  await assert.rejects(() => service().ingest(Buffer.alloc(0), ''), /WEBHOOK_BODY_INVALID/);
  await assert.rejects(() => service().ingest(Buffer.alloc(65_537), ''), /WEBHOOK_BODY_INVALID/);
});
