import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { NodeHttpsBillingTransport } from '../src/services/node-https-billing.transport';

const schema = readFileSync(resolve(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const migration = readFileSync(
  resolve(process.cwd(), 'prisma/migrations/20260906193000_paymongo_sandbox_checkout/migration.sql'),
  'utf8',
);

test('[TEST-100] checkout persistence is additive, TEST-only, owner-scoped, and auditable', () => {
  assert.match(schema, /model BillingCheckoutRequest \{/);
  assert.match(schema, /model BillingCheckoutAuditEvent \{/);
  assert.match(migration, /CREATE TABLE "BillingCheckoutRequest"/);
  assert.match(migration, /CREATE TABLE "BillingCheckoutAuditEvent"/);
  assert.match(migration, /BillingCheckoutRequest_userId_requestIdempotencyKey_key/);
  assert.match(migration, /BillingCheckoutRequest_provider_environment_providerIdempot/);
  assert.match(migration, /BillingCheckoutRequest_test_only/);
  assert.match(migration, /BillingCheckoutRequest_state_shape/);
  assert.match(migration, /BillingCheckoutAuditEvent_failure_shape/);
  assert.match(migration, /BillingCheckoutRequest_userId_fkey[\s\S]*?ON DELETE SET NULL/);
  assert.doesNotMatch(migration, /^\s*(DROP|DELETE|UPDATE|INSERT|TRUNCATE)\b/im);
  assert.doesNotMatch(schema, /cardNumber|cardCvc|cvv|rawProvider|authorizationHeader/i);
});

test('[TEST-100] native transport rejects non-HTTPS targets before network access', async () => {
  const transport = new NodeHttpsBillingTransport();
  await assert.rejects(() => transport.send({
    method: 'POST',
    url: 'http://127.0.0.1:9/checkout',
    headers: {},
    body: '{}',
    timeoutMs: 50,
    maxResponseBytes: 64,
    redirect: 'error',
  }), /rejected the request target/);
});

test('[TEST-100] runtime wires real checkout adapters only behind the checkout switch', () => {
  const runtime = readFileSync(resolve(process.cwd(), 'src/billing/runtime.ts'), 'utf8');
  assert.match(runtime, /paymongoConfig\.checkout\.enabled/);
  assert.match(runtime, /new PrismaCheckoutIntentRepository\(prisma\)/);
  assert.match(runtime, /new PaymongoGateway\(paymongoConfig\.checkout, new NodeHttpsBillingTransport\(\)\)/);
  assert.match(runtime, /paymongoConfig\.webhook/);
});
