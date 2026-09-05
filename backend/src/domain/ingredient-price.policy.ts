export type PriceUnit =
  | 'MILLIGRAM'
  | 'GRAM'
  | 'KILOGRAM'
  | 'MILLILITER'
  | 'LITER'
  | 'PIECE'
  | 'PACKAGE';

export type PriceUnitFamily = 'MASS' | 'VOLUME' | 'COUNT' | 'PACKAGE';
export type PriceMappingState = 'UNMAPPED' | 'EXACT' | 'AMBIGUOUS' | 'REJECTED';
export type PriceFreshness = 'CURRENT' | 'STALE' | 'FUTURE' | 'INVALID';
export type PriceLocalityMatch = 'EXACT' | 'PARENT' | 'NATIONAL' | 'MISMATCH' | 'UNKNOWN';
export type PriceConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type CostCoverageStatus = 'COMPLETE' | 'PARTIAL' | 'UNAVAILABLE';

const UNIT_ALIASES: Readonly<Record<string, PriceUnit>> = {
  mg: 'MILLIGRAM',
  milligram: 'MILLIGRAM',
  milligrams: 'MILLIGRAM',
  g: 'GRAM',
  gram: 'GRAM',
  grams: 'GRAM',
  kg: 'KILOGRAM',
  kilogram: 'KILOGRAM',
  kilograms: 'KILOGRAM',
  ml: 'MILLILITER',
  milliliter: 'MILLILITER',
  milliliters: 'MILLILITER',
  millilitre: 'MILLILITER',
  millilitres: 'MILLILITER',
  l: 'LITER',
  liter: 'LITER',
  liters: 'LITER',
  litre: 'LITER',
  litres: 'LITER',
  pc: 'PIECE',
  pcs: 'PIECE',
  piece: 'PIECE',
  pieces: 'PIECE',
  pack: 'PACKAGE',
  package: 'PACKAGE',
  packet: 'PACKAGE',
  bottle: 'PACKAGE',
  can: 'PACKAGE',
  pouch: 'PACKAGE',
  sachet: 'PACKAGE',
};

const UNIT_DEFINITIONS: Readonly<Record<PriceUnit, { family: PriceUnitFamily; baseFactor: number }>> = {
  MILLIGRAM: { family: 'MASS', baseFactor: 0.001 },
  GRAM: { family: 'MASS', baseFactor: 1 },
  KILOGRAM: { family: 'MASS', baseFactor: 1000 },
  MILLILITER: { family: 'VOLUME', baseFactor: 1 },
  LITER: { family: 'VOLUME', baseFactor: 1000 },
  PIECE: { family: 'COUNT', baseFactor: 1 },
  PACKAGE: { family: 'PACKAGE', baseFactor: 1 },
};

export function normalizePriceUnit(value: string | null | undefined): PriceUnit | null {
  if (!value) return null;
  return UNIT_ALIASES[value.trim().toLowerCase().replace(/[.]/g, '')] ?? null;
}

export type QuantityConversion =
  | { status: 'CONVERTED'; quantity: number; unit: PriceUnit }
  | { status: 'INVALID_QUANTITY' | 'UNKNOWN_UNIT' | 'INCOMPATIBLE_UNIT' | 'PACKAGE_AMBIGUOUS' };

export function convertPriceQuantity(
  quantity: number,
  fromUnitInput: string | PriceUnit | null | undefined,
  toUnitInput: string | PriceUnit | null | undefined,
): QuantityConversion {
  if (!Number.isFinite(quantity) || quantity <= 0) return { status: 'INVALID_QUANTITY' };

  const fromUnit = isPriceUnit(fromUnitInput) ? fromUnitInput : normalizePriceUnit(fromUnitInput);
  const toUnit = isPriceUnit(toUnitInput) ? toUnitInput : normalizePriceUnit(toUnitInput);
  if (!fromUnit || !toUnit) return { status: 'UNKNOWN_UNIT' };

  const from = UNIT_DEFINITIONS[fromUnit];
  const to = UNIT_DEFINITIONS[toUnit];
  if (from.family === 'PACKAGE' || to.family === 'PACKAGE') {
    return { status: 'PACKAGE_AMBIGUOUS' };
  }
  if (from.family !== to.family) return { status: 'INCOMPATIBLE_UNIT' };

  return { status: 'CONVERTED', quantity: quantity * from.baseFactor / to.baseFactor, unit: toUnit };
}

function isPriceUnit(value: unknown): value is PriceUnit {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(UNIT_DEFINITIONS, value);
}

export function isValidPhpCentavos(value: unknown, options: { allowZero?: boolean } = {}): value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) return false;
  return options.allowZero === true ? value >= 0 : value > 0;
}

export interface MappingEvidence {
  commodityId?: string | null;
  state: PriceMappingState;
  foodItemId?: string | null;
  evidenceReference?: string | null;
}

export function validateExactPriceMapping(mapping: MappingEvidence):
  | { eligible: true; foodItemId: string }
  | { eligible: false; reason: 'UNMAPPED' | 'AMBIGUOUS_MAPPING' | 'REJECTED_MAPPING' | 'MISSING_EXACT_EVIDENCE' } {
  if (mapping.state === 'UNMAPPED') return { eligible: false, reason: 'UNMAPPED' };
  if (mapping.state === 'AMBIGUOUS') return { eligible: false, reason: 'AMBIGUOUS_MAPPING' };
  if (mapping.state === 'REJECTED') return { eligible: false, reason: 'REJECTED_MAPPING' };
  if (!mapping.foodItemId?.trim() || !mapping.evidenceReference?.trim()) {
    return { eligible: false, reason: 'MISSING_EXACT_EVIDENCE' };
  }
  return { eligible: true, foodItemId: mapping.foodItemId };
}

export function classifyPriceFreshness(input: {
  asOf: Date;
  observedTo: Date;
  validFrom?: Date | null;
  validUntil?: Date | null;
  maxAgeDays: number;
}): PriceFreshness {
  const { asOf, observedTo, validFrom, validUntil, maxAgeDays } = input;
  const timestamps = [asOf.getTime(), observedTo.getTime(), validFrom?.getTime(), validUntil?.getTime()];
  if (timestamps.some((value) => value !== undefined && !Number.isFinite(value)) ||
      !Number.isFinite(maxAgeDays) || maxAgeDays < 0) {
    return 'INVALID';
  }
  if (observedTo.getTime() > asOf.getTime()) return 'FUTURE';
  if (validFrom && validFrom.getTime() > asOf.getTime()) return 'FUTURE';
  if (validUntil && validUntil.getTime() < asOf.getTime()) return 'STALE';
  const ageMs = asOf.getTime() - observedTo.getTime();
  return ageMs <= maxAgeDays * 86_400_000 ? 'CURRENT' : 'STALE';
}

export interface PriceObservationCandidate {
  id: string;
  commodityId: string;
  sourceCode: string;
  sourceObservationKey: string;
  amountMinCentavos: number;
  amountMaxCentavos: number;
  normalizedQuantity: number | null;
  normalizedUnit: PriceUnit | null;
  observedTo: Date;
  validFrom?: Date | null;
  validUntil?: Date | null;
  localityMatch: PriceLocalityMatch;
  supersedesObservationId?: string | null;
}

export type ObservationSelection =
  | { status: 'SELECTED'; observation: PriceObservationCandidate; freshness: 'CURRENT' | 'STALE'; confidence: Exclude<PriceConfidence, 'NONE'>; competingObservationIds: string[] }
  | { status: 'UNAVAILABLE'; reasons: string[] };

function localityRank(match: PriceLocalityMatch): number {
  return { EXACT: 0, PARENT: 1, NATIONAL: 2, UNKNOWN: 3, MISMATCH: 4 }[match];
}

export function selectPriceObservation(
  candidates: readonly PriceObservationCandidate[],
  options: { asOf: Date; maxAgeDays: number; sourcePrecedence: readonly string[] },
): ObservationSelection {
  const supersededIds = new Set(candidates.flatMap((item) => item.supersedesObservationId ? [item.supersedesObservationId] : []));
  const reasons = new Set<string>();
  const eligible: Array<{ observation: PriceObservationCandidate; freshness: 'CURRENT' | 'STALE' }> = [];
  const seen = new Map<string, PriceObservationCandidate>();
  const conflictingKeys = new Set<string>();

  for (const observation of candidates) {
    if (supersededIds.has(observation.id)) {
      reasons.add('SUPERSEDED_OBSERVATION');
      continue;
    }
    if (!isValidPhpCentavos(observation.amountMinCentavos) ||
        !isValidPhpCentavos(observation.amountMaxCentavos) ||
        observation.amountMinCentavos > observation.amountMaxCentavos) {
      reasons.add('INVALID_PRICE_RANGE');
      continue;
    }
    if (observation.localityMatch === 'MISMATCH' || observation.localityMatch === 'UNKNOWN') {
      reasons.add(observation.localityMatch === 'MISMATCH' ? 'LOCALITY_MISMATCH' : 'LOCALITY_UNKNOWN');
      continue;
    }
    const freshness = classifyPriceFreshness({
      asOf: options.asOf,
      maxAgeDays: options.maxAgeDays,
      observedTo: observation.observedTo,
      validFrom: observation.validFrom,
      validUntil: observation.validUntil,
    });
    if (freshness === 'INVALID' || freshness === 'FUTURE') {
      reasons.add(freshness === 'FUTURE' ? 'FUTURE_OBSERVATION' : 'INVALID_FRESHNESS');
      continue;
    }
    if (!observation.normalizedUnit || !Number.isFinite(observation.normalizedQuantity ?? NaN) || (observation.normalizedQuantity ?? 0) <= 0) {
      reasons.add('MISSING_NORMALIZED_UNIT');
      continue;
    }

    const duplicateKey = `${observation.sourceCode}|${observation.sourceObservationKey}`;
    const duplicate = seen.get(duplicateKey);
    if (duplicate) {
      const isIdentical = duplicate.amountMinCentavos === observation.amountMinCentavos &&
        duplicate.amountMaxCentavos === observation.amountMaxCentavos &&
        duplicate.normalizedQuantity === observation.normalizedQuantity &&
        duplicate.normalizedUnit === observation.normalizedUnit;
      if (!isIdentical) {
        reasons.add('DUPLICATE_OBSERVATION_CONFLICT');
        conflictingKeys.add(duplicateKey);
      }
      continue;
    }
    seen.set(duplicateKey, observation);
    eligible.push({ observation, freshness });
  }

  const conflictFree = eligible.filter(({ observation }) =>
    !conflictingKeys.has(`${observation.sourceCode}|${observation.sourceObservationKey}`));
  if (conflictFree.length === 0) return { status: 'UNAVAILABLE', reasons: [...reasons].sort() };

  const sourceRank = (code: string) => {
    const index = options.sourcePrecedence.indexOf(code);
    return index === -1 ? options.sourcePrecedence.length : index;
  };
  conflictFree.sort((left, right) =>
    localityRank(left.observation.localityMatch) - localityRank(right.observation.localityMatch) ||
    Number(left.freshness === 'STALE') - Number(right.freshness === 'STALE') ||
    sourceRank(left.observation.sourceCode) - sourceRank(right.observation.sourceCode) ||
    right.observation.observedTo.getTime() - left.observation.observedTo.getTime() ||
    left.observation.id.localeCompare(right.observation.id));

  const selected = conflictFree[0];
  const confidence: Exclude<PriceConfidence, 'NONE'> = selected.freshness === 'STALE'
    ? 'LOW'
    : selected.observation.localityMatch === 'EXACT'
      ? 'HIGH'
      : 'MEDIUM';
  return {
    status: 'SELECTED',
    observation: selected.observation,
    freshness: selected.freshness,
    confidence,
    competingObservationIds: conflictFree.slice(1).map((item) => item.observation.id),
  };
}

export interface IngredientPriceRequest {
  ingredientId: string;
  ingredientName: string;
  foodItemId: string | null;
  quantity: number | null;
  unit: string | null;
  mapping: MappingEvidence;
  observations: readonly PriceObservationCandidate[];
}

export type IngredientPriceEstimate =
  | {
      ingredientId: string;
      ingredientName: string;
      status: 'AVAILABLE';
      amountMinCentavos: number;
      amountMaxCentavos: number;
      confidence: Exclude<PriceConfidence, 'NONE'>;
      freshness: 'CURRENT' | 'STALE';
      sourceObservationId: string;
      reasons: string[];
    }
  | {
      ingredientId: string;
      ingredientName: string;
      status: 'UNAVAILABLE';
      confidence: 'NONE';
      reasons: string[];
    };

export function estimateIngredientPrice(
  request: IngredientPriceRequest,
  options: { asOf: Date; maxAgeDays: number; sourcePrecedence: readonly string[] },
): IngredientPriceEstimate {
  const unavailable = (reasons: string[]): IngredientPriceEstimate => ({
    ingredientId: request.ingredientId,
    ingredientName: request.ingredientName,
    status: 'UNAVAILABLE',
    confidence: 'NONE',
    reasons,
  });

  if (!Number.isFinite(request.quantity ?? NaN) || (request.quantity ?? 0) <= 0) return unavailable(['INVALID_QUANTITY']);
  const mapping = validateExactPriceMapping(request.mapping);
  if (!mapping.eligible) return unavailable([mapping.reason]);
  if (!request.foodItemId?.trim()) return unavailable(['INGREDIENT_NOT_FNRI_LINKED']);
  if (request.foodItemId !== mapping.foodItemId) return unavailable(['MAPPING_FOOD_MISMATCH']);
  if (!request.mapping.commodityId?.trim()) return unavailable(['MISSING_COMMODITY_MAPPING']);

  const selection = selectPriceObservation(
    request.observations.filter((observation) => observation.commodityId === request.mapping.commodityId),
    options,
  );
  if (selection.status === 'UNAVAILABLE') return unavailable(selection.reasons.length ? selection.reasons : ['NO_PRICE_OBSERVATION']);
  const conversion = convertPriceQuantity(
    request.quantity as number,
    request.unit,
    selection.observation.normalizedUnit,
  );
  if (conversion.status !== 'CONVERTED') return unavailable([conversion.status]);

  const basis = selection.observation.normalizedQuantity as number;
  const factor = conversion.quantity / basis;
  const min = Math.floor(selection.observation.amountMinCentavos * factor);
  const max = Math.ceil(selection.observation.amountMaxCentavos * factor);
  if (!isValidPhpCentavos(min, { allowZero: true }) || !isValidPhpCentavos(max, { allowZero: true }) || min > max) {
    return unavailable(['UNSAFE_ESTIMATE_ARITHMETIC']);
  }

  const reasons = [
    ...(selection.freshness === 'STALE' ? ['STALE_OBSERVATION'] : []),
    ...(selection.observation.localityMatch !== 'EXACT' ? [`${selection.observation.localityMatch}_LOCALITY`] : []),
    ...(selection.competingObservationIds.length ? ['LOWER_PRECEDENCE_OBSERVATIONS_AVAILABLE'] : []),
  ];
  return {
    ingredientId: request.ingredientId,
    ingredientName: request.ingredientName,
    status: 'AVAILABLE',
    amountMinCentavos: min,
    amountMaxCentavos: max,
    confidence: selection.confidence,
    freshness: selection.freshness,
    sourceObservationId: selection.observation.id,
    reasons,
  };
}

export interface CostAggregate {
  status: CostCoverageStatus;
  amountMinCentavos: number | null;
  amountMaxCentavos: number | null;
  knownItemCount: number;
  totalItemCount: number;
  knownCostCoveragePercent: number;
  confidence: PriceConfidence;
  missingPrices: Array<{ ingredientId: string; ingredientName: string; reasons: string[] }>;
}

const CONFIDENCE_RANK: Readonly<Record<PriceConfidence, number>> = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };

export function aggregatePriceEstimates(estimates: readonly IngredientPriceEstimate[]): CostAggregate {
  const available = estimates.filter((item): item is Extract<IngredientPriceEstimate, { status: 'AVAILABLE' }> => item.status === 'AVAILABLE');
  const unavailable = estimates.filter((item): item is Extract<IngredientPriceEstimate, { status: 'UNAVAILABLE' }> => item.status === 'UNAVAILABLE');
  const total = estimates.length;
  const coverage = total === 0 ? 0 : Math.round((available.length / total) * 10_000) / 100;
  const status: CostCoverageStatus = available.length === 0 ? 'UNAVAILABLE' : unavailable.length === 0 ? 'COMPLETE' : 'PARTIAL';
  const confidence = available.length === 0
    ? 'NONE'
    : status === 'PARTIAL'
      ? 'LOW'
      : available.reduce<Exclude<PriceConfidence, 'NONE'>>(
          (lowest, item) => CONFIDENCE_RANK[item.confidence] < CONFIDENCE_RANK[lowest] ? item.confidence : lowest,
          'HIGH',
        );

  return {
    status,
    amountMinCentavos: available.length ? available.reduce((sum, item) => sum + item.amountMinCentavos, 0) : null,
    amountMaxCentavos: available.length ? available.reduce((sum, item) => sum + item.amountMaxCentavos, 0) : null,
    knownItemCount: available.length,
    totalItemCount: total,
    knownCostCoveragePercent: coverage,
    confidence,
    missingPrices: unavailable.map((item) => ({
      ingredientId: item.ingredientId,
      ingredientName: item.ingredientName,
      reasons: item.reasons,
    })),
  };
}

export const aggregateMealPrice = aggregatePriceEstimates;
export const aggregatePlanPrice = aggregatePriceEstimates;
export const aggregateGroceryPrice = aggregatePriceEstimates;

export interface BudgetRankCandidate {
  id: string;
  clinicalCompatibility: 'ALLOW' | 'REVIEW' | 'BLOCK';
  cost: CostAggregate;
}

export function rankClinicallyCompatibleMeals(candidates: readonly BudgetRankCandidate[]): BudgetRankCandidate[] {
  return candidates
    .filter((candidate) => candidate.clinicalCompatibility === 'ALLOW')
    .slice()
    .sort((left, right) => {
      const leftCoverage = left.cost.status === 'COMPLETE' ? 0 : left.cost.status === 'PARTIAL' ? 1 : 2;
      const rightCoverage = right.cost.status === 'COMPLETE' ? 0 : right.cost.status === 'PARTIAL' ? 1 : 2;
      return leftCoverage - rightCoverage ||
        (left.cost.amountMaxCentavos ?? Number.MAX_SAFE_INTEGER) - (right.cost.amountMaxCentavos ?? Number.MAX_SAFE_INTEGER) ||
        left.id.localeCompare(right.id);
    });
}
