import assert from 'node:assert/strict';
import {
  ActivityLevel,
  DietaryPreference,
  Goal,
  MealPlanCycleStatus,
  MealPlanStatus,
  MealType,
  PlanType,
  ProfileCycleAdaptationState,
  RicePreference,
  Role,
} from '@prisma/client';
import prisma from '../src/lib/prisma';
import { getStartOfManilaBusinessDay } from '../src/domain/meal-actionability.policy';
import { UserProfileService } from '../src/services/user-profile.service';
import { NutritionReportService } from '../src/services/nutrition-report.service';
import { SafetyIntakeService } from '../src/services/safety-intake.service';
import { ProfileCycleAdaptationService } from '../src/services/profile-cycle-adaptation.service';

const DAY = 86_400_000;

function atDay(base: Date, offset: number) {
  return new Date(base.getTime() + offset * DAY);
}

async function main() {
  const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const user = await prisma.user.create({
    data: {
      name: 'Batch Two Acceptance',
      email: `batch2-${key}@example.invalid`,
      passwordHash: 'fixture-not-a-login',
      role: Role.USER,
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      userProfile: {
        create: {
          age: 25,
          biologicalSex: 'MALE',
          heightCm: 170,
          weightKg: 70,
          targetWeightKg: 70,
          goal: Goal.MAINTAIN,
          activityLevel: ActivityLevel.ACTIVE,
          dietaryPreference: DietaryPreference.OMNIVORE,
          foodCulture: 'Filipino',
          shoppingDayOfWeek: 6,
          shoppingDayGroup: 'WEEKEND',
          dailyCalorieTarget: 2400,
        },
      },
      nutritionReport: {
        create: {
          profileRevision: 0,
          version: 1,
          acknowledgedAt: new Date(),
          foodsToAvoid: [],
          foodsToLimit: [],
          foodsRecommended: [],
          drinksGuidance: [],
          generalSummary: 'Acceptance fixture.',
          basedOnConditions: [],
          basedOnAllergies: [],
        },
      },
      nutritionReportVersions: {
        create: {
          version: 1,
          profileRevision: 0,
          acknowledgedAt: new Date(),
          content: {},
          profileSnapshot: {},
        },
      },
    },
  });

  try {
    const today = getStartOfManilaBusinessDay();
    const baseProfile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } });
    const cycles = [
      { id: `batch2-active-${key}`, start: -1, end: 5, status: MealPlanCycleStatus.ACTIVE, shopping: null },
      { id: `batch2-upcoming-${key}`, start: 7, end: 13, status: MealPlanCycleStatus.READY_TO_SHOP, shopping: null },
      {
        id: `batch2-frozen-${key}`,
        start: 14,
        end: 20,
        status: MealPlanCycleStatus.SHOPPING_STARTED,
        shopping: new Date(),
      },
    ];
    for (const cycle of cycles) {
      await prisma.mealPlanCycle.create({
        data: {
          id: cycle.id,
          userId: user.id,
          planType: PlanType.WEEKLY,
          startDate: atDay(today, cycle.start),
          endDate: atDay(today, cycle.end),
          preparationOpensAt: atDay(today, cycle.start - 3),
          shoppingDeadlineAt: atDay(today, cycle.start - 1),
          expectedSlotCount: 1,
          status: cycle.status,
          shoppingStartedAt: cycle.shopping,
          snapshot: {
            create: {
              userId: user.id,
              profileRevision: baseProfile.revision,
              safetyRevision: baseProfile.safetyRevision,
              weightKg: baseProfile.weightKg!,
              activityLevel: baseProfile.activityLevel!,
              goal: baseProfile.goal!,
              dailyCalorieTarget: baseProfile.dailyCalorieTarget!,
              dailyMacroTargets: { proteinG: 120, carbsG: 300, fatG: 80 },
              dietaryPreference: baseProfile.dietaryPreference,
              ricePreference: baseProfile.ricePreference,
              ricePreferenceProvenance: baseProfile.ricePreferenceProvenance,
              foodCulture: baseProfile.foodCulture,
              planningGeographyLevel: baseProfile.planningGeographyLevel,
              planningRegionName: baseProfile.planningRegionName,
              planningProvinceHucName: baseProfile.planningProvinceHucName,
              mealLocalityPreference: baseProfile.mealLocalityPreference,
              shoppingDayGroup: baseProfile.shoppingDayGroup,
              shoppingDayOfWeek: baseProfile.shoppingDayOfWeek,
            },
          },
        },
      });
    }
    await prisma.mealPlan.create({
      data: {
        planGroupId: cycles[0].id,
        userId: user.id,
        status: MealPlanStatus.APPROVED,
        mealType: MealType.BREAKFAST,
        mealName: 'Acceptance Breakfast',
        calories: 500,
        proteinG: 25,
        carbsG: 60,
        fatG: 18,
        scheduledDate: today,
        requiresSafetyRevalidation: false,
      },
    });

    const first = await UserProfileService.updateUserProfile(user.id, { weightKg: 71 });
    assert.equal(first.revision, 1);
    const afterOrdinary = await prisma.mealPlanCycle.findMany({ where: { userId: user.id } });
    assert.equal(
      afterOrdinary.find((cycle) => cycle.id === cycles[0].id)?.profileAdaptationState,
      ProfileCycleAdaptationState.CURRENT
    );
    assert.equal(
      afterOrdinary.find((cycle) => cycle.id === cycles[1].id)?.profileAdaptationState,
      ProfileCycleAdaptationState.AWAITING_REPORT_ACKNOWLEDGMENT
    );
    assert.equal(
      afterOrdinary.find((cycle) => cycle.id === cycles[2].id)?.profileAdaptationState,
      ProfileCycleAdaptationState.CURRENT
    );
    const activeSnapshot = await prisma.mealPlanCycleSnapshot.findUniqueOrThrow({
      where: { planGroupId: cycles[0].id },
    });
    assert.equal(activeSnapshot.weightKg, 70);
    assert.equal(activeSnapshot.profileRevision, 0);

    const auditCount = await prisma.healthProfileRevision.count({ where: { userId: user.id } });
    const identical = await UserProfileService.updateUserProfile(user.id, { weightKg: 71 });
    assert.equal(identical.revision, 1);
    assert.equal(await prisma.healthProfileRevision.count({ where: { userId: user.id } }), auditCount);

    await publishFixtureReport(user.id, 2, 1);
    await NutritionReportService.acknowledgeReport(user.id, 2);
    assert.equal(
      (await prisma.mealPlanCycle.findUniqueOrThrow({ where: { id: cycles[1].id } })).profileAdaptationState,
      ProfileCycleAdaptationState.REBUILD_REQUIRED
    );

    const riceUpdated = await UserProfileService.updateUserProfile(user.id, {
      ricePreference: RicePreference.WITH_RICE,
    });
    assert.equal(riceUpdated.ricePreference, RicePreference.WITH_RICE);
    assert.equal(riceUpdated.ricePreferenceProvenance, 'USER_SELECTED');

    const shoppingUpdated = await UserProfileService.updateUserProfile(user.id, { shoppingDayOfWeek: 5 });
    await publishFixtureReport(user.id, 3, shoppingUpdated.revision);
    await NutritionReportService.acknowledgeReport(user.id, 3);
    assert.equal(
      (await prisma.mealPlanCycle.findUniqueOrThrow({ where: { id: cycles[1].id } })).status,
      MealPlanCycleStatus.SUPERSEDED
    );
    assert.equal(
      (await prisma.mealPlanCycle.findUniqueOrThrow({ where: { id: cycles[2].id } })).status,
      MealPlanCycleStatus.SHOPPING_STARTED
    );

    const safety = await SafetyIntakeService.save(user.id, [
      { domain: 'CONDITION', value: 'HYPERTENSION', provenance: 'PREDEFINED' },
    ]);
    assert.equal(safety.changed, true);
    const safetyProfile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } });
    const activeAfterSafety = await prisma.mealPlanCycle.findUniqueOrThrow({ where: { id: cycles[0].id } });
    assert.equal(activeAfterSafety.status, MealPlanCycleStatus.REVALIDATION_REQUIRED);
    assert.equal(activeAfterSafety.profileAdaptationState, ProfileCycleAdaptationState.SAFETY_REVALIDATION_REQUIRED);
    assert.equal(
      (await prisma.mealPlan.findFirstOrThrow({ where: { planGroupId: cycles[0].id } })).requiresSafetyRevalidation,
      true
    );

    await publishFixtureReport(user.id, 4, safetyProfile.revision);
    await NutritionReportService.acknowledgeReport(user.id, 4);
    assert.equal(
      (await prisma.mealPlanCycle.findUniqueOrThrow({ where: { id: cycles[0].id } })).profileAdaptationState,
      ProfileCycleAdaptationState.SAFETY_REVALIDATION_REQUIRED
    );

    await prisma.mealPlan.updateMany({
      where: { planGroupId: cycles[0].id },
      data: { status: MealPlanStatus.APPROVED, requiresSafetyRevalidation: false },
    });
    await prisma.$transaction((tx) => ProfileCycleAdaptationService.reconcileSafetyCycles(tx, user.id));
    assert.equal(
      (await prisma.mealPlanCycle.findUniqueOrThrow({ where: { id: cycles[0].id } })).profileAdaptationState,
      ProfileCycleAdaptationState.CURRENT
    );

    console.log(
      JSON.stringify(
        {
          ordinaryRevision: 1,
          identicalSaveRevision: identical.revision,
          activeSnapshotWeightKg: activeSnapshot.weightKg,
          upcomingAfterAcknowledgment: ProfileCycleAdaptationState.REBUILD_REQUIRED,
          shoppingDayUpcomingStatus: MealPlanCycleStatus.SUPERSEDED,
          frozenUpcomingStatus: MealPlanCycleStatus.SHOPPING_STARTED,
          ricePreference: riceUpdated.ricePreference,
          safetyRevision: safetyProfile.safetyRevision,
          safetyGateReleasedAfterAcknowledgmentAndRevalidation: true,
        },
        null,
        2
      )
    );
  } finally {
    await prisma.user.deleteMany({ where: { id: user.id } });
    await prisma.$disconnect();
  }
}

async function publishFixtureReport(userId: string, version: number, profileRevision: number) {
  const generatedAt = new Date();
  await prisma.$transaction([
    prisma.nutritionReportVersion.create({
      data: { userId, version, profileRevision, generatedAt, content: {}, profileSnapshot: {} },
    }),
    prisma.nutritionReport.update({
      where: { userId },
      data: { version, profileRevision, generatedAt, isStale: false, acknowledgedAt: null },
    }),
  ]);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
