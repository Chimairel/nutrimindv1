export type ConversionBasis = 'PURCHASED_AS_SOLD' | 'RAW_EDIBLE' | 'COOKED_EDIBLE';
export type ConversionUnit =
  'MILLIGRAM' | 'GRAM' | 'KILOGRAM' | 'MILLILITER' | 'LITER' | 'TEASPOON' | 'TABLESPOON' | 'CUP' | 'PIECE';
export type ConversionKind =
  'PURCHASED_TO_RAW_YIELD' | 'RAW_TO_COOKED_YIELD' | 'PURCHASED_TO_COOKED_YIELD' | 'HOUSEHOLD_MEASURE_TO_MASS';
export type ClinicalCompatibility = 'ALLOW' | 'REVIEW' | 'BLOCK';

export interface RationalInput {
  numerator: number;
  denominator: number;
}
interface Rational {
  numerator: bigint;
  denominator: bigint;
}

export interface ConversionNode {
  basis: ConversionBasis;
  unit: ConversionUnit;
  foodIdentity: string;
  preparationCode: string;
  foodItemId?: string | null;
  priceCommodityId?: string | null;
}

export interface ConversionEvidenceCandidate {
  id: string;
  sourceCode: string;
  externalEvidenceKey: string;
  evidenceVersion: string;
  kind: ConversionKind;
  direction: 'FORWARD_ONLY' | 'BIDIRECTIONAL';
  from: ConversionNode;
  to: ConversionNode;
  factorMin: RationalInput;
  factorMax: RationalInput;
  reviewStatus: 'DRAFT' | 'REVIEWED' | 'REJECTED';
  effectiveFrom?: Date | null;
  effectiveUntil?: Date | null;
  supersedesEvidenceId?: string | null;
}

export type ConversionReasonCode =
  | 'CLINICAL_EXCLUDED'
  | 'NO_CONVERSION_EVIDENCE'
  | 'EVIDENCE_NOT_REVIEWED'
  | 'EVIDENCE_REJECTED'
  | 'EVIDENCE_NOT_YET_EFFECTIVE'
  | 'STALE_EVIDENCE'
  | 'INVALID_EFFECTIVE_PERIOD'
  | 'SUPERSEDED_EVIDENCE'
  | 'INVALID_FACTOR'
  | 'IMPLAUSIBLE_FACTOR'
  | 'INCOMPATIBLE_BASIS_OR_UNIT'
  | 'MISSING_EXACT_IDENTITY'
  | 'IDENTITY_OR_PREPARATION_MISMATCH'
  | 'UNAUTHORIZED_REVERSE'
  | 'CYCLE_DETECTED'
  | 'DOUBLE_APPLICATION'
  | 'AMBIGUOUS_CONVERSION_CHAIN'
  | 'DUPLICATE_EVIDENCE_CONFLICT'
  | 'UNSAFE_ARITHMETIC';

export type ConversionEvaluation =
  | {
      status: 'AVAILABLE';
      coverage: 'COMPLETE';
      confidence: 'HIGH' | 'MEDIUM';
      factorMin: RationalInput;
      factorMax: RationalInput;
      evidenceIds: string[];
      reasons: [];
    }
  | {
      status: 'UNAVAILABLE';
      coverage: 'UNAVAILABLE';
      confidence: 'NONE';
      evidenceIds: [];
      reasons: ConversionReasonCode[];
    };

const MAX_FACTOR_COMPONENT = 1_000_000_000;
const MASS_SCALE: Partial<Record<ConversionUnit, bigint>> = {
  MILLIGRAM: 1n,
  GRAM: 1_000n,
  KILOGRAM: 1_000_000n,
};
const VOLUME_SCALE: Partial<Record<ConversionUnit, bigint>> = {
  MILLILITER: 1n,
  LITER: 1_000n,
};

function gcd(a: bigint, b: bigint): bigint {
  let left = a < 0n ? -a : a;
  let right = b < 0n ? -b : b;
  while (right !== 0n) [left, right] = [right, left % right];
  return left;
}

function rational(numerator: bigint, denominator: bigint): Rational {
  if (numerator <= 0n || denominator <= 0n) throw new Error('positive rational required');
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function fromInput(value: RationalInput): Rational | null {
  if (
    !Number.isSafeInteger(value.numerator) ||
    !Number.isSafeInteger(value.denominator) ||
    value.numerator <= 0 ||
    value.denominator <= 0 ||
    value.numerator > MAX_FACTOR_COMPONENT ||
    value.denominator > MAX_FACTOR_COMPONENT
  )
    return null;
  return rational(BigInt(value.numerator), BigInt(value.denominator));
}

function multiply(left: Rational, right: Rational): Rational {
  return rational(left.numerator * right.numerator, left.denominator * right.denominator);
}

function invert(value: Rational): Rational {
  return rational(value.denominator, value.numerator);
}

function compare(left: Rational, right: Rational): number {
  const delta = left.numerator * right.denominator - right.numerator * left.denominator;
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
}

function toOutput(value: Rational): RationalInput {
  if (value.numerator > BigInt(Number.MAX_SAFE_INTEGER) || value.denominator > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('unsafe rational output');
  }
  return { numerator: Number(value.numerator), denominator: Number(value.denominator) };
}

function nodeIdentity(node: ConversionNode): string {
  return [
    node.basis,
    node.foodIdentity.trim(),
    node.preparationCode.trim(),
    node.foodItemId ?? '',
    node.priceCommodityId ?? '',
  ].join('|');
}

function nodeKey(node: ConversionNode): string {
  return `${nodeIdentity(node)}|${node.unit}`;
}

function unitFactor(from: ConversionUnit, to: ConversionUnit): Rational | null {
  if (from === to) return rational(1n, 1n);
  const massFrom = MASS_SCALE[from];
  const massTo = MASS_SCALE[to];
  if (massFrom && massTo) return rational(massFrom, massTo);
  const volumeFrom = VOLUME_SCALE[from];
  const volumeTo = VOLUME_SCALE[to];
  if (volumeFrom && volumeTo) return rational(volumeFrom, volumeTo);
  return null;
}

function nodesCompatible(actual: ConversionNode, expected: ConversionNode): Rational | null {
  if (nodeIdentity(actual) !== nodeIdentity(expected)) return null;
  return unitFactor(actual.unit, expected.unit);
}

function expectedKind(from: ConversionNode, to: ConversionNode, kind: ConversionKind): boolean {
  const mass = (unit: ConversionUnit) => MASS_SCALE[unit] !== undefined;
  if (kind === 'PURCHASED_TO_RAW_YIELD') {
    return from.basis === 'PURCHASED_AS_SOLD' && to.basis === 'RAW_EDIBLE' && mass(from.unit) && mass(to.unit);
  }
  if (kind === 'RAW_TO_COOKED_YIELD') {
    return from.basis === 'RAW_EDIBLE' && to.basis === 'COOKED_EDIBLE' && mass(from.unit) && mass(to.unit);
  }
  if (kind === 'PURCHASED_TO_COOKED_YIELD') {
    return from.basis === 'PURCHASED_AS_SOLD' && to.basis === 'COOKED_EDIBLE' && mass(from.unit) && mass(to.unit);
  }
  return from.basis === to.basis && !mass(from.unit) && mass(to.unit);
}

function hasExactIdentity(node: ConversionNode): boolean {
  if (!node.foodIdentity.trim() || !node.preparationCode.trim()) return false;
  if (node.basis === 'PURCHASED_AS_SOLD') return Boolean(node.priceCommodityId?.trim());
  return Boolean(node.foodItemId?.trim());
}

function canonicalCandidate(candidate: ConversionEvidenceCandidate): string {
  const dateText = (value: Date | null | undefined) =>
    value && Number.isFinite(value.getTime()) ? value.toISOString() : value ? 'INVALID_DATE' : null;
  return JSON.stringify({
    ...candidate,
    effectiveFrom: dateText(candidate.effectiveFrom),
    effectiveUntil: dateText(candidate.effectiveUntil),
  });
}

function validateCandidate(candidate: ConversionEvidenceCandidate): ConversionReasonCode | null {
  const min = fromInput(candidate.factorMin);
  const max = fromInput(candidate.factorMax);
  if (!min || !max || compare(min, max) > 0) return 'INVALID_FACTOR';
  if (!expectedKind(candidate.from, candidate.to, candidate.kind)) return 'INCOMPATIBLE_BASIS_OR_UNIT';
  if (!hasExactIdentity(candidate.from) || !hasExactIdentity(candidate.to)) return 'MISSING_EXACT_IDENTITY';
  const minValue = Number(min.numerator) / Number(min.denominator);
  const maxValue = Number(max.numerator) / Number(max.denominator);
  if (candidate.kind === 'PURCHASED_TO_RAW_YIELD' && maxValue > 1) return 'IMPLAUSIBLE_FACTOR';
  if (
    (candidate.kind === 'RAW_TO_COOKED_YIELD' || candidate.kind === 'PURCHASED_TO_COOKED_YIELD') &&
    (minValue < 0.05 || maxValue > 10)
  )
    return 'IMPLAUSIBLE_FACTOR';
  if (candidate.kind === 'HOUSEHOLD_MEASURE_TO_MASS' && (minValue < 0.001 || maxValue > 5_000_000)) {
    return 'IMPLAUSIBLE_FACTOR';
  }
  return null;
}

interface Edge {
  evidenceId: string;
  from: ConversionNode;
  to: ConversionNode;
  min: Rational;
  max: Rational;
}

export function evaluateConversionChain(input: {
  clinicalCompatibility: ClinicalCompatibility;
  from: ConversionNode;
  to: ConversionNode;
  evidence: readonly ConversionEvidenceCandidate[];
  asOf: Date;
  maxEdges?: number;
}): ConversionEvaluation {
  if (input.clinicalCompatibility !== 'ALLOW') {
    return {
      status: 'UNAVAILABLE',
      coverage: 'UNAVAILABLE',
      confidence: 'NONE',
      evidenceIds: [],
      reasons: ['CLINICAL_EXCLUDED'],
    };
  }
  if (!Number.isFinite(input.asOf.getTime())) {
    return {
      status: 'UNAVAILABLE',
      coverage: 'UNAVAILABLE',
      confidence: 'NONE',
      evidenceIds: [],
      reasons: ['UNSAFE_ARITHMETIC'],
    };
  }
  const direct = nodesCompatible(input.from, input.to);
  if (direct) {
    try {
      return {
        status: 'AVAILABLE',
        coverage: 'COMPLETE',
        confidence: 'HIGH',
        factorMin: toOutput(direct),
        factorMax: toOutput(direct),
        evidenceIds: [],
        reasons: [],
      };
    } catch {
      return {
        status: 'UNAVAILABLE',
        coverage: 'UNAVAILABLE',
        confidence: 'NONE',
        evidenceIds: [],
        reasons: ['UNSAFE_ARITHMETIC'],
      };
    }
  }

  const reasons = new Set<ConversionReasonCode>();
  const duplicates = new Map<string, string>();
  const conflictingIds = new Set<string>();
  for (const candidate of input.evidence) {
    const canonical = canonicalCandidate(candidate);
    const previous = duplicates.get(candidate.id);
    if (previous && previous !== canonical) conflictingIds.add(candidate.id);
    else duplicates.set(candidate.id, canonical);
  }
  if (conflictingIds.size > 0) reasons.add('DUPLICATE_EVIDENCE_CONFLICT');

  const supersededIds = new Set(
    input.evidence.flatMap((item) => (item.supersedesEvidenceId ? [item.supersedesEvidenceId] : []))
  );
  const edges: Edge[] = [];
  const included = new Set<string>();
  for (const candidate of input.evidence) {
    if (included.has(candidate.id) || conflictingIds.has(candidate.id)) continue;
    included.add(candidate.id);
    if (supersededIds.has(candidate.id)) {
      reasons.add('SUPERSEDED_EVIDENCE');
      continue;
    }
    if (candidate.reviewStatus === 'DRAFT') {
      reasons.add('EVIDENCE_NOT_REVIEWED');
      continue;
    }
    if (candidate.reviewStatus === 'REJECTED') {
      reasons.add('EVIDENCE_REJECTED');
      continue;
    }
    if (
      (candidate.effectiveFrom && !Number.isFinite(candidate.effectiveFrom.getTime())) ||
      (candidate.effectiveUntil && !Number.isFinite(candidate.effectiveUntil.getTime())) ||
      (candidate.effectiveFrom && candidate.effectiveUntil && candidate.effectiveFrom > candidate.effectiveUntil)
    ) {
      reasons.add('INVALID_EFFECTIVE_PERIOD');
      continue;
    }
    if (candidate.effectiveFrom && candidate.effectiveFrom.getTime() > input.asOf.getTime()) {
      reasons.add('EVIDENCE_NOT_YET_EFFECTIVE');
      continue;
    }
    if (candidate.effectiveUntil && candidate.effectiveUntil.getTime() < input.asOf.getTime()) {
      reasons.add('STALE_EVIDENCE');
      continue;
    }
    const invalid = validateCandidate(candidate);
    if (invalid) {
      reasons.add(invalid);
      continue;
    }
    const min = fromInput(candidate.factorMin) as Rational;
    const max = fromInput(candidate.factorMax) as Rational;
    const basisUnitScale =
      candidate.kind === 'HOUSEHOLD_MEASURE_TO_MASS'
        ? rational(1n, 1n)
        : (unitFactor(candidate.from.unit, candidate.to.unit) as Rational);
    const scaledMin = multiply(basisUnitScale, min);
    const scaledMax = multiply(basisUnitScale, max);
    edges.push({ evidenceId: candidate.id, from: candidate.from, to: candidate.to, min: scaledMin, max: scaledMax });
    if (candidate.direction === 'BIDIRECTIONAL') {
      edges.push({
        evidenceId: candidate.id,
        from: candidate.to,
        to: candidate.from,
        min: invert(scaledMax),
        max: invert(scaledMin),
      });
    } else if (nodesCompatible(input.from, candidate.to) || nodesCompatible(input.to, candidate.from)) {
      reasons.add('UNAUTHORIZED_REVERSE');
    }
  }

  type Path = { node: ConversionNode; min: Rational; max: Rational; ids: string[]; visited: Set<string> };
  const queue: Path[] = [
    {
      node: input.from,
      min: rational(1n, 1n),
      max: rational(1n, 1n),
      ids: [],
      visited: new Set([nodeKey(input.from)]),
    },
  ];
  const paths: Array<{ min: Rational; max: Rational; ids: string[] }> = [];
  const maxEdges = Math.max(1, Math.min(input.maxEdges ?? 4, 8));
  while (queue.length > 0) {
    const path = queue.shift() as Path;
    const finalUnit = nodesCompatible(path.node, input.to);
    if (finalUnit) {
      paths.push({ min: multiply(path.min, finalUnit), max: multiply(path.max, finalUnit), ids: path.ids });
      continue;
    }
    if (path.ids.length >= maxEdges) continue;
    for (const edge of edges) {
      const entryUnit = nodesCompatible(path.node, edge.from);
      if (!entryUnit) continue;
      if (path.ids.includes(edge.evidenceId)) {
        reasons.add('DOUBLE_APPLICATION');
        continue;
      }
      const destinationKey = nodeKey(edge.to);
      if (path.visited.has(destinationKey)) {
        reasons.add('CYCLE_DETECTED');
        continue;
      }
      queue.push({
        node: edge.to,
        min: multiply(multiply(path.min, entryUnit), edge.min),
        max: multiply(multiply(path.max, entryUnit), edge.max),
        ids: [...path.ids, edge.evidenceId],
        visited: new Set([...path.visited, destinationKey]),
      });
    }
  }

  const uniquePaths = new Map(paths.map((path) => [path.ids.join('>'), path]));
  if (uniquePaths.size > 1) {
    return {
      status: 'UNAVAILABLE',
      coverage: 'UNAVAILABLE',
      confidence: 'NONE',
      evidenceIds: [],
      reasons: ['AMBIGUOUS_CONVERSION_CHAIN'],
    };
  }
  if (uniquePaths.size === 0) {
    if (edges.length === 0 && reasons.size === 0) reasons.add('NO_CONVERSION_EVIDENCE');
    else if (reasons.size === 0) reasons.add('IDENTITY_OR_PREPARATION_MISMATCH');
    return {
      status: 'UNAVAILABLE',
      coverage: 'UNAVAILABLE',
      confidence: 'NONE',
      evidenceIds: [],
      reasons: [...reasons].sort(),
    };
  }
  const path = [...uniquePaths.values()][0];
  try {
    const ranged = compare(path.min, path.max) !== 0;
    return {
      status: 'AVAILABLE',
      coverage: 'COMPLETE',
      confidence: ranged || path.ids.length > 1 ? 'MEDIUM' : 'HIGH',
      factorMin: toOutput(path.min),
      factorMax: toOutput(path.max),
      evidenceIds: path.ids,
      reasons: [],
    };
  } catch {
    return {
      status: 'UNAVAILABLE',
      coverage: 'UNAVAILABLE',
      confidence: 'NONE',
      evidenceIds: [],
      reasons: ['UNSAFE_ARITHMETIC'],
    };
  }
}

function floorRatio(numerator: bigint, denominator: bigint): bigint {
  return numerator / denominator;
}
function ceilRatio(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

export type ConservativeCost =
  | {
      status: 'AVAILABLE';
      amountMinCentavos: number;
      amountMaxCentavos: number;
      confidence: 'HIGH' | 'MEDIUM';
      evidenceIds: string[];
    }
  | { status: 'UNAVAILABLE'; reasons: ConversionReasonCode[] };

export function estimateConservativeConvertedCost(input: {
  targetQuantity: number;
  priceAmountMinCentavos: number;
  priceAmountMaxCentavos: number;
  pricePurchasedQuantity: number;
  conversion: ConversionEvaluation;
}): ConservativeCost {
  const integers = [
    input.targetQuantity,
    input.priceAmountMinCentavos,
    input.priceAmountMaxCentavos,
    input.pricePurchasedQuantity,
  ];
  if (input.conversion.status !== 'AVAILABLE') return { status: 'UNAVAILABLE', reasons: input.conversion.reasons };
  if (
    integers.some((value) => !Number.isSafeInteger(value) || value <= 0) ||
    input.priceAmountMinCentavos > input.priceAmountMaxCentavos
  ) {
    return { status: 'UNAVAILABLE', reasons: ['UNSAFE_ARITHMETIC'] };
  }
  try {
    const target = BigInt(input.targetQuantity);
    const priceBasis = BigInt(input.pricePurchasedQuantity);
    const minFactor = fromInput(input.conversion.factorMin) as Rational;
    const maxFactor = fromInput(input.conversion.factorMax) as Rational;
    const minCost = floorRatio(
      BigInt(input.priceAmountMinCentavos) * target * maxFactor.denominator,
      priceBasis * maxFactor.numerator
    );
    const maxCost = ceilRatio(
      BigInt(input.priceAmountMaxCentavos) * target * minFactor.denominator,
      priceBasis * minFactor.numerator
    );
    if (minCost < 0n || maxCost < minCost || maxCost > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('unsafe cost');
    return {
      status: 'AVAILABLE',
      amountMinCentavos: Number(minCost),
      amountMaxCentavos: Number(maxCost),
      confidence: input.conversion.confidence,
      evidenceIds: input.conversion.evidenceIds,
    };
  } catch {
    return { status: 'UNAVAILABLE', reasons: ['UNSAFE_ARITHMETIC'] };
  }
}
