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
    /**
     * Sends weekly check-in notifications for all users in a shopping day group,
     * and auto-regenerates plans for users with 3+ consecutive missed check-ins.
     * Called by two separate cron jobs (one per ShoppingDayGroup).
     */
    static runWeeklyCheckin(group: 'WEEKEND' | 'WEEKDAY'): Promise<{
        success: boolean;
        group: "WEEKEND" | "WEEKDAY";
        processedCount: number;
        results: {
            userId: string;
            email: string;
            notified: boolean;
        }[];
    }>;
}
//# sourceMappingURL=cron.service.d.ts.map