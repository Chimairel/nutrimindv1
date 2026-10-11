import { createHash } from 'node:crypto';
import { Prisma, type OutsideMealReview } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { lockUserProfile } from './profile-revision.service';
import { MembershipService } from './membership.service';
import { NotificationService } from './notification.service';
import { ObservedMealService } from './observed-meal.service';
import { outsideReviewQueueReason } from '@/domain/outside-meal-review.policy';

const openStates = ['PENDING', 'CLAIMED', 'NEEDS_MORE_INFO'];
const finalStates = ['VERIFIED', 'CORRECTED', 'UNVERIFIABLE'];

/** One saved meal is one admission. Item decisions still bind to their individual revisions. */
export async function requestOutsideMealReview(
  userId: string,
  logId: string,
  itemId: string,
  attempt = 0
): Promise<OutsideMealReview> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        return admitOutsideMealReview(tx, userId, logId, itemId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15_000, timeout: 60_000 }
    );
  } catch (error) {
    if (attempt < 2 && isOutsideReviewWriteConflict(error))
      return requestOutsideMealReview(userId, logId, itemId, attempt + 1);
    throw error;
  }
}

/** Also used by preview confirmation so saving and admission roll back together. */
export async function admitOutsideMealReview(
  tx: Prisma.TransactionClient,
  userId: string,
  logId: string,
  itemId: string
): Promise<OutsideMealReview> {
  await lockUserProfile(tx, userId);
  const log = await tx.mealLog.findFirst({
    where: { id: logId, userId, source: 'USER_LOGGED', status: 'DONE' },
    include: { outsideItems: { orderBy: { id: 'asc' }, include: { review: true } } },
  });
  const selected = log?.outsideItems.find((item) => item.id === itemId);
  if (!log || !selected) throw new AppError('Outside-meal item not found.', 404, 'OUTSIDE_ITEM_NOT_FOUND');
  const open = log.outsideItems.some(
    (item) => item.review?.requestedByUserAt && openStates.includes(item.review.status)
  );
  const unchanged = log.outsideItems.every(
    (item) =>
      item.review?.requestedByUserAt &&
      finalStates.includes(item.review.status) &&
      item.review.reviewedRevision !== null &&
      item.review.reviewedRevision + 1 === item.currentRevision
  );
  if (unchanged) return selected.review!;
  if (
    open &&
    log.outsideItems.every(
      (item) =>
        item.review?.requestedByUserAt &&
        (openStates.includes(item.review.status) ||
          (finalStates.includes(item.review.status) &&
            item.review.reviewedRevision !== null &&
            item.review.reviewedRevision + 1 === item.currentRevision))
    )
  )
    return selected.review!;
  // An open admitted episode remains available after expiry; repeated clicks do not reset claims.
  const payload = JSON.stringify(log.outsideItems.map((item) => [item.id, item.currentRevision]));
  const key = `outside-log:${logId}:revision:${createHash('sha256').update(payload).digest('hex')}`;
  const allowance = open ? null : await MembershipService.reserve(userId, 'OUTSIDE_REVIEW', key, payload, tx);
  const now = new Date();
  let result: OutsideMealReview | undefined;
  for (const item of log.outsideItems) {
    // Preserve claims and completed current items during the same whole-meal episode.
    if (
      open &&
      item.review?.requestedByUserAt &&
      (openStates.includes(item.review.status) ||
        (finalStates.includes(item.review.status) &&
          item.review.reviewedRevision !== null &&
          item.review.reviewedRevision + 1 === item.currentRevision))
    ) {
      if (item.id === itemId) result = item.review;
      continue;
    }
    if (item.review) await ObservedMealService.invalidateSource(tx, item.id);
    const data = {
      status: 'PENDING' as const,
      requestedByUserAt: now,
      queueReason: outsideReviewQueueReason(item) ?? 'USER_REQUEST',
      priority: 60,
      claimedByNutritionistId: null,
      claimedAt: null,
      claimedRevision: null,
      reviewedAt: null,
      reviewedRevision: null,
    };
    const review = item.review
      ? await tx.outsideMealReview.update({ where: { id: item.review.id }, data })
      : await tx.outsideMealReview.create({ data: { outsideMealLogItemId: item.id, ...data } });
    if (item.id === itemId) result = review;
  }
  if (allowance && !allowance.replayed) await MembershipService.complete(allowance.id, tx, logId);
  if (!open)
    await NotificationService.notifyReviewers(
      'Outside-meal estimate review requested',
      'A member requested review of a logged meal and its food items.',
      tx
    );
  await tx.auditEvent.create({
    data: {
      actorUserId: userId,
      action: 'OUTSIDE_MEAL_REVIEW_REQUESTED',
      entityType: 'MealLog',
      entityId: logId,
      metadata: { itemCount: log.outsideItems.length, requestKey: key, membershipUsageId: allowance?.id ?? null },
    },
  });
  if (!result) throw new AppError('Outside-meal review could not be admitted.', 409, 'REVIEW_ADMISSION_FAILED');
  return result;
}

/** Retry only transaction conflicts that PostgreSQL has already rolled back. */
export function isOutsideReviewWriteConflict(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (['P2034', 'P2002'].includes(error.code) ||
      (error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code))))
  );
}
