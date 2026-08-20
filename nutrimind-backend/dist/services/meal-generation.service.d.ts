import { PlanType } from '@prisma/client';
export declare class MealGenerationService {
    /**
     * Determines whether to generate a STARTER plan (partial days until next
     * weekStartDay) or a full WEEKLY plan, based on the user's shoppingDayGroup.
     * Falls back to a 7-day WEEKLY plan for users without a shoppingDayGroup.
     */
    static generatePlanForUser(userId: string): Promise<string>;
    /**
     * Generates a meal plan for N days, customized to the user's macro metrics,
     * clinical restrictions, food preferences, and cultural style.
     * planType: STARTER (bridge plan) or WEEKLY (normal 7-day cycle).
     * numDays: number of days to cover (1-7).
     * startDate: the first day of the plan.
     */
    static generate7DayPlan(userId: string, planType?: PlanType, numDays?: number, startDate?: Date): Promise<string>;
}
//# sourceMappingURL=meal-generation.service.d.ts.map