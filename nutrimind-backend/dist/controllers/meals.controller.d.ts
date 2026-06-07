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
     * GET /api/user/meals/history
     * Returns all historic plans grouped by planGroupId.
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
}
//# sourceMappingURL=meals.controller.d.ts.map