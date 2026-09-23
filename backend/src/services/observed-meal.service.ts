import { DietaryPreference, MealType, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { classifyMealIngredients } from '@/domain/meal-ingredient-classification.policy';
import { assertShareableText, normalizeObservedName, observedContentSignature,
  type ObservedIngredient } from '@/domain/observed-meal.policy';

type Admission = {
  kind: 'FOOD_REFERENCE' | 'RECIPE_CANDIDATE';
  canonicalName: string;
  ingredients?: ObservedIngredient[];
  preparation?: string;
  mealTypes?: MealType[];
};

function confirmedAtCurrentRevision(item: {
  currentRevision: number;
  nutritionStatus: string;
  review: { status: string; reviewedRevision: number | null } | null;
}) {
  return ['VERIFIED', 'CORRECTED'].includes(item.nutritionStatus) &&
    ['VERIFIED', 'CORRECTED'].includes(item.review?.status ?? '') &&
    item.review?.reviewedRevision === item.currentRevision - 1;
}

export class ObservedMealService {
  static async invalidateSource(tx: Prisma.TransactionClient, itemId: string) {
    const submissions = await tx.observedMealSubmission.findMany({ where: {
      sourceOutsideMealItemId: itemId, status: { not: 'WITHDRAWN' },
    }, select: { id: true, rawRecipeCandidateId: true } });
    if (!submissions.length) return;
    await tx.observedMealSubmission.updateMany({ where: { id: { in: submissions.map((row) => row.id) } },
      data: { status: 'WITHDRAWN', withdrawnAt: new Date() } });
    for (const candidateId of new Set(submissions.flatMap((row) => row.rawRecipeCandidateId ? [row.rawRecipeCandidateId] : []))) {
      const remaining = await tx.observedMealSubmission.count({ where: {
        rawRecipeCandidateId: candidateId, status: 'ADMITTED_RECIPE',
      } });
      if (!remaining) await tx.rawRecipeCandidate.updateMany({ where: {
        id: candidateId, sourceName: 'USER_OBSERVED' }, data: { status: 'RETIRED' } });
    }
  }

  static async consent(userId: string, logId: string, itemId: string, consent: {
    detailsConsent: boolean; imageReuseConsent: boolean; imageRightsConfirmed: boolean;
  }) {
    if (!consent.detailsConsent || consent.imageReuseConsent && !consent.imageRightsConfirmed)
      throw new AppError('Explicit food-detail and image-rights consent is required.', 422, 'REUSE_CONSENT_REQUIRED');
    const imageReuse = consent.imageReuseConsent;
    return prisma.$transaction(async (tx) => {
      const item = await tx.outsideMealLogItem.findFirst({
        where: { id: itemId, mealLogId: logId,
          mealLog: { userId, source: 'USER_LOGGED', status: 'DONE' } },
        include: { review: true, mealLog: { select: { outsideImageMime: true } } },
      });
      if (!item) throw new AppError('Outside-meal item not found.', 404, 'OUTSIDE_ITEM_NOT_FOUND');
      if (!confirmedAtCurrentRevision(item))
        throw new AppError('Only a current confirmed estimate can be submitted.', 409, 'CONFIRMED_REVISION_REQUIRED');
      if (!item.portionGrams || item.calories === null ||
          item.proteinG === null || item.carbsG === null || item.fatG === null)
        throw new AppError('A defined serving and complete macros are required.', 422, 'DEFINED_SERVING_REQUIRED');
      if (imageReuse && !item.mealLog.outsideImageMime)
        throw new AppError('No image is attached to this meal.', 422, 'IMAGE_NOT_FOUND');
      const now = new Date();
      const existing = await tx.observedMealSubmission.findUnique({ where: {
        sourceOutsideMealItemId_sourceRevision: {
          sourceOutsideMealItemId: item.id, sourceRevision: item.currentRevision },
      } });
      const submission = existing ? await tx.observedMealSubmission.update({ where: { id: existing.id }, data: {
        imageReuseConsentedAt: imageReuse ? now : null,
        ...(existing.status === 'WITHDRAWN' ? { status: 'SUBMITTED' as const, withdrawnAt: null,
          foodReferenceId: null, rawRecipeCandidateId: null,
          classifiedAt: null, classifiedByNutritionistId: null } : {}),
      } }) : await tx.observedMealSubmission.create({ data: {
        sourceUserId: userId, sourceOutsideMealItemId: item.id, sourceRevision: item.currentRevision,
        detailsConsentedAt: now, imageReuseConsentedAt: imageReuse ? now : null,
      } });
      await tx.auditEvent.create({ data: { actorUserId: userId, action: 'OBSERVED_MEAL_REUSE_CONSENT',
        entityType: 'ObservedMealSubmission', entityId: submission.id,
        metadata: { revision: item.currentRevision, imageReuse } } });
      return { id: submission.id, status: submission.status, sourceRevision: submission.sourceRevision,
        detailsConsentedAt: submission.detailsConsentedAt,
        imageReuseConsentedAt: submission.imageReuseConsentedAt };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000, maxWait: 15_000 });
  }

  static async withdraw(userId: string, submissionId: string) {
    return prisma.$transaction(async (tx) => {
      const row = await tx.observedMealSubmission.findFirst({
        where: { id: submissionId, sourceUserId: userId },
      });
      if (!row) throw new AppError('Submission not found.', 404, 'SUBMISSION_NOT_FOUND');
      if (row.status === 'WITHDRAWN') return { id: row.id, status: row.status };
      await tx.observedMealSubmission.update({ where: { id: row.id },
        data: { status: 'WITHDRAWN', withdrawnAt: new Date() } });
      if (row.rawRecipeCandidateId) {
        const remaining = await tx.observedMealSubmission.count({ where: {
          rawRecipeCandidateId: row.rawRecipeCandidateId, status: 'ADMITTED_RECIPE',
        } });
        if (!remaining) await tx.rawRecipeCandidate.updateMany({ where: {
          id: row.rawRecipeCandidateId, sourceName: 'USER_OBSERVED' }, data: { status: 'RETIRED' } });
      }
      await tx.auditEvent.create({ data: { actorUserId: userId, action: 'OBSERVED_MEAL_REUSE_WITHDRAWN',
        entityType: 'ObservedMealSubmission', entityId: row.id } });
      return { id: row.id, status: 'WITHDRAWN' as const };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000, maxWait: 15_000 });
  }

  static async pending() {
    const rows = await prisma.observedMealSubmission.findMany({ where: {
      status: 'SUBMITTED', sourceOutsideMealItemId: { not: null }, sourceUserId: { not: null },
    }, select: { id: true, sourceRevision: true, imageReuseConsentedAt: true, createdAt: true,
      sourceOutsideMealItem: { select: { name: true, portionGrams: true, calories: true, proteinG: true,
        carbsG: true, fatG: true, currentRevision: true, nutritionStatus: true, ingredients: true,
        review: { select: { status: true, reviewedRevision: true } },
        mealLog: { select: { mealType: true, estimationContext: true, status: true } } } },
    }, orderBy: { createdAt: 'asc' }, take: 100 });
    return rows.filter((row) => row.sourceOutsideMealItem?.mealLog.status === 'DONE' &&
      row.sourceOutsideMealItem.currentRevision === row.sourceRevision &&
      confirmedAtCurrentRevision(row.sourceOutsideMealItem)).slice(0, 50);
  }

  static async admit(nutritionistProfileId: string, submissionId: string, input: Admission) {
    const name = input.canonicalName.trim();
    if (!name || !assertShareableText(name) || !assertShareableText(input.preparation ?? ''))
      throw new AppError('Remove identifying details from shared content.', 422, 'PRIVATE_CONTENT_DETECTED');
    return prisma.$transaction(async (tx) => {
      const submission = await tx.observedMealSubmission.findFirst({ where: {
        id: submissionId, status: 'SUBMITTED', sourceOutsideMealItemId: { not: null }, sourceUserId: { not: null },
      }, include: { sourceOutsideMealItem: { include: { review: true, mealLog: { select: { status: true } } } } } });
      const item = submission?.sourceOutsideMealItem;
      if (!submission || !item || item.mealLog.status !== 'DONE' ||
          item.currentRevision !== submission.sourceRevision || !confirmedAtCurrentRevision(item))
        throw new AppError('The consented confirmation is no longer current.', 409, 'STALE_OBSERVATION');
      if (!item.portionGrams || item.calories === null || item.proteinG === null ||
          item.carbsG === null || item.fatG === null)
        throw new AppError('A defined serving and complete macros are required.', 422, 'DEFINED_SERVING_REQUIRED');
      const macros = { calories: item.calories, proteinG: item.proteinG, carbsG: item.carbsG, fatG: item.fatG };
      const reviewer = await tx.nutritionistProfile.findUniqueOrThrow({
        where: { id: nutritionistProfileId }, select: { userId: true } });
      let target: { kind: 'FOOD_REFERENCE' | 'RECIPE_CANDIDATE'; id: string; duplicate: boolean };
      if (input.kind === 'FOOD_REFERENCE') {
        const signature = observedContentSignature({ kind: input.kind, name, servingGrams: item.portionGrams,
          macros });
        const existing = await tx.observedFoodReference.findUnique({ where: { signature } });
        const reference = existing ?? await tx.observedFoodReference.create({ data: {
          signature, name, normalizedName: normalizeObservedName(name), servingGrams: item.portionGrams,
          ...macros,
        } });
        target = { kind: input.kind, id: reference.id, duplicate: !!existing };
        await tx.observedMealSubmission.update({ where: { id: submission.id }, data: {
          status: 'ADMITTED_REFERENCE', foodReferenceId: reference.id,
          classifiedByNutritionistId: nutritionistProfileId, classifiedAt: new Date(),
        } });
      } else {
        const ingredients = input.ingredients ?? [];
        const mealTypes = [...new Set(input.mealTypes ?? [])];
        if (!input.preparation?.trim() || input.preparation.trim().length < 20 ||
            ingredients.length < 2 || !mealTypes.length ||
            mealTypes.some((type) => !([MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER] as MealType[]).includes(type)) ||
            ingredients.some((row) => !row.name.trim() || !assertShareableText(row.name) ||
              !row.unit.trim() || !Number.isFinite(row.quantity) || row.quantity <= 0))
          throw new AppError('A reproducible recipe needs preparation, quantified ingredients, and meal types.',
            422, 'RECIPE_EVIDENCE_INCOMPLETE');
        const classification = classifyMealIngredients(ingredients);
        if (classification.status !== 'COMPLETE')
          throw new AppError('Resolve or clarify unknown ingredients before admission.', 422, 'INGREDIENTS_UNRESOLVED');
        const signature = observedContentSignature({ kind: input.kind, name, servingGrams: item.portionGrams,
          macros, ingredients, preparation: input.preparation });
        const existing = await tx.rawRecipeCandidate.findUnique({ where: { contentSignature: signature } });
        const candidate = existing ?? await tx.rawRecipeCandidate.create({ data: {
          sourceRecordId: `observed:${signature}`, sourceName: 'USER_OBSERVED',
          sourceUrl: `urn:nutrimind:observed:${signature}`, recipeName: name,
          normalizedName: normalizeObservedName(name), contentSignature: signature,
          cuisines: [], description: input.preparation.trim(), mealType: mealTypes[0],
          dietaryTags: classification.compatibleDietaryPreferences.length
            ? classification.compatibleDietaryPreferences : [DietaryPreference.OMNIVORE],
          ingredients: ingredients as unknown as Prisma.InputJsonValue,
          publishedNutrition: Prisma.JsonNull, ...macros, originalServings: 1,
          applicableMealTypes: { create: mealTypes.map((mealType) => ({ mealType,
            source: 'NUTRITIONIST_REVIEW' as const, reviewStatus: 'REVIEWED' as const })) },
        } });
        if (existing && existing.sourceName !== 'USER_OBSERVED')
          throw new AppError('An existing source owns this signature.', 409, 'SOURCE_SIGNATURE_CONFLICT');
        if (existing?.status === 'RETIRED') await tx.rawRecipeCandidate.update({
          where: { id: candidate.id }, data: { status: 'AVAILABLE' } });
        target = { kind: input.kind, id: candidate.id, duplicate: !!existing };
        await tx.observedMealSubmission.update({ where: { id: submission.id }, data: {
          status: 'ADMITTED_RECIPE', rawRecipeCandidateId: candidate.id,
          classifiedByNutritionistId: nutritionistProfileId, classifiedAt: new Date(),
        } });
      }
      await tx.auditEvent.create({ data: { actorUserId: reviewer.userId,
        action: 'OBSERVED_MEAL_ADMITTED', entityType: 'ObservedMealSubmission', entityId: submission.id,
        metadata: { kind: target.kind, targetId: target.id, sourceRevision: submission.sourceRevision,
          duplicate: target.duplicate, sourceKind: 'USER_OBSERVED' } } });
      return { submissionId: submission.id, ...target };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60_000, maxWait: 15_000 });
  }
}
