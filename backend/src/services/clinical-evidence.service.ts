import path from 'node:path';
import {
  ClinicalDocumentReviewDecision,
  ClinicalDocumentType,
  ClinicalDocumentStatus,
  ClinicalEvidenceArea,
  ClinicalFactCode,
  ClinicalFactProvenance,
  ClinicalFactReviewStatus,
  HealthConditionType,
  NotificationType,
  Prisma,
} from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import {
  CLINICAL_EVIDENCE_REQUIREMENT_POLICY_VERSION,
  clinicalEvidenceBlocksMealPlanning,
  evaluateClinicalEvidenceRequirements,
  evidenceAreaForCondition,
  type DiabetesContext,
} from '@/domain/clinical-evidence-requirement.policy';
import {
  decryptClinicalDocument,
  detectClinicalDocumentMime,
  encryptClinicalDocument,
} from '@/lib/clinical-document-crypto';

const CLAIM_TTL_MS = 30 * 60 * 1000;
export const CLINICAL_DOCUMENT_CONSENT_VERSION = 'CLINICAL_DOCUMENT_UPLOAD_V1';

export type ClinicalFactInput = {
  code: ClinicalFactCode;
  valueText?: string | null;
  valueNumber?: number | null;
  unit?: string | null;
  observedAt?: Date | null;
  pageNumber?: number | null;
};

function publicDocument<T extends {
  id: string;
  area: ClinicalEvidenceArea;
  documentType: string;
  status: ClinicalDocumentStatus;
  revision: number;
  originalFileName: string;
  mimeType: string;
  byteSize: number;
  issuedAt: Date | null;
  issuerName: string | null;
  validUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>(document: T) {
  return {
    id: document.id,
    area: document.area,
    documentType: document.documentType,
    status: document.status,
    revision: document.revision,
    originalFileName: document.originalFileName,
    mimeType: document.mimeType,
    byteSize: document.byteSize,
    issuedAt: document.issuedAt,
    issuerName: document.issuerName,
    validUntil: document.validUntil,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

async function declaredAreas(userId: string): Promise<Set<ClinicalEvidenceArea>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { healthConditions: true, allergies: true, userProfile: true },
  });
  if (!user) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  const areas = new Set<ClinicalEvidenceArea>();
  for (const item of user.healthConditions) {
    const area = evidenceAreaForCondition(item.condition);
    if (area) areas.add(area);
  }
  if (user.allergies.some((item) => item.allergen !== 'NONE') || user.userProfile?.otherAllergies?.trim())
    areas.add(ClinicalEvidenceArea.FOOD_ALLERGY);
  if (user.userProfile?.otherConditions?.trim()) areas.add(ClinicalEvidenceArea.OTHER);
  return areas;
}

async function invalidateDocumentDependencies(tx: Prisma.TransactionClient, documentId: string, reason: string) {
  const [planLinks, clearanceLinks] = await Promise.all([
    tx.mealPlanClinicalEvidence.findMany({ where: { clinicalDocumentId: documentId }, select: { mealPlanId: true } }),
    tx.clearanceClinicalEvidence.findMany({
      where: { clinicalDocumentId: documentId },
      select: { clearanceId: true },
    }),
  ]);
  const mealPlanIds = planLinks.map((item) => item.mealPlanId);
  const clearanceIds = clearanceLinks.map((item) => item.clearanceId);
  if (mealPlanIds.length) {
    await tx.mealPlan.updateMany({ where: { id: { in: mealPlanIds } }, data: { requiresSafetyRevalidation: true } });
    const users = await tx.mealPlan.findMany({
      where: { id: { in: mealPlanIds } },
      distinct: ['userId'],
      select: { userId: true },
    });
    if (users.length) await tx.groceryList.updateMany({ where: { userId: { in: users.map((item) => item.userId) } }, data: { isStale: true } });
  }
  if (clearanceIds.length) {
    await tx.mealConditionClearance.updateMany({
      where: { id: { in: clearanceIds }, state: { in: ['ACTIVE', 'REVIEW_DUE'] } },
      data: { state: 'SUSPENDED', suspendedAt: new Date(), suspensionReason: reason.slice(0, 240) },
    });
  }
}

async function invalidateActivePlansForUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.mealPlan.updateMany({
    where: { userId, status: 'APPROVED' },
    data: { requiresSafetyRevalidation: true },
  });
  await tx.groceryList.updateMany({ where: { userId }, data: { isStale: true } });
}

export class ClinicalEvidenceService {
  static async requirementsForUser(userId: string, now = new Date()) {
    const [conditions, documents, context] = await Promise.all([
      prisma.healthCondition.findMany({ where: { userId }, select: { condition: true } }),
      prisma.clinicalDocument.findMany({
        where: { userId },
        select: { id: true, area: true, status: true, validUntil: true, revision: true, sha256: true, createdAt: true },
      }),
      prisma.clinicalContextResponse.findUnique({
        where: { userId_area: { userId, area: ClinicalEvidenceArea.DIABETES } },
        select: { responses: true },
      }),
    ]);
    return evaluateClinicalEvidenceRequirements({
      conditions: conditions.map((item) => item.condition),
      documents,
      diabetesContext: (context?.responses as DiabetesContext | undefined) ?? null,
      now,
    });
  }

  static async assertReadyForMealPlanning(userId: string) {
    const requirements = await this.requirementsForUser(userId);
    if (clinicalEvidenceBlocksMealPlanning(requirements)) {
      // This also catches time-based expiry on the next meal/grocery request.
      await prisma.$transaction([
        prisma.mealPlan.updateMany({ where: { userId, status: 'APPROVED', requiresSafetyRevalidation: false }, data: { requiresSafetyRevalidation: true } }),
        prisma.groceryList.updateMany({ where: { userId, isStale: false }, data: { isStale: true } }),
      ]);
      const blockers = requirements.filter((requirement) => requirement.state !== 'READY');
      throw new AppError(
        blockers.map((item) => item.message).join(' '),
        422,
        'CLINICAL_EVIDENCE_REQUIRED',
        { requirements: blockers }
      );
    }
    return requirements;
  }

  static async getReadyDocumentsForCondition(userId: string, condition: HealthConditionType) {
    const area = evidenceAreaForCondition(condition);
    if (!area) return [];
    const now = new Date();
    const requirements = await this.requirementsForUser(userId);
    const readyIds = requirements.find((item) => item.condition === condition)?.readyDocumentIds ?? [];
    return prisma.clinicalDocument.findMany({
      where: {
        userId, area, id: { in: readyIds }, status: ClinicalDocumentStatus.SUFFICIENT_FOR_NUTRITION_REVIEW,
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      select: { id: true, revision: true, sha256: true, area: true, documentType: true, validUntil: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async workspace(userId: string) {
    const [documents, contexts, requirements] = await Promise.all([
      prisma.clinicalDocument.findMany({
        where: { userId },
        include: { facts: { orderBy: { createdAt: 'asc' } }, reviews: { orderBy: { createdAt: 'desc' }, take: 1 } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.clinicalContextResponse.findMany({ where: { userId } }),
      this.requirementsForUser(userId),
    ]);
    return {
      policyVersion: CLINICAL_EVIDENCE_REQUIREMENT_POLICY_VERSION,
      consentVersion: CLINICAL_DOCUMENT_CONSENT_VERSION,
      requirements,
      contexts: contexts.map((item) => ({ area: item.area, responses: item.responses, revision: item.revision, updatedAt: item.updatedAt })),
      availableAreas: [...await declaredAreas(userId)],
      documents: documents.map((document) => ({
        ...publicDocument(document),
        facts: document.facts.map(({ id, code, valueText, valueNumber, unit, observedAt, pageNumber, provenance, reviewStatus }) => ({
          id,
          code,
          valueText,
          valueNumber,
          unit,
          observedAt,
          pageNumber,
          provenance,
          reviewStatus,
        })),
        latestReview: document.reviews[0]
          ? { decision: document.reviews[0].decision, rationale: document.reviews[0].rationale, createdAt: document.reviews[0].createdAt }
          : null,
      })),
    };
  }

  static async saveDiabetesContext(userId: string, context: DiabetesContext) {
    const areas = await declaredAreas(userId);
    if (!areas.has(ClinicalEvidenceArea.DIABETES))
      throw new AppError('Diabetes is not declared in this profile.', 422, 'CLINICAL_AREA_NOT_DECLARED');
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.clinicalContextResponse.upsert({
        where: { userId_area: { userId, area: ClinicalEvidenceArea.DIABETES } },
        create: { userId, area: ClinicalEvidenceArea.DIABETES, responses: context },
        update: { responses: context, revision: { increment: 1 } },
      });
      await invalidateActivePlansForUser(tx, userId);
      return result;
    }, { timeout: 20_000 });
    const requirements = await this.requirementsForUser(userId);
    return { area: updated.area, responses: updated.responses, revision: updated.revision, requirements };
  }

  static async upload(input: {
    userId: string;
    area: ClinicalEvidenceArea;
    documentType: ClinicalDocumentType;
    file: { buffer: Buffer; mimetype: string; originalname: string };
    issuedAt?: Date | null;
    issuerName?: string | null;
    supersedesDocumentId?: string | null;
    facts?: ClinicalFactInput[];
    consentAccepted: boolean;
  }) {
    if (!input.consentAccepted)
      throw new AppError('Explicit clinical-document consent is required.', 422, 'CLINICAL_DOCUMENT_CONSENT_REQUIRED');
    const areas = await declaredAreas(input.userId);
    if (!areas.has(input.area))
      throw new AppError('This clinical area is not declared in the current profile.', 422, 'CLINICAL_AREA_NOT_DECLARED');
    const detectedMime = detectClinicalDocumentMime(input.file.buffer);
    if (!detectedMime || detectedMime !== input.file.mimetype)
      throw new AppError('The file content must be a valid PDF, JPEG, or PNG.', 400, 'INVALID_CLINICAL_DOCUMENT');
    if (input.file.buffer.length > 8 * 1024 * 1024)
      throw new AppError('Clinical documents must be 8 MB or smaller.', 400, 'CLINICAL_DOCUMENT_TOO_LARGE');
    const encrypted = encryptClinicalDocument(input.file.buffer);
    const originalFileName = path.basename(input.file.originalname).replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').slice(0, 180) || 'document';

    return prisma.$transaction(async (tx) => {
      let superseded: { id: string; revision: number } | null = null;
      if (input.supersedesDocumentId) {
        superseded = await tx.clinicalDocument.findFirst({
          where: { id: input.supersedesDocumentId, userId: input.userId, area: input.area, status: { notIn: ['WITHDRAWN', 'SUPERSEDED'] } },
          select: { id: true, revision: true },
        });
        if (!superseded) throw new AppError('The document being replaced was not found.', 404, 'CLINICAL_DOCUMENT_NOT_FOUND');
        await invalidateDocumentDependencies(tx, superseded.id, 'CLINICAL_DOCUMENT_SUPERSEDED');
        await tx.clinicalDocument.update({
          where: { id: superseded.id },
          data: { status: ClinicalDocumentStatus.SUPERSEDED, claimedByNutritionistId: null, claimedAt: null },
        });
      }
      await invalidateActivePlansForUser(tx, input.userId);
      const document = await tx.clinicalDocument.create({
        data: {
          userId: input.userId,
          area: input.area,
          documentType: input.documentType,
          revision: (superseded?.revision ?? 0) + 1,
          originalFileName,
          mimeType: detectedMime,
          byteSize: input.file.buffer.length,
          sha256: encrypted.sha256,
          encryptedPayload: encrypted.encryptedPayload,
          encryptionIv: encrypted.encryptionIv,
          encryptionAuthTag: encrypted.encryptionAuthTag,
          issuedAt: input.issuedAt ?? null,
          issuerName: input.issuerName?.trim() || null,
          consentVersion: CLINICAL_DOCUMENT_CONSENT_VERSION,
          supersedesDocumentId: superseded?.id ?? null,
          facts: input.facts?.length
            ? {
                create: input.facts.map((fact) => ({
                  userId: input.userId,
                  area: input.area,
                  code: fact.code,
                  valueText: fact.valueText?.trim() || null,
                  valueNumber: fact.valueNumber ?? null,
                  unit: fact.unit?.trim() || null,
                  observedAt: fact.observedAt ?? null,
                  pageNumber: fact.pageNumber ?? null,
                  provenance: ClinicalFactProvenance.DOCUMENT_TRANSCRIBED,
                })),
              }
            : undefined,
        },
        include: { facts: true },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: input.userId,
          action: 'CLINICAL_DOCUMENT_UPLOADED',
          entityType: 'ClinicalDocument',
          entityId: document.id,
          metadata: { area: input.area, documentType: input.documentType, revision: document.revision, byteSize: document.byteSize },
        },
      });
      return { ...publicDocument(document), facts: document.facts };
    }, { timeout: 20_000 });
  }

  static async withdraw(userId: string, documentId: string) {
    return prisma.$transaction(async (tx) => {
      const document = await tx.clinicalDocument.findFirst({
        where: { id: documentId, userId, status: { notIn: ['WITHDRAWN', 'SUPERSEDED'] } },
      });
      if (!document) throw new AppError('Clinical document not found.', 404, 'CLINICAL_DOCUMENT_NOT_FOUND');
      await invalidateDocumentDependencies(tx, document.id, 'CLINICAL_DOCUMENT_WITHDRAWN');
      await invalidateActivePlansForUser(tx, userId);
      const updated = await tx.clinicalDocument.update({
        where: { id: document.id },
        data: { status: ClinicalDocumentStatus.WITHDRAWN, withdrawnAt: new Date(), claimedByNutritionistId: null, claimedAt: null },
      });
      await tx.auditEvent.create({
        data: { actorUserId: userId, action: 'CLINICAL_DOCUMENT_WITHDRAWN', entityType: 'ClinicalDocument', entityId: document.id, metadata: { area: document.area } },
      });
      return publicDocument(updated);
    }, { timeout: 20_000 });
  }

  static async queue() {
    const cutoff = new Date(Date.now() - CLAIM_TTL_MS);
    const documents = await prisma.clinicalDocument.findMany({
      where: { status: { in: ['UPLOADED', 'NEEDS_CLARIFICATION'] } },
      include: {
        user: { select: { id: true, name: true, healthConditions: true } },
        claimedByNutritionist: { select: { id: true, user: { select: { name: true } } } },
        facts: { select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return documents.map((document) => ({
      ...publicDocument(document),
      user: { id: document.user.id, name: document.user.name, conditions: document.user.healthConditions.map((item) => item.condition) },
      factCount: document.facts.length,
      claimStatus: {
        active: Boolean(document.claimedByNutritionistId && document.claimedAt && document.claimedAt >= cutoff),
        claimedByNutritionistId: document.claimedByNutritionistId,
        claimedByName: document.claimedByNutritionist?.user.name ?? null,
      },
    }));
  }

  static async claimDetail(nutritionistProfileId: string, documentId: string) {
    const now = new Date();
    const cutoff = new Date(now.getTime() - CLAIM_TTL_MS);
    const claimed = await prisma.clinicalDocument.updateMany({
      where: {
        id: documentId,
        status: { in: ['UPLOADED', 'NEEDS_CLARIFICATION'] },
        OR: [{ claimedByNutritionistId: null }, { claimedAt: null }, { claimedAt: { lt: cutoff } }, { claimedByNutritionistId: nutritionistProfileId }],
      },
      data: { claimedByNutritionistId: nutritionistProfileId, claimedAt: now },
    });
    if (claimed.count !== 1) throw new AppError('This document is being reviewed by another nutritionist.', 409, 'CLINICAL_DOCUMENT_CLAIM_CONFLICT');
    const document = await prisma.clinicalDocument.findUnique({
      where: { id: documentId },
      include: { user: { select: { id: true, name: true, healthConditions: true, allergies: true, clinicalContextResponses: true } }, facts: { orderBy: { createdAt: 'asc' } } },
    });
    if (!document) throw new AppError('Clinical document not found.', 404, 'CLINICAL_DOCUMENT_NOT_FOUND');
    return {
      ...publicDocument(document),
      user: {
        id: document.user.id,
        name: document.user.name,
        conditions: document.user.healthConditions.map((item) => item.condition),
        allergies: document.user.allergies.map((item) => item.allergen),
        contexts: document.user.clinicalContextResponses.map((item) => ({ area: item.area, responses: item.responses, revision: item.revision })),
      },
      facts: document.facts.map(({ id, code, valueText, valueNumber, unit, observedAt, pageNumber, provenance, reviewStatus }) => ({ id, code, valueText, valueNumber, unit, observedAt, pageNumber, provenance, reviewStatus })),
    };
  }

  static async fileForUser(userId: string, documentId: string) {
    const document = await prisma.clinicalDocument.findFirst({ where: { id: documentId, userId } });
    if (!document) throw new AppError('Clinical document not found.', 404, 'CLINICAL_DOCUMENT_NOT_FOUND');
    await prisma.auditEvent.create({ data: { actorUserId: userId, action: 'CLINICAL_DOCUMENT_ACCESSED', entityType: 'ClinicalDocument', entityId: document.id, metadata: { access: 'OWNER' } } });
    return { buffer: decryptClinicalDocument(document), mime: document.mimeType, fileName: document.originalFileName };
  }

  static async fileForClaimedReview(nutritionistProfileId: string, actorUserId: string, documentId: string) {
    const cutoff = new Date(Date.now() - CLAIM_TTL_MS);
    const document = await prisma.clinicalDocument.findFirst({
      where: { id: documentId, claimedByNutritionistId: nutritionistProfileId, claimedAt: { gte: cutoff }, status: { in: ['UPLOADED', 'NEEDS_CLARIFICATION'] } },
    });
    if (!document) throw new AppError('Open and claim this document before accessing it.', 409, 'CLINICAL_DOCUMENT_CLAIM_REQUIRED');
    await prisma.auditEvent.create({ data: { actorUserId, action: 'CLINICAL_DOCUMENT_ACCESSED', entityType: 'ClinicalDocument', entityId: document.id, metadata: { access: 'RND_REVIEW' } } });
    return { buffer: decryptClinicalDocument(document), mime: document.mimeType, fileName: document.originalFileName };
  }

  static async fileForClaimedMealReview(
    nutritionistProfileId: string,
    actorUserId: string,
    mealPlanId: string,
    documentId: string
  ) {
    const cutoff = new Date(Date.now() - CLAIM_TTL_MS);
    const meal = await prisma.mealPlan.findFirst({
      where: {
        id: mealPlanId,
        claimedByNutritionistId: nutritionistProfileId,
        claimedAt: { gte: cutoff },
        status: 'PENDING_REVIEW',
      },
      select: { userId: true },
    });
    if (!meal) throw new AppError('A current meal-review claim is required.', 409, 'MEAL_REVIEW_CLAIM_REQUIRED');
    const document = await prisma.clinicalDocument.findFirst({
      where: {
        id: documentId,
        userId: meal.userId,
        status: ClinicalDocumentStatus.SUFFICIENT_FOR_NUTRITION_REVIEW,
        OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
      },
    });
    if (!document) throw new AppError('Current supporting document not found.', 404, 'CLINICAL_DOCUMENT_NOT_FOUND');
    const requirements = await this.requirementsForUser(meal.userId);
    if (!requirements.some((item) => item.readyDocumentIds.includes(document.id)))
      throw new AppError('This document is not part of the current meal-review evidence.', 403, 'CLINICAL_DOCUMENT_NOT_IN_SCOPE');
    await prisma.auditEvent.create({
      data: {
        actorUserId,
        action: 'CLINICAL_DOCUMENT_ACCESSED',
        entityType: 'ClinicalDocument',
        entityId: document.id,
        metadata: { access: 'MEAL_REVIEW', mealPlanId },
      },
    });
    return { buffer: decryptClinicalDocument(document), mime: document.mimeType, fileName: document.originalFileName };
  }

  static async review(input: {
    nutritionistProfileId: string;
    actorUserId: string;
    documentId: string;
    decision: ClinicalDocumentReviewDecision;
    rationale: string;
    validUntil?: Date | null;
    confirmedFactIds?: string[];
    unclearFactIds?: string[];
    confirmedFacts?: ClinicalFactInput[];
  }) {
    const cutoff = new Date(Date.now() - CLAIM_TTL_MS);
    return prisma.$transaction(async (tx) => {
      const document = await tx.clinicalDocument.findFirst({
        where: { id: input.documentId, claimedByNutritionistId: input.nutritionistProfileId, claimedAt: { gte: cutoff }, status: { in: ['UPLOADED', 'NEEDS_CLARIFICATION'] } },
        include: { facts: true },
      });
      if (!document) throw new AppError('A current claim is required to review this document.', 409, 'CLINICAL_DOCUMENT_CLAIM_REQUIRED');
      if (input.decision === ClinicalDocumentReviewDecision.SUFFICIENT && (!input.validUntil || input.validUntil < new Date()))
        throw new AppError('Set a future review-valid-until date.', 422, 'INVALID_CLINICAL_VALIDITY_DATE');
      const confirmed = new Set(input.confirmedFactIds ?? []);
      const unclear = new Set(input.unclearFactIds ?? []);
      const knownIds = new Set(document.facts.map((fact) => fact.id));
      if ([...confirmed, ...unclear].some((id) => !knownIds.has(id)))
        throw new AppError('A selected fact does not belong to this document.', 422, 'CLINICAL_FACT_NOT_IN_DOCUMENT');
      const confirmedCodes = new Set([
        ...document.facts.filter((fact) => confirmed.has(fact.id) || (fact.reviewStatus === ClinicalFactReviewStatus.CONFIRMED && !unclear.has(fact.id))).map((fact) => fact.code),
        ...(input.confirmedFacts ?? []).map((fact) => fact.code),
      ]);
      if (input.decision === ClinicalDocumentReviewDecision.SUFFICIENT) {
        if (
          document.area === ClinicalEvidenceArea.KIDNEY_DISEASE &&
          !confirmedCodes.has(ClinicalFactCode.CKD_STAGE) &&
          !confirmedCodes.has(ClinicalFactCode.EGFR)
        )
          throw new AppError('Confirm kidney stage or eGFR before marking this document sufficient.', 422, 'KIDNEY_CONTEXT_INCOMPLETE');
        if (document.area === ClinicalEvidenceArea.HEART_CONDITION && !confirmedCodes.has(ClinicalFactCode.HEART_DIAGNOSIS))
          throw new AppError('Confirm the heart diagnosis subtype before marking this document sufficient.', 422, 'HEART_CONTEXT_INCOMPLETE');
        if (document.area === ClinicalEvidenceArea.DIABETES && !confirmedCodes.has(ClinicalFactCode.DIABETES_MEDICATION))
          throw new AppError('Confirm the diabetes medication context before marking this document sufficient.', 422, 'DIABETES_CONTEXT_INCOMPLETE');
      }
      for (const fact of document.facts) {
        const reviewStatus = confirmed.has(fact.id)
          ? ClinicalFactReviewStatus.CONFIRMED
          : unclear.has(fact.id)
            ? ClinicalFactReviewStatus.UNCLEAR
            : fact.reviewStatus;
        if (reviewStatus !== fact.reviewStatus) {
          await tx.clinicalFact.update({
            where: { id: fact.id },
            data: { reviewStatus, reviewedByNutritionistId: input.nutritionistProfileId, reviewedAt: new Date(), provenance: reviewStatus === ClinicalFactReviewStatus.CONFIRMED ? ClinicalFactProvenance.NUTRITIONIST_CONFIRMED : fact.provenance },
          });
        }
      }
      const newFacts = input.confirmedFacts?.length
        ? await Promise.all(input.confirmedFacts.map((fact) => tx.clinicalFact.create({
            data: {
              userId: document.userId,
              documentId: document.id,
              area: document.area,
              code: fact.code,
              valueText: fact.valueText?.trim() || null,
              valueNumber: fact.valueNumber ?? null,
              unit: fact.unit?.trim() || null,
              observedAt: fact.observedAt ?? null,
              pageNumber: fact.pageNumber ?? null,
              provenance: ClinicalFactProvenance.NUTRITIONIST_CONFIRMED,
              reviewStatus: ClinicalFactReviewStatus.CONFIRMED,
              reviewedByNutritionistId: input.nutritionistProfileId,
              reviewedAt: new Date(),
            },
          })))
        : [];
      const status =
        input.decision === ClinicalDocumentReviewDecision.SUFFICIENT
          ? ClinicalDocumentStatus.SUFFICIENT_FOR_NUTRITION_REVIEW
          : input.decision === ClinicalDocumentReviewDecision.NEEDS_CLARIFICATION
            ? ClinicalDocumentStatus.NEEDS_CLARIFICATION
            : ClinicalDocumentStatus.UNUSABLE;
      await tx.clinicalDocumentReview.create({
        data: {
          documentId: document.id,
          nutritionistProfileId: input.nutritionistProfileId,
          decision: input.decision,
          rationale: input.rationale.trim(),
          validUntil: input.validUntil ?? null,
          factsSnapshot: [...document.facts, ...newFacts].map((fact) => ({ id: fact.id, code: fact.code, valueText: fact.valueText, valueNumber: fact.valueNumber, unit: fact.unit, reviewStatus: confirmed.has(fact.id) || newFacts.some((added) => added.id === fact.id) ? 'CONFIRMED' : unclear.has(fact.id) ? 'UNCLEAR' : fact.reviewStatus })),
        },
      });
      const updated = await tx.clinicalDocument.update({
        where: { id: document.id },
        data: { status, validUntil: input.validUntil ?? null, claimedByNutritionistId: null, claimedAt: null },
      });
      if (status !== ClinicalDocumentStatus.SUFFICIENT_FOR_NUTRITION_REVIEW)
        await invalidateDocumentDependencies(tx, document.id, `CLINICAL_DOCUMENT_${status}`);
      await invalidateActivePlansForUser(tx, document.userId);
      await tx.notification.create({
        data: {
          userId: document.userId,
          type: NotificationType.REVIEW_REQUEST,
          title: status === ClinicalDocumentStatus.SUFFICIENT_FOR_NUTRITION_REVIEW ? 'Clinical context reviewed' : 'Clinical document needs attention',
          message: status === ClinicalDocumentStatus.SUFFICIENT_FOR_NUTRITION_REVIEW ? 'Your supporting document is ready to be used for nutrition review.' : input.rationale.trim(),
        },
      });
      await tx.auditEvent.create({ data: { actorUserId: input.actorUserId, action: `CLINICAL_DOCUMENT_${status}`, entityType: 'ClinicalDocument', entityId: document.id, metadata: { decision: input.decision, area: document.area } } });
      return publicDocument(updated);
    }, { timeout: 20_000 });
  }
}
