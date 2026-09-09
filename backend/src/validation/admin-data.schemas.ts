import { z } from 'zod';

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/, 'Use letters, numbers, dots, underscores, colons, or hyphens.');
const url = z.string().trim().url().max(500);
const optionalText = (maximum: number) => z.string().trim().min(1).max(maximum).optional();

export const createReferenceDataSourceSchema = z
  .object({
    code: identifier.max(80),
    name: z.string().trim().min(2).max(180),
    agencyName: z.string().trim().min(2).max(180),
    domain: z.enum(['FOOD_COMPOSITION', 'FOOD_CONSUMPTION', 'INGREDIENT_PRICE', 'MEAL_CATALOGUE', 'MEAL_MEDIA']),
    homepageUrl: url,
    termsUrl: url.optional(),
    attributionText: z.string().trim().min(2).max(300),
    updateCadence: optionalText(120),
  })
  .strict();

export const updateReferenceDataSourceSchema = z
  .object({
    name: z.string().trim().min(2).max(180).optional(),
    homepageUrl: url.optional(),
    termsUrl: url.nullable().optional(),
    attributionText: z.string().trim().min(2).max(300).optional(),
    updateCadence: z.string().trim().min(1).max(120).nullable().optional(),
    isEnabled: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one source change.');

export const createReferenceDataReleaseSchema = z
  .object({
    sourceId: z.string().trim().min(1).max(191),
    versionLabel: z.string().trim().min(1).max(120),
    surveyYear: z.number().int().min(1970).max(2100).optional(),
    sourceUrl: url,
    sourcePublishedAt: z.string().datetime({ offset: true }).optional(),
    retrievedAt: z.string().datetime({ offset: true }),
    notes: optionalText(500),
  })
  .strict();

export const importConsumptionCsvSchema = z
  .object({
    csvText: z.string().min(1).max(220_000),
  })
  .strict();

export const mapConsumptionStatSchema = z.object({ foodItemId: z.string().trim().min(1).max(191) }).strict();

export const createFoodAliasSchema = z
  .object({
    foodItemId: z.string().trim().min(1).max(191),
    alias: z.string().trim().min(2).max(180),
  })
  .strict();

export const adminDataListQuerySchema = z
  .object({
    search: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const identifierParamsSchema = z.object({ id: z.string().trim().min(1).max(191) }).strict();
