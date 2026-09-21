import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getNextWeeklyCycleWindow } from '@/domain/meal-plan-cycle.policy';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';
import { lockUserProfile } from './profile-revision.service';
import { purchaseState } from '@/domain/grocery-purchase.policy';
import { getApprovedMealPlanStatusWhere, getUserActionableMealPlanWhere } from '@/domain/meal-actionability.policy';
import { aggregateGroceryIngredients, groceryItemKey } from '@/domain/grocery-quantity.policy';

export class GroceryService {
  /**
   * Consolidates all ingredients from the user's current active meal plan
   * and creates a fresh grocery list grouped by categories.
   */
  static async generateGroceryList(userId: string, transaction?: Prisma.TransactionClient, requestedGroup?: string) {
    const rebuild = async (tx: Prisma.TransactionClient) => {
      await lockUserProfile(tx, userId);
      const profile = await tx.userProfile.findUniqueOrThrow({ where: { userId } });
      const next = getNextWeeklyCycleWindow(profile);
      const latestMeal = await tx.mealPlan.findFirst({
        where: {
          userId,
          ...getUserActionableMealPlanWhere(),
          ...(requestedGroup
            ? { planGroupId: requestedGroup }
            : { scheduledDate: { gte: getStartOfManilaBusinessDay(), lt: next.startDate } }),
        },
        orderBy: { scheduledDate: 'asc' },
        select: { planGroupId: true },
      });
      if (!latestMeal) throw new Error('No approved current meal plan is available for shopping.');
      const planGroupId = latestMeal.planGroupId;
      // Cycle quantities include consumed meals: purchases are cycle totals, not live pantry stock.
      const meals = await tx.mealPlan.findMany({
        where: { userId, planGroupId, ...getApprovedMealPlanStatusWhere() },
        include: { ingredients: true },
      });
      const items = aggregateGroceryIngredients(
        meals.flatMap((meal) =>
          meal.ingredients.map((item) => ({
            ingredientName: item.ingredientName,
            category: this.standardizeCategory(item.category || 'Other'),
            quantity: item.quantity,
            unit: item.unit,
          }))
        )
      );
      let list = await this.findCycleList(tx, userId, planGroupId);
      if (!list)
        list = await tx.groceryList.create({
          data: { userId, planGroupId, weekLabel: 'Shopping list for this plan' },
          include: { groceryItems: true },
        });
      const old = new Map<string, (typeof list.groceryItems)[number]>();
      const duplicates = new Set<string>();
      for (const item of list.groceryItems) {
        const key = groceryItemKey(item.ingredientName, item.unit);
        const prior = old.get(key);
        if (prior) {
          prior.purchasedQuantity += item.purchasedQuantity;
          duplicates.add(item.id);
        } else old.set(key, { ...item });
      }
      if (duplicates.size) await tx.groceryItem.deleteMany({ where: { id: { in: [...duplicates] } } });
      const keys = new Set(items.map((item) => item.key));
      for (const item of items) {
        const previous = old.get(item.key);
        const purchasedQuantity = previous?.purchasedQuantity ?? 0;
        const { purchasedQuantity: recorded, isChecked } = purchaseState(item.quantity, purchasedQuantity);
        const state = { purchasedQuantity: recorded, isChecked };
        const data = {
          ingredientName: item.ingredientName,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          sourceMealCount: item.sourceMealCount,
          ...state,
          ...(item.quantity === null ? { isChecked: previous?.isChecked ?? false } : {}),
        };
        if (previous) await tx.groceryItem.update({ where: { id: previous.id }, data });
        else await tx.groceryItem.create({ data: { ...data, groceryListId: list.id } });
      }
      for (const previous of old.values()) {
        if (duplicates.has(previous.id) || keys.has(groceryItemKey(previous.ingredientName, previous.unit))) continue;
        if (previous.purchasedQuantity > 0)
          await tx.groceryItem.update({
            where: { id: previous.id },
            data: { quantity: 0, isChecked: true, sourceMealCount: 0 },
          });
        else await tx.groceryItem.delete({ where: { id: previous.id } });
      }
      return tx.groceryList.update({
        where: { id: list.id },
        data: { planGroupId, isStale: false, generatedAt: new Date() },
        include: { groceryItems: true },
      });
    };
    return transaction ? rebuild(transaction) : prisma.$transaction(rebuild, { timeout: 30_000 });
  }

  static async findCycleList(tx: Prisma.TransactionClient, userId: string, planGroupId: string) {
    let list = await tx.groceryList.findFirst({
      where: { userId, planGroupId },
      include: { groceryItems: true },
      orderBy: { generatedAt: 'desc' },
    });
    if (!list) {
      // A legacy list has no cycle key. Adopt only when its timestamp identifies this
      // cycle unambiguously; never spend an older cycle's purchases on a future plan.
      const legacy = await tx.groceryList.findFirst({
        where: { userId, planGroupId: null },
        include: { groceryItems: true },
        orderBy: { generatedAt: 'desc' },
      });
      if (legacy) {
        const groups = await tx.mealPlan.groupBy({
          by: ['planGroupId'],
          where: { userId },
          _min: { scheduledDate: true },
          _max: { scheduledDate: true },
        });
        const matching = groups.filter((group) => {
          const start = group._min.scheduledDate?.getTime();
          const end = group._max.scheduledDate?.getTime();
          return (
            start !== undefined &&
            end !== undefined &&
            legacy.generatedAt.getTime() >= start &&
            legacy.generatedAt.getTime() < end + 86_400_000
          );
        });
        if (matching.length === 1 && matching[0].planGroupId === planGroupId) list = legacy;
      }
    }
    return list;
  }

  /**
   * Fetches the user's current grocery list.
   */
  static async getGroceryList(userId: string) {
    const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId } });
    const next = getNextWeeklyCycleWindow(profile);
    const schedule = { gte: getStartOfManilaBusinessDay(), lt: next.startDate };
    const active = await prisma.mealPlan.findFirst({
      where: { userId, ...getUserActionableMealPlanWhere(), scheduledDate: schedule },
      orderBy: { scheduledDate: 'asc' },
    });
    if (!active) return null;
    const list = await prisma.groceryList.findFirst({
      where: { userId, planGroupId: active.planGroupId },
      include: { groceryItems: { orderBy: { ingredientName: 'asc' } } },
    });
    // A stale flag is durable work: reads retry the projection and never return stale quantities.
    if (!list || list.isStale || !list.planGroupId)
      return this.generateGroceryList(userId, undefined, active.planGroupId);
    return list;
  }

  /**
   * Toggles the checked status of a grocery list item.
   */
  static async toggleGroceryItem(userId: string, itemId: string) {
    return this.recordPurchase(userId, itemId);
  }

  static async recordPurchase(userId: string, itemId: string, purchasedQuantity?: number) {
    return prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, userId);
      const item = await tx.groceryItem.findFirst({ where: { id: itemId, groceryList: { userId, isStale: false } } });
      if (!item) throw new Error('Shopping list changed. Refresh before recording a purchase.');
      if (item.quantity === null && purchasedQuantity !== undefined)
        throw new Error('This ingredient has no verified quantity. Use the checkbox instead.');
      const quantity = purchasedQuantity ?? (item.isChecked ? 0 : Math.max(item.purchasedQuantity, item.quantity ?? 0));
      const { purchasedQuantity: recorded, isChecked } = purchaseState(item.quantity, quantity);
      const state = { purchasedQuantity: recorded, isChecked };
      return tx.groceryItem.update({
        where: { id: item.id },
        data: item.quantity === null ? { isChecked: !item.isChecked } : state,
      });
    });
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
   * Standardizes and capitalizes food categories for grocery UI groupings.
   */
  private static standardizeCategory(cat: string): string {
    const trimmed = cat.trim().toLowerCase();

    if (
      trimmed.includes('vegetable') ||
      trimmed.includes('produce') ||
      trimmed.includes('greens') ||
      trimmed.includes('herb')
    ) {
      return 'Vegetables & Herbs';
    }
    if (
      trimmed.includes('meat') ||
      trimmed.includes('pork') ||
      trimmed.includes('beef') ||
      trimmed.includes('chicken') ||
      trimmed.includes('poultry')
    ) {
      return 'Meat & Poultry';
    }
    if (
      trimmed.includes('seafood') ||
      trimmed.includes('fish') ||
      trimmed.includes('shrimp') ||
      trimmed.includes('crab')
    ) {
      return 'Seafood';
    }
    if (
      trimmed.includes('dairy') ||
      trimmed.includes('milk') ||
      trimmed.includes('cheese') ||
      trimmed.includes('butter') ||
      trimmed.includes('yogurt')
    ) {
      return 'Dairy & Alternatives';
    }
    if (
      trimmed.includes('grain') ||
      trimmed.includes('rice') ||
      trimmed.includes('cereal') ||
      trimmed.includes('pasta') ||
      trimmed.includes('bread') ||
      trimmed.includes('carb')
    ) {
      return 'Grains, Cereals & Carbs';
    }
    if (
      trimmed.includes('condiment') ||
      trimmed.includes('sauce') ||
      trimmed.includes('seasoning') ||
      trimmed.includes('spice') ||
      trimmed.includes('oil')
    ) {
      return 'Seasonings, Oils & Condiments';
    }

    // Capitalize custom category
    return cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();
  }
}
