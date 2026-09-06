import prisma from '@/lib/prisma';
import { isSupportedWeightKg, normalizeWeightNote } from '@/policies/weight-entry.policy';

export class WeightLogService {
  /**
   * Returns all weight log entries for a user, ordered by date.
   */
  static async getWeightHistory(userId: string) {
    return prisma.weightLog.findMany({
      where: { userId },
      orderBy: { loggedAt: 'asc' },
    });
  }

  /**
   * Creates a new weight log entry.
   */
  static async logWeight(userId: string, weightKg: number, note?: string) {
    if (!isSupportedWeightKg(weightKg)) {
      throw new Error('Weight must be between 30 and 300 kg.');
    }
    const normalizedNote = normalizeWeightNote(note);

    return prisma.$transaction(async (tx) => {
      await tx.userProfile.update({
        where: { userId },
        data: { weightKg },
      });
      return tx.weightLog.create({
        data: { userId, weightKg, note: normalizedNote },
      });
    });
  }

  /**
   * Returns the latest weight log entry.
   */
  static async getLatestWeight(userId: string) {
    return prisma.weightLog.findFirst({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
    });
  }
}
