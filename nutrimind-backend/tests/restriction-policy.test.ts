import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APPROVED_RESTRICTION_ALIASES,
  RESTRICTION_ALLERGY_KEYS,
  RESTRICTION_CONDITION_KEYS,
  RESTRICTION_REASON_CODE_ORDER,
  SCOPED_SAFE_EXPLANATION,
  evaluateRestrictions,
  normalizeRestrictionComparisonToken,
  sanitizeRestrictionDisplayValue,
  type RestrictionEvaluationInput,
} from '../src/domain/restriction-evaluation.policy';

function completeEvidence(
  detectedAllergens: unknown[] = [],
  ingredients: unknown[] = [{ dataSource: 'FNRI', resolved: true, linked: true }]
): NonNullable<RestrictionEvaluationInput['evidence']> {
  return {
    safetyMetadata: { complete: true, detectedAllergens },
    ingredients,
  };
}

test('[TEST-015] every repository condition enum is canonical and conservatively reviewed', () => {
  for (const condition of RESTRICTION_CONDITION_KEYS.filter((key) => key !== 'NONE')) {
    const result = evaluateRestrictions({
      restrictions: { conditions: [condition] },
      evidence: completeEvidence(),
    });

    assert.equal(result.decision, 'REVIEW');
    assert.equal(result.reviewState, 'NEEDS_REVIEW');
    assert.equal(result.normalizedRestrictions[0]?.canonicalKey, condition);
    assert.ok(result.reasonCodes.includes('KNOWN_CONDITION_REQUIRES_REVIEW'));
  }
});

test('[TEST-015] every repository allergy enum is canonical', () => {
  for (const allergy of RESTRICTION_ALLERGY_KEYS.filter((key) => key !== 'NONE')) {
    const result = evaluateRestrictions({
      restrictions: { allergies: [allergy] },
      evidence: completeEvidence(),
    });

    assert.equal(result.decision, 'ALLOW');
    assert.equal(result.reviewState, 'CAUTION');
    assert.equal(result.normalizedRestrictions[0]?.canonicalKey, allergy);
  }
});

test('[TEST-015] only the three approved aliases map and retain provenance', () => {
  for (const [alias, canonical] of Object.entries(APPROVED_RESTRICTION_ALIASES)) {
    const result = evaluateRestrictions({
      restrictions: { customAllergies: [alias] },
      evidence: completeEvidence([canonical]),
    });

    assert.equal(result.decision, 'BLOCK');
    assert.equal(result.normalizedRestrictions[0]?.canonicalKey, canonical);
    assert.equal(result.normalizedRestrictions[0]?.aliasInput, alias);
    assert.equal(result.normalizedRestrictions[0]?.aliasApplied, true);
    assert.equal(result.matches[0]?.restrictionAliasInput, alias);
  }
});

test('[TEST-015] explicitly rejected semantic mappings remain unmapped custom restrictions', () => {
  const rejected = [
    'WHEAT',
    'FISH',
    'SOY',
    'Lactose intolerance',
    'Lactation',
    'Type 2 diabetes',
    'Fish sinigang',
    'mani',
  ];

  for (const supplied of rejected) {
    const category = supplied === 'Lactation' || supplied === 'Type 2 diabetes'
      ? 'customConditions'
      : 'customAllergies';
    const result = evaluateRestrictions({
      restrictions: { [category]: [supplied] },
      evidence: completeEvidence(),
    });

    assert.equal(result.decision, 'REVIEW', supplied);
    assert.equal(result.normalizedRestrictions[0]?.canonicalKey, null, supplied);
    assert.ok(result.reasonCodes.includes('CUSTOM_RESTRICTION_UNMAPPED'), supplied);
  }
});

test('[TEST-015] unknown future enum values default to review', () => {
  const result = evaluateRestrictions({
    restrictions: { conditions: ['FUTURE_CONDITION'], allergies: ['FUTURE_ALLERGEN'] },
    evidence: completeEvidence(),
  });

  assert.equal(result.decision, 'REVIEW');
  assert.equal(result.unknownOrCustomRestriction, true);
  assert.ok(result.reasonCodes.includes('UNKNOWN_RESTRICTION_KEY'));
});

test('[TEST-015] NONE alone is allowed only with complete evidence', () => {
  const result = evaluateRestrictions({
    restrictions: { conditions: ['NONE'], allergies: ['NONE'] },
    evidence: completeEvidence(),
  });

  assert.equal(result.decision, 'ALLOW');
  assert.equal(result.reviewState, 'SAFE');
  assert.equal(result.explanation, SCOPED_SAFE_EXPLANATION);
});

test('[TEST-015] NONE with another enum is a stable contradiction requiring review', () => {
  const result = evaluateRestrictions({
    restrictions: { conditions: ['NONE', 'DIABETES'], allergies: ['NONE', 'DAIRY'] },
    evidence: completeEvidence(),
  });

  assert.equal(result.decision, 'REVIEW');
  assert.equal(result.blockingConflict, false);
  assert.ok(result.reasonCodes.includes('NONE_WITH_POSITIVE_RESTRICTION'));
  assert.ok(result.reasonCodes.includes('CONTRADICTORY_RESTRICTIONS'));
});

test('[TEST-015] NONE with a custom restriction is contradictory and the custom value is retained', () => {
  const result = evaluateRestrictions({
    restrictions: { allergies: ['NONE'], customAllergies: ['Sesame'] },
    evidence: completeEvidence(),
  });

  assert.equal(result.decision, 'REVIEW');
  assert.ok(result.reasonCodes.includes('NONE_WITH_POSITIVE_RESTRICTION'));
  assert.equal(result.normalizedRestrictions.find((item) => item.category === 'CUSTOM_ALLERGY')?.suppliedValue, 'Sesame');
});

test('[TEST-015] comparison normalization is mechanical across case, separators, and whitespace', () => {
  assert.equal(normalizeRestrictionComparisonToken('  kidney   disease  '), 'KIDNEY_DISEASE');
  assert.equal(normalizeRestrictionComparisonToken('kidney-disease'), 'KIDNEY_DISEASE');
  assert.equal(normalizeRestrictionComparisonToken('kidney_disease'), 'KIDNEY_DISEASE');
  assert.equal(normalizeRestrictionComparisonToken('Kidney\u00a0Disease'), 'KIDNEY_DISEASE');
});

test('[TEST-015] NFKC normalization supports mechanically equivalent enum and alias forms', () => {
  const result = evaluateRestrictions({
    restrictions: { conditions: ['ＤＩＡＢＥＴＥＳ'], customAllergies: ['ＥＧＧ'] },
    evidence: completeEvidence(),
  });

  assert.deepEqual(
    result.normalizedRestrictions.map((item) => item.canonicalKey).sort(),
    ['DIABETES', 'EGGS']
  );
});

test('[TEST-015] deduplication uses identical normalized keys and preserves the first sanitized display value', () => {
  const result = evaluateRestrictions({
    restrictions: { customAllergies: ['  egg  ', 'ＥＧＧ', 'egg'] },
    evidence: completeEvidence(),
  });

  assert.equal(result.normalizedRestrictions.length, 1);
  assert.equal(result.normalizedRestrictions[0]?.suppliedValue, 'egg');
  assert.equal(result.normalizedRestrictions[0]?.normalizedValue, 'EGG');
  assert.equal(result.normalizedRestrictions[0]?.canonicalKey, 'EGGS');
});

test('[TEST-015] partial words, similar spellings, and dish names do not silently map', () => {
  const falsePositives = ['NUTRITION', 'NUT', 'EGGPLANT', 'WHEATS', 'GLUTINOUS RICE', 'Peanut stew'];
  const result = evaluateRestrictions({
    restrictions: { customAllergies: falsePositives },
    evidence: completeEvidence(),
  });

  assert.equal(result.decision, 'REVIEW');
  assert.ok(result.normalizedRestrictions.every((item) => item.canonicalKey === null));
});

test('[TEST-015] sanitization removes controls, bounds display text, and redacts credential-shaped values', () => {
  const supplied = `\u0000  sesame token=top-secret Bearer abc.def.ghi person@example.com ${'x'.repeat(200)}`;
  const sanitized = sanitizeRestrictionDisplayValue(supplied);

  assert.ok(sanitized.length <= 120);
  assert.doesNotMatch(sanitized, /top-secret|abc\.def\.ghi|person@example\.com/);
  assert.match(sanitized, /\[REDACTED/);
});

test('[TEST-016] no restrictions plus complete authoritative evidence is narrowly ALLOW/SAFE', () => {
  const result = evaluateRestrictions({ evidence: completeEvidence() });

  assert.equal(result.decision, 'ALLOW');
  assert.equal(result.reviewState, 'SAFE');
  assert.equal(result.metadataComplete, true);
  assert.equal(result.explanation, SCOPED_SAFE_EXPLANATION);
  assert.ok(result.reasonCodes.includes('NO_DETERMINISTIC_CONFLICT_COMPLETE_EVIDENCE'));
});

test('[TEST-016] explicit incomplete evidence never returns ALLOW', () => {
  const result = evaluateRestrictions({
    evidence: {
      safetyMetadata: { complete: false, detectedAllergens: [] },
      ingredients: [{ dataSource: 'FNRI', resolved: true, linked: true }],
    },
  });

  assert.equal(result.decision, 'REVIEW');
  assert.equal(result.metadataComplete, false);
});

test('[TEST-016] exact canonical allergy conflict is blocking', () => {
  const result = evaluateRestrictions({
    restrictions: { allergies: ['NUTS'] },
    evidence: completeEvidence(['NUTS']),
  });

  assert.equal(result.decision, 'BLOCK');
  assert.equal(result.reviewState, 'NEEDS_REVIEW');
  assert.equal(result.blockingConflict, true);
  assert.equal(result.matches[0]?.reasonCode, 'EXACT_ALLERGEN_CONFLICT');
});

test('[TEST-016] exact approved-alias conflict is blocking with both sides provenance', () => {
  const result = evaluateRestrictions({
    restrictions: { customAllergies: ['peanuts'] },
    evidence: completeEvidence(['tree-nuts']),
  });

  assert.equal(result.decision, 'BLOCK');
  assert.equal(result.matches[0]?.canonicalRestrictionKey, 'NUTS');
  assert.equal(result.matches[0]?.restrictionAliasInput, 'PEANUTS');
  assert.equal(result.matches[0]?.evidenceAliasInput, 'TREE_NUTS');
});

test('[TEST-016] known allergy with complete non-conflicting evidence is ALLOW/CAUTION', () => {
  const result = evaluateRestrictions({
    restrictions: { allergies: ['DAIRY'] },
    evidence: completeEvidence(['NUTS']),
  });

  assert.equal(result.decision, 'ALLOW');
  assert.equal(result.reviewState, 'CAUTION');
  assert.equal(result.blockingConflict, false);
});

test('[TEST-016] health conditions and matching unreviewed condition-rule evidence require review', () => {
  const evidence = completeEvidence();
  evidence.safetyMetadata = {
    complete: true,
    detectedAllergens: [],
    conditionRuleMatches: ['HYPERTENSION'],
  };
  const result = evaluateRestrictions({
    restrictions: { conditions: ['HYPERTENSION'] },
    evidence,
  });

  assert.equal(result.decision, 'REVIEW');
  assert.ok(result.reasonCodes.includes('KNOWN_CONDITION_REQUIRES_REVIEW'));
  assert.ok(result.reasonCodes.includes('UNREVIEWED_CONDITION_RULE'));
  assert.equal(result.matches[0]?.evidenceSource, 'CONDITION_RULE_EVIDENCE');
});

test('[TEST-016] an unmapped custom restriction always requires review', () => {
  const result = evaluateRestrictions({
    restrictions: { customAllergies: ['Sesame'] },
    evidence: completeEvidence(),
  });

  assert.equal(result.decision, 'REVIEW');
  assert.equal(result.unknownOrCustomRestriction, true);
});

test('[TEST-016] missing and null safety metadata are incomplete and require review', () => {
  const missing = evaluateRestrictions({ evidence: { ingredients: completeEvidence().ingredients } });
  const nullMetadata = evaluateRestrictions({
    evidence: { safetyMetadata: null, ingredients: completeEvidence().ingredients },
  });

  assert.equal(missing.decision, 'REVIEW');
  assert.ok(missing.reasonCodes.includes('MISSING_SAFETY_METADATA'));
  assert.equal(nullMetadata.decision, 'REVIEW');
  assert.ok(nullMetadata.reasonCodes.includes('NULL_COMPATIBILITY_METADATA'));
});

test('[TEST-016] legacy empty metadata without an explicit completeness marker requires review', () => {
  const result = evaluateRestrictions({
    evidence: {
      safetyMetadata: { detectedAllergens: [] },
      ingredients: completeEvidence().ingredients,
    },
  });

  assert.equal(result.decision, 'REVIEW');
  assert.ok(result.reasonCodes.includes('LEGACY_EMPTY_SAFETY_METADATA'));
});

test('[TEST-016] malformed restriction and safety metadata require review', () => {
  const result = evaluateRestrictions({
    restrictions: { allergies: 'NUTS' },
    evidence: { safetyMetadata: 'complete', ingredients: ['not-structured'] },
  });

  assert.equal(result.decision, 'REVIEW');
  assert.equal(result.metadataComplete, false);
  assert.ok(result.reasonCodes.includes('MALFORMED_RESTRICTION_INPUT'));
  assert.ok(result.reasonCodes.includes('MALFORMED_SAFETY_METADATA'));
});

test('[TEST-016] Gemini-estimated ingredients force review and uncertainty', () => {
  const result = evaluateRestrictions({
    evidence: completeEvidence([], [
      { dataSource: 'GEMINI_ESTIMATED', resolved: true, linked: true },
    ]),
  });

  assert.equal(result.decision, 'REVIEW');
  assert.equal(result.estimatedOrUnresolvedIngredient, true);
  assert.ok(result.reasonCodes.includes('AI_ESTIMATED_INGREDIENT'));
});

test('[TEST-016] unresolved or unlinked ingredients force review', () => {
  for (const ingredient of [
    { dataSource: 'FNRI', resolved: false, linked: true },
    { dataSource: 'FNRI', resolved: true, linked: false },
  ]) {
    const result = evaluateRestrictions({ evidence: completeEvidence([], [ingredient]) });
    assert.equal(result.decision, 'REVIEW');
    assert.ok(result.reasonCodes.includes('UNRESOLVED_INGREDIENT'));
  }
});

test('[TEST-016] unknown metadata keys, allergen keys, and evidence sources are incomplete', () => {
  const result = evaluateRestrictions({
    evidence: {
      safetyMetadata: {
        complete: true,
        detectedAllergens: ['FUTURE_ALLERGEN'],
        futureMarker: true,
      },
      ingredients: [{ dataSource: 'FUTURE_SOURCE', resolved: true, linked: true }],
    },
  });

  assert.equal(result.decision, 'REVIEW');
  assert.equal(result.metadataComplete, false);
  assert.ok(result.reasonCodes.includes('UNKNOWN_METADATA_KEY'));
});

test('[TEST-016] contradictory metadata requires review unless an exact conflict requires block', () => {
  const contradictoryEvidence = {
    safetyMetadata: { complete: true, detectedAllergens: [] as string[], contradictory: true },
    ingredients: [{ dataSource: 'FNRI', resolved: true, linked: true }],
  };
  const review = evaluateRestrictions({ evidence: contradictoryEvidence });
  contradictoryEvidence.safetyMetadata.detectedAllergens = ['NUTS'];
  const block = evaluateRestrictions({
    restrictions: { allergies: ['NUTS'] },
    evidence: contradictoryEvidence,
  });

  assert.equal(review.decision, 'REVIEW');
  assert.equal(block.decision, 'BLOCK');
  assert.equal(block.blockingConflict, true);
});

test('[TEST-016] multiple restrictions obey BLOCK greater than REVIEW greater than ALLOW', () => {
  const result = evaluateRestrictions({
    restrictions: {
      conditions: ['DIABETES'],
      allergies: ['NUTS', 'DAIRY'],
      customAllergies: ['Sesame'],
    },
    evidence: completeEvidence(['NUTS']),
  });

  assert.equal(result.decision, 'BLOCK');
  assert.equal(result.reviewState, 'NEEDS_REVIEW');
  assert.ok(result.reasonCodes.includes('EXACT_ALLERGEN_CONFLICT'));
  assert.ok(result.reasonCodes.includes('KNOWN_CONDITION_REQUIRES_REVIEW'));
  assert.ok(result.reasonCodes.includes('CUSTOM_RESTRICTION_UNMAPPED'));
  assert.ok(result.reasonCodes.includes('MULTIPLE_RESULTS_MOST_RESTRICTIVE'));
});

test('[TEST-016] reason-code order is stable and follows the documented constant', () => {
  const result = evaluateRestrictions({
    restrictions: { conditions: ['NONE', 'DIABETES'], customAllergies: ['Sesame'] },
    evidence: null,
  });
  const indexes = result.reasonCodes.map((code) => RESTRICTION_REASON_CODE_ORDER.indexOf(code));

  assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b));
});

test('[TEST-016] identical input produces deeply identical output without mutation', () => {
  const input: RestrictionEvaluationInput = {
    restrictions: { allergies: ['peanuts'], customConditions: ['Future condition'] },
    evidence: completeEvidence(['NUTS']),
  };
  const before = JSON.stringify(input);

  assert.deepEqual(evaluateRestrictions(input), evaluateRestrictions(input));
  assert.equal(JSON.stringify(input), before);
});

test('[TEST-016] templated explanations never echo raw personal or credential-shaped input', () => {
  const privateValue = 'person@example.com token=not-for-output';
  const result = evaluateRestrictions({
    restrictions: { customAllergies: [privateValue] },
    evidence: completeEvidence(),
  });

  assert.doesNotMatch(result.explanation, /person@example\.com|not-for-output/);
  assert.match(result.normalizedRestrictions[0]?.suppliedValue ?? '', /\[REDACTED/);
});
