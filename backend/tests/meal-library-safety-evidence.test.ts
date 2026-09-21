import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MEAL_LIBRARY_SAFETY_POLICY_VERSION,
  evaluateMealLibrarySafetyEvidence,
  type MealLibrarySafetyCandidate,
} from '../src/domain/meal-library-safety-evidence.policy';

function certifiedCandidate(overrides: Partial<MealLibrarySafetyCandidate> = {}): MealLibrarySafetyCandidate {
  return {
    status: 'APPROVED',
    safetyEvidenceStatus: 'COMPLETE',
    safetyEvidenceOrigin: 'NUTRITIONIST_REVIEW',
    conditionDeclarationState: 'REVIEWED_NONE_DECLARED',
    allergenDeclarationState: 'REVIEWED_NONE_DECLARED',
    crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
    safetyEvidenceRevision: 2,
    certifiedEvidenceRevision: 2,
    safetyPolicyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
    safetyInvalidatedAt: null,
    reviewerEligible: true,
    ingredients: [{ dataSource: 'FNRI', foodItemId: 'food-1' }],
    safetyDeclarations: [],
    ...overrides,
  };
}

test('[TEST-050] exact current certification maps to complete adapter evidence', () => {
  const result = evaluateMealLibrarySafetyEvidence(certifiedCandidate());

  assert.equal(result.complete, true);
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.adapterEvidence, {
    complete: true,
    baseComplete: true,
    detectedAllergens: [],
    reviewedAbsentAllergens: [],
    allergenDomainReviewed: true,
    crossContactCleared: true,
    conditionRuleMatches: [],
    conditionDomainReviewed: true,
  });
});

test('[TEST-050] incomplete, stale, revision-mismatched, or unsupported evidence fails closed', () => {
  const cases: Partial<MealLibrarySafetyCandidate>[] = [
    { safetyEvidenceStatus: 'INCOMPLETE' },
    { safetyEvidenceStatus: 'STALE', safetyInvalidatedAt: new Date() },
    { certifiedEvidenceRevision: 1 },
    { safetyPolicyVersion: 'FUTURE_VERSION' },
  ];

  for (const overrides of cases) {
    assert.equal(evaluateMealLibrarySafetyEvidence(certifiedCandidate(overrides)).complete, false);
  }
});

test('[TEST-050] base completeness is independent from condition and allergen review coverage', () => {
  const result = evaluateMealLibrarySafetyEvidence(
    certifiedCandidate({
      conditionDeclarationState: 'NOT_REVIEWED',
      allergenDeclarationState: 'NOT_REVIEWED',
      crossContactAssessment: 'NOT_ASSESSED',
    })
  );

  assert.equal(result.complete, true);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.adapterEvidence.baseComplete, true);
  assert.equal(result.adapterEvidence.conditionDomainReviewed, false);
  assert.equal(result.adapterEvidence.allergenDomainReviewed, false);
  assert.ok(result.coverageReasons.includes('CONDITION_DOMAIN_NOT_REVIEWED'));
  assert.ok(result.coverageReasons.includes('ALLERGEN_DOMAIN_NOT_REVIEWED'));
});

test('[TEST-050] a complete data shape without eligible review provenance is not certified base evidence', () => {
  const result = evaluateMealLibrarySafetyEvidence(
    certifiedCandidate({ safetyEvidenceOrigin: 'NUTRITIONIST_DRAFT', reviewerEligible: false })
  );

  assert.equal(result.complete, false);
  assert.ok(result.reasons.includes('EVIDENCE_ORIGIN_NOT_REVIEWED'));
  assert.ok(result.reasons.includes('REVIEWER_NOT_ELIGIBLE'));
});

test('[TEST-050] first-class ingredients must all be linked FNRI evidence', () => {
  const estimated = evaluateMealLibrarySafetyEvidence(
    certifiedCandidate({
      ingredients: [{ dataSource: 'GEMINI_ESTIMATED', foodItemId: null }],
    })
  );

  assert.equal(estimated.complete, false);
  assert.ok(estimated.reasons.includes('NON_FNRI_LIBRARY_INGREDIENT'));
  assert.ok(estimated.reasons.includes('UNRESOLVED_LIBRARY_INGREDIENT'));
});

test('[TEST-050] exact declarations map without inferring custom or contradictory evidence', () => {
  const result = evaluateMealLibrarySafetyEvidence(
    certifiedCandidate({
      conditionDeclarationState: 'REVIEWED_WITH_DECLARATIONS',
      allergenDeclarationState: 'REVIEWED_WITH_DECLARATIONS',
      safetyDeclarations: [
        { declarationType: 'CONDITION_REVIEWED', canonicalKey: 'HYPERTENSION', customKey: null },
        { declarationType: 'ALLERGEN_PRESENT', canonicalKey: 'NUTS', customKey: null },
        { declarationType: 'ALLERGEN_REVIEWED_ABSENT', canonicalKey: 'DAIRY', customKey: null },
      ],
    })
  );

  assert.equal(result.complete, true);
  assert.deepEqual(result.suitableConditions, ['HYPERTENSION']);
  assert.deepEqual(result.allergenFree, ['DAIRY']);
  assert.deepEqual(result.adapterEvidence.detectedAllergens, ['NUTS']);
  assert.equal(result.adapterEvidence.conditionDomainReviewed, true);
  assert.equal(result.adapterEvidence.allergenDomainReviewed, true);

  const custom = evaluateMealLibrarySafetyEvidence(
    certifiedCandidate({
      allergenDeclarationState: 'REVIEWED_WITH_DECLARATIONS',
      safetyDeclarations: [{ declarationType: 'ALLERGEN_PRESENT', canonicalKey: null, customKey: 'SESAME' }],
    })
  );
  assert.equal(custom.complete, true);
  assert.equal(custom.adapterEvidence.allergenDomainReviewed, false);
  assert.ok(custom.coverageReasons.includes('UNSUPPORTED_DECLARATION_KEY'));
});

test('[TEST-050] missing cross-contact assessment and declaration state mismatches fail closed', () => {
  const result = evaluateMealLibrarySafetyEvidence(
    certifiedCandidate({
      crossContactAssessment: 'NOT_ASSESSED',
      allergenDeclarationState: 'REVIEWED_NONE_DECLARED',
      safetyDeclarations: [{ declarationType: 'ALLERGEN_REVIEWED_ABSENT', canonicalKey: 'DAIRY', customKey: null }],
    })
  );

  assert.equal(result.complete, true);
  assert.equal(result.adapterEvidence.allergenDomainReviewed, false);
  assert.ok(result.coverageReasons.includes('CROSS_CONTACT_NOT_CLEARED'));
  assert.ok(result.coverageReasons.includes('DECLARATION_STATE_MISMATCH'));
});

test('[TEST-050] malformed condition declarations do not erase valid allergen coverage', () => {
  const result = evaluateMealLibrarySafetyEvidence(
    certifiedCandidate({
      conditionDeclarationState: 'REVIEWED_WITH_DECLARATIONS',
      allergenDeclarationState: 'REVIEWED_WITH_DECLARATIONS',
      safetyDeclarations: [
        { declarationType: 'CONDITION_REVIEWED', canonicalKey: null, customKey: 'GOUT' },
        { declarationType: 'ALLERGEN_REVIEWED_ABSENT', canonicalKey: 'DAIRY', customKey: null },
      ],
    })
  );

  assert.equal(result.complete, true);
  assert.equal(result.adapterEvidence.conditionDomainReviewed, false);
  assert.equal(result.adapterEvidence.allergenDomainReviewed, true);
  assert.deepEqual(result.adapterEvidence.reviewedAbsentAllergens, ['DAIRY']);
});

test('[TEST-050] approved-ruleset provenance can clear hypertension but cannot impersonate manual high-risk review', () => {
  const hypertension = evaluateMealLibrarySafetyEvidence(
    certifiedCandidate({
      safetyEvidenceOrigin: 'NUTRITIONIST_DRAFT',
      reviewerEligible: false,
      conditionDeclarationState: 'REVIEWED_WITH_DECLARATIONS',
      safetyDeclarations: [
        {
          declarationType: 'CONDITION_RULESET_CLEARED',
          canonicalKey: 'HYPERTENSION',
          customKey: null,
          provenance: 'APPROVED_RULESET',
          policyVersion: 'HTN_RULESET_V1',
          evidenceSnapshot: { allRulesApproved: true, decision: 'PASS' },
        },
      ],
    })
  );
  assert.equal(hypertension.adapterEvidence.conditionDomainReviewed, true);
  assert.deepEqual(hypertension.suitableConditions, ['HYPERTENSION']);

  const kidney = evaluateMealLibrarySafetyEvidence(
    certifiedCandidate({
      safetyEvidenceOrigin: 'NUTRITIONIST_DRAFT',
      reviewerEligible: false,
      conditionDeclarationState: 'REVIEWED_WITH_DECLARATIONS',
      safetyDeclarations: [
        {
          declarationType: 'CONDITION_RULESET_CLEARED',
          canonicalKey: 'KIDNEY_DISEASE',
          customKey: null,
          provenance: 'APPROVED_RULESET',
          policyVersion: 'KIDNEY_RULESET_V1',
          evidenceSnapshot: { allRulesApproved: true, decision: 'PASS' },
        },
      ],
    })
  );
  assert.equal(kidney.adapterEvidence.conditionDomainReviewed, false);
  assert.ok(kidney.coverageReasons.includes('RULESET_CLEARANCE_UNSUPPORTED'));
});
