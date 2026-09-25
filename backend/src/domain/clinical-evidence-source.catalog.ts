export type ClinicalEvidenceSourceRecord = Readonly<{
  code: string;
  issuingOrganization: string;
  title: string;
  documentType:
    | 'GUIDELINE'
    | 'REGULATION'
    | 'PEER_REVIEWED_STUDY'
    | 'GOVERNMENT_GUIDANCE'
    | 'CONSENSUS_REPORT';
  domain:
    | 'GENERAL_NUTRITION'
    | 'ENERGY_ESTIMATION'
    | 'HYPERTENSION'
    | 'DIABETES'
    | 'KIDNEY_DISEASE'
    | 'CARDIOVASCULAR'
    | 'PREGNANCY'
    | 'ALLERGEN_LABELING';
  canonicalUrl: string;
  sourceVersion: string;
  publicationDate: string | null;
  retrievedAt: string;
  sectionLocator: string;
  population: string;
  jurisdiction: string;
  exclusionsAndCaveats: string;
}>;

/**
 * Reviewed-document candidates for the clinical policy registry. A record
 * establishes provenance only. It grants no runtime authority until an exact
 * policy version is approved through ConditionRulePolicyVersion governance.
 * Corrections and new editions receive new codes instead of mutating history.
 */
export const CLINICAL_EVIDENCE_SOURCES: readonly ClinicalEvidenceSourceRecord[] = Object.freeze([
  {
    code: 'DOST_FNRI_PDRI_2015_REV_2018',
    issuingOrganization: 'DOST Food and Nutrition Research Institute',
    title: 'Philippine Dietary Reference Intakes 2015: Summary of Recommendations (revised 2018)',
    documentType: 'GUIDELINE',
    domain: 'GENERAL_NUTRITION',
    canonicalUrl: 'https://fnri.dost.gov.ph/images/images/news/PDRI-2018.pdf',
    sourceVersion: 'PDRI 2015, summary revised 2018',
    publicationDate: '2018-01-01',
    retrievedAt: '2026-09-25T00:00:00.000Z',
    sectionLocator: 'Adult AMDR and Additional Recommendations tables',
    population: 'General Filipino population; age and life-stage rows must be applied exactly as published.',
    jurisdiction: 'Philippines',
    exclusionsAndCaveats:
      'Population reference values are not individualized medical prescriptions and do not create condition clearance.',
  },
  {
    code: 'MIFFLIN_ST_JEOR_1990',
    issuingOrganization: 'American Journal of Clinical Nutrition',
    title: 'A new predictive equation for resting energy expenditure in healthy individuals',
    documentType: 'PEER_REVIEWED_STUDY',
    domain: 'ENERGY_ESTIMATION',
    canonicalUrl: 'https://pubmed.ncbi.nlm.nih.gov/2305711/',
    sourceVersion: '1990 publication',
    publicationDate: '1990-02-01',
    retrievedAt: '2026-09-25T00:00:00.000Z',
    sectionLocator: 'Published sex-specific resting-energy equations',
    population: 'Healthy adults represented in the original study, ages 19–78.',
    jurisdiction: 'Research cohort; not jurisdiction-specific',
    exclusionsAndCaveats:
      'An estimate of resting energy expenditure. Activity factors, goal adjustments, pregnancy, illness, and ages outside the study require separate policy.',
  },
  {
    code: 'NHLBI_DASH_EATING_PLAN_CURRENT_2026_09',
    issuingOrganization: 'National Heart, Lung, and Blood Institute',
    title: 'DASH Eating Plan',
    documentType: 'GOVERNMENT_GUIDANCE',
    domain: 'HYPERTENSION',
    canonicalUrl: 'https://www.nhlbi.nih.gov/health/dash-eating-plan',
    sourceVersion: 'Web guidance retrieved 2026-09-25',
    publicationDate: null,
    retrievedAt: '2026-09-25T00:00:00.000Z',
    sectionLocator: 'Daily sodium limits: 2,300 mg and the lower 1,500 mg pattern',
    population: 'Adults using the DASH dietary pattern; individual clinical context still applies.',
    jurisdiction: 'United States; candidate supporting guidance for RND-reviewed KAINARA policy',
    exclusionsAndCaveats:
      'The values are daily limits. They cannot certify one meal unless a separately reviewed allocation policy exists.',
  },
  {
    code: 'ADA_STANDARDS_2026_SECTION_5',
    issuingOrganization: 'American Diabetes Association',
    title: 'Standards of Care in Diabetes—2026, Section 5: Facilitating Positive Health Behaviors and Well-being',
    documentType: 'GUIDELINE',
    domain: 'DIABETES',
    canonicalUrl:
      'https://diabetesjournals.org/care/article/49/Supplement_1/S89/163932/5-Facilitating-Positive-Health-Behaviors-and-Well',
    sourceVersion: 'Standards of Care in Diabetes—2026',
    publicationDate: '2026-01-01',
    retrievedAt: '2026-09-25T00:00:00.000Z',
    sectionLocator: 'Nutrition recommendations; dietary fiber reference of at least 14 g per 1,000 kcal',
    population: 'People with diabetes; nutrition therapy must be individualized.',
    jurisdiction: 'Internationally referenced U.S. professional guideline',
    exclusionsAndCaveats:
      'Fiber adequacy alone cannot establish diabetes suitability. Medication, glucose response, timing, carbohydrate amount, and food quality remain relevant.',
  },
  {
    code: 'ADA_NUTRITION_CONSENSUS_2019',
    issuingOrganization: 'American Diabetes Association',
    title: 'Nutrition Therapy for Adults With Diabetes or Prediabetes: A Consensus Report',
    documentType: 'CONSENSUS_REPORT',
    domain: 'DIABETES',
    canonicalUrl:
      'https://diabetesjournals.org/care/article/42/5/731/40480/Nutrition-Therapy-for-Adults-With-Diabetes-or',
    sourceVersion: '2019 consensus report',
    publicationDate: '2019-05-01',
    retrievedAt: '2026-09-25T00:00:00.000Z',
    sectionLocator: 'Macronutrients and eating-pattern individualization',
    population: 'Adults with diabetes or prediabetes.',
    jurisdiction: 'Internationally referenced U.S. consensus report',
    exclusionsAndCaveats:
      'The report does not establish one ideal carbohydrate, protein, or fat percentage for every person with diabetes.',
  },
  {
    code: 'KDIGO_CKD_GUIDELINE_2024',
    issuingOrganization: 'Kidney Disease: Improving Global Outcomes',
    title: 'KDIGO 2024 Clinical Practice Guideline for the Evaluation and Management of Chronic Kidney Disease',
    documentType: 'GUIDELINE',
    domain: 'KIDNEY_DISEASE',
    canonicalUrl: 'https://kdigo.org/guidelines/ckd-evaluation-and-management/kdigo-2024-ckd-guideline/',
    sourceVersion: 'KDIGO 2024 CKD Guideline',
    publicationDate: '2024-03-01',
    retrievedAt: '2026-09-25T00:00:00.000Z',
    sectionLocator: 'Lifestyle and dietary management recommendations; protein and sodium intake',
    population: 'People living with chronic kidney disease, interpreted by stage and treatment context.',
    jurisdiction: 'International clinical guideline',
    exclusionsAndCaveats:
      'Stage, dialysis, nutritional status, laboratory values, medications, and comorbidities can materially change an individual plan.',
  },
  {
    code: 'NIDDK_CKD_MANAGEMENT_CURRENT_2026_09',
    issuingOrganization: 'National Institute of Diabetes and Digestive and Kidney Diseases',
    title: 'Identify and Manage Patients with Chronic Kidney Disease',
    documentType: 'GOVERNMENT_GUIDANCE',
    domain: 'KIDNEY_DISEASE',
    canonicalUrl:
      'https://www.niddk.nih.gov/health-information/professionals/clinical-tools-patient-management/kidney-disease/identify-manage-patients/manage-ckd/slow-progression-reduce-complications',
    sourceVersion: 'Professional web guidance retrieved 2026-09-25',
    publicationDate: null,
    retrievedAt: '2026-09-25T00:00:00.000Z',
    sectionLocator: 'Medical nutrition therapy; sodium, protein, potassium, and phosphorus guidance',
    population: 'Adults with chronic kidney disease under individualized medical nutrition therapy.',
    jurisdiction: 'United States; candidate supporting guidance for RND review',
    exclusionsAndCaveats:
      'Potassium and phosphorus restrictions are not universal fixed limits. NIDDK directs individualized management with a dietitian.',
  },
  {
    code: 'AHA_SATURATED_FAT_CURRENT_2026_09',
    issuingOrganization: 'American Heart Association',
    title: 'Saturated Fats',
    documentType: 'GUIDELINE',
    domain: 'CARDIOVASCULAR',
    canonicalUrl: 'https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/fats/saturated-fats',
    sourceVersion: 'Web guidance retrieved 2026-09-25',
    publicationDate: null,
    retrievedAt: '2026-09-25T00:00:00.000Z',
    sectionLocator: 'Recommendation for people who need to lower LDL cholesterol: less than 6% of calories',
    population: 'People for whom lowering LDL cholesterol is clinically indicated.',
    jurisdiction: 'United States; candidate supporting guidance for RND review',
    exclusionsAndCaveats:
      'A percent-of-energy target applies to the complete daily diet and does not represent every cardiovascular diagnosis.',
  },
  {
    code: 'AHA_SODIUM_CURRENT_2026_09',
    issuingOrganization: 'American Heart Association',
    title: 'How Much Sodium Should I Eat Per Day?',
    documentType: 'GUIDELINE',
    domain: 'CARDIOVASCULAR',
    canonicalUrl: 'https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/sodium/sodium-and-salt',
    sourceVersion: 'Web guidance retrieved 2026-09-25',
    publicationDate: null,
    retrievedAt: '2026-09-25T00:00:00.000Z',
    sectionLocator: 'Daily sodium recommendation for most adults',
    population: 'General adults and people using a cardiovascular dietary pattern.',
    jurisdiction: 'United States; candidate supporting guidance for RND review',
    exclusionsAndCaveats:
      'This is a daily recommendation and cannot by itself clear a meal for an unspecified heart condition.',
  },
  {
    code: 'CDC_PREGNANCY_FOOD_SAFETY_CURRENT_2026_09',
    issuingOrganization: 'Centers for Disease Control and Prevention',
    title: 'Safer Food Choices for Pregnant Women',
    documentType: 'GOVERNMENT_GUIDANCE',
    domain: 'PREGNANCY',
    canonicalUrl: 'https://www.cdc.gov/food-safety/foods/pregnant-women.html',
    sourceVersion: 'Web guidance retrieved 2026-09-25',
    publicationDate: null,
    retrievedAt: '2026-09-25T00:00:00.000Z',
    sectionLocator: 'Risk-based safer choices by meat, seafood, egg, dairy, juice, and sprout category',
    population: 'Pregnant people.',
    jurisdiction: 'United States; food-safety guidance used as a candidate review source',
    exclusionsAndCaveats:
      'Ingredient names alone may not establish cooking temperature, pasteurization, handling, or mercury category.',
  },
  {
    code: 'FDA_PREGNANCY_FOOD_SAFETY_CURRENT_2026_09',
    issuingOrganization: 'U.S. Food and Drug Administration',
    title: 'Food Safety for Moms-to-Be: While You Are Pregnant',
    documentType: 'GOVERNMENT_GUIDANCE',
    domain: 'PREGNANCY',
    canonicalUrl:
      'https://www.fda.gov/food/people-risk-foodborne-illness/meat-poultry-seafood-food-safety-moms-be',
    sourceVersion: 'Web guidance retrieved 2026-09-25',
    publicationDate: null,
    retrievedAt: '2026-09-25T00:00:00.000Z',
    sectionLocator: 'Meat, poultry, seafood, dairy, egg, and preparation safety sections',
    population: 'Pregnant people.',
    jurisdiction: 'United States; food-safety guidance used as a candidate review source',
    exclusionsAndCaveats:
      'Preparation and handling facts must be known. This source does not define a reusable condition clearance by itself.',
  },
  {
    code: 'ACOG_HAVING_A_BABY_CURRENT_2026_09',
    issuingOrganization: 'American College of Obstetricians and Gynecologists',
    title: 'Having a Baby',
    documentType: 'GUIDELINE',
    domain: 'PREGNANCY',
    canonicalUrl: 'https://www.acog.org/womens-health/faqs/having-a-baby',
    sourceVersion: 'Patient FAQ retrieved 2026-09-25',
    publicationDate: null,
    retrievedAt: '2026-09-25T00:00:00.000Z',
    sectionLocator: 'Caffeine during pregnancy: less than 200 mg per day',
    population: 'Pregnant people.',
    jurisdiction: 'United States; candidate supporting guidance for RND review',
    exclusionsAndCaveats:
      'A coffee or tea ingredient match cannot quantify caffeine. Total daily exposure and serving information are required.',
  },
  {
    code: 'FDA_MAJOR_FOOD_ALLERGENS_CURRENT_2026_09',
    issuingOrganization: 'U.S. Food and Drug Administration',
    title: 'Food Allergies',
    documentType: 'REGULATION',
    domain: 'ALLERGEN_LABELING',
    canonicalUrl: 'https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies',
    sourceVersion: 'Web and statutory labeling summary retrieved 2026-09-25',
    publicationDate: null,
    retrievedAt: '2026-09-25T00:00:00.000Z',
    sectionLocator: 'Major food allergens and packaged-food labeling requirements',
    population: 'Consumers of FDA-regulated packaged foods.',
    jurisdiction: 'United States; taxonomy support only in the Philippine application context',
    exclusionsAndCaveats:
      'A labeling taxonomy is not a safe-dose threshold and does not prove absence of cross-contact or undeclared ingredients.',
  },
  {
    code: 'PH_FDA_AO_2014_0030A',
    issuingOrganization: 'Philippine Food and Drug Administration',
    title: 'Administrative Order No. 2014-0030-A: Revised Rules and Regulations Governing the Labeling of Prepackaged Food Products',
    documentType: 'REGULATION',
    domain: 'ALLERGEN_LABELING',
    canonicalUrl: 'https://www.fda.gov.ph/administrative-order-no-2014-0030-a/',
    sourceVersion: 'AO 2014-0030-A',
    publicationDate: '2014-01-01',
    retrievedAt: '2026-09-25T00:00:00.000Z',
    sectionLocator: 'Prepackaged-food ingredient and allergen labeling provisions and attachments',
    population: 'Consumers of prepackaged food products regulated in the Philippines.',
    jurisdiction: 'Philippines',
    exclusionsAndCaveats:
      'Label compliance is evidence about declared packaged-food content. It does not establish cross-contact absence or recipe safety.',
  },
]);

export function clinicalEvidenceSourceByCode(code: string): ClinicalEvidenceSourceRecord | undefined {
  return CLINICAL_EVIDENCE_SOURCES.find((source) => source.code === code);
}
