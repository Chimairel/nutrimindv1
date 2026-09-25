import assert from 'node:assert/strict';
import prisma from '@/lib/prisma';
import { NutritionistReviewService } from '@/services/nutritionist-review.service';

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55479');
  assert.equal(target.pathname, '/nutrimind_review_claim');

  const user = await prisma.user.create({ data: {
    name: 'Review claim fixture', email: 'review-claim-user@nutrimind.invalid',
    passwordHash: 'fixture-only', emailVerified: true,
    userProfile: { create: {
      age: 30, biologicalSex: 'FEMALE', heightCm: 160, weightKg: 60,
      goal: 'MAINTAIN', activityLevel: 'LIGHTLY_ACTIVE', dietaryPreference: 'OMNIVORE',
      dailyCalorieTarget: 1800, shoppingDayGroup: 'WEEKEND', shoppingDayOfWeek: 6,
    } },
    healthConditions: { create: { condition: 'NONE' } },
    allergies: { create: { allergen: 'NONE' } },
  } });
  const reviewers = await Promise.all([1, 2].map(async (index) => {
    const account = await prisma.user.create({ data: {
      name: `Fixture RND ${index}`, email: `review-claim-rnd-${index}@nutrimind.invalid`,
      passwordHash: 'fixture-only', emailVerified: true, role: 'NUTRITIONIST',
      nutritionistProfile: { create: {
        prcLicenseNumber: `FIXTURE-REVIEW-${index}`, prcLicenseExpiry: new Date('2030-01-01'), isVerified: true,
      } },
    } });
    return prisma.nutritionistProfile.findUniqueOrThrow({ where: { userId: account.id } });
  }));
  const startDate = new Date(Date.now() + 86_400_000);
  const cycle = await prisma.mealPlanCycle.create({ data: {
    id: 'review-claim-fixture-cycle', userId: user.id, planType: 'WEEKLY',
    startDate, endDate: new Date(startDate.getTime() + 6 * 86_400_000),
    preparationOpensAt: new Date(Date.now() - 86_400_000),
    shoppingDeadlineAt: new Date(Date.now() + 12 * 3_600_000),
    expectedSlotCount: 1, status: 'UNDER_REVIEW',
  } });
  const meal = await prisma.mealPlan.create({ data: {
    planGroupId: cycle.id, userId: user.id, mealType: 'LUNCH', mealName: 'Review claim fixture meal',
    status: 'PENDING_REVIEW', calories: 450, proteinG: 25, carbsG: 50, fatG: 15,
    scheduledDate: startDate,
  } });

  const preview = await NutritionistReviewService.getReviewCardDetails(reviewers[0].id, meal.id);
  assert.equal(preview.claimStatus.claimedByMe, false);
  assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: meal.id } })).claimedByNutritionistId, null);

  const claimed = await NutritionistReviewService.getReviewCardDetails(reviewers[0].id, meal.id, true);
  assert.equal(claimed.claimStatus.claimedByMe, true);
  await assert.rejects(NutritionistReviewService.getReviewCardDetails(reviewers[1].id, meal.id, true), /already claimed/);
  await assert.rejects(NutritionistReviewService.releaseReviewClaim(reviewers[1].id, meal.id), /no longer hold/);
  assert.equal((await NutritionistReviewService.releaseReviewClaim(reviewers[0].id, meal.id)).released, true);
  await assert.rejects(NutritionistReviewService.releaseReviewClaim(reviewers[0].id, meal.id), /no longer hold/);
  assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: meal.id } })).claimedByNutritionistId, null);
  assert.equal((await NutritionistReviewService.getReviewCardDetails(reviewers[1].id, meal.id, true)).claimStatus.claimedByMe, true);
  assert.equal(await prisma.auditEvent.count({ where: { entityId: meal.id, action: 'MEAL_PLAN_REVIEW_CLAIM_RELEASED' } }), 1);
  console.log('Preview, explicit claim, exclusive ownership, immediate release, and peer reclaim passed.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
