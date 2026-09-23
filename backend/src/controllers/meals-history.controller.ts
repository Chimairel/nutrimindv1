import { Response } from 'express';

import { AuthenticatedRequest } from '@/types';

import prisma from '@/lib/prisma';
import { MealLogSource, MealLogStatus } from '@prisma/client';

export async function getPlanHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }

    const { search, source, status, startDate, endDate } = req.query;

    const where: any = { userId };

    if (search && typeof search === 'string') {
      where.mealName = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (source && typeof source === 'string') {
      where.source = source as MealLogSource;
    }

    if (status && typeof status === 'string' && status !== 'All') {
      where.status = status as MealLogStatus;
    } else {
      where.status = { in: ['DONE', 'SKIPPED', 'VOIDED'] };
    }

    if (startDate || endDate) {
      where.loggedAt = {};
      if (startDate && typeof startDate === 'string') {
        where.loggedAt.gte = new Date(startDate);
      }
      if (endDate && typeof endDate === 'string') {
        where.loggedAt.lte = new Date(endDate);
      }
    }

    // Fetch ALL meal logs for this user (both plan-checked and outside) with search and filters
    const allLogs = await prisma.mealLog.findMany({
      where,
      select: {
        id: true,
        mealName: true,
        source: true,
        calories: true,
        proteinG: true,
        carbsG: true,
        fatG: true,
        dataSource: true,
        status: true,
        warningType: true,
        nutritionCompleteness: true,
        provisionalCalories: true,
        mealType: true,
        notes: true,
        estimationContext: true,
        outsideImageMime: true,
        voidedAt: true,
        loggedAt: true,
        outsideItems: {
          include: {
            observedSubmissions: {
              select: { id: true, sourceRevision: true, status: true, imageReuseConsentedAt: true },
              orderBy: { createdAt: 'desc' },
              take: 3,
            },
            revisions: { orderBy: { revision: 'desc' }, take: 1, select: { revision: true, reason: true } },
            review: {
              select: {
                id: true,
                status: true,
                queueReason: true,
                requestedByUserAt: true,
                reviewedRevision: true,
                reviewedAt: true,
                messages: {
                  select: { id: true, sender: true, itemRevision: true, content: true, createdAt: true },
                  orderBy: { createdAt: 'asc' },
                  take: 12,
                },
              },
            },
          },
        },
        mealPlan: { select: { mealType: true, swapLogs: { orderBy: { swappedAt: 'desc' }, take: 1 } } },
      },
      orderBy: { loggedAt: 'desc' },
    });

    // Normalize to unified shape
    const normalized = allLogs.map((l) => {
      const latestSwap = l.mealPlan?.swapLogs?.[0];
      return {
        id: l.id,
        mealName: l.mealName,
        source: l.source as string, // 'SYSTEM_GENERATED' | 'USER_LOGGED' | 'USER_SWAPPED'
        calories: l.calories,
        proteinG: l.proteinG,
        carbsG: l.carbsG,
        fatG: l.fatG,
        dataSource: l.dataSource as string,
        status: l.status as string,
        warningType: l.warningType ?? null,
        nutritionCompleteness: l.nutritionCompleteness,
        provisionalCalories: l.provisionalCalories,
        mealType: l.mealType ?? l.mealPlan?.mealType ?? null,
        notes: l.notes ?? null,
        estimationContext: l.estimationContext ?? null,
        hasImage: Boolean(l.outsideImageMime),
        voidedAt: l.voidedAt?.toISOString() ?? null,
        outsideItems: l.outsideItems,
        loggedAt: l.loggedAt.toISOString(),
        calorieDelta: latestSwap ? latestSwap.calorieDelta : null,
      };
    });

    return res.status(200).json({
      success: true,
      data: normalized,
    });
  } catch (error: any) {
    console.error('[MealsController] getPlanHistory error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve meal history.',
    });
  }
}
