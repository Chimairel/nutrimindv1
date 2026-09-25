import {
  ClinicalDocumentReviewDecision,
  ClinicalDocumentType,
  ClinicalEvidenceArea,
  ClinicalFactCode,
} from '@prisma/client';
import { z } from 'zod';

export const diabetesContextSchema = z
  .object({
    medicationRisk: z.enum(['NONE', 'INSULIN', 'SULFONYLUREA_OR_MEGLITINIDE', 'OTHER', 'UNSURE']),
    recurrentHypoglycemia: z.union([z.boolean(), z.literal('UNSURE')]),
  })
  .strict();

export const clinicalFactInputSchema = z
  .object({
    code: z.nativeEnum(ClinicalFactCode),
    valueText: z.string().trim().max(500).optional().nullable(),
    valueNumber: z.number().finite().optional().nullable(),
    unit: z.string().trim().max(40).optional().nullable(),
    observedAt: z.coerce.date().max(new Date()).optional().nullable(),
    pageNumber: z.number().int().min(1).max(500).optional().nullable(),
  })
  .strict()
  .refine((value) => value.valueText || value.valueNumber !== undefined, {
    message: 'Each clinical fact requires a text or numeric value.',
  });

export const clinicalDocumentMetadataSchema = z
  .object({
    area: z.nativeEnum(ClinicalEvidenceArea),
    documentType: z.nativeEnum(ClinicalDocumentType),
    issuedAt: z.coerce.date().max(new Date()).optional().nullable(),
    issuerName: z.string().trim().max(180).optional().nullable(),
    supersedesDocumentId: z.string().trim().min(1).max(200).optional().nullable(),
    facts: z.array(clinicalFactInputSchema).max(30).default([]),
    consentAccepted: z.literal(true),
  })
  .strict();

export const clinicalDocumentReviewSchema = z
  .object({
    decision: z.nativeEnum(ClinicalDocumentReviewDecision),
    rationale: z.string().trim().min(3).max(1500),
    validUntil: z.coerce.date().optional().nullable(),
    confirmedFactIds: z.array(z.string().min(1).max(200)).max(50).default([]),
    unclearFactIds: z.array(z.string().min(1).max(200)).max(50).default([]),
    confirmedFacts: z.array(clinicalFactInputSchema).max(30).default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.decision === ClinicalDocumentReviewDecision.SUFFICIENT && !value.validUntil) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['validUntil'], message: 'Set a review-valid-until date.' });
    }
    const overlap = value.confirmedFactIds.filter((id) => value.unclearFactIds.includes(id));
    if (overlap.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unclearFactIds'], message: 'A fact cannot be confirmed and unclear.' });
    }
  });

export const clinicalDocumentIdParamsSchema = z.object({ id: z.string().min(1).max(200) }).strict();
