import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  MealType,
  OutsideMealCompatibilityStatus,
  OutsideMealItemSource,
  OutsideMealNutritionStatus,
} from '@prisma/client';
import prisma from '../src/lib/prisma';
import { AppError } from '../src/errors/AppError';
import { MealLogService } from '../src/services/meal-log.service';
import { OutsideMealReviewService } from '../src/services/outside-meal-review.service';

type LogResult = Awaited<ReturnType<typeof MealLogService.logOutsideMeal>>;
type PreviewResult = Extract<LogResult, { previewRequired: boolean }>;
type CommitResult = Extract<LogResult, { log: unknown }>;

function assertPreview(result: LogResult): asserts result is PreviewResult {
  assert.ok('previewRequired' in result, 'Expected an outside-meal preview.');
}

function assertCommit(result: LogResult): asserts result is CommitResult {
  assert.ok('log' in result, 'Expected a committed outside-meal log.');
}

function requireDisposableDatabase(): void {
  const database = new URL(process.env.DATABASE_URL || '');
  if (
    !['127.0.0.1', 'localhost'].includes(database.hostname) ||
    database.port !== '55461' ||
    database.pathname !== '/nutrimind_outside'
  ) {
    throw new Error('Outside-meal acceptance requires the disposable database at 127.0.0.1:55461/nutrimind_outside.');
  }
}

async function rejectsWithCode(run: () => Promise<unknown>, errorCode: string): Promise<void> {
  await assert.rejects(run, (error: unknown) => error instanceof AppError && error.errorCode === errorCode);
}

async function main(): Promise<void> {
  requireDisposableDatabase();
  const run = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: {
      name: 'Outside Meal Test User',
      email: `outside-meal-user-${run}@example.invalid`,
      passwordHash: 'synthetic-not-a-login-credential',
      role: 'USER',
      emailVerified: true,
      tosAccepted: true,
      onboardingDone: true,
      userProfile: {
        create: {
          age: 24,
          biologicalSex: 'MALE',
          heightCm: 170,
          weightKg: 70,
          targetWeightKg: 74,
          goal: 'GAIN_WEIGHT',
          activityLevel: 'LIGHTLY_ACTIVE',
          dietaryPreference: 'OMNIVORE',
          carbPreference: 'MODERATE',
          dailyCalorieTarget: 2_780,
        },
      },
    },
  });
  const nutritionistUsers = await Promise.all(
    [1, 2].map((position) =>
      prisma.user.create({
        data: {
          name: `Outside Meal Nutritionist ${position}`,
          email: `outside-meal-rnd-${position}-${run}@example.invalid`,
          passwordHash: 'synthetic-not-a-login-credential',
          role: 'NUTRITIONIST',
          emailVerified: true,
          tosAccepted: true,
          onboardingDone: true,
        },
      })
    )
  );
  const nutritionists = await Promise.all(
    nutritionistUsers.map((account, position) =>
      prisma.nutritionistProfile.create({
        data: {
          userId: account.id,
          prcLicenseNumber: `PRC-OUTSIDE-${run}-${position + 1}`,
          prcLicenseExpiry: new Date('2030-12-31T00:00:00.000Z'),
          isVerified: true,
          verifiedAt: new Date(),
        },
      })
    )
  );
  const food = await prisma.foodItem.create({
    data: {
      name: `Acceptance boiled rice ${run}`,
      category: 'Cereal and grain products',
      calories: 130,
      proteinG: 2.7,
      carbsG: 28,
      fatG: 0.3,
      sodium: 1,
      source: 'FNRI acceptance fixture',
    },
  });

  await rejectsWithCode(
    () =>
      MealLogService.logOutsideMeal({
        userId: user.id,
        items: [{ name: `Unresolved premium estimate ${run}` }],
        mealType: MealType.SNACK,
        useAiEstimate: true,
      }),
    'PREMIUM_REQUIRED'
  );
  assert.equal(await prisma.outsideMealAiUsage.count({ where: { userId: user.id } }), 0);

  const requestKey = `outside-meal-acceptance:${run}`;
  const input = {
    userId: user.id,
    items: [
      { name: food.name, portionGrams: 150 },
      {
        name: 'Packaged nutrition bar',
        reportedNutrition: { calories: 250, proteinG: 10, carbsG: 32, fatG: 9 },
      },
      { name: `Unknown fiesta dish ${run}` },
    ],
    mealType: MealType.SNACK,
    requestKey,
  };
  const preview = await MealLogService.logOutsideMeal(input);
  assertPreview(preview);
  assert.equal(preview.previewRequired, true);
  assert.deepEqual(
    preview.items.map((item) => item.source),
    [OutsideMealItemSource.FNRI, OutsideMealItemSource.USER_REPORTED, OutsideMealItemSource.UNRESOLVED]
  );
  assert.equal(preview.summary.totals.calories, 445);
  assert.equal(preview.summary.unresolvedItemCount, 1);
  assert.equal(preview.summary.provisionalCalories, 0);
  const replay = await MealLogService.logOutsideMeal(input);
  assertPreview(replay);
  assert.equal(replay.confirmationId, preview.confirmationId);
  await rejectsWithCode(
    () =>
      MealLogService.logOutsideMeal({
        userId: user.id,
        items: [{ name: 'Different food' }],
        mealType: MealType.SNACK,
        requestKey,
      }),
    'REQUEST_KEY_COLLISION'
  );

  const committed = await MealLogService.logOutsideMeal({
    userId: user.id,
    mealType: MealType.SNACK,
    warningAcknowledged: true,
    confirmationId: preview.confirmationId,
  });
  assertCommit(committed);
  assert.equal(committed.log.calories, 445);
  assert.equal(committed.log.provisionalCalories, 0);
  assert.equal(committed.log.nutritionCompleteness, 'PARTIAL');
  assert.equal(committed.log.outsideItems.length, 3);
  const unresolved = committed.log.outsideItems.find((item) => item.source === OutsideMealItemSource.UNRESOLVED);
  assert.ok(unresolved);
  assert.equal(unresolved.includedInTotals, false);
  assert.equal(unresolved.calories, null);
  await rejectsWithCode(
    () =>
      MealLogService.logOutsideMeal({
        userId: user.id,
        mealType: MealType.SNACK,
        warningAcknowledged: true,
        confirmationId: preview.confirmationId,
      }),
    'PREVIEW_EXPIRED_OR_USED'
  );
  await assert.rejects(() =>
    prisma.outsideMealLogItem.create({
      data: {
        mealLogId: committed.log.id,
        position: 99,
        name: 'Invalid included item',
        source: OutsideMealItemSource.UNRESOLVED,
        nutritionStatus: OutsideMealNutritionStatus.UNRESOLVED,
        compatibilityStatus: OutsideMealCompatibilityStatus.INSUFFICIENT_EVIDENCE,
        includedInTotals: true,
      },
    })
  );

  const aiPreview = await prisma.outsideMealPreview.create({
    data: {
      userId: user.id,
      mealName: `AI estimated turon ${run}`,
      mealType: MealType.SNACK,
      estimate: { calories: 410, proteinG: 5, carbsG: 66, fatG: 14 },
      warnings: ['AI estimate — counted provisionally until a nutritionist reviews it.'],
      reasons: ['AI estimate — counted provisionally until a nutritionist reviews it.'],
      usedAi: true,
      expiresAt: new Date(Date.now() + 20 * 60 * 1000),
      items: [
        {
          name: `AI estimated turon ${run}`,
          portionGrams: null,
          source: OutsideMealItemSource.GEMINI_ESTIMATED,
          nutritionStatus: OutsideMealNutritionStatus.PENDING_REVIEW,
          compatibilityStatus: OutsideMealCompatibilityStatus.REVIEW_REQUIRED,
          includedInTotals: true,
          calories: 410,
          proteinG: 5,
          carbsG: 66,
          fatG: 14,
          calorieLow: 330,
          calorieHigh: 490,
          foodItemId: null,
          mealLibraryId: null,
          ingredients: ['banana', 'brown sugar', 'wrapper', 'oil'],
          warnings: ['AI estimate — counted provisionally until a nutritionist reviews it.'],
        },
      ],
    },
  });
  const aiLog = await MealLogService.logOutsideMeal({
    userId: user.id,
    mealType: MealType.SNACK,
    warningAcknowledged: true,
    confirmationId: aiPreview.id,
  });
  assertCommit(aiLog);
  assert.equal(aiLog.log.calories, 410);
  assert.equal(aiLog.log.provisionalCalories, 410);
  const review = await prisma.outsideMealReview.findFirstOrThrow({
    where: { outsideMealLogItem: { mealLogId: aiLog.log.id } },
  });
  const queue = await OutsideMealReviewService.queue(nutritionists[0].id);
  assert.ok(queue.some((entry) => entry.id === review.id));
  await OutsideMealReviewService.claim(nutritionists[0].id, review.id);
  await rejectsWithCode(() => OutsideMealReviewService.claim(nutritionists[1].id, review.id), 'REVIEW_CLAIM_CONFLICT');
  const decision = await OutsideMealReviewService.resolve(nutritionists[0].id, review.id, {
    action: 'CORRECT',
    calories: 330,
    proteinG: 4,
    carbsG: 55,
    fatG: 11,
    reason: 'Adjusted to one standard fried turon serving.',
  });
  assert.equal(decision.revision, 1);
  assert.equal(decision.summary.totals.calories, 330);
  assert.equal(decision.summary.provisionalCalories, 0);
  const correctedLog = await prisma.mealLog.findUniqueOrThrow({
    where: { id: aiLog.log.id },
    include: { outsideItems: { include: { revisions: { orderBy: { revision: 'asc' } } } } },
  });
  assert.equal(correctedLog.calories, 330);
  assert.equal(correctedLog.provisionalCalories, 0);
  assert.equal(correctedLog.dataSource, 'NUTRITIONIST_REVIEWED');
  assert.equal(correctedLog.outsideItems[0].nutritionStatus, 'CORRECTED');
  assert.equal(correctedLog.outsideItems[0].revisions.length, 2);
  assert.equal(await prisma.notification.count({ where: { userId: user.id, type: 'OUTSIDE_MEAL_REVIEWED' } }), 1);
  assert.equal(await prisma.auditEvent.count({ where: { entityId: correctedLog.outsideItems[0].id } }), 1);

  let geminiCalls = 0;
  let geminiProviderAttempts = 0;
  if (process.env.OUTSIDE_MEAL_ACCEPTANCE_USE_GEMINI === '1') {
    const now = new Date();
    await prisma.entitlementGrant.create({
      data: {
        userId: user.id,
        billingSubjectKey: `outside-meal:${run}`,
        entitlementKey: 'PREMIUM',
        source: 'ADMIN_ADJUSTMENT',
        sourceKey: `outside-meal-acceptance:${run}:premium`,
        effectiveFrom: new Date(now.getTime() - 60_000),
        effectiveUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      },
    });
    const livePreview = await MealLogService.logOutsideMeal({
      userId: user.id,
      items: [{ name: 'one medium turon with jackfruit' }],
      mealType: MealType.SNACK,
      useAiEstimate: true,
      requestKey: `outside-meal-live-gemini:${run}`,
    });
    assertPreview(livePreview);
    assert.equal(livePreview.usedAi, true);
    assert.equal(livePreview.items[0].source, OutsideMealItemSource.GEMINI_ESTIMATED);
    assert.equal(livePreview.items[0].nutritionStatus, OutsideMealNutritionStatus.PENDING_REVIEW);
    assert.ok(livePreview.summary.provisionalCalories > 0);
    geminiProviderAttempts = (
      await prisma.aiUsageEvent.findFirstOrThrow({
        where: { status: 'SUCCESS' },
        orderBy: { createdAt: 'desc' },
      })
    ).attempts;
    const liveCommit = await MealLogService.logOutsideMeal({
      userId: user.id,
      mealType: MealType.SNACK,
      warningAcknowledged: true,
      confirmationId: livePreview.confirmationId,
    });
    assertCommit(liveCommit);
    assert.ok(liveCommit.log.provisionalCalories > 0);
    assert.equal(await prisma.outsideMealAiUsage.count({ where: { userId: user.id } }), 1);
    const liveReview = await prisma.outsideMealReview.findFirstOrThrow({
      where: { outsideMealLogItem: { mealLogId: liveCommit.log.id } },
    });
    await OutsideMealReviewService.claim(nutritionists[0].id, liveReview.id);
    const verified = await OutsideMealReviewService.resolve(nutritionists[0].id, liveReview.id, {
      action: 'VERIFY',
      reason: 'Acceptance verification of the provider-generated estimate.',
    });
    assert.equal(verified.summary.provisionalCalories, 0);
    geminiCalls = 1;
  }

  console.log(
    JSON.stringify({
      test: geminiCalls ? 'TEST-183' : 'TEST-182',
      outcome: 'PASS',
      freeSources: ['FNRI', 'USER_REPORTED', 'UNRESOLVED'],
      unresolvedExcluded: true,
      previewReplayProtected: true,
      reviewClaimContentionProtected: true,
      provisionalCaloriesBeforeReview: 410,
      correctedCaloriesAfterReview: 330,
      notifications: 1,
      geminiCalls,
      geminiProviderAttempts,
    })
  );
}

main().finally(() => prisma.$disconnect());
