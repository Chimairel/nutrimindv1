export type EvidenceSourceCategory =
  | 'PHILIPPINE_NUTRITION'
  | 'INTERNATIONAL_FOOD_COMPOSITION'
  | 'CLINICAL_METHOD'
  | 'SAFETY_GUIDANCE'
  | 'RECIPE_PROVENANCE';

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
  sourceVersion?: string;
  locator?: string;
  population?: string;
  limitation?: string;
}

export interface ClinicalPolicySummary {
  id: 'HYPERTENSION' | 'DIABETES' | 'KIDNEY_DISEASE' | 'HEART_CONDITION' | 'PREGNANCY' | 'ALLERGIES';
  label: string;
  explanation: string;
  evidenceSourceIds: readonly string[];
  deterministicUse: readonly string[];
  calculation?: string;
  reviewBoundary: string;
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
    sourceVersion: 'PDRI 2015 · summary revised 2018',
    locator: 'Adult AMDR and Additional Recommendations tables',
    population: 'General Filipino population, using the exact published age and life-stage row.',
    limitation: 'A population reference range is not an individualized prescription or condition clearance.',
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
    id: 'usda-fdc',
    name: 'USDA FoodData Central',
    shortName: 'USDA FDC',
    mark: 'USDA',
    category: 'INTERNATIONAL_FOOD_COMPOSITION',
    status: 'USED',
    role: 'Downloaded food composition records used only when a unique exact identity or admin verified alias has no FNRI match.',
    href: 'https://fdc.nal.usda.gov/download-datasets/',
    sourceVersion: 'Foundation Foods April 2026; FNDDS 2021–2023; SR Legacy April 2018',
    limitation:
      'US food nutrients do not establish Philippine product equivalence, allergy safety, medical suitability, or reusable meal certification.',
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
    sourceVersion: '1990 peer-reviewed publication',
    locator: 'Published sex-specific resting-energy equations',
    population: 'Healthy adults represented in the original study, ages 19–78.',
    limitation: 'Activity factors, goal changes, illness, pregnancy and ages outside the study need separate policy.',
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
    sourceVersion: 'Web guidance retrieved September 25, 2026',
    locator: 'Daily sodium limits: 2,300 mg and the lower 1,500 mg pattern',
    population: 'Adults using a DASH dietary pattern.',
    limitation: 'These are daily limits and cannot be applied directly to one reusable meal.',
  },
  {
    id: 'ada',
    name: 'American Diabetes Association',
    shortName: 'ADA Standards of Care',
    mark: 'ADA',
    category: 'CLINICAL_METHOD',
    status: 'DRAFT_REVIEW',
    role: 'Energy-relative fiber calculation and individualized diabetes nutrition guidance used for review assistance only.',
    href: 'https://diabetesjournals.org/care/article/49/Supplement_1/S89/163932/5-Facilitating-Positive-Health-Behaviors-and-Well',
    sourceVersion: 'Standards of Care in Diabetes—2026',
    locator: 'Section 5 nutrition recommendations; at least 14 g fiber per 1,000 kcal',
    population: 'People with diabetes receiving individualized nutrition therapy.',
    limitation: 'Fiber adequacy alone cannot establish diabetes suitability.',
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
    sourceVersion: 'KDIGO 2024 CKD Guideline',
    locator: 'Lifestyle and dietary management recommendations',
    population: 'People living with CKD, interpreted by stage and treatment context.',
    limitation: 'Stage, dialysis, labs, medication and nutritional status can change the appropriate plan.',
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
    sourceVersion: 'Professional web guidance retrieved September 25, 2026',
    locator: 'Medical nutrition therapy; sodium, protein, potassium and phosphorus guidance',
    population: 'Adults with CKD under individualized medical nutrition therapy.',
    limitation: 'Potassium and phosphorus restrictions depend on clinical context rather than one universal limit.',
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
    sourceVersion: 'Web guidance retrieved September 25, 2026',
    locator: 'Less than 6% of calories when lowering LDL cholesterol is indicated',
    population: 'People for whom lowering LDL cholesterol is clinically indicated.',
    limitation: 'This daily target does not represent every cardiovascular diagnosis.',
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
    sourceVersion: 'Web and statutory labeling summary retrieved September 25, 2026',
    locator: 'Major food allergens and packaged-food labeling requirements',
    population: 'Consumers of FDA-regulated packaged foods.',
    limitation: 'A label taxonomy is not a safe-dose threshold or proof that cross-contact is absent.',
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
    sourceVersion: 'Web guidance retrieved September 25, 2026',
    locator: 'Safer choices by meat, seafood, egg, dairy, juice and sprout category',
    population: 'Pregnant people.',
    limitation: 'Ingredient text alone may not prove cooking temperature, pasteurization or handling.',
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
    sourceVersion: 'Web guidance retrieved September 25, 2026',
    locator: 'Meat, poultry, seafood, dairy, egg and preparation safety sections',
    population: 'Pregnant people.',
    limitation: 'Preparation and handling facts must be known; the source does not create reusable clearance.',
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
    sourceVersion: 'Patient FAQ retrieved September 25, 2026',
    locator: 'Caffeine during pregnancy: less than 200 mg per day',
    population: 'Pregnant people.',
    limitation: 'A coffee or tea ingredient match cannot quantify total daily caffeine.',
  },
  {
    id: 'ada-consensus',
    name: 'American Diabetes Association',
    shortName: 'ADA nutrition consensus',
    mark: 'ADA',
    category: 'CLINICAL_METHOD',
    status: 'DRAFT_REVIEW',
    role: 'Supports individualized diabetes nutrition rather than a universal carbohydrate or sugar ceiling.',
    href: 'https://diabetesjournals.org/care/article/42/5/731/40480/Nutrition-Therapy-for-Adults-With-Diabetes-or',
    sourceVersion: '2019 consensus report',
    locator: 'Macronutrients and eating-pattern individualization',
    population: 'Adults with diabetes or prediabetes.',
    limitation: 'No single macronutrient percentage is appropriate for every person with diabetes.',
  },
  {
    id: 'aha-sodium',
    name: 'American Heart Association',
    shortName: 'AHA sodium guidance',
    mark: 'AHA',
    category: 'CLINICAL_METHOD',
    status: 'DRAFT_REVIEW',
    role: 'Daily sodium reference used for cardiovascular review assistance at complete-day scope.',
    href: 'https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/sodium/sodium-and-salt',
    sourceVersion: 'Web guidance retrieved September 25, 2026',
    locator: 'Daily sodium recommendation for most adults',
    population: 'General adults and people using a cardiovascular dietary pattern.',
    limitation: 'A daily sodium result cannot clear one meal or every cardiovascular diagnosis.',
  },
  {
    id: 'ph-fda-labeling',
    name: 'Philippine Food and Drug Administration',
    shortName: 'Philippine FDA labeling',
    mark: 'PH FDA',
    category: 'SAFETY_GUIDANCE',
    status: 'DRAFT_REVIEW',
    role: 'Local regulatory context for ingredient and allergen declarations on prepackaged foods.',
    href: 'https://www.fda.gov.ph/administrative-order-no-2014-0030-a/',
    sourceVersion: 'Administrative Order No. 2014-0030-A',
    locator: 'Prepackaged-food ingredient and allergen labeling provisions and attachments',
    population: 'Consumers of prepackaged foods regulated in the Philippines.',
    limitation: 'Label compliance does not prove absence of cross-contact or make a recipe clinically safe.',
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

export const CLINICAL_POLICY_SUMMARIES: readonly ClinicalPolicySummary[] = Object.freeze([
  {
    id: 'HYPERTENSION',
    label: 'Hypertension',
    explanation:
      'A blood-pressure condition for which KAINARA can evaluate an approved sodium policy only against a complete day of meals.',
    evidenceSourceIds: ['nhlbi-dash', 'fnri-pdri'],
    deterministicUse: [
      'Sum sodium across the complete day',
      'Compare the daily total with the selected policy version',
    ],
    calculation: 'Daily sodium total = sum of sodium from every planned ingredient and meal',
    reviewBoundary:
      'The 2,300 mg and 1,500 mg values are different policy variants. Neither becomes active until the exact variant and scope are approved by RNDs.',
  },
  {
    id: 'DIABETES',
    label: 'Diabetes',
    explanation:
      'Diabetes affects glucose regulation. KAINARA can calculate fiber adequacy and show carbohydrate evidence, but one number cannot establish meal suitability.',
    evidenceSourceIds: ['ada', 'ada-consensus'],
    deterministicUse: [
      'Calculate the daily fiber reference',
      'Flag refined carbohydrate or missing nutrient evidence for review',
    ],
    calculation: 'Fiber reference = daily calories ÷ 1,000 × 14 g',
    reviewBoundary:
      'Medication, glucose response, carbohydrate amount and timing remain individualized, so diabetes clearance requires an RND.',
  },
  {
    id: 'KIDNEY_DISEASE',
    label: 'Kidney disease',
    explanation:
      'Kidney disease can change protein, sodium, potassium and phosphorus needs. Those needs depend on structured clinical context.',
    evidenceSourceIds: ['kdigo', 'niddk-ckd'],
    deterministicUse: [
      'Calculate a review reference when weight and complete-day evidence exist',
      'Mark missing stage, dialysis or nutrient evidence as unevaluable',
    ],
    calculation: 'Candidate protein reference = body weight in kg × approved g/kg/day coefficient',
    reviewBoundary:
      'Stage, dialysis, labs, medication and nutritional status prevent broad automatic clearance. Two independent reviews remain required.',
  },
  {
    id: 'HEART_CONDITION',
    label: 'Heart condition',
    explanation:
      'This intake category covers different cardiovascular diagnoses, so sodium and saturated-fat checks are review evidence rather than a diagnosis-wide answer.',
    evidenceSourceIds: ['aha', 'aha-sodium'],
    deterministicUse: [
      'Calculate saturated fat as a percentage of daily energy',
      'Sum complete-day sodium when available',
    ],
    calculation: 'Saturated-fat reference = daily calories × 6% ÷ 9 kcal per gram',
    reviewBoundary:
      'The 6% value applies when lowering LDL is indicated. Diagnosis subtype and treatment context require enhanced review.',
  },
  {
    id: 'PREGNANCY',
    label: 'Pregnancy',
    explanation:
      'Pregnancy checks depend on ingredient identity, cooking state, pasteurization, mercury category and quantified daily caffeine.',
    evidenceSourceIds: ['cdc-pregnancy', 'fda-pregnancy', 'acog'],
    deterministicUse: [
      'Block definite high-risk ingredient or preparation conflicts',
      'Flag unknown preparation facts and caffeine quantity',
    ],
    calculation:
      'Daily caffeine total = sum of quantified caffeine across every serving; candidate limit is under 200 mg/day',
    reviewBoundary:
      'Unknown preparation or quantity fails closed. Pregnancy remains enhanced review, and lactation needs a separate policy.',
  },
  {
    id: 'ALLERGIES',
    label: 'Food allergies and intolerances',
    explanation:
      'Allergy, intolerance and preference are separate facts. A declared allergen conflict is excluded rather than balanced against a nutrient target.',
    evidenceSourceIds: ['ph-fda-labeling', 'fda-allergens'],
    deterministicUse: [
      'Match declared ingredients and known derivatives',
      'Exclude a definite conflict',
      'Treat ambiguous labels and cross-contact as unknown',
    ],
    reviewBoundary:
      'KAINARA does not invent a generally safe exposure amount. Missing declarations, compound ingredients and cross-contact require review.',
  },
]);

export const EVIDENCE_CATEGORY_LABELS: Readonly<Record<EvidenceSourceCategory, string>> = Object.freeze({
  PHILIPPINE_NUTRITION: 'Philippine nutrition and consumption data',
  INTERNATIONAL_FOOD_COMPOSITION: 'International food composition fallback',
  CLINICAL_METHOD: 'Calculation methods and condition guidance',
  SAFETY_GUIDANCE: 'Food and pregnancy safety guidance',
  RECIPE_PROVENANCE: 'Recipe provenance',
});

export const EVIDENCE_STATUS_LABELS: Readonly<Record<EvidenceSourceStatus, string>> = Object.freeze({
  USED: 'Used in system',
  DRAFT_REVIEW: 'Draft policy · RND approval required',
  PROVENANCE_ONLY: 'Provenance only · no safety authority',
});
