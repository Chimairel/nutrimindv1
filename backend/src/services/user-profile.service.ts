import { googleProfileImage } from '@/domain/google-profile-image';
import prisma from '@/lib/prisma';
import { lockUserProfile, advanceProfileRevision, advanceSafetyRevision } from './profile-revision.service';
import { calculateDailyTarget } from '@/lib/calculations';
import {
  Goal,
  ActivityLevel,
  DietaryPreference,
  CarbPreference,
  ConsumptionGeographyLevel,
  MealLocalityPreference,
  HealthConditionType,
  HealthProfileRevisionType,
  Prisma,
} from '@prisma/client';
import { evaluateOnboardingStatus } from '@/domain/onboarding.policy';
import { getCanonicalRegionName } from '@/data/philippine-planning-geography';
import { introducesHardDietRestriction } from '@/domain/profile-update-policy';

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
  planningGeographyLevel?: ConsumptionGeographyLevel;
  planningRegionName?: string | null;
  planningProvinceHucName?: string | null;
  mealLocalityPreference?: MealLocalityPreference;
  shoppingDayOfWeek?: number;
}

type OnboardingEvaluationInput = Parameters<typeof evaluateOnboardingStatus>[0];
type OnboardingEvaluationUser = Omit<OnboardingEvaluationInput, 'profile' | 'conditions' | 'allergies'> & {
  userProfile: OnboardingEvaluationInput['profile'];
  healthConditions: Array<{ condition: string }>;
  allergies: Array<{ allergen: string }>;
};

function evaluateUserOnboardingStatus(user: OnboardingEvaluationUser) {
  return evaluateOnboardingStatus({
    onboardingDone: user.onboardingDone,
    tosAccepted: user.tosAccepted,
    acceptedTermsVersion: user.acceptedTermsVersion,
    acceptedPrivacyVersion: user.acceptedPrivacyVersion,
    profile: user.userProfile,
    conditions: user.healthConditions.map((item) => item.condition),
    allergies: user.allergies.map((item) => item.allergen),
  });
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
      'planningGeographyLevel',
      'planningRegionName',
      'planningProvinceHucName',
      'mealLocalityPreference',
    ];
    for (const field of supportedFields) {
      if (data[field] !== undefined) {
        (safeData as Record<string, unknown>)[field] = data[field];
      }
    }

    if (data.shoppingDayOfWeek !== undefined) {
      const day = Number(data.shoppingDayOfWeek);
      if (Number.isInteger(day) && day >= 0 && day <= 6) {
        (safeData as Record<string, unknown>).shoppingDayOfWeek = day;
        (safeData as Record<string, unknown>).shoppingDayGroup = day === 0 || day === 6 ? 'WEEKEND' : 'WEEKDAY';
      }
    }

    if (safeData.planningRegionName) {
      const canonical = getCanonicalRegionName(safeData.planningRegionName);
      if (canonical) safeData.planningRegionName = canonical;
    }
    return prisma.$transaction(
      async (tx) => {
        await lockUserProfile(tx, userId);
        const existing = await tx.userProfile.findUnique({
          where: { userId },
        });
        const effectiveLevel =
          safeData.planningGeographyLevel ?? existing?.planningGeographyLevel ?? ConsumptionGeographyLevel.NATIONAL;
        const effectiveRegion =
          safeData.planningRegionName !== undefined ? safeData.planningRegionName : existing?.planningRegionName;
        const effectiveProvinceHuc =
          safeData.planningProvinceHucName !== undefined
            ? safeData.planningProvinceHucName
            : existing?.planningProvinceHucName;
        const requestedLocality =
          safeData.mealLocalityPreference ?? existing?.mealLocalityPreference ?? MealLocalityPreference.NATIONAL;

        if (effectiveLevel === ConsumptionGeographyLevel.NATIONAL || !effectiveRegion) {
          safeData.planningRegionName = null;
          safeData.planningProvinceHucName = null;
          safeData.mealLocalityPreference = MealLocalityPreference.NATIONAL;
        } else if (effectiveLevel === ConsumptionGeographyLevel.REGION || !effectiveProvinceHuc) {
          safeData.planningProvinceHucName = null;
          safeData.mealLocalityPreference =
            requestedLocality === MealLocalityPreference.LOCAL ||
            requestedLocality === MealLocalityPreference.REGIONAL_LOCAL
              ? MealLocalityPreference.REGIONAL
              : requestedLocality;
        } else {
          safeData.mealLocalityPreference = requestedLocality;
        }

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
        const changed =
          !existing ||
          Object.entries(safeData).some(([key, value]) => existing[key as keyof typeof existing] !== value);
        if (!changed) return profile;
        return introducesHardDietRestriction(existing?.dietaryPreference, profile.dietaryPreference)
          ? advanceSafetyRevision(tx, userId)
          : advanceProfileRevision(tx, userId);
      },
      { maxWait: 10000, timeout: 30000 }
    );
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
  static async updateUserImage(userId: string, image: string | null) {
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

    const onboardingStatus = evaluateUserOnboardingStatus(user);
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
    await prisma.$transaction(
      async (tx) => {
        await lockUserProfile(tx, userId);
        const current = await tx.userProfile.findUniqueOrThrow({ where: { userId } });
        if (current.revision !== profile.revision) throw new Error('Profile changed. Retry onboarding completion.');
        let reportProfileRevision = current.revision;
        if (current.dailyCalorieTarget !== calculations.dailyCalorieTarget) {
          const revised = await advanceProfileRevision(tx, userId);
          reportProfileRevision = revised.revision;
        }
        await tx.user.update({ where: { id: userId }, data: { onboardingDone: true } });

        // Upsert baseline nutrition report with acknowledgedAt so user is immediately ready for dashboard
        const now = new Date();
        await tx.nutritionReport.upsert({
          where: { userId },
          create: {
            userId,
            profileRevision: reportProfileRevision,
            isStale: false,
            version: 1,
            acknowledgedAt: now,
            generalSummary: `Initial nutritional baseline established. Daily calorie target: ${calculations.dailyCalorieTarget} kcal based on your biometric profile and health goals.`,
            foodsToAvoid: [],
            foodsToLimit: [],
            foodsRecommended: [],
            drinksGuidance: ['Stay hydrated with at least 8 glasses (2-2.5L) of water daily.'],
            basedOnConditions: user.healthConditions.map((c) => c.condition),
            basedOnAllergies: user.allergies.map((a) => a.allergen),
          },
          update: {
            profileRevision: reportProfileRevision,
            acknowledgedAt: now,
            isStale: false,
          },
        });
      },
      { maxWait: 10000, timeout: 30000 }
    );

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
        passwordLoginEnabled: true,
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
            isStale: true,
            version: true,
            profileRevision: true,
          },
        },
        accounts: {
          where: { provider: 'google' },
          select: { access_token: true, provider: true },
        },
      },
    });

    if (!user) {
      return null;
    }

    const onboardingStatus = evaluateUserOnboardingStatus(user);
    const googleAccount = user.accounts?.[0];
    const googleImage = googleProfileImage(googleAccount?.access_token) || googleProfileImage(user.image);

    // Transform into clean structure for client
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      authMethods: {
        password: user.passwordLoginEnabled,
        google: Boolean(googleAccount),
      },
      tosAccepted: user.tosAccepted,
      tosAcceptedAt: user.tosAcceptedAt,
      acceptedTermsVersion: user.acceptedTermsVersion,
      acceptedPrivacyVersion: user.acceptedPrivacyVersion,
      healthDataConsentedAt: user.healthDataConsentedAt,
      onboardingDone: user.onboardingDone,
      image: user.image,
      googleImage,
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
