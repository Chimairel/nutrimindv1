import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readFrontend = (path: string) => readFileSync(`../frontend/${path}`, 'utf8');

test('[TEST-114] Premium UI states the sole benefit, TEST price, fixed term, and nonrenewal honestly', () => {
  const billing = readFrontend('src/app/(user)/billing/page.tsx');
  assert.match(billing, /3 meal swaps per weekly plan/);
  assert.match(billing, /6 meal swaps per weekly plan/);
  assert.match(billing, /TEST demo/);
  assert.match(billing, /30 days/);
  assert.match(billing, /No automatic renewal/);
  assert.match(billing, /Nutrition safety, grocery tools, exports, and privacy controls stay available on Free/);
  for (const unsupportedClaim of ['ad-free', 'priority support', 'exclusive meals', 'unlimited swaps']) {
    assert.equal(billing.toLowerCase().includes(unsupportedClaim), false, unsupportedClaim);
  }
});

test('[TEST-115] checkout UI uses stable attempt idempotency and blocks duplicate submission', () => {
  const billing = readFrontend('src/app/(user)/billing/page.tsx');
  const helper = readFrontend('src/lib/billing-checkout.ts');
  assert.match(billing, /submitting\.current/);
  assert.match(billing, /Idempotency-Key/);
  assert.match(billing, /getOrCreatePremiumCheckoutAttemptKey/);
  assert.match(helper, /sessionStorage\.getItem/);
  assert.match(helper, /sessionStorage\.setItem/);
  assert.match(helper, /checkout\.paymongo\.com/);
  assert.match(helper, /clearPremiumCheckoutAttemptKey/);
});

test('[TEST-116] success and cancel returns are explicitly non-authoritative and polling is bounded', () => {
  const success = readFrontend('src/app/(user)/billing/success/page.tsx');
  const cancel = readFrontend('src/app/(user)/billing/cancel/page.tsx');
  assert.match(success, /MAX_POLLS = 10/);
  assert.match(success, /browser return cannot grant Premium/);
  assert.match(success, /URL parameters and redirects are ignored/);
  assert.doesNotMatch(success, /useSearchParams|searchParams|window\.location\.search/);
  assert.match(cancel, /made no billing or access change/);
  assert.match(cancel, /does not cancel, confirm, or create/);
});

test('[TEST-117] navigation, route guard, and meal UI consume the dynamic server cap', () => {
  const sidebar = readFrontend('src/components/ui/Sidebar.tsx');
  const bottom = readFrontend('src/components/ui/BottomNav.tsx');
  const guard = readFrontend('src/components/shared/RouteGuard.tsx');
  const meals = [
    readFrontend('src/app/(user)/meals/page.tsx'),
    readFrontend('src/features/meals/useMealsWorkspace.ts'),
    readFrontend('src/features/meals/MealsWorkspaceModals.tsx'),
  ].join('\n');
  const card = readFrontend('src/components/user/MealCard.tsx');
  assert.match(sidebar, /href: '\/billing'/);
  assert.match(bottom, /href: '\/billing'/);
  assert.match(guard, /'\/billing'/);
  assert.match(meals, /setSwapCap/);
  assert.match(card, /swapCap/);
  assert.doesNotMatch(meals, /3\s*-\s*swapsUsed/);
  assert.doesNotMatch(card, /swapsUsed\s*>?=\s*3/);
});
