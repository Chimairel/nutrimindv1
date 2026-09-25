import assert from 'node:assert/strict';
import test from 'node:test';
import { ClinicalDocumentStatus, ClinicalEvidenceArea, HealthConditionType } from '@prisma/client';
import { clinicalEvidenceBlocksMealPlanning, evaluateClinicalEvidenceRequirements } from '../src/domain/clinical-evidence-requirement.policy';
import { decryptClinicalDocument, detectClinicalDocumentMime, encryptClinicalDocument } from '../src/lib/clinical-document-crypto';

const now = new Date('2026-09-25T12:00:00Z');
const doc = (status: ClinicalDocumentStatus, createdAt: string, validUntil: string | null = '2026-10-25T23:59:00Z') => ({
  id: createdAt, area: ClinicalEvidenceArea.KIDNEY_DISEASE, status, revision: 1,
  sha256: 'a'.repeat(64), createdAt: new Date(createdAt), validUntil: validUntil ? new Date(validUntil) : null,
});

test('kidney condition fails closed without a reviewed and current document', () => {
  for (const documents of [[], [doc(ClinicalDocumentStatus.UPLOADED, '2026-09-01')], [doc(ClinicalDocumentStatus.SUFFICIENT_FOR_NUTRITION_REVIEW, '2026-09-01', '2026-09-24')]]) {
    const result = evaluateClinicalEvidenceRequirements({ conditions: [HealthConditionType.KIDNEY_DISEASE], documents, now });
    assert.equal(result[0].state, 'DOCUMENT_REVIEW_REQUIRED');
    assert.equal(clinicalEvidenceBlocksMealPlanning(result), true);
  }
});

test('new pending document overrides an older sufficient document', () => {
  const result = evaluateClinicalEvidenceRequirements({
    conditions: [HealthConditionType.KIDNEY_DISEASE],
    documents: [doc(ClinicalDocumentStatus.SUFFICIENT_FOR_NUTRITION_REVIEW, '2026-09-01'), doc(ClinicalDocumentStatus.UPLOADED, '2026-09-20')], now,
  });
  assert.equal(result[0].state, 'DOCUMENT_REVIEW_REQUIRED');
  assert.deepEqual(result[0].readyDocumentIds, []);
});

test('withdrawal does not restore an older reviewed record', () => {
  const result = evaluateClinicalEvidenceRequirements({
    conditions: [HealthConditionType.KIDNEY_DISEASE],
    documents: [doc(ClinicalDocumentStatus.SUFFICIENT_FOR_NUTRITION_REVIEW, '2026-09-01'), doc(ClinicalDocumentStatus.WITHDRAWN, '2026-09-20')], now,
  });
  assert.equal(result[0].state, 'DOCUMENT_REVIEW_REQUIRED');
});

test('the latest reviewed document satisfies a user-scoped condition', () => {
  const result = evaluateClinicalEvidenceRequirements({ conditions: [HealthConditionType.KIDNEY_DISEASE], documents: [doc(ClinicalDocumentStatus.SUFFICIENT_FOR_NUTRITION_REVIEW, '2026-09-20')], now });
  assert.equal(result[0].state, 'READY');
  assert.equal(result[0].readyDocumentIds.length, 1);
});

test('diabetes context determines whether document review is mandatory', () => {
  const safe = evaluateClinicalEvidenceRequirements({ conditions: [HealthConditionType.DIABETES], documents: [], diabetesContext: { medicationRisk: 'NONE', recurrentHypoglycemia: false }, now });
  assert.equal(safe[0].state, 'READY');
  const risky = evaluateClinicalEvidenceRequirements({ conditions: [HealthConditionType.DIABETES], documents: [], diabetesContext: { medicationRisk: 'INSULIN', recurrentHypoglycemia: false }, now });
  assert.equal(risky[0].state, 'DOCUMENT_REVIEW_REQUIRED');
  const unknown = evaluateClinicalEvidenceRequirements({ conditions: [HealthConditionType.DIABETES], documents: [], now });
  assert.equal(unknown[0].state, 'CONTEXT_REQUIRED');
});

test('a voluntary diabetes upload waits for review before planning resumes', () => {
  const pending = { ...doc(ClinicalDocumentStatus.UPLOADED, '2026-09-20'), area: ClinicalEvidenceArea.DIABETES };
  const result = evaluateClinicalEvidenceRequirements({ conditions: [HealthConditionType.DIABETES], documents: [pending], diabetesContext: { medicationRisk: 'NONE', recurrentHypoglycemia: false }, now });
  assert.equal(result[0].state, 'DOCUMENT_REVIEW_REQUIRED');
});

test('hypertension and pregnancy keep documents optional', () => {
  const result = evaluateClinicalEvidenceRequirements({ conditions: [HealthConditionType.HYPERTENSION, HealthConditionType.PREGNANT], documents: [], now });
  assert.ok(result.every((item) => item.state === 'READY' && !item.required));
});

test('uploaded document bytes are encrypted and authenticated before storage', () => {
  const previousKey = process.env.CLINICAL_DOCUMENT_ENCRYPTION_KEY;
  process.env.CLINICAL_DOCUMENT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  try {
    const original = Buffer.from('%PDF-1.7\nprivate clinical sample');
    assert.equal(detectClinicalDocumentMime(original), 'application/pdf');
    const sealed = encryptClinicalDocument(original);
    assert.notDeepEqual(sealed.encryptedPayload, original);
    assert.deepEqual(decryptClinicalDocument(sealed), original);
    sealed.encryptedPayload[0] ^= 1;
    assert.throws(() => decryptClinicalDocument(sealed));
  } finally {
    if (previousKey === undefined) delete process.env.CLINICAL_DOCUMENT_ENCRYPTION_KEY;
    else process.env.CLINICAL_DOCUMENT_ENCRYPTION_KEY = previousKey;
  }
});
