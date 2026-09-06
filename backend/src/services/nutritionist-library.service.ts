import prisma from '@/lib/prisma';
import {
  MealLibraryStatus,
  MealLibrarySafetyEvidenceStatus,
  MealLibrarySafetyEvidenceOrigin,
  MealLibraryDeclarationState,
  MealLibraryCrossContactAssessment,
  MealLibrarySafetyDeclarationType,
  MealLibrarySafetyReviewOutcome,
  FlagStatus,
  MealIngredientDataSource,
  AllergenType,
  DietaryPreference,
  Goal,
  HealthConditionType,
  Prisma,
} from '@prisma/client';
import { isNutritionistEligibleForReview } from '@/domain/nutritionist-review.policy';
import { MEAL_LIBRARY_SAFETY_POLICY_VERSION } from '@/domain/meal-library-safety-evidence.policy';
import type { CertifyMealLibrarySafetyInput } from '@/domain/meal-library-safety-review.schema';
import { certifiedLibraryMealInclude, isCertifiedLibraryMealCompatible } from '@/services/meal-swap.service';
import { normalizePagination, normalizeSearch } from '@/policies/pagination.policy';
import {
  BASE_LIBRARY_COVERAGE_PROFILES,
  COMBINATION_CONDITIONS,
  COMBINATION_CONSTRAINTS,
  COVERAGE_MEAL_TYPES,
  STRUCTURED_COMBINATION_COVERAGE_PROFILES,
} from '@/domain/nutritionist-library-coverage.profiles';

export class NutritionistLibraryService {
  static async getMealLibrary(limit = 50) {
    return prisma.mealLibrary.findMany({
      orderBy: { usageCount: 'desc' },
      take: limit,
      include: { verifiedByNutritionist: { select: { userId: true } } },
    });
  }
  static async checkLibraryMealMutationPermission(userId: string, userRole: string, meal: any): Promise<boolean> {
    if (!meal) return false;

    // Check if user is the original verifier
    if (meal.verifiedByNutritionist?.userId === userId) {
      return true;
    }

    // Check if user is ADMIN and the verifier account is inactive/deactivated/deleted
    if (userRole === 'ADMIN') {
      const verifierProfile = await prisma.nutritionistProfile.findUnique({
        where: { id: meal.verifiedByNutritionistId || '' },
        include: { user: true },
      });

      if (
        !verifierProfile ||
        !verifierProfile.user ||
        verifierProfile.user.role !== 'NUTRITIONIST' ||
        verifierProfile.prcLicenseExpiry < new Date()
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Query MealLibrary with advanced filters, search, and pagination
   */
  static async getMealLibraryWithFilters(
    currentUserId: string,
    filters: {
      search?: string;
      mealType?: string;
      conditionTag?: string;
      status?: string;
      verifiedByMe?: boolean;
      page?: number;
      limit?: number;
    }
  ) {
    const { page, limit } = normalizePagination(filters.page, filters.limit, 20);
    const skip = (page - 1) * limit;
    const search = normalizeSearch(filters.search);

    const where: any = {};

    if (search) {
      where.mealName = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (filters.mealType && filters.mealType !== 'All') {
      where.mealType = filters.mealType;
    }

    if (filters.conditionTag && filters.conditionTag !== 'All') {
      where.suitableConditions = {
        array_contains: filters.conditionTag,
      };
    }

    if (filters.status && filters.status !== 'All') {
      where.status = filters.status;
    }

    if (filters.verifiedByMe) {
      where.verifiedByNutritionist = {
        userId: currentUserId,
      };
    }

    const [total, meals] = await Promise.all([
      prisma.mealLibrary.count({ where }),
      prisma.mealLibrary.findMany({
        where,
        orderBy: { addedAt: 'desc' },
        skip,
        take: limit,
        include: {
          verifiedByNutritionist: {
            include: {
              user: {
                select: { name: true },
              },
            },
          },
          flags: {
            where: { status: 'PENDING' },
            include: {
              flaggedByNutritionist: {
                include: {
                  user: {
                    select: { name: true },
                  },
                },
              },
            },
          },
          ingredients: { orderBy: { position: 'asc' } },
          safetyDeclarations: true,
          safetyReviewedByNutritionist: {
            include: { user: { select: { name: true } } },
          },
        },
      }),
    ]);

    return { total, page, limit, meals };
  }

  /**
   * Operational coverage for profiles the reusable library currently supports.
   * A profile is week-ready only when every main slot has at least seven
   * current, unflagged, reviewer-eligible meals.
   */
  static async getMealLibraryCoverage() {
    const meals = await prisma.mealLibrary.findMany({
      where: {
        status: MealLibraryStatus.APPROVED,
        safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
        safetyPolicyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
        flags: { none: { status: FlagStatus.PENDING } },
      },
      include: certifiedLibraryMealInclude,
    });
    const countProfile = (definition: {
      dietaryPreference: DietaryPreference;
      conditions: readonly HealthConditionType[];
      allergens: readonly AllergenType[];
      safetyEntries?: readonly {
        domain: string;
        canonicalCode: string | null;
        displayName: string;
        supportState: string;
      }[];
    }) => {
      const matching = meals.filter((meal) =>
        isCertifiedLibraryMealCompatible(meal, definition.conditions, definition.allergens, {
          dietaryPreference: definition.dietaryPreference,
          goal: Goal.MAINTAIN,
          otherConditions: null,
          otherAllergies: null,
          safetyEntries: definition.safetyEntries,
        })
      );
      const counts = Object.fromEntries(
        COVERAGE_MEAL_TYPES.map((mealType) => [mealType, matching.filter((meal) => meal.mealType === mealType).length])
      ) as Record<(typeof COVERAGE_MEAL_TYPES)[number], number>;
      const minimumPerSlot = Math.min(...Object.values(counts));
      return {
        counts,
        total: matching.length,
        minimumPerSlot,
        weekReady: minimumPerSlot >= 7,
      };
    };

    const profiles = BASE_LIBRARY_COVERAGE_PROFILES.map((definition) => ({
      key: definition.key,
      label: definition.label,
      ...countProfile(definition),
    }));

    const combinationMatrix = COMBINATION_CONDITIONS.map((condition) => ({
      key: condition.key,
      label: condition.label,
      cells: COMBINATION_CONSTRAINTS.map((constraint) => ({
        key: constraint.key,
        label: constraint.label,
        ...countProfile({
          dietaryPreference: constraint.dietaryPreference,
          conditions: [condition.condition],
          allergens: [constraint.allergen],
        }),
      })),
    }));

    const combinationColumns = COMBINATION_CONSTRAINTS.map(({ key, label }) => ({
      key,
      label,
    }));

    const structuredProfiles = STRUCTURED_COMBINATION_COVERAGE_PROFILES.map((definition) => ({
      key: definition.key,
      label: definition.label,
      ...countProfile({
        dietaryPreference: definition.dietaryPreference,
        conditions: [],
        allergens: [],
        safetyEntries: definition.safetyEntries,
      }),
    }));

    return {
      certifiedMeals: meals.filter(
        (meal) =>
          meal.certifiedEvidenceRevision === meal.safetyEvidenceRevision &&
          meal.safetyReviewedByNutritionist &&
          isNutritionistEligibleForReview(meal.safetyReviewedByNutritionist)
      ).length,
      requiredPerSlot: 7,
      profiles,
      combinationColumns,
      combinationMatrix,
      structuredProfiles,
    };
  }

  /**
   * Get single library meal details
   */
  static async getLibraryMeal(mealId: string) {
    return prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: {
        verifiedByNutritionist: {
          include: {
            user: {
              select: { name: true },
            },
          },
        },
        flags: {
          include: {
            flaggedByNutritionist: {
              include: {
                user: {
                  select: { name: true },
                },
              },
            },
          },
        },
        ingredients: { orderBy: { position: 'asc' } },
        safetyDeclarations: true,
        safetyReviewedByNutritionist: {
          include: { user: { select: { name: true } } },
        },
        safetyReviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            nutritionistProfile: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
    });
  }

  /**
   * Certifies one exact, stable library evidence revision. This is separate
   * from approving the original user's meal plan and is intentionally strict:
   * only linked FNRI ingredients and explicit reviewed declarations qualify.
   */
  static async certifyLibraryMealSafety(
    nutritionistProfileId: string,
    mealId: string,
    input: CertifyMealLibrarySafetyInput
  ) {
    const now = new Date();
    const reviewer = await prisma.nutritionistProfile.findUnique({
      where: { id: nutritionistProfileId },
      include: { user: { select: { role: true } } },
    });
    if (!reviewer || !isNutritionistEligibleForReview(reviewer, now)) {
      throw new Error('Only a currently verified nutritionist with an unexpired PRC license can certify evidence.');
    }

    return prisma.$transaction(
      async (tx) => {
        const meal = await tx.mealLibrary.findUnique({
          where: { id: mealId },
          include: {
            ingredients: { orderBy: { position: 'asc' } },
            flags: { where: { status: FlagStatus.PENDING }, select: { id: true } },
          },
        });
        if (!meal) throw new Error('Meal not found.');
        if (meal.status !== MealLibraryStatus.APPROVED || meal.flags.length > 0) {
          throw new Error('Flagged or archived meals cannot be certified. Resolve the operational status first.');
        }
        if (meal.safetyEvidenceRevision !== input.expectedRevision) {
          throw new Error('Evidence revision conflict. Refresh the meal before certifying.');
        }
        if (meal.ingredients.length === 0) {
          throw new Error('Certification requires at least one stable library ingredient.');
        }
        if (
          meal.ingredients.some(
            (ingredient) => ingredient.dataSource !== MealIngredientDataSource.FNRI || !ingredient.foodItemId
          )
        ) {
          throw new Error('Every library ingredient must be resolved and linked to FNRI before certification.');
        }

        const nextRevision = input.expectedRevision + 1;
        const declarations = [
          ...input.suitableConditions.map((canonicalKey) => ({
            mealLibraryId: mealId,
            declarationType: MealLibrarySafetyDeclarationType.CONDITION_REVIEWED,
            canonicalKey,
          })),
          ...input.allergensPresent.map((canonicalKey) => ({
            mealLibraryId: mealId,
            declarationType: MealLibrarySafetyDeclarationType.ALLERGEN_PRESENT,
            canonicalKey,
          })),
          ...input.allergensReviewedAbsent.map((canonicalKey) => ({
            mealLibraryId: mealId,
            declarationType: MealLibrarySafetyDeclarationType.ALLERGEN_REVIEWED_ABSENT,
            canonicalKey,
          })),
        ];

        const revisionClaim = await tx.mealLibrary.updateMany({
          where: {
            id: mealId,
            status: MealLibraryStatus.APPROVED,
            safetyEvidenceRevision: input.expectedRevision,
          },
          data: {
            safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.COMPLETE,
            safetyEvidenceOrigin: MealLibrarySafetyEvidenceOrigin.NUTRITIONIST_REVIEW,
            conditionDeclarationState: input.conditionDeclarationState as MealLibraryDeclarationState,
            allergenDeclarationState: input.allergenDeclarationState as MealLibraryDeclarationState,
            crossContactAssessment: input.crossContactAssessment as MealLibraryCrossContactAssessment,
            suitableConditions: input.suitableConditions,
            allergenFree: input.allergensReviewedAbsent,
            safetyEvidenceRevision: nextRevision,
            certifiedEvidenceRevision: nextRevision,
            safetyPolicyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
            safetyReviewedByNutritionistId: nutritionistProfileId,
            safetyReviewedAt: now,
            safetyInvalidatedAt: null,
            safetyInvalidationReason: null,
          },
        });
        if (revisionClaim.count !== 1) {
          throw new Error('Evidence revision conflict. Refresh the meal before certifying.');
        }

        await tx.mealLibrarySafetyDeclaration.deleteMany({ where: { mealLibraryId: mealId } });
        if (declarations.length > 0) {
          await tx.mealLibrarySafetyDeclaration.createMany({ data: declarations });
        }

        const evidenceSnapshot = {
          meal: {
            mealName: meal.mealName,
            description: meal.description,
            mealType: meal.mealType,
            calories: meal.calories,
            proteinG: meal.proteinG,
            carbsG: meal.carbsG,
            fatG: meal.fatG,
          },
          ingredients: meal.ingredients.map((ingredient) => ({
            position: ingredient.position,
            ingredientName: ingredient.ingredientName,
            category: ingredient.category,
            foodItemId: ingredient.foodItemId,
            dataSource: ingredient.dataSource,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
          })),
          declarations: {
            conditionDeclarationState: input.conditionDeclarationState,
            allergenDeclarationState: input.allergenDeclarationState,
            suitableConditions: input.suitableConditions,
            allergensPresent: input.allergensPresent,
            allergensReviewedAbsent: input.allergensReviewedAbsent,
            crossContactAssessment: input.crossContactAssessment,
          },
        };
        await tx.mealLibrarySafetyReview.create({
          data: {
            mealLibraryId: mealId,
            nutritionistProfileId,
            outcome: MealLibrarySafetyReviewOutcome.CERTIFIED,
            evidenceRevision: nextRevision,
            policyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
            reasonCode: 'CERTIFIED_CURRENT_REVISION',
            evidenceSnapshot,
          },
        });

        return tx.mealLibrary.findUnique({
          where: { id: mealId },
          include: {
            ingredients: { orderBy: { position: 'asc' } },
            safetyDeclarations: true,
            safetyReviewedByNutritionist: {
              include: { user: { select: { name: true } } },
            },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 15_000,
      }
    );
  }

  /**
   * Update meal details in MealLibrary
   */
  static async editLibraryMeal(userId: string, userRole: string, mealId: string, updatedFields: any) {
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: { verifiedByNutritionist: true },
    });

    if (!meal) throw new Error('Meal not found.');

    const hasPermission = await this.checkLibraryMealMutationPermission(userId, userRole, meal);
    if (!hasPermission) {
      throw new Error('Unauthorized: Only the original verifying nutritionist can edit this meal.');
    }

    const now = new Date();
    const wasComplete = meal.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE;
    return prisma.$transaction(
      async (tx) => {
        const updated = await tx.mealLibrary.update({
          where: { id: mealId },
          data: {
            mealName: updatedFields.mealName,
            description: updatedFields.description,
            calories: parseFloat(updatedFields.calories || 0),
            proteinG: parseFloat(updatedFields.proteinG || 0),
            carbsG: parseFloat(updatedFields.carbsG || 0),
            fatG: parseFloat(updatedFields.fatG || 0),
            dietaryTags: updatedFields.dietaryTags || meal.dietaryTags,
            safetyEvidenceRevision: { increment: 1 },
            ...(wasComplete
              ? {
                  safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.STALE,
                  safetyInvalidatedAt: now,
                  safetyInvalidationReason: 'MEAL_CONTENT_CHANGED',
                }
              : {}),
          },
        });

        if (wasComplete) {
          await tx.mealLibrarySafetyReview.create({
            data: {
              mealLibraryId: mealId,
              nutritionistProfileId: meal.verifiedByNutritionistId,
              outcome: MealLibrarySafetyReviewOutcome.INVALIDATED,
              evidenceRevision: updated.safetyEvidenceRevision,
              policyVersion: updated.safetyPolicyVersion,
              reasonCode: 'MEAL_CONTENT_CHANGED',
              evidenceSnapshot: {
                priorCertifiedRevision: meal.certifiedEvidenceRevision,
                currentRevision: updated.safetyEvidenceRevision,
              },
            },
          });
        }
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  /**
   * Delete verified meal from MealLibrary
   */
  static async deleteLibraryMeal(userId: string, userRole: string, mealId: string) {
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: { verifiedByNutritionist: true },
    });

    if (!meal) throw new Error('Meal not found.');

    const hasPermission = await this.checkLibraryMealMutationPermission(userId, userRole, meal);
    if (!hasPermission) {
      throw new Error('Unauthorized: Only the original verifying nutritionist can delete this meal.');
    }

    const now = new Date();
    return prisma.$transaction(
      async (tx) => {
        const archived = await tx.mealLibrary.update({
          where: { id: mealId },
          data: {
            status: MealLibraryStatus.ARCHIVED,
            safetyEvidenceStatus:
              meal.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE
                ? MealLibrarySafetyEvidenceStatus.STALE
                : meal.safetyEvidenceStatus,
            safetyInvalidatedAt: now,
            safetyInvalidationReason: 'LIBRARY_ARCHIVED',
          },
        });
        await tx.mealLibrarySafetyReview.create({
          data: {
            mealLibraryId: mealId,
            nutritionistProfileId: meal.verifiedByNutritionistId,
            outcome: MealLibrarySafetyReviewOutcome.INVALIDATED,
            evidenceRevision: archived.safetyEvidenceRevision,
            policyVersion: archived.safetyPolicyVersion,
            reasonCode: 'LIBRARY_ARCHIVED',
            evidenceSnapshot: { priorStatus: meal.status, archivedAt: now.toISOString() },
          },
        });
        return archived;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }

  /**
   * Flag a library meal for re-review
   */
  static async flagLibraryMeal(userId: string, mealId: string, reason: string) {
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: {
        verifiedByNutritionist: true,
        flags: { where: { status: FlagStatus.PENDING }, select: { id: true } },
      },
    });

    if (!meal) throw new Error('Meal not found.');

    if (meal.verifiedByNutritionist?.userId === userId) {
      throw new Error('You cannot flag your own verified meal. Edit it directly instead.');
    }
    if (meal.status === MealLibraryStatus.ARCHIVED) throw new Error('Archived meals cannot be flagged.');
    if (meal.flags.length > 0) throw new Error('This meal already has a pending flag.');

    const flaggerProfile = await prisma.nutritionistProfile.findUnique({
      where: { userId },
    });
    if (!flaggerProfile) throw new Error('Flagger profile not found.');

    const flag = await prisma.$transaction(
      async (tx) => {
        const createdFlag = await tx.mealLibraryFlag.create({
          data: {
            mealLibraryId: mealId,
            flaggedByNutritionistId: flaggerProfile.id,
            reason,
            status: FlagStatus.PENDING,
          },
        });
        const wasComplete = meal.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE;
        const updated = await tx.mealLibrary.update({
          where: { id: mealId },
          data: {
            status: MealLibraryStatus.FLAGGED,
            ...(wasComplete
              ? {
                  safetyEvidenceStatus: MealLibrarySafetyEvidenceStatus.STALE,
                  safetyInvalidatedAt: new Date(),
                  safetyInvalidationReason: 'LIBRARY_FLAGGED',
                }
              : {}),
          },
        });
        if (wasComplete) {
          await tx.mealLibrarySafetyReview.create({
            data: {
              mealLibraryId: mealId,
              nutritionistProfileId: flaggerProfile.id,
              outcome: MealLibrarySafetyReviewOutcome.INVALIDATED,
              evidenceRevision: updated.safetyEvidenceRevision,
              policyVersion: updated.safetyPolicyVersion,
              reasonCode: 'LIBRARY_FLAGGED',
              evidenceSnapshot: { flagId: createdFlag.id },
            },
          });
        }
        return createdFlag;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (meal.verifiedByNutritionist?.userId) {
      await prisma.notification.create({
        data: {
          userId: meal.verifiedByNutritionist.userId,
          title: 'Meal Plan Flagged 🚩',
          message: `Your verified meal "${meal.mealName}" was flagged for re-review: ${reason}`,
          type: 'MEAL_FLAGGED',
        },
      });
    }

    return flag;
  }

  /**
   * Resolve an active flag (edit, delete, or dismiss)
   */
  static async resolveLibraryMealFlag(
    userId: string,
    userRole: string,
    mealId: string,
    resolution: 'edit' | 'delete' | 'dismiss',
    updatedFields?: any
  ) {
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: {
        verifiedByNutritionist: true,
        flags: {
          where: { status: 'PENDING' },
          include: {
            flaggedByNutritionist: true,
          },
        },
      },
    });

    if (!meal) throw new Error('Meal not found.');

    const hasPermission = await this.checkLibraryMealMutationPermission(userId, userRole, meal);
    if (!hasPermission) {
      throw new Error('Unauthorized: Only the original verifying nutritionist can resolve flags on this meal.');
    }

    const pendingFlags = meal.flags;
    const flagIds = pendingFlags.map((f) => f.id);

    if (resolution === 'delete') {
      await prisma.$transaction(
        async (tx) => {
          await tx.mealLibraryFlag.updateMany({
            where: { id: { in: flagIds } },
            data: { status: FlagStatus.RESOLVED_REMOVED, resolvedAt: new Date() },
          });
          await tx.mealLibrary.update({
            where: { id: mealId },
            data: {
              status: MealLibraryStatus.ARCHIVED,
              safetyEvidenceStatus:
                meal.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE
                  ? MealLibrarySafetyEvidenceStatus.STALE
                  : meal.safetyEvidenceStatus,
              safetyInvalidatedAt: new Date(),
              safetyInvalidationReason: 'LIBRARY_ARCHIVED',
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );

      for (const flag of pendingFlags) {
        if (flag.flaggedByNutritionist?.userId) {
          await prisma.notification.create({
            data: {
              userId: flag.flaggedByNutritionist.userId,
              title: 'Flag Resolved: Meal Removed 🗑️',
              message: `The meal "${meal.mealName}" you flagged has been removed from the library.`,
              type: 'FLAG_RESOLVED',
            },
          });
        }
      }
      return { success: true };
    }

    const newStatus = MealLibraryStatus.APPROVED;
    const flagStatus = FlagStatus.RESOLVED_KEPT;

    if (resolution === 'edit') {
      if (!updatedFields) throw new Error('Updated fields are required for edit resolution.');

      await prisma.$transaction([
        prisma.mealLibraryFlag.updateMany({
          where: { id: { in: flagIds } },
          data: { status: flagStatus, resolvedAt: new Date() },
        }),
        prisma.mealLibrary.update({
          where: { id: mealId },
          data: {
            mealName: updatedFields.mealName,
            description: updatedFields.description,
            calories: parseFloat(updatedFields.calories || 0),
            proteinG: parseFloat(updatedFields.proteinG || 0),
            carbsG: parseFloat(updatedFields.carbsG || 0),
            fatG: parseFloat(updatedFields.fatG || 0),
            suitableConditions: updatedFields.suitableConditions || meal.suitableConditions,
            allergenFree: updatedFields.allergenFree || meal.allergenFree,
            dietaryTags: updatedFields.dietaryTags || meal.dietaryTags,
            status: newStatus,
            safetyEvidenceRevision: { increment: 1 },
            safetyEvidenceStatus:
              meal.safetyEvidenceStatus === MealLibrarySafetyEvidenceStatus.COMPLETE
                ? MealLibrarySafetyEvidenceStatus.STALE
                : meal.safetyEvidenceStatus,
            safetyInvalidatedAt: meal.safetyInvalidatedAt || new Date(),
            safetyInvalidationReason: 'FLAG_RESOLUTION_EDIT',
          },
        }),
      ]);

      for (const flag of pendingFlags) {
        if (flag.flaggedByNutritionist?.userId) {
          await prisma.notification.create({
            data: {
              userId: flag.flaggedByNutritionist.userId,
              title: 'Flag Resolved: Meal Updated ✏️',
              message: `The meal "${meal.mealName}" you flagged has been updated and kept in the library.`,
              type: 'FLAG_RESOLVED',
            },
          });
        }
      }
      return { success: true };
    }

    if (resolution === 'dismiss') {
      await prisma.$transaction([
        prisma.mealLibraryFlag.updateMany({
          where: { id: { in: flagIds } },
          data: { status: flagStatus, resolvedAt: new Date() },
        }),
        prisma.mealLibrary.update({
          where: { id: mealId },
          data: { status: newStatus },
        }),
      ]);

      for (const flag of pendingFlags) {
        if (flag.flaggedByNutritionist?.userId) {
          await prisma.notification.create({
            data: {
              userId: flag.flaggedByNutritionist.userId,
              title: 'Flag Dismissed ℹ️',
              message: `Your flag on meal "${meal.mealName}" was dismissed by the original verifier.`,
              type: 'FLAG_RESOLVED',
            },
          });
        }
      }
      return { success: true };
    }

    throw new Error('Invalid resolution type.');
  }
}
