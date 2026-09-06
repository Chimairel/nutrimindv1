import prisma from '@/lib/prisma';
import { calculateDailyTarget } from '@/lib/calculations';
import {
  Goal,
  ActivityLevel,
  DietaryPreference,
  CarbPreference,
  HealthConditionType,
  HealthProfileRevisionType,
  Prisma,
} from '@prisma/client';
import { evaluateOnboardingStatus } from '@/domain/onboarding.policy';

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
}

export class UserProfileService {
  static async updateUserProfile(userId: string, data: ProfileUpdateData) {
    const safeData: ProfileUpdateData = {};
    const supportedFields: (keyof ProfileUpdateData)[] = [
      'age',
      'biologicalSex',
      'heightCm',
      'weightKg',
      'targetWeightKg',
      'goal',
      'activityLevel',
      'dietaryPreference',
      'carbPreference',
      'foodCulture',
    ];
    for (const field of supportedFields) {
      if (data[field] !== undefined) {
        (safeData as Record<string, unknown>)[field] = data[field];
      }
    }

    return prisma.$transaction(async (tx) => {
      const profile = await tx.userProfile.upsert({
        where: { userId },
        update: safeData,
        create: {
          userId,
          ...safeData,
        },
      });
      await tx.healthProfileRevision.create({
        data: {
          userId,
          revisionType: HealthProfileRevisionType.BODY_DIET_UPDATED,
          snapshot: safeData as Prisma.InputJsonObject,
        },
      });
      return profile;
    });
  }

  /**
   * Updates user health conditions atomically within a transaction.
   */
  static async saveShoppingDay(userId: string, shoppingDayOfWeek: number) {
    if (!Number.isInteger(shoppingDayOfWeek) || shoppingDayOfWeek < 0 || shoppingDayOfWeek > 6) {
      throw new Error('Shopping day must be an integer from Sunday (0) to Saturday (6).');
    }
    const shoppingDayGroup = shoppingDayOfWeek === 0 || shoppingDayOfWeek === 6 ? 'WEEKEND' : 'WEEKDAY';
    return prisma.userProfile.upsert({
      where: { userId },
      update: { shoppingDayGroup, shoppingDayOfWeek },
      create: { userId, shoppingDayGroup, shoppingDayOfWeek },
    });
  }

  /**
   * Accepts the Terms of Service.

   */
  static async acceptTos(userId: string, termsVersion: string, privacyVersion: string) {
    const acceptedAt = new Date();
    return prisma.user.update({
      where: { id: userId },
      data: {
        tosAccepted: true,
        tosAcceptedAt: acceptedAt,
        acceptedTermsVersion: termsVersion,
        acceptedPrivacyVersion: privacyVersion,
        healthDataConsentedAt: acceptedAt,
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userProfile: true,
        healthConditions: { select: { condition: true } },
        allergies: { select: { allergen: true } },
      },
    });

    if (!user?.userProfile) {
      throw new Error('User profile must be initialized before completing onboarding.');
    }

    const onboardingStatus = evaluateOnboardingStatus({
      onboardingDone: user.onboardingDone,
      tosAccepted: user.tosAccepted,
      acceptedTermsVersion: user.acceptedTermsVersion,
      acceptedPrivacyVersion: user.acceptedPrivacyVersion,
      profile: user.userProfile,
      conditions: user.healthConditions.map((item) => item.condition),
      allergies: user.allergies.map((item) => item.allergen),
    });
    if (!onboardingStatus.readyToComplete) {
      throw new Error(`Onboarding is incomplete. Continue at ${onboardingStatus.nextPath}.`);
    }

    const profile = user.userProfile;

    // Verify critical statistics exist
    const { age, heightCm, weightKg, goal, activityLevel, biologicalSex } = profile;
    if (!age || !heightCm || !weightKg || !goal || !activityLevel || !biologicalSex) {
      throw new Error('Onboarding statistics are incomplete.');
    }

    const hasPregnantCondition = user.healthConditions.some((c) => c.condition === HealthConditionType.PREGNANT);

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
        acceptedTermsVersion: true,
        acceptedPrivacyVersion: true,
        healthDataConsentedAt: true,
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
        safetyProfileEntries: {
          orderBy: [{ domain: 'asc' }, { displayName: 'asc' }],
          select: {
            domain: true,
            canonicalCode: true,
            displayName: true,
            originalText: true,
            normalizedText: true,
            provenance: true,
            supportState: true,
            policyReference: true,
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

    const onboardingStatus = evaluateOnboardingStatus({
      onboardingDone: user.onboardingDone,
      tosAccepted: user.tosAccepted,
      acceptedTermsVersion: user.acceptedTermsVersion,
      acceptedPrivacyVersion: user.acceptedPrivacyVersion,
      profile: user.userProfile,
      conditions: user.healthConditions.map((item) => item.condition),
      allergies: user.allergies.map((item) => item.allergen),
    });

    // Transform into clean structure for client
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      tosAccepted: user.tosAccepted,
      tosAcceptedAt: user.tosAcceptedAt,
      acceptedTermsVersion: user.acceptedTermsVersion,
      acceptedPrivacyVersion: user.acceptedPrivacyVersion,
      healthDataConsentedAt: user.healthDataConsentedAt,
      onboardingDone: user.onboardingDone,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      userProfile: user.userProfile,
      healthConditions: user.healthConditions.map((c) => c.condition),
      allergies: user.allergies.map((a) => a.allergen),
      safetyEntries: user.safetyProfileEntries,
      nutritionReport: user.nutritionReport,
      onboardingStatus,
    };
  }
}
