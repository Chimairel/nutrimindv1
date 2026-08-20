"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroceryController = void 0;
const react_1 = __importDefault(require("react"));
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
    /**
     * GET /api/user/grocery/pdf
     * Streams the grocery list as a PDF
     */
    static async downloadGroceryPdf(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized user.' });
            }
            const groceryList = await grocery_service_1.GroceryService.getGroceryList(userId);
            if (!groceryList || !groceryList.groceryItems || groceryList.groceryItems.length === 0) {
                return res.status(404).json({ success: false, error: 'No active grocery list found.' });
            }
            const { GroceryListPDF, streamPdf } = await Promise.resolve().then(() => __importStar(require('@/lib/pdf')));
            const document = react_1.default.createElement(GroceryListPDF, { groceryList });
            const stream = await streamPdf(document);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=nutrimind-grocery-list.pdf');
            stream.pipe(res);
        }
        catch (error) {
            console.error('[GroceryController] downloadGroceryPdf error:', error);
            return res.status(500).json({ success: false, error: 'Failed to generate grocery list PDF.' });
        }
    }
}
exports.GroceryController = GroceryController;
//# sourceMappingURL=grocery.controller.js.map