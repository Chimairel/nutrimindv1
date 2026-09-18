import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import cors from 'cors';
import { createCorsOptions } from '../src/config/cors';
import { errorHandler } from '../src/middleware/errorHandler';

test('tunnel POSTs require an exact origin and return an actionable error through the proxy', async () => {
  const allowed = 'https://demo-example.trycloudflare.com';
  const app = express();
  app.use(cors(createCorsOptions(['http://localhost:3000', allowed])));
  app.post('/api/nutritionist-applications', (_req, res) => res.sendStatus(204));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/api/nutritionist-applications`;
  try {
    const denied = await fetch(url, { method: 'POST', headers: { Origin: 'https://different.trycloudflare.com' } });
    assert.equal(denied.status, 403);
    const body = (await denied.json()) as { errorCode: string };
    assert.equal(body.errorCode, 'ORIGIN_NOT_ALLOWED');
    for (const origin of [allowed, 'http://localhost:3000']) {
      const response = await fetch(url, { method: 'POST', headers: { Origin: origin } });
      assert.equal(response.status, 204);
      assert.equal(response.headers.get('access-control-allow-origin'), origin);
      assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    }
    assert.equal((await fetch(url, { method: 'POST' })).status, 204);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
