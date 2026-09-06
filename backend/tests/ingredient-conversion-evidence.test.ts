import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import {
  ConversionEvidenceCandidate,
  ConversionNode,
  estimateConservativeConvertedCost,
  evaluateConversionChain,
} from '../src/domain/ingredient-conversion-evidence.policy';
import {
  buildIngredientConversionCoverageReport,
  ingredientConversionSourceReviewSchema,
  loadIngredientConversionSourceReview,
} from '../src/domain/ingredient-conversion-source-review';
import { loadPsaOpenStatSnapshot } from '../src/domain/psa-openstat-price-ingestion';

const AS_OF = new Date('2026-09-06T00:00:00.000Z');
const purchased: ConversionNode = {
  basis: 'PURCHASED_AS_SOLD',
  unit: 'KILOGRAM',
  foodIdentity: 'Carrot, 1 KG',
  preparationCode: 'FRESH_WHOLE_AS_SOLD',
  priceCommodityId: 'psa-carrot',
};
const raw: ConversionNode = {
  basis: 'RAW_EDIBLE',
  unit: 'GRAM',
  foodIdentity: 'Carrot',
  preparationCode: 'TRIMMED_PEELED',
  foodItemId: 'fnri-carrot-raw',
};
const cooked: ConversionNode = {
  basis: 'COOKED_EDIBLE',
  unit: 'GRAM',
  foodIdentity: 'Carrot, boiled',
  preparationCode: 'BOILED_DRAINED',
  foodItemId: 'fnri-carrot-boiled',
};

function evidence(overrides: Partial<ConversionEvidenceCandidate> = {}): ConversionEvidenceCandidate {
  return {
    id: 'ap-raw',
    sourceCode: 'SYNTHETIC_TEST',
    externalEvidenceKey: 'carrot-ap-raw',
    evidenceVersion: '1',
    kind: 'PURCHASED_TO_RAW_YIELD',
    direction: 'FORWARD_ONLY',
    from: purchased,
    to: raw,
    factorMin: { numerator: 4, denominator: 5 },
    factorMax: { numerator: 4, denominator: 5 },
    reviewStatus: 'REVIEWED',
    effectiveFrom: new Date('2026-01-01Z'),
    ...overrides,
  };
}

const rawCooked = (): ConversionEvidenceCandidate =>
  evidence({
    id: 'raw-cooked',
    externalEvidenceKey: 'carrot-raw-cooked',
    kind: 'RAW_TO_COOKED_YIELD',
    from: raw,
    to: cooked,
    factorMin: { numerator: 9, denominator: 10 },
    factorMax: { numerator: 9, denominator: 10 },
  });

test('[TEST-130] reviewed exact evidence composes rational AP-to-raw and raw-to-cooked factors', () => {
  const result = evaluateConversionChain({
    clinicalCompatibility: 'ALLOW',
    from: purchased,
    to: cooked,
    evidence: [evidence(), rawCooked()],
    asOf: AS_OF,
  });
  assert.deepEqual(result, {
    status: 'AVAILABLE',
    coverage: 'COMPLETE',
    confidence: 'MEDIUM',
    factorMin: { numerator: 720, denominator: 1 },
    factorMax: { numerator: 720, denominator: 1 },
    evidenceIds: ['ap-raw', 'raw-cooked'],
    reasons: [],
  });
});

test('[TEST-130] clinical exclusion happens before malformed conversion evidence is inspected', () => {
  const malformed = evidence({ factorMin: { numerator: 0, denominator: 0 } });
  const result = evaluateConversionChain({
    clinicalCompatibility: 'BLOCK',
    from: purchased,
    to: cooked,
    evidence: [malformed],
    asOf: AS_OF,
  });
  assert.deepEqual(result, {
    status: 'UNAVAILABLE',
    coverage: 'UNAVAILABLE',
    confidence: 'NONE',
    evidenceIds: [],
    reasons: ['CLINICAL_EXCLUDED'],
  });
});

test('[TEST-130] zero, negative, inverted, and implausible factors fail closed', () => {
  for (const bad of [
    evidence({ factorMin: { numerator: 0, denominator: 1 } }),
    evidence({ factorMin: { numerator: -1, denominator: 1 } }),
    evidence({ factorMin: { numerator: 9, denominator: 10 }, factorMax: { numerator: 8, denominator: 10 } }),
    evidence({ factorMin: { numerator: 6, denominator: 5 }, factorMax: { numerator: 6, denominator: 5 } }),
  ]) {
    const result = evaluateConversionChain({
      clinicalCompatibility: 'ALLOW',
      from: purchased,
      to: raw,
      evidence: [bad],
      asOf: AS_OF,
    });
    assert.equal(result.status, 'UNAVAILABLE');
    if (result.status === 'UNAVAILABLE')
      assert.ok(
        result.reasons.includes(
          bad.factorMin.numerator <= 0 ||
            bad.factorMin.denominator <= 0 ||
            bad.factorMin.numerator / bad.factorMin.denominator > bad.factorMax.numerator / bad.factorMax.denominator
            ? 'INVALID_FACTOR'
            : 'IMPLAUSIBLE_FACTOR'
        )
      );
  }
});

test('[TEST-131] basis, identity, preparation, and units must match exactly', () => {
  const mismatchTargets = [
    { ...cooked, foodIdentity: 'Potato, boiled' },
    { ...cooked, preparationCode: 'STEAMED' },
    { ...cooked, foodItemId: 'fnri-other' },
    { ...cooked, unit: 'CUP' as const },
  ];
  for (const target of mismatchTargets) {
    const result = evaluateConversionChain({
      clinicalCompatibility: 'ALLOW',
      from: purchased,
      to: target,
      evidence: [evidence(), rawCooked()],
      asOf: AS_OF,
    });
    assert.equal(result.status, 'UNAVAILABLE');
  }
});

test('[TEST-131] reverse traversal is unavailable unless the reviewed source explicitly authorizes it', () => {
  const denied = evaluateConversionChain({
    clinicalCompatibility: 'ALLOW',
    from: raw,
    to: purchased,
    evidence: [evidence()],
    asOf: AS_OF,
  });
  assert.equal(denied.status, 'UNAVAILABLE');
  if (denied.status === 'UNAVAILABLE') assert.ok(denied.reasons.includes('UNAUTHORIZED_REVERSE'));
  const allowed = evaluateConversionChain({
    clinicalCompatibility: 'ALLOW',
    from: raw,
    to: purchased,
    evidence: [evidence({ direction: 'BIDIRECTIONAL' })],
    asOf: AS_OF,
  });
  assert.equal(allowed.status, 'AVAILABLE');
  if (allowed.status === 'AVAILABLE') assert.deepEqual(allowed.factorMin, { numerator: 1, denominator: 800 });
});

test('[TEST-131] draft, rejected, future, stale, and superseded evidence cannot be used', () => {
  const cases: Array<[ConversionEvidenceCandidate[], string]> = [
    [[evidence({ reviewStatus: 'DRAFT' })], 'EVIDENCE_NOT_REVIEWED'],
    [[evidence({ reviewStatus: 'REJECTED' })], 'EVIDENCE_REJECTED'],
    [[evidence({ effectiveFrom: new Date('2026-09-07Z') })], 'EVIDENCE_NOT_YET_EFFECTIVE'],
    [[evidence({ effectiveUntil: new Date('2026-09-05Z') })], 'STALE_EVIDENCE'],
    [
      [
        evidence({ id: 'old' }),
        evidence({ id: 'new', externalEvidenceKey: 'replacement', supersedesEvidenceId: 'old' }),
      ],
      'SUPERSEDED_EVIDENCE',
    ],
  ];
  for (const [items, reason] of cases) {
    const result = evaluateConversionChain({
      clinicalCompatibility: 'ALLOW',
      from: purchased,
      to: raw,
      evidence: items,
      asOf: AS_OF,
    });
    if (reason === 'SUPERSEDED_EVIDENCE') {
      assert.equal(result.status, 'AVAILABLE');
    } else {
      assert.equal(result.status, 'UNAVAILABLE');
      if (result.status === 'UNAVAILABLE') assert.ok(result.reasons.includes(reason as never));
    }
  }
});

test('[TEST-131] conflicting duplicates, multiple chains, cycles, and double application are detected', () => {
  const duplicate = evaluateConversionChain({
    clinicalCompatibility: 'ALLOW',
    from: purchased,
    to: raw,
    asOf: AS_OF,
    evidence: [
      evidence(),
      evidence({ factorMin: { numerator: 3, denominator: 4 }, factorMax: { numerator: 3, denominator: 4 } }),
    ],
  });
  assert.equal(duplicate.status, 'UNAVAILABLE');
  if (duplicate.status === 'UNAVAILABLE') assert.ok(duplicate.reasons.includes('DUPLICATE_EVIDENCE_CONFLICT'));

  const ambiguous = evaluateConversionChain({
    clinicalCompatibility: 'ALLOW',
    from: purchased,
    to: raw,
    asOf: AS_OF,
    evidence: [evidence(), evidence({ id: 'other', externalEvidenceKey: 'other' })],
  });
  assert.equal(ambiguous.status, 'UNAVAILABLE');
  if (ambiguous.status === 'UNAVAILABLE') assert.deepEqual(ambiguous.reasons, ['AMBIGUOUS_CONVERSION_CHAIN']);

  const unreachable = { ...cooked, foodIdentity: 'No target', foodItemId: 'none' };
  const cyclic = evaluateConversionChain({
    clinicalCompatibility: 'ALLOW',
    from: purchased,
    to: unreachable,
    asOf: AS_OF,
    evidence: [
      evidence({ direction: 'BIDIRECTIONAL' }),
      evidence({ id: 'parallel', externalEvidenceKey: 'parallel', direction: 'BIDIRECTIONAL' }),
    ],
  });
  assert.equal(cyclic.status, 'UNAVAILABLE');
  if (cyclic.status === 'UNAVAILABLE') {
    assert.ok(cyclic.reasons.includes('CYCLE_DETECTED'));
    assert.ok(cyclic.reasons.includes('DOUBLE_APPLICATION'));
  }
});

test('[TEST-132] factor ranges propagate and conservative centavo rounding goes outward', () => {
  const conversion = evaluateConversionChain({
    clinicalCompatibility: 'ALLOW',
    from: purchased,
    to: raw,
    asOf: AS_OF,
    evidence: [evidence({ factorMin: { numerator: 7, denominator: 10 }, factorMax: { numerator: 4, denominator: 5 } })],
  });
  assert.equal(conversion.status, 'AVAILABLE');
  if (conversion.status !== 'AVAILABLE') return;
  assert.deepEqual(
    [conversion.factorMin, conversion.factorMax],
    [
      { numerator: 700, denominator: 1 },
      { numerator: 800, denominator: 1 },
    ]
  );
  assert.deepEqual(
    estimateConservativeConvertedCost({
      targetQuantity: 101,
      priceAmountMinCentavos: 5_001,
      priceAmountMaxCentavos: 6_001,
      pricePurchasedQuantity: 1,
      conversion,
    }),
    {
      status: 'AVAILABLE',
      amountMinCentavos: 631,
      amountMaxCentavos: 866,
      confidence: 'MEDIUM',
      evidenceIds: ['ap-raw'],
    }
  );
});

test('[TEST-132] an exact household measure-to-mass row is food and preparation specific', () => {
  const cup: ConversionNode = { ...raw, unit: 'CUP', preparationCode: 'RAW_DICED' };
  const grams: ConversionNode = { ...raw, unit: 'GRAM', preparationCode: 'RAW_DICED' };
  const conversion = evaluateConversionChain({
    clinicalCompatibility: 'ALLOW',
    from: cup,
    to: grams,
    asOf: AS_OF,
    evidence: [
      evidence({
        id: 'cup-mass',
        externalEvidenceKey: 'carrot-cup-mass',
        kind: 'HOUSEHOLD_MEASURE_TO_MASS',
        from: cup,
        to: grams,
        factorMin: { numerator: 120, denominator: 1 },
        factorMax: { numerator: 130, denominator: 1 },
      }),
    ],
  });
  assert.equal(conversion.status, 'AVAILABLE');
  if (conversion.status === 'AVAILABLE') {
    assert.deepEqual(conversion.factorMin, { numerator: 120, denominator: 1 });
    assert.equal(conversion.confidence, 'MEDIUM');
  }
  assert.equal(
    evaluateConversionChain({
      clinicalCompatibility: 'ALLOW',
      from: { ...cup, preparationCode: 'RAW_SHREDDED' },
      to: grams,
      asOf: AS_OF,
      evidence: [],
    }).status,
    'UNAVAILABLE'
  );
});

test('[TEST-132] unsafe money or quantity arithmetic never produces a price', () => {
  const conversion = evaluateConversionChain({
    clinicalCompatibility: 'ALLOW',
    from: purchased,
    to: raw,
    evidence: [evidence()],
    asOf: AS_OF,
  });
  for (const targetQuantity of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.deepEqual(
      estimateConservativeConvertedCost({
        targetQuantity,
        priceAmountMinCentavos: 100,
        priceAmountMaxCentavos: 200,
        pricePurchasedQuantity: 1,
        conversion,
      }),
      {
        status: 'UNAVAILABLE',
        reasons: ['UNSAFE_ARITHMETIC'],
      }
    );
  }
});

test('[TEST-133] authoritative source review validates and intentionally contains no pilot factor rows', () => {
  const review = loadIngredientConversionSourceReview(
    resolve(process.cwd(), 'data/ingredient-conversion-evidence/source-review-2026-09-06.json')
  );
  assert.equal(review.sources.length, 5);
  assert.equal(review.pilotEvidence.length, 0);
  assert.equal(review.decision, 'METADATA_ONLY_NO_PILOT_FACTORS');
  assert.throws(() => ingredientConversionSourceReviewSchema.parse({ ...review, pilotEvidence: [{}] }));
});

test('[TEST-134] all 51 meals expose every missing price or conversion layer', () => {
  const snapshot = loadPsaOpenStatSnapshot(
    resolve(process.cwd(), 'data/psa-openstat/2026-09-06-cebu-city/manifest.json')
  );
  const review = loadIngredientConversionSourceReview(
    resolve(process.cwd(), 'data/ingredient-conversion-evidence/source-review-2026-09-06.json')
  );
  const report = buildIngredientConversionCoverageReport(snapshot, review, AS_OF);
  assert.equal(report.mealCount, 51);
  assert.equal(report.ingredientRowCount, 195);
  assert.deepEqual(report.layers.sourceBasket, { rows: 93, meals: 44 });
  assert.deepEqual(report.layers.exactFnriMapping, { rows: 86, meals: 43 });
  assert.deepEqual(report.layers.currentPrice, { rows: 80, meals: 43 });
  assert.deepEqual(report.layers.quantityAndUnit, { rows: 80, meals: 43 });
  assert.deepEqual(report.layers.sameIdentityWithoutBasisBridge, { rows: 43, meals: 35 });
  assert.deepEqual(report.layers.reviewedConversionEvidence, { rows: 0, meals: 0 });
  assert.deepEqual(report.layers.conversionUsable, { rows: 0, meals: 0 });
  assert.equal(report.meals.length, 51);
  assert.equal(
    report.meals.reduce((sum, meal) => sum + meal.missing.length, 0),
    195
  );
  assert.deepEqual(report.mealCoverage, { complete: 0, partial: 0, unpriced: 51 });
});
