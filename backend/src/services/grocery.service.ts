import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { lockUserProfile } from './profile-revision.service';
import { MealPlanCycleService } from './meal-plan-cycle.service';
import { purchaseState } from '@/domain/grocery-purchase.policy';
import { getApprovedMealPlanStatusWhere } from '@/domain/meal-actionability.policy';
import { aggregateGroceryIngredients, groceryItemKey } from '@/domain/grocery-quantity.policy';

export class GroceryService {
  /**
   * Consolidates all ingredients from the user's current active meal plan
   * and creates a fresh grocery list grouped by categories.
   */
  static async generateGroceryList(userId: string, transaction?: Prisma.TransactionClient, requestedGroup?: string) {
    const rebuild = async (tx: Prisma.TransactionClient) => {
      await lockUserProfile(tx, userId);
      await tx.userProfile.findUniqueOrThrow({ where: { userId } });
      const now = new Date();
      await MealPlanCycleService.synchronizeLifecycle(userId, now, tx);
      const businessDay = MealPlanCycleService.getBusinessDay(now);
      const cycle = requestedGroup
        ? await tx.mealPlanCycle.findFirst({
            where: { id: requestedGroup, userId },
            select: { id: true, shoppingStartedAt: true },
          })
        : await tx.mealPlanCycle.findFirst({
            where: {
              userId,
              startDate: { lte: businessDay },
              endDate: { gte: businessDay },
              status: { not: 'SUPERSEDED' },
            },
            orderBy: [{ startDate: 'desc' }, { cycleRevision: 'desc' }],
            select: { id: true, shoppingStartedAt: true },
          });
      if (!cycle) throw new Error('No current meal-plan cycle is available for shopping.');
      const planGroupId = cycle.id;
      let list = await this.findCycleList(tx, userId, planGroupId);
      if (cycle.shoppingStartedAt) {
        if (!list) throw new Error('The frozen shopping list for this cycle is unavailable.');
        if (list.isStale) {
          list = await tx.groceryList.update({
            where: { id: list.id },
            data: { isStale: false },
            include: { groceryItems: true },
          });
        }
        return list;
      }
      // Cycle quantities include consumed meals: purchases are cycle totals, not live pantry stock.
      const meals = await tx.mealPlan.findMany({
        where: { userId, planGroupId, ...getApprovedMealPlanStatusWhere() },
        include: {
          ingredients: true,
          servingComponents: { where: { componentType: 'COOKED_RICE' }, include: { foodItem: true } },
        },
      });
      if (!meals.length) throw new Error('No approved meals are available in this plan cycle for shopping.');
      const items = aggregateGroceryIngredients(
        meals.flatMap((meal) => [
          ...meal.ingredients.map((item) => ({
            ingredientName: item.ingredientName,
            category: this.standardizeCategory(item.category || 'Other'),
            quantity: item.quantity,
            unit: item.unit,
          })),
          ...meal.servingComponents.flatMap((component) =>
            component.foodItem && component.quantityG
              ? [
                  {
                    ingredientName: component.foodItem.name,
                    category: this.standardizeCategory(component.foodItem.category || 'Rice and grains'),
                    quantity: component.quantityG,
                    unit: 'g',
                  },
                ]
              : []
          ),
        ])
      );
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
    return tx.groceryList.findFirst({
      where: { userId, planGroupId },
      include: { groceryItems: true },
      orderBy: { generatedAt: 'desc' },
    });
  }

  /**
   * Fetches the user's current grocery list.
   */
  static async getGroceryList(userId: string) {
    const cycle = await MealPlanCycleService.getCurrentCycle(userId);
    if (!cycle) return null;
    const list = await prisma.groceryList.findFirst({
      where: { userId, planGroupId: cycle.id },
      include: { groceryItems: { orderBy: { ingredientName: 'asc' } } },
    });
    // A stale flag is durable work: reads retry the projection and never return stale quantities.
    if (!list || list.isStale || !list.planGroupId)
      return this.generateGroceryList(userId, undefined, cycle.id);
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
      const item = await tx.groceryItem.findFirst({
        where: { id: itemId, groceryList: { userId, isStale: false } },
        include: { groceryList: { select: { planGroupId: true } } },
      });
      if (!item) throw new Error('Shopping list changed. Refresh before recording a purchase.');
      if (item.quantity === null && purchasedQuantity !== undefined)
        throw new Error('This ingredient has no verified quantity. Use the checkbox instead.');
      const quantity = purchasedQuantity ?? (item.isChecked ? 0 : Math.max(item.purchasedQuantity, item.quantity ?? 0));
      const { purchasedQuantity: recorded, isChecked } = purchaseState(item.quantity, quantity);
      const state = { purchasedQuantity: recorded, isChecked };
      await MealPlanCycleService.recordShoppingStarted(tx, userId, item.groceryList.planGroupId);
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
