import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createFixturePlanCycle } from './helpers/plan-cycle-fixture';

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55465');
  assert.equal(target.pathname, '/nutrimind_ui_tests');
  assert.equal(process.env.NODE_ENV, 'test');
  process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH = path.join(
    await mkdtemp(path.join(tmpdir(), 'application-test-')),
    'mail.jsonl'
  );
  const { default: app } = await import('../src/app');
  const { default: prisma } = await import('../src/lib/prisma');
  const { NutritionistReplacementService } = await import('../src/services/nutritionist-replacement.service');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const stamp = Date.now();
  try {
    const payload = {
      fullName: 'Synthetic Applicant',
      email: `application-${stamp}@example.test`,
      phoneNumber: '09123456789',
      prcLicenseNumber: `TEST-${stamp}`,
      prcLicenseExpiry: '2029-09-30T00:00:00Z',
      specialization: 'Testing',
      yearsOfExperience: 2,
      university: 'Synthetic University',
      professionalBio: 'Synthetic application used only for a local database acceptance test.',
      officialHeadshot: 'data:image/jpeg;base64,' + 'A'.repeat(300000),
      digitalSignature: 'data:image/png;base64,iVBORw0KGgo=',
      availableCallSlots: [
        new Date(Date.now() + 86400000).toISOString(),
        new Date(Date.now() + 172800000).toISOString(),
      ],
      consent: true,
    };
    const send = (body: unknown) =>
      fetch(`http://127.0.0.1:${address.port}/api/nutritionist-applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    assert.equal((await send({ ...payload, digitalSignature: '' })).status, 400);
    assert.equal((await send({ ...payload, digitalSignature: 'https://example.test/signature.png' })).status, 400);
    const response = await send(payload);
    assert.equal(response.status, 201, await response.text());
    const application = await prisma.nutritionistApplication.findUniqueOrThrow({ where: { email: payload.email } });
    assert.equal(application.digitalSignature, payload.digitalSignature);
    assert.equal(application.officialHeadshot, payload.officialHeadshot);
    const user = await prisma.user.create({
      data: {
        email: `replacement-user-${stamp}@example.test`,
        name: 'Synthetic',
        passwordHash: 'not-login',
        userProfile: { create: {} },
      },
    });
    const rnd = await prisma.user.create({
      data: {
        email: `replacement-rnd-${stamp}@example.test`,
        name: 'Synthetic RND',
        passwordHash: 'not-login',
        role: 'NUTRITIONIST',
        nutritionistProfile: {
          create: { prcLicenseNumber: `RND-${stamp}`, prcLicenseExpiry: new Date('2029-09-30'), isVerified: true },
        },
      },
      include: { nutritionistProfile: true },
    });
    const reviewerId = rnd.nutritionistProfile!.id;
    const planGroupId = `signature-audit-${stamp}`;
    await createFixturePlanCycle(prisma, { id: planGroupId, userId: user.id });
    const meal = await prisma.mealPlan.create({
      data: {
        userId: user.id,
        planGroupId,
        mealName: 'Original synthetic meal',
        mealType: 'LUNCH',
        calories: 800,
        proteinG: 20,
        carbsG: 50,
        fatG: 15,
        scheduledDate: new Date(),
        planType: 'STARTER',
        highRiskReviewRequired: true,
        reviewApprovalCount: 1,
        firstApprovedByNutritionistId: reviewerId,
        claimedByNutritionistId: reviewerId,
        claimedAt: new Date(),
      },
    });
    await assert.rejects(
      NutritionistReplacementService.replaceAndApproveMealPlan(reviewerId, meal.id, {
        reason: 'Synthetic excessive calories',
        candidate: {
          mealName: 'Over target',
          calories: 1200,
          proteinG: 20,
          carbsG: 50,
          fatG: 15,
          ingredients: [{ name: 'Synthetic' }],
        },
      }),
      /680–920/
    );
    assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: meal.id } })).status, 'PENDING_REVIEW');
    const { NutritionistReviewService } = await import('../src/services/nutritionist-review.service');
    const excessive = await prisma.mealPlan.create({
      data: {
        userId: user.id,
        planGroupId,
        mealName: 'Over target dinner',
        mealType: 'DINNER',
        calories: 1111,
        proteinG: 38,
        carbsG: 100,
        fatG: 62,
        scheduledDate: new Date(),
        claimedByNutritionistId: reviewerId,
        claimedAt: new Date(),
      },
    });
    await assert.rejects(NutritionistReviewService.approveMealPlan(reviewerId, excessive.id), /510–690/);
    assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: excessive.id } })).status, 'PENDING_REVIEW');
    const replacement = await NutritionistReplacementService.replaceAndApproveMealPlan(reviewerId, meal.id, {
      reason: 'Synthetic replacement regression',
      candidate: {
        mealName: 'Different synthetic recipe',
        calories: 800,
        proteinG: 20,
        carbsG: 50,
        fatG: 15,
        ingredients: [{ name: 'Synthetic ingredient', dataSource: 'FNRI' }],
      },
    });
    const saved = await prisma.mealPlan.findUniqueOrThrow({
      where: { id: replacement.replacementPlanId },
      include: { ingredients: true },
    });
    assert.equal(saved.status, 'PENDING_REVIEW');
    assert.equal(saved.highRiskReviewRequired, true);
    assert.equal(saved.reviewApprovalCount, 1);
    assert.equal(saved.firstApprovedByNutritionistId, reviewerId);
    assert.equal(saved.planType, 'STARTER');
    assert.equal(saved.ingredients[0].dataSource, 'GEMINI_ESTIMATED');
    console.log(
      'PASS: >256 KB applicant submission, signature persistence/validation, and fresh high-risk replacement review chain. Synthetic database and captured email only.'
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
