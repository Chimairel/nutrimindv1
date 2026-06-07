import { Response } from 'express';
import { AuthenticatedRequest } from '@/types';
export declare class UserController {
    /**
     * GET /api/user/profile
     * Returns complete profile details (User + Profile + Conditions + Allergies + NutritionReport status)
     */
    static getProfile(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/user/onboarding/profile
     * Saves UserProfile metrics.
     */
    static updateProfile(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/user/onboarding/conditions
     * Saves HealthCondition records.
     */
    static updateConditions(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/user/onboarding/allergies
     * Saves Allergy records (Allgy model).
     */
    static updateAllergies(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/user/onboarding/tos
     * Sets tosAccepted=true.
     */
    static acceptTos(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/user/onboarding/complete
     * Sets onboardingDone=true and calculates dailyCalorieTarget.
     */
    static completeOnboarding(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * GET /api/user/nutrition-report
     * Returns current user report.
     */
    static getNutritionReport(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/user/nutrition-report/generate
     * Generates custom mock report.
     */
    static generateReport(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
    /**
     * POST /api/user/nutrition-report/acknowledge
     * Sets report acknowledgedAt=now.
     */
    static acknowledgeReport(req: AuthenticatedRequest, res: Response): Promise<Response<any, Record<string, any>>>;
}
//# sourceMappingURL=user.controller.d.ts.map