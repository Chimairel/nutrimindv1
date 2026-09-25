import { describe, expect, it } from 'vitest';
import { EVIDENCE_SOURCES } from './evidence-sources';

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
});
