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
export function calculateDailyTarget(input: CalorieInput): CalorieResult {
  const {
    age,
    heightCm,
    weightKg,
    goal,
    activityLevel,
    biologicalSex,
    hasPregnantCondition
  } = input;

  // Determine sex: if PREGNANT condition exists, force FEMALE.
  // Otherwise, default to biologicalSex parameter or FEMALE as a safe baseline.
  const isFemale = hasPregnantCondition || biologicalSex === 'FEMALE' || !biologicalSex;

  // 1. Calculate Basal Metabolic Rate (BMR)
  let bmr = 0;
  if (isFemale) {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age - 161; // Female: -161
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;   // Male: +5
  }

  // 2. Calculate Total Daily Energy Expenditure (TDEE) based on Activity level
  let activityMultiplier = 1.2;
  switch (activityLevel) {
    case ActivityLevel.SEDENTARY:
      activityMultiplier = 1.2;
      break;
    case ActivityLevel.LIGHTLY_ACTIVE:
      activityMultiplier = 1.375;
      break;
    case ActivityLevel.ACTIVE:
      activityMultiplier = 1.55;
      break;
    case ActivityLevel.VERY_ACTIVE:
      activityMultiplier = 1.725;
      break;
    default:
      activityMultiplier = 1.2;
  }

  const tdee = bmr * activityMultiplier;

  // 3. Adjust TDEE by Goal to find Daily Calorie Target
  let dailyCalorieTarget = tdee;
  switch (goal) {
    case Goal.LOSE_WEIGHT:
      dailyCalorieTarget = tdee - 500;
      break;
    case Goal.GAIN_WEIGHT:
      dailyCalorieTarget = tdee + 500;
      break;
    case Goal.MAINTAIN:
      dailyCalorieTarget = tdee;
      break;
    case Goal.BUILD_MUSCLE:
      dailyCalorieTarget = tdee + 300;
      break;
    default:
      dailyCalorieTarget = tdee;
  }

  // Floor target to avoid negative numbers and round to nearest integer
  return {
    bmr: Math.round(Math.max(0, bmr)),
    tdee: Math.round(Math.max(0, tdee)),
    dailyCalorieTarget: Math.round(Math.max(500, dailyCalorieTarget)) // Enforce 500 kcal starvation floor
  };
}
