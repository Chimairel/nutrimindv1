import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateMealGenerationLibraryCompatibility,
  filterEligibleMealGenerationLibraryCandidates,
  runMealGenerationFallbackForUnmatchedSlots,
  type MealGenerationLibraryCandidateEvidence,
  type MealGenerationUserRestrictions,
} from '../src/domain/meal-generation-library-compatibility.adapter';

function completeCandidate(
  overrides: Partial<MealGenerationLibraryCandidateEvidence> = {}
): MealGenerationLibraryCandidateEvidence {
  return {
    status: 'APPROVED',
    suitableConditions: [],
    allergenFree: [],
    safetyEvidence: { complete: true, detectedAllergens: [] },
    ingredients: [{ dataSource: 'FNRI', foodItemId: 'synthetic-food-001' }],
    ...overrides,
  };
}

function evaluate(
  userRestrictions: MealGenerationUserRestrictions = {},
  candidate: MealGenerationLibraryCandidateEvidence = completeCandidate()
) {
  return evaluateMealGenerationLibraryCompatibility({ userRestrictions, candidate });
}

test('[TEST-027] approved candidate with no restrictions and complete evidence is eligible', () => {
  const result = evaluate();

  assert.equal(result.eligible, true);
  assert.equal(result.evaluation.decision, 'ALLOW');
  assert.equal(result.evaluation.reviewState, 'SAFE');
  assert.equal(result.metadataComplete, true);
});

test('[TEST-027] known allergy with complete non-conflicting evidence is eligible as ALLOW/CAUTION', () => {
  const result = evaluate(
    { allergies: ['DAIRY'] },
    completeCandidate({ allergenFree: ['DAIRY'] })
  );

  assert.equal(result.eligible, true);
  assert.equal(result.evaluation.decision, 'ALLOW');
  assert.equal(result.evaluation.reviewState, 'CAUTION');
});

test('[TEST-027] exact canonical allergy conflict is ineligible', () => {
  const result = evaluate(
    { allergies: ['NUTS'] },
    completeCandidate({
      allergenFree: ['NUTS'],
      safetyEvidence: { complete: true, detectedAllergens: ['NUTS'] },
    })
  );

  assert.equal(result.eligible, false);
  assert.equal(result.evaluation.decision, 'BLOCK');
  assert.ok(result.reasonCodes.includes('EXACT_ALLERGEN_CONFLICT'));
});

test('[TEST-027] exact approved-alias conflict is ineligible with provenance', () => {
  const result = evaluate(
    { customAllergies: 'peanuts' },
    completeCandidate({
      allergenFree: ['TREE_NUTS'],
      safetyEvidence: { complete: true, detectedAllergens: ['tree-nuts'] },
    })
  );

  assert.equal(result.eligible, false);
  assert.equal(result.evaluation.decision, 'BLOCK');
  assert.equal(result.evaluation.matches[0]?.restrictionAliasInput, 'PEANUTS');
  assert.equal(result.evaluation.matches[0]?.evidenceAliasInput, 'TREE_NUTS');
});

test('[TEST-027] resolved approved alias with complete non-conflicting evidence is eligible', () => {
  const result = evaluate(
    { customAllergies: 'egg' },
    completeCandidate({ allergenFree: ['EGGS'] })
  );

  assert.equal(result.eligible, true);
  assert.equal(result.evaluation.decision, 'ALLOW');
  assert.equal(result.evaluation.reviewState, 'CAUTION');
  assert.equal(result.evaluation.normalizedRestrictions[0]?.aliasInput, 'EGG');
});

test('[TEST-027] a complete certified diabetes or hypertension match is eligible', () => {
  const result = evaluate(
    { conditions: ['HYPERTENSION'] },
    completeCandidate({ suitableConditions: ['HYPERTENSION'] })
  );

  assert.equal(result.eligible, true);
  assert.equal(result.evaluation.decision, 'ALLOW');
  assert.ok(result.reasonCodes.includes('CERTIFIED_CONDITION_MATCH'));
});

test('[TEST-027] high-risk condition matches remain review-required', () => {
  const result = evaluate(
    { conditions: ['KIDNEY_DISEASE'] },
    completeCandidate({ suitableConditions: ['KIDNEY_DISEASE'] })
  );

  assert.equal(result.eligible, false);
  assert.equal(result.evaluation.decision, 'REVIEW');
  assert.ok(result.reasonCodes.includes('KNOWN_CONDITION_REQUIRES_REVIEW'));
});

test('[TEST-027] comma-stored unmapped custom restriction preserves provenance and is ineligible', () => {
  const result = evaluate({ customAllergies: 'Sesame, Soy' });

  assert.equal(result.eligible, false);
  assert.equal(result.evaluation.unknownOrCustomRestriction, true);
  assert.deepEqual(
    result.evaluation.normalizedRestrictions.map((item) => item.suppliedValue).sort(),
    ['Sesame', 'Soy']
  );
});

test('[TEST-027] null compatibility metadata is incomplete and ineligible', () => {
  const result = evaluate({}, completeCandidate({ suitableConditions: null }));

  assert.equal(result.eligible, false);
  assert.ok(result.reasonCodes.includes('NULL_COMPATIBILITY_METADATA'));
});

test('[TEST-027] missing compatibility metadata is incomplete and ineligible', () => {
  const candidate = completeCandidate();
  delete candidate.allergenFree;
  const result = evaluate({}, candidate);

  assert.equal(result.eligible, false);
  assert.ok(result.reasonCodes.includes('MISSING_SAFETY_METADATA'));
});

test('[TEST-027] malformed compatibility metadata is incomplete and ineligible', () => {
  const result = evaluate({}, completeCandidate({ allergenFree: 'DAIRY' }));

  assert.equal(result.eligible, false);
  assert.ok(result.reasonCodes.includes('MALFORMED_SAFETY_METADATA'));
});

test('[TEST-027] legacy arrays without explicit completeness evidence are ineligible', () => {
  const candidate = completeCandidate();
  delete candidate.safetyEvidence;
  const result = evaluate({}, candidate);

  assert.equal(result.eligible, false);
  assert.equal(result.evaluation.decision, 'REVIEW');
  assert.ok(result.reasonCodes.includes('LEGACY_EMPTY_SAFETY_METADATA'));
});

test('[TEST-027] unknown compatibility or safety metadata keys are ineligible', () => {
  const compatibilityUnknown = evaluate({}, completeCandidate({ allergenFree: ['FUTURE_ALLERGEN'] }));
  const safetyUnknown = evaluate({}, completeCandidate({
    safetyEvidence: { complete: true, detectedAllergens: [], futureMarker: true },
  }));

  assert.equal(compatibilityUnknown.eligible, false);
  assert.equal(safetyUnknown.eligible, false);
  assert.ok(compatibilityUnknown.reasonCodes.includes('UNKNOWN_METADATA_KEY'));
  assert.ok(safetyUnknown.reasonCodes.includes('UNKNOWN_METADATA_KEY'));
});

test('[TEST-027] Gemini-estimated ingredient provenance is ineligible', () => {
  const result = evaluate({}, completeCandidate({
    ingredients: [{ dataSource: 'GEMINI_ESTIMATED', foodItemId: 'synthetic-estimate-001' }],
  }));

  assert.equal(result.eligible, false);
  assert.equal(result.evaluation.estimatedOrUnresolvedIngredient, true);
  assert.ok(result.reasonCodes.includes('AI_ESTIMATED_INGREDIENT'));
});

test('[TEST-027] unresolved or unlinked ingredient provenance is ineligible', () => {
  const result = evaluate({}, completeCandidate({
    ingredients: [{ dataSource: 'FNRI', foodItemId: null }],
  }));

  assert.equal(result.eligible, false);
  assert.equal(result.evaluation.estimatedOrUnresolvedIngredient, true);
  assert.ok(result.reasonCodes.includes('UNRESOLVED_INGREDIENT'));
});

test('[TEST-027] NONE combined with another restriction is ineligible', () => {
  const result = evaluate(
    { allergies: ['NONE', 'DAIRY'] },
    completeCandidate({ allergenFree: ['DAIRY'] })
  );

  assert.equal(result.eligible, false);
  assert.ok(result.reasonCodes.includes('NONE_WITH_POSITIVE_RESTRICTION'));
});

test('[TEST-027] FLAGGED and unknown future library statuses deny eligibility', () => {
  for (const status of ['FLAGGED', 'FUTURE_STATUS']) {
    const result = evaluate({}, completeCandidate({ status }));
    assert.equal(result.evaluation.decision, 'ALLOW');
    assert.equal(result.eligible, false, status);
  }
});

test('[TEST-027] identical inputs produce identical output without mutation', () => {
  const input = {
    userRestrictions: { allergies: ['DAIRY'], customConditions: '' },
    candidate: completeCandidate({ allergenFree: ['DAIRY'] }),
  };
  const before = JSON.stringify(input);

  assert.deepEqual(
    evaluateMealGenerationLibraryCompatibility(input),
    evaluateMealGenerationLibraryCompatibility(input)
  );
  assert.equal(JSON.stringify(input), before);
});

test('[TEST-027] reasons and explanations do not expose personal or credential-shaped custom text', () => {
  const privateText = 'person@example.invalid token=synthetic-private-value';
  const result = evaluate({ customAllergies: privateText });
  const explanationAndReasons = `${result.explanation} ${result.reasonCodes.join(' ')}`;

  assert.doesNotMatch(explanationAndReasons, /person@example\.invalid|synthetic-private-value/);
  assert.match(result.evaluation.normalizedRestrictions[0]?.suppliedValue ?? '', /\[REDACTED/);
});

type SyntheticCandidate = MealGenerationLibraryCandidateEvidence & {
  id: string;
  originalPlanStatus?: string;
};

function eligibleCandidates(
  candidates: readonly SyntheticCandidate[],
  restrictions: MealGenerationUserRestrictions = {}
): SyntheticCandidate[] {
  return filterEligibleMealGenerationLibraryCandidates(candidates, restrictions, (candidate) => candidate);
}

test('[TEST-028] eligible approved candidates remain available to generation selection', () => {
  const candidate: SyntheticCandidate = { id: 'library-eligible', ...completeCandidate() };
  const filtered = eligibleCandidates([candidate]);

  assert.deepEqual(filtered, [candidate]);
  assert.equal(filtered[0], candidate);
});

test('[TEST-028] REVIEW and BLOCK candidates are removed from generation selection', () => {
  const review: SyntheticCandidate = {
    id: 'library-review',
    ...completeCandidate(),
    safetyEvidence: undefined,
  };
  const block: SyntheticCandidate = {
    id: 'library-block',
    ...completeCandidate({
      allergenFree: ['NUTS'],
      safetyEvidence: { complete: true, detectedAllergens: ['NUTS'] },
    }),
  };

  assert.deepEqual(eligibleCandidates([review]), []);
  assert.deepEqual(eligibleCandidates([block], { allergies: ['NUTS'] }), []);
});

test('[TEST-028] rejected-original-shaped and flagged library records are not selected', () => {
  const rejectedOriginal: SyntheticCandidate = {
    id: 'library-rejected-original',
    originalPlanStatus: 'REJECTED',
    ...completeCandidate({ status: 'REJECTED' }),
  };
  const flagged: SyntheticCandidate = {
    id: 'library-flagged',
    ...completeCandidate({ status: 'FLAGGED' }),
  };

  assert.deepEqual(eligibleCandidates([rejectedOriginal, flagged]), []);
});

test('[TEST-028] no eligible candidate triggers one isolated fallback for the affected slot', async () => {
  const candidates = eligibleCandidates([
    { id: 'library-review', ...completeCandidate(), safetyEvidence: undefined },
  ]);
  const unmatchedSlots = candidates.length === 0 ? [{ dayNumber: 1, mealType: 'BREAKFAST' }] : [];
  let fallbackCalls = 0;

  const generated = await runMealGenerationFallbackForUnmatchedSlots(unmatchedSlots, async (slots) => {
    fallbackCalls += 1;
    return slots.map((slot) => ({ ...slot, source: 'SYNTHETIC_FALLBACK' }));
  });

  assert.equal(fallbackCalls, 1);
  assert.equal(generated.length, 1);
  assert.equal(generated[0]?.source, 'SYNTHETIC_FALLBACK');
});

test('[TEST-028] fallback is not called when an eligible candidate fills the slot', async () => {
  const candidates = eligibleCandidates([
    { id: 'library-eligible', ...completeCandidate() },
  ]);
  const unmatchedSlots = candidates.length === 0 ? [{ dayNumber: 1, mealType: 'BREAKFAST' }] : [];
  let fallbackCalls = 0;

  const generated = await runMealGenerationFallbackForUnmatchedSlots(unmatchedSlots, async () => {
    fallbackCalls += 1;
    return [{ source: 'UNEXPECTED' }];
  });

  assert.equal(candidates.length, 1);
  assert.equal(fallbackCalls, 0);
  assert.deepEqual(generated, []);
});

test('[TEST-028] multiple unmatched slots are supplied to one fallback batch', async () => {
  const slots = [
    { dayNumber: 1, mealType: 'BREAKFAST' },
    { dayNumber: 1, mealType: 'LUNCH' },
    { dayNumber: 1, mealType: 'DINNER' },
  ];
  let fallbackCalls = 0;

  const generated = await runMealGenerationFallbackForUnmatchedSlots(slots, async (fallbackSlots) => {
    fallbackCalls += 1;
    return fallbackSlots.map((slot) => ({ ...slot, status: 'PENDING_REVIEW' }));
  });

  assert.equal(fallbackCalls, 1);
  assert.equal(generated.length, slots.length);
  assert.ok(generated.every((meal) => meal.status === 'PENDING_REVIEW'));
});

test('[TEST-028] candidate exclusion cannot produce a missing false-success slot', async () => {
  const affectedSlots = [{ dayNumber: 2, mealType: 'DINNER' }];
  const generated = await runMealGenerationFallbackForUnmatchedSlots(affectedSlots, async (slots) =>
    slots.map((slot) => ({ ...slot, mealName: 'Synthetic fallback meal' }))
  );

  assert.deepEqual(
    generated.map(({ dayNumber, mealType }) => ({ dayNumber, mealType })),
    affectedSlots
  );
});

test('[TEST-028] filtering and fallback seams do not alter existing plan-status data', async () => {
  const candidate: SyntheticCandidate = {
    id: 'library-status-preserved',
    originalPlanStatus: 'PENDING_REVIEW',
    ...completeCandidate(),
  };
  const before = JSON.stringify(candidate);
  const filtered = eligibleCandidates([candidate]);
  const fallback = await runMealGenerationFallbackForUnmatchedSlots([], async () => []);

  assert.equal(filtered[0]?.originalPlanStatus, 'PENDING_REVIEW');
  assert.equal(JSON.stringify(candidate), before);
  assert.deepEqual(fallback, []);
});

test('[TEST-028] fallback tests use only injected synthetic callbacks and no Gemini client', async () => {
  const marker = Symbol('synthetic-result');
  const result = await runMealGenerationFallbackForUnmatchedSlots([1], async () => [marker]);

  assert.deepEqual(result, [marker]);
});
