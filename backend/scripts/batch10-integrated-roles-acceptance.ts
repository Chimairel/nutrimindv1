import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { MealType } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { AdminService } from '../src/services/admin.service';
import { MealLogService } from '../src/services/meal-log.service';
import { OutsideMealReviewService } from '../src/services/outside-meal-review.service';
import { ObservedMealService } from '../src/services/observed-meal.service';
import { databaseRecipeCandidateProvider } from '../src/services/panlasang-recipe-candidate.provider';
import { UserPrivacyService } from '../src/services/user-privacy.service';

async function main() {
  const marker = randomUUID();
  const accounts: string[] = [];
  let submissionId: string | null = null;
  let candidateId: string | null = null;
  try {
    const admin = await prisma.user.create({
      data: {
        email: `batch10-admin-${marker}@example.invalid`,
        name: 'Batch 10 Admin',
        passwordHash: 'disabled',
        role: 'ADMIN',
        emailVerified: true,
      },
    });
    accounts.push(admin.id);
    const rndUser = await prisma.user.create({
      data: {
        email: `batch10-rnd-${marker}@example.invalid`,
        name: 'Batch 10 RND',
        passwordHash: 'disabled',
        role: 'NUTRITIONIST',
        emailVerified: true,
      },
    });
    accounts.push(rndUser.id);
    const rnd = await prisma.nutritionistProfile.create({
      data: {
        userId: rndUser.id,
        prcLicenseNumber: `BATCH10-${marker}`,
        prcLicenseExpiry: new Date('2030-12-31T00:00:00Z'),
        isVerified: true,
        verifiedAt: new Date(),
      },
    });
    const lead = await AdminService.setNutritionistLeadCapability(admin.id, rnd.id, true);
    assert.equal(lead.canLeadReview, true);
    assert.equal(
      await prisma.auditEvent.count({
        where: {
          actorUserId: admin.id,
          entityId: rnd.id,
          action: 'NUTRITIONIST_LEAD_CAPABILITY_GRANTED',
        },
      }),
      1
    );

    const password = `Batch10-${marker}`;
    const patient = await prisma.user.create({
      data: {
        email: `batch10-patient-${marker}@example.invalid`,
        name: 'Batch 10 Patient',
        passwordHash: await bcrypt.hash(password, 12),
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
            dailyCalorieTarget: 2000,
          },
        },
      },
    });
    accounts.push(patient.id);
    const historicalReviewId = randomUUID();
    await prisma.clinicalProfileReview.create({
      data: {
        id: historicalReviewId,
        userId: patient.id,
        profileRevision: 1,
        policyVersion: 'BATCH10_HISTORICAL',
        reasonCodes: [],
        profileSnapshot: {},
        reviewerId: rnd.id,
      },
    });

    const mealName = `Batch 10 chicken stew ${marker}`;
    const preview = await MealLogService.logOutsideMeal({
      userId: patient.id,
      mealType: MealType.LUNCH,
      consumedAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      notes: `Private patient note ${marker}`,
      items: [
        { name: mealName, portionGrams: 250, reportedNutrition: { calories: 400, proteinG: 30, carbsG: 45, fatG: 12 } },
      ],
    });
    assert.ok('previewRequired' in preview);
    const committed = await MealLogService.logOutsideMeal({
      userId: patient.id,
      mealType: MealType.LUNCH,
      warningAcknowledged: true,
      confirmationId: preview.confirmationId,
    });
    assert.ok('log' in committed);
    const logId = committed.log.id;
    const itemId = committed.log.outsideItems[0].id;
    const requested = await OutsideMealReviewService.requestByUser(patient.id, logId, itemId);
    assert.ok((await OutsideMealReviewService.queue(rnd.id)).some((row) => row.id === requested.id));
    await OutsideMealReviewService.claim(rnd.id, requested.id);
    await OutsideMealReviewService.resolve(rnd.id, requested.id, {
      action: 'NEEDS_MORE_INFO',
      reason: 'Please confirm the serving size and ingredients.',
    });
    await OutsideMealReviewService.replyByUser(
      patient.id,
      logId,
      itemId,
      'One 250 g bowl with chicken, carrots, and broth.'
    );
    await OutsideMealReviewService.claim(rnd.id, requested.id);
    const corrected = await OutsideMealReviewService.resolve(rnd.id, requested.id, {
      action: 'CORRECT',
      calories: 420,
      proteinG: 32,
      carbsG: 46,
      fatG: 13,
      reason: 'Adjusted from the clarified bowl and ingredients.',
    });
    assert.equal(corrected.summary.totals.calories, 420);
    assert.equal(corrected.summary.provisionalCalories, 0);
    const revisions = await prisma.outsideMealItemRevision.findMany({
      where: { outsideMealLogItemId: itemId },
      orderBy: { revision: 'asc' },
    });
    assert.ok(revisions.length >= 4);

    const consent = await ObservedMealService.consent(patient.id, logId, itemId, {
      detailsConsent: true,
      imageReuseConsent: false,
      imageRightsConfirmed: false,
    });
    submissionId = consent.id;
    assert.equal(
      (await ObservedMealService.pending()).some((row) => row.id === submissionId),
      true
    );
    const admitted = await ObservedMealService.admit(rnd.id, consent.id, {
      kind: 'RECIPE_CANDIDATE',
      canonicalName: mealName,
      ingredients: [
        { name: 'chicken', quantity: 100, unit: 'g' },
        { name: 'carrot', quantity: 50, unit: 'g' },
        { name: 'water', quantity: 100, unit: 'ml' },
      ],
      preparation: 'Simmer the chicken and carrots in water until fully cooked.',
      mealTypes: [MealType.LUNCH],
    });
    candidateId = admitted.id;
    const candidate = await prisma.rawRecipeCandidate.findUniqueOrThrow({ where: { id: candidateId } });
    assert.equal(candidate.sourceName, 'USER_OBSERVED');
    assert.equal(candidate.status, 'AVAILABLE');
    assert.equal(
      await prisma.mealLibrary.count({ where: { mealName } }),
      0,
      'RND observation admission must not certify a library meal.'
    );
    const rawPage = await databaseRecipeCandidateProvider.list({
      mealType: MealType.LUNCH,
      dietaryPreference: 'OMNIVORE',
      sourceKind: 'USER_OBSERVED',
      search: mealName,
      limit: 10,
    });
    assert.equal(rawPage.items.find((row) => row.id === candidateId)?.provenance, 'USER_OBSERVED');
    assert.equal(JSON.stringify(candidate).includes(patient.email), false);
    assert.equal(JSON.stringify(candidate).includes('Private patient note'), false);

    await UserPrivacyService.deleteAccount(patient.id, { password });
    accounts.splice(accounts.indexOf(patient.id), 1);
    assert.equal(await prisma.user.count({ where: { id: patient.id } }), 0);
    assert.equal(await prisma.clinicalProfileReview.count({ where: { id: historicalReviewId } }), 0);
    assert.equal(await prisma.mealLog.count({ where: { id: logId } }), 0);
    assert.equal(await prisma.outsideMealItemRevision.count({ where: { outsideMealLogItemId: itemId } }), 0);
    const deidentified = await prisma.observedMealSubmission.findUniqueOrThrow({ where: { id: consent.id } });
    assert.equal(deidentified.sourceUserId, null);
    assert.equal(deidentified.sourceOutsideMealItemId, null);
    assert.equal(
      (await prisma.rawRecipeCandidate.findUniqueOrThrow({ where: { id: candidateId } })).status,
      'AVAILABLE'
    );
    assert.equal(
      await prisma.auditEvent.count({
        where: {
          entityId: patient.id,
          action: 'USER_SELF_DELETION',
        },
      }),
      1
    );
    console.log(
      '[Batch 10 integrated roles] PASS: admin Lead, user log, RND clarification/correction, consented raw candidate, privacy deletion'
    );
  } finally {
    if (submissionId) await prisma.observedMealSubmission.deleteMany({ where: { id: submissionId } });
    if (candidateId) await prisma.rawRecipeCandidate.deleteMany({ where: { id: candidateId } });
    for (const id of accounts) await prisma.user.delete({ where: { id } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[Batch 10 integrated roles] FAIL', error);
  process.exitCode = 1;
});
