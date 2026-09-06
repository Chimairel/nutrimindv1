import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma';
import { CompensationAdminService, NutritionistCompensationService } from '../src/services/compensation-admin.service';
import { recordCompletedMealPlanReviewCredit } from '../src/services/work-credit.service';

async function main() {
  if (!process.env.DATABASE_URL || !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)) {
    throw new Error('Compensation acceptance requires a loopback-only disposable PostgreSQL DATABASE_URL.');
  }
  const run = randomUUID().slice(0, 8);
  const passwordHash = await bcrypt.hash('CompensationDemo123!', 12);
  const users = await Promise.all(
    [
      ['Admin One', 'ADMIN'],
      ['Admin Two', 'ADMIN'],
      ['Admin Three', 'ADMIN'],
      ['Admin Four', 'ADMIN'],
      ['Admin Five', 'ADMIN'],
      ['Nutritionist One', 'NUTRITIONIST'],
      ['Nutritionist Two', 'NUTRITIONIST'],
    ].map(([name, role], index) =>
      prisma.user.create({
        data: {
          name,
          role: role as 'ADMIN' | 'NUTRITIONIST',
          email: `comp-admin-${index + 1}@example.invalid`,
          passwordHash,
          emailVerified: true,
          tosAccepted: true,
          onboardingDone: true,
        },
      })
    )
  );
  const [admin1, admin2, admin3, admin4, admin5, nutritionistUser1, nutritionistUser2] = users;
  const profile1 = await prisma.nutritionistProfile.create({
    data: {
      userId: nutritionistUser1.id,
      prcLicenseNumber: `PRC-${run}-1`,
      prcLicenseExpiry: new Date('2027-12-31T00:00:00Z'),
      isVerified: true,
    },
  });
  const profile2 = await prisma.nutritionistProfile.create({
    data: {
      userId: nutritionistUser2.id,
      prcLicenseNumber: `PRC-${run}-2`,
      prcLicenseExpiry: new Date('2027-12-31T00:00:00Z'),
      isVerified: true,
    },
  });
  const earnedAt = new Date('2026-08-15T00:00:00Z');

  const ids = await prisma.$transaction(async (tx) =>
    Promise.all([
      recordCompletedMealPlanReviewCredit(tx, {
        nutritionistProfileId: profile1.id,
        actorUserId: nutritionistUser1.id,
        mealPlanId: `meal-${run}-approved`,
        stage: 'ORDINARY_FINAL',
        outcome: 'APPROVED',
        earnedAt,
      }),
      recordCompletedMealPlanReviewCredit(tx, {
        nutritionistProfileId: profile1.id,
        actorUserId: nutritionistUser1.id,
        mealPlanId: `meal-${run}-rejected`,
        stage: 'ORDINARY_FINAL',
        outcome: 'REJECTED',
        earnedAt,
      }),
      recordCompletedMealPlanReviewCredit(tx, {
        nutritionistProfileId: profile1.id,
        actorUserId: nutritionistUser1.id,
        mealPlanId: `meal-${run}-escalated`,
        stage: 'HIGH_RISK_ESCALATION',
        outcome: 'ESCALATED',
        earnedAt,
      }),
      recordCompletedMealPlanReviewCredit(tx, {
        nutritionistProfileId: profile1.id,
        actorUserId: nutritionistUser1.id,
        mealPlanId: `meal-${run}-second`,
        stage: 'HIGH_RISK_SECOND',
        outcome: 'APPROVED',
        earnedAt,
      }),
    ])
  );
  await prisma.$transaction((tx) =>
    recordCompletedMealPlanReviewCredit(tx, {
      nutritionistProfileId: profile1.id,
      actorUserId: nutritionistUser1.id,
      mealPlanId: `meal-${run}-approved`,
      stage: 'ORDINARY_FINAL',
      outcome: 'APPROVED',
      earnedAt,
    })
  );
  assert.equal(
    await prisma.nutritionistWorkCredit.count({ where: { nutritionistProfileId: profile1.id, entryType: 'AWARD' } }),
    4
  );
  const ordinary = await prisma.nutritionistWorkCredit.findMany({
    where: { nutritionistProfileId: profile1.id, creditKind: 'ORDINARY_PLAN_REVIEW' },
    orderBy: { sourceOutcome: 'asc' },
  });
  assert.deepEqual(new Set(ordinary.map((credit) => credit.unitsMillis)), new Set([1_000]));
  assert.deepEqual(
    new Set(ordinary.map((credit) => credit.sourceOutcome)),
    new Set(['APPROVED', 'ESCALATED', 'REJECTED'])
  );
  const claimOnlyCount = await prisma.nutritionistWorkCredit.count({
    where: { sourceActionKey: { contains: 'claim' } },
  });
  assert.equal(claimOnlyCount, 0);
  await CompensationAdminService.reverseWorkCredit(
    admin1.id,
    ids[0].id,
    `reversal:${run}:invalid-review`,
    'INVALID_SOURCE_ACTION'
  );

  const policy = await CompensationAdminService.createPolicy(admin1.id, {
    version: `demo-${run}`,
    currency: 'PHP',
    baseRetainerMinor: 100_000,
    workloadUnitCapMillis: 3_000,
    workloadBands: [
      { minimumUnitsMillis: 1_000, allowanceMinor: 10_000 },
      { minimumUnitsMillis: 3_000, allowanceMinor: 30_000 },
    ],
    effectiveFrom: '2026-07-01T00:00:00.000Z',
  });
  await assert.rejects(() => CompensationAdminService.activatePolicy(admin1.id, policy.id), /different administrator/);
  await CompensationAdminService.activatePolicy(admin2.id, policy.id);
  const period = await CompensationAdminService.openPeriod(admin1.id, {
    policyId: policy.id,
    periodStart: '2026-08-01T00:00:00.000Z',
    periodEnd: '2026-09-01T00:00:00.000Z',
  });
  await assert.rejects(() => CompensationAdminService.closePeriod(admin1.id, period.id), /different administrator/);
  await CompensationAdminService.closePeriod(admin2.id, period.id);
  const statements = await CompensationAdminService.generateStatements(admin3.id, period.id);
  assert.equal(statements.length, 2);
  const statement1 = statements.find((statement) => statement.nutritionistProfileId === profile1.id)!;
  const statement2 = statements.find((statement) => statement.nutritionistProfileId === profile2.id)!;
  assert.deepEqual(
    {
      credited: statement1.creditedUnitsMillis,
      capped: statement1.cappedUnitsMillis,
      workload: statement1.workloadAllowanceMinor,
      gross: statement1.grossMinor,
    },
    { credited: 4_500, capped: 3_000, workload: 30_000, gross: 130_000 }
  );
  assert.equal(statement2.grossMinor, 100_000);

  const adjustmentInput = {
    amountMinor: 500,
    currency: 'PHP' as const,
    reasonCode: 'DOCUMENTED_CORRECTION',
    idempotencyKey: `adjustment:${run}:1`,
  };
  const adjustment = await CompensationAdminService.createAdjustment(admin4.id, statement1.id, adjustmentInput);
  const replay = await CompensationAdminService.createAdjustment(admin4.id, statement1.id, adjustmentInput);
  assert.equal(replay.id, adjustment.id);
  await assert.rejects(
    () => CompensationAdminService.decideAdjustment(admin4.id, adjustment.id, { decision: 'APPROVE' }),
    /different administrator/
  );
  await CompensationAdminService.decideAdjustment(admin5.id, adjustment.id, { decision: 'APPROVE' });
  for (const statement of [statement1, statement2]) {
    await assert.rejects(
      () => CompensationAdminService.reviewStatement(admin3.id, statement.id),
      /different administrator/
    );
    await CompensationAdminService.reviewStatement(admin1.id, statement.id);
    await assert.rejects(
      () => CompensationAdminService.approveStatement(admin1.id, statement.id),
      /different administrators/
    );
    await CompensationAdminService.approveStatement(admin2.id, statement.id);
    const key = `manual-payout:${run}:${statement.id}`;
    const payout = await CompensationAdminService.prepareManualPayout(admin4.id, statement.id, key);
    assert.equal((await CompensationAdminService.prepareManualPayout(admin4.id, statement.id, key)).id, payout.id);
    await assert.rejects(
      () => CompensationAdminService.approveManualPayout(admin4.id, payout.id),
      /different administrator/
    );
    await CompensationAdminService.approveManualPayout(admin5.id, payout.id);
    await CompensationAdminService.recordManualPayout(admin1.id, payout.id, `Voucher ${run} ${statement.id.slice(-6)}`);
  }

  const own1 = await NutritionistCompensationService.getOwn(profile1.id);
  const own2 = await NutritionistCompensationService.getOwn(profile2.id);
  assert.equal(own1.statements.length, 1);
  assert.equal(own2.statements.length, 1);
  assert.ok(own1.statements.every((statement) => statement.nutritionistProfileId === profile1.id));
  assert.ok(own2.statements.every((statement) => statement.nutritionistProfileId === profile2.id));
  assert.equal(own1.summary.recordedPaidMinor, 130_500);
  assert.equal(own2.summary.recordedPaidMinor, 100_000);
  const workspace = await CompensationAdminService.getWorkspace();
  assert.deepEqual(workspace.reconciliation, {
    approvedStatementGrossMinor: 230_500,
    committedPayoutMinor: 230_500,
    recordedPaidMinor: 230_500,
    outstandingApprovedMinor: 0,
    mismatchMinor: 0,
    currency: 'PHP',
  });
  assert.equal((await prisma.compensationPeriod.findUniqueOrThrow({ where: { id: period.id } })).status, 'CLOSED');

  await assert.rejects(
    () => prisma.nutritionistWorkCredit.update({ where: { id: ids[1].id }, data: { unitsMillis: 999 } }),
    /compensation evidence is append-only/
  );
  await assert.rejects(
    () => prisma.compensationStatement.update({ where: { id: statement1.id }, data: { grossMinor: 1 } }),
    /approved compensation statement snapshot is immutable/
  );
  assert.equal(await prisma.compensationPayout.count({ where: { provider: { not: null } } }), 0);
  console.log(
    JSON.stringify({
      test: 'TEST-142',
      outcome: 'PASS',
      workAwards: 4,
      statements: 2,
      grossMinor: 230_500,
      payoutMethod: 'MANUAL_OFF_PLATFORM',
      providerCalls: 0,
    })
  );
}

main().finally(() => prisma.$disconnect());
