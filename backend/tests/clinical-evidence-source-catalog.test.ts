import assert from 'node:assert/strict';
import test from 'node:test';
import { CLINICAL_EVIDENCE_SOURCES } from '../src/domain/clinical-evidence-source.catalog';

test('clinical evidence source revisions are unique, traceable, and explicit about population and caveats', () => {
  assert.equal(new Set(CLINICAL_EVIDENCE_SOURCES.map((source) => source.code)).size, CLINICAL_EVIDENCE_SOURCES.length);
  assert.ok(CLINICAL_EVIDENCE_SOURCES.length >= 10);
  for (const source of CLINICAL_EVIDENCE_SOURCES) {
    assert.match(source.canonicalUrl, /^https:\/\//u);
    assert.ok(source.sourceVersion.trim().length > 0);
    assert.ok(source.sectionLocator.trim().length > 0);
    assert.ok(source.population.trim().length > 0);
    assert.ok(source.jurisdiction.trim().length > 0);
    assert.ok(source.exclusionsAndCaveats.trim().length > 0);
    assert.ok(Number.isFinite(new Date(source.retrievedAt).getTime()));
  }
});

test('the registry carries both Philippine allergen-label context and condition-specific primary guidance', () => {
  const codes = new Set(CLINICAL_EVIDENCE_SOURCES.map((source) => source.code));
  assert.ok(codes.has('PH_FDA_AO_2014_0030A'));
  assert.ok(codes.has('NHLBI_DASH_EATING_PLAN_CURRENT_2026_09'));
  assert.ok(codes.has('ADA_STANDARDS_2026_SECTION_5'));
  assert.ok(codes.has('KDIGO_CKD_GUIDELINE_2024'));
  assert.ok(codes.has('CDC_PREGNANCY_FOOD_SAFETY_CURRENT_2026_09'));
});
