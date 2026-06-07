"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroceryService = void 0;
const prisma_1 = __importDefault(require("@/lib/prisma"));
class GroceryService {
    /**
     * Consolidates all ingredients from the user's current active meal plan
     * and creates a fresh grocery list grouped by categories.
     */
    static async generateGroceryList(userId) {
        // 1. Fetch the latest active planGroupId for this user (not cancelled)
        const latestMeal = await prisma_1.default.mealPlan.findFirst({
            where: {
                userId,
                status: {
                    in: ['APPROVED', 'PENDING_REVIEW'],
                },
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
        const mealPlans = await prisma_1.default.mealPlan.findMany({
            where: {
                userId,
                planGroupId,
            },
            include: {
                ingredients: {
                    include: {
                        foodItem: true,
                    },
                },
            },
        });
        // 3. Consolidate ingredients case-insensitively
        const itemsMap = new Map();
        for (const plan of mealPlans) {
            for (const ing of plan.ingredients) {
                const cleanName = ing.ingredientName.trim();
                if (!cleanName)
                    continue;
                const key = cleanName.toLowerCase();
                // Resolve category from Ingredient, or FoodItem, or fallback to 'Other'
                let category = ing.category || ing.foodItem?.category || 'Other';
                category = this.standardizeCategory(category);
                if (!itemsMap.has(key)) {
                    // Capitalize first letters of name for premium output formatting
                    const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
                    itemsMap.set(key, {
                        name: formattedName,
                        category,
                    });
                }
            }
        }
        const uniqueIngredients = Array.from(itemsMap.values());
        if (uniqueIngredients.length === 0) {
            throw new Error('The active meal plan has no ingredients listed.');
        }
        // 4. Atomically delete old lists and insert the new grocery list within a Prisma transaction
        const groceryList = await prisma_1.default.$transaction(async (tx) => {
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
                            ingredientName: item.name,
                            category: item.category,
                            isChecked: false,
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
    static async getGroceryList(userId) {
        return prisma_1.default.groceryList.findFirst({
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
    static async toggleGroceryItem(userId, itemId) {
        // 1. Verify item belongs to a grocery list owned by this user
        const item = await prisma_1.default.groceryItem.findFirst({
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
        const updated = await prisma_1.default.groceryItem.update({
            where: { id: itemId },
            data: {
                isChecked: !item.isChecked,
            },
        });
        return updated;
    }
    /**
     * Standardizes and capitalizes food categories for premium UI groupings.
     */
    static standardizeCategory(cat) {
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
exports.GroceryService = GroceryService;
//# sourceMappingURL=grocery.service.js.map