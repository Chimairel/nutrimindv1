export declare class GroceryService {
    /**
     * Consolidates all ingredients from the user's current active meal plan
     * and creates a fresh grocery list grouped by categories.
     */
    static generateGroceryList(userId: string): Promise<{
        groceryItems: {
            id: string;
            category: string | null;
            ingredientName: string;
            isChecked: boolean;
            groceryListId: string;
        }[];
    } & {
        id: string;
        userId: string;
        generatedAt: Date;
        weekLabel: string;
    }>;
    /**
     * Fetches the user's current grocery list.
     */
    static getGroceryList(userId: string): Promise<({
        groceryItems: {
            id: string;
            category: string | null;
            ingredientName: string;
            isChecked: boolean;
            groceryListId: string;
        }[];
    } & {
        id: string;
        userId: string;
        generatedAt: Date;
        weekLabel: string;
    }) | null>;
    /**
     * Toggles the checked status of a grocery list item.
     */
    static toggleGroceryItem(userId: string, itemId: string): Promise<{
        id: string;
        category: string | null;
        ingredientName: string;
        isChecked: boolean;
        groceryListId: string;
    }>;
    /**
     * Standardizes and capitalizes food categories for premium UI groupings.
     */
    private static standardizeCategory;
}
//# sourceMappingURL=grocery.service.d.ts.map