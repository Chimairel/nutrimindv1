import prisma from '@/lib/prisma';
import {
  filterUserActionableMealPlans,
  getUserActionableMealPlanWhere,
} from '@/domain/meal-actionability.policy';
import {
  aggregateGroceryIngredients,
  groceryItemKey,
} from '@/domain/grocery-quantity.policy';

export class GroceryService {
  /**
   * Consolidates all ingredients from the user's current active meal plan
   * and creates a fresh grocery list grouped by categories.
   */
  static async generateGroceryList(userId: string) {
    const now = new Date();

    // 1. Fetch the latest currently actionable planGroupId for this user.
    const latestMeal = await prisma.mealPlan.findFirst({
      where: {
        userId,
        ...getUserActionableMealPlanWhere(now),
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        planGroupId: true,
      },
    });

    if (!latestMeal) {
      throw new Error('No active meal plan found. Generate a meal plan first to create a grocery list.');
    }

    const { planGroupId } = latestMeal;

    // 2. Fetch all meal plans in this group along with their ingredients
    const groupMealPlans = await prisma.mealPlan.findMany({
      where: {
        userId,
        planGroupId,
        ...getUserActionableMealPlanWhere(now),
      },
      include: {
        ingredients: {
          include: {
            foodItem: true,
          },
        },
      },
    });
    const mealPlans = filterUserActionableMealPlans(groupMealPlans, now);

    // 3. Consolidate normalized quantities while keeping incompatible units
    // separate rather than inventing conversions.
    const uniqueIngredients = aggregateGroceryIngredients(
      mealPlans.flatMap((plan) => plan.ingredients.map((ingredient) => ({
        ingredientName: ingredient.ingredientName,
        category: this.standardizeCategory(
          ingredient.category || ingredient.foodItem?.category || 'Other'
        ),
        quantity: ingredient.quantity,
        unit: ingredient.unit,
      })))
    );

    if (uniqueIngredients.length === 0) {
      throw new Error('The active meal plan has no ingredients listed.');
    }

    // 4. Atomically delete old lists and insert the new grocery list within a Prisma transaction
    const previousList = await prisma.groceryList.findFirst({
      where: { userId },
      orderBy: { generatedAt: 'desc' },
      include: { groceryItems: true },
    });
    const previousState = new Map(
      (previousList?.groceryItems || []).map((item) => [
        groceryItemKey(item.ingredientName, item.unit),
        { isChecked: item.isChecked, isPantryStaple: item.isPantryStaple },
      ])
    );

    const groceryList = await prisma.$transaction(async (tx) => {
      // Delete existing grocery lists (cascade deletes items)
      await tx.groceryList.deleteMany({
        where: { userId },
      });

      // Create new list
      const newList = await tx.groceryList.create({
        data: {
          userId,
          weekLabel: 'Weekly Plan Grocery List',
          groceryItems: {
            create: uniqueIngredients.map((item) => ({
              ingredientName: item.ingredientName,
              category: item.category,
              quantity: item.quantity,
              unit: item.unit,
              sourceMealCount: item.sourceMealCount,
              isChecked: previousState.get(item.key)?.isChecked ?? false,
              isPantryStaple: previousState.get(item.key)?.isPantryStaple ?? false,
            })),
          },
        },
        include: {
          groceryItems: true,
        },
      });

      return newList;
    });

    return groceryList;
  }

  /**
   * Fetches the user's current grocery list.
   */
  static async getGroceryList(userId: string) {
    return prisma.groceryList.findFirst({
      where: { userId },
      include: {
        groceryItems: {
          orderBy: {
            ingredientName: 'asc',
          },
        },
      },
    });
  }

  /**
   * Toggles the checked status of a grocery list item.
   */
  static async toggleGroceryItem(userId: string, itemId: string) {
    // 1. Verify item belongs to a grocery list owned by this user
    const item = await prisma.groceryItem.findFirst({
      where: {
        id: itemId,
        groceryList: {
          userId,
        },
      },
    });

    if (!item) {
      throw new Error('Grocery item not found or unauthorized.');
    }

    // 2. Toggle the checkmark
    const updated = await prisma.groceryItem.update({
      where: { id: itemId },
      data: {
        isChecked: !item.isChecked,
      },
    });

    return updated;
  }

  static async togglePantryStaple(userId: string, itemId: string) {
    const item = await prisma.groceryItem.findFirst({
      where: { id: itemId, groceryList: { userId } },
    });
    if (!item) throw new Error('Grocery item not found or does not belong to user.');

    return prisma.groceryItem.update({
      where: { id: itemId },
      data: { isPantryStaple: !item.isPantryStaple },
    });
  }

  /**
   * Standardizes and capitalizes food categories for premium UI groupings.
   */
  private static standardizeCategory(cat: string): string {
    const trimmed = cat.trim().toLowerCase();
    
    if (trimmed.includes('vegetable') || trimmed.includes('produce') || trimmed.includes('greens') || trimmed.includes('herb')) {
      return 'Vegetables & Herbs';
    }
    if (trimmed.includes('meat') || trimmed.includes('pork') || trimmed.includes('beef') || trimmed.includes('chicken') || trimmed.includes('poultry')) {
      return 'Meat & Poultry';
    }
    if (trimmed.includes('seafood') || trimmed.includes('fish') || trimmed.includes('shrimp') || trimmed.includes('crab')) {
      return 'Seafood';
    }
    if (trimmed.includes('dairy') || trimmed.includes('milk') || trimmed.includes('cheese') || trimmed.includes('butter') || trimmed.includes('yogurt')) {
      return 'Dairy & Alternatives';
    }
    if (trimmed.includes('grain') || trimmed.includes('rice') || trimmed.includes('cereal') || trimmed.includes('pasta') || trimmed.includes('bread') || trimmed.includes('carb')) {
      return 'Grains, Cereals & Carbs';
    }
    if (trimmed.includes('condiment') || trimmed.includes('sauce') || trimmed.includes('seasoning') || trimmed.includes('spice') || trimmed.includes('oil')) {
      return 'Seasonings, Oils & Condiments';
    }
    
    // Capitalize custom category
    return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
  }
}
