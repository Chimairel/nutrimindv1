import prisma from '@/lib/prisma';
import { calculateDailyTarget } from '@/lib/calculations';
import { 
  Goal, 
  ActivityLevel, 
  DietaryPreference, 
  CarbPreference, 
  HealthConditionType, 
  AllergenType 
} from '@prisma/client';

interface ProfileUpdateData {
  age?: number;
  biologicalSex?: string;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  goal?: Goal;
  activityLevel?: ActivityLevel;
  dietaryPreference?: DietaryPreference;
  carbPreference?: CarbPreference;
  foodCulture?: string;
  otherConditions?: string;
  otherAllergies?: string;
}

export class UserService {
  /**
   * Updates or creates the user's base profile settings.
   */
  static async updateUserProfile(userId: string, data: ProfileUpdateData) {
    const profile = await prisma.userProfile.upsert({
      where: { userId },
      update: {
        ...data,
      },
      create: {
        userId,
        ...data,
      },
    });
    return profile;
  }

  /**
   * Updates user health conditions atomically within a transaction.
   */
  static async updateHealthConditions(userId: string, conditions: HealthConditionType[]) {
    // Perform operations in a database transaction to ensure atomicity
    await prisma.$transaction(async (tx) => {
      // 1. Delete all existing conditions
      await tx.healthCondition.deleteMany({
        where: { userId },
      });

      // 2. Create the new conditions
      if (conditions.length > 0) {
        await tx.healthCondition.createMany({
          data: conditions.map((cond) => ({
            userId,
            condition: cond,
          })),
        });
      }
    });

    // Fetch and return updated conditions
    return prisma.healthCondition.findMany({
      where: { userId },
    });
  }

  /**
   * Updates user allergens atomically within a transaction.
   */
  static async updateAllergies(userId: string, allergies: AllergenType[]) {
    await prisma.$transaction(async (tx) => {
      // 1. Delete all existing allergies
      await tx.allergy.deleteMany({
        where: { userId },
      });

      // 2. Create the new allergies
      if (allergies.length > 0) {
        await tx.allergy.createMany({
          data: allergies.map((allg) => ({
            userId,
            allergen: allg,
          })),
        });
      }
    });

    // Fetch and return updated allergies
    return prisma.allergy.findMany({
      where: { userId },
    });
  }

  /**
   * Saves custom free-text health conditions to the user's profile.
   * This is separate from the enum-based healthConditions table.
   */
  static async updateOtherConditions(userId: string, otherConditions: string) {
    return prisma.userProfile.upsert({
      where: { userId },
      update: { otherConditions },
      create: { userId, otherConditions },
    });
  }

  /**
   * Saves custom free-text food allergies to the user's profile.
   * This is separate from the enum-based allergies table.
   */
  static async updateOtherAllergies(userId: string, otherAllergies: string) {
    return prisma.userProfile.upsert({
      where: { userId },
      update: { otherAllergies },
      create: { userId, otherAllergies },
    });
  }

  /**
   * Saves the user's preferred shopping day group.
   * WEEKEND → weekly cycle runs Sunday to Saturday.
   * WEEKDAY → weekly cycle runs Monday to Sunday.
   */
  static async saveShoppingDay(userId: string, shoppingDayGroup: 'WEEKEND' | 'WEEKDAY') {
    return prisma.userProfile.upsert({
      where: { userId },
      update: { shoppingDayGroup },
      create: { userId, shoppingDayGroup },
    });
  }

  /**
   * Accepts the Terms of Service.

   */
  static async acceptTos(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        tosAccepted: true,
        tosAcceptedAt: new Date(),
      },
    });
  }

  /**
   * Updates the user's avatar image seed or custom URL.
   */
  static async updateUserImage(userId: string, image: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { image },
    });
  }

  /**
   * Finalizes user onboarding by:
   * 1. Pulling their latest profile and health conditions.
   * 2. Calculating BMR/TDEE and setting the target daily calories.
   * 3. Updating the profile with the calculated target and setting onboardingDone = true.
   */
  static async completeOnboarding(userId: string) {
    // 1. Fetch User profile and clinical conditions
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new Error('User profile must be initialized before completing onboarding.');
    }

    // Verify critical statistics exist
    const { age, heightCm, weightKg, goal, activityLevel, biologicalSex } = profile;
    if (!age || !heightCm || !weightKg || !goal || !activityLevel) {
      throw new Error('Onboarding stats (age, height, weight, goal, activityLevel) are incomplete.');
    }

    const healthConditions = await prisma.healthCondition.findMany({
      where: { userId },
    });

    const hasPregnantCondition = healthConditions.some(
      (c) => c.condition === HealthConditionType.PREGNANT
    );

    // 2. Run calorie target calculations using biologicalSex from profile
    const calculations = calculateDailyTarget({
      age,
      heightCm,
      weightKg,
      goal,
      activityLevel,
      biologicalSex: biologicalSex as 'MALE' | 'FEMALE' | undefined,
      hasPregnantCondition,
    });

    // 3. Persist targets and flag onboarding as complete
    await prisma.$transaction([
      prisma.userProfile.update({
        where: { userId },
        data: {
          dailyCalorieTarget: calculations.dailyCalorieTarget,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: {
          onboardingDone: true,
        },
      }),
    ]);

    return {
      dailyCalorieTarget: calculations.dailyCalorieTarget,
      onboardingDone: true,
    };
  }

  /**
   * Fetches the complete dynamic User details (with Profile, Conditions, Allergies, NutritionReport)
   * to fully support client-side AuthContext synchronization.
   */
  static async getUserProfileDetails(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        tosAccepted: true,
        tosAcceptedAt: true,
        onboardingDone: true,
        image: true,
        createdAt: true,
        updatedAt: true,
        userProfile: true,
        healthConditions: {
          select: {
            condition: true,
          },
        },
        allergies: {
          select: {
            allergen: true,
          },
        },
        nutritionReport: {
          select: {
            id: true,
            generatedAt: true,
            acknowledgedAt: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    // Transform into clean structure for client
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      tosAccepted: user.tosAccepted,
      tosAcceptedAt: user.tosAcceptedAt,
      onboardingDone: user.onboardingDone,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      userProfile: user.userProfile,
      healthConditions: user.healthConditions.map((c) => c.condition),
      allergies: user.allergies.map((a) => a.allergen),
      nutritionReport: user.nutritionReport,
    };
  }

  /**
   * Fetches the user-facing directory of verified nutritionists
   */
  static async getNutritionistDirectory() {
    return prisma.user.findMany({
      where: {
        role: 'NUTRITIONIST',
        nutritionistProfile: {
          isVerified: true,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        nutritionistProfile: {
          select: {
            prcLicenseNumber: true,
            specialization: true,
            yearsOfExperience: true,
            university: true,
            bio: true,
            rating: true,
            totalVerified: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
