import prisma from '@/lib/prisma';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';

export class WaterService {
  static async getToday(userId: string, now = new Date()) {
    const start = getStartOfManilaBusinessDay(now);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const entries = await prisma.waterLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      orderBy: { loggedAt: 'asc' },
    });
    return {
      totalMl: entries.reduce((sum, entry) => sum + entry.amountMl, 0),
      entries,
    };
  }

  static async add(userId: string, amountMl: number) {
    await prisma.waterLog.create({ data: { userId, amountMl } });
    return this.getToday(userId);
  }

  static async resetToday(userId: string, now = new Date()) {
    const start = getStartOfManilaBusinessDay(now);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    await prisma.waterLog.deleteMany({ where: { userId, loggedAt: { gte: start, lt: end } } });
    return { totalMl: 0, entries: [] };
  }

  static async remove(userId: string, amountMl: number, now = new Date()) {
    const start = getStartOfManilaBusinessDay(now);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    await prisma.$transaction(async (tx) => {
      const entries = await tx.waterLog.findMany({
        where: { userId, loggedAt: { gte: start, lt: end } },
        orderBy: { loggedAt: 'desc' },
      });
      let remaining = amountMl;
      for (const entry of entries) {
        if (remaining <= 0) break;
        if (entry.amountMl <= remaining || entry.amountMl - remaining < 50) {
          remaining -= entry.amountMl;
          await tx.waterLog.delete({ where: { id: entry.id } });
        } else {
          await tx.waterLog.update({
            where: { id: entry.id },
            data: { amountMl: entry.amountMl - remaining },
          });
          remaining = 0;
        }
      }
    });
    return this.getToday(userId, now);
  }
}
