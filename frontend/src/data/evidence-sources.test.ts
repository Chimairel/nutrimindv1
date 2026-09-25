import { describe, expect, it } from 'vitest';
import { CLINICAL_POLICY_SUMMARIES, EVIDENCE_SOURCES } from './evidence-sources';

describe('public evidence register', () => {
  it('separates recipe provenance from clinical and nutrition authority', () => {
    const panlasang = EVIDENCE_SOURCES.find((source) => source.id === 'panlasang-pinoy');
    expect(panlasang).toMatchObject({ category: 'RECIPE_PROVENANCE', status: 'PROVENANCE_ONLY' });
    expect(panlasang?.role).toMatch(/no nutrition or safety authority/i);
  });

  it('publishes unique source identities and secure original links', () => {
    expect(new Set(EVIDENCE_SOURCES.map((source) => source.id)).size).toBe(EVIDENCE_SOURCES.length);
    for (const source of EVIDENCE_SOURCES) expect(source.href).toMatch(/^https:\/\//u);
  });

  it('keeps condition guidance in draft review rather than implying approval', () => {
    const conditionSources = EVIDENCE_SOURCES.filter((source) =>
      ['nhlbi-dash', 'ada', 'kdigo', 'niddk-ckd', 'aha', 'cdc-pregnancy', 'fda-pregnancy', 'acog'].includes(source.id)
    );
    expect(conditionSources.length).toBeGreaterThan(0);
    expect(conditionSources.every((source) => source.status === 'DRAFT_REVIEW')).toBe(true);
  });

  it('maps each published condition explanation to known evidence sources', () => {
    const sourceIds = new Set(EVIDENCE_SOURCES.map((source) => source.id));
    expect(CLINICAL_POLICY_SUMMARIES).toHaveLength(6);
    for (const policy of CLINICAL_POLICY_SUMMARIES) {
      expect(policy.evidenceSourceIds.length).toBeGreaterThan(0);
      expect(policy.evidenceSourceIds.every((sourceId) => sourceIds.has(sourceId))).toBe(true);
      expect(policy.reviewBoundary.length).toBeGreaterThan(20);
    }
  });

  it('does not present diabetes or kidney calculations as automatic clearance', () => {
    const manualPolicies = CLINICAL_POLICY_SUMMARIES.filter((policy) =>
      ['DIABETES', 'KIDNEY_DISEASE'].includes(policy.id)
    );
    expect(manualPolicies.every((policy) => /review|RND/i.test(policy.reviewBoundary))).toBe(true);
  });
});
