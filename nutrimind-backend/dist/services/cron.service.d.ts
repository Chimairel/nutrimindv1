export declare class CronService {
    /**
     * Aggregates completed calorie logs from yesterday for all onboarded users,
     * calculates clinical calorie adherence, and logs daily performance metrics.
     */
    static runDailyCheckin(): Promise<{
        success: boolean;
        processedCount: number;
        logs: {
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
//# sourceMappingURL=cron.service.d.ts.map