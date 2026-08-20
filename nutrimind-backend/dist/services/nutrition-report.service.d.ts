export declare class NutritionReportService {
    /**
     * Fetches the current nutrition report for the user.
     */
    static getReport(userId: string): Promise<{
        id: string;
        userId: string;
        generatedAt: Date;
        acknowledgedAt: Date | null;
        foodsToAvoid: import("@prisma/client/runtime/library").JsonValue;
        foodsToLimit: import("@prisma/client/runtime/library").JsonValue;
        foodsRecommended: import("@prisma/client/runtime/library").JsonValue;
        drinksGuidance: import("@prisma/client/runtime/library").JsonValue;
        generalSummary: string;
        basedOnConditions: import("@prisma/client/runtime/library").JsonValue;
        basedOnAllergies: import("@prisma/client/runtime/library").JsonValue;
    } | null>;
    /**
     * Acknowledges the user's current report by setting acknowledgedAt to now.
     */
    static acknowledgeReport(userId: string): Promise<{
        id: string;
        userId: string;
        generatedAt: Date;
        acknowledgedAt: Date | null;
        foodsToAvoid: import("@prisma/client/runtime/library").JsonValue;
        foodsToLimit: import("@prisma/client/runtime/library").JsonValue;
        foodsRecommended: import("@prisma/client/runtime/library").JsonValue;
        drinksGuidance: import("@prisma/client/runtime/library").JsonValue;
        generalSummary: string;
        basedOnConditions: import("@prisma/client/runtime/library").JsonValue;
        basedOnAllergies: import("@prisma/client/runtime/library").JsonValue;
    }>;
    /**
     * Generates a customized clinical assessment utilizing the Google Gemini API (with cascade fallbacks).
     * Contextualizes the prompt with local seeded FNRI foods to prioritize affordable, native
     * Filipino meal plans over Western food items.
     */
    static generateReport(userId: string): Promise<{
        id: string;
        userId: string;
        generatedAt: Date;
        acknowledgedAt: Date | null;
        foodsToAvoid: import("@prisma/client/runtime/library").JsonValue;
        foodsToLimit: import("@prisma/client/runtime/library").JsonValue;
        foodsRecommended: import("@prisma/client/runtime/library").JsonValue;
        drinksGuidance: import("@prisma/client/runtime/library").JsonValue;
        generalSummary: string;
        basedOnConditions: import("@prisma/client/runtime/library").JsonValue;
        basedOnAllergies: import("@prisma/client/runtime/library").JsonValue;
    }>;
}
//# sourceMappingURL=nutrition-report.service.d.ts.map