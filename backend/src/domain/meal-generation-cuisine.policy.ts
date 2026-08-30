export type MealGenerationSlot = {
  dayNumber: number;
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
};

export interface MealGenerationPromptInput {
  slots: readonly MealGenerationSlot[];
  dailyCalorieTarget: number;
  goal: string;
  dietaryPreference: string;
  carbPreference: string;
  foodCulture: string;
  conditions: string[];
  allergens: string[];
  otherConditions?: string;
  otherAllergies?: string;
  foodReference: string;
}

const RESPONSE_CONTRACT = `
You are generating meal data for a system with this
EXACT JSON response shape. You MUST use these exact
field names and enum values — do not rename, do not
restructure, and do not add extra fields.

Required response format:
{
  "meals": [
    {
      "dayNumber": number,
      "mealType": "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK",
      "mealName": string,
      "description": string,
      "calories": number,
      "proteinG": number,
      "carbsG": number,
      "fatG": number,
      "ingredients": [
        { "name": string, "quantity": number, "unit": "g" | "mL" | "piece" | "tbsp" | "tsp" | "cup" | "can" | "pack" }
      ]
    }
  ]
}

Rules:
- mealType must be EXACTLY one of the four values shown above, uppercase, with no variations
- every ingredient requires a realistic positive quantity for one serving and one supported unit
- use g or mL whenever practical; use piece, tbsp, tsp, cup, can, or pack only when that is how a shopper normally buys or measures it
- Return ONLY valid JSON. Do not include markdown, code fences, backticks, a preamble, or explanatory text outside the JSON
`;

export const MEAL_GENERATION_CUISINE_POLICY = `
[ACCESSIBILITY AND CUISINE POLICY]
- Optimize first for the user's medical restrictions, allergies, dietary preference, nutrition targets, affordability, preparation effort, and realistic availability in the Philippines.
- Treat the user's food-culture preference as an influence, not an exclusive cuisine restriction. Do not make every meal belong to that cuisine.
- Build a varied plan that may combine Filipino staples, universally familiar simple meals, locally popular foods with other cultural origins, and suitable ready-to-eat or convenience foods.
- Simple everyday combinations are valid meal-plan choices. Do not make a meal elaborate or culturally specific merely to sound distinctive.
- Convenience, packaged, frozen, or canned foods may be used when they are affordable and compatible with the user's restrictions. Prefer nutritionally appropriate variants, and avoid them when their typical sodium, sugar, saturated fat, or other relevant values conflict with the user's condition.
- Prefer ingredients reasonably obtainable from Philippine groceries, markets, convenience stores, or common food outlets. Avoid expensive or difficult-to-source imports when an accessible alternative exists.
- The supplied FNRI list is a nutrition reference, not an exclusive ingredient whitelist. Common foods absent from the list may still be used and will be marked for estimation and nutritionist review.
- Clinical safety always overrides cuisine variety, convenience, cost, or user preference.
`;

export function buildMealGenerationPrompt(input: MealGenerationPromptInput): {
  systemInstruction: string;
  prompt: string;
} {
  const requestedSlots = input.slots
    .map((slot) => `- Day ${slot.dayNumber}: ${slot.mealType}`)
    .join('\n');

  const conditions = input.conditions.join(', ') || 'NONE';
  const allergens = input.allergens.join(', ') || 'NONE';

  const systemInstruction =
    `You are a nutrition-planning assistant using the Philippine Food Composition Table as a nutrient reference. ` +
    `You create medically cautious, affordable, and locally obtainable meals for people living in the Philippines; ` +
    `you are not limited to Filipino cuisine.\n` +
    RESPONSE_CONTRACT;

  const prompt =
    `Generate exactly the following ${input.slots.length} meals for the specified days and meal types:\n` +
    `${requestedSlots}\n\n` +
    `Enforce these constraints for the generated meals:\n` +
    `[PATIENT NUTRITION PROFILE]\n` +
    `- Daily Target Calories: ${input.dailyCalorieTarget} kcal/day (distribute approximately 30% breakfast, 40% lunch, and 30% dinner)\n` +
    `- Goal Target: ${input.goal}\n` +
    `- Dietary Preference: ${input.dietaryPreference}\n` +
    `- Carb Intake Level: ${input.carbPreference}\n` +
    `- Preferred Food Culture: ${input.foodCulture} (influence only; this does not restrict the plan to one cuisine)\n\n` +
    `[CLINICAL SAFEGUARDS]\n` +
    `- Medical Conditions: ${conditions}${input.otherConditions ? '; Additional: ' + input.otherConditions : ''}\n` +
    `- Allergens to EXCLUDE completely: ${allergens}${input.otherAllergies ? '; Additional: ' + input.otherAllergies : ''}\n\n` +
    `${MEAL_GENERATION_CUISINE_POLICY}\n` +
    `[PHILIPPINE FOOD COMPOSITION REFERENCE]\n` +
    `${input.foodReference}\n\n` +
    `Hard Rules:\n` +
    `- Exclude every recorded allergen from all recipes.\n` +
    `- Filter out high-sodium foods and condiments when the user has HYPERTENSION.\n` +
    `- Limit simple carbohydrates, refined-rice portions, and added sugars when the user has DIABETES.\n` +
    `- Keep calories and macronutrients mathematically aligned with realistic portions.\n` +
    `- Avoid repeating the same meal or near-identical meal unless the requested slots leave no safe practical alternative.\n` +
    `- Return only the raw JSON response.`;

  return { systemInstruction, prompt };
}
