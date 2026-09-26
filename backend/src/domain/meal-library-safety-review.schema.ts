import { z } from 'zod';
import { RESTRICTION_ALLERGY_KEYS } from './restriction-evaluation.policy';

const allergyKeys = RESTRICTION_ALLERGY_KEYS.filter((key) => key !== 'NONE');

const allergyKeySchema = z.enum(allergyKeys as [string, ...string[]]);

export const certifyMealLibrarySafetySchema = z
  .object({
    expectedRevision: z.number().int().nonnegative(),
    conditionDeclarationState: z.literal('NOT_REVIEWED'),
    allergenDeclarationState: z.enum(['REVIEWED_NONE_DECLARED', 'REVIEWED_WITH_DECLARATIONS']),
    crossContactAssessment: z.literal('ASSESSED_NO_KNOWN_RISK'),
    suitableConditions: z.array(z.never()).max(0),
    allergensPresent: z.array(allergyKeySchema).max(allergyKeys.length),
    allergensReviewedAbsent: z.array(allergyKeySchema).max(allergyKeys.length),
    usdaUseAccepted: z.boolean(),
    usdaRationale: z.string().trim().max(1000).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    const uniquePresent = new Set(value.allergensPresent);
    const uniqueAbsent = new Set(value.allergensReviewedAbsent);

    if (uniquePresent.size !== value.allergensPresent.length) {
      context.addIssue({
        code: 'custom',
        path: ['allergensPresent'],
        message: 'Duplicate allergen declarations are not allowed.',
      });
    }
    if (uniqueAbsent.size !== value.allergensReviewedAbsent.length) {
      context.addIssue({
        code: 'custom',
        path: ['allergensReviewedAbsent'],
        message: 'Duplicate allergen declarations are not allowed.',
      });
    }
    if ([...uniquePresent].some((key) => uniqueAbsent.has(key))) {
      context.addIssue({
        code: 'custom',
        path: ['allergensPresent'],
        message: 'An allergen cannot be both present and reviewed absent.',
      });
    }

    const allergenCount = uniquePresent.size + uniqueAbsent.size;
    if (
      (value.allergenDeclarationState === 'REVIEWED_NONE_DECLARED' && allergenCount !== 0) ||
      (value.allergenDeclarationState === 'REVIEWED_WITH_DECLARATIONS' && allergenCount === 0)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['allergenDeclarationState'],
        message: 'Allergen declaration state does not match its declarations.',
      });
    }
  });

export type CertifyMealLibrarySafetyInput = z.infer<typeof certifyMealLibrarySafetySchema>;
