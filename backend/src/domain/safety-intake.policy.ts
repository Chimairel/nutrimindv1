export const SAFETY_INTAKE_POLICY_VERSION = 'NUTRIMIND_SAFETY_INTAKE_V1';

export const SAFETY_ENTRY_DOMAINS = [
  'CONDITION',
  'ALLERGY',
  'INTOLERANCE',
  'AVOIDED_INGREDIENT',
] as const;

export const SAFETY_ENTRY_PROVENANCE = ['PREDEFINED', 'CUSTOM'] as const;
export const SAFETY_SUPPORT_STATES = [
  'SUPPORTED',
  'RECOGNIZED_UNSUPPORTED',
  'NEEDS_CLARIFICATION',
  'PENDING_REVIEW',
  'INVALID',
] as const;

export type SafetyEntryDomain = typeof SAFETY_ENTRY_DOMAINS[number];
export type SafetyEntryProvenance = typeof SAFETY_ENTRY_PROVENANCE[number];
export type SafetySupportState = typeof SAFETY_SUPPORT_STATES[number];

export interface SafetyCatalogueItem {
  code: string;
  displayName: string;
  aliases: readonly string[];
  searchTerms: readonly string[];
  domains: readonly SafetyEntryDomain[];
  supportState: Exclude<SafetySupportState, 'NEEDS_CLARIFICATION' | 'PENDING_REVIEW' | 'INVALID'>;
  policyReference: string;
}

export interface SafetyEntryInput {
  domain: SafetyEntryDomain;
  value: string;
  provenance: SafetyEntryProvenance;
}

export interface ResolvedSafetyEntry {
  domain: SafetyEntryDomain;
  canonicalCode: string | null;
  displayName: string;
  originalText: string;
  normalizedText: string;
  provenance: SafetyEntryProvenance;
  supportState: SafetySupportState;
  policyReference: string;
}

const condition = (
  code: string,
  displayName: string,
  aliases: string[],
  supportState: SafetyCatalogueItem['supportState'],
  policyReference: string
): SafetyCatalogueItem => ({ code, displayName, aliases, searchTerms: aliases, domains: ['CONDITION'], supportState, policyReference });

const food = (
  code: string,
  displayName: string,
  aliases: string[],
  domains: SafetyEntryDomain[],
  supportState: SafetyCatalogueItem['supportState'],
  policyReference: string
): SafetyCatalogueItem => ({ code, displayName, aliases, searchTerms: aliases, domains, supportState, policyReference });

export const CONDITION_SAFETY_CATALOGUE: readonly SafetyCatalogueItem[] = Object.freeze([
  condition('NONE', 'No diagnosed condition', ['none', 'no condition', 'healthy'], 'SUPPORTED', 'ONBOARDING_NONE_V1'),
  condition('DIABETES', 'Diabetes', ['diabetes', 'type 1 diabetes', 'type 2 diabetes', 't1d', 't2d'], 'SUPPORTED', 'CATALOGUE_DIABETES_60G_CARB_V1'),
  condition('HYPERTENSION', 'Hypertension', ['hypertension', 'high blood pressure', 'htn', 'hypertention'], 'SUPPORTED', 'CATALOGUE_HYPERTENSION_600MG_SODIUM_V1'),
  condition('KIDNEY_DISEASE', 'Kidney disease', ['kidney disease', 'chronic kidney disease', 'ckd', 'renal disease'], 'RECOGNIZED_UNSUPPORTED', 'HIGH_RISK_INDIVIDUAL_REVIEW_V1'),
  condition('HEART_CONDITION', 'Heart condition', ['heart condition', 'heart disease', 'cardiovascular disease'], 'RECOGNIZED_UNSUPPORTED', 'INDIVIDUAL_REVIEW_REQUIRED_V1'),
  condition('PREGNANT', 'Pregnant or lactating', ['pregnant', 'pregnancy', 'lactating', 'breastfeeding'], 'RECOGNIZED_UNSUPPORTED', 'HIGH_RISK_TWO_REVIEWER_V1'),
  condition('GOUT', 'Gout', ['gout', 'hyperuricemia'], 'RECOGNIZED_UNSUPPORTED', 'INDIVIDUAL_REVIEW_REQUIRED_V1'),
  condition('CELIAC_DISEASE', 'Celiac disease', ['celiac disease', 'coeliac disease', 'celiac'], 'RECOGNIZED_UNSUPPORTED', 'INDIVIDUAL_REVIEW_REQUIRED_V1'),
  condition('PCOS', 'Polycystic ovary syndrome', ['polycystic ovary syndrome', 'pcos'], 'RECOGNIZED_UNSUPPORTED', 'INDIVIDUAL_REVIEW_REQUIRED_V1'),
  condition('GERD', 'Gastroesophageal reflux disease', ['gerd', 'acid reflux', 'gastroesophageal reflux disease'], 'RECOGNIZED_UNSUPPORTED', 'INDIVIDUAL_REVIEW_REQUIRED_V1'),
]);

export const FOOD_SAFETY_CATALOGUE: readonly SafetyCatalogueItem[] = Object.freeze([
  food('NONE', 'No food restriction', ['none', 'no allergy', 'no food restriction'], ['ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT'], 'SUPPORTED', 'ONBOARDING_NONE_V1'),
  food('SHELLFISH', 'Shellfish', ['shellfish', 'shrimp', 'prawn', 'crab'], ['ALLERGY', 'AVOIDED_INGREDIENT'], 'SUPPORTED', 'LIBRARY_ALLERGEN_DECLARATION_V1'),
  food('NUTS', 'Peanuts and tree nuts', ['nuts', 'peanut', 'peanuts', 'tree nut', 'tree nuts'], ['ALLERGY', 'AVOIDED_INGREDIENT'], 'SUPPORTED', 'LIBRARY_ALLERGEN_DECLARATION_V1'),
  food('DAIRY', 'Dairy', ['dairy', 'milk', 'milk allergy'], ['ALLERGY', 'AVOIDED_INGREDIENT'], 'SUPPORTED', 'LIBRARY_ALLERGEN_DECLARATION_V1'),
  food('GLUTEN', 'Gluten', ['gluten', 'wheat', 'wheat allergy'], ['ALLERGY', 'AVOIDED_INGREDIENT'], 'SUPPORTED', 'LIBRARY_ALLERGEN_DECLARATION_V1'),
  food('EGGS', 'Eggs', ['egg', 'eggs', 'egg allergy'], ['ALLERGY', 'AVOIDED_INGREDIENT'], 'SUPPORTED', 'LIBRARY_ALLERGEN_DECLARATION_V1'),
  food('LACTOSE', 'Lactose', ['lactose', 'lactose intolerance'], ['INTOLERANCE', 'AVOIDED_INGREDIENT'], 'RECOGNIZED_UNSUPPORTED', 'INDIVIDUAL_REVIEW_REQUIRED_V1'),
  food('SOY', 'Soy', ['soy', 'soya', 'soybean'], ['ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT'], 'RECOGNIZED_UNSUPPORTED', 'INDIVIDUAL_REVIEW_REQUIRED_V1'),
  food('FISH', 'Fish', ['fish', 'fish allergy'], ['ALLERGY', 'AVOIDED_INGREDIENT'], 'RECOGNIZED_UNSUPPORTED', 'INDIVIDUAL_REVIEW_REQUIRED_V1'),
  food('SESAME', 'Sesame', ['sesame', 'sesame seed'], ['ALLERGY', 'AVOIDED_INGREDIENT'], 'RECOGNIZED_UNSUPPORTED', 'INDIVIDUAL_REVIEW_REQUIRED_V1'),
  food('MSG', 'Monosodium glutamate (MSG)', ['msg', 'monosodium glutamate'], ['INTOLERANCE', 'AVOIDED_INGREDIENT'], 'RECOGNIZED_UNSUPPORTED', 'INDIVIDUAL_REVIEW_REQUIRED_V1'),
  food('PORK', 'Pork', ['pork', 'baboy'], ['AVOIDED_INGREDIENT'], 'RECOGNIZED_UNSUPPORTED', 'INDIVIDUAL_REVIEW_REQUIRED_V1'),
  food('BEEF', 'Beef', ['beef', 'baka'], ['AVOIDED_INGREDIENT'], 'RECOGNIZED_UNSUPPORTED', 'INDIVIDUAL_REVIEW_REQUIRED_V1'),
]);

const vagueTerms = new Set(['high sugar', 'heart problem', 'stomach problem', 'sensitive', 'allergic', 'pain', 'sick']);
const invalidTerms = new Set(['n/a', 'na', 'nil', 'asdf', 'unknown', 'test', '-']);

export function normalizeSafetyText(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

export function splitSafetyInput(value: string): string[] {
  return value
    .split(/[,;\/\n\r]+/)
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

function catalogueFor(domain: SafetyEntryDomain): readonly SafetyCatalogueItem[] {
  return domain === 'CONDITION' ? CONDITION_SAFETY_CATALOGUE : FOOD_SAFETY_CATALOGUE;
}

function findCatalogueItem(domain: SafetyEntryDomain, value: string, provenance: SafetyEntryProvenance) {
  const normalized = normalizeSafetyText(value);
  return catalogueFor(domain).find((item) => {
    if (!item.domains.includes(domain)) return false;
    if (provenance === 'PREDEFINED') return item.code === value;
    return [item.code, item.displayName, ...item.aliases].some((candidate) => normalizeSafetyText(candidate) === normalized);
  });
}

export function resolveSafetyEntries(inputs: readonly SafetyEntryInput[]): ResolvedSafetyEntry[] {
  const resolved: ResolvedSafetyEntry[] = [];
  for (const input of inputs) {
    for (const supplied of splitSafetyInput(input.value)) {
      const oversized = supplied.length > 120;
      const original = supplied.slice(0, 120);
      const normalizedText = normalizeSafetyText(original);
      const item = findCatalogueItem(input.domain, original, input.provenance);
      const supportState: SafetySupportState = item
        ? item.supportState
        : input.provenance === 'PREDEFINED' || oversized || invalidTerms.has(normalizedText) || normalizedText.length < 2
          ? 'INVALID'
          : vagueTerms.has(normalizedText)
            ? 'NEEDS_CLARIFICATION'
            : 'PENDING_REVIEW';
      const entry: ResolvedSafetyEntry = {
        domain: input.domain,
        canonicalCode: item?.code ?? null,
        displayName: item?.displayName ?? original,
        originalText: original,
        normalizedText,
        provenance: input.provenance,
        supportState,
        policyReference: item?.policyReference ?? `${SAFETY_INTAKE_POLICY_VERSION}:UNMAPPED`,
      };
      const dedupeKey = `${entry.domain}:${entry.canonicalCode ?? entry.normalizedText}`;
      if (!resolved.some((candidate) => `${candidate.domain}:${candidate.canonicalCode ?? candidate.normalizedText}` === dedupeKey)) {
        resolved.push(entry);
      }
    }
  }
  return resolved;
}

export function validateResolvedSafetyEntries(entries: readonly ResolvedSafetyEntry[]): string[] {
  const errors: string[] = [];
  const invalid = entries.filter((entry) => entry.supportState === 'INVALID');
  const vague = entries.filter((entry) => entry.supportState === 'NEEDS_CLARIFICATION');
  if (invalid.length) errors.push('Remove invalid safety entries before saving.');
  if (vague.length) errors.push('Clarify vague safety entries before saving.');
  for (const domain of SAFETY_ENTRY_DOMAINS) {
    const values = entries.filter((entry) => entry.domain === domain);
    if (values.some((entry) => entry.canonicalCode === 'NONE') && values.some((entry) => entry.canonicalCode !== 'NONE')) {
      errors.push(`NONE cannot be combined with another ${domain.toLowerCase().replace('_', ' ')} entry.`);
    }
  }
  return errors;
}

export function getPublicSafetyCatalogue() {
  const mapItem = (item: SafetyCatalogueItem) => ({
    code: item.code,
    displayName: item.displayName,
    aliases: item.aliases,
    searchTerms: item.searchTerms,
    domains: item.domains,
    supportState: item.supportState,
    policyReference: item.policyReference,
  });
  return {
    version: SAFETY_INTAKE_POLICY_VERSION,
    conditions: CONDITION_SAFETY_CATALOGUE.map(mapItem),
    foodSafety: FOOD_SAFETY_CATALOGUE.map(mapItem),
  };
}
