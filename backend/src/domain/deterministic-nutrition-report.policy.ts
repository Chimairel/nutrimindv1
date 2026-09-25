import { clinicalEvidenceSourceByCode } from './clinical-evidence-source.catalog';
import { calculateNutritionReferences } from './nutrition-reference-calculation.policy';

export const NUTRITION_GUIDANCE_POLICY_VERSION = 'NUTRITION_GUIDANCE_DETERMINISTIC_V1';

export interface GuidanceReference {
  heading: string;
  value: string;
  explanation: string;
  classification: 'CALCULATED_REFERENCE' | 'GENERAL_REFERENCE' | 'REQUIRES_INDIVIDUAL_REVIEW';
  sourceCode: string;
  sourceTitle: string;
  sourceUrl: string;
}

export function buildDeterministicNutritionGuidance(input: {
  age: number;
  dailyCalories: number;
  weightKg: number;
  conditions: string[];
  allergens: string[];
  otherConditions: string[];
  otherFoodRestrictions: string[];
}) {
  const references = calculateNutritionReferences({ dailyCalories: input.dailyCalories, bodyWeightKg: input.weightKg });
  const items: GuidanceReference[] = [];
  const add = (sourceCode: string, heading: string, value: string, explanation: string,
    classification: GuidanceReference['classification']) => {
    const source = clinicalEvidenceSourceByCode(sourceCode);
    if (!source) throw new Error(`Missing guidance source: ${sourceCode}`);
    items.push({ heading, value, explanation, classification, sourceCode,
      sourceTitle: `${source.issuingOrganization} — ${source.title}`, sourceUrl: source.canonicalUrl });
  };

  if (input.age >= 19) {
    const amdr = references.filipinoAdultAmdr;
    add(amdr.sourceId, 'Protein reference', `${amdr.proteinG.minimum}–${amdr.proteinG.maximum} g/day`,
      `10–15% of ${input.dailyCalories} kcal ÷ 4 kcal/g. This is the Filipino adult population range, not a personal prescription.`,
      'CALCULATED_REFERENCE');
    add(amdr.sourceId, 'Fat reference', `${amdr.fatG.minimum}–${amdr.fatG.maximum} g/day`,
      `15–30% of ${input.dailyCalories} kcal ÷ 9 kcal/g. This is a population range.`, 'CALCULATED_REFERENCE');
    add(amdr.sourceId, 'Carbohydrate reference', `${amdr.carbohydrateG.minimum}–${amdr.carbohydrateG.maximum} g/day`,
      `55–75% of ${input.dailyCalories} kcal ÷ 4 kcal/g. A condition may require an individualized pattern.`,
      'CALCULATED_REFERENCE');
  } else {
    add('DOST_FNRI_PDRI_2015_REV_2018', 'Age-specific nutrient ranges', 'Individual review required',
      'The displayed adult AMDR row starts at age 19. An age-appropriate reference must be selected for this profile.',
      'REQUIRES_INDIVIDUAL_REVIEW');
  }

  if (input.conditions.includes('HYPERTENSION')) {
    add('NHLBI_DASH_EATING_PLAN_CURRENT_2026_09', 'Sodium reference for DASH', '2,300 mg/day',
      'DASH describes a 2,300 mg daily pattern and a lower 1,500 mg pattern. A clinician should select the appropriate target; this is not a per-meal limit.',
      'GENERAL_REFERENCE');
  }
  if (input.conditions.includes('DIABETES')) {
    add('ADA_STANDARDS_2026_SECTION_5', 'Dietary fiber reference', `${references.diabetesReviewFiberG.value} g/day`,
      `14 g per 1,000 kcal × ${input.dailyCalories} kcal. Educational reference; it does not establish meal safety.`,
      'CALCULATED_REFERENCE');
    add('ADA_NUTRITION_CONSENSUS_2019', 'Carbohydrate plan for diabetes', 'Individual review required',
      'There is no single carbohydrate percentage or gram ceiling suitable for everyone with diabetes. Medication, glucose response and meal timing matter.',
      'REQUIRES_INDIVIDUAL_REVIEW');
  }
  if (input.conditions.includes('KIDNEY_DISEASE')) {
    add('NIDDK_CKD_MANAGEMENT_CURRENT_2026_09', 'Kidney-related nutrient limits', 'Individual review required',
      'Protein, potassium, phosphorus, sodium and fluid needs depend on kidney stage, laboratory results and dialysis status. No personal limit is calculated here.',
      'REQUIRES_INDIVIDUAL_REVIEW');
  }
  if (input.conditions.includes('HEART_CONDITION')) {
    add('AHA_SATURATED_FAT_CURRENT_2026_09', 'Saturated fat guidance', 'Individual review required',
      'The AHA reference of less than 6% of energy applies when lowering LDL cholesterol is indicated. A broad heart-condition label does not establish that indication.',
      'REQUIRES_INDIVIDUAL_REVIEW');
  }
  if (input.conditions.includes('PREGNANT')) {
    add('CDC_PREGNANCY_FOOD_SAFETY_CURRENT_2026_09', 'Food safety in pregnancy', 'Preparation review required',
      'Cooking, pasteurization and handling details matter. A recipe name alone cannot establish pregnancy safety.',
      'REQUIRES_INDIVIDUAL_REVIEW');
  }
  if (input.allergens.length || input.otherFoodRestrictions.length) {
    add('PH_FDA_AO_2014_0030A', 'Declared food restrictions', 'Ingredient checks required',
      'Avoid declared allergens and excluded ingredients. Check labels and preparation details; this report cannot establish a safe exposure amount or rule out cross-contact.',
      'REQUIRES_INDIVIDUAL_REVIEW');
  }
  if (input.otherConditions.length) {
    add('DOST_FNRI_PDRI_2015_REV_2018', 'Additional reported conditions', 'Individual review required',
      'No condition-specific threshold is assigned to free-text conditions without a reviewed rule and sufficient clinical context.',
      'REQUIRES_INDIVIDUAL_REVIEW');
  }
  return {
    policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
    referenceItems: items,
    generalSummary: `Your current meal-planning energy estimate is ${input.dailyCalories.toLocaleString()} kcal/day. The values below are calculated population references and review notes for your saved profile. They do not diagnose a condition or authorize a meal; eligibility and nutritionist review remain separate.`,
    nutritionReferences: references,
  };
}
