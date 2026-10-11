import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import {
  canAcquireReviewClaim,
  isReviewClaimActive,
  isNutritionistEligibleForReview,
} from '@/domain/nutritionist-review.policy';
import { mealReviewSubmissionSchema, type MealReviewSubmission } from '@/validation/meal-review.schemas';
import { libraryBaseRevisionKey } from './meal-base-admission.service';
import {
  json,
  reviewContext,
  reviewActor,
  currentReviewProfile,
  rndUserId,
  assertVersion,
  assertIndependent,
  recordReviewDecision,
  type ReviewContext,
  type ReviewTx,
} from './meal-review-context.service';

function active(context: ReviewContext) {
  if (
    !context.incident ||
    context.incident.closedAt ||
    !['PENDING_REREVIEW', 'QUARANTINED'].includes(context.incident.state)
  )
    throw new AppError('There is no active review case.', 409, 'REVIEW_CASE_CLOSED');
  return context.incident;
}

async function validateEvidence(tx: ReviewTx, context: ReviewContext) {
  for (const meal of context.meals) {
    if (
      !meal.recipeSignature ||
      !meal.nutritionServingDescription ||
      !Number.isFinite(meal.calories) ||
      meal.calories <= 0 ||
      [meal.proteinG, meal.carbsG, meal.fatG].some((value) => !Number.isFinite(value) || value < 0) ||
      !meal.ingredients.length ||
      meal.ingredients.some(
        (item) =>
          !item.foodItem ||
          !['FNRI', 'USDA_FDC'].includes(item.foodItem.source) ||
          item.unit !== 'g' ||
          !item.quantity ||
          item.quantity <= 0
      )
    )
      throw new AppError(
        'Every serving needs valid nutrition, mapped composition foods and measured edible grams before re-review.',
        422,
        'REVIEW_EVIDENCE_REQUIRED'
      );
    const preparation = await tx.auditEvent.findFirst({
      where: { entityType: 'MealLibrary', entityId: meal.id, action: 'NUTRITION_EVIDENCE_PREPARED' },
      orderBy: { createdAt: 'desc' },
    });
    const prepared = preparation?.metadata as {
      revision?: number;
      ingredients?: { foodItemId?: string; compositionRevision?: number; gramsPerServing?: number }[];
    } | null;
    if (
      meal.nutritionEvidenceSource === 'NUTRITIONIST_EDITED' &&
      (!prepared ||
        prepared.revision !== meal.safetyEvidenceRevision ||
        meal.ingredients.some(
          (item) =>
            !prepared.ingredients?.some(
              (saved) =>
                saved.foodItemId === item.foodItemId &&
                saved.gramsPerServing === item.quantity &&
                saved.compositionRevision === item.foodItem?.compositionRevision
            )
        ))
    )
      throw new AppError(
        'Prepared ingredient evidence is missing or stale. Submit a measured correction.',
        422,
        'REVIEW_EVIDENCE_STALE'
      );
  }
}

async function publish(tx: ReviewTx, context: ReviewContext, reviewerId: string | null) {
  const incident = active(context);
  // An administrative release removes the hold; it never fabricates an RND verification.
  for (const meal of reviewerId ? context.meals : []) {
    const revisionKey = libraryBaseRevisionKey(meal.recipeSignature!, meal.description);
    await tx.mealBaseVerification.upsert({
      where: { targetKind_targetId_revisionKey: { targetKind: 'LIBRARY_MEAL', targetId: meal.id, revisionKey } },
      create: {
        targetKind: 'LIBRARY_MEAL',
        targetId: meal.id,
        revisionKey,
        status: 'VERIFIED',
        reviewedByNutritionistId: reviewerId,
        reviewedAt: new Date(),
        rationale: `Independent case review ${incident.id}`,
      },
      update: {
        status: 'VERIFIED',
        reviewedByNutritionistId: reviewerId,
        reviewedAt: new Date(),
        rationale: `Independent case review ${incident.id}`,
      },
    });
  }
  await tx.mealReviewLineage.update({ where: { id: context.lineage!.id }, data: { state: 'PUBLISHED' } });
  await tx.mealLibrary.updateMany({
    where: { reviewLineageId: context.lineage!.id, status: 'FLAGGED' },
    data: {
      status: 'APPROVED',
      ...(reviewerId ? { verifiedByNutritionistId: reviewerId, riceRoleReviewStatus: 'REVIEWED' as const } : {}),
    },
  });
  await tx.mealLibraryFlag.updateMany({
    where: { mealLibraryId: { in: context.meals.map((meal) => meal.id) }, status: 'PENDING' },
    data: { status: 'RESOLVED_KEPT', resolvedAt: new Date() },
  });
  await tx.mealReviewIncident.update({
    where: { id: incident.id },
    data: { state: 'RELEASED', closedAt: new Date(), claimedByNutritionistId: null, claimedAt: null },
  });
  await tx.mealReviewLineage.update({ where: { id: context.lineage!.id }, data: { state: 'PUBLISHED' } });
  // Old plan holds and profile/condition flags remain until their own fresh checks.
}

export class MealReviewService {
  static async detail(mealId: string) {
    return prisma.$transaction(
      async (tx) => {
        const context = await reviewContext(tx, mealId);
        const history = context.lineage
          ? await tx.mealReviewIncident.findMany({
              where: { lineageId: context.lineage.id },
              orderBy: { number: 'asc' },
              include: {
                reports: { orderBy: { createdAt: 'asc' } },
                decisions: { orderBy: { createdAt: 'asc' } },
                confirmations: true,
              },
            })
          : [];
        const validConfirmations = [];
        for (const confirmation of context.incident?.confirmations ?? []) {
          const rnd = await currentReviewProfile(tx, confirmation.nutritionistId);
          if (confirmation.version === context.reviewVersion && rnd && isNutritionistEligibleForReview(rnd)) {
            try {
              assertIndependent(context, rnd.id, rnd.userId);
              validConfirmations.push(confirmation);
            } catch {
              /* Involved reviewers never count toward release. */
            }
          }
        }
        return {
          mealId,
          recipeVersion: context.recipeVersion,
          reviewVersion: context.reviewVersion,
          state:
            context.lineage?.state ??
            (context.meals.some((meal) => meal.status === 'FLAGGED') ? 'PENDING_REREVIEW' : 'PUBLISHED'),
          incidentCount: context.lineage?.incidentCount ?? 0,
          legacyHistoryUnknown:
            context.lineage?.legacyHistoryUnknown ?? context.meals.some((meal) => meal.status === 'FLAGGED'),
          incident: context.incident,
          currentSnapshot: context.snapshot,
          history,
          validConfirmations,
          canAdminRelease: context.incident?.state === 'QUARANTINED' && !context.incident.closedAt,
        };
      },
      { timeout: 30_000 }
    );
  }

  static async queue() {
    const rows = await prisma.mealReviewLineage.findMany({
      where: { state: { in: ['PENDING_REREVIEW', 'QUARANTINED'] } },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: { meals: { where: { status: 'FLAGGED' }, select: { id: true, mealName: true }, take: 1 } },
    });
    return rows.flatMap((row) =>
      row.meals[0] ? [{ ...row.meals[0], state: row.state, incidentCount: row.incidentCount }] : []
    );
  }

  static async claim(profileId: string, mealId: string, version: string) {
    const userId = await rndUserId(profileId);
    return prisma.$transaction(async (tx) => {
      await reviewActor(tx, userId, profileId);
      const context = await reviewContext(tx, mealId, true);
      const incident = active(context);
      if (incident.state === 'QUARANTINED')
        throw new AppError('Quarantine requires an administrative decision.', 409, 'QUARANTINE_ADMIN_REQUIRED');
      assertVersion(context.reviewVersion, version);
      assertIndependent(context, profileId, userId);
      if (!canAcquireReviewClaim(incident, profileId))
        throw new AppError('This case is claimed or in claim cooldown.', 409, 'REVIEW_CLAIM_CONFLICT');
      await tx.mealReviewIncident.update({
        where: { id: incident.id },
        data: { claimedByNutritionistId: profileId, claimedAt: new Date() },
      });
      return { claimed: true, expiresAt: new Date(Date.now() + 30 * 60_000) };
    });
  }

  static async confirm(profileId: string, mealId: string, input: MealReviewSubmission) {
    const submission = mealReviewSubmissionSchema.parse(input);
    const userId = await rndUserId(profileId);
    return prisma.$transaction(
      async (tx) => {
        const actor = await reviewActor(tx, userId, profileId);
        const context = await reviewContext(tx, mealId, true);
        const incident = active(context);
        if (incident.state === 'QUARANTINED')
          throw new AppError('Quarantine requires an administrative decision.', 409, 'QUARANTINE_ADMIN_REQUIRED');
        assertVersion(context.reviewVersion, submission.expectedVersion);
        assertIndependent(context, profileId, userId);
        if (incident.claimedByNutritionistId !== profileId || !isReviewClaimActive(incident))
          throw new AppError('Claim this case before confirming the current version.', 409, 'REVIEW_CLAIM_REQUIRED');
        const resolutions = new Map(submission.resolutions.map((item) => [item.reportId, item.rationale]));
        if (
          resolutions.size !== submission.resolutions.length ||
          resolutions.size !== incident.reports.length ||
          incident.reports.some((report) => !resolutions.has(report.id))
        )
          throw new AppError('Explain the resolution of every recorded concern.', 422, 'REVIEW_CONCERNS_UNRESOLVED');
        await validateEvidence(tx, context);
        if (
          incident.confirmations.some(
            (confirmation) =>
              confirmation.nutritionistId === profileId && confirmation.version === context.reviewVersion
          )
        )
          throw new AppError('You already confirmed this exact version.', 409, 'REVIEW_ALREADY_CONFIRMED');
        await tx.mealReviewConfirmation.create({
          data: {
            incidentId: incident.id,
            nutritionistId: profileId,
            version: context.reviewVersion,
            resolutions: json(submission.resolutions),
            actorSnapshot: actor.snapshot,
          },
        });
        await recordReviewDecision(tx, context, actor, 'CONFIRMED', submission.rationale, submission.resolutions);
        await publish(tx, context, profileId);
        await recordReviewDecision(tx, context, actor, 'REVERIFIED', submission.rationale);
        return { state: 'PUBLISHED', incidentNumber: incident.number };
      },
      { maxWait: 10_000, timeout: 30_000 }
    );
  }

  static async adminAction(
    userId: string,
    mealId: string,
    action: 'release' | 'archive',
    expectedVersion: string,
    rationale: string
  ) {
    if (rationale.trim().length < 20)
      throw new AppError('Explain the administrative decision.', 422, 'RATIONALE_REQUIRED');
    return prisma.$transaction(
      async (tx) => {
        const actor = await reviewActor(tx, userId);
        const context = await reviewContext(tx, mealId, true);
        const incident = active(context);
        assertVersion(context.reviewVersion, expectedVersion);
        if (action === 'release') {
          if (incident.state !== 'QUARANTINED')
            throw new AppError('Pending re-review requires an independent RND decision.', 409, 'RND_REVIEW_REQUIRED');
          await validateEvidence(tx, context);
          await publish(tx, context, null);
        } else {
          const sourceIds = context.meals.flatMap((meal) =>
            meal.sourceRawRecipeCandidateId ? [meal.sourceRawRecipeCandidateId] : []
          );
          if (sourceIds.length)
            await tx.rawRecipeCandidate.updateMany({ where: { id: { in: sourceIds } }, data: { status: 'RETIRED' } });
          await tx.mealLibrary.updateMany({
            where: { reviewLineageId: context.lineage!.id },
            data: { status: 'ARCHIVED' },
          });
          await tx.mealReviewIncident.update({
            where: { id: incident.id },
            data: { state: 'ARCHIVED', closedAt: new Date() },
          });
          await tx.mealReviewLineage.update({ where: { id: context.lineage!.id }, data: { state: 'ARCHIVED' } });
          await tx.mealLibraryFlag.updateMany({
            where: { mealLibraryId: { in: context.meals.map((meal) => meal.id) }, status: 'PENDING' },
            data: { status: 'RESOLVED_REMOVED', resolvedAt: new Date() },
          });
        }
        await recordReviewDecision(
          tx,
          context,
          actor,
          action === 'release' ? 'ADMIN_RELEASED' : 'ADMIN_ARCHIVED',
          rationale
        );
        return { state: action === 'release' ? 'PUBLISHED' : 'ARCHIVED' };
      },
      { maxWait: 10_000, timeout: 30_000 }
    );
  }
}
