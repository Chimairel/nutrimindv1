import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateGroceryPrice,
  aggregateMealPrice,
  aggregatePlanPrice,
  classifyPriceFreshness,
  convertPriceQuantity,
  estimateIngredientPrice,
  isValidPhpCentavos,
  normalizePriceUnit,
  PriceObservationCandidate,
  rankClinicallyCompatibleMeals,
  selectPriceObservation,
  validateExactPriceMapping,
} from '../src/domain/ingredient-price.policy';

const AS_OF = new Date('2026-09-06T00:00:00.000Z');

function observation(overrides: Partial<PriceObservationCandidate> = {}): PriceObservationCandidate {
  return {
    id: 'obs-1',
    commodityId: 'commodity-rice',
    sourceCode: 'PSA_OPENSTAT_RPS_2018_NEW',
    sourceObservationKey: 'matrix|geo|commodity|2026|august',
    amountMinCentavos: 5_000,
    amountMaxCentavos: 6_000,
    normalizedQuantity: 1,
    normalizedUnit: 'KILOGRAM',
    observedTo: new Date('2026-08-31T00:00:00.000Z'),
    localityMatch: 'EXACT',
    ...overrides,
  };
}

const selectionOptions = {
  asOf: AS_OF,
  maxAgeDays: 45,
  sourcePrecedence: ['PSA_OPENSTAT_RPS_2018_NEW', 'DA_BANTAY_PRESYO_NCR', 'DTI_BNPC_SRP'],
} as const;

test('[TEST-090] canonical mass and volume units convert deterministically', () => {
  assert.equal(normalizePriceUnit('kg'), 'KILOGRAM');
  assert.equal(normalizePriceUnit('mL.'), 'MILLILITER');
  assert.deepEqual(convertPriceQuantity(1.25, 'kg', 'GRAM'), {
    status: 'CONVERTED',
    quantity: 1_250,
    unit: 'GRAM',
  });
  assert.deepEqual(convertPriceQuantity(2, 'L', 'MILLILITER'), {
    status: 'CONVERTED',
    quantity: 2_000,
    unit: 'MILLILITER',
  });
});

test('[TEST-090] count is isolated and package labels never imply weight or volume', () => {
  assert.deepEqual(convertPriceQuantity(2, 'piece', 'PIECE'), {
    status: 'CONVERTED',
    quantity: 2,
    unit: 'PIECE',
  });
  assert.deepEqual(convertPriceQuantity(1, 'package', 'GRAM'), { status: 'PACKAGE_AMBIGUOUS' });
  assert.deepEqual(convertPriceQuantity(1, 'bottle', 'MILLILITER'), { status: 'PACKAGE_AMBIGUOUS' });
  assert.deepEqual(convertPriceQuantity(1, 'piece', 'GRAM'), { status: 'INCOMPATIBLE_UNIT' });
});

test('[TEST-090] zero, negative, non-finite, and unknown quantities fail closed', () => {
  assert.deepEqual(convertPriceQuantity(0, 'g', 'kg'), { status: 'INVALID_QUANTITY' });
  assert.deepEqual(convertPriceQuantity(-1, 'g', 'kg'), { status: 'INVALID_QUANTITY' });
  assert.deepEqual(convertPriceQuantity(Number.NaN, 'g', 'kg'), { status: 'INVALID_QUANTITY' });
  assert.deepEqual(convertPriceQuantity(1, 'tablespoon', 'ml'), { status: 'UNKNOWN_UNIT' });
});

test('[TEST-091] PHP money accepts only safe integer centavos', () => {
  assert.equal(isValidPhpCentavos(1), true);
  assert.equal(isValidPhpCentavos(0), false);
  assert.equal(isValidPhpCentavos(0, { allowZero: true }), true);
  assert.equal(isValidPhpCentavos(10.5), false);
  assert.equal(isValidPhpCentavos(Number.MAX_SAFE_INTEGER + 1), false);
  assert.equal(isValidPhpCentavos('100'), false);
});

test('[TEST-091] only an exact mapping with a food and evidence is eligible', () => {
  assert.deepEqual(validateExactPriceMapping({
    state: 'EXACT',
    foodItemId: 'fnri-a020',
    evidenceReference: 'review:2026-09-06:a020',
  }), { eligible: true, foodItemId: 'fnri-a020' });
  assert.equal(validateExactPriceMapping({ state: 'EXACT', foodItemId: 'fnri-a020' }).eligible, false);
  assert.deepEqual(validateExactPriceMapping({ state: 'UNMAPPED' }), { eligible: false, reason: 'UNMAPPED' });
  assert.deepEqual(validateExactPriceMapping({ state: 'AMBIGUOUS' }), { eligible: false, reason: 'AMBIGUOUS_MAPPING' });
  assert.deepEqual(validateExactPriceMapping({ state: 'REJECTED' }), { eligible: false, reason: 'REJECTED_MAPPING' });
});

test('[TEST-091] freshness respects observation age, validity, future dates, and invalid thresholds', () => {
  assert.equal(classifyPriceFreshness({ asOf: AS_OF, observedTo: new Date('2026-08-31Z'), maxAgeDays: 45 }), 'CURRENT');
  assert.equal(classifyPriceFreshness({ asOf: AS_OF, observedTo: new Date('2026-06-01Z'), maxAgeDays: 45 }), 'STALE');
  assert.equal(classifyPriceFreshness({
    asOf: AS_OF,
    observedTo: new Date('2026-08-31Z'),
    validUntil: new Date('2026-09-01Z'),
    maxAgeDays: 45,
  }), 'STALE');
  assert.equal(classifyPriceFreshness({
    asOf: AS_OF,
    observedTo: new Date('2026-08-31Z'),
    validFrom: new Date('2026-09-07Z'),
    maxAgeDays: 45,
  }), 'FUTURE');
  assert.equal(classifyPriceFreshness({ asOf: AS_OF, observedTo: new Date('2026-09-07Z'), maxAgeDays: 45 }), 'FUTURE');
  assert.equal(classifyPriceFreshness({ asOf: AS_OF, observedTo: new Date('invalid'), maxAgeDays: -1 }), 'INVALID');
});

test('[TEST-092] locality and freshness precede an explicit source order without fabricating a merged point price', () => {
  const selected = selectPriceObservation([
    observation({ id: 'national-psa', localityMatch: 'NATIONAL', amountMinCentavos: 4_000, amountMaxCentavos: 4_000 }),
    observation({
      id: 'exact-da',
      sourceCode: 'DA_BANTAY_PRESYO_NCR',
      sourceObservationKey: 'da|ncr|rice|2026-08-30',
      amountMinCentavos: 5_000,
      amountMaxCentavos: 5_500,
    }),
  ], selectionOptions);
  assert.equal(selected.status, 'SELECTED');
  if (selected.status === 'SELECTED') {
    assert.equal(selected.observation.id, 'exact-da');
    assert.equal(selected.confidence, 'HIGH');
    assert.deepEqual(selected.competingObservationIds, ['national-psa']);
    assert.deepEqual([selected.observation.amountMinCentavos, selected.observation.amountMaxCentavos], [5_000, 5_500]);
  }
});

test('[TEST-092] stale observations remain labeled low-confidence evidence', () => {
  const selected = selectPriceObservation([
    observation({ observedTo: new Date('2026-01-01T00:00:00.000Z') }),
  ], selectionOptions);
  assert.equal(selected.status, 'SELECTED');
  if (selected.status === 'SELECTED') {
    assert.equal(selected.freshness, 'STALE');
    assert.equal(selected.confidence, 'LOW');
  }
});

test('[TEST-092] unknown and mismatched locality cannot produce an estimate', () => {
  for (const localityMatch of ['UNKNOWN', 'MISMATCH'] as const) {
    const selected = selectPriceObservation([observation({ localityMatch })], selectionOptions);
    assert.equal(selected.status, 'UNAVAILABLE');
  }
});

test('[TEST-092] conflicting duplicate observations are quarantined', () => {
  const selected = selectPriceObservation([
    observation({ id: 'duplicate-a', amountMinCentavos: 5_000, amountMaxCentavos: 5_000 }),
    observation({ id: 'duplicate-b', amountMinCentavos: 7_000, amountMaxCentavos: 7_000 }),
  ], selectionOptions);
  assert.deepEqual(selected, { status: 'UNAVAILABLE', reasons: ['DUPLICATE_OBSERVATION_CONFLICT'] });
});

test('[TEST-092] a superseding observation excludes the older row', () => {
  const selected = selectPriceObservation([
    observation({ id: 'old', observedTo: new Date('2026-08-01Z') }),
    observation({
      id: 'replacement',
      sourceObservationKey: 'replacement-key',
      amountMinCentavos: 5_500,
      amountMaxCentavos: 5_500,
      supersedesObservationId: 'old',
    }),
  ], selectionOptions);
  assert.equal(selected.status, 'SELECTED');
  if (selected.status === 'SELECTED') assert.equal(selected.observation.id, 'replacement');
});

test('[TEST-093] ingredient estimates preserve source ranges and round outward in centavos', () => {
  const estimate = estimateIngredientPrice({
    ingredientId: 'rice',
    ingredientName: 'Rice, well-milled, boiled',
    foodItemId: 'fnri-a020',
    quantity: 125,
    unit: 'g',
    mapping: { commodityId: 'commodity-rice', state: 'EXACT', foodItemId: 'fnri-a020', evidenceReference: 'review:a020' },
    observations: [observation()],
  }, selectionOptions);
  assert.equal(estimate.status, 'AVAILABLE');
  if (estimate.status === 'AVAILABLE') {
    assert.equal(estimate.amountMinCentavos, 625);
    assert.equal(estimate.amountMaxCentavos, 750);
    assert.equal(estimate.confidence, 'HIGH');
  }
});

test('[TEST-093] missing mapping, quantity, unit normalization, and package basis remain unavailable', () => {
  const base = {
    ingredientId: 'ingredient',
    ingredientName: 'Ingredient',
    foodItemId: 'fnri-id',
    quantity: 100,
    unit: 'g',
    mapping: { commodityId: 'commodity-rice', state: 'EXACT' as const, foodItemId: 'fnri-id', evidenceReference: 'review:id' },
    observations: [observation()],
  };
  assert.deepEqual(estimateIngredientPrice({ ...base, mapping: { state: 'UNMAPPED' } }, selectionOptions).status, 'UNAVAILABLE');
  assert.deepEqual(estimateIngredientPrice({ ...base, quantity: 0 }, selectionOptions).status, 'UNAVAILABLE');
  assert.deepEqual(estimateIngredientPrice({ ...base, unit: null }, selectionOptions).status, 'UNAVAILABLE');
  assert.deepEqual(estimateIngredientPrice({ ...base, foodItemId: 'different-fnri-id' }, selectionOptions), {
    ingredientId: 'ingredient',
    ingredientName: 'Ingredient',
    status: 'UNAVAILABLE',
    confidence: 'NONE',
    reasons: ['MAPPING_FOOD_MISMATCH'],
  });
  assert.deepEqual(estimateIngredientPrice({
    ...base,
    observations: [observation({ commodityId: 'different-commodity' })],
  }, selectionOptions).status, 'UNAVAILABLE');
  assert.deepEqual(estimateIngredientPrice({
    ...base,
    unit: 'package',
    observations: [observation({ normalizedUnit: 'KILOGRAM' })],
  }, selectionOptions).status, 'UNAVAILABLE');
  assert.deepEqual(estimateIngredientPrice({
    ...base,
    observations: [observation({ normalizedQuantity: null, normalizedUnit: null })],
  }, selectionOptions).status, 'UNAVAILABLE');
});

test('[TEST-094] meal, plan, and grocery totals expose partial coverage and missing-price lists', () => {
  const known = estimateIngredientPrice({
    ingredientId: 'known',
    ingredientName: 'Known ingredient',
    foodItemId: 'fnri-known',
    quantity: 100,
    unit: 'g',
    mapping: { commodityId: 'commodity-rice', state: 'EXACT', foodItemId: 'fnri-known', evidenceReference: 'review:known' },
    observations: [observation()],
  }, selectionOptions);
  const missing = estimateIngredientPrice({
    ingredientId: 'missing',
    ingredientName: 'Missing ingredient',
    foodItemId: null,
    quantity: 1,
    unit: 'piece',
    mapping: { state: 'UNMAPPED' },
    observations: [],
  }, selectionOptions);

  for (const aggregate of [aggregateMealPrice([known, missing]), aggregatePlanPrice([known, missing]), aggregateGroceryPrice([known, missing])]) {
    assert.equal(aggregate.status, 'PARTIAL');
    assert.equal(aggregate.amountMinCentavos, 500);
    assert.equal(aggregate.amountMaxCentavos, 600);
    assert.equal(aggregate.knownCostCoveragePercent, 50);
    assert.equal(aggregate.confidence, 'LOW');
    assert.deepEqual(aggregate.missingPrices, [{
      ingredientId: 'missing',
      ingredientName: 'Missing ingredient',
      reasons: ['UNMAPPED'],
    }]);
  }
});

test('[TEST-094] empty or wholly unknown collections never look like zero-cost meals', () => {
  const empty = aggregateMealPrice([]);
  assert.equal(empty.status, 'UNAVAILABLE');
  assert.equal(empty.amountMinCentavos, null);
  assert.equal(empty.amountMaxCentavos, null);
  assert.equal(empty.knownCostCoveragePercent, 0);
  assert.equal(empty.confidence, 'NONE');
});

test('[TEST-094] blocked or review-required meals cannot win a budget ranking', () => {
  const completeCheap = {
    status: 'COMPLETE' as const,
    amountMinCentavos: 100,
    amountMaxCentavos: 100,
    knownItemCount: 1,
    totalItemCount: 1,
    knownCostCoveragePercent: 100,
    confidence: 'HIGH' as const,
    missingPrices: [],
  };
  const completeSafe = { ...completeCheap, amountMinCentavos: 900, amountMaxCentavos: 1_000 };
  const partial = { ...completeCheap, status: 'PARTIAL' as const, amountMinCentavos: 50, amountMaxCentavos: 50, confidence: 'LOW' as const };
  const ranked = rankClinicallyCompatibleMeals([
    { id: 'unsafe-cheapest', clinicalCompatibility: 'BLOCK', cost: completeCheap },
    { id: 'review-cheapest', clinicalCompatibility: 'REVIEW', cost: completeCheap },
    { id: 'safe-partial', clinicalCompatibility: 'ALLOW', cost: partial },
    { id: 'safe-complete', clinicalCompatibility: 'ALLOW', cost: completeSafe },
  ]);
  assert.deepEqual(ranked.map((item) => item.id), ['safe-complete', 'safe-partial']);
});
