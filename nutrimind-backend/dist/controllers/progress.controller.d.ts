import { Response } from 'express';
import { AuthenticatedRequest } from '@/types';
export declare class ProgressController {
    /**
     * Logs a new weight log and triggers recalculation of daily calorie targets.
     */
    static logWeight(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * Retrieves weight and daily nutrition logs history.
     */
    static getHistory(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=progress.controller.d.ts.map