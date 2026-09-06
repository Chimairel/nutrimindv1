import prisma from '@/lib/prisma';
import { calculateDailyTarget } from '@/lib/calculations';
import { HealthConditionType } from '@prisma/client';
import { isSupportedWeightKg, normalizeWeightNote } from '@/policies/weight-entry.policy';

export class ProgressService {
  /**
   * Logs a new weight reading, updates the user's profile,
   * and dynamically recalculates the daily calorie target.
   */
  static async logWeight(userId: string, weightKg: number, note?: string) {
    if (!isSupportedWeightKg(weightKg)) {
      throw new Error('Weight must be between 30 and 300 kg.');
    }
    const normalizedNote = normalizeWeightNote(note);

    return prisma.$transaction(async (tx) => {
      const profile = await tx.userProfile.findUnique({ where: { userId } });
      if (!profile) throw new Error('Profile not found.');

      const { age, heightCm, goal, activityLevel } = profile;
      let dailyCalorieTarget = profile.dailyCalorieTarget;
      if (age && heightCm && goal && activityLevel) {
        const healthConditions = await tx.healthCondition.findMany({ where: { userId } });
        const hasPregnantCondition = healthConditions.some(
          (condition) => condition.condition === HealthConditionType.PREGNANT
        );
        dailyCalorieTarget = calculateDailyTarget({
          age,
          heightCm,
          weightKg,
          goal,
          activityLevel,
          biologicalSex: profile.biologicalSex as 'MALE' | 'FEMALE' | undefined,
          hasPregnantCondition,
        }).dailyCalorieTarget;
      }

      await tx.userProfile.update({
        where: { userId },
        data: { weightKg, dailyCalorieTarget },
      });

      return tx.weightLog.create({
        data: { userId, weightKg, note: normalizedNote },
      });
    });
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
