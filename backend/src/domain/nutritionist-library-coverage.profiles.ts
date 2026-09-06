import { AllergenType, DietaryPreference, HealthConditionType } from '@prisma/client';

export const COVERAGE_MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER'] as const;

export const BASE_LIBRARY_COVERAGE_PROFILES = [
  {
    key: 'DIABETES',
    label: 'Diabetes',
    dietaryPreference: DietaryPreference.OMNIVORE,
    conditions: [HealthConditionType.DIABETES],
    allergens: [AllergenType.NONE],
  },
  {
    key: 'HYPERTENSION',
    label: 'Hypertension',
    dietaryPreference: DietaryPreference.OMNIVORE,
    conditions: [HealthConditionType.HYPERTENSION],
    allergens: [AllergenType.NONE],
  },
  {
    key: 'VEGETARIAN',
    label: 'Vegetarian',
    dietaryPreference: DietaryPreference.VEGETARIAN,
    conditions: [HealthConditionType.NONE],
    allergens: [AllergenType.NONE],
  },
  {
    key: 'PESCATARIAN',
    label: 'Pescatarian',
    dietaryPreference: DietaryPreference.PESCATARIAN,
    conditions: [HealthConditionType.NONE],
    allergens: [AllergenType.NONE],
  },
  {
    key: 'EGG_FREE',
    label: 'Egg-free',
    dietaryPreference: DietaryPreference.OMNIVORE,
    conditions: [HealthConditionType.NONE],
    allergens: [AllergenType.EGGS],
  },
] as const;

export const COMBINATION_CONSTRAINTS = [
  { key: 'OMNIVORE', label: 'Omnivore', dietaryPreference: DietaryPreference.OMNIVORE, allergen: AllergenType.NONE },
  {
    key: 'VEGETARIAN',
    label: 'Vegetarian',
    dietaryPreference: DietaryPreference.VEGETARIAN,
    allergen: AllergenType.NONE,
  },
  {
    key: 'PESCATARIAN',
    label: 'Pescatarian',
    dietaryPreference: DietaryPreference.PESCATARIAN,
    allergen: AllergenType.NONE,
  },
  { key: 'EGG_FREE', label: 'Egg-free', dietaryPreference: DietaryPreference.OMNIVORE, allergen: AllergenType.EGGS },
  {
    key: 'DAIRY_FREE',
    label: 'Dairy-free',
    dietaryPreference: DietaryPreference.OMNIVORE,
    allergen: AllergenType.DAIRY,
  },
  {
    key: 'GLUTEN_FREE',
    label: 'Gluten-free',
    dietaryPreference: DietaryPreference.OMNIVORE,
    allergen: AllergenType.GLUTEN,
  },
  { key: 'NUT_FREE', label: 'Nut-free', dietaryPreference: DietaryPreference.OMNIVORE, allergen: AllergenType.NUTS },
  {
    key: 'SHELLFISH_FREE',
    label: 'Shellfish-free',
    dietaryPreference: DietaryPreference.OMNIVORE,
    allergen: AllergenType.SHELLFISH,
  },
] as const;

export const COMBINATION_CONDITIONS = [
  { key: 'DIABETES', label: 'Diabetes', condition: HealthConditionType.DIABETES },
  { key: 'HYPERTENSION', label: 'Hypertension', condition: HealthConditionType.HYPERTENSION },
] as const;

export const STRUCTURED_COMBINATION_COVERAGE_PROFILES = [
  {
    key: 'DIABETES_VEGETARIAN_EGGS',
    label: 'Diabetes + vegetarian + egg allergy',
    dietaryPreference: DietaryPreference.VEGETARIAN,
    safetyEntries: [
      { domain: 'CONDITION', canonicalCode: 'DIABETES', displayName: 'Diabetes', supportState: 'SUPPORTED' },
      { domain: 'ALLERGY', canonicalCode: 'EGGS', displayName: 'Eggs', supportState: 'SUPPORTED' },
    ],
  },
  {
    key: 'HYPERTENSION_PESCATARIAN_DAIRY',
    label: 'Hypertension + pescatarian + dairy allergy',
    dietaryPreference: DietaryPreference.PESCATARIAN,
    safetyEntries: [
      { domain: 'CONDITION', canonicalCode: 'HYPERTENSION', displayName: 'Hypertension', supportState: 'SUPPORTED' },
      { domain: 'ALLERGY', canonicalCode: 'DAIRY', displayName: 'Dairy', supportState: 'SUPPORTED' },
    ],
  },
  {
    key: 'DIABETES_HYPERTENSION_GLUTEN',
    label: 'Diabetes + hypertension + gluten allergy',
    dietaryPreference: DietaryPreference.OMNIVORE,
    safetyEntries: [
      { domain: 'CONDITION', canonicalCode: 'DIABETES', displayName: 'Diabetes', supportState: 'SUPPORTED' },
      { domain: 'CONDITION', canonicalCode: 'HYPERTENSION', displayName: 'Hypertension', supportState: 'SUPPORTED' },
      { domain: 'ALLERGY', canonicalCode: 'GLUTEN', displayName: 'Gluten', supportState: 'SUPPORTED' },
    ],
  },
] as const;
