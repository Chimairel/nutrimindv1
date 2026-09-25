export type EvidenceSourceCategory =
  'PHILIPPINE_NUTRITION' | 'CLINICAL_METHOD' | 'SAFETY_GUIDANCE' | 'RECIPE_PROVENANCE';

export type EvidenceSourceStatus = 'USED' | 'DRAFT_REVIEW' | 'PROVENANCE_ONLY';

export interface EvidenceSource {
  id: string;
  name: string;
  shortName: string;
  mark: string;
  category: EvidenceSourceCategory;
  status: EvidenceSourceStatus;
  role: string;
  href: string;
}

/**
 * Public provenance for methods and data that appear in KAINARA. Listing an
 * organization here does not claim partnership, endorsement, or approval.
 */
export const EVIDENCE_SOURCES: readonly EvidenceSource[] = Object.freeze([
  {
    id: 'fnri-pdri',
    name: 'DOST Food and Nutrition Research Institute',
    shortName: 'DOST-FNRI PDRI',
    mark: 'FNRI',
    category: 'PHILIPPINE_NUTRITION',
    status: 'USED',
    role: 'Philippine Dietary Reference Intakes used to calculate energy-relative adult macronutrient reference ranges.',
    href: 'https://fnri.dost.gov.ph/images/images/news/PDRI-2018.pdf',
  },
  {
    id: 'fnri-enutrition',
    name: 'DOST-FNRI eNutrition',
    shortName: 'eNutrition / PhilFCT',
    mark: 'eN',
    category: 'PHILIPPINE_NUTRITION',
    status: 'USED',
    role: 'Philippine food-composition records used for ingredient reconciliation and nutrient evidence.',
    href: 'https://enutrition.fnri.dost.gov.ph/',
  },
  {
    id: 'fnri-enns',
    name: 'Expanded National Nutrition Survey',
    shortName: 'DOST-FNRI ENNS',
    mark: 'ENNS',
    category: 'PHILIPPINE_NUTRITION',
    status: 'USED',
    role: 'Published aggregate food-consumption evidence used for coarse locality preferences, never individual diagnosis.',
    href: 'https://enutrition.fnri.dost.gov.ph/uploads/2018-2019%20Facts%20and%20Figures%20-%20Food%20Consumption%20Survey.pdf',
  },
  {
    id: 'mifflin',
    name: 'Mifflin-St Jeor resting-energy equation',
    shortName: 'Mifflin et al.',
    mark: 'MSJ',
    category: 'CLINICAL_METHOD',
    status: 'USED',
    role: 'Published resting-energy estimation method; KAINARA records its limits and applies separate reviewed activity and goal policies.',
    href: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
  },
  {
    id: 'nhlbi-dash',
    name: 'National Heart, Lung, and Blood Institute',
    shortName: 'NHLBI DASH',
    mark: 'DASH',
    category: 'CLINICAL_METHOD',
    status: 'DRAFT_REVIEW',
    role: 'Daily sodium guidance for an RND-reviewed hypertension policy. Daily limits do not automatically certify one meal.',
    href: 'https://www.nhlbi.nih.gov/health/dash-eating-plan',
  },
  {
    id: 'ada',
    name: 'American Diabetes Association',
    shortName: 'ADA Standards of Care',
    mark: 'ADA',
    category: 'CLINICAL_METHOD',
    status: 'DRAFT_REVIEW',
    role: 'Energy-relative fiber calculation and individualized diabetes nutrition guidance used for review assistance only.',
    href: 'https://diabetesjournals.org/care/issue/49/Supplement_1',
  },
  {
    id: 'kdigo',
    name: 'Kidney Disease: Improving Global Outcomes',
    shortName: 'KDIGO 2024',
    mark: 'KDIGO',
    category: 'CLINICAL_METHOD',
    status: 'DRAFT_REVIEW',
    role: 'Weight-relative protein and daily sodium references for enhanced RND review; never automatic CKD clearance.',
    href: 'https://kdigo.org/guidelines/ckd-evaluation-and-management/kdigo-2024-ckd-guideline/',
  },
  {
    id: 'niddk-ckd',
    name: 'National Institute of Diabetes and Digestive and Kidney Diseases',
    shortName: 'NIDDK CKD guidance',
    mark: 'NIDDK',
    category: 'CLINICAL_METHOD',
    status: 'DRAFT_REVIEW',
    role: 'Daily sodium and weight-relative protein references present in the inactive CKD draft rules; enhanced RND review remains mandatory.',
    href: 'https://www.niddk.nih.gov/health-information/professionals/clinical-tools-patient-management/kidney-disease/identify-manage-patients/manage-ckd/slow-progression-reduce-complications',
  },
  {
    id: 'aha',
    name: 'American Heart Association',
    shortName: 'AHA',
    mark: 'AHA',
    category: 'CLINICAL_METHOD',
    status: 'DRAFT_REVIEW',
    role: 'Percent-of-energy saturated-fat reference used for cardiovascular review assistance.',
    href: 'https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/fats/saturated-fats',
  },
  {
    id: 'fda-allergens',
    name: 'U.S. Food and Drug Administration',
    shortName: 'FDA food allergens',
    mark: 'FDA',
    category: 'SAFETY_GUIDANCE',
    status: 'DRAFT_REVIEW',
    role: 'Reference for distinct major-allergen categories while Philippine requirements remain the local regulatory context.',
    href: 'https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies',
  },
  {
    id: 'cdc-pregnancy',
    name: 'Centers for Disease Control and Prevention',
    shortName: 'CDC food safety',
    mark: 'CDC',
    category: 'SAFETY_GUIDANCE',
    status: 'DRAFT_REVIEW',
    role: 'Pregnancy food-preparation risk categories used as deterministic review flags, not standalone clinical clearance.',
    href: 'https://www.cdc.gov/food-safety/foods/pregnant-women.html',
  },
  {
    id: 'fda-pregnancy',
    name: 'U.S. Food and Drug Administration',
    shortName: 'FDA food safety for pregnancy',
    mark: 'FDA',
    category: 'SAFETY_GUIDANCE',
    status: 'DRAFT_REVIEW',
    role: 'Food and preparation categories present in the inactive pregnancy ingredient-rule draft; enhanced RND review remains mandatory.',
    href: 'https://www.fda.gov/food/people-risk-foodborne-illness/meat-poultry-seafood-food-safety-moms-be',
  },
  {
    id: 'acog',
    name: 'American College of Obstetricians and Gynecologists',
    shortName: 'ACOG',
    mark: 'ACOG',
    category: 'SAFETY_GUIDANCE',
    status: 'DRAFT_REVIEW',
    role: 'Pregnancy caffeine reference requiring quantified daily intake and enhanced review.',
    href: 'https://www.acog.org/womens-health/faqs/having-a-baby',
  },
  {
    id: 'panlasang-pinoy',
    name: 'Panlasang Pinoy',
    shortName: 'Panlasang Pinoy',
    mark: 'PP',
    category: 'RECIPE_PROVENANCE',
    status: 'PROVENANCE_ONLY',
    role: 'Recipe-corpus provenance for recognizable Filipino dishes. Corpus origin provides no nutrition or safety authority.',
    href: 'https://panlasangpinoy.com/',
  },
]);

export const EVIDENCE_CATEGORY_LABELS: Readonly<Record<EvidenceSourceCategory, string>> = Object.freeze({
  PHILIPPINE_NUTRITION: 'Philippine nutrition and consumption data',
  CLINICAL_METHOD: 'Calculation methods and condition guidance',
  SAFETY_GUIDANCE: 'Food and pregnancy safety guidance',
  RECIPE_PROVENANCE: 'Recipe provenance',
});

export const EVIDENCE_STATUS_LABELS: Readonly<Record<EvidenceSourceStatus, string>> = Object.freeze({
  USED: 'Used in system',
  DRAFT_REVIEW: 'Draft policy · RND approval required',
  PROVENANCE_ONLY: 'Provenance only · no safety authority',
});
