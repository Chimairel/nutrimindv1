import prisma from '@/lib/prisma';
import { calculateDailyTarget } from '@/lib/calculations';
import { HealthConditionType } from '@prisma/client';

export class ProgressService {
  /**
   * Logs a new weight reading, updates the user's profile,
   * and dynamically recalculates the daily calorie target.
   */
  static async logWeight(userId: string, weightKg: number, note?: string) {
    if (weightKg <= 0) {
      throw new Error('Weight must be a positive number.');
    }

    // 1. Create a WeightLog entry
    const weightLog = await prisma.weightLog.create({
      data: {
        userId,
        weightKg,
        note,
      },
    });

    // 2. Fetch profile stats to run Mifflin-St Jeor recalculation
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new Error('Profile not found.');
    }

    const { age, heightCm, goal, activityLevel } = profile;

    // Check if the user has completed onboarding stats
    if (age && heightCm && goal && activityLevel) {
      // Fetch health conditions for pregnancy check
      const healthConditions = await prisma.healthCondition.findMany({
        where: { userId },
      });

      const hasPregnantCondition = healthConditions.some(
        (c) => c.condition === HealthConditionType.PREGNANT
      );

      // Recalculate TDEE targets based on the NEW weight!
      const calculations = calculateDailyTarget({
        age,
        heightCm,
        weightKg, // Use the new weight
        goal,
        activityLevel,
        hasPregnantCondition,
      });

      // Update the user profile with the new weight and recalculated calorie targets
      await prisma.userProfile.update({
        where: { userId },
        data: {
          weightKg,
          dailyCalorieTarget: calculations.dailyCalorieTarget,
        },
      });
    } else {
      // If profile is somehow not fully completed yet, just update the weight
      await prisma.userProfile.update({
        where: { userId },
        data: {
          weightKg,
        },
      });
    }

    return weightLog;
  }

  /**
   * Retrieves the weight history and nutrition compliance metrics of the user.
   */
  static async getProgressHistory(userId: string) {
    // 1. Fetch weight logs sorted chronologically
    const weightLogs = await prisma.weightLog.findMany({
      where: { userId },
      orderBy: {
        loggedAt: 'asc',
      },
    });

    // 2. Fetch daily nutrition adherence logs sorted chronologically
    const dailyNutritionLogs = await prisma.dailyNutritionLog.findMany({
      where: { userId },
      orderBy: {
        logDate: 'asc',
      },
    });

    return {
      weightLogs,
      dailyNutritionLogs,
    };
  }
}
