import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { COMMON_MEAL_CATALOGUE } from '@/data/common-meal-catalogue';
import { LoadedPsaSnapshot } from '@/domain/psa-openstat-price-ingestion';

const httpsUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), 'HTTPS URL required');
const sourceReviewSchema = z
  .object({
    code: z.string().regex(/^[A-Z0-9_]+$/),
    agencyName: z.string().trim().min(1),
    publicationTitle: z.string().trim().min(1),
    sourceUrl: httpsUrl,
    termsUrl: httpsUrl.nullable(),
    versionLabel: z.string().trim().min(1),
    publishedAt: z.string().datetime({ offset: true }).nullable(),
    geographyApplicability: z.string().trim().min(1),
    factorMeaning: z.string().trim().min(1),
    foodsAndPreparationsReviewed: z.string().trim().min(1),
    uncertainty: z.string().trim().min(1),
    licenseCode: z.string().trim().min(1).nullable(),
    redistributionStatus: z.enum([
      'REDISTRIBUTABLE',
      'AUTHORIZED_INTERNAL_USE',
      'METADATA_ONLY',
      'LICENSE_REVIEW_REQUIRED',
    ]),
    contentSha256: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .nullable(),
    importDecision: z.enum(['IMPORTED', 'OMITTED', 'REFERENCE_ONLY']),
    omissionReason: z.string().trim().min(1),
  })
  .strict()
  .superRefine((source, context) => {
    if (source.importDecision === 'IMPORTED' && !source.contentSha256) {
      context.addIssue({ code: 'custom', message: 'Imported evidence requires an artifact SHA-256' });
    }
    if (
      (source.redistributionStatus === 'REDISTRIBUTABLE' ||
        source.redistributionStatus === 'AUTHORIZED_INTERNAL_USE') &&
      (!source.licenseCode || !source.contentSha256)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Usable evidence requires an explicit license code and artifact SHA-256',
      });
    }
  });

export const ingredientConversionSourceReviewSchema = z
  .object({
    schemaVersion: z.literal(1),
    reviewId: z.string().regex(/^[a-z0-9-]+$/),
    accessedAt: z.string().datetime({ offset: true }),
    decision: z.literal('METADATA_ONLY_NO_PILOT_FACTORS'),
    decisionReason: z.string().trim().min(1),
    sources: z.array(sourceReviewSchema).min(1),
    pilotEvidence: z.tuple([]),
    acquisitionWorkflow: z
      .object({
        requiredBeforeImport: z.array(z.string().trim().min(1)).min(1),
        contactRequest: z.string().trim().min(1),
      })
      .strict(),
  })
  .strict()
  .superRefine((review, context) => {
    const codes = new Set<string>();
    for (const source of review.sources) {
      if (codes.has(source.code))
        context.addIssue({ code: 'custom', message: `Duplicate source code: ${source.code}` });
      codes.add(source.code);
    }
  });

export type IngredientConversionSourceReview = z.infer<typeof ingredientConversionSourceReviewSchema>;

export function loadIngredientConversionSourceReview(path: string): IngredientConversionSourceReview {
  return ingredientConversionSourceReviewSchema.parse(JSON.parse(readFileSync(resolve(path), 'utf8')));
}

export interface IngredientConversionCoverageReport {
  generatedAsOf: string;
  mealCount: number;
  ingredientRowCount: number;
  layers: {
    sourceBasket: { rows: number; meals: number };
    exactFnriMapping: { rows: number; meals: number };
    currentPrice: { rows: number; meals: number };
    quantityAndUnit: { rows: number; meals: number };
    sameIdentityWithoutBasisBridge: { rows: number; meals: number };
    reviewedConversionEvidence: { rows: number; meals: number };
    conversionUsable: { rows: number; meals: number };
  };
  mealCoverage: { complete: number; partial: number; unpriced: number };
  missingByReason: Record<string, number>;
  meals: Array<{
    mealName: string;
    status: 'COMPLETE' | 'PARTIAL' | 'UNPRICED';
    pricedIngredientRows: number;
    totalIngredientRows: number;
    missing: Array<{ foodName: string; reason: string }>;
  }>;
}

function countMeals(names: Set<string>): number {
  return COMMON_MEAL_CATALOGUE.filter((meal) => meal.ingredients.some((ingredient) => names.has(ingredient.foodName)))
    .length;
}

export function buildIngredientConversionCoverageReport(
  snapshot: LoadedPsaSnapshot,
  review: IngredientConversionSourceReview,
  asOf: Date
): IngredientConversionCoverageReport {
  if (!Number.isFinite(asOf.getTime())) throw new Error('A valid coverage as-of date is required');
  const configured = snapshot.manifest.files.flatMap((file) =>
    file.commodities.map((commodity) => ({ file, commodity }))
  );
  const byTarget = new Map(configured.map((entry) => [entry.commodity.catalogueTargetName, entry]));
  const availableKeys = new Set(
    snapshot.parsedFiles
      .flatMap((file) => file.cells)
      .filter(
        (cell) =>
          cell.status === 'AVAILABLE' &&
          new Date(cell.observedTo).getTime() <= asOf.getTime() &&
          asOf.getTime() - new Date(cell.observedTo).getTime() <= 45 * 86_400_000
      )
      .map((cell) => cell.sourceCommodityKey)
  );
  const selected = new Set(configured.map(({ commodity }) => commodity.catalogueTargetName));
  const exact = new Set(
    configured
      .filter(({ commodity }) => commodity.mapping.state === 'EXACT')
      .map(({ commodity }) => commodity.catalogueTargetName)
  );
  const current = new Set(
    configured
      .filter(
        ({ file, commodity }) =>
          commodity.mapping.state === 'EXACT' && availableKeys.has(`${file.matrixId}:${commodity.externalCode}`)
      )
      .map(({ commodity }) => commodity.catalogueTargetName)
  );
  const quantity = new Set(
    [...current].filter((name) =>
      COMMON_MEAL_CATALOGUE.some((meal) =>
        meal.ingredients.some(
          (ingredient) => ingredient.foodName === name && Number.isFinite(ingredient.grams) && ingredient.grams > 0
        )
      )
    )
  );
  const sameIdentity = new Set(
    configured
      .filter(
        ({ file, commodity }) =>
          commodity.mapping.state === 'EXACT' &&
          commodity.mapping.foodName === commodity.catalogueTargetName &&
          availableKeys.has(`${file.matrixId}:${commodity.externalCode}`)
      )
      .map(({ commodity }) => commodity.catalogueTargetName)
  );
  const reviewedConversion = new Set<string>();
  if (review.pilotEvidence.length !== 0)
    throw new Error('Coverage implementation must be updated before pilot evidence is enabled');

  const allRows = COMMON_MEAL_CATALOGUE.flatMap((meal) => meal.ingredients);
  const rows = (names: Set<string>) => allRows.filter((ingredient) => names.has(ingredient.foodName)).length;
  const missingByReason: Record<string, number> = {};
  const meals = COMMON_MEAL_CATALOGUE.map((meal) => {
    const missing = meal.ingredients.flatMap((ingredient) => {
      if (reviewedConversion.has(ingredient.foodName)) return [];
      const entry = byTarget.get(ingredient.foodName);
      let reason: string;
      if (!entry) reason = 'NO_SOURCE_BASKET_COMMODITY';
      else if (entry.commodity.mapping.state !== 'EXACT') reason = 'NO_EXACT_FNRI_MAPPING';
      else if (!current.has(ingredient.foodName)) reason = 'NO_CURRENT_PRICE_OBSERVATION';
      else if (!quantity.has(ingredient.foodName)) reason = 'INVALID_QUANTITY_OR_UNIT';
      else if (sameIdentity.has(ingredient.foodName)) reason = 'NO_REVIEWED_PURCHASED_TO_RAW_EVIDENCE';
      else reason = 'NO_REVIEWED_PURCHASED_TO_COOKED_CHAIN';
      missingByReason[reason] = (missingByReason[reason] ?? 0) + 1;
      return [{ foodName: ingredient.foodName, reason }];
    });
    const pricedIngredientRows = meal.ingredients.length - missing.length;
    const status: 'COMPLETE' | 'PARTIAL' | 'UNPRICED' =
      pricedIngredientRows === meal.ingredients.length ? 'COMPLETE' : pricedIngredientRows > 0 ? 'PARTIAL' : 'UNPRICED';
    return {
      mealName: meal.mealName,
      status,
      pricedIngredientRows,
      totalIngredientRows: meal.ingredients.length,
      missing,
    };
  });

  return {
    generatedAsOf: asOf.toISOString(),
    mealCount: COMMON_MEAL_CATALOGUE.length,
    ingredientRowCount: allRows.length,
    layers: {
      sourceBasket: { rows: rows(selected), meals: countMeals(selected) },
      exactFnriMapping: { rows: rows(exact), meals: countMeals(exact) },
      currentPrice: { rows: rows(current), meals: countMeals(current) },
      quantityAndUnit: { rows: rows(quantity), meals: countMeals(quantity) },
      sameIdentityWithoutBasisBridge: { rows: rows(sameIdentity), meals: countMeals(sameIdentity) },
      reviewedConversionEvidence: { rows: rows(reviewedConversion), meals: countMeals(reviewedConversion) },
      conversionUsable: { rows: rows(reviewedConversion), meals: countMeals(reviewedConversion) },
    },
    mealCoverage: {
      complete: meals.filter((meal) => meal.status === 'COMPLETE').length,
      partial: meals.filter((meal) => meal.status === 'PARTIAL').length,
      unpriced: meals.filter((meal) => meal.status === 'UNPRICED').length,
    },
    missingByReason: Object.fromEntries(
      Object.entries(missingByReason).sort(([left], [right]) => left.localeCompare(right))
    ),
    meals,
  };
}
