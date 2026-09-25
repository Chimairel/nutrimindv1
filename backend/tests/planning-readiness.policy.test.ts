import assert from 'node:assert/strict';
import test from 'node:test';
import { ClinicalEvidenceArea, HealthConditionType } from '@prisma/client';
import { determinePlanningReadiness } from '../src/domain/planning-readiness.policy';

test('missing required clinical context blocks a plan request even after report acknowledgment', () => {
  const readiness = determinePlanningReadiness({
    conditions: ['KIDNEY_DISEASE'],
    restrictionsRequireReview: false,
    requirements: [{
      area: ClinicalEvidenceArea.KIDNEY_DISEASE, condition: HealthConditionType.KIDNEY_DISEASE, state: 'DOCUMENT_REVIEW_REQUIRED',
      required: true, reasonCode: 'MISSING_DOCUMENT', message: 'Document review required.', readyDocumentIds: [],
    }],
  });
  assert.equal(readiness.status, 'BLOCKED_CLINICAL_CONTEXT');
  assert.equal(readiness.canRequestPlan, false);
  assert.equal(readiness.actionPath, '/profile/clinical-evidence');
});

test('custom restriction permits candidate sourcing but does not promise instant meal use', () => {
  const readiness = determinePlanningReadiness({
    conditions: [], restrictionsRequireReview: true, requirements: [],
  });
  assert.equal(readiness.status, 'REQUEST_ALLOWED_REVIEW_EXPECTED');
  assert.equal(readiness.canRequestPlan, true);
  assert.match(readiness.message, /reviewed by a nutritionist before use/);
});

test('unrestricted profile may request a plan without implying new candidates are approved', () => {
  const readiness = determinePlanningReadiness({
    conditions: [], restrictionsRequireReview: false, requirements: [],
  });
  assert.equal(readiness.status, 'REQUEST_ALLOWED');
  assert.equal(readiness.canRequestPlan, true);
  assert.match(readiness.message, /new candidates wait for nutritionist review/);
});
