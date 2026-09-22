import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { MealPlanCycleStatus } from '@prisma/client';
import { createFixturePlanCycle } from './helpers/plan-cycle-fixture';

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55465');
  assert.equal(target.pathname, '/nutrimind_ui_tests');
  assert.equal(process.env.NODE_ENV, 'test');
  const { default: prisma } = await import('../src/lib/prisma');
  const { default: app } = await import('../src/app');
  const passwordHash = await bcrypt.hash('LocalUiAccount123!', 4);
  for (const role of ['USER', 'NUTRITIONIST', 'ADMIN'] as const) {
    const email = `${role.toLowerCase()}-ui@example.test`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name: `${role} UI Fixture`,
        passwordHash,
        role,
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        acceptedTermsVersion: '2026-08-27',
        acceptedPrivacyVersion: '2026-08-27',
      },
    });
    if (role === 'NUTRITIONIST')
      await prisma.nutritionistProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          prcLicenseNumber: 'UI-TEST-ONLY',
          prcLicenseExpiry: new Date('2028-01-01'),
          isVerified: true,
        },
      });
    if (role !== 'USER') continue;
    const profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        age: 25,
        biologicalSex: 'MALE',
        heightCm: 170,
        weightKg: 65,
        targetWeightKg: 65,
        goal: 'MAINTAIN',
        activityLevel: 'ACTIVE',
        dietaryPreference: 'OMNIVORE',
        carbPreference: 'MODERATE',
        foodCulture: 'Filipino',
        shoppingDayOfWeek: 0,
        dailyCalorieTarget: 2000,
        planningGeographyLevel: 'PROVINCE_HUC',
        planningRegionName: 'Central Visayas',
        planningProvinceHucName: 'Cebu City',
        mealLocalityPreference: 'NATIONAL_REGIONAL',
      },
    });
    await prisma.nutritionReport.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        profileRevision: profile.revision,
        acknowledgedAt: new Date(),
        foodsToAvoid: [],
        foodsToLimit: [],
        foodsRecommended: [],
        drinksGuidance: [],
        generalSummary: 'Synthetic UI report',
        basedOnConditions: [],
        basedOnAllergies: [],
      },
    });
    if (!(await prisma.mealPlan.count({ where: { userId: user.id } }))) {
      if (!(await prisma.mealPlanCycle.findUnique({ where: { id: 'ui-test-plan' } }))) {
        await createFixturePlanCycle(prisma, {
          id: 'ui-test-plan',
          userId: user.id,
          status: MealPlanCycleStatus.ACTIVE,
        });
      }
      for (const mealType of ['BREAKFAST', 'LUNCH', 'DINNER'] as const)
        await prisma.mealPlan.create({
          data: {
            userId: user.id,
            planGroupId: 'ui-test-plan',
            mealType,
            mealName: `Synthetic ${mealType.toLowerCase()} meal`,
            scheduledDate: new Date(),
            status: 'PENDING_REVIEW',
            calories: 500,
            proteinG: 25,
            carbsG: 60,
            fatG: 15,
          },
        });
      for (const status of ['DONE', 'SKIPPED'] as const)
        await prisma.mealLog.create({
          data: {
            userId: user.id,
            source: 'USER_LOGGED',
            status,
            mealName: `Synthetic ${status.toLowerCase()} meal`,
            calories: 500,
            proteinG: 25,
            carbsG: 60,
            fatG: 15,
            mealType: 'LUNCH',
            dataSource: 'USER_REPORTED',
          },
        });
    }
  }
  app.listen(5015, '127.0.0.1', () => console.log('Disposable UI fixture API ready on 5015.'));
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Fixture setup failed');
  process.exitCode = 1;
});
