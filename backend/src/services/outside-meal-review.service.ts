import {
  MealLogDataSource,
  OutsideMealMessageSender,
  NotificationType,
  OutsideMealItemSource,
  OutsideMealNutritionStatus,
  OutsideMealReviewStatus,
  Prisma,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { summarizeOutsideMealNutrition } from '@/domain/outside-meal.policy';
import { MealSwapService } from './meal-swap.service';

const CLAIM_MINUTES = 30;

function aggregateDataSource(items: Array<{ includedInTotals: boolean; source: OutsideMealItemSource }>) {
  const sources = new Set(items.filter((item) => item.includedInTotals).map((item) => item.source));
  if (sources.size !== 1) return MealLogDataSource.MIXED;
  const source = [...sources][0];
  if (source === OutsideMealItemSource.FNRI) return MealLogDataSource.FNRI;
  if (source === OutsideMealItemSource.GEMINI_ESTIMATED) return MealLogDataSource.GEMINI_ESTIMATED;
  if (source === OutsideMealItemSource.VERIFIED_LIBRARY) return MealLogDataSource.VERIFIED_LIBRARY;
  if (source === OutsideMealItemSource.USER_ADJUSTED_LIBRARY) return MealLogDataSource.USER_ADJUSTED_LIBRARY;
  if (source === OutsideMealItemSource.USER_REPORTED) return MealLogDataSource.USER_REPORTED;
  if (source === OutsideMealItemSource.NUTRITIONIST_REVIEWED) return MealLogDataSource.NUTRITIONIST_REVIEWED;
  return MealLogDataSource.MIXED;
}

type ReviewAction = {
  action: 'VERIFY' | 'CORRECT' | 'NEEDS_MORE_INFO' | 'UNVERIFIABLE';
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
      where: {
        status: { in: [OutsideMealReviewStatus.PENDING, OutsideMealReviewStatus.CLAIMED] },
        outsideMealLogItem: { mealLog: { status: 'DONE' } },
      },
      include: {
        outsideMealLogItem: {
          include: {
            mealLog: { select: { id: true, userId: true, mealName: true, mealType: true, loggedAt: true,
              estimationContext: true, outsideImageMime: true } },
            revisions: { orderBy: { revision: 'desc' }, take: 1 },
          },
        },
        messages: { orderBy: { createdAt: 'asc' }, take: 12 },
        claimedByNutritionist: { include: { user: { select: { name: true } } } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 100,
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
    return prisma.$transaction(async (tx) => {
      const review = await tx.outsideMealReview.findFirst({
        where: { id: reviewId, status: { in: [OutsideMealReviewStatus.PENDING, OutsideMealReviewStatus.CLAIMED] },
          outsideMealLogItem: { mealLog: { status: 'DONE' } } },
        include: { outsideMealLogItem: { select: { currentRevision: true } } },
      });
      if (!review) throw new AppError('This estimate is no longer available.', 409, 'REVIEW_CLAIM_CONFLICT');
      const claimed = await tx.outsideMealReview.updateMany({
        where: { id: reviewId, status: { in: [OutsideMealReviewStatus.PENDING, OutsideMealReviewStatus.CLAIMED] },
          OR: [ { claimedByNutritionistId: null }, { claimedAt: null }, { claimedAt: { lt: cutoff } },
            { claimedByNutritionistId: nutritionistProfileId } ] },
        data: { status: OutsideMealReviewStatus.CLAIMED, claimedByNutritionistId: nutritionistProfileId,
          claimedAt: now, claimedRevision: review.outsideMealLogItem.currentRevision },
      });
      if (claimed.count !== 1)
        throw new AppError('This estimate is already claimed or reviewed.', 409, 'REVIEW_CLAIM_CONFLICT');
      return tx.outsideMealReview.findUniqueOrThrow({
        where: { id: reviewId },
        include: { outsideMealLogItem: { include: {
          mealLog: { select: { id: true, mealName: true, mealType: true, loggedAt: true,
            estimationContext: true, outsideImageMime: true } },
          revisions: { orderBy: { revision: 'desc' }, take: 12 },
        } },
          messages: { orderBy: { createdAt: 'asc' }, take: 12 } },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000, maxWait: 15_000 });
  }

  static async requestByUser(userId: string, logId: string, itemId: string) {
    return prisma.$transaction(async (tx) => {
      const item = await tx.outsideMealLogItem.findFirst({
        where: { id: itemId, mealLogId: logId, mealLog: { userId, source: 'USER_LOGGED', status: 'DONE' } },
        include: { review: true },
      });
      if (!item) throw new AppError('Outside-meal item not found.', 404, 'OUTSIDE_ITEM_NOT_FOUND');
      if (item.review?.status === OutsideMealReviewStatus.NEEDS_MORE_INFO)
        throw new AppError('Reply to the nutritionist question to resume review.', 409, 'CLARIFICATION_REPLY_REQUIRED');
      const now = new Date();
      if (item.review && (item.review.status === OutsideMealReviewStatus.PENDING ||
        item.review.status === OutsideMealReviewStatus.CLAIMED)) {
        const review = await tx.outsideMealReview.update({ where: { id: item.review.id },
          data: { requestedByUserAt: item.review.requestedByUserAt ?? now,
            queueReason: 'USER_REQUEST', priority: Math.max(item.review.priority, 60) } });
        await tx.auditEvent.create({ data: { actorUserId: userId, action: 'OUTSIDE_MEAL_REVIEW_REQUESTED',
          entityType: 'OutsideMealLogItem', entityId: item.id,
          metadata: { reviewId: review.id, revision: item.currentRevision } } });
        return review;
      }
      const review = item.review ? await tx.outsideMealReview.update({ where: { id: item.review.id }, data: {
        status: OutsideMealReviewStatus.PENDING, requestedByUserAt: now, queueReason: 'USER_REQUEST',
        priority: 60, claimedByNutritionistId: null, claimedAt: null, claimedRevision: null,
        reviewedAt: null, reviewedRevision: null,
      } }) : await tx.outsideMealReview.create({ data: {
        outsideMealLogItemId: item.id, status: OutsideMealReviewStatus.PENDING,
        requestedByUserAt: now, queueReason: 'USER_REQUEST', priority: 60,
      } });
      await tx.auditEvent.create({ data: { actorUserId: userId, action: 'OUTSIDE_MEAL_REVIEW_REQUESTED',
        entityType: 'OutsideMealLogItem', entityId: item.id,
        metadata: { reviewId: review.id, revision: item.currentRevision } } });
      return review;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000, maxWait: 15_000 });
  }

  static async replyByUser(userId: string, logId: string, itemId: string, content: string) {
    return prisma.$transaction(async (tx) => {
      const review = await tx.outsideMealReview.findFirst({ where: {
        outsideMealLogItemId: itemId, status: OutsideMealReviewStatus.NEEDS_MORE_INFO,
        outsideMealLogItem: { mealLogId: logId, mealLog: { userId, status: 'DONE' } },
      }, include: { outsideMealLogItem: true, _count: { select: { messages: true } } } });
      if (!review) throw new AppError('No open clarification request was found.', 409, 'NO_OPEN_CLARIFICATION');
      if (review._count.messages >= 12) throw new AppError('This clarification thread has reached its limit.', 409, 'CLARIFICATION_LIMIT');
      const item = review.outsideMealLogItem;
      const revision = item.currentRevision + 1;
      const nutritionStatus = item.includedInTotals ? OutsideMealNutritionStatus.PENDING_REVIEW : OutsideMealNutritionStatus.UNRESOLVED;
      const changed = await tx.outsideMealLogItem.updateMany({ where: { id: item.id, currentRevision: item.currentRevision },
        data: { currentRevision: revision, nutritionStatus } });
      if (changed.count !== 1) throw new AppError('This item changed. Reload before replying.', 409, 'ITEM_REVISION_CHANGED');
      await tx.outsideMealItemRevision.create({ data: {
        outsideMealLogItemId: item.id, revision, source: item.source, nutritionStatus,
        calories: item.calories, proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG,
        calorieLow: item.calorieLow, calorieHigh: item.calorieHigh,
        reason: 'User supplied clarification', editedByUserId: userId,
        snapshot: { name: item.name, portionGrams: item.portionGrams, ingredients: item.ingredients ?? null,
          source: item.source, nutritionStatus, includedInTotals: item.includedInTotals,
          calories: item.calories, proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG,
          clarification: content } as Prisma.InputJsonObject,
      } });
      await tx.outsideMealReviewMessage.create({ data: {
        outsideMealReviewId: review.id, sender: OutsideMealMessageSender.USER,
        authorUserId: userId, itemRevision: revision, content,
      } });
      await tx.outsideMealReview.update({ where: { id: review.id }, data: {
        status: OutsideMealReviewStatus.PENDING, claimedByNutritionistId: null,
        claimedAt: null, claimedRevision: null, reviewedAt: null,
      } });
      await tx.auditEvent.create({ data: {
        actorUserId: userId, action: 'OUTSIDE_MEAL_CLARIFICATION_REPLIED',
        entityType: 'OutsideMealLogItem', entityId: item.id, metadata: { revision, reviewId: review.id },
      } });
      return { reviewId: review.id, itemId: item.id, revision, status: OutsideMealReviewStatus.PENDING };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000, maxWait: 15_000 });
  }

  static async imageForClaimedReview(nutritionistProfileId: string, reviewId: string) {
    const cutoff = new Date(Date.now() - CLAIM_MINUTES * 60 * 1000);
    const review = await prisma.outsideMealReview.findFirst({
      where: { id: reviewId, status: OutsideMealReviewStatus.CLAIMED,
        claimedByNutritionistId: nutritionistProfileId, claimedAt: { gte: cutoff },
        outsideMealLogItem: { mealLog: { status: 'DONE' } } },
      select: { outsideMealLogItem: { select: { mealLog: { select: { outsideImage: true, outsideImageMime: true } } } } },
    });
    const image = review?.outsideMealLogItem.mealLog;
    if (!image?.outsideImage || !image.outsideImageMime)
      throw new AppError('Review image not found.', 404, 'OUTSIDE_IMAGE_NOT_FOUND');
    return { buffer: Buffer.from(image.outsideImage), mime: image.outsideImageMime };
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
            outsideMealLogItem: { mealLog: { status: 'DONE' } },
          },
          include: { outsideMealLogItem: { include: { mealLog: true } } },
        });
        if (!review)
          throw new AppError('Acquire an active review claim before submitting.', 409, 'ACTIVE_CLAIM_REQUIRED');

        const item = review.outsideMealLogItem;
        if (review.claimedRevision === null || review.claimedRevision !== item.currentRevision)
          throw new AppError('This meal changed after it was claimed. Claim the new revision.', 409, 'STALE_REVIEW_REVISION');
        if (['VERIFY', 'CORRECT'].includes(action.action) && !item.includedInTotals && action.action !== 'CORRECT')
          throw new AppError('An unresolved item needs values before it can be confirmed.', 422, 'NUTRITION_VALUES_REQUIRED');
        const reviewer = await tx.nutritionistProfile.findUniqueOrThrow({
          where: { id: nutritionistProfileId }, select: { userId: true },
        });
        const correction = action.action === 'CORRECT';
        const needsInfo = action.action === 'NEEDS_MORE_INFO';
        const unverifiable = action.action === 'UNVERIFIABLE';
        const values = correction
          ? { calories: action.calories!, proteinG: action.proteinG!, carbsG: action.carbsG!, fatG: action.fatG! }
          : { calories: item.calories, proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG };
        const nutritionStatus = needsInfo
          ? OutsideMealNutritionStatus.NEEDS_MORE_INFO
          : unverifiable
            ? OutsideMealNutritionStatus.UNVERIFIABLE
          : correction
            ? OutsideMealNutritionStatus.CORRECTED
            : OutsideMealNutritionStatus.VERIFIED;
        const reviewStatus = needsInfo
          ? OutsideMealReviewStatus.NEEDS_MORE_INFO
          : unverifiable
            ? OutsideMealReviewStatus.UNVERIFIABLE
          : correction
            ? OutsideMealReviewStatus.CORRECTED
            : OutsideMealReviewStatus.VERIFIED;
        const revision = item.currentRevision + 1;

        await tx.outsideMealItemRevision.create({
          data: {
            outsideMealLogItemId: item.id,
            revision,
            source: needsInfo || unverifiable ? item.source : OutsideMealItemSource.NUTRITIONIST_REVIEWED,
            nutritionStatus,
            ...values,
            calorieLow: needsInfo || unverifiable ? item.calorieLow : values.calories,
            calorieHigh: needsInfo || unverifiable ? item.calorieHigh : values.calories,
            reason: action.reason,
            reviewedByNutritionistId: nutritionistProfileId,
            snapshot: {
              name: item.name,
              portionGrams: item.portionGrams,
              ingredients: item.ingredients ?? null,
              source: needsInfo || unverifiable ? item.source : OutsideMealItemSource.NUTRITIONIST_REVIEWED,
              nutritionStatus,
              includedInTotals: needsInfo || unverifiable ? item.includedInTotals : true,
              ...values,
            } as Prisma.InputJsonObject,
          },
        });
        const itemChange = await tx.outsideMealLogItem.updateMany({
          where: { id: item.id, currentRevision: review.claimedRevision },
          data: {
            currentRevision: revision,
            source: needsInfo || unverifiable ? item.source : OutsideMealItemSource.NUTRITIONIST_REVIEWED,
            nutritionStatus,
            includedInTotals: needsInfo || unverifiable ? item.includedInTotals : true,
            ...values,
            calorieLow: needsInfo || unverifiable ? item.calorieLow : values.calories,
            calorieHigh: needsInfo || unverifiable ? item.calorieHigh : values.calories,
          },
        });
        if (itemChange.count !== 1) throw new AppError('The claimed revision changed.', 409, 'STALE_REVIEW_REVISION');
        await tx.outsideMealReview.update({
          where: { id: review.id },
          data: { status: reviewStatus, reviewedAt: now, reviewedRevision: review.claimedRevision,
            claimedByNutritionistId: null, claimedAt: null, claimedRevision: null },
        });
        if (needsInfo) {
          const messageCount = await tx.outsideMealReviewMessage.count({ where: { outsideMealReviewId: review.id } });
          if (messageCount >= 12) throw new AppError('This clarification thread has reached its limit.', 409, 'CLARIFICATION_LIMIT');
          await tx.outsideMealReviewMessage.create({ data: {
            outsideMealReviewId: review.id, sender: OutsideMealMessageSender.NUTRITIONIST,
            authorUserId: reviewer.userId, itemRevision: revision, content: action.reason,
          } });
        }

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
        await MealSwapService.recalculateDailyNutritionLog(item.mealLog.userId, item.mealLog.loggedAt, tx);
        await tx.notification.create({
          data: {
            userId: item.mealLog.userId,
            title: needsInfo ? 'Outside meal needs more information' :
              unverifiable ? 'Outside meal estimate could not be confirmed' : 'Outside meal nutrition updated',
            message: needsInfo
              ? `A nutritionist needs more information about “${item.name}”. ${action.reason}`
              : unverifiable
                ? `The estimate for “${item.name}” could not be confirmed. It remains marked as estimated in your tracker. ${action.reason}`
                : `A nutritionist ${correction ? 'corrected and confirmed' : 'confirmed'} the nutrition estimate for “${item.name}”. Your daily totals were updated automatically.`,
            type: needsInfo ? NotificationType.OUTSIDE_MEAL_MORE_INFO : NotificationType.OUTSIDE_MEAL_REVIEWED,
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: reviewer.userId,
            action: `OUTSIDE_MEAL_${action.action}`,
            entityType: 'OutsideMealLogItem',
            entityId: item.id,
            metadata: { revision, reviewedRevision: review.claimedRevision, reason: action.reason,
              previous: { calories: item.calories, proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG },
              effective: values },
          },
        });
        return { reviewId: review.id, itemId: item.id, nutritionStatus, revision, summary };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000, maxWait: 15_000 }
    );
  }
}
