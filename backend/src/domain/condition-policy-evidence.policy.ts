export interface GovernedConditionRuleEvidence {
  id: string;
  evidenceSourceId?: string | null;
  evidenceLocator?: string | null;
  applicablePopulation?: string | null;
  requiredInputs?: unknown;
  exclusionsAndCaveats?: string | null;
  evaluationScope?: string | null;
  authorityOutcome?: string | null;
  evidenceSource?: { state: string; code?: string } | null;
}

export type ConditionRuleEvidenceDefect =
  | 'MISSING_VERSIONED_SOURCE'
  | 'SOURCE_NOT_CURRENT'
  | 'MISSING_EXACT_LOCATOR'
  | 'MISSING_POPULATION'
  | 'MISSING_REQUIRED_INPUTS'
  | 'MISSING_CAVEATS'
  | 'MISSING_EVALUATION_SCOPE'
  | 'MISSING_AUTHORITY_OUTCOME';

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasRequiredInputs(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0);
}

/**
 * Policy activation fails closed when a rule cannot explain which immutable
 * source revision supports it, who it applies to, what evidence it consumes,
 * and what authority its result is allowed to carry.
 */
export function getConditionRuleEvidenceDefects(rule: GovernedConditionRuleEvidence): ConditionRuleEvidenceDefect[] {
  const defects: ConditionRuleEvidenceDefect[] = [];
  if (!rule.evidenceSourceId || !rule.evidenceSource) defects.push('MISSING_VERSIONED_SOURCE');
  else if (rule.evidenceSource.state !== 'CURRENT') defects.push('SOURCE_NOT_CURRENT');
  if (!hasText(rule.evidenceLocator)) defects.push('MISSING_EXACT_LOCATOR');
  if (!hasText(rule.applicablePopulation)) defects.push('MISSING_POPULATION');
  if (!hasRequiredInputs(rule.requiredInputs)) defects.push('MISSING_REQUIRED_INPUTS');
  if (!hasText(rule.exclusionsAndCaveats)) defects.push('MISSING_CAVEATS');
  if (!hasText(rule.evaluationScope)) defects.push('MISSING_EVALUATION_SCOPE');
  if (!hasText(rule.authorityOutcome)) defects.push('MISSING_AUTHORITY_OUTCOME');
  return defects;
}

export function assertConditionPolicyEvidenceComplete(rules: readonly GovernedConditionRuleEvidence[]): void {
  if (rules.length === 0) throw new Error('A condition policy must contain at least one governed rule.');
  const invalid = rules
    .map((rule) => ({ id: rule.id, defects: getConditionRuleEvidenceDefects(rule) }))
    .filter((entry) => entry.defects.length > 0);
  if (invalid.length > 0) {
    const details = invalid.map((entry) => `${entry.id}: ${entry.defects.join(', ')}`).join('; ');
    throw new Error(`Condition policy evidence is incomplete: ${details}`);
  }
}
