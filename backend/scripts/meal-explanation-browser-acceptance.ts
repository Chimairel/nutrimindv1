import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma';

const email = 'meal-explanation-browser@example.invalid';
const password = 'JourneyUser123!';

async function main() {
  await prisma.user.deleteMany({ where: { email } });
  if (process.argv.includes('--cleanup')) {
    console.log(JSON.stringify({ outcome: 'CLEANED' }));
    return;
  }
  const user = await prisma.user.create({
    data: {
      name: 'Meal Explanation Browser User',
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'USER',
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      acceptedTermsVersion: '2026-08-27',
      acceptedPrivacyVersion: '2026-08-27',
      healthDataConsentedAt: new Date(),
      userProfile: {
        create: {
          age: 24,
          biologicalSex: 'MALE',
          heightCm: 170,
          weightKg: 70,
          targetWeightKg: 74,
          goal: 'GAIN_WEIGHT',
          activityLevel: 'LIGHTLY_ACTIVE',
          dietaryPreference: 'OMNIVORE',
          carbPreference: 'MODERATE',
          foodCulture: 'Filipino',
          planningGeographyLevel: 'PROVINCE_HUC',
          planningRegionName: 'Central Visayas',
          planningProvinceHucName: 'Cebu City',
          mealLocalityPreference: 'LOCAL',
          dailyCalorieTarget: 2780,
          shoppingDayGroup: 'WEEKDAY',
          shoppingDayOfWeek: 6,
        },
      },
      healthConditions: { create: { condition: 'NONE' } },
      allergies: { create: { allergen: 'NONE' } },
      nutritionReport: {
        create: {
          acknowledgedAt: new Date(),
          foodsToAvoid: [],
          foodsToLimit: [],
          foodsRecommended: [],
          drinksGuidance: [],
          generalSummary: 'Synthetic browser acceptance report.',
          basedOnConditions: ['NONE'],
          basedOnAllergies: ['NONE'],
        },
      },
    },
  });
  const food = await prisma.foodItem.findFirstOrThrow();
  const meal = await prisma.mealPlan.create({
    data: {
      planGroupId: `browser-explanation-${user.id}`,
      userId: user.id,
      status: 'APPROVED',
      mealType: 'LUNCH',
      mealName: 'Cebu evidence acceptance bowl',
      description: 'Synthetic meal used only for browser acceptance.',
      calories: 1100,
      proteinG: 42,
      carbsG: 146,
      fatG: 28,
      aiConfidenceFlag: 'SAFE',
      planType: 'WEEKLY',
      scheduledDate: new Date(Date.now() + 86_400_000),
      requiresSafetyRevalidation: false,
      selectionEvidence: {
        schemaVersion: 1,
        source: 'AI_GENERATED',
        dailyCalorieTarget: 2780,
        slotCalorieTarget: 1112,
        slotCalorieLower: 945,
        slotCalorieUpper: 1279,
        localityPreference: 'LOCAL',
        planningLocationLabel: 'Cebu City local preference',
        consumptionEvidenceScope: null,
        consumptionEvidenceRelease: null,
        capturedAt: new Date().toISOString(),
      },
      ingredients: {
        create: {
          ingredientName: food.name,
          foodItemId: food.id,
          category: food.category,
          dataSource: 'FNRI',
          quantity: 100,
          unit: 'g',
        },
      },
    },
  });
  console.log(JSON.stringify({ email, password, mealId: meal.id }));
}

main().finally(() => prisma.$disconnect());
