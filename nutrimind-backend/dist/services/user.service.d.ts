import { Goal, ActivityLevel, DietaryPreference, CarbPreference, HealthConditionType, AllergenType } from '@prisma/client';
interface ProfileUpdateData {
    age?: number;
    biologicalSex?: string;
    heightCm?: number;
    weightKg?: number;
    targetWeightKg?: number;
    goal?: Goal;
    activityLevel?: ActivityLevel;
    dietaryPreference?: DietaryPreference;
    carbPreference?: CarbPreference;
    foodCulture?: string;
    otherConditions?: string;
    otherAllergies?: string;
}
export declare class UserService {
    /**
     * Updates or creates the user's base profile settings.
     */
    static updateUserProfile(userId: string, data: ProfileUpdateData): Promise<{
        id: string;
        updatedAt: Date;
        userId: string;
        age: number | null;
        heightCm: number | null;
        weightKg: number | null;
        goal: import(".prisma/client").$Enums.Goal | null;
        activityLevel: import(".prisma/client").$Enums.ActivityLevel | null;
        biologicalSex: string | null;
        targetWeightKg: number | null;
        dietaryPreference: import(".prisma/client").$Enums.DietaryPreference | null;
        carbPreference: import(".prisma/client").$Enums.CarbPreference | null;
        foodCulture: string | null;
        dailyCalorieTarget: number | null;
        otherConditions: string | null;
        otherAllergies: string | null;
        shoppingDayGroup: import(".prisma/client").$Enums.ShoppingDayGroup | null;
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
     */
    static updateAllergies(userId: string, allergies: AllergenType[]): Promise<{
        id: string;
        userId: string;
        allergen: import(".prisma/client").$Enums.AllergenType;
    }[]>;
    /**
     * Saves custom free-text health conditions to the user's profile.
     * This is separate from the enum-based healthConditions table.
     */
    static updateOtherConditions(userId: string, otherConditions: string): Promise<{
        id: string;
        updatedAt: Date;
        userId: string;
        age: number | null;
        heightCm: number | null;
        weightKg: number | null;
        goal: import(".prisma/client").$Enums.Goal | null;
        activityLevel: import(".prisma/client").$Enums.ActivityLevel | null;
        biologicalSex: string | null;
        targetWeightKg: number | null;
        dietaryPreference: import(".prisma/client").$Enums.DietaryPreference | null;
        carbPreference: import(".prisma/client").$Enums.CarbPreference | null;
        foodCulture: string | null;
        dailyCalorieTarget: number | null;
        otherConditions: string | null;
        otherAllergies: string | null;
        shoppingDayGroup: import(".prisma/client").$Enums.ShoppingDayGroup | null;
        lastCheckinAt: Date | null;
        checkinStreak: number;
    }>;
    /**
     * Saves custom free-text food allergies to the user's profile.
     * This is separate from the enum-based allergies table.
     */
    static updateOtherAllergies(userId: string, otherAllergies: string): Promise<{
        id: string;
        updatedAt: Date;
        userId: string;
        age: number | null;
        heightCm: number | null;
        weightKg: number | null;
        goal: import(".prisma/client").$Enums.Goal | null;
        activityLevel: import(".prisma/client").$Enums.ActivityLevel | null;
        biologicalSex: string | null;
        targetWeightKg: number | null;
        dietaryPreference: import(".prisma/client").$Enums.DietaryPreference | null;
        carbPreference: import(".prisma/client").$Enums.CarbPreference | null;
        foodCulture: string | null;
        dailyCalorieTarget: number | null;
        otherConditions: string | null;
        otherAllergies: string | null;
        shoppingDayGroup: import(".prisma/client").$Enums.ShoppingDayGroup | null;
        lastCheckinAt: Date | null;
        checkinStreak: number;
    }>;
    /**
     * Saves the user's preferred shopping day group.
     * WEEKEND → weekly cycle runs Sunday to Saturday.
     * WEEKDAY → weekly cycle runs Monday to Sunday.
     */
    static saveShoppingDay(userId: string, shoppingDayGroup: 'WEEKEND' | 'WEEKDAY'): Promise<{
        id: string;
        updatedAt: Date;
        userId: string;
        age: number | null;
        heightCm: number | null;
        weightKg: number | null;
        goal: import(".prisma/client").$Enums.Goal | null;
        activityLevel: import(".prisma/client").$Enums.ActivityLevel | null;
        biologicalSex: string | null;
        targetWeightKg: number | null;
        dietaryPreference: import(".prisma/client").$Enums.DietaryPreference | null;
        carbPreference: import(".prisma/client").$Enums.CarbPreference | null;
        foodCulture: string | null;
        dailyCalorieTarget: number | null;
        otherConditions: string | null;
        otherAllergies: string | null;
        shoppingDayGroup: import(".prisma/client").$Enums.ShoppingDayGroup | null;
        lastCheckinAt: Date | null;
        checkinStreak: number;
    }>;
    /**
     * Accepts the Terms of Service.
  
     */
    static acceptTos(userId: string): Promise<{
        name: string;
        id: string;
        email: string;
        passwordHash: string;
        role: import(".prisma/client").$Enums.Role;
        emailVerified: boolean;
        emailVerificationToken: string | null;
        emailVerificationExpiry: Date | null;
        passwordResetToken: string | null;
        passwordResetExpiry: Date | null;
        tosAccepted: boolean;
        tosAcceptedAt: Date | null;
        onboardingDone: boolean;
        image: string | null;
        createdAt: Date;
        updatedAt: Date;
    }>;
    /**
     * Updates the user's avatar image seed or custom URL.
     */
    static updateUserImage(userId: string, image: string): Promise<{
        name: string;
        id: string;
        email: string;
        passwordHash: string;
        role: import(".prisma/client").$Enums.Role;
        emailVerified: boolean;
        emailVerificationToken: string | null;
        emailVerificationExpiry: Date | null;
        passwordResetToken: string | null;
        passwordResetExpiry: Date | null;
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
    static completeOnboarding(userId: string): Promise<{
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
        emailVerified: boolean;
        tosAccepted: boolean;
        tosAcceptedAt: Date | null;
        onboardingDone: boolean;
        image: string | null;
        createdAt: Date;
        updatedAt: Date;
        userProfile: {
            id: string;
            updatedAt: Date;
            userId: string;
            age: number | null;
            heightCm: number | null;
            weightKg: number | null;
            goal: import(".prisma/client").$Enums.Goal | null;
            activityLevel: import(".prisma/client").$Enums.ActivityLevel | null;
            biologicalSex: string | null;
            targetWeightKg: number | null;
            dietaryPreference: import(".prisma/client").$Enums.DietaryPreference | null;
            carbPreference: import(".prisma/client").$Enums.CarbPreference | null;
            foodCulture: string | null;
            dailyCalorieTarget: number | null;
            otherConditions: string | null;
            otherAllergies: string | null;
            shoppingDayGroup: import(".prisma/client").$Enums.ShoppingDayGroup | null;
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
    /**
     * Helper function to detect health condition and allergy conflicts in a meal.
     */
    static checkSafetyConflict(conditions: HealthConditionType[], allergens: AllergenType[], meal: {
        mealName: string;
        description: string | null;
        ingredients: {
            ingredientName: string;
        }[];
    }): boolean;
    /**
     * Automatically recheck active plan meals against new health conditions/allergies.
     * Swaps conflicting meals with eligible library meals or triggers a single-meal AI regeneration.
     * This logic is completely exempt from weekly swap count caps.
     */
    static runSafetyRecheck(userId: string): Promise<void>;
}
export {};
//# sourceMappingURL=user.service.d.ts.map