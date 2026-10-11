import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../src/types';

process.env.JWT_SECRET ||= 'test-only-access-secret';
process.env.JWT_REFRESH_SECRET ||= 'test-only-refresh-secret';

test('database failures do not invalidate a signed access session', async (t) => {
  const globals = globalThis as unknown as { prisma: unknown };
  const previous = globals.prisma;
  globals.prisma = {
    user: {
      findUnique: async () => {
        throw new Error('Database unavailable');
      },
    },
  };
  t.after(() => {
    globals.prisma = previous;
  });
  const { authenticate } = await import('../src/middleware/auth');
  const { signAccessToken } = await import('../src/lib/jwt');
  let status = 0;
  let payload: { errorCode?: string; requestId?: string } = {};
  const res = {
    locals: { requestId: 'outage-request' },
    status(value: number) {
      status = value;
      return this;
    },
    json(value: typeof payload) {
      payload = value;
      return this;
    },
  } as unknown as Response;
  const req = {
    headers: {
      authorization: `Bearer ${signAccessToken({ userId: 'test', email: 'test@example.com', role: 'USER' })}`,
    },
  } as AuthenticatedRequest;
  await authenticate(req, res, () => assert.fail('must not authorize during outage'));
  assert.equal(status, 503);
  assert.equal(payload.errorCode, 'SESSION_VERIFICATION_UNAVAILABLE');
  assert.equal(payload.requestId, 'outage-request');
  req.headers.authorization = 'Bearer invalid';
  await authenticate(req, res, () => assert.fail('must not authorize invalid token'));
  assert.equal(status, 401);
});
