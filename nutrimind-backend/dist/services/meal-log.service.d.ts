import { MealType } from '@prisma/client';
interface LogOutsideMealInput {
    userId: string;
    mealName: string;
    mealType: MealType;
    warningAcknowledged?: boolean;
    notes?: string;
}
export declare class MealLogService {
    /**
     * Evaluates and logs an outside meal.
     * Performs real-time AI estimations and cross-references against:
     * 1. Clinical conditions (sugar levels, high sodium)
     * 2. Food allergens (keyword ingredient mapping)
     * 3. Daily caloric budget overages
     *
     * If any conflict is found and warningAcknowledged is false, returns the warnings
     * to the client without saving.
     */
    static logOutsideMeal(input: LogOutsideMealInput): Promise<{
        warningRequired: boolean;
        warnings: string[];
        reasons: string[];
        estimate: {
            calories: number;
            proteinG: number;
            carbsG: number;
            fatG: number;
        };
        log?: undefined;
    } | {
        warningRequired: boolean;
        log: {
            id: string;
            userId: string;
            status: import(".prisma/client").$Enums.MealLogStatus;
            mealName: string;
            calories: number;
            proteinG: number;
            carbsG: number;
            fatG: number;
            mealPlanId: string | null;
            dataSource: import(".prisma/client").$Enums.MealLogDataSource;
            source: import(".prisma/client").$Enums.MealLogSource;
            warningType: string | null;
            warningShown: boolean;
            warningAcknowledged: boolean;
            loggedAt: Date;
            notes: string | null;
        };
        warnings?: undefined;
        reasons?: undefined;
        estimate?: undefined;
    }>;
}
export {};
//# sourceMappingURL=meal-log.service.d.ts.map