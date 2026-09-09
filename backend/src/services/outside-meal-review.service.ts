import {
  MealLogDataSource,
  NotificationType,
  OutsideMealItemSource,
  OutsideMealNutritionStatus,
  OutsideMealReviewStatus,
  Prisma,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { summarizeOutsideMealNutrition } from '@/domain/outside-meal.policy';

const CLAIM_MINUTES = 30;

function aggregateDataSource(items: Array<{ includedInTotals: boolean; source: OutsideMealItemSource }>) {
  const sources = new Set(items.filter((item) => item.includedInTotals).map((item) => item.source));
  if (sources.size !== 1) return MealLogDataSource.MIXED;
  const source = [...sources][0];
  if (source === OutsideMealItemSource.FNRI) return MealLogDataSource.FNRI;
  if (source === OutsideMealItemSource.GEMINI_ESTIMATED) return MealLogDataSource.GEMINI_ESTIMATED;
  if (source === OutsideMealItemSource.VERIFIED_LIBRARY) return MealLogDataSource.VERIFIED_LIBRARY;
  if (source === OutsideMealItemSource.USER_REPORTED) return MealLogDataSource.USER_REPORTED;
  if (source === OutsideMealItemSource.NUTRITIONIST_REVIEWED) return MealLogDataSource.NUTRITIONIST_REVIEWED;
  return MealLogDataSource.MIXED;
}

type ReviewAction = {
  action: 'VERIFY' | 'CORRECT' | 'NEEDS_MORE_INFO';
  calories?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  reason: string;
};

export class OutsideMealReviewService {
  static async queue(nutritionistProfileId: string) {
    const cutoff = new Date(Date.now() - CLAIM_MINUTES * 60 * 1000);
    const rows = await prisma.outsideMealReview.findMany({
      where: { status: { in: [OutsideMealReviewStatus.PENDING, OutsideMealReviewStatus.CLAIMED] } },
      include: {
        outsideMealLogItem: {
          include: {
            mealLog: { select: { id: true, userId: true, mealName: true, mealType: true, loggedAt: true } },
            revisions: { orderBy: { revision: 'desc' }, take: 1 },
          },
        },
        claimedByNutritionist: { include: { user: { select: { name: true } } } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => ({
      ...row,
      claimStatus: {
        claimedByMe:
          row.claimedByNutritionistId === nutritionistProfileId && !!row.claimedAt && row.claimedAt >= cutoff,
        claimedByOther:
          row.claimedByNutritionistId !== null &&
          row.claimedByNutritionistId !== nutritionistProfileId &&
          !!row.claimedAt &&
          row.claimedAt >= cutoff,
        claimedByName: row.claimedByNutritionist?.user.name ?? null,
      },
    }));
  }

  static async claim(nutritionistProfileId: string, reviewId: string) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - CLAIM_MINUTES * 60 * 1000);
    const claimed = await prisma.outsideMealReview.updateMany({
      where: {
        id: reviewId,
        status: { in: [OutsideMealReviewStatus.PENDING, OutsideMealReviewStatus.CLAIMED] },
        OR: [
          { claimedByNutritionistId: null },
          { claimedAt: null },
          { claimedAt: { lt: cutoff } },
          { claimedByNutritionistId: nutritionistProfileId },
        ],
      },
      data: { status: OutsideMealReviewStatus.CLAIMED, claimedByNutritionistId: nutritionistProfileId, claimedAt: now },
    });
    if (claimed.count !== 1)
      throw new AppError('This estimate is already claimed or reviewed.', 409, 'REVIEW_CLAIM_CONFLICT');
    return prisma.outsideMealReview.findUnique({
      where: { id: reviewId },
      include: { outsideMealLogItem: { include: { mealLog: true, revisions: { orderBy: { revision: 'asc' } } } } },
    });
  }

  static async resolve(nutritionistProfileId: string, reviewId: string, action: ReviewAction) {
    return prisma.$transaction(
      async (tx) => {
        const now = new Date();
        const cutoff = new Date(now.getTime() - CLAIM_MINUTES * 60 * 1000);
        const review = await tx.outsideMealReview.findFirst({
          where: {
            id: reviewId,
            status: OutsideMealReviewStatus.CLAIMED,
            claimedByNutritionistId: nutritionistProfileId,
            claimedAt: { gte: cutoff },
          },
          include: { outsideMealLogItem: { include: { mealLog: true } } },
        });
        if (!review)
          throw new AppError('Acquire an active review claim before submitting.', 409, 'ACTIVE_CLAIM_REQUIRED');

        const item = review.outsideMealLogItem;
        const correction = action.action === 'CORRECT';
        const needsInfo = action.action === 'NEEDS_MORE_INFO';
        const values = correction
          ? { calories: action.calories!, proteinG: action.proteinG!, carbsG: action.carbsG!, fatG: action.fatG! }
          : { calories: item.calories, proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG };
        const nutritionStatus = needsInfo
          ? OutsideMealNutritionStatus.NEEDS_MORE_INFO
          : correction
            ? OutsideMealNutritionStatus.CORRECTED
            : OutsideMealNutritionStatus.VERIFIED;
        const reviewStatus = needsInfo
          ? OutsideMealReviewStatus.NEEDS_MORE_INFO
          : correction
            ? OutsideMealReviewStatus.CORRECTED
            : OutsideMealReviewStatus.VERIFIED;
        const revision = item.currentRevision + 1;

        await tx.outsideMealItemRevision.create({
          data: {
            outsideMealLogItemId: item.id,
            revision,
            source: needsInfo ? item.source : OutsideMealItemSource.NUTRITIONIST_REVIEWED,
            nutritionStatus,
            ...values,
            calorieLow: needsInfo ? item.calorieLow : values.calories,
            calorieHigh: needsInfo ? item.calorieHigh : values.calories,
            reason: action.reason,
            reviewedByNutritionistId: nutritionistProfileId,
          },
        });
        await tx.outsideMealLogItem.update({
          where: { id: item.id },
          data: {
            currentRevision: revision,
            source: needsInfo ? item.source : OutsideMealItemSource.NUTRITIONIST_REVIEWED,
            nutritionStatus,
            includedInTotals: needsInfo ? item.includedInTotals : true,
            ...values,
            calorieLow: needsInfo ? item.calorieLow : values.calories,
            calorieHigh: needsInfo ? item.calorieHigh : values.calories,
          },
        });
        await tx.outsideMealReview.update({
          where: { id: review.id },
          data: { status: reviewStatus, reviewedAt: now },
        });

        const siblings = await tx.outsideMealLogItem.findMany({ where: { mealLogId: item.mealLogId } });
        const summary = summarizeOutsideMealNutrition(
          siblings.map((row) => ({
            source: row.source,
            nutritionStatus: row.nutritionStatus,
            includedInTotals: row.includedInTotals,
            calories: row.calories ?? 0,
            proteinG: row.proteinG ?? 0,
            carbsG: row.carbsG ?? 0,
            fatG: row.fatG ?? 0,
          }))
        );
        await tx.mealLog.update({
          where: { id: item.mealLogId },
          data: {
            calories: summary.totals.calories,
            proteinG: summary.totals.proteinG,
            carbsG: summary.totals.carbsG,
            fatG: summary.totals.fatG,
            provisionalCalories: summary.provisionalCalories,
            nutritionCompleteness: summary.completeness,
            dataSource: aggregateDataSource(siblings),
          },
        });
        await tx.notification.create({
          data: {
            userId: item.mealLog.userId,
            title: needsInfo ? 'Outside meal needs more information' : 'Outside meal nutrition updated',
            message: needsInfo
              ? `A nutritionist needs more information about “${item.name}”. ${action.reason}`
              : `A nutritionist ${correction ? 'corrected' : 'verified'} “${item.name}”. Your daily totals were updated automatically.`,
            type: needsInfo ? NotificationType.OUTSIDE_MEAL_MORE_INFO : NotificationType.OUTSIDE_MEAL_REVIEWED,
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: (
              await tx.nutritionistProfile.findUniqueOrThrow({
                where: { id: nutritionistProfileId },
                select: { userId: true },
              })
            ).userId,
            action: `OUTSIDE_MEAL_${action.action}`,
            entityType: 'OutsideMealLogItem',
            entityId: item.id,
            metadata: { revision, reason: action.reason },
          },
        });
        return { reviewId: review.id, itemId: item.id, nutritionStatus, revision, summary };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  }
}
