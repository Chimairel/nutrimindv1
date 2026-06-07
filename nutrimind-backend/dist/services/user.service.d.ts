import { Goal, ActivityLevel, DietaryPreference, CarbPreference, HealthConditionType, AllergenType } from '@prisma/client';
interface ProfileUpdateData {
    age?: number;
    heightCm?: number;
    weightKg?: number;
    targetWeightKg?: number;
    goal?: Goal;
    activityLevel?: ActivityLevel;
    dietaryPreference?: DietaryPreference;
    carbPreference?: CarbPreference;
    foodCulture?: string;
}
export declare class UserService {
    /**
     * Updates or creates the user's base profile settings.
     */
    static updateUserProfile(userId: string, data: ProfileUpdateData): Promise<{
        id: string;
        updatedAt: Date;
        age: number | null;
        heightCm: number | null;
        weightKg: number | null;
        goal: import(".prisma/client").$Enums.Goal | null;
        activityLevel: import(".prisma/client").$Enums.ActivityLevel | null;
        userId: string;
        targetWeightKg: number | null;
        dietaryPreference: import(".prisma/client").$Enums.DietaryPreference | null;
        carbPreference: import(".prisma/client").$Enums.CarbPreference | null;
        foodCulture: string | null;
        dailyCalorieTarget: number | null;
        lastCheckinAt: Date | null;
        checkinStreak: number;
    }>;
    /**
     * Updates user health conditions atomically within a transaction.
     */
    static updateHealthConditions(userId: string, conditions: HealthConditionType[]): Promise<{
        id: string;
        userId: string;
        condition: import(".prisma/client").$Enums.HealthConditionType;
    }[]>;
    /**
     * Updates user allergens atomically within a transaction.
     * Note: The schema model is "Allgy" and field is "allergen".
     */
    static updateAllergies(userId: string, allergies: AllergenType[]): Promise<{
        id: string;
        userId: string;
        allergen: import(".prisma/client").$Enums.AllergenType;
    }[]>;
    /**
     * Accepts the Terms of Service.
     */
    static acceptTos(userId: string): Promise<{
        id: string;
        email: string;
        name: string;
        passwordHash: string;
        role: import(".prisma/client").$Enums.Role;
        tosAccepted: boolean;
        tosAcceptedAt: Date | null;
        onboardingDone: boolean;
        image: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Finalizes user onboarding by:
     * 1. Pulling their latest profile and health conditions.
     * 2. Calculating BMR/TDEE and setting the target daily calories.
     * 3. Updating the profile with the calculated target and setting onboardingDone = true.
     */
    static completeOnboarding(userId: string, biologicalSex?: 'MALE' | 'FEMALE'): Promise<{
        dailyCalorieTarget: number;
        onboardingDone: boolean;
    }>;
    /**
     * Fetches the complete dynamic User details (with Profile, Conditions, Allergies, NutritionReport)
     * to fully support client-side AuthContext synchronization.
     */
    static getUserProfileDetails(userId: string): Promise<{
        id: string;
        name: string;
        email: string;
        role: import(".prisma/client").$Enums.Role;
        tosAccepted: boolean;
        tosAcceptedAt: Date | null;
        onboardingDone: boolean;
        createdAt: Date;
        updatedAt: Date;
        userProfile: {
            id: string;
            updatedAt: Date;
            age: number | null;
            heightCm: number | null;
            weightKg: number | null;
            goal: import(".prisma/client").$Enums.Goal | null;
            activityLevel: import(".prisma/client").$Enums.ActivityLevel | null;
            userId: string;
            targetWeightKg: number | null;
            dietaryPreference: import(".prisma/client").$Enums.DietaryPreference | null;
            carbPreference: import(".prisma/client").$Enums.CarbPreference | null;
            foodCulture: string | null;
            dailyCalorieTarget: number | null;
            lastCheckinAt: Date | null;
            checkinStreak: number;
        } | null;
        healthConditions: import(".prisma/client").$Enums.HealthConditionType[];
        allergies: import(".prisma/client").$Enums.AllergenType[];
        nutritionReport: {
            id: string;
            generatedAt: Date;
            acknowledgedAt: Date | null;
        } | null;
    } | null>;
}
export {};
//# sourceMappingURL=user.service.d.ts.map