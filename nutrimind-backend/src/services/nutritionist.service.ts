import prisma from '@/lib/prisma';
import { MealPlanStatus, AIConfidenceFlag, NotificationType } from '@prisma/client';
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
      include: { ingredients: true, user: true },
    });

    if (!plan) throw new Error('Meal plan not found.');
    if (plan.status !== MealPlanStatus.PENDING_REVIEW) {
      throw new Error('Only PENDING_REVIEW meals can be approved.');
    }

    // 1. Update meal plan status
    await prisma.mealPlan.update({
      where: { id: mealPlanId },
      data: {
        status: MealPlanStatus.APPROVED,
        nutritionistId: nutritionistProfileId,
        nutritionistNote: note || null,
        reviewedAt: new Date(),
      },
    });

    // 2. Auto-save to MealLibrary
    await prisma.mealLibrary.create({
      data: {
        verifiedByNutritionistId: nutritionistProfileId,
        mealName: plan.mealName,
        description: plan.description,
        mealType: plan.mealType,
        calories: plan.calories,
        proteinG: plan.proteinG,
        carbsG: plan.carbsG,
        fatG: plan.fatG,
        suitableConditions: [],
        allergenFree: [],
        dietaryTags: [],
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
}
