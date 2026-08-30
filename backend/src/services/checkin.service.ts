import prisma from '@/lib/prisma';
import { NotificationType } from '@prisma/client';

export class CheckinService {
  /**
   * Returns the user's current check-in status.
   */
  static async getCheckinStatus(userId: string) {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { lastCheckinAt: true, checkinStreak: true },
    });

    if (!profile) {
      return { isDue: false, streak: 0, lastCheckinAt: null };
    }

    const now = new Date();
    const lastCheckin = profile.lastCheckinAt;
    let isDue = true;

    if (lastCheckin) {
      // Check-in is due if more than 7 days since last check-in
      const daysSince = Math.floor((now.getTime() - lastCheckin.getTime()) / (1000 * 60 * 60 * 24));
      isDue = daysSince >= 7;
    }

    return {
      isDue,
      streak: profile.checkinStreak,
      lastCheckinAt: profile.lastCheckinAt,
    };
  }

  /**
   * Submits a weekly check-in.
   * If changed=false, just update streak and lastCheckinAt.
   * If changed=true, update profile with new values and optionally recalculate.
   */
  static async submitCheckin(userId: string, data: { changed: boolean; updates?: Record<string, any> }) {
    const profile = await prisma.userProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new Error('User profile must be initialized first.');
    }

    const now = new Date();

    if (data.changed && data.updates) {
      // Update profile with new values
      await prisma.userProfile.update({
        where: { userId },
        data: {
          ...data.updates,
          lastCheckinAt: now,
          checkinStreak: { increment: 1 },
        },
      });
    } else {
      // Just update the check-in timestamp and streak
      await prisma.userProfile.update({
        where: { userId },
        data: {
          lastCheckinAt: now,
          checkinStreak: { increment: 1 },
        },
      });
    }

    return {
      success: true,
      lastCheckinAt: now,
      streak: profile.checkinStreak + 1,
    };
  }
}
