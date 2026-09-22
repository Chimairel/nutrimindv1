import api from '@/lib/axios';

export interface GroceryItem {
  id: string;
  ingredientName: string;
  category: string;
  isChecked: boolean;
  quantity: number | null;
  purchasedQuantity?: number;
  unit: string | null;
  sourceMealCount: number;
  isPantryStaple: boolean;
}

export interface GroceryList {
  id: string;
  weekLabel: string;
  generatedAt: string;
  groceryItems: GroceryItem[];
}

export type GroceryCycleStatus =
  | 'PREPARING'
  | 'UNDER_REVIEW'
  | 'READY_TO_SHOP'
  | 'INCOMPLETE_AT_DEADLINE'
  | 'SHOPPING_STARTED'
  | 'ACTIVE'
  | 'REVALIDATION_REQUIRED'
  | 'COMPLETED'
  | 'SUPERSEDED';

export interface GroceryCycleProjection {
  scope: 'CURRENT' | 'UPCOMING';
  cycle: {
    id: string;
    startDate: string;
    endDate: string;
    status: GroceryCycleStatus;
    deadlineOutcome: 'COMPLETE' | 'INCOMPLETE' | null;
    incompleteAcknowledgedAt: string | null;
    shoppingStartedAt: string | null;
  };
  groceryList: GroceryList | null;
  coverage: {
    clearedSlotCount: number;
    expectedSlotCount: number;
    unresolvedSlotCount: number;
  };
  actionability: {
    canCheckItems: boolean;
    canExportPdf: boolean;
    isFinal: boolean;
    isIncomplete: boolean;
    quantitiesMayIncrease: boolean;
    requiresIncompleteAcknowledgment: boolean;
    message: string;
  };
}

export interface GroceryWorkspace {
  current: GroceryCycleProjection | null;
  upcoming: GroceryCycleProjection | null;
}

export interface GroceryPageSnapshot {
  groceryList: GroceryList | null;
  pendingMealCount: number;
}

/** Both grocery surfaces must validate current approval before displaying a stored projection. */
export async function fetchCurrentGrocery(): Promise<GroceryPageSnapshot> {
  const [grocery, meals] = await Promise.all([
    api.get<{ success: boolean; data: GroceryList | null }>('/user/grocery/current'),
    api.get<{ success: boolean; data: unknown[]; meta?: { pendingReview?: { mealCount: number } | null } }>(
      '/user/meals/current'
    ),
  ]);
  if (!grocery.data?.success || !meals.data?.success || !Array.isArray(meals.data.data)) {
    throw new Error('Could not confirm the current grocery review state.');
  }
  return {
    groceryList: meals.data.data.length > 0 ? (grocery.data.data ?? null) : null,
    pendingMealCount: meals.data.meta?.pendingReview?.mealCount ?? 0,
  };
}

export async function fetchGroceryWorkspace(): Promise<GroceryWorkspace> {
  const response = await api.get<{ success: boolean; data: GroceryWorkspace }>('/user/grocery/workspace');
  if (!response.data?.success || !response.data.data) {
    throw new Error('Could not load the current and next grocery cycles.');
  }
  return response.data.data;
}
