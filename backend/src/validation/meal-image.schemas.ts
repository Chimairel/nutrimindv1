import { z } from 'zod';

const url = z.string().trim().url().max(2048);

export const mealImageMetadataSchema = z
  .object({
    imageKind: z.enum(['EXACT', 'REPRESENTATIVE']),
    altText: z.string().trim().min(8).max(240),
    creator: z.string().trim().max(180).optional(),
    sourcePageUrl: url.optional(),
    licenseCode: z.enum(['OWNED', 'GENERATED', 'CC0', 'PUBLIC_DOMAIN', 'CC_BY_4_0', 'CC_BY_SA_4_0']),
    licenseUrl: url.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!['OWNED', 'GENERATED'].includes(value.licenseCode)) {
      for (const field of ['creator', 'sourcePageUrl', 'licenseUrl'] as const) {
        if (!value[field]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} is required for licensed third-party images.`,
          });
        }
      }
    }
  });

export type MealImageMetadata = z.infer<typeof mealImageMetadataSchema>;
