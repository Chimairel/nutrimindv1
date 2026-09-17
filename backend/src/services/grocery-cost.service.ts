import prisma from '@/lib/prisma';
import { GroceryService } from './grocery.service';
import {
  aggregatePriceEstimates,
  estimateIngredientPrice,
  type IngredientPriceEstimate,
  type PriceLocalityMatch,
} from '@/domain/ingredient-price.policy';

/** Estimates only the remaining shopping amount. Missing mappings/conversions never become zero-cost food. */
export class GroceryCostService {
  static async estimate(userId: string) {
    const list = await GroceryService.getGroceryList(userId);
    const profile = await prisma.userProfile.findUniqueOrThrow({ where: { userId } });
    const estimates: IngredientPriceEstimate[] = [];
    const evidence: Array<{ ingredientId: string; sourceUrl: string; observedTo: Date; locality: string }> = [];
    for (const item of list?.groceryItems ?? []) {
      if (item.isChecked || item.isPantryStaple || item.quantity === 0) continue;
      const foods = await prisma.foodItem.findMany({
        where: { name: { equals: item.ingredientName, mode: 'insensitive' }, source: 'FNRI' },
        take: 2,
      });
      const food = foods.length === 1 ? foods[0] : null;
      const mappings = food
        ? await prisma.ingredientPriceCommodityMapping.findMany({
            where: { foodItemId: food.id, state: 'EXACT', supersededBy: null },
            include: {
              commodity: {
                include: {
                  observations: {
                    where: { supersededBy: null, currency: 'PHP' },
                    include: { geography: true, publication: { include: { source: true } } },
                    orderBy: { observedTo: 'desc' },
                    take: 100,
                  },
                },
              },
            },
          })
        : [];
      const candidates = mappings.map((mapping) => {
        const observations = mapping.commodity.observations.map((row) => {
          const equal = (a: string | null | undefined, b: string) =>
            Boolean(a && a.trim().toLowerCase() === b.trim().toLowerCase());
          const localityMatch: PriceLocalityMatch =
            row.geography.level === 'NATIONAL'
              ? 'NATIONAL'
              : ['CITY', 'PROVINCE'].includes(row.geography.level) &&
                  equal(profile.planningProvinceHucName, row.geography.displayName)
                ? 'EXACT'
                : row.geography.level === 'REGION' && equal(profile.planningRegionName, row.geography.displayName)
                  ? 'PARENT'
                  : 'MISMATCH';
          return {
            ...row,
            normalizedQuantity: row.normalizedQuantity?.toNumber() ?? null,
            sourceCode: row.publication.source.code,
            localityMatch,
          };
        });
        return estimateIngredientPrice(
          {
            ingredientId: item.id,
            ingredientName: item.ingredientName,
            foodItemId: food?.id ?? null,
            quantity: item.quantity === null ? null : Math.max(0, item.quantity - item.purchasedQuantity),
            unit: item.unit,
            mapping,
            observations,
          },
          { asOf: new Date(), maxAgeDays: 30, sourcePrecedence: ['PSA_OPENSTAT', 'DA_BANTAY_PRESYO', 'DTI_SRP'] }
        );
      });
      const available = candidates.filter((estimate) => estimate.status === 'AVAILABLE');
      // Conflicting commodity mappings need curator resolution, never choose an artificially cheap price.
      const result: IngredientPriceEstimate =
        available.length === 1
          ? available[0]
          : {
              ingredientId: item.id,
              ingredientName: item.ingredientName,
              status: 'UNAVAILABLE',
              confidence: 'NONE',
              reasons: [available.length > 1 ? 'AMBIGUOUS_COMMODITY_MAPPING' : 'NO_USABLE_PRICE_OR_PORTION_EVIDENCE'],
            };
      estimates.push(result);
      if (result.status === 'AVAILABLE') {
        const source = mappings
          .flatMap((mapping) => mapping.commodity.observations)
          .find((row) => row.id === result.sourceObservationId)!;
        evidence.push({
          ingredientId: item.id,
          sourceUrl: source.publication.sourceUrl,
          observedTo: source.observedTo,
          locality: source.geography.displayName,
        });
      }
    }
    const aggregate = aggregatePriceEstimates(estimates);
    const hasPriceData = await prisma.ingredientPriceObservation.count();
    const hasMappings = await prisma.ingredientPriceCommodityMapping.count({
      where: { state: 'EXACT', supersededBy: null },
    });
    const availabilityReason = !estimates.length
      ? 'NOTHING_TO_PRICE'
      : !hasPriceData
        ? 'PRICE_DATA_NOT_CONFIGURED'
        : !hasMappings
          ? 'PRICE_MAPPINGS_NOT_CONFIGURED'
          : aggregate.status === 'UNAVAILABLE'
            ? 'NO_MATCHING_EVIDENCE'
            : null;
    return {
      ...aggregate,
      availabilityReason,
      estimates,
      evidence,
      scope: 'REMAINING_SHOPPING',
      budgetGuaranteed: false,
      explanation:
        availabilityReason === 'PRICE_DATA_NOT_CONFIGURED'
          ? 'Market prices have not been published in this system yet. Premium access is active, but an administrator must import price data before estimates can be calculated.'
          : availabilityReason === 'PRICE_MAPPINGS_NOT_CONFIGURED'
            ? 'Prices are available, but ingredient mappings still need to be reviewed before estimates can be calculated.'
            : availabilityReason === 'NOTHING_TO_PRICE'
              ? 'There are no remaining ingredients to price.'
              : 'Indicative reference prices for covered ingredients only. Store prices, package sizes and availability can differ.',
    };
  }
}
