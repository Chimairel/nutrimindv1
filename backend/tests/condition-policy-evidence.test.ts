import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertConditionPolicyEvidenceComplete,
  getConditionRuleEvidenceDefects,
} from '../src/domain/condition-policy-evidence.policy';

const completeRule = {
  id: 'rule-1',
  evidenceSourceId: 'source-1',
  evidenceSource: { state: 'CURRENT', code: 'SOURCE_V1' },
  evidenceLocator: 'Section 5, nutrition recommendations',
  applicablePopulation: 'Adults represented by the approved policy.',
  requiredInputs: { dailyTotals: ['fiberG', 'calories'] },
  exclusionsAndCaveats: 'Does not independently establish condition clearance.',
  evaluationScope: 'DAY',
  authorityOutcome: 'REVIEW_REQUIRED',
};

test('governed condition rules require a current versioned source and explicit application metadata', () => {
  assert.deepEqual(getConditionRuleEvidenceDefects(completeRule), []);
  assert.doesNotThrow(() => assertConditionPolicyEvidenceComplete([completeRule]));
});

test('policy governance fails closed on a withdrawn source or missing clinical scope', () => {
  const defects = getConditionRuleEvidenceDefects({
    ...completeRule,
    evidenceSource: { state: 'WITHDRAWN', code: 'SOURCE_V1' },
    requiredInputs: null,
    evaluationScope: null,
  });
  assert.deepEqual(defects, ['SOURCE_NOT_CURRENT', 'MISSING_REQUIRED_INPUTS', 'MISSING_EVALUATION_SCOPE']);
  assert.throws(
    () => assertConditionPolicyEvidenceComplete([{ ...completeRule, evidenceSource: null }]),
    /MISSING_VERSIONED_SOURCE/u
  );
});
