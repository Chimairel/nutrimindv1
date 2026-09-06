import assert from 'node:assert/strict';
import test from 'node:test';
import { documentedRouteCount, openApiDocument } from '../src/docs/openapi';

test('[TEST-148] OpenAPI document covers every primary role and operational boundary', () => {
  assert.equal(openApiDocument.openapi, '3.1.0');
  assert.ok(documentedRouteCount >= 80);
  for (const path of [
    '/health',
    '/api/auth/register',
    '/api/user/meals/current',
    '/api/nutritionist/queue/{id}',
    '/api/admin/nutritionist-applications',
    '/api/billing/subscriptions',
    '/api/webhooks/paymongo',
  ]) {
    assert.ok(openApiDocument.paths?.[path], `${path} must be documented`);
  }
});

test('[TEST-149] protected OpenAPI operations require bearer authentication', () => {
  assert.deepEqual(openApiDocument.paths?.['/api/user/profile']?.get?.security, [{ bearerAuth: [] }]);
  assert.deepEqual(openApiDocument.paths?.['/api/auth/register']?.post?.security, []);
  assert.deepEqual(openApiDocument.components?.securitySchemes?.bearerAuth, {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
  });
});
