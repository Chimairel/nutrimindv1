import { Response } from 'express';
import { AuthenticatedRequest } from '@/types';
export declare class MealsController {
    /**
     * POST /api/user/meals/generate
     * Triggers the 7-day plan generation.
     */
    static generateMealPlan(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * GET /api/user/meals/current
     * Returns current active plan meals grouped by date.
     */
    static getCurrentPlan(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * GET /api/user/meals/:id
     * Returns details of a specific meal plan item.
     */
    static getMealDetails(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * GET /api/user/meals/history
     * Returns:
     *  - "Plan Meals" = MealLog records with source=SYSTEM_GENERATED and status=DONE
     *    (meals the user checked off as eaten from their plan)
     *  - "Outside Meals" = MealLog records with source=USER_LOGGED
     * Both normalized to the same shape and sorted by loggedAt descending.
     */
    static getPlanHistory(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/user/meals/log-outside
     * Logs an outside meal, performing pre-checks.
     */
    static logOutsideMeal(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * PATCH /api/user/meals/:id/status
     * Toggles the log status (DONE/SKIPPED) for a scheduled meal plan item.
     */
    static updateMealStatus(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * GET /api/user/meals/:id/swap-options
     * Returns compatible swap choices from verified MealLibrary.
     */
    static getSwapOptions(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/user/meals/:id/swap
     * Performs the meal swap.
     */
    static executeSwap(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * GET /api/user/meals/:id/swap-preview
     * Generates swap calorie warnings.
     */
    static getSwapPreview(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * GET /api/user/meals/compatible-library
     * Returns all compatible approved library meals for the logged-in user.
     */
    static getCompatibleLibrary(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=meals.controller.d.ts.map