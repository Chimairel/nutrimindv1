import assert from 'node:assert/strict';
import test from 'node:test';
import { Response } from 'express';
import { parseRuntimeEnvironment } from '../src/config/env';
import { AppError } from '../src/errors/AppError';
import { sendApiError } from '../src/lib/http-response';
import { logger } from '../src/lib/logger';

test('[TEST-143] runtime configuration applies typed, safe development defaults', () => {
  const config = parseRuntimeEnvironment({ NODE_ENV: 'test' });
  assert.equal(config.PORT, 5000);
  assert.equal(config.TRUST_PROXY, false);
  assert.equal(config.SMTP_VERIFY_ON_STARTUP, false);
  assert.deepEqual(config.allowedCorsOrigins, ['http://localhost:3000', 'http://localhost:3001']);
  assert.ok(Object.isFrozen(config));
});

test('[TEST-144] runtime configuration rejects malformed typed values', () => {
  assert.throws(() => parseRuntimeEnvironment({ NODE_ENV: 'test', PORT: '70000' }), /Invalid runtime configuration/);
  assert.throws(() => parseRuntimeEnvironment({ NODE_ENV: 'test', TRUST_PROXY: 'yes' }), /TRUST_PROXY/);
  assert.throws(() => parseRuntimeEnvironment({ NODE_ENV: 'test', FRONTEND_URL: 'not a url' }), /FRONTEND_URL/);
});

test('[TEST-145] runtime configuration normalizes explicit CORS origins', () => {
  const config = parseRuntimeEnvironment({
    NODE_ENV: 'test',
    CORS_ORIGINS: 'https://app.example.com/, https://admin.example.com',
  });
  assert.deepEqual(config.allowedCorsOrigins, ['https://app.example.com', 'https://admin.example.com']);
});

test('[TEST-146] structured logger redacts nested credentials', () => {
  const lines: string[] = [];
  const original = console.log;
  console.log = (line?: unknown) => lines.push(String(line));
  try {
    logger.info('redaction_test', {
      userId: 'user-1',
      authorization: 'Bearer private',
      nested: { apiKey: 'private-key', safe: 'visible' },
    });
  } finally {
    console.log = original;
  }
  const payload = JSON.parse(lines[0]) as Record<string, unknown>;
  assert.equal(payload.authorization, '[REDACTED]');
  assert.deepEqual(payload.nested, { apiKey: '[REDACTED]', safe: 'visible' });
  assert.equal(payload.userId, 'user-1');
});

test('[TEST-147] shared API errors expose a request id and stable error code', () => {
  let statusCode = 0;
  let body: unknown;
  const response = {
    locals: { requestId: 'request-123' },
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(value: unknown) {
      body = value;
      return this;
    },
  } as unknown as Response;

  sendApiError(response, 409, 'Conflict', 'CONFLICT');
  assert.equal(statusCode, 409);
  assert.deepEqual(body, {
    success: false,
    error: 'Conflict',
    errorCode: 'CONFLICT',
    requestId: 'request-123',
  });
  const error = new AppError('Nope', 403, 'FORBIDDEN');
  assert.equal(error.name, 'AppError');
  assert.equal(error.message, 'Nope');
  assert.equal(error.statusCode, 403);
  assert.equal(error.errorCode, 'FORBIDDEN');
});
