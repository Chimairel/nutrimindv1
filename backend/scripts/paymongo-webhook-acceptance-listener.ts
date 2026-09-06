import 'dotenv/config';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { loadPaymongoConfig } from '@/domain/paymongo-config.policy';
import { paymongoRawBodyErrorHandler, paymongoRawBodyParser } from '@/routes/paymongo-webhook.routes';
import { PaymongoWebhookBoundary, WebhookBoundaryError } from '@/services/paymongo-webhook-boundary.service';
import { PrismaWebhookInboxRepository } from '@/services/prisma-webhook-inbox.repository';

type SecretState = { webhookSecret: string };

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}.`);
  return process.argv[index + 1];
}

const statePath = argument('--state');
const evidencePath = argument('--evidence');
const port = Number(argument('--port'));
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid listener port.');
const database = new URL(process.env.DATABASE_URL || '');
if (!['localhost', '127.0.0.1', '::1'].includes(database.hostname)) throw new Error('A loopback PostgreSQL database is required.');

const prisma = new PrismaClient();
const repository = new PrismaWebhookInboxRepository(prisma);
const app = express();

app.get('/health', (_request, response) => response.status(200).json({ success: true }));
app.post('/api/webhooks/paymongo', paymongoRawBodyParser, paymongoRawBodyErrorHandler, async (request: Request, response: Response) => {
  const contentType = request.header('content-type')?.split(';', 1)[0].trim().toLowerCase();
  const signature = request.header('paymongo-signature');
  if (contentType !== 'application/json' || !signature || !Buffer.isBuffer(request.body)) {
    return response.status(401).json({ success: false, errorCode: 'WEBHOOK_SIGNATURE_INVALID' });
  }
  try {
    const state = JSON.parse(readFileSync(statePath, 'utf8')) as SecretState;
    const config = loadPaymongoConfig({
      NODE_ENV: 'test',
      PAYMONGO_WEBHOOK_ENABLED: 'true',
      PAYMONGO_ENVIRONMENT: 'TEST',
      PAYMONGO_WEBHOOK_SECRET: state.webhookSecret,
      PAYMONGO_WEBHOOK_SECRET_VERSION: 'ephemeral-test-acceptance-v1',
    });
    assert.equal(config.webhook.enabled, true);
    const boundary = new PaymongoWebhookBoundary(config.webhook, repository);
    const first = await boundary.ingest(request.body, signature);
    let exactReplayVerified = false;
    if (first.decision === 'INSERTED' && first.knownEvent) {
      const replay = await boundary.ingest(request.body, signature);
      assert.equal(replay.decision, 'DUPLICATE');
      exactReplayVerified = true;
    }
    writeFileSync(evidencePath, JSON.stringify({
      actualSignedDeliveryAccepted: first.knownEvent && ['INSERTED', 'DUPLICATE'].includes(first.decision),
      firstDecision: first.decision,
      exactRawReplayVerified: exactReplayVerified || first.decision === 'DUPLICATE',
      entitlementGranted: false,
      acceptedAt: new Date().toISOString(),
    }), { encoding: 'utf8', mode: 0o600 });
    return response.status(first.decision === 'DUPLICATE' ? 200 : 202).json({
      success: true,
      status: first.decision === 'DUPLICATE' ? 'DUPLICATE' : 'ACCEPTED_PENDING',
      entitlementGranted: false,
    });
  } catch (error) {
    const code = error instanceof WebhookBoundaryError ? error.code : 'WEBHOOK_INGESTION_UNAVAILABLE';
    const status = code.startsWith('WEBHOOK_SIGNATURE') ? 401 : code === 'WEBHOOK_EVENT_CONFLICT' ? 409 : 503;
    return response.status(status).json({ success: false, errorCode: code });
  }
});
app.use((_request, response) => response.status(404).json({ success: false }));

const server = app.listen(port, '0.0.0.0', () => process.stdout.write(`WEBHOOK_LISTENER_READY:${port}\n`));
async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
