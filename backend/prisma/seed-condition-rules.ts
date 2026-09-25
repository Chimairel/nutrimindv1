import {
  AssuranceTier,
  ClinicalEvidenceDocumentType,
  ClinicalEvidenceDomain,
  ConditionRuleBasis,
  ConditionRuleAuthority,
  ConditionRuleEvaluationScope,
  ConditionRuleNutrient,
  ConditionRuleOperator,
  ConditionRuleReviewStatus,
  ConditionRuleSeverity,
  HealthConditionType,
  PrismaClient,
} from '@prisma/client';
import { CLINICAL_EVIDENCE_SOURCES } from '../src/domain/clinical-evidence-source.catalog';

const prisma = new PrismaClient();
const POLICY_VERSION = 'CONDITION_RULES_DRAFT_V1';

const nutrientRules = [
  {
    id: 'draft-htn-sodium-2300',
    condition: HealthConditionType.HYPERTENSION,
    nutrient: ConditionRuleNutrient.SODIUM_MG,
    operator: ConditionRuleOperator.LESS_THAN_OR_EQUAL,
    threshold: 2300,
    unit: 'mg',
    basis: ConditionRuleBasis.DAILY_TOTAL,
    severity: ConditionRuleSeverity.HARD_BLOCK,
    rationale: 'DASH uses 2,300 mg sodium per day as the standard limit; the lower target is represented separately.',
    sourceTitle: 'NHLBI DASH Eating Plan',
    sourceCitation: 'https://www.nhlbi.nih.gov/health/dash-eating-plan',
    evidenceSourceCode: 'NHLBI_DASH_EATING_PLAN_CURRENT_2026_09',
    evidenceLocator: 'Daily sodium limits: 2,300 mg/day standard DASH pattern',
    applicablePopulation: 'Adults using the DASH dietary pattern under the approved KAINARA hypertension policy.',
    requiredInputs: { dailyTotals: ['sodiumMg'], requiredScope: 'DAY' },
    exclusionsAndCaveats:
      'A daily limit cannot be applied to one meal. Automatic clearance requires a complete day and an active, RND-approved policy version.',
    evaluationScope: ConditionRuleEvaluationScope.DAY,
    authorityOutcome: ConditionRuleAuthority.CLEARANCE_ELIGIBLE,
    formulaCode: 'FIXED_DAILY_TOTAL',
  },
  {
    id: 'draft-htn-sodium-1500',
    condition: HealthConditionType.HYPERTENSION,
    nutrient: ConditionRuleNutrient.SODIUM_MG,
    operator: ConditionRuleOperator.LESS_THAN_OR_EQUAL,
    threshold: 1500,
    unit: 'mg',
    basis: ConditionRuleBasis.DAILY_TOTAL,
    severity: ConditionRuleSeverity.FLAG,
    rationale:
      'NHLBI notes that 1,500 mg sodium per day lowers blood pressure even further; this is a review flag, not a universal hard limit.',
    sourceTitle: 'NHLBI DASH Eating Plan',
    sourceCitation: 'https://www.nhlbi.nih.gov/health/dash-eating-plan',
    evidenceSourceCode: 'NHLBI_DASH_EATING_PLAN_CURRENT_2026_09',
    evidenceLocator: 'Lower-sodium DASH pattern: 1,500 mg/day may reduce blood pressure further',
    applicablePopulation: 'Adults for whom the lower-sodium DASH pattern is selected by an RND.',
    requiredInputs: { dailyTotals: ['sodiumMg'], requiredScope: 'DAY', selectedPolicyVariant: true },
    exclusionsAndCaveats: 'This is not a universal hard limit and cannot be inferred from a single meal.',
    evaluationScope: ConditionRuleEvaluationScope.DAY,
    authorityOutcome: ConditionRuleAuthority.REVIEW_REQUIRED,
    formulaCode: 'FIXED_DAILY_TOTAL',
  },
  {
    id: 'draft-diabetes-fiber-14',
    condition: HealthConditionType.DIABETES,
    nutrient: ConditionRuleNutrient.FIBER_G,
    operator: ConditionRuleOperator.GREATER_THAN_OR_EQUAL,
    threshold: 14,
    unit: 'g',
    basis: ConditionRuleBasis.PER_1000_KCAL,
    severity: ConditionRuleSeverity.FLAG,
    rationale:
      'ADA nutrition guidance supports at least 14 g dietary fiber per 1,000 kcal while keeping macronutrient distribution individualized.',
    sourceTitle: 'ADA Standards of Care in Diabetes—2026, Facilitating Positive Health Behaviors',
    sourceCitation:
      'https://diabetesjournals.org/care/article/49/Supplement_1/S89/163932/5-Facilitating-Positive-Health-Behaviors-and-Well',
    evidenceSourceCode: 'ADA_STANDARDS_2026_SECTION_5',
    evidenceLocator: 'Nutrition recommendations: at least 14 g dietary fiber per 1,000 kcal',
    applicablePopulation: 'People with diabetes receiving individualized nutrition therapy.',
    requiredInputs: { dailyTotals: ['calories', 'fiberG'], requiredScope: 'DAY' },
    exclusionsAndCaveats:
      'Passing this fiber reference does not establish diabetes suitability or replace review of medication, glucose response, carbohydrate amount, timing, and quality.',
    evaluationScope: ConditionRuleEvaluationScope.DAY,
    authorityOutcome: ConditionRuleAuthority.REVIEW_REQUIRED,
    formulaCode: 'PER_1000_KCAL',
  },
  {
    id: 'draft-kidney-sodium-2300',
    condition: HealthConditionType.KIDNEY_DISEASE,
    nutrient: ConditionRuleNutrient.SODIUM_MG,
    operator: ConditionRuleOperator.LESS_THAN_OR_EQUAL,
    threshold: 2300,
    unit: 'mg',
    basis: ConditionRuleBasis.DAILY_TOTAL,
    severity: ConditionRuleSeverity.FLAG,
    rationale: 'NIDDK CKD management guidance recommends limiting sodium to less than 2,300 mg per day.',
    sourceTitle: 'NIDDK Identify and Manage Patients with Chronic Kidney Disease',
    sourceCitation:
      'https://www.niddk.nih.gov/health-information/professionals/clinical-tools-patient-management/kidney-disease/identify-manage-patients/manage-ckd/slow-progression-reduce-complications',
    evidenceSourceCode: 'NIDDK_CKD_MANAGEMENT_CURRENT_2026_09',
    evidenceLocator: 'Medical nutrition therapy: limit sodium to less than 2,300 mg/day',
    applicablePopulation: 'Adults with CKD under individualized medical nutrition therapy.',
    requiredInputs: { dailyTotals: ['sodiumMg'], requiredScope: 'DAY', clinicalContext: ['ckdStage', 'dialysisStatus'] },
    exclusionsAndCaveats:
      'CKD stage, dialysis, laboratory values, medication, and nutritional status remain mandatory review context.',
    evaluationScope: ConditionRuleEvaluationScope.DAY,
    authorityOutcome: ConditionRuleAuthority.REVIEW_REQUIRED,
    formulaCode: 'FIXED_DAILY_TOTAL',
  },
  {
    id: 'draft-kidney-protein-08',
    condition: HealthConditionType.KIDNEY_DISEASE,
    nutrient: ConditionRuleNutrient.PROTEIN_G,
    operator: ConditionRuleOperator.LESS_THAN_OR_EQUAL,
    threshold: 0.8,
    unit: 'g/kg/day',
    basis: ConditionRuleBasis.PER_KG_BODY_WEIGHT_DAILY,
    severity: ConditionRuleSeverity.FLAG,
    rationale:
      'NIDDK cites 0.8 g protein per kg body weight per day for adults with nondialysis CKD; stage and dialysis status still require individual review.',
    sourceTitle: 'NIDDK Identify and Manage Patients with Chronic Kidney Disease',
    sourceCitation:
      'https://www.niddk.nih.gov/health-information/professionals/clinical-tools-patient-management/kidney-disease/identify-manage-patients/manage-ckd/slow-progression-reduce-complications',
    evidenceSourceCode: 'NIDDK_CKD_MANAGEMENT_CURRENT_2026_09',
    evidenceLocator: 'Medical nutrition therapy: 0.8 g protein/kg/day reference for nondialysis CKD',
    applicablePopulation: 'Adults with nondialysis CKD when the coefficient is clinically applicable.',
    requiredInputs: {
      dailyTotals: ['proteinG'],
      userInputs: ['bodyWeightKg'],
      clinicalContext: ['ckdStage', 'dialysisStatus', 'nutritionStatus'],
      requiredScope: 'DAY',
    },
    exclusionsAndCaveats:
      'Do not apply as an automated target for dialysis, pregnancy, acute illness, malnutrition, or when an individualized prescription supersedes it.',
    evaluationScope: ConditionRuleEvaluationScope.DAY,
    authorityOutcome: ConditionRuleAuthority.REVIEW_REQUIRED,
    formulaCode: 'PER_KG_BODY_WEIGHT_DAILY',
  },
  {
    id: 'draft-heart-saturated-fat-6pct',
    condition: HealthConditionType.HEART_CONDITION,
    nutrient: ConditionRuleNutrient.SATURATED_FAT_G,
    operator: ConditionRuleOperator.LESS_THAN_OR_EQUAL,
    threshold: 6,
    unit: '% energy',
    basis: ConditionRuleBasis.PERCENT_OF_DAILY_CALORIES,
    severity: ConditionRuleSeverity.FLAG,
    rationale:
      'AHA recommends aiming for less than 6% of daily calories from saturated fat for people who need to lower cholesterol.',
    sourceTitle: 'American Heart Association: Saturated Fats',
    sourceCitation: 'https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/fats/saturated-fats',
    evidenceSourceCode: 'AHA_SATURATED_FAT_CURRENT_2026_09',
    evidenceLocator: 'Less than 6% of daily calories when lowering LDL cholesterol is indicated',
    applicablePopulation: 'People for whom lowering LDL cholesterol is clinically indicated.',
    requiredInputs: { dailyTotals: ['calories', 'saturatedFatG'], requiredScope: 'DAY', clinicalContext: ['heartConditionSubtype'] },
    exclusionsAndCaveats:
      'Heart condition is too broad for this result to create clearance. The complete daily diet and diagnosis subtype require enhanced review.',
    evaluationScope: ConditionRuleEvaluationScope.DAY,
    authorityOutcome: ConditionRuleAuthority.REVIEW_REQUIRED,
    formulaCode: 'PERCENT_OF_DAILY_CALORIES',
  },
  {
    id: 'draft-heart-sodium-2300',
    condition: HealthConditionType.HEART_CONDITION,
    nutrient: ConditionRuleNutrient.SODIUM_MG,
    operator: ConditionRuleOperator.LESS_THAN_OR_EQUAL,
    threshold: 2300,
    unit: 'mg',
    basis: ConditionRuleBasis.DAILY_TOTAL,
    severity: ConditionRuleSeverity.FLAG,
    rationale: 'AHA recommends no more than 2,300 mg sodium per day for most adults.',
    sourceTitle: 'American Heart Association: Sodium and Salt',
    sourceCitation: 'https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/sodium/sodium-and-salt',
    evidenceSourceCode: 'AHA_SODIUM_CURRENT_2026_09',
    evidenceLocator: 'No more than 2,300 mg sodium per day for most adults',
    applicablePopulation: 'Adults when the daily AHA sodium reference is clinically applicable.',
    requiredInputs: { dailyTotals: ['sodiumMg'], requiredScope: 'DAY', clinicalContext: ['heartConditionSubtype'] },
    exclusionsAndCaveats:
      'A daily sodium result cannot clear one meal or every cardiovascular diagnosis. Enhanced RND review remains mandatory.',
    evaluationScope: ConditionRuleEvaluationScope.DAY,
    authorityOutcome: ConditionRuleAuthority.REVIEW_REQUIRED,
    formulaCode: 'FIXED_DAILY_TOTAL',
  },
] as const;

const pregnancyRules = [
  ['RAW_OR_UNDERCOOKED_MEAT', ['raw meat', 'undercooked meat', 'rare meat']],
  ['RAW_OR_UNDERCOOKED_SEAFOOD', ['raw fish', 'raw shellfish', 'sushi', 'sashimi', 'ceviche']],
  ['RAW_OR_UNDERCOOKED_EGG', ['raw egg', 'undercooked egg']],
  ['UNPASTEURIZED_DAIRY', ['unpasteurized milk', 'unpasteurized cheese', 'raw milk']],
  ['HIGH_MERCURY_FISH', ['shark', 'swordfish', 'king mackerel', 'tilefish', 'marlin', 'orange roughy', 'bigeye tuna']],
  ['ALCOHOL', ['alcohol', 'beer', 'wine', 'liquor', 'rum', 'vodka', 'gin']],
  ['RAW_SPROUTS', ['raw sprouts', 'alfalfa sprouts', 'mung bean sprouts']],
  ['UNPASTEURIZED_JUICE', ['unpasteurized juice', 'fresh unpasteurized cider']],
  ['CAFFEINE_REVIEW', ['coffee', 'espresso', 'energy drink', 'caffeine']],
] as const;

async function main() {
  for (const source of CLINICAL_EVIDENCE_SOURCES) {
    await prisma.clinicalEvidenceSource.upsert({
      where: { code: source.code },
      // Evidence revisions are immutable. A corrected or newer document gets
      // a new code and source row instead of silently changing reviewed facts.
      update: {},
      create: {
        ...source,
        documentType: source.documentType as ClinicalEvidenceDocumentType,
        domain: source.domain as ClinicalEvidenceDomain,
        publicationDate: source.publicationDate ? new Date(source.publicationDate) : null,
        retrievedAt: new Date(source.retrievedAt),
      },
    });
  }

  const policyMetadata = [
    [HealthConditionType.HYPERTENSION, AssuranceTier.STANDARD, true],
    [HealthConditionType.DIABETES, AssuranceTier.STANDARD, false],
    [HealthConditionType.KIDNEY_DISEASE, AssuranceTier.ENHANCED, false],
    [HealthConditionType.HEART_CONDITION, AssuranceTier.ENHANCED, false],
    [HealthConditionType.PREGNANT, AssuranceTier.ENHANCED, false],
  ] as const;
  for (const [condition, assuranceTier, automationAllowed] of policyMetadata) {
    await prisma.conditionRulePolicyVersion.upsert({
      where: { condition_policyVersion: { condition, policyVersion: POLICY_VERSION } },
      update: { assuranceTier, automationAllowed },
      create: { condition, policyVersion: POLICY_VERSION, assuranceTier, automationAllowed },
    });
  }

  for (const rule of nutrientRules) {
    const { evidenceSourceCode, ...ruleData } = rule;
    await prisma.conditionNutrientRule.upsert({
      where: { id: rule.id },
      update: {
        ...ruleData,
        evidenceSource: { connect: { code: evidenceSourceCode } },
        policyVersion: POLICY_VERSION,
        reviewStatus: ConditionRuleReviewStatus.DRAFT,
        approvedByNutritionist: { disconnect: true },
        active: false,
      },
      create: {
        ...ruleData,
        evidenceSource: { connect: { code: evidenceSourceCode } },
        policyVersion: POLICY_VERSION,
        reviewStatus: ConditionRuleReviewStatus.DRAFT,
        active: false,
      },
    });
  }

  for (const [ingredientCategory, matchingTerms] of pregnancyRules) {
    const id = `draft-pregnancy-${ingredientCategory.toLowerCase().replace(/_/gu, '-')}`;
    await prisma.conditionIngredientRule.upsert({
      where: { id },
      update: {
        condition: HealthConditionType.PREGNANT,
        ingredientCategory,
        matchingTerms: [...matchingTerms],
        severity:
          ingredientCategory === 'CAFFEINE_REVIEW' ? ConditionRuleSeverity.FLAG : ConditionRuleSeverity.HARD_BLOCK,
        rationale:
          ingredientCategory === 'CAFFEINE_REVIEW'
            ? 'ACOG advises limiting caffeine during pregnancy to less than 200 mg per day; ingredient presence requires quantity review.'
            : 'Pregnancy food-safety guidance identifies this ingredient or preparation category for avoidance.',
        sourceTitle:
          ingredientCategory === 'CAFFEINE_REVIEW' ? 'ACOG Having a Baby FAQ' : 'FDA Food Safety for Moms-to-Be',
        sourceCitation:
          ingredientCategory === 'CAFFEINE_REVIEW'
            ? 'https://www.acog.org/womens-health/faqs/having-a-baby'
            : 'https://www.fda.gov/food/people-risk-foodborne-illness/meat-poultry-seafood-food-safety-moms-be',
        evidenceSource: {
          connect: {
            code:
              ingredientCategory === 'CAFFEINE_REVIEW'
                ? 'ACOG_HAVING_A_BABY_CURRENT_2026_09'
                : 'FDA_PREGNANCY_FOOD_SAFETY_CURRENT_2026_09',
          },
        },
        evidenceLocator:
          ingredientCategory === 'CAFFEINE_REVIEW'
            ? 'Caffeine during pregnancy: less than 200 mg/day'
            : `Pregnancy food-safety category: ${ingredientCategory}`,
        applicablePopulation: 'Pregnant people; lactation requires a separate policy.',
        requiredInputs:
          ingredientCategory === 'CAFFEINE_REVIEW'
            ? { dailyTotals: ['caffeineMg'], requiredScope: 'DAY' }
            : { ingredientFacts: ['identity', 'preparationState', 'pasteurizationOrMercuryFacts'] },
        exclusionsAndCaveats:
          ingredientCategory === 'CAFFEINE_REVIEW'
            ? 'Ingredient-name matching cannot quantify caffeine. Unknown quantity is unevaluable and requires enhanced review.'
            : 'Ingredient text may not prove cooking temperature, pasteurization, handling, or mercury classification. Unknown facts fail closed.',
        evaluationScope:
          ingredientCategory === 'CAFFEINE_REVIEW'
            ? ConditionRuleEvaluationScope.DAY
            : ConditionRuleEvaluationScope.PREPARATION,
        authorityOutcome:
          ingredientCategory === 'CAFFEINE_REVIEW'
            ? ConditionRuleAuthority.REVIEW_REQUIRED
            : ConditionRuleAuthority.HARD_BLOCK,
        policyVersion: POLICY_VERSION,
        reviewStatus: ConditionRuleReviewStatus.DRAFT,
        approvedByNutritionist: { disconnect: true },
        active: false,
      },
      create: {
        id,
        condition: HealthConditionType.PREGNANT,
        ingredientCategory,
        matchingTerms: [...matchingTerms],
        severity:
          ingredientCategory === 'CAFFEINE_REVIEW' ? ConditionRuleSeverity.FLAG : ConditionRuleSeverity.HARD_BLOCK,
        rationale:
          ingredientCategory === 'CAFFEINE_REVIEW'
            ? 'ACOG advises limiting caffeine during pregnancy to less than 200 mg per day; ingredient presence requires quantity review.'
            : 'Pregnancy food-safety guidance identifies this ingredient or preparation category for avoidance.',
        sourceTitle:
          ingredientCategory === 'CAFFEINE_REVIEW' ? 'ACOG Having a Baby FAQ' : 'FDA Food Safety for Moms-to-Be',
        sourceCitation:
          ingredientCategory === 'CAFFEINE_REVIEW'
            ? 'https://www.acog.org/womens-health/faqs/having-a-baby'
            : 'https://www.fda.gov/food/people-risk-foodborne-illness/meat-poultry-seafood-food-safety-moms-be',
        evidenceSource: {
          connect: {
            code:
              ingredientCategory === 'CAFFEINE_REVIEW'
                ? 'ACOG_HAVING_A_BABY_CURRENT_2026_09'
                : 'FDA_PREGNANCY_FOOD_SAFETY_CURRENT_2026_09',
          },
        },
        evidenceLocator:
          ingredientCategory === 'CAFFEINE_REVIEW'
            ? 'Caffeine during pregnancy: less than 200 mg/day'
            : `Pregnancy food-safety category: ${ingredientCategory}`,
        applicablePopulation: 'Pregnant people; lactation requires a separate policy.',
        requiredInputs:
          ingredientCategory === 'CAFFEINE_REVIEW'
            ? { dailyTotals: ['caffeineMg'], requiredScope: 'DAY' }
            : { ingredientFacts: ['identity', 'preparationState', 'pasteurizationOrMercuryFacts'] },
        exclusionsAndCaveats:
          ingredientCategory === 'CAFFEINE_REVIEW'
            ? 'Ingredient-name matching cannot quantify caffeine. Unknown quantity is unevaluable and requires enhanced review.'
            : 'Ingredient text may not prove cooking temperature, pasteurization, handling, or mercury classification. Unknown facts fail closed.',
        evaluationScope:
          ingredientCategory === 'CAFFEINE_REVIEW'
            ? ConditionRuleEvaluationScope.DAY
            : ConditionRuleEvaluationScope.PREPARATION,
        authorityOutcome:
          ingredientCategory === 'CAFFEINE_REVIEW'
            ? ConditionRuleAuthority.REVIEW_REQUIRED
            : ConditionRuleAuthority.HARD_BLOCK,
        policyVersion: POLICY_VERSION,
        reviewStatus: ConditionRuleReviewStatus.DRAFT,
        active: false,
      },
    });
  }

  console.log(
    `Seeded ${nutrientRules.length} nutrient rules and ${pregnancyRules.length} ingredient rules as inactive DRAFT records.`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
