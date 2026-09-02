import 'dotenv/config';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {
  ActivityLevel,
  DietaryPreference,
  Goal,
  Role,
  ShoppingDayGroup,
} from '@prisma/client';
import prisma from '../src/lib/prisma';
import { COMMON_MEAL_CATALOGUE } from '../src/data/common-meal-catalogue';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../src/domain/onboarding.policy';
import { isUserActionableMealPlan } from '../src/domain/meal-actionability.policy';
import { AdminService } from '../src/services/admin.service';
import { CheckinService } from '../src/services/checkin.service';
import { MealSwapService } from '../src/services/meal-swap.service';

const FIXTURE_EMAIL = 'e2e.library.reuse@example.com';
const FIXTURE_PASSWORD = 'LibraryReuse123';
const SNAPSHOT_ACTION = 'E2E_LIBRARY_REUSE_SNAPSHOT';
const catalogueNames = COMMON_MEAL_CATALOGUE.map((meal) => meal.mealName);

type UsageSnapshot = { id: string; usageCount: number };

function currentManilaDayOfWeek(): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
  }).format(new Date());
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
}

async function restoreAndRemoveFixture() {
  const fixture = await prisma.user.findUnique({ where: { email: FIXTURE_EMAIL } });
  const snapshot = await prisma.auditEvent.findFirst({
    where: { action: SNAPSHOT_ACTION, entityId: FIXTURE_EMAIL },
    orderBy: { createdAt: 'desc' },
  });

  const metadata = snapshot?.metadata as { usage?: UsageSnapshot[] } | null;
  if (Array.isArray(metadata?.usage)) {
    await prisma.$transaction(
      metadata.usage.map((entry) => prisma.mealLibrary.update({
        where: { id: entry.id },
        data: { usageCount: entry.usageCount },
      }))
    );
  }

  if (fixture) await prisma.user.delete({ where: { id: fixture.id } });
  await prisma.auditEvent.deleteMany({
    where: { action: SNAPSHOT_ACTION, entityId: FIXTURE_EMAIL },
  });
}

async function setup() {
  await restoreAndRemoveFixture();

  const catalogue = await prisma.mealLibrary.findMany({
    where: { mealName: { in: catalogueNames } },
    select: { id: true, mealName: true, usageCount: true, safetyEvidenceStatus: true, status: true },
  });
  assert.equal(catalogue.length, 30, 'The 30-meal common catalogue must be populated first.');
  assert.ok(catalogue.every((meal) => meal.status === 'APPROVED' && meal.safetyEvidenceStatus === 'COMPLETE'));

  const day = currentManilaDayOfWeek();
  assert.ok(day >= 0, 'Could not resolve the Manila weekday.');
  const shoppingDayOfWeek = (day + 6) % 7;
  const now = new Date();
  const passwordHash = await bcrypt.hash(FIXTURE_PASSWORD, 12);

  const fixture = await prisma.user.create({
    data: {
      name: 'Library Reuse Acceptance User',
      email: FIXTURE_EMAIL,
      passwordHash,
      role: Role.USER,
      emailVerified: true,
      tosAccepted: true,
      tosAcceptedAt: now,
      acceptedTermsVersion: CURRENT_TERMS_VERSION,
      acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
      healthDataConsentedAt: now,
      onboardingDone: true,
      userProfile: {
        create: {
          age: 28,
          biologicalSex: 'FEMALE',
          heightCm: 160,
          weightKg: 58,
          targetWeightKg: 58,
          goal: Goal.MAINTAIN,
          activityLevel: ActivityLevel.LIGHTLY_ACTIVE,
          dietaryPreference: DietaryPreference.OMNIVORE,
          carbPreference: 'MODERATE',
          foodCulture: 'Flexible Filipino and everyday meals',
          dailyCalorieTarget: 1900,
          shoppingDayOfWeek,
          shoppingDayGroup: shoppingDayOfWeek === 0 || shoppingDayOfWeek === 6
            ? ShoppingDayGroup.WEEKEND
            : ShoppingDayGroup.WEEKDAY,
        },
      },
      healthConditions: { create: { condition: 'NONE' } },
      allergies: { create: { allergen: 'NONE' } },
      nutritionReport: {
        create: {
          acknowledgedAt: now,
          foodsToAvoid: [],
          foodsToLimit: [],
          foodsRecommended: [],
          drinksGuidance: [],
          generalSummary: 'Synthetic acceptance fixture for verified-library reuse.',
          basedOnConditions: ['NONE'],
          basedOnAllergies: ['NONE'],
        },
      },
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorUserId: fixture.id,
      action: SNAPSHOT_ACTION,
      entityType: 'AcceptanceFixture',
      entityId: FIXTURE_EMAIL,
      metadata: {
        aiUsageCount: await prisma.aiUsageEvent.count(),
        usage: catalogue.map(({ id, usageCount }) => ({ id, usageCount })),
      },
    },
  });

  console.log(JSON.stringify({
    ready: true,
    email: FIXTURE_EMAIL,
    password: FIXTURE_PASSWORD,
    shoppingDayOfWeek,
    expectedPlanType: 'WEEKLY',
  }, null, 2));
}

async function verify() {
  const fixture = await prisma.user.findUnique({ where: { email: FIXTURE_EMAIL } });
  assert.ok(fixture, 'Run this script with --setup first.');
  const snapshot = await prisma.auditEvent.findFirst({
    where: { action: SNAPSHOT_ACTION, entityId: FIXTURE_EMAIL },
    orderBy: { createdAt: 'desc' },
  });
  assert.ok(snapshot, 'Acceptance snapshot is missing.');
  const metadata = snapshot.metadata as { aiUsageCount?: number };

  const plan = await prisma.mealPlan.findMany({
    where: { userId: fixture.id },
    include: {
      ingredients: true,
      mealLogs: { where: { userId: fixture.id } },
      libraryMeal: {
        include: {
          safetyDeclarations: true,
          safetyReviewedByNutritionist: { include: { user: true } },
        },
      },
    },
    orderBy: [{ scheduledDate: 'asc' }, { mealType: 'asc' }],
  });
  assert.equal(plan.length, 21, 'A full weekly acceptance plan must contain 21 slots.');
  assert.ok(plan.every((meal) => meal.planType === 'WEEKLY'));
  assert.ok(plan.every((meal) => meal.status === 'APPROVED'));
  assert.ok(plan.every((meal) => meal.libraryMealId !== null));
  assert.ok(plan.every((meal) => meal.ingredients.length > 0));
  assert.ok(plan.every((meal) => meal.libraryMeal?.safetyReviewedByNutritionist?.user.name));

  const grocery = await prisma.groceryList.findFirst({
    where: { userId: fixture.id },
    include: { groceryItems: true },
    orderBy: { generatedAt: 'desc' },
  });
  assert.ok(grocery && grocery.groceryItems.length > 0, 'Grocery projection must be automatic.');
  assert.equal(await prisma.aiUsageEvent.count(), metadata.aiUsageCount, 'Gemini usage changed during a fully matched plan.');

  const [allergies, swapTracker, checkinStatus, doneMeals, analytics] = await Promise.all([
    prisma.allergy.findMany({ where: { userId: fixture.id }, select: { allergen: true } }),
    prisma.planSwapTracker.findFirst({ where: { userId: fixture.id }, select: { swapsUsed: true } }),
    CheckinService.getCheckinStatus(fixture.id),
    prisma.mealLog.count({ where: { userId: fixture.id, status: 'DONE' } }),
    AdminService.getAnalytics(),
  ]);
  assert.equal(checkinStatus.isDue, false, 'A first-week user must not be prompted for a weekly check-in.');
  assert.ok(analytics.activeMealPlans >= plan.length, 'Admin analytics did not include the active plan.');
  assert.ok(analytics.totalMealLogs >= doneMeals, 'Admin analytics did not include fixture meal logs.');

  const swappableSlot = plan.find((meal) => isUserActionableMealPlan(meal) && !meal.mealLogs.some(
    (log) => log.status === 'DONE' || log.status === 'SKIPPED'
  ));
  assert.ok(swappableSlot, 'No unlogged slot was available for the swap-option acceptance check.');
  const swapOptions = await MealSwapService.getEligibleSwapOptions(fixture.id, swappableSlot.id);
  const otherPlanMealIds = new Set(plan
    .filter((meal) => meal.id !== swappableSlot.id)
    .map((meal) => meal.libraryMealId)
    .filter((id): id is string => Boolean(id)));
  assert.ok(swapOptions.swapOptions.every((option) => option.id !== swappableSlot.libraryMealId));
  assert.ok(swapOptions.swapOptions.every((option) => !otherPlanMealIds.has(option.id)));
  const allergyKeys = allergies.map((item) => item.allergen);
  const uniqueLibraryMeals = new Set(plan.map((meal) => meal.libraryMealId)).size;
  if (allergyKeys.every((allergy) => allergy === 'NONE')) {
    assert.equal(uniqueLibraryMeals, 21, 'The initial healthy plan must not repeat library meals.');
  }
  if (allergyKeys.includes('EGGS')) {
    const eggConflicts = plan.filter((meal) => meal.libraryMeal?.safetyDeclarations.some(
      (declaration) => declaration.declarationType === 'ALLERGEN_PRESENT' && declaration.canonicalKey === 'EGGS'
    ));
    assert.equal(eggConflicts.length, 0, 'Egg-containing meals remained after the safety scan.');

    const occurrences = new Map<string, number[]>();
    plan.forEach((meal) => {
      if (!meal.libraryMealId) return;
      const dates = occurrences.get(meal.libraryMealId) || [];
      dates.push(meal.scheduledDate.getTime());
      occurrences.set(meal.libraryMealId, dates);
    });
    for (const dates of occurrences.values()) {
      dates.sort((a, b) => a - b);
      for (let index = 1; index < dates.length; index += 1) {
        assert.ok(dates[index] - dates[index - 1] >= 3 * 86_400_000, 'A replacement meal repeated within three days.');
      }
    }
  }

  const statusCounts = plan.reduce<Record<string, number>>((counts, meal) => {
    counts[meal.mealType] = (counts[meal.mealType] || 0) + 1;
    return counts;
  }, {});
  console.log(JSON.stringify({
    passed: true,
    planSlots: plan.length,
    uniqueLibraryMeals,
    mealTypes: statusCounts,
    pendingReview: plan.filter((meal) => meal.status === 'PENDING_REVIEW').length,
    verifiedBy: [...new Set(plan.map((meal) => meal.libraryMeal?.safetyReviewedByNutritionist?.user.name))],
    groceryItems: grocery.groceryItems.length,
    geminiCallsRecorded: 0,
    allergies: allergyKeys,
    eggConflicts: 0,
    swapsUsed: swapTracker?.swapsUsed ?? 0,
    completedMealLogs: doneMeals,
    firstWeekCheckinDue: checkinStatus.isDue,
    nextCheckinDueAt: checkinStatus.nextDueAt,
    eligibleNonDuplicateSwaps: swapOptions.swapOptions.length,
    adminAnalytics: {
      activeMealPlans: analytics.activeMealPlans,
      totalMealLogs: analytics.totalMealLogs,
      completeLibraryEvidence: analytics.completeLibraryEvidence,
    },
  }, null, 2));
}

async function acknowledgeFixtureReport() {
  const fixture = await prisma.user.findUnique({
    where: { email: FIXTURE_EMAIL },
    include: { healthConditions: true, allergies: true },
  });
  assert.ok(fixture, 'Run this script with --setup first.');
  await prisma.nutritionReport.update({
    where: { userId: fixture.id },
    data: {
      acknowledgedAt: new Date(),
      basedOnConditions: fixture.healthConditions.map((item) => item.condition),
      basedOnAllergies: fixture.allergies.map((item) => item.allergen),
    },
  });
  console.log(JSON.stringify({ acknowledged: true, email: FIXTURE_EMAIL }, null, 2));
}

async function main() {
  const mode = process.argv[2];
  if (mode === '--setup') return setup();
  if (mode === '--verify') return verify();
  if (mode === '--acknowledge-report') return acknowledgeFixtureReport();
  if (mode === '--cleanup') {
    await restoreAndRemoveFixture();
    console.log(JSON.stringify({ cleaned: true, email: FIXTURE_EMAIL }, null, 2));
    return;
  }
  throw new Error('Use --setup, --verify, --acknowledge-report, or --cleanup.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
