import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/domain/onboarding.policy';
import { getScheduledMealDate, getManilaMidnight, getManilaDateKey } from '../src/domain/meal-plan-cycle.policy';
import { NutritionistService } from '../src/services/nutritionist.service';
import { certifyMealLibrarySafetySchema } from '../src/domain/meal-library-safety-review.schema';
import { GroceryService } from '../src/services/grocery.service';

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55463');
  assert.equal(target.pathname, '/nutrimind_audit');
  assert.equal(process.env.NODE_ENV, 'test');
  const passwordHash = await bcrypt.hash('SyntheticBrowser123!', 12);
  const accounts = [];
  for (const role of ['ADMIN', 'NUTRITIONIST', 'USER'] as const) {
    const user = await prisma.user.upsert({
      where: { email: 'repair-browser-' + role.toLowerCase() + '@example.invalid' },
      update: { passwordHash },
      create: {
        email: 'repair-browser-' + role.toLowerCase() + '@example.invalid',
        name: 'Repair ' + role,
        role,
        passwordHash,
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
        healthDataConsentedAt: new Date(),
        ...(role === 'USER'
          ? {
              userProfile: {
                create: {
                  age: 28,
                  biologicalSex: 'MALE',
                  heightCm: 170,
                  weightKg: 70,
                  targetWeightKg: 70,
                  goal: 'MAINTAIN',
                  activityLevel: 'LIGHTLY_ACTIVE',
                  dietaryPreference: 'OMNIVORE',
                  carbPreference: 'MODERATE',
                  foodCulture: 'Filipino',
                  dailyCalorieTarget: 2000,
                  shoppingDayOfWeek: 6,
                  shoppingDayGroup: 'WEEKEND',
                },
              },
              healthConditions: { create: { condition: 'NONE' } },
              allergies: { create: { allergen: 'NONE' } },
            }
          : {}),
        ...(role === 'NUTRITIONIST'
          ? {
              nutritionistProfile: {
                create: {
                  prcLicenseNumber: 'SYNTHETIC-BROWSER-RND',
                  prcLicenseExpiry: new Date('2099-12-31'),
                  isVerified: true,
                  university: 'Synthetic University',
                  specialization: 'Acceptance testing',
                },
              },
            }
          : {}),
      },
    });
    accounts.push(user);
  }
  const user = accounts[2];
  const reviewer = await prisma.nutritionistProfile.findUniqueOrThrow({ where: { userId: accounts[1].id } });
  const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } });
  const reportData = {
    generalSummary: 'Synthetic report for browser acceptance. Not clinical guidance.',
    foodsToAvoid: [],
    foodsToLimit: [],
    foodsRecommended: [],
    drinksGuidance: [],
    basedOnConditions: ['NONE'],
    basedOnAllergies: ['NONE'],
    profileRevision: profile.revision,
    isStale: false,
    acknowledgedAt: new Date(),
    version: 1,
  };
  await prisma.nutritionReport.upsert({
    where: { userId: user.id },
    update: reportData,
    create: { userId: user.id, ...reportData },
  });
  await prisma.nutritionReportVersion.upsert({
    where: { userId_version: { userId: user.id, version: 1 } },
    update: {},
    create: {
      userId: user.id,
      version: 1,
      profileRevision: profile.revision,
      content: JSON.parse(JSON.stringify(reportData)),
      profileSnapshot: {},
      policyVersion: 'SYNTHETIC_BROWSER_ONLY',
    },
  });
  const food = await prisma.foodItem.findFirstOrThrow({ where: { name: 'Egg, chicken, whole' } });
  for (const [index, quantity] of [300, 450].entries()) {
    const id = 'repair-browser-library-' + index;
    await prisma.mealLibrary.upsert({
      where: { id },
      update: {},
      create: {
        id,
        mealName: index ? 'Replacement egg plate' : 'Original egg plate',
        mealType: 'BREAKFAST',
        calories: 600,
        proteinG: 30,
        carbsG: 60,
        fatG: 20,
        dietaryTags: ['OMNIVORE', 'MAINTAIN'],
        status: 'APPROVED',
        verifiedByNutritionistId: reviewer.id,
        ingredients: {
          create: {
            ingredientName: food.name,
            foodItemId: food.id,
            dataSource: 'FNRI',
            quantity,
            unit: 'g',
            position: 0,
          },
        },
      },
    });
    const certification = await prisma.mealLibrary.findUniqueOrThrow({ where: { id } });
    if (certification.safetyEvidenceStatus !== 'COMPLETE')
      await NutritionistService.certifyLibraryMealSafety(
        reviewer.id,
        id,
        certifyMealLibrarySafetySchema.parse({
          expectedRevision: certification.safetyEvidenceRevision,
          conditionDeclarationState: 'REVIEWED_NONE_DECLARED',
          allergenDeclarationState: 'REVIEWED_NONE_DECLARED',
          crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
          suitableConditions: [],
          allergensPresent: [],
          allergensReviewedAbsent: [],
        })
      );
  }
  await prisma.mealPlan.upsert({
    where: { id: 'repair-browser-plan' },
    update: {
      status: 'APPROVED',
      requiresSafetyRevalidation: false,
      nutritionistId: reviewer.id,
      scheduledDate: getScheduledMealDate(getManilaMidnight(getManilaDateKey(new Date())), 0),
      mealName: 'Original egg plate',
      libraryMealId: 'repair-browser-library-0',
      ingredients: { updateMany: { where: {}, data: { quantity: 300 } } },
    },
    create: {
      id: 'repair-browser-plan',
      userId: user.id,
      planGroupId: 'repair-browser-current',
      libraryMealId: 'repair-browser-library-0',
      mealType: 'BREAKFAST',
      mealName: 'Original egg plate',
      calories: 600,
      proteinG: 30,
      carbsG: 60,
      fatG: 20,
      scheduledDate: getScheduledMealDate(getManilaMidnight(getManilaDateKey(new Date())), 0),
      status: 'APPROVED',
      requiresSafetyRevalidation: false,
      nutritionistId: reviewer.id,
      ingredients: {
        create: { ingredientName: food.name, foodItemId: food.id, dataSource: 'FNRI', quantity: 300, unit: 'g' },
      },
    },
  });
  await prisma.planSwapTracker.deleteMany({
    where: { userId: user.id, planGroupId: 'repair-browser-current' },
  });
  const list = await GroceryService.generateGroceryList(user.id);
  await GroceryService.recordPurchase(user.id, list.groceryItems[0].id, 300);
  console.log('Synthetic browser fixture ready for USER, NUTRITIONIST and ADMIN.');
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
