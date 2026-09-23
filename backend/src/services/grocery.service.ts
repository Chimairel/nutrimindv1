import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { lockUserProfile } from './profile-revision.service';
import { MealPlanCycleService } from './meal-plan-cycle.service';
import { purchaseState } from '@/domain/grocery-purchase.policy';
import { aggregateGroceryIngredients, groceryItemKey } from '@/domain/grocery-quantity.policy';
import { deriveGroceryActionability } from '@/domain/grocery-actionability.policy';
import { MealPlanCycleDeadlineOutcome, MealPlanCycleStatus, ProfileCycleAdaptationState } from '@prisma/client';

export class GroceryService {
  /**
   * Consolidates all ingredients from the user's current active meal plan
   * and creates a fresh grocery list grouped by categories.
   */
  static async generateGroceryList(
    userId: string,
    transaction?: Prisma.TransactionClient,
    requestedGroup?: string,
    changeMode: 'AUTO' | 'EXPLICIT' = 'AUTO'
  ) {
    const rebuild = async (tx: Prisma.TransactionClient) => {
      await lockUserProfile(tx, userId);
      await tx.userProfile.findUniqueOrThrow({ where: { userId } });
      const now = new Date();
      await MealPlanCycleService.synchronizeLifecycle(userId, now, tx);
      const businessDay = MealPlanCycleService.getBusinessDay(now);
      const cycle = requestedGroup
        ? await tx.mealPlanCycle.findFirst({
            where: { id: requestedGroup, userId },
            select: {
              id: true,
              shoppingStartedAt: true,
              incompleteAcknowledgedAt: true,
              status: true,
              profileAdaptationState: true,
            },
          })
        : await tx.mealPlanCycle.findFirst({
            where: {
              userId,
              startDate: { lte: businessDay },
              endDate: { gte: businessDay },
              status: { not: 'SUPERSEDED' },
            },
            orderBy: [{ startDate: 'desc' }, { cycleRevision: 'desc' }],
            select: {
              id: true,
              shoppingStartedAt: true,
              incompleteAcknowledgedAt: true,
              status: true,
              profileAdaptationState: true,
            },
          });
      if (!cycle) throw new Error('No current meal-plan cycle is available for shopping.');
      const planGroupId = cycle.id;
      let list = await this.findCycleList(tx, userId, planGroupId);
      if ((cycle.shoppingStartedAt || cycle.incompleteAcknowledgedAt) && changeMode === 'AUTO') {
        if (!list) throw new Error('The frozen shopping list for this cycle is unavailable.');
        // Ordinary late approvals must not enlarge a list after the user has
        // started shopping (or accepted an incomplete subset). Safety/profile
        // invalidation remains stale and therefore non-actionable.
        if (
          list.isStale &&
          cycle.profileAdaptationState === ProfileCycleAdaptationState.CURRENT &&
          cycle.status !== MealPlanCycleStatus.REVALIDATION_REQUIRED
        ) {
          list = await tx.groceryList.update({
            where: { id: list.id },
            data: { isStale: false },
            include: { groceryItems: true },
          });
        }
        return list;
      }
      // Cycle quantities include consumed meals: purchases are cycle totals, not live pantry stock.
      const clearedMealPlanIds = await MealPlanCycleService.getClearedMealPlanIds(userId, planGroupId, now, tx);
      const meals = await tx.mealPlan.findMany({
        where: { userId, planGroupId, id: { in: clearedMealPlanIds } },
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
      const updated = await tx.groceryList.update({
        where: { id: list.id },
        data: { planGroupId, isStale: false, generatedAt: new Date() },
        include: { groceryItems: true },
      });
      // Publication readiness includes a successfully committed grocery
      // projection. Re-run lifecycle derivation in this same transaction so a
      // failed aggregation cannot leave the cycle marked READY_TO_SHOP.
      await MealPlanCycleService.synchronizeLifecycle(userId, now, tx);
      return updated;
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
    if (!list || list.isStale || !list.planGroupId) {
      const clearedCount = (await MealPlanCycleService.getClearedMealPlanIds(userId, cycle.id)).length;
      if (!clearedCount || cycle.profileAdaptationState !== ProfileCycleAdaptationState.CURRENT) return null;
      return this.generateGroceryList(userId, undefined, cycle.id);
    }
    return list;
  }

  /**
   * Returns both shopping-cycle projections in one response. The list and its
   * lifecycle/actionability metadata are inseparable so a client cannot label
   * an under-review subset as a final shopping list.
   */
  static async getGroceryWorkspace(userId: string, now: Date = new Date()) {
    const cycles = await MealPlanCycleService.getCurrentAndUpcoming(userId, now);
    return {
      current: cycles.current ? await this.buildCycleProjection(userId, cycles.current, 'CURRENT', now) : null,
      upcoming: cycles.upcoming ? await this.buildCycleProjection(userId, cycles.upcoming, 'UPCOMING', now) : null,
    };
  }

  static async getCycleProjection(userId: string, cycleId: string, now: Date = new Date()) {
    await MealPlanCycleService.synchronizeLifecycle(userId, now);
    const cycle = await prisma.mealPlanCycle.findFirst({
      where: { id: cycleId, userId },
      select: {
        id: true,
        planType: true,
        cycleRevision: true,
        startDate: true,
        endDate: true,
        preparationOpensAt: true,
        shoppingDeadlineAt: true,
        expectedSlotCount: true,
        status: true,
        profileAdaptationState: true,
        deadlineOutcome: true,
        incompleteAcknowledgedAt: true,
        shoppingStartedAt: true,
      },
    });
    if (!cycle) throw new Error('Meal-plan cycle not found.');
    const businessDay = MealPlanCycleService.getBusinessDay(now);
    const scope = cycle.startDate <= businessDay && cycle.endDate >= businessDay ? 'CURRENT' : 'UPCOMING';
    return this.buildCycleProjection(userId, cycle, scope, now);
  }

  private static async buildCycleProjection<
    T extends {
      id: string;
      startDate: Date;
      endDate: Date;
      expectedSlotCount: number;
      status: MealPlanCycleStatus;
      profileAdaptationState: ProfileCycleAdaptationState;
      deadlineOutcome: MealPlanCycleDeadlineOutcome | null;
      incompleteAcknowledgedAt: Date | null;
      shoppingStartedAt: Date | null;
    },
  >(userId: string, cycle: T, scope: 'CURRENT' | 'UPCOMING', now: Date) {
    const clearedMealPlanIds = await MealPlanCycleService.getClearedMealPlanIds(userId, cycle.id, now);
    const clearedMeals = await prisma.mealPlan.findMany({
      where: { userId, planGroupId: cycle.id, id: { in: clearedMealPlanIds } },
      select: { scheduledDate: true, mealType: true },
    });
    const clearedSlotCount = new Set(clearedMeals.map((meal) => `${meal.scheduledDate.getTime()}:${meal.mealType}`))
      .size;
    let list = await prisma.groceryList.findFirst({
      where: { userId, planGroupId: cycle.id },
      include: { groceryItems: { orderBy: { ingredientName: 'asc' } } },
    });
    const frozen = Boolean(cycle.shoppingStartedAt || cycle.incompleteAcknowledgedAt);
    if (
      clearedSlotCount > 0 &&
      (!list || list.isStale) &&
      cycle.profileAdaptationState === ProfileCycleAdaptationState.CURRENT &&
      cycle.status !== MealPlanCycleStatus.REVALIDATION_REQUIRED
    ) {
      try {
        list = await this.generateGroceryList(userId, undefined, cycle.id);
      } catch (error) {
        // A frozen list must already exist. For a progressive preview, a
        // failed rebuild stays visibly unavailable/non-final and is retried by
        // the next read or review event.
        if (frozen) throw error;
      }
    }
    await MealPlanCycleService.synchronizeLifecycle(userId, now);
    const refreshedCycle = await prisma.mealPlanCycle.findFirstOrThrow({
      where: { id: cycle.id, userId },
      select: {
        status: true,
        profileAdaptationState: true,
        deadlineOutcome: true,
        incompleteAcknowledgedAt: true,
        shoppingStartedAt: true,
      },
    });
    const actionability = deriveGroceryActionability({
      ...refreshedCycle,
      listIsStale: Boolean(list?.isStale),
    });
    const visibleList = list?.isStale ? null : list;
    return {
      scope,
      cycle: { ...cycle, ...refreshedCycle },
      // A stale snapshot may contain ingredients invalidated by a profile or
      // evidence change. Hide it until the safe unaffected projection is
      // rebuilt; zero visible rows is the conservative safe projection.
      groceryList: visibleList,
      coverage: {
        clearedSlotCount,
        expectedSlotCount: cycle.expectedSlotCount,
        unresolvedSlotCount: Math.max(0, cycle.expectedSlotCount - clearedSlotCount),
      },
      actionability: {
        ...actionability,
        canCheckItems: actionability.canCheckItems && Boolean(visibleList),
        canExportPdf: actionability.canExportPdf && Boolean(visibleList?.groceryItems.length),
      },
    };
  }

  private static assertListActionableForShopping(list: {
    isStale: boolean;
    cycle: {
      status: MealPlanCycleStatus;
      profileAdaptationState: ProfileCycleAdaptationState;
      deadlineOutcome: MealPlanCycleDeadlineOutcome | null;
      incompleteAcknowledgedAt: Date | null;
      shoppingStartedAt: Date | null;
    };
  }) {
    const actionability = deriveGroceryActionability({
      ...list.cycle,
      listIsStale: list.isStale,
    });
    if (!actionability.canCheckItems) throw new Error(actionability.message);
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
        include: {
          groceryList: {
            select: {
              planGroupId: true,
              isStale: true,
              cycle: {
                select: {
                  status: true,
                  profileAdaptationState: true,
                  deadlineOutcome: true,
                  incompleteAcknowledgedAt: true,
                  shoppingStartedAt: true,
                },
              },
            },
          },
        },
      });
      if (!item) throw new Error('Shopping list changed. Refresh before recording a purchase.');
      this.assertListActionableForShopping(item.groceryList);
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
    return prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, userId);
      const item = await tx.groceryItem.findFirst({
        where: { id: itemId, groceryList: { userId } },
        include: {
          groceryList: {
            select: {
              planGroupId: true,
              isStale: true,
              cycle: {
                select: {
                  status: true,
                  profileAdaptationState: true,
                  deadlineOutcome: true,
                  incompleteAcknowledgedAt: true,
                  shoppingStartedAt: true,
                },
              },
            },
          },
        },
      });
      if (!item) throw new Error('Grocery item not found or does not belong to user.');
      this.assertListActionableForShopping(item.groceryList);
      await MealPlanCycleService.recordShoppingStarted(tx, userId, item.groceryList.planGroupId);
      return tx.groceryItem.update({
        where: { id: itemId },
        data: { isPantryStaple: !item.isPantryStaple },
      });
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
