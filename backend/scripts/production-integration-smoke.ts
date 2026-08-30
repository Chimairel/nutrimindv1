import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  ActivityLevel,
  AIConfidenceFlag,
  DietaryPreference,
  Goal,
  MealIngredientDataSource,
  MealLibrarySafetyEvidenceStatus,
  MealLibraryStatus,
  MealLogDataSource,
  MealLogSource,
  MealLogStatus,
  MealPlanStatus,
  MealType,
  PlanType,
  Role,
} from '@prisma/client';
import prisma from '../src/lib/prisma';
import { NutritionistService } from '../src/services/nutritionist.service';
import { CheckinService } from '../src/services/checkin.service';
import { certifyMealLibrarySafetySchema } from '../src/domain/meal-library-safety-review.schema';
import AuthService from '../src/services/auth.service';
import { MealLogService } from '../src/services/meal-log.service';
import { getReviewClaimCutoff } from '../src/domain/nutritionist-review.policy';

const runId = randomUUID();
let syntheticUserId: string | null = null;
let syntheticMealId: string | null = null;
const syntheticReviewerUserIds: string[] = [];

async function cleanup() {
  if (syntheticMealId) {
    await prisma.$transaction([
      prisma.mealLibrarySafetyDeclaration.deleteMany({ where: { mealLibraryId: syntheticMealId } }),
      prisma.mealLibrarySafetyReview.deleteMany({ where: { mealLibraryId: syntheticMealId } }),
      prisma.mealLibraryFlag.deleteMany({ where: { mealLibraryId: syntheticMealId } }),
      prisma.mealLibraryIngredient.deleteMany({ where: { mealLibraryId: syntheticMealId } }),
    ]);
    await prisma.mealLibrary.deleteMany({ where: { id: syntheticMealId } });
  }
  if (syntheticUserId) {
    await prisma.user.deleteMany({ where: { id: syntheticUserId } });
  }
  if (syntheticReviewerUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: syntheticReviewerUserIds } } });
  }
}

async function main() {
  const reviewerUsers = await Promise.all([0, 1].map(async (index) => prisma.user.create({
    data: {
      name: `Integration Reviewer ${index + 1}`,
      email: `nutrimind-reviewer-${index + 1}-${runId}@example.invalid`,
      passwordHash: await bcrypt.hash('SmokeTest123', 12),
      role: Role.NUTRITIONIST,
      emailVerified: true,
      tosAccepted: true,
      onboardingDone: true,
      nutritionistProfile: {
        create: {
          prcLicenseNumber: `INTEGRATION-${index + 1}-${runId}`,
          prcLicenseExpiry: new Date('2099-12-31T00:00:00.000Z'),
          isVerified: true,
          verifiedAt: new Date(),
        },
      },
    },
    include: { nutritionistProfile: true },
  })));
  syntheticReviewerUserIds.push(...reviewerUsers.map((user) => user.id));
  const reviewer = reviewerUsers[0].nutritionistProfile!;
  const secondReviewer = reviewerUsers[1].nutritionistProfile!;

  const food = await prisma.foodItem.findFirst({
    where: { name: { equals: 'Egg, chicken, whole', mode: 'insensitive' } },
  });
  assert.ok(food, 'The seeded FNRI egg fixture is required.');

  const syntheticMeal = await prisma.mealLibrary.create({
    data: {
      mealName: `Integration omelet ${runId}`,
      description: 'Synthetic integration-only library evidence fixture.',
      mealType: MealType.BREAKFAST,
      calories: 155,
      proteinG: 13,
      carbsG: 1.1,
      fatG: 11,
      status: MealLibraryStatus.APPROVED,
      verifiedByNutritionistId: reviewer.id,
      ingredients: {
        create: {
          position: 0,
          ingredientName: food.name,
          category: food.category,
          dataSource: MealIngredientDataSource.FNRI,
          foodItemId: food.id,
        },
      },
    },
  });
  syntheticMealId = syntheticMeal.id;

  const certificationInput = certifyMealLibrarySafetySchema.parse({
    expectedRevision: 0,
    conditionDeclarationState: 'REVIEWED_NONE_DECLARED',
    allergenDeclarationState: 'REVIEWED_NONE_DECLARED',
    crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
    suitableConditions: [],
    allergensPresent: [],
    allergensReviewedAbsent: [],
  });
  const certified = await NutritionistService.certifyLibraryMealSafety(
    reviewer.id,
    syntheticMeal.id,
    certificationInput,
  );
  assert.equal(certified?.safetyEvidenceStatus, MealLibrarySafetyEvidenceStatus.COMPLETE);
  assert.equal(certified?.safetyEvidenceRevision, 1);
  assert.equal(certified?.certifiedEvidenceRevision, 1);

  const invalidated = await NutritionistService.editLibraryMeal(
    reviewerUsers[0].id,
    reviewerUsers[0].role,
    syntheticMeal.id,
    {
      mealName: `${syntheticMeal.mealName} revised`,
      description: syntheticMeal.description,
      calories: syntheticMeal.calories,
      proteinG: syntheticMeal.proteinG,
      carbsG: syntheticMeal.carbsG,
      fatG: syntheticMeal.fatG,
      dietaryTags: [],
    },
  );
  assert.equal(invalidated.safetyEvidenceStatus, MealLibrarySafetyEvidenceStatus.STALE);
  assert.equal(invalidated.safetyEvidenceRevision, 2);

  const syntheticUser = await prisma.user.create({
    data: {
      name: 'Production Integration Fixture',
      email: `nutrimind-smoke-${runId}@example.invalid`,
      passwordHash: await bcrypt.hash('SmokeTest123', 12),
      emailVerified: true,
      tosAccepted: true,
      onboardingDone: true,
      userProfile: {
        create: {
          age: 30,
          biologicalSex: 'MALE',
          heightCm: 170,
          weightKg: 70,
          targetWeightKg: 70,
          goal: Goal.MAINTAIN,
          activityLevel: ActivityLevel.LIGHTLY_ACTIVE,
          dietaryPreference: DietaryPreference.OMNIVORE,
          dailyCalorieTarget: 2200,
          shoppingDayOfWeek: 6,
        },
      },
    },
  });
  syntheticUserId = syntheticUser.id;

  const loginResult = await AuthService.login(syntheticUser.email, 'SmokeTest123');
  const rotated = await AuthService.refreshToken(loginResult.refreshToken);
  assert.notEqual(rotated.refreshToken, loginResult.refreshToken);
  await assert.rejects(() => AuthService.refreshToken(loginResult.refreshToken), /revoked|expired/i);
  assert.equal(await prisma.session.count({ where: { userId: syntheticUser.id } }), 1);

  const exactPreviewEstimate = {
    name: 'Synthetic preview meal',
    calories: 321,
    proteinG: 22,
    carbsG: 33,
    fatG: 11,
    sodium: 777,
    sugars: 4,
    ingredients: ['synthetic ingredient'],
  };
  const outsidePreview = await prisma.outsideMealPreview.create({
    data: {
      userId: syntheticUser.id,
      mealName: 'Synthetic preview meal',
      mealType: MealType.LUNCH,
      estimate: exactPreviewEstimate,
      warnings: ['CONDITION'],
      reasons: ['Synthetic integration warning.'],
      expiresAt: new Date(Date.now() + 60_000),
    },
  });
  const confirmedOutsideMeal = await MealLogService.logOutsideMeal({
    userId: syntheticUser.id,
    mealName: 'Synthetic preview meal',
    mealType: MealType.LUNCH,
    warningAcknowledged: true,
    confirmationId: outsidePreview.id,
  });
  assert.equal(confirmedOutsideMeal.warningRequired, false);
  assert.equal(confirmedOutsideMeal.log.calories, exactPreviewEstimate.calories);
  assert.equal(confirmedOutsideMeal.log.warningType, 'CONDITION');
  assert.ok((await prisma.outsideMealPreview.findUnique({ where: { id: outsidePreview.id } }))?.consumedAt);
  await assert.rejects(
    () => MealLogService.logOutsideMeal({
      userId: syntheticUser.id,
      mealName: 'Synthetic preview meal',
      mealType: MealType.LUNCH,
      warningAcknowledged: true,
      confirmationId: outsidePreview.id,
    }),
    /expired|already used/i,
  );

  const plannedMeal = await prisma.mealPlan.create({
    data: {
      planGroupId: `integration-idempotency-${runId}`,
      userId: syntheticUser.id,
      status: MealPlanStatus.APPROVED,
      mealType: MealType.BREAKFAST,
      mealName: 'Synthetic planned meal',
      calories: 400,
      proteinG: 20,
      carbsG: 50,
      fatG: 12,
      aiConfidenceFlag: AIConfidenceFlag.SAFE,
      planType: PlanType.WEEKLY,
      scheduledDate: new Date('2099-01-02T00:00:00.000Z'),
      requiresSafetyRevalidation: false,
      safetyPolicyVersion: 'NUTRIMIND_PLAN_SAFETY_V1',
    },
  });
  const plannedLogMutation = () => prisma.mealLog.upsert({
    where: { mealPlanId: plannedMeal.id },
    update: { status: MealLogStatus.PENDING },
    create: {
      userId: syntheticUser.id,
      mealPlanId: plannedMeal.id,
      source: MealLogSource.SYSTEM_GENERATED,
      mealName: plannedMeal.mealName,
      calories: plannedMeal.calories,
      proteinG: plannedMeal.proteinG,
      carbsG: plannedMeal.carbsG,
      fatG: plannedMeal.fatG,
      dataSource: MealLogDataSource.FNRI,
      status: MealLogStatus.PENDING,
    },
  });
  await Promise.all([plannedLogMutation(), plannedLogMutation()]);
  assert.equal(await prisma.mealLog.count({ where: { mealPlanId: plannedMeal.id } }), 1);

  const aggregateDate = new Date('2099-01-02T00:00:00.000Z');
  const aggregateMutation = () => prisma.dailyNutritionLog.upsert({
    where: { userId_logDate: { userId: syntheticUser.id, logDate: aggregateDate } },
    update: { totalCalories: 400 },
    create: {
      userId: syntheticUser.id,
      logDate: aggregateDate,
      totalCalories: 400,
      totalProteinG: 20,
      totalCarbsG: 50,
      totalFatG: 12,
      targetCalories: 2200,
      adherencePct: 18.18,
    },
  });
  await Promise.all([aggregateMutation(), aggregateMutation()]);
  assert.equal(
    await prisma.dailyNutritionLog.count({
      where: { userId: syntheticUser.id, logDate: aggregateDate },
    }),
    1,
  );

  const reviewMeal = await prisma.mealPlan.create({
    data: {
      planGroupId: `integration-review-${runId}`,
      userId: syntheticUser.id,
      status: MealPlanStatus.PENDING_REVIEW,
      mealType: MealType.DINNER,
      mealName: 'Synthetic review claim meal',
      calories: 500,
      proteinG: 25,
      carbsG: 60,
      fatG: 18,
      aiConfidenceFlag: AIConfidenceFlag.CAUTION,
      planType: PlanType.WEEKLY,
      scheduledDate: new Date('2099-01-03T00:00:00.000Z'),
      requiresSafetyRevalidation: true,
      safetyPolicyVersion: 'NUTRIMIND_PLAN_SAFETY_V1',
    },
  });
  const claimResults = await Promise.allSettled([
    NutritionistService.getReviewCardDetails(reviewer.id, reviewMeal.id),
    NutritionistService.getReviewCardDetails(secondReviewer.id, reviewMeal.id),
  ]);
  assert.equal(claimResults.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(claimResults.filter((result) => result.status === 'rejected').length, 1);
  const claimOwner = (await prisma.mealPlan.findUnique({ where: { id: reviewMeal.id } }))?.claimedByNutritionistId;
  assert.ok(claimOwner === reviewer.id || claimOwner === secondReviewer.id);
  const nextReviewer = claimOwner === reviewer.id ? secondReviewer : reviewer;
  await prisma.mealPlan.update({
    where: { id: reviewMeal.id },
    data: { claimedAt: new Date(getReviewClaimCutoff().getTime() - 1) },
  });
  await NutritionistService.getReviewCardDetails(nextReviewer.id, reviewMeal.id);
  assert.equal(
    (await prisma.mealPlan.findUnique({ where: { id: reviewMeal.id } }))?.claimedByNutritionistId,
    nextReviewer.id,
  );

  const checkinResults = await Promise.all([
    CheckinService.submitCheckin(syntheticUser.id, { changed: false }),
    CheckinService.submitCheckin(syntheticUser.id, { changed: false }),
  ]);
  assert.equal(checkinResults.filter((result) => result.duplicate === false).length, 1);
  assert.equal(checkinResults.filter((result) => result.duplicate === true).length, 1);
  assert.equal(await prisma.weeklyCheckin.count({ where: { userId: syntheticUser.id } }), 1);

  const cycleStartDate = new Date('2099-01-01T16:00:00.000Z');
  const jobResults = await Promise.allSettled([
    prisma.mealPlanGenerationJob.create({
      data: { userId: syntheticUser.id, planType: PlanType.WEEKLY, cycleStartDate },
    }),
    prisma.mealPlanGenerationJob.create({
      data: { userId: syntheticUser.id, planType: PlanType.WEEKLY, cycleStartDate },
    }),
  ]);
  assert.equal(jobResults.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(jobResults.filter((result) => result.status === 'rejected').length, 1);
  assert.equal(
    await prisma.mealPlanGenerationJob.count({
      where: { userId: syntheticUser.id, planType: PlanType.WEEKLY, cycleStartDate },
    }),
    1,
  );

  console.log('[Integration] Exact preview persistence, write idempotency, atomic claims, refresh rotation, certification, invalidation, check-in idempotency, and generation contention passed.');
}

main()
  .finally(cleanup)
  .finally(() => prisma.$disconnect());
