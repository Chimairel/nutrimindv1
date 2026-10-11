/** Real HTTP/SQL tests, exclusively a fresh task-owned local PostgreSQL database. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import type { Role } from '@prisma/client';
import app from '../src/app';
import prisma from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/domain/onboarding.policy';
import { NutritionReportService } from '../src/services/nutrition-report.service';
import { OutsideMealReviewService } from '../src/services/outside-meal-review.service';
import { MembershipService } from '../src/services/membership.service';
import { OutsideMealCaptureService } from '../src/services/outside-meal-capture.service';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55488');
  assert.equal(target.pathname, '/kainara_outside_quota');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.MEMBERSHIP_ENABLED, 'true');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY'])
    assert.equal(process.env[key] ?? '', '');
  assert.equal(await prisma.user.count(), 0);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const now = new Date();
  const past = new Date(now.getTime() - 90 * 86_400_000);
  const future = new Date(now.getTime() + 90 * 86_400_000);
  const account = async (role: Role = 'USER') => {
    const user = await prisma.user.create({
      data: {
        role,
        name: 'Synthetic outside review',
        email: `${randomUUID()}@example.invalid`,
        passwordHash: 'unusable-fixture',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
        ...(role === 'USER'
          ? {
              userProfile: {
                create: {
                  age: 24,
                  biologicalSex: 'MALE',
                  heightCm: 170,
                  weightKg: 70,
                  goal: 'MAINTAIN',
                  activityLevel: 'LIGHTLY_ACTIVE',
                  dietaryPreference: 'OMNIVORE',
                  dailyCalorieTarget: 2400,
                },
              },
            }
          : {}),
      },
    });
    if (role === 'USER') {
      const report = await NutritionReportService.generateReport(user.id);
      await NutritionReportService.acknowledgeReport(user.id, report.version);
    }
    return user;
  };
  type User = Awaited<ReturnType<typeof account>>;
  const http = async (user: User, path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${signAccessToken({ userId: user.id, email: user.email, role: user.role })}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as { data: any; code?: string; error?: string } };
  };
  const ok = async (request: ReturnType<typeof http>) => {
    const response = await request;
    assert.equal(response.status, 200, JSON.stringify(response.body));
    return response.body.data;
  };
  // A stored AI preview exercises confirmation without making any external AI call.
  const preview = (user: User, count = 2) =>
    prisma.outsideMealPreview.create({
      data: {
        userId: user.id,
        mealName: 'Synthetic mixed meal',
        mealType: 'LUNCH',
        usedAi: true,
        estimate: { calories: count * 200, proteinG: count * 10, carbsG: count * 25, fatG: count * 7 },
        warnings: [],
        reasons: [],
        expiresAt: future,
        requestKey: randomUUID(),
        items: Array.from({ length: count }, (_, index) => ({
          name: `Synthetic food ${index}`,
          portionGrams: 100,
          servingDescription: 'reported portion',
          source: 'GEMINI_ESTIMATED',
          nutritionStatus: 'PENDING_REVIEW',
          compatibilityStatus: 'INSUFFICIENT_EVIDENCE',
          includedInTotals: true,
          calories: 200,
          proteinG: 10,
          carbsG: 25,
          fatG: 7,
          calorieLow: 100,
          calorieHigh: 300,
          foodItemId: null,
          mealLibraryId: null,
          ingredients: [],
          warnings: [],
          reasons: [],
        })),
      },
    });
  const confirm = async (user: User, record: Awaited<ReturnType<typeof preview>>, review = false) =>
    http(user, '/user/meals/log-outside', 'POST', {
      mealType: 'LUNCH',
      warningAcknowledged: true,
      confirmationId: record.id,
      requestKey: record.requestKey,
      ...(review ? { requestRndReview: true } : {}),
    });
  const reviews = (logId: string) =>
    prisma.outsideMealReview.findMany({ where: { outsideMealLogItem: { mealLogId: logId } } });
  const usage = (user: User) =>
    prisma.membershipUsage.count({ where: { userId: user.id, feature: 'OUTSIDE_REVIEW', completedAt: { not: null } } });
  const requestReview = (user: User, log: { id: string; outsideItems: { id: string }[] }) =>
    http(user, `/user/meals/logs/${log.id}/items/${log.outsideItems[0].id}/request-review`, 'POST');
  const passed = (label: string) => console.log(`PASS ${label}`);
  try {
    const rnd = await account('NUTRITIONIST');
    const credential = await prisma.nutritionistProfile.create({
      data: { userId: rnd.id, prcLicenseNumber: randomUUID(), prcLicenseExpiry: future, isVerified: true },
    });
    const admin = await account('ADMIN');
    const trial = await account();
    const ordinaryPreview = await preview(trial);
    const ordinary = (await ok(confirm(trial, ordinaryPreview))).log;
    assert.equal((await reviews(ordinary.id)).length, 0);
    assert.equal(await usage(trial), 0);
    passed('Use estimate saves AI preview without review admission or review usage');

    const requestPreview = await preview(trial);
    const admitted = (await ok(confirm(trial, requestPreview, true))).log;
    assert.equal((await reviews(admitted.id)).length, 2);
    assert.equal(await usage(trial), 1);
    assert.equal(await prisma.membershipUsage.count({ where: { userId: trial.id, feature: 'AI_ESTIMATE' } }), 0);
    await ok(confirm(trial, requestPreview, true));
    const review = (await reviews(admitted.id))[0];
    await ok(http(rnd, `/nutritionist/outside-meal-reviews/${review.id}/claim`, 'POST'));
    await ok(requestReview(trial, admitted));
    assert.equal((await prisma.outsideMealReview.findUniqueOrThrow({ where: { id: review.id } })).status, 'CLAIMED');
    assert.equal(await usage(trial), 1);
    assert.equal(
      await prisma.auditEvent.count({ where: { entityId: admitted.id, action: 'OUTSIDE_MEAL_REVIEW_REQUESTED' } }),
      1
    );
    passed('All food items cost one review; retries retain claims and do not charge or notify twice');

    const blockedPreview = await preview(trial);
    assert.equal((await confirm(trial, blockedPreview, true)).status, 429);
    assert.equal(await prisma.mealLog.count({ where: { outsidePreviewId: blockedPreview.id } }), 0);
    assert.equal(
      (await prisma.outsideMealPreview.findUniqueOrThrow({ where: { id: blockedPreview.id } })).consumedAt,
      null
    );
    await ok(confirm(trial, blockedPreview));
    passed('Quota failure atomically leaves preview unsaved; Use estimate remains available');

    await prisma.membershipAccount.upsert({
      where: { userId: trial.id },
      update: { createdAt: past, trialStartedAt: past },
      create: { userId: trial.id, createdAt: past, trialStartedAt: past },
    });
    await ok(
      http(rnd, `/nutritionist/outside-meal-reviews/${review.id}`, 'PATCH', {
        action: 'NEEDS_MORE_INFO',
        reason: 'How was this prepared?',
      })
    );
    const itemId = review.outsideMealLogItemId;
    await ok(
      http(trial, `/user/meals/logs/${admitted.id}/items/${itemId}/reply`, 'POST', { message: 'Boiled, one bowl.' })
    );
    await ok(requestReview(trial, admitted));
    await OutsideMealCaptureService.editItem(trial.id, admitted.id, itemId, {
      name: 'Synthetic food 0',
      portionGrams: 100,
      reportedNutrition: { calories: 200, proteinG: 10, carbsG: 25, fatG: 7 },
      reason: 'Clarified portion',
    });
    assert.equal(await usage(trial), 1);
    passed('Expiry preserves free clarification, edits and handoff within an admitted request');

    for (const task of await reviews(admitted.id)) {
      await OutsideMealReviewService.claim(credential.id, task.id);
      await OutsideMealReviewService.resolve(credential.id, task.id, {
        action: 'VERIFY',
        reason: 'Reference and reported portion appear consistent',
      });
    }
    const rangeItem = await prisma.outsideMealLogItem.findFirstOrThrow({
      where: { mealLogId: admitted.id, id: { not: itemId } },
    });
    assert.equal(rangeItem.calorieLow, 100);
    assert.equal(rangeItem.calorieHigh, 300);
    await ok(requestReview(trial, admitted));
    assert((await reviews(admitted.id)).every((task) => task.status === 'VERIFIED'));
    await OutsideMealCaptureService.editItem(trial.id, admitted.id, itemId, {
      name: 'Synthetic food 0',
      portionGrams: 80,
      reportedNutrition: { calories: 180, proteinG: 8, carbsG: 25, fatG: 6 },
      reason: 'Changed completed meal',
    });
    assert((await reviews(admitted.id)).every((task) => task.status === 'VERIFIED'));
    assert.equal((await requestReview(trial, admitted)).status, 403);
    assert.equal(await usage(trial), 1);
    passed('Completed decisions retain revision binding and uncertainty; later changes need new Health admission');

    const lifestyle = await account();
    await prisma.membershipAccount.upsert({
      where: { userId: lifestyle.id },
      update: { createdAt: past, trialStartedAt: past },
      create: { userId: lifestyle.id, createdAt: past, trialStartedAt: past },
    });
    await prisma.membershipGrant.create({
      data: {
        userId: lifestyle.id,
        tier: 'LIFESTYLE',
        source: 'ADMIN_ADJUSTMENT',
        evidenceReference: randomUUID(),
        verifiedAt: now,
        effectiveFrom: past,
        effectiveUntil: future,
      },
    });
    const lifestylePreview = await preview(lifestyle);
    assert.equal((await confirm(lifestyle, lifestylePreview, true)).status, 403);
    const lifestyleLog = (await ok(confirm(lifestyle, lifestylePreview))).log;
    assert.equal(await usage(lifestyle), 0);
    const legacy = await prisma.outsideMealReview.create({
      data: { outsideMealLogItemId: lifestyleLog.outsideItems[0].id, queueReason: 'DEMO_AI_ESTIMATE' },
    });
    assert.equal((await http(rnd, `/nutritionist/outside-meal-reviews/${legacy.id}/claim`, 'POST')).status, 409);
    assert(!(await OutsideMealReviewService.queue(credential.id)).some((task) => task.id === legacy.id));
    assert.equal((await requestReview(lifestyle, lifestyleLog)).status, 403);
    assert.equal(
      (await prisma.outsideMealReview.findUniqueOrThrow({ where: { id: legacy.id } })).requestedByUserAt,
      null
    );
    passed('Lifestyle cannot request Health review; historical automatic tasks cannot bypass admission');

    const concurrent = await account();
    const contenders = await Promise.all([preview(concurrent), preview(concurrent)]);
    const outcomes = await Promise.all(contenders.map((record) => confirm(concurrent, record, true)));
    assert.deepEqual(outcomes.map((result) => result.status).sort(), [200, 429]);
    assert.equal(await usage(concurrent), 1);
    assert.equal(await prisma.mealLog.count({ where: { userId: concurrent.id } }), 1);
    passed('Concurrent distinct requests share the same weekly allowance without overspending');

    await prisma.foodItem.create({
      data: {
        name: 'Synthetic boiled rice',
        calories: 130,
        proteinG: 3,
        carbsG: 28,
        fatG: 0,
        source: 'FNRI',
        sodium: 0,
        sugar: null,
      },
    });
    const catalogue = await ok(http(rnd, '/nutritionist/food-catalogue?source=FNRI&page=1&limit=12'));
    assert.equal(catalogue.foods[0].sodium, 0);
    assert.equal(catalogue.foods[0].sugar, null);
    assert.equal((await http(trial, '/nutritionist/food-catalogue')).status, 403);
    assert.equal((await http(rnd, '/admin/data/foods')).status, 403);
    assert.equal((await http(rnd, '/nutritionist/food-catalogue?limit=999999')).status, 400);
    assert.equal((await http(rnd, '/nutritionist/food-catalogue', 'POST', {})).status, 404);
    await ok(http(admin, '/admin/data/foods'));
    passed('Eligible RND catalogue is bounded and read-only; member and admin mutation privileges stay separate');
    const state = await MembershipService.view(concurrent.id);
    assert(state.enabled && state.usage.OUTSIDE_REVIEW.remaining === 0);
    console.log('Outside review HTTP/SQL acceptance complete. No provider calls or shared data writes.');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
