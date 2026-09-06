import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  createCompensationAdjustmentSchema,
  createCompensationPeriodSchema,
  createCompensationPolicySchema,
  decideCompensationAdjustmentSchema,
  prepareCompensationPayoutSchema,
  recordManualPayoutSchema,
  reverseWorkCreditSchema,
} from '../src/validation/compensation.schemas';

test('[TEST-137] compensation mutation bodies are strict, bounded, and PHP-scoped', () => {
  const policy = createCompensationPolicySchema.parse({
    version: '2026-Q4-demo', currency: 'PHP', baseRetainerMinor: 500_000,
    workloadUnitCapMillis: 40_000,
    workloadBands: [{ minimumUnitsMillis: 10_000, allowanceMinor: 100_000 }],
    effectiveFrom: '2026-10-01T00:00:00.000Z',
  });
  assert.equal(policy.currency, 'PHP');
  assert.throws(() => createCompensationPolicySchema.parse({ ...policy, currency: 'USD' }));
  assert.throws(() => createCompensationPolicySchema.parse({ ...policy, secret: 'unexpected' }));
  assert.throws(() => createCompensationPolicySchema.parse({ ...policy, workloadBands: [
    { minimumUnitsMillis: 1_000, allowanceMinor: 20_000 },
    { minimumUnitsMillis: 2_000, allowanceMinor: 10_000 },
  ] }));

  assert.doesNotThrow(() => createCompensationPeriodSchema.parse({ policyId: 'policy-1', periodStart: '2026-08-01T00:00:00.000Z', periodEnd: '2026-09-01T00:00:00.000Z' }));
  assert.throws(() => createCompensationPeriodSchema.parse({ policyId: 'policy-1', periodStart: '2026-09-01T00:00:00.000Z', periodEnd: '2026-08-01T00:00:00.000Z' }));
  assert.doesNotThrow(() => createCompensationAdjustmentSchema.parse({ amountMinor: -5_000, currency: 'PHP', reasonCode: 'CORRECTION', idempotencyKey: 'adjustment:1' }));
  assert.throws(() => createCompensationAdjustmentSchema.parse({ amountMinor: 0, currency: 'PHP', reasonCode: 'CORRECTION', idempotencyKey: 'adjustment:1' }));
  assert.deepEqual(decideCompensationAdjustmentSchema.parse({ decision: 'REJECT', reason: 'Unsupported evidence' }), { decision: 'REJECT', reason: 'Unsupported evidence' });
  assert.deepEqual(prepareCompensationPayoutSchema.parse({ idempotencyKey: 'payout:1' }), { idempotencyKey: 'payout:1' });
  assert.doesNotThrow(() => recordManualPayoutSchema.parse({ externalReference: 'Voucher #2026-001' }));
  assert.throws(() => recordManualPayoutSchema.parse({ externalReference: '<script>' }));
  assert.doesNotThrow(() => reverseWorkCreditSchema.parse({ reversalActionKey: 'review:1:reversal', reasonCode: 'INVALID_SOURCE' }));
});

test('[TEST-138] compensation routes are role-scoped and payout amount is server-authoritative', () => {
  const admin = readFileSync(join(process.cwd(), 'src', 'routes', 'admin.routes.ts'), 'utf8');
  const nutritionist = readFileSync(join(process.cwd(), 'src', 'routes', 'nutritionist.routes.ts'), 'utf8');
  const adminAuth = admin.indexOf('router.use(authenticate)');
  const adminRole = admin.indexOf("router.use(requireRole('ADMIN'))");
  const adminCompensation = admin.indexOf("router.get('/compensation'");
  assert.ok(adminAuth >= 0 && adminRole > adminAuth && adminCompensation > adminRole);
  assert.match(admin, /prepareCompensationPayoutSchema/);
  assert.doesNotMatch(readFileSync(join(process.cwd(), 'src', 'validation', 'compensation.schemas.ts'), 'utf8').match(/prepareCompensationPayoutSchema[\s\S]*?strict\(\)/)?.[0] ?? '', /amountMinor/);

  const nutritionistAuth = nutritionist.indexOf('router.use(authenticate)');
  const nutritionistRole = nutritionist.indexOf("router.use(requireRole('NUTRITIONIST'))");
  const eligibility = nutritionist.indexOf('router.use(requireEligibleNutritionist)');
  const ownCompensation = nutritionist.indexOf("router.get('/compensation'");
  assert.ok(nutritionistAuth >= 0 && nutritionistRole > nutritionistAuth && eligibility > nutritionistRole && ownCompensation > eligibility);
  assert.match(nutritionist.slice(ownCompensation), /req\.nutritionistProfileId!/);
  assert.doesNotMatch(nutritionist.slice(ownCompensation), /req\.params/);
});

test('[TEST-139] completed review decisions create keyed credit in the same transaction and claims do not', () => {
  const service = readFileSync(join(process.cwd(), 'src', 'services', 'nutritionist.service.ts'), 'utf8');
  assert.equal((service.match(/recordCompletedMealPlanReviewCredit\(tx/g) ?? []).length, 3);
  assert.match(service, /stage: 'HIGH_RISK_ESCALATION',[\s\S]*?outcome: 'ESCALATED'/);
  assert.match(service, /stage: plan\.highRiskReviewRequired \? 'HIGH_RISK_SECOND' : 'ORDINARY_FINAL',[\s\S]*?outcome: 'APPROVED'/);
  assert.match(service, /outcome: 'REJECTED'/);
  const claimMethod = service.slice(service.indexOf('static async getReviewCardDetails'), service.indexOf('static async approveMealPlan'));
  assert.doesNotMatch(claimMethod, /recordCompletedMealPlanReviewCredit/);
  const creditService = readFileSync(join(process.cwd(), 'src', 'services', 'work-credit.service.ts'), 'utf8');
  assert.match(creditService, /sourceActionKey = `meal-plan-review:\$\{input\.mealPlanId\}:\$\{input\.stage\.toLowerCase\(\)\}`/);
  assert.match(creditService, /decision\.decision === 'DUPLICATE'/);
});

test('[TEST-140] migration adds actor evidence and immutable compensation records without altering accepted migrations', () => {
  const migration = readFileSync(join(process.cwd(), 'prisma', 'migrations', '20260906235900_compensation_admin_workflow', 'migration.sql'), 'utf8');
  for (const expected of [
    'CompensationPolicy_actor_lifecycle', 'CompensationPeriod_actor_lifecycle',
    'CompensationStatement_maker_checker', 'CompensationAdjustment_status_shape',
    'CompensationPayout_actor_lifecycle', 'NutritionistWorkCredit_append_only',
    'CompensationStatementWorkCredit_append_only', 'CompensationPayoutEvent_append_only',
    'CompensationStatement_snapshot_guard', 'CompensationPolicy_one_active_key',
  ]) assert.match(migration, new RegExp(expected));
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|TRUNCATE/i);
});

test('[TEST-141] role UIs disclose separation, own-only scope, outcome neutrality, and manual evidence', () => {
  const admin = readFileSync(join(process.cwd(), '..', 'frontend', 'src', 'app', '(admin)', 'admin', 'compensation', 'page.tsx'), 'utf8');
  const own = readFileSync(join(process.cwd(), '..', 'frontend', 'src', 'app', '(nutritionist)', 'nutritionist', 'compensation', 'page.tsx'), 'utf8');
  assert.match(admin, /Subscription revenue does not fund or trigger a nutritionist payout/);
  assert.match(admin, /stores no bank or e-wallet details/);
  assert.match(admin, /Prepare payout evidence/);
  assert.doesNotMatch(admin, /PayMongo|bankAccount|walletNumber/);
  assert.match(own, /Only your records/);
  assert.match(own, /same credit whether it is approved, rejected, or escalated/);
  assert.match(own, /Claims and expired or abandoned work do not count/);
});
