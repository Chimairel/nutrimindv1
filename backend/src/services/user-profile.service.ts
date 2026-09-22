import { googleProfileImage } from '@/domain/google-profile-image';
import prisma from '@/lib/prisma';
import { lockUserProfile, advanceProfileRevision, advanceSafetyRevision } from './profile-revision.service';
import { calculateDailyTarget } from '@/lib/calculations';
import {
  Goal,
  ActivityLevel,
  DietaryPreference,
  RicePreference,
  RicePreferenceProvenance,
  ConsumptionGeographyLevel,
  MealLocalityPreference,
  HealthConditionType,
  HealthProfileRevisionType,
  Prisma,
} from '@prisma/client';
import { evaluateOnboardingStatus } from '@/domain/onboarding.policy';
import { getCanonicalRegionName } from '@/data/philippine-planning-geography';
import { introducesHardDietRestriction } from '@/domain/profile-update-policy';
import { PROFILE_CHANGE_KIND, type ProfileChangeKind } from './profile-cycle-adaptation.service';

interface ProfileUpdateData {
  age?: number;
  biologicalSex?: string;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  goal?: Goal;
  activityLevel?: ActivityLevel;
  dietaryPreference?: DietaryPreference;
  ricePreference?: RicePreference;
  foodCulture?: string;
  planningGeographyLevel?: ConsumptionGeographyLevel;
  planningRegionName?: string | null;
  planningProvinceHucName?: string | null;
  mealLocalityPreference?: MealLocalityPreference;
  shoppingDayOfWeek?: number;
}

const bodyTargetFields = new Set<keyof ProfileUpdateData>([
  'age',
  'biologicalSex',
  'heightCm',
  'weightKg',
  'targetWeightKg',
  'goal',
  'activityLevel',
]);
const foodPreferenceFields = new Set<keyof ProfileUpdateData>([
  'dietaryPreference',
  'ricePreference',
  'foodCulture',
  'planningGeographyLevel',
  'planningRegionName',
  'planningProvinceHucName',
  'mealLocalityPreference',
]);

function classifyProfileChanges(fields: readonly (keyof ProfileUpdateData)[]): ProfileChangeKind[] {
  const kinds = new Set<ProfileChangeKind>();
  if (fields.some((field) => bodyTargetFields.has(field))) kinds.add(PROFILE_CHANGE_KIND.BODY_TARGETS);
  if (fields.some((field) => foodPreferenceFields.has(field))) kinds.add(PROFILE_CHANGE_KIND.FOOD_PREFERENCES);
  if (fields.includes('shoppingDayOfWeek')) kinds.add(PROFILE_CHANGE_KIND.SHOPPING_SCHEDULE);
  return [...kinds];
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
      'ricePreference',
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

        const changedFields = Object.entries(safeData)
          .filter(([key, value]) => !existing || existing[key as keyof typeof existing] !== value)
          .map(([key]) => key as keyof ProfileUpdateData);
        if (safeData.ricePreference !== undefined) {
          const provenanceChanged = existing?.ricePreferenceProvenance !== RicePreferenceProvenance.USER_SELECTED;
          if (provenanceChanged && !changedFields.includes('ricePreference')) changedFields.push('ricePreference');
        }
        if (existing && changedFields.length === 0) return existing;

        const profile = await tx.userProfile.upsert({
          where: { userId },
          update: {
            ...safeData,
            ...(safeData.ricePreference !== undefined
              ? { ricePreferenceProvenance: RicePreferenceProvenance.USER_SELECTED }
              : {}),
          },
          create: {
            userId,
            ...safeData,
            ...(safeData.ricePreference !== undefined
              ? { ricePreferenceProvenance: RicePreferenceProvenance.USER_SELECTED }
              : {}),
          },
        });
        const hardSafetyChange = introducesHardDietRestriction(
          existing?.dietaryPreference,
          profile.dietaryPreference
        );
        const revised = hardSafetyChange
          ? await advanceSafetyRevision(tx, userId)
          : await advanceProfileRevision(tx, userId, classifyProfileChanges(changedFields));
        await tx.healthProfileRevision.create({
          data: {
            userId,
            revisionType: HealthProfileRevisionType.BODY_DIET_UPDATED,
            snapshot: {
              profileRevision: revised.revision,
              safetyRevision: revised.safetyRevision,
              changedFields,
              values: safeData,
            } as unknown as Prisma.InputJsonObject,
          },
        });
        return revised;
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
    return this.updateUserProfile(userId, { shoppingDayOfWeek });
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
        await tx.nutritionReportVersion.upsert({
          where: { userId_version: { userId, version: 1 } },
          create: {
            userId,
            version: 1,
            profileRevision: reportProfileRevision,
            generatedAt: now,
            acknowledgedAt: now,
            content: {
              generalSummary: `Initial nutritional baseline established. Daily calorie target: ${calculations.dailyCalorieTarget} kcal based on your biometric profile and health goals.`,
              foodsToAvoid: [],
              foodsToLimit: [],
              foodsRecommended: [],
              drinksGuidance: ['Stay hydrated with at least 8 glasses (2-2.5L) of water daily.'],
              basedOnConditions: user.healthConditions.map((condition) => condition.condition),
              basedOnAllergies: user.allergies.map((allergy) => allergy.allergen),
            },
            profileSnapshot: JSON.parse(JSON.stringify(current)),
          },
          update: {
            profileRevision: reportProfileRevision,
            generatedAt: now,
            acknowledgedAt: now,
            content: {
              generalSummary: `Initial nutritional baseline established. Daily calorie target: ${calculations.dailyCalorieTarget} kcal based on your biometric profile and health goals.`,
              foodsToAvoid: [],
              foodsToLimit: [],
              foodsRecommended: [],
              drinksGuidance: ['Stay hydrated with at least 8 glasses (2-2.5L) of water daily.'],
              basedOnConditions: user.healthConditions.map((condition) => condition.condition),
              basedOnAllergies: user.allergies.map((allergy) => allergy.allergen),
            },
            profileSnapshot: JSON.parse(JSON.stringify(current)),
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
