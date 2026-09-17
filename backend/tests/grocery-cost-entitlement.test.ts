import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('[TEST-185] grocery routes check user billing entitlement and gate cost estimates behind Premium tier', () => {
  const routes = readFileSync('src/routes/grocery.routes.ts', 'utf8');
  assert.match(routes, /resolveUserBillingEntitlement/);
  assert.match(routes, /entitlement\.tier !== 'PREMIUM'/);
  assert.match(routes, /PREMIUM_REQUIRED/);
  assert.match(routes, /Shopping cost estimates require Premium\./);
});
