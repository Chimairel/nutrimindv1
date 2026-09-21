import {
  AssuranceTier,
  ConditionRuleBasis,
  ConditionRuleNutrient,
  ConditionRuleOperator,
  ConditionRuleReviewStatus,
  ConditionRuleSeverity,
  HealthConditionType,
  PrismaClient,
} from '@prisma/client';

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
    sourceCitation: 'https://diabetesjournals.org/care/article/49/Supplement_1/S89/163932',
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
    await prisma.conditionNutrientRule.upsert({
      where: { id: rule.id },
      update: {
        ...rule,
        policyVersion: POLICY_VERSION,
        reviewStatus: ConditionRuleReviewStatus.DRAFT,
        approvedByNutritionistId: null,
        active: false,
      },
      create: {
        ...rule,
        policyVersion: POLICY_VERSION,
        reviewStatus: ConditionRuleReviewStatus.DRAFT,
        approvedByNutritionistId: null,
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
        policyVersion: POLICY_VERSION,
        reviewStatus: ConditionRuleReviewStatus.DRAFT,
        approvedByNutritionistId: null,
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
        policyVersion: POLICY_VERSION,
        reviewStatus: ConditionRuleReviewStatus.DRAFT,
        approvedByNutritionistId: null,
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
