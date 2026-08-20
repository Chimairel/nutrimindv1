import prisma from '@/lib/prisma';
import { MealPlanStatus, AIConfidenceFlag, NotificationType, MealLibraryStatus, FlagStatus, MealIngredientDataSource } from '@prisma/client';
import { generateGenerativeJSON } from '@/lib/gemini';
import {
  getApprovedMealPlanStatusWhere,
  getNutritionistReviewableMealPlanWhere,
} from '@/domain/meal-actionability.policy';

export class NutritionistService {
  /**
   * Returns the review queue for a nutritionist.
   * Prioritizes: assigned patients first, then global queue.
   * Sorted by: NEEDS_REVIEW → CAUTION → SAFE
   */
  static async getReviewQueue(nutritionistProfileId?: string) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    // Fetch all PENDING_REVIEW meals that are unclaimed, claim has expired, or claimed by the requesting nutritionist
    const pendingMeals = await prisma.mealPlan.findMany({
      where: {
        ...getNutritionistReviewableMealPlanWhere(),
        OR: [
          { claimedByNutritionistId: null },
          { claimedAt: { lt: thirtyMinutesAgo } },
          { claimedByNutritionistId: nutritionistProfileId || 'unmatched' }
        ]
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        ingredients: true,
        claimedByNutritionist: {
          include: {
            user: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'asc' },
    });

    // Sort purely by confidence flag severity (NEEDS_REVIEW -> CAUTION -> SAFE)
    const flagOrder = { NEEDS_REVIEW: 0, CAUTION: 1, SAFE: 2 };
    const sorted = pendingMeals.sort((a, b) => {
      return (flagOrder[a.aiConfidenceFlag] || 2) - (flagOrder[b.aiConfidenceFlag] || 2);
    });

    const result = sorted.map((meal) => {
      const isClaimed = meal.claimedByNutritionistId && meal.claimedAt && meal.claimedAt >= thirtyMinutesAgo;
      const claimedByMe = isClaimed && meal.claimedByNutritionistId === nutritionistProfileId;
      const claimedByOther = isClaimed && meal.claimedByNutritionistId !== nutritionistProfileId;
      const claimedByName = claimedByOther ? (meal.claimedByNutritionist?.user?.name || 'Another nutritionist') : null;

      return {
        id: meal.id,
        planGroupId: meal.planGroupId,
        userId: meal.userId,
        nutritionistId: meal.nutritionistId,
        libraryMealId: meal.libraryMealId,
        status: meal.status,
        mealType: meal.mealType,
        mealName: meal.mealName,
        description: meal.description,
        calories: meal.calories,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
        aiConfidenceFlag: meal.aiConfidenceFlag,
        planType: meal.planType,
        nutritionistNote: meal.nutritionistNote,
        scheduledDate: meal.scheduledDate,
        reviewedAt: meal.reviewedAt,
        createdAt: meal.createdAt,
        user: meal.user,
        ingredients: meal.ingredients,
        claimStatus: {
          claimedByMe: !!claimedByMe,
          claimedByOther: !!claimedByOther,
          claimedByName,
        }
      };
    });

    return result;
  }

  /**
   * Fetches detailed data for a specific review card and sets a temporary claim lock.
   */
  static async getReviewCardDetails(nutritionistUserId: string, mealPlanId: string) {
    const nutritionistProfile = await prisma.nutritionistProfile.findUnique({
      where: { userId: nutritionistUserId },
      include: { user: { select: { name: true } } }
    });
    if (!nutritionistProfile) {
      throw new Error('Nutritionist profile not found.');
    }
    const nutritionistProfileId = nutritionistProfile.id;

    const mealPlan = await prisma.mealPlan.findUnique({
      where: { id: mealPlanId },
      include: {
        ingredients: true,
        claimedByNutritionist: {
          include: {
            user: { select: { name: true } }
          }
        },
        user: {
          include: {
            userProfile: true,
            healthConditions: true,
            allergies: true,
          }
        }
      }
    });

    if (!mealPlan) {
      throw new Error('Meal plan not found.');
    }

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const now = new Date();

    let updatedMealPlan = mealPlan;
    const isActivelyClaimed = mealPlan.claimedByNutritionistId && mealPlan.claimedAt && mealPlan.claimedAt >= thirtyMinutesAgo;
    
    if (!isActivelyClaimed) {
      updatedMealPlan = await prisma.mealPlan.update({
        where: { id: mealPlanId },
        data: {
          claimedByNutritionistId: nutritionistProfileId,
          claimedAt: now,
        },
        include: {
          ingredients: true,
          claimedByNutritionist: {
            include: {
              user: { select: { name: true } }
            }
          },
          user: {
            include: {
              userProfile: true,
              healthConditions: true,
              allergies: true,
            }
          }
        }
      });
    }

    const finalClaimedByMe = updatedMealPlan.claimedByNutritionistId === nutritionistProfileId;
    const finalClaimedByOther = updatedMealPlan.claimedByNutritionistId !== nutritionistProfileId && 
                                updatedMealPlan.claimedAt && 
                                updatedMealPlan.claimedAt >= thirtyMinutesAgo;
    const claimedByName = finalClaimedByOther ? (updatedMealPlan.claimedByNutritionist?.user?.name || 'Another nutritionist') : null;

    const warnings: { severity: 'CRITICAL' | 'IMPORTANT' | 'NOTICE'; message: string }[] = [];
    const user = updatedMealPlan.user;
    const userProfile = user.userProfile;
    const conditions = user.healthConditions.map(hc => hc.condition);
    const allergies = user.allergies.map(a => a.allergen);

    const allergenMatches: Record<string, string[]> = {
      PEANUTS: ['peanut', 'peanuts', 'mani'],
      TREE_NUTS: ['cashew', 'almond', 'walnut', 'pecan', 'macadamia', 'nut', 'nuts'],
      DAIRY: ['milk', 'cheese', 'butter', 'cream', 'ghee', 'yogurt', 'dairy'],
      EGG: ['egg', 'eggs', 'itlog'],
      FISH: ['fish', 'bangus', 'tuna', 'salmon', 'tilapia', 'galunggong', 'sardine', 'sardines', 'mackerel', 'anchovy', 'anchovies', 'dilis', 'isda'],
      SHELLFISH: ['shrimp', 'crab', 'lobster', 'prawn', 'prawns', 'mussel', 'mussels', 'clam', 'clams', 'oyster', 'oysters', 'tahong', 'talaba', 'hipon', 'crab', 'crabs'],
      SOY: ['soy', 'tofu', 'tokwa', 'edamame', 'soybean', 'soy sauce', 'toyo'],
      WHEAT: ['wheat', 'flour', 'bread', 'pasta', 'noodle', 'noodles', 'pancit', 'canton', 'bihon', 'miki'],
    };

    for (const ingredient of updatedMealPlan.ingredients) {
      const ingNameLower = ingredient.ingredientName.toLowerCase();
      const ingCatLower = (ingredient.category || '').toLowerCase();
      
      for (const allergen of allergies) {
        const keywords = allergenMatches[allergen] || [];
        const isMatch = keywords.some(keyword => ingNameLower.includes(keyword) || ingCatLower.includes(keyword)) ||
                        ingNameLower.includes(allergen.toLowerCase().replace('_', ' '));
        if (isMatch) {
          warnings.push({
            severity: 'CRITICAL',
            message: `⚠️ ${ingredient.ingredientName} may contain ${allergen} — user has declared a ${allergen} allergy`
          });
        }
      }
    }

    if (userProfile) {
      if (conditions.includes('DIABETES') && updatedMealPlan.carbsG > 60) {
        warnings.push({
          severity: 'IMPORTANT',
          message: `⚠️ High carb load (${updatedMealPlan.carbsG.toFixed(1)}g) — user is diabetic. Typical safe range is under 60g per meal.`
        });
      }
      if (conditions.includes('HYPERTENSION')) {
        let totalSodium = 0;
        let hasSodiumData = false;
        
        const foodItemIds = updatedMealPlan.ingredients
          .map(i => i.foodItemId)
          .filter(Boolean) as string[];
          
        if (foodItemIds.length > 0) {
          const foodItems = await prisma.foodItem.findMany({
            where: { id: { in: foodItemIds } }
          });
          
          for (const item of foodItems) {
            if (item.sodium !== null && item.sodium !== undefined) {
              totalSodium += item.sodium;
              hasSodiumData = true;
            }
          }
        }
        
        if (hasSodiumData && totalSodium > 800) {
          warnings.push({
            severity: 'IMPORTANT',
            message: `⚠️ High sodium estimate (${totalSodium.toFixed(0)}mg) — user has hypertension.`
          });
        }
      }
      if (conditions.includes('HEART_CONDITION') && updatedMealPlan.fatG > 20) {
        warnings.push({
          severity: 'IMPORTANT',
          message: `⚠️ High fat content (${updatedMealPlan.fatG.toFixed(1)}g) — user has a heart condition.`
        });
      }
      if (conditions.includes('KIDNEY_DISEASE') && updatedMealPlan.proteinG > 40) {
        warnings.push({
          severity: 'IMPORTANT',
          message: `⚠️ High protein load (${updatedMealPlan.proteinG.toFixed(1)}g) — user has kidney disease. Protein restriction may be required.`
        });
      }
      if (conditions.includes('PREGNANT')) {
        warnings.push({
          severity: 'IMPORTANT',
          message: `⚠️ User is pregnant — verify meal is suitable for prenatal nutrition requirements.`
        });
      }

      if (userProfile.dailyCalorieTarget && updatedMealPlan.calories > (userProfile.dailyCalorieTarget * 0.50)) {
        const percentage = ((updatedMealPlan.calories / userProfile.dailyCalorieTarget) * 100).toFixed(0);
        warnings.push({
          severity: 'NOTICE',
          message: `⚠️ This meal alone is ${percentage}% of the user's daily calorie target (${updatedMealPlan.calories.toFixed(0)} kcal / ${userProfile.dailyCalorieTarget.toFixed(0)} kcal daily).`
        });
      }
    }

    const estimatedIngredients = updatedMealPlan.ingredients.filter(ing => ing.dataSource === 'GEMINI_ESTIMATED');
    if (estimatedIngredients.length > 0) {
      const names = estimatedIngredients.map(ing => ing.ingredientName).join(', ');
      warnings.push({
        severity: 'IMPORTANT',
        message: `⚠️ ${estimatedIngredients.length} ingredient(s) have AI-estimated nutrition data, not FNRI verified: [${names}]`
      });
    }

    const severityOrder = { CRITICAL: 0, IMPORTANT: 1, NOTICE: 2 };
    warnings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const userAge = userProfile?.age || 0;

    return {
      mealPlan: {
        id: updatedMealPlan.id,
        planGroupId: updatedMealPlan.planGroupId,
        userId: updatedMealPlan.userId,
        status: updatedMealPlan.status,
        mealType: updatedMealPlan.mealType,
        mealName: updatedMealPlan.mealName,
        description: updatedMealPlan.description,
        calories: updatedMealPlan.calories,
        proteinG: updatedMealPlan.proteinG,
        carbsG: updatedMealPlan.carbsG,
        fatG: updatedMealPlan.fatG,
        aiConfidenceFlag: updatedMealPlan.aiConfidenceFlag,
        planType: updatedMealPlan.planType,
        scheduledDate: updatedMealPlan.scheduledDate,
        createdAt: updatedMealPlan.createdAt,
      },
      user: {
        name: user.name,
        age: userAge,
        sex: userProfile?.biologicalSex || 'MALE',
        goal: userProfile?.goal || 'MAINTAIN',
        dailyCalorieTarget: userProfile?.dailyCalorieTarget || 2000,
        dietaryPreference: userProfile?.dietaryPreference || 'OMNIVORE',
        carbPreference: userProfile?.carbPreference || 'MODERATE',
        conditions: conditions,
        allergies: allergies,
      },
      ingredients: updatedMealPlan.ingredients.map(ing => ({
        name: ing.ingredientName,
        source: ing.dataSource,
      })),
      warnings: warnings,
      claimStatus: {
        claimedByMe: !!finalClaimedByMe,
        claimedByOther: !!finalClaimedByOther,
        claimedByName: claimedByName,
      }
    };
  }

  /**
   * Approves a meal plan.
   * Sets status=APPROVED, auto-saves to MealLibrary, increments totalVerified, notifies user.
   */
  static async approveMealPlan(
    nutritionistProfileId: string, 
    mealPlanId: string, 
    note?: string,
    updates?: {
      mealName?: string;
      description?: string;
      calories?: number;
      proteinG?: number;
      carbsG?: number;
      fatG?: number;
      ingredients?: { name: string; category?: string; dataSource?: MealIngredientDataSource }[];
    }
  ) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const plan = await prisma.mealPlan.findUnique({
      where: { id: mealPlanId },
      include: {
        claimedByNutritionist: { select: { user: { select: { name: true } } } },
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

    if (plan.claimedByNutritionistId && 
        plan.claimedByNutritionistId !== nutritionistProfileId && 
        plan.claimedAt && 
        plan.claimedAt >= thirtyMinutesAgo) {
      throw new Error(`This meal was already claimed by ${plan.claimedByNutritionist?.user?.name || 'another nutritionist'}. Please refresh the queue.`);
    }

    const suitableConditions = plan.user.healthConditions.map((hc) => hc.condition);
    const allergenFree = plan.user.allergies.map((a) => a.allergen);
    const dietaryTags = [
      plan.user.userProfile?.dietaryPreference,
      plan.user.userProfile?.goal,
    ].filter(Boolean) as string[];

    const mealName = updates?.mealName !== undefined ? updates.mealName : plan.mealName;
    const description = updates?.description !== undefined ? updates.description : plan.description;
    const calories = updates?.calories !== undefined ? parseFloat(updates.calories as any) : plan.calories;
    const proteinG = updates?.proteinG !== undefined ? parseFloat(updates.proteinG as any) : plan.proteinG;
    const carbsG = updates?.carbsG !== undefined ? parseFloat(updates.carbsG as any) : plan.carbsG;
    const fatG = updates?.fatG !== undefined ? parseFloat(updates.fatG as any) : plan.fatG;

    // 1. Auto-save to MealLibrary
    const libraryMeal = await prisma.mealLibrary.create({
      data: {
        verifiedByNutritionistId: nutritionistProfileId,
        mealName,
        description,
        mealType: plan.mealType,
        calories,
        proteinG,
        carbsG,
        fatG,
        suitableConditions,
        allergenFree,
        dietaryTags,
      },
    });

    // 2. Update meal plan status, link it to the library meal, clear claim, and save overrides
    await prisma.$transaction(async (tx) => {
      await tx.mealPlan.update({
        where: { id: mealPlanId },
        data: {
          status: MealPlanStatus.APPROVED,
          mealName,
          description,
          calories,
          proteinG,
          carbsG,
          fatG,
          nutritionistId: nutritionistProfileId,
          nutritionistNote: note || null,
          reviewedAt: new Date(),
          libraryMealId: libraryMeal.id,
          claimedByNutritionistId: null,
          claimedAt: null,
        },
      });

      if (updates?.ingredients) {
        await tx.mealIngredient.deleteMany({
          where: { mealPlanId },
        });
        await tx.mealIngredient.createMany({
          data: updates.ingredients.map((ing) => ({
            mealPlanId,
            ingredientName: ing.name,
            category: ing.category || 'PANTRY',
            dataSource: ing.dataSource || 'FNRI',
          })),
        });
      }
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
        message: `Your meal "${mealName}" has been approved by a Registered Dietitian.${note ? ` Note: ${note}` : ''}`,
        type: NotificationType.PLAN_APPROVED,
      },
    });

    return { success: true };
  }

  /**
   * Rejects a meal plan and triggers AI regeneration of that specific meal.
   */
  static async rejectMealPlan(nutritionistProfileId: string, mealPlanId: string, reason: string) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const plan = await prisma.mealPlan.findUnique({
      where: { id: mealPlanId },
      include: {
        claimedByNutritionist: { select: { user: { select: { name: true } } } },
        user: { include: { userProfile: true, healthConditions: true, allergies: true } }
      },
    });

    if (!plan) throw new Error('Meal plan not found.');
    if (plan.status !== MealPlanStatus.PENDING_REVIEW) {
      throw new Error('Only PENDING_REVIEW meals can be rejected.');
    }

    if (plan.claimedByNutritionistId && 
        plan.claimedByNutritionistId !== nutritionistProfileId && 
        plan.claimedAt && 
        plan.claimedAt >= thirtyMinutesAgo) {
      throw new Error(`This meal was already claimed by ${plan.claimedByNutritionist?.user?.name || 'another nutritionist'}. Please refresh the queue.`);
    }

    // 1. Mark as rejected & clear claim
    await prisma.mealPlan.update({
      where: { id: mealPlanId },
      data: {
        status: MealPlanStatus.REJECTED,
        nutritionistId: nutritionistProfileId,
        nutritionistNote: reason,
        reviewedAt: new Date(),
        claimedByNutritionistId: null,
        claimedAt: null,
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
              dataSource: MealIngredientDataSource.GEMINI_ESTIMATED,
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
        ...getApprovedMealPlanStatusWhere(),
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

