import { z } from 'zod';
import {
  RESTRICTION_ALLERGY_KEYS,
  RESTRICTION_CONDITION_KEYS,
} from './restriction-evaluation.policy';

const conditionKeys = RESTRICTION_CONDITION_KEYS.filter((key) => key !== 'NONE');
const allergyKeys = RESTRICTION_ALLERGY_KEYS.filter((key) => key !== 'NONE');

const conditionKeySchema = z.enum(conditionKeys as [string, ...string[]]);
const allergyKeySchema = z.enum(allergyKeys as [string, ...string[]]);

export const certifyMealLibrarySafetySchema = z.object({
  expectedRevision: z.number().int().nonnegative(),
  conditionDeclarationState: z.enum([
    'REVIEWED_NONE_DECLARED',
    'REVIEWED_WITH_DECLARATIONS',
  ]),
  allergenDeclarationState: z.enum([
    'REVIEWED_NONE_DECLARED',
    'REVIEWED_WITH_DECLARATIONS',
  ]),
  crossContactAssessment: z.literal('ASSESSED_NO_KNOWN_RISK'),
  suitableConditions: z.array(conditionKeySchema).max(conditionKeys.length),
  allergensPresent: z.array(allergyKeySchema).max(allergyKeys.length),
  allergensReviewedAbsent: z.array(allergyKeySchema).max(allergyKeys.length),
}).strict().superRefine((value, context) => {
  const uniqueConditions = new Set(value.suitableConditions);
  const uniquePresent = new Set(value.allergensPresent);
  const uniqueAbsent = new Set(value.allergensReviewedAbsent);

  if (uniqueConditions.size !== value.suitableConditions.length) {
    context.addIssue({ code: 'custom', path: ['suitableConditions'], message: 'Duplicate condition declarations are not allowed.' });
  }
  if (uniquePresent.size !== value.allergensPresent.length) {
    context.addIssue({ code: 'custom', path: ['allergensPresent'], message: 'Duplicate allergen declarations are not allowed.' });
  }
  if (uniqueAbsent.size !== value.allergensReviewedAbsent.length) {
    context.addIssue({ code: 'custom', path: ['allergensReviewedAbsent'], message: 'Duplicate allergen declarations are not allowed.' });
  }
  if ([...uniquePresent].some((key) => uniqueAbsent.has(key))) {
    context.addIssue({ code: 'custom', path: ['allergensPresent'], message: 'An allergen cannot be both present and reviewed absent.' });
  }

  const conditionCount = uniqueConditions.size;
  if (
    (value.conditionDeclarationState === 'REVIEWED_NONE_DECLARED' && conditionCount !== 0) ||
    (value.conditionDeclarationState === 'REVIEWED_WITH_DECLARATIONS' && conditionCount === 0)
  ) {
    context.addIssue({ code: 'custom', path: ['conditionDeclarationState'], message: 'Condition declaration state does not match its declarations.' });
  }

  const allergenCount = uniquePresent.size + uniqueAbsent.size;
  if (
    (value.allergenDeclarationState === 'REVIEWED_NONE_DECLARED' && allergenCount !== 0) ||
    (value.allergenDeclarationState === 'REVIEWED_WITH_DECLARATIONS' && allergenCount === 0)
  ) {
    context.addIssue({ code: 'custom', path: ['allergenDeclarationState'], message: 'Allergen declaration state does not match its declarations.' });
  }
});

export type CertifyMealLibrarySafetyInput = z.infer<typeof certifyMealLibrarySafetySchema>;
