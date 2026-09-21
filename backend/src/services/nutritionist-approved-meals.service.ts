import { getApprovedMealPlanStatusWhere } from '@/domain/meal-actionability.policy';
import prisma from '@/lib/prisma';

export function getNutritionistApprovedMeals(nutritionistProfileId: string) {
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
      libraryMealId: true,
      reviewedAt: true,
      scheduledDate: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { reviewedAt: 'desc' },
  });
}
