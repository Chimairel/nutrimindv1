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
