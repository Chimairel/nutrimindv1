import { Goal, ActivityLevel } from '@prisma/client';
interface CalorieInput {
    age: number;
    heightCm: number;
    weightKg: number;
    goal: Goal;
    activityLevel: ActivityLevel;
    biologicalSex?: 'MALE' | 'FEMALE';
    hasPregnantCondition?: boolean;
}
interface CalorieResult {
    bmr: number;
    tdee: number;
    dailyCalorieTarget: number;
}
/**
 * Calculates BMR, TDEE, and daily calorie target using Mifflin-St Jeor formula
 * adjusted for daily activity level and fitness objectives.
 *
 * BMR Calculation (Mifflin-St Jeor as per specifications):
 *   Male:   10 * weight(kg) + 6.25 * height(cm) - 5 * age + 5
 *   Female: 10 * weight(kg) + 6.25 * height(cm) - 5 * age - 161
 *
 * Activity Multipliers:
 *   SEDENTARY:      * 1.2
 *   LIGHTLY_ACTIVE:  * 1.375
 *   ACTIVE:          * 1.55
 *   VERY_ACTIVE:     * 1.725
 *
 * Daily Targets:
 *   LOSE_WEIGHT:   TDEE - 500
 *   GAIN_WEIGHT:   TDEE + 500
 *   MAINTAIN:      TDEE
 *   BUILD_MUSCLE:  TDEE + 300
 */
export declare function calculateDailyTarget(input: CalorieInput): CalorieResult;
export {};
//# sourceMappingURL=calculations.d.ts.map