import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  ActivityLevel,
  Goal,
  MealLocalityPreference,
  MealPlanCycleStatus,
  MealPlanStatus,
  MealType,
  PlanType,
  Prisma,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { getScheduledMealDate } from '@/domain/meal-plan-cycle.policy';
import { MealPlanCycleService } from '@/services/meal-plan-cycle.service';
import { GroceryService } from '@/services/grocery.service';

async function main() {
  const suffix = randomUUID();
  const email = `plan-cycle-${suffix}@example.invalid`;
  let userId: string | null = null;

  try {
    const now = new Date();
    const today = MealPlanCycleService.getBusinessDay(now);
    const currentStart = getScheduledMealDate(today, -6);
    const upcomingStart = getScheduledMealDate(today, 1);
    const user = await prisma.user.create({
      data: {
        name: 'Plan Cycle Acceptance',
        email,
        passwordHash: 'fixture-only-not-a-login-secret',
        emailVerified: true,
        onboardingDone: true,
        userProfile: {
          create: {
            age: 25,
            biologicalSex: 'FEMALE',
            heightCm: 160,
            weightKg: 55,
            goal: Goal.MAINTAIN,
            activityLevel: ActivityLevel.ACTIVE,
            dailyCalorieTarget: 2000,
            shoppingDayOfWeek: 6,
          },
        },
      },
    });
    userId = user.id;

    const currentId = `acceptance-current-${suffix}`;
    await prisma.mealPlanCycle.create({
      data: {
        id: currentId,
        userId: user.id,
        planType: PlanType.WEEKLY,
        startDate: currentStart,
        endDate: today,
        preparationOpensAt: getScheduledMealDate(currentStart, -4),
        shoppingDeadlineAt: getScheduledMealDate(currentStart, -1),
        expectedSlotCount: 3,
        status: MealPlanCycleStatus.ACTIVE,
        activatedAt: now,
        snapshot: {
          create: {
            userId: user.id,
            profileRevision: 0,
            safetyRevision: 0,
            weightKg: 55,
            activityLevel: ActivityLevel.ACTIVE,
            goal: Goal.MAINTAIN,
            dailyCalorieTarget: 2000,
            dailyMacroTargets: {},
            planningGeographyLevel: 'NATIONAL',
            mealLocalityPreference: MealLocalityPreference.NATIONAL,
            shoppingDayOfWeek: 6,
          },
        },
      },
    });
    await prisma.mealPlan.create({
      data: {
        planGroupId: currentId,
        userId: user.id,
        status: MealPlanStatus.APPROVED,
        planType: PlanType.WEEKLY,
        mealType: MealType.BREAKFAST,
        mealName: 'Acceptance Breakfast',
        calories: 500,
        proteinG: 20,
        carbsG: 60,
        fatG: 15,
        scheduledDate: today,
        requiresSafetyRevalidation: false,
      },
    });
    const grocery = await prisma.groceryList.create({
      data: {
        userId: user.id,
        planGroupId: currentId,
        weekLabel: 'Acceptance cycle',
        groceryItems: { create: { ingredientName: 'Acceptance rice', quantity: 100, unit: 'g' } },
      },
      include: { groceryItems: true },
    });

    assert.equal((await MealPlanCycleService.getCurrentCycle(user.id, now))?.id, currentId);
    await prisma.userProfile.update({ where: { userId: user.id }, data: { shoppingDayOfWeek: 2 } });
    assert.equal(
      (await MealPlanCycleService.getCurrentCycle(user.id, now))?.id,
      currentId,
      'A live shopping-day edit must not relocate the authoritative current cycle.'
    );

    await prisma.$transaction((tx) =>
      MealPlanCycleService.recordShoppingStarted(tx, user.id, currentId, now)
    );
    assert.ok((await prisma.mealPlanCycle.findUniqueOrThrow({ where: { id: currentId } })).shoppingStartedAt);
    assert.equal(grocery.groceryItems.length, 1);
    await prisma.mealPlan.create({
      data: {
        planGroupId: currentId,
        userId: user.id,
        status: MealPlanStatus.APPROVED,
        planType: PlanType.WEEKLY,
        mealType: MealType.LUNCH,
        mealName: 'Late Approved Lunch',
        calories: 500,
        proteinG: 20,
        carbsG: 60,
        fatG: 15,
        scheduledDate: today,
        requiresSafetyRevalidation: false,
        ingredients: { create: { ingredientName: 'Late approval ingredient', quantity: 1, unit: 'pc' } },
      },
    });
    await prisma.groceryList.update({ where: { id: grocery.id }, data: { isStale: true } });
    const frozenGrocery = await GroceryService.generateGroceryList(user.id, undefined, currentId);
    assert.equal(frozenGrocery.groceryItems.length, 1);
    assert.equal(
      frozenGrocery.groceryItems.some((item) => item.ingredientName === 'Late approval ingredient'),
      false
    );

    const upcomingId = `acceptance-upcoming-${suffix}`;
    await prisma.mealPlanCycle.create({
      data: {
        id: upcomingId,
        userId: user.id,
        planType: PlanType.WEEKLY,
        startDate: upcomingStart,
        endDate: getScheduledMealDate(upcomingStart, 6),
        preparationOpensAt: getScheduledMealDate(upcomingStart, -4),
        shoppingDeadlineAt: getScheduledMealDate(upcomingStart, -1),
        expectedSlotCount: 21,
        status: MealPlanCycleStatus.READY_TO_SHOP,
        readyAt: now,
      },
    });
    const identities = await MealPlanCycleService.getCurrentAndUpcoming(user.id, now);
    assert.equal(identities.current?.id, currentId);
    assert.equal(identities.upcoming?.id, upcomingId);

    await assert.rejects(
      prisma.mealPlanCycle.create({
        data: {
          id: `acceptance-duplicate-${suffix}`,
          userId: user.id,
          planType: PlanType.WEEKLY,
          cycleRevision: 2,
          startDate: upcomingStart,
          endDate: getScheduledMealDate(upcomingStart, 6),
          preparationOpensAt: getScheduledMealDate(upcomingStart, -4),
          shoppingDeadlineAt: getScheduledMealDate(upcomingStart, -1),
          expectedSlotCount: 21,
          status: MealPlanCycleStatus.UNDER_REVIEW,
        },
      }),
      (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    );

    const afterPromotion = await MealPlanCycleService.getCurrentCycle(
      user.id,
      new Date(upcomingStart.getTime() + 60 * 60 * 1000)
    );
    assert.equal(afterPromotion?.id, upcomingId);
    assert.equal(afterPromotion?.status, MealPlanCycleStatus.ACTIVE);
    assert.equal(
      (await prisma.mealPlanCycle.findUniqueOrThrow({ where: { id: currentId } })).status,
      MealPlanCycleStatus.COMPLETED
    );

    console.log(
      JSON.stringify({
        success: true,
        currentIdentitySurvivedProfileEdit: true,
        currentAndUpcomingResolvedIndependently: true,
        duplicateLiveIdentityRejected: true,
        promotionIdempotent: true,
        shoppingStartRecorded: true,
        shoppingListFrozenAfterStart: true,
      })
    );
  } finally {
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
