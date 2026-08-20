export declare class ProgressService {
    /**
     * Logs a new weight reading, updates the user's profile,
     * and dynamically recalculates the daily calorie target.
     */
    static logWeight(userId: string, weightKg: number, note?: string): Promise<{
        id: string;
        userId: string;
        weightKg: number;
        loggedAt: Date;
        note: string | null;
    }>;
    /**
     * Retrieves the weight history and nutrition compliance metrics of the user.
     */
    static getProgressHistory(userId: string): Promise<{
        weightLogs: {
            id: string;
            userId: string;
            weightKg: number;
            loggedAt: Date;
            note: string | null;
        }[];
        dailyNutritionLogs: {
            id: string;
            userId: string;
            logDate: Date;
            totalCalories: number;
            totalProteinG: number;
            totalCarbsG: number;
            totalFatG: number;
            targetCalories: number;
            adherencePct: number;
        }[];
    }>;
}
//# sourceMappingURL=progress.service.d.ts.map