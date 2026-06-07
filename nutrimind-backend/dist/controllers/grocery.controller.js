"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroceryController = void 0;
const grocery_service_1 = require("@/services/grocery.service");
class GroceryController {
    /**
     * Generates a new grocery list based on the active 7-day meal plan.
     */
    static async generate(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized user.' });
            }
            const groceryList = await grocery_service_1.GroceryService.generateGroceryList(userId);
            return res.status(200).json({
                success: true,
                message: 'Grocery list generated successfully.',
                data: groceryList,
            });
        }
        catch (err) {
            console.error('[GroceryController] Generation failed:', err);
            return res.status(400).json({
                success: false,
                error: err.message || 'Failed to generate grocery list.',
            });
        }
    }
    /**
     * Fetches the user's current grocery list.
     */
    static async getCurrent(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized user.' });
            }
            const groceryList = await grocery_service_1.GroceryService.getGroceryList(userId);
            return res.status(200).json({
                success: true,
                data: groceryList,
            });
        }
        catch (err) {
            console.error('[GroceryController] Fetch failed:', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to retrieve grocery list.',
            });
        }
    }
    /**
     * Toggles the checked status of a grocery item.
     */
    static async toggleItem(req, res) {
        try {
            const userId = req.user?.userId;
            const itemId = req.params.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized user.' });
            }
            if (!itemId) {
                return res.status(400).json({ success: false, error: 'Missing grocery item ID parameter.' });
            }
            const updatedItem = await grocery_service_1.GroceryService.toggleGroceryItem(userId, itemId);
            return res.status(200).json({
                success: true,
                message: 'Grocery item status updated successfully.',
                data: updatedItem,
            });
        }
        catch (err) {
            console.error('[GroceryController] Toggle failed:', err);
            return res.status(400).json({
                success: false,
                error: err.message || 'Failed to update item status.',
            });
        }
    }
}
exports.GroceryController = GroceryController;
//# sourceMappingURL=grocery.controller.js.map