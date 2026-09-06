import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { request } from 'node:https';
import { dirname } from 'node:path';

const API_HOST = 'api.paymongo.com';
const EVENT = 'checkout_session.payment.paid';
const MAX_RESPONSE_BYTES = 64 * 1024;

type State = {
  webhookId: string;
  webhookSecret: string;
  endpointUrl: string;
  createdAt: string;
};

function argument(name: string): string {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}.`);
  return process.argv[index + 1];
}

function secretKey(): string {
  const value = process.env.PAYMONGO_SECRET_KEY || '';
  if (!/^sk_test_[A-Za-z0-9_-]{16,}$/.test(value)) throw new Error('A valid TEST secret key is required.');
  return value;
}

function callPaymongo(method: 'POST' | 'DELETE', path: string, body?: string): Promise<{ status: number; json: unknown }> {
  return new Promise((resolve, reject) => {
    const req = request({
      protocol: 'https:',
      hostname: API_HOST,
      port: 443,
      method,
      path,
      headers: {
        accept: 'application/json',
        authorization: `Basic ${Buffer.from(`${secretKey()}:`).toString('base64')}`,
        ...(body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}),
      },
      timeout: 15_000,
    }, (response) => {
      const chunks: Buffer[] = [];
      let length = 0;
      response.on('data', (chunk: Buffer) => {
        length += chunk.length;
        if (length > MAX_RESPONSE_BYTES) req.destroy(new Error('Provider response exceeded the limit.'));
        else chunks.push(chunk);
      });
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json: unknown = {};
        if (raw) {
          try { json = JSON.parse(raw); } catch { return reject(new Error('Provider returned invalid JSON.')); }
        }
        resolve({ status: response.statusCode || 0, json });
      });
    });
    req.once('timeout', () => req.destroy(new Error('Provider request timed out.')));
    req.once('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function parseWebhook(json: unknown): State & { livemode: false; events: string[]; status: string } {
  if (!json || typeof json !== 'object') throw new Error('Webhook response shape was invalid.');
  const data = (json as { data?: unknown }).data;
  if (!data || typeof data !== 'object') throw new Error('Webhook response data was invalid.');
  const attributes = (data as { attributes?: unknown }).attributes;
  if (!attributes || typeof attributes !== 'object') throw new Error('Webhook response attributes were invalid.');
  const values = attributes as Record<string, unknown>;
  const webhookId = String((data as { id?: unknown }).id || '');
  const webhookSecret = String(values.secret_key || '');
  const endpointUrl = String(values.url || '');
  const events = values.events;
  if (!/^hook_[A-Za-z0-9_-]+$/.test(webhookId) || !/^whsk_[A-Za-z0-9_-]{16,}$/.test(webhookSecret) ||
      values.livemode !== false || !Array.isArray(events) || events.length !== 1 || events[0] !== EVENT ||
      !endpointUrl.startsWith('https://') || !['enabled', 'disabled'].includes(String(values.status))) {
    throw new Error('Webhook response failed TEST allow-list validation.');
  }
  return { webhookId, webhookSecret, endpointUrl, events: [EVENT], livemode: false, status: String(values.status), createdAt: new Date().toISOString() };
}

async function create(): Promise<void> {
  const endpointUrl = argument('--url');
  const statePath = argument('--state');
  const parsed = new URL(endpointUrl);
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.trycloudflare.com') || parsed.pathname !== '/api/webhooks/paymongo') {
    throw new Error('The webhook URL must be the exact temporary HTTPS endpoint.');
  }
  const body = JSON.stringify({ data: { attributes: { url: endpointUrl, events: [EVENT] } } });
  const response = await callPaymongo('POST', '/v1/webhooks', body);
  if (response.status !== 200) throw new Error(`Webhook creation failed with status ${response.status}.`);
  const webhook = parseWebhook(response.json);
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify({
    webhookId: webhook.webhookId,
    webhookSecret: webhook.webhookSecret,
    endpointUrl: webhook.endpointUrl,
    createdAt: webhook.createdAt,
  }), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  process.stdout.write(`${JSON.stringify({ webhookId: webhook.webhookId, livemode: false, events: webhook.events, status: webhook.status })}\n`);
}

async function cleanup(): Promise<void> {
  const statePath = argument('--state');
  const state = JSON.parse(readFileSync(statePath, 'utf8')) as State;
  if (!/^hook_[A-Za-z0-9_-]+$/.test(state.webhookId)) throw new Error('Stored webhook ID is invalid.');
  const deleted = await callPaymongo('DELETE', `/v1/webhooks/${encodeURIComponent(state.webhookId)}`);
  if (deleted.status >= 200 && deleted.status <= 209) {
    process.stdout.write(`${JSON.stringify({ webhookId: state.webhookId, cleanup: 'DELETED' })}\n`);
    return;
  }
  if (![404, 405].includes(deleted.status)) throw new Error(`Webhook deletion failed with status ${deleted.status}.`);
  const disabled = await callPaymongo('POST', `/v1/webhooks/${encodeURIComponent(state.webhookId)}/disable`);
  if (disabled.status !== 200) throw new Error(`Webhook disable fallback failed with status ${disabled.status}.`);
  const verified = parseWebhook(disabled.json);
  if (verified.status !== 'disabled') throw new Error('Webhook disable fallback was not confirmed.');
  process.stdout.write(`${JSON.stringify({ webhookId: state.webhookId, cleanup: 'DISABLED_API_HAS_NO_DELETE' })}\n`);
}

const action = process.argv[2];
(action === 'create' ? create() : action === 'cleanup' ? cleanup() : Promise.reject(new Error('Use create or cleanup.')))
  .catch(() => {
    process.stderr.write('PAYMONGO_WEBHOOK_ADMIN_FAILED\n');
    process.exitCode = 1;
  });
