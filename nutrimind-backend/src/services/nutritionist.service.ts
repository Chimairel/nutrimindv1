import prisma from '@/lib/prisma';
import { MealPlanStatus, AIConfidenceFlag, NotificationType, MealLibraryStatus, FlagStatus } from '@prisma/client';
import { generateGenerativeJSON } from '@/lib/gemini';

export class NutritionistService {
  /**
   * Returns the review queue for a nutritionist.
   * Prioritizes: assigned patients first, then global queue.
   * Sorted by: NEEDS_REVIEW → CAUTION → SAFE
   */
  static async getReviewQueue(nutritionistProfileId: string) {
    // Get assigned patient IDs
    const assignments = await prisma.nutritionistAssignment.findMany({
      where: { nutritionistProfileId, status: 'ACTIVE' },
      select: { userId: true },
    });
    const assignedUserIds = assignments.map((a) => a.userId);

    // Fetch all PENDING_REVIEW meals
    const pendingMeals = await prisma.mealPlan.findMany({
      where: { status: MealPlanStatus.PENDING_REVIEW },
      include: {
        user: { select: { id: true, name: true, email: true } },
        ingredients: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Sort: assigned patients first, then by confidence flag severity
    const flagOrder = { NEEDS_REVIEW: 0, CAUTION: 1, SAFE: 2 };
    const sorted = pendingMeals.sort((a, b) => {
      const aAssigned = assignedUserIds.includes(a.userId) ? 0 : 1;
      const bAssigned = assignedUserIds.includes(b.userId) ? 0 : 1;
      if (aAssigned !== bAssigned) return aAssigned - bAssigned;
      return (flagOrder[a.aiConfidenceFlag] || 2) - (flagOrder[b.aiConfidenceFlag] || 2);
    });

    return sorted;
  }

  /**
   * Approves a meal plan.
   * Sets status=APPROVED, auto-saves to MealLibrary, increments totalVerified, notifies user.
   */
  static async approveMealPlan(nutritionistProfileId: string, mealPlanId: string, note?: string) {
    const plan = await prisma.mealPlan.findUnique({
      where: { id: mealPlanId },
      include: {
        ingredients: true,
        user: {
          include: {
            healthConditions: true,
            allergies: true,
            userProfile: true,
          },
        },
      },
    });

    if (!plan) throw new Error('Meal plan not found.');
    if (plan.status !== MealPlanStatus.PENDING_REVIEW) {
      throw new Error('Only PENDING_REVIEW meals can be approved.');
    }

    const suitableConditions = plan.user.healthConditions.map((hc) => hc.condition);
    const allergenFree = plan.user.allergies.map((a) => a.allergen);
    const dietaryTags = [
      plan.user.userProfile?.dietaryPreference,
      plan.user.userProfile?.goal,
    ].filter(Boolean) as string[];

    // 1. Auto-save to MealLibrary
    const libraryMeal = await prisma.mealLibrary.create({
      data: {
        verifiedByNutritionistId: nutritionistProfileId,
        mealName: plan.mealName,
        description: plan.description,
        mealType: plan.mealType,
        calories: plan.calories,
        proteinG: plan.proteinG,
        carbsG: plan.carbsG,
        fatG: plan.fatG,
        suitableConditions,
        allergenFree,
        dietaryTags,
      },
    });

    // 2. Update meal plan status and link it to the library meal
    await prisma.mealPlan.update({
      where: { id: mealPlanId },
      data: {
        status: MealPlanStatus.APPROVED,
        nutritionistId: nutritionistProfileId,
        nutritionistNote: note || null,
        reviewedAt: new Date(),
        libraryMealId: libraryMeal.id,
      },
    });

    // 3. Increment totalVerified
    await prisma.nutritionistProfile.update({
      where: { id: nutritionistProfileId },
      data: { totalVerified: { increment: 1 } },
    });

    // 4. Notify user
    await prisma.notification.create({
      data: {
        userId: plan.userId,
        title: 'Meal Plan Approved ✅',
        message: `Your meal "${plan.mealName}" has been approved by a Registered Dietitian.${note ? ` Note: ${note}` : ''}`,
        type: NotificationType.PLAN_APPROVED,
      },
    });

    return { success: true };
  }

  /**
   * Rejects a meal plan and triggers AI regeneration of that specific meal.
   */
  static async rejectMealPlan(nutritionistProfileId: string, mealPlanId: string, reason: string) {
    const plan = await prisma.mealPlan.findUnique({
      where: { id: mealPlanId },
      include: { user: { include: { userProfile: true, healthConditions: true, allergies: true } } },
    });

    if (!plan) throw new Error('Meal plan not found.');
    if (plan.status !== MealPlanStatus.PENDING_REVIEW) {
      throw new Error('Only PENDING_REVIEW meals can be rejected.');
    }

    // 1. Mark as rejected
    await prisma.mealPlan.update({
      where: { id: mealPlanId },
      data: {
        status: MealPlanStatus.REJECTED,
        nutritionistId: nutritionistProfileId,
        nutritionistNote: reason,
        reviewedAt: new Date(),
      },
    });

    // 2. Notify user
    await prisma.notification.create({
      data: {
        userId: plan.userId,
        title: 'Meal Plan Needs Changes ⚠️',
        message: `Your meal "${plan.mealName}" was flagged by a dietitian: ${reason}. A replacement is being generated.`,
        type: NotificationType.PLAN_REJECTED,
      },
    });

    // 3. Trigger Gemini to regenerate THAT SPECIFIC MEAL
    try {
      const profile = plan.user.userProfile;
      const conditions = plan.user.healthConditions.map((c) => c.condition);
      const allergens = plan.user.allergies.map((a) => a.allergen);

      const prompt =
        `Generate a single replacement ${plan.mealType} meal for a Filipino patient with these constraints:\n` +
        `- Daily Calorie Target: ${profile?.dailyCalorieTarget || 2000} kcal\n` +
        `- Health Conditions: ${conditions.join(', ') || 'NONE'}\n` +
        `- Allergens to EXCLUDE: ${allergens.join(', ') || 'NONE'}\n` +
        `- Dietary Preference: ${profile?.dietaryPreference || 'OMNIVORE'}\n` +
        `- Rejection Reason: ${reason}\n` +
        `Return a strict JSON object:\n` +
        `{ "mealName": string, "description": string, "calories": number, "proteinG": number, "carbsG": number, "fatG": number, "ingredients": [{"name": string, "category": string}] }`;

      const replacement = await generateGenerativeJSON<any>(prompt);

      // Create replacement meal with same planGroupId and scheduledDate
      await prisma.mealPlan.create({
        data: {
          planGroupId: plan.planGroupId,
          userId: plan.userId,
          status: MealPlanStatus.PENDING_REVIEW,
          mealType: plan.mealType,
          mealName: replacement.mealName,
          description: replacement.description,
          calories: replacement.calories,
          proteinG: replacement.proteinG,
          carbsG: replacement.carbsG,
          fatG: replacement.fatG,
          aiConfidenceFlag: AIConfidenceFlag.CAUTION,
          scheduledDate: plan.scheduledDate,
          ingredients: {
            create: (replacement.ingredients || []).map((ing: any) => ({
              ingredientName: ing.name,
              category: ing.category || 'PANTRY',
            })),
          },
        },
      });
    } catch (err) {
      console.error('[NutritionistService] Replacement meal generation failed:', err);
    }

    return { success: true };
  }

  /**
   * Returns list of assigned patients.
   */
  static async getPatients(nutritionistProfileId: string) {
    const assignments = await prisma.nutritionistAssignment.findMany({
      where: { nutritionistProfileId, status: 'ACTIVE' },
      include: {
        user: {
          select: { id: true, name: true, email: true, onboardingDone: true, createdAt: true },
        },
      },
    });
    return assignments;
  }

  /**
   * Returns the nutritionist's own profile.
   */
  static async getProfile(userId: string) {
    return prisma.nutritionistProfile.findUnique({
      where: { userId },
    });
  }

  /**
   * Updates the nutritionist's profile.
   */
  static async updateProfile(userId: string, data: { bio?: string; specialization?: string }) {
    return prisma.nutritionistProfile.update({
      where: { userId },
      data,
    });
  }

  /**
   * Returns MealLibrary entries.
   */
  static async getMealLibrary(limit = 50) {
    return prisma.mealLibrary.findMany({
      orderBy: { usageCount: 'desc' },
      take: limit,
      include: { verifiedByNutritionist: { select: { userId: true } } },
    });
  }

  /**
   * Returns all meal plans approved by this nutritionist.
   */
  static async getApprovedMeals(nutritionistProfileId: string) {
    return prisma.mealPlan.findMany({
      where: {
        status: MealPlanStatus.APPROVED,
        nutritionistId: nutritionistProfileId,
      },
      select: {
        id: true,
        mealName: true,
        mealType: true,
        calories: true,
        proteinG: true,
        carbsG: true,
        fatG: true,
        nutritionistNote: true,
        reviewedAt: true,
        scheduledDate: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { reviewedAt: 'desc' },
    });
  }

  /**
   * Checks if the user is authorized to perform mutations (edit/delete/resolve flags)
   * on a verified meal entry. Only the verifier has permissions, except for ADMIN
   * override if the verifier account has been deactivated or is inactive.
   */
  static async checkLibraryMealMutationPermission(
    userId: string,
    userRole: string,
    meal: any
  ): Promise<boolean> {
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
    const page = Number(filters.page) || 1;
    const limit = Number(filters.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.search) {
      where.mealName = {
        contains: filters.search,
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
        },
      }),
    ]);

    return { total, page, limit, meals };
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
      },
    });
  }

  /**
   * Update meal details in MealLibrary
   */
  static async editLibraryMeal(
    userId: string,
    userRole: string,
    mealId: string,
    updatedFields: any
  ) {
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: { verifiedByNutritionist: true },
    });

    if (!meal) throw new Error('Meal not found.');

    const hasPermission = await this.checkLibraryMealMutationPermission(userId, userRole, meal);
    if (!hasPermission) {
      throw new Error('Unauthorized: Only the original verifying nutritionist can edit this meal.');
    }

    return prisma.mealLibrary.update({
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
      },
    });
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

    return prisma.mealLibrary.delete({
      where: { id: mealId },
    });
  }

  /**
   * Flag a library meal for re-review
   */
  static async flagLibraryMeal(userId: string, mealId: string, reason: string) {
    const meal = await prisma.mealLibrary.findUnique({
      where: { id: mealId },
      include: { verifiedByNutritionist: true },
    });

    if (!meal) throw new Error('Meal not found.');

    if (meal.verifiedByNutritionist?.userId === userId) {
      throw new Error('You cannot flag your own verified meal. Edit it directly instead.');
    }

    const flaggerProfile = await prisma.nutritionistProfile.findUnique({
      where: { userId },
    });
    if (!flaggerProfile) throw new Error('Flagger profile not found.');

    const [flag] = await prisma.$transaction([
      prisma.mealLibraryFlag.create({
        data: {
          mealLibraryId: mealId,
          flaggedByNutritionistId: flaggerProfile.id,
          reason,
          status: FlagStatus.PENDING,
        },
      }),
      prisma.mealLibrary.update({
        where: { id: mealId },
        data: { status: MealLibraryStatus.FLAGGED },
      }),
    ]);

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
      await prisma.mealLibrary.delete({
        where: { id: mealId },
      });

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

