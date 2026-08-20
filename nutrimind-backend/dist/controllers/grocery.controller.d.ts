import { Response } from 'express';
import { AuthenticatedRequest } from '@/types';
export declare class GroceryController {
    /**
     * Generates a new grocery list based on the active 7-day meal plan.
     */
    static generate(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Fetches the user's current grocery list.
     */
    static getCurrent(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Toggles the checked status of a grocery item.
     */
    static toggleItem(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * GET /api/user/grocery/pdf
     * Streams the grocery list as a PDF
     */
    static downloadGroceryPdf(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
//# sourceMappingURL=grocery.controller.d.ts.map