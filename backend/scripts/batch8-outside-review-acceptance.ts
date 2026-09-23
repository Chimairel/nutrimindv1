import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { MealType } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { AppError } from '../src/errors/AppError';
import { MealLogService } from '../src/services/meal-log.service';
import { OutsideMealCaptureService } from '../src/services/outside-meal-capture.service';
import { OutsideMealReviewService } from '../src/services/outside-meal-review.service';
import { getStartOfManilaBusinessDay } from '../src/domain/meal-actionability.policy';

async function rejectsCode(fn: () => Promise<unknown>, code: string) {
  await assert.rejects(fn, (error: unknown) => error instanceof AppError && error.errorCode === code);
}

async function main() {
  const run = randomUUID();
  const accountIds: string[] = [];
  try {
    const user = await prisma.user.create({
      data: {
        name: 'Batch 8 User',
        email: `batch8-user-${run}@example.invalid`,
        passwordHash: 'disabled',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        userProfile: {
          create: {
            age: 30,
            biologicalSex: 'FEMALE',
            heightCm: 160,
            weightKg: 60,
            targetWeightKg: 60,
            goal: 'MAINTAIN',
            activityLevel: 'LIGHTLY_ACTIVE',
            dietaryPreference: 'OMNIVORE',
            ricePreference: 'FLEXIBLE',
            dailyCalorieTarget: 2000,
          },
        },
      },
    });
    accountIds.push(user.id);
    const reviewers = [];
    for (const index of [1, 2]) {
      const account = await prisma.user.create({
        data: {
          name: `Batch 8 RND ${index}`,
          email: `batch8-rnd${index}-${run}@example.invalid`,
          passwordHash: 'disabled',
          role: 'NUTRITIONIST',
          emailVerified: true,
        },
      });
      accountIds.push(account.id);
      reviewers.push(
        await prisma.nutritionistProfile.create({
          data: {
            userId: account.id,
            prcLicenseNumber: `BATCH8-${index}-${run}`,
            prcLicenseExpiry: new Date('2030-12-31T00:00:00Z'),
            isVerified: true,
            verifiedAt: new Date(),
          },
        })
      );
    }
    const consumedAt = new Date(Date.now() - 10 * 60_000).toISOString();
    const preview = await MealLogService.logOutsideMeal({
      userId: user.id,
      mealType: MealType.SNACK,
      consumedAt,
      items: [
        {
          name: `Batch 8 packaged snack ${run}`,
          reportedNutrition: { calories: 200, proteinG: 10, carbsG: 25, fatG: 7 },
        },
      ],
    });
    assert.ok('previewRequired' in preview);
    const committed = await MealLogService.logOutsideMeal({
      userId: user.id,
      mealType: MealType.SNACK,
      warningAcknowledged: true,
      confirmationId: preview.confirmationId,
    });
    assert.ok('log' in committed);
    const logId = committed.log.id;
    const itemId = committed.log.outsideItems[0].id;
    assert.equal(
      await prisma.outsideMealReview.count({ where: { outsideMealLogItemId: itemId } }),
      0,
      'An ordinary manual estimate does not automatically enter the queue.'
    );
    await prisma.dailyNutritionLog.create({
      data: {
        userId: user.id,
        logDate: getStartOfManilaBusinessDay(new Date(consumedAt)),
        totalCalories: 200,
        totalProteinG: 10,
        totalCarbsG: 25,
        totalFatG: 7,
        targetCalories: 2000,
        adherencePct: 10,
      },
    });
    await OutsideMealCaptureService.attachImage(user.id, logId, {
      buffer: Buffer.from('private fixture image'),
      mimetype: 'image/png',
    });
    await rejectsCode(
      () => OutsideMealReviewService.requestByUser(reviewers[0].userId, logId, itemId),
      'OUTSIDE_ITEM_NOT_FOUND'
    );
    const requested = await OutsideMealReviewService.requestByUser(user.id, logId, itemId);
    assert.equal(requested.status, 'PENDING');
    assert.equal(requested.queueReason, 'USER_REQUEST');
    assert.equal((await OutsideMealReviewService.requestByUser(user.id, logId, itemId)).id, requested.id);
    assert.ok((await OutsideMealReviewService.queue(reviewers[0].id)).some((row) => row.id === requested.id));
    const firstClaim = await OutsideMealReviewService.claim(reviewers[0].id, requested.id);
    assert.equal(firstClaim.claimedRevision, 0);
    assert.equal(
      'outsideImage' in firstClaim.outsideMealLogItem.mealLog,
      false,
      'Claim responses must not serialize private image bytes.'
    );
    await rejectsCode(() => OutsideMealReviewService.claim(reviewers[1].id, requested.id), 'REVIEW_CLAIM_CONFLICT');
    assert.deepEqual(
      (await OutsideMealReviewService.imageForClaimedReview(reviewers[0].id, requested.id)).buffer,
      Buffer.from('private fixture image')
    );
    await rejectsCode(
      () => OutsideMealReviewService.imageForClaimedReview(reviewers[1].id, requested.id),
      'OUTSIDE_IMAGE_NOT_FOUND'
    );
    const question = await OutsideMealReviewService.resolve(reviewers[0].id, requested.id, {
      action: 'NEEDS_MORE_INFO',
      reason: 'How large was the portion, and was sauce included?',
    });
    assert.equal(question.nutritionStatus, 'NEEDS_MORE_INFO');
    assert.equal(question.revision, 1);
    assert.equal(await prisma.outsideMealReviewMessage.count({ where: { outsideMealReviewId: requested.id } }), 1);
    const reply = await OutsideMealReviewService.replyByUser(
      user.id,
      logId,
      itemId,
      'One packet, 50 grams; the packet included the sauce.'
    );
    assert.equal(reply.revision, 2);
    await rejectsCode(
      () => OutsideMealReviewService.replyByUser(user.id, logId, itemId, 'Another reply'),
      'NO_OPEN_CLARIFICATION'
    );
    await rejectsCode(
      () =>
        OutsideMealReviewService.resolve(reviewers[0].id, requested.id, { action: 'VERIFY', reason: 'Stale decision' }),
      'ACTIVE_CLAIM_REQUIRED'
    );
    const secondClaim = await OutsideMealReviewService.claim(reviewers[1].id, requested.id);
    assert.equal(secondClaim.claimedRevision, 2);
    const correction = await OutsideMealReviewService.resolve(reviewers[1].id, requested.id, {
      action: 'CORRECT',
      calories: 240,
      proteinG: 11,
      carbsG: 27,
      fatG: 9,
      reason: 'Adjusted using the clarified full packet and sauce.',
    });
    assert.equal(correction.revision, 3);
    assert.equal(correction.summary.provisionalCalories, 0);
    assert.equal((await prisma.dailyNutritionLog.findFirstOrThrow({ where: { userId: user.id } })).totalCalories, 240);
    const confirmed = await prisma.outsideMealReview.findUniqueOrThrow({ where: { id: requested.id } });
    assert.equal(confirmed.reviewedRevision, 2);
    assert.equal(confirmed.status, 'CORRECTED');
    const changed = await OutsideMealCaptureService.editItem(user.id, logId, itemId, {
      name: `Batch 8 packaged snack ${run}`,
      portionGrams: 50,
      reportedNutrition: { calories: 260, proteinG: 12, carbsG: 30, fatG: 9 },
      reason: 'Found a clearer nutrition label',
    });
    assert.equal(changed.revision, 4);
    assert.equal((await prisma.outsideMealReview.findUniqueOrThrow({ where: { id: requested.id } })).status, 'PENDING');
    await OutsideMealReviewService.claim(reviewers[0].id, requested.id);
    const unverifiable = await OutsideMealReviewService.resolve(reviewers[0].id, requested.id, {
      action: 'UNVERIFIABLE',
      reason: 'The package values conflict and the portion cannot be confirmed.',
    });
    assert.equal(unverifiable.revision, 5);
    assert.equal(unverifiable.summary.totals.calories, 260);
    assert.equal(unverifiable.summary.provisionalCalories, 260);
    assert.equal((await prisma.mealLog.findUniqueOrThrow({ where: { id: logId } })).provisionalCalories, 260);
    assert.equal(await prisma.outsideMealReviewMessage.count({ where: { outsideMealReviewId: requested.id } }), 2);
    assert.equal(await prisma.outsideMealItemRevision.count({ where: { outsideMealLogItemId: itemId } }), 6);
    await prisma.user.delete({ where: { id: user.id } });
    accountIds.splice(accountIds.indexOf(user.id), 1);
    assert.equal(await prisma.outsideMealReview.count({ where: { id: requested.id } }), 0);
    assert.equal(await prisma.outsideMealReviewMessage.count({ where: { outsideMealReviewId: requested.id } }), 0);
    assert.equal(await prisma.mealLog.count({ where: { id: logId } }), 0);
    console.log('[Batch 8 outside review acceptance] PASS');
  } finally {
    for (const id of accountIds) await prisma.user.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[Batch 8 outside review acceptance] FAIL', error);
  process.exitCode = 1;
});
