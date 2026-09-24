import 'dotenv/config';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../src/domain/onboarding.policy';
import { getCurrentWeeklyCycleWindow, getNextWeeklyCycleWindow } from '../src/domain/meal-plan-cycle.policy';
import { getStartOfManilaBusinessDay } from '../src/domain/meal-actionability.policy';
import { queryEligibleLibraryMeals } from '../src/services/meal-library-candidate-query.service';
import { GroceryService } from '../src/services/grocery.service';

const runId = process.env.BATCH10_BROWSER_RUN_ID;
assert.ok(runId && /^[a-z0-9-]{8,64}$/.test(runId), 'A unique BATCH10_BROWSER_RUN_ID is required.');
const email = (role: string) => `batch10-browser-${role}-${runId}@example.invalid`;

async function cleanup() {
  const users = await prisma.user.findMany({
    where: { email: { in: ['user', 'nutritionist', 'admin', 'onboarding', 'report'].map(email) } },
    select: { id: true },
  });
  for (const user of users) await prisma.user.delete({ where: { id: user.id } });
  console.log(`[Batch 10 browser fixture] removed ${users.length} accounts`);
}

async function create() {
  assert.equal(
    await prisma.user.count({
      where: { email: { in: ['user', 'nutritionist', 'admin', 'onboarding', 'report'].map(email) } },
    }),
    0,
    'Fixture identity already exists; clean it before creating again.'
  );
  const passwordHash = await bcrypt.hash('SyntheticBrowser123!', 12);
  try {
    for (const role of ['USER', 'NUTRITIONIST', 'ADMIN'] as const) {
      const account = await prisma.user.create({
        data: {
          email: email(role.toLowerCase()),
          name: `Batch 10 ${role}`,
          passwordHash,
          role,
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
                    biologicalSex: 'FEMALE',
                    heightCm: 160,
                    weightKg: 60,
                    targetWeightKg: 60,
                    goal: 'MAINTAIN' as const,
                    activityLevel: 'LIGHTLY_ACTIVE' as const,
                    dietaryPreference: 'OMNIVORE' as const,
                    dailyCalorieTarget: 1300,
                    shoppingDayOfWeek: 6,
                  },
                },
                healthConditions: { create: { condition: 'NONE' as const } },
                allergies: { create: { allergen: 'NONE' as const } },
              }
            : {}),
          ...(role === 'NUTRITIONIST'
            ? {
                nutritionistProfile: {
                  create: {
                    prcLicenseNumber: `BATCH10-BROWSER-${runId}`,
                    prcLicenseExpiry: new Date('2030-12-31T00:00:00Z'),
                    isVerified: true,
                    verifiedAt: new Date(),
                    canLeadReview: true,
                  },
                },
              }
            : {}),
        },
      });
      if (role === 'USER') {
        const report = {
          generalSummary: 'Synthetic report for browser journey testing.',
          foodsToAvoid: [],
          foodsToLimit: [],
          foodsRecommended: [],
          drinksGuidance: [],
          basedOnConditions: ['NONE'],
          basedOnAllergies: ['NONE'],
          profileRevision: 0,
          isStale: false,
          acknowledgedAt: new Date(),
          version: 1,
        };
        await prisma.nutritionReport.create({ data: { userId: account.id, ...report } });
        const candidates = await queryEligibleLibraryMeals({
          mealType: 'BREAKFAST',
          dailyCalorieTarget: 1300,
          userConditions: ['NONE'],
          userAllergens: ['NONE'],
          profile: {
            userId: account.id,
            dietaryPreference: 'OMNIVORE',
            otherConditions: null,
            otherAllergies: null,
          },
          limit: 20,
        });
        assert.ok(candidates.length >= 2, 'Browser swap journey needs two existing certified breakfasts.');
        const [original, favorite] = candidates;
        await prisma.mealFavorite.create({ data: { userId: account.id, mealLibraryId: favorite.id } });
        const now = new Date();
        const today = getStartOfManilaBusinessDay(now);
        const windows = [getCurrentWeeklyCycleWindow(6, now), getNextWeeklyCycleWindow(6, now)];
        for (const [index, window] of windows.entries()) {
          const cycleId = `batch10-browser-${index === 0 ? 'current' : 'upcoming'}-${runId}`;
          await prisma.mealPlanCycle.create({
            data: {
              id: cycleId,
              userId: account.id,
              planType: 'WEEKLY',
              startDate: window.startDate,
              endDate: window.endDate,
              preparationOpensAt: new Date(window.startDate.getTime() - 4 * 86_400_000),
              shoppingDeadlineAt: new Date(window.startDate.getTime() - 86_400_000),
              expectedSlotCount: 1,
              status: index === 0 ? 'ACTIVE' : 'UNDER_REVIEW',
              ...(index === 0 ? { deadlineOutcome: 'COMPLETE' as const } : {}),
            },
          });
          await prisma.mealPlan.create({
            data: {
              planGroupId: cycleId,
              userId: account.id,
              libraryMealId: original.id,
              status: 'APPROVED',
              planType: 'WEEKLY',
              mealType: 'BREAKFAST',
              mealName: original.mealName,
              calories: original.calories,
              proteinG: original.proteinG,
              carbsG: original.carbsG,
              fatG: original.fatG,
              scheduledDate: index === 0 ? today : window.startDate,
              reviewedAt: now,
              requiresSafetyRevalidation: false,
              safetyPolicyVersion: 'MEAL_PLAN_SAFETY_V2',
              baseRecipeSignature: original.recipeSignature,
              composedServingSignature: original.recipeSignature,
              ingredients: {
                create: original.ingredients.map((ingredient) => ({
                  ingredientName: ingredient.ingredientName,
                  category: ingredient.category,
                  quantity: ingredient.quantity,
                  unit: ingredient.unit,
                  foodItemId: ingredient.foodItemId,
                  dataSource: ingredient.dataSource,
                })),
              },
            },
          });
          await GroceryService.generateGroceryList(account.id, undefined, cycleId);
        }
      }
    }
    await prisma.user.create({
      data: {
        email: email('onboarding'),
        name: 'Batch 10 New Patient',
        passwordHash,
        role: 'USER',
        emailVerified: true,
      },
    });
    await prisma.user.create({
      data: {
        email: email('report'),
        name: 'Batch 10 Report Patient',
        passwordHash,
        role: 'USER',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
        healthDataConsentedAt: new Date(),
        userProfile: {
          create: {
            age: 28,
            biologicalSex: 'FEMALE',
            heightCm: 160,
            weightKg: 60,
            targetWeightKg: 60,
            goal: 'MAINTAIN',
            activityLevel: 'LIGHTLY_ACTIVE',
            dietaryPreference: 'OMNIVORE',
            dailyCalorieTarget: 2000,
            shoppingDayOfWeek: 6,
          },
        },
        healthConditions: { create: { condition: 'NONE' } },
        allergies: { create: { allergen: 'NONE' } },
        nutritionReport: {
          create: {
            profileRevision: 0,
            isStale: false,
            version: 1,
            acknowledgedAt: null,
            generalSummary: 'Synthetic unacknowledged report for browser gate testing.',
            foodsToAvoid: [],
            foodsToLimit: [],
            foodsRecommended: [],
            drinksGuidance: [],
            basedOnConditions: ['NONE'],
            basedOnAllergies: ['NONE'],
          },
        },
      },
    });
    console.log('[Batch 10 browser fixture] three role accounts, new patient, and report patient ready');
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function main() {
  try {
    if (process.argv[2] === 'create') await create();
    else if (process.argv[2] === 'cleanup') await cleanup();
    else throw new Error('Expected create or cleanup.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[Batch 10 browser fixture] FAIL', error);
  process.exitCode = 1;
});
