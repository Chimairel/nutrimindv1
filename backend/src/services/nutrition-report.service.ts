import prisma from '@/lib/prisma';
import { generateGenerativeJSON } from '@/lib/gemini';
import { getFNRISubset } from '@/lib/fnri';
import { HealthConditionType, AllergenType } from '@prisma/client';
import { z } from 'zod';

const NUTRITION_REPORT_SYSTEM_CONTEXT = `
You are generating a nutrition report for a system with this
EXACT JSON response shape. You MUST use these exact
field names — do not rename, do not restructure, do not
add extra fields.

Required response format:
{
  "foodsToAvoid": string[],
  "foodsToLimit": string[],
  "foodsRecommended": string[],
  "drinksGuidance": string[],
  "generalSummary": string
}

Rules:
- Return ONLY valid JSON. No markdown formatting, no
  code fences, no backticks, no preamble, no explanation
  text before or after the JSON
`;

type StoredNutritionReport = NonNullable<
  Awaited<ReturnType<typeof prisma.nutritionReport.findUnique>>
>;

export class NutritionReportService {
  private static readonly generationInFlight = new Map<string, Promise<StoredNutritionReport>>();
  /**
   * Fetches the current nutrition report for the user.
   */
  static async getReport(userId: string) {
    return prisma.nutritionReport.findUnique({
      where: { userId },
    });
  }

  /**
   * Acknowledges the user's current report by setting acknowledgedAt to now.
   */
  static async acknowledgeReport(userId: string) {
    return prisma.nutritionReport.update({
      where: { userId },
      data: {
        acknowledgedAt: new Date(),
      },
    });
  }

  /**
   * Generates a customized clinical assessment utilizing the Google Gemini API (with cascade fallbacks).
   * Contextualizes the prompt with seeded FNRI foods to prioritize accessible,
   * locally obtainable choices without restricting recommendations to one cuisine.
   */
  static async generateReport(userId: string): Promise<StoredNutritionReport> {
    const existingRequest = this.generationInFlight.get(userId);
    if (existingRequest) return existingRequest;

    const request = this.generateReportOnce(userId).finally(() => {
      if (this.generationInFlight.get(userId) === request) {
        this.generationInFlight.delete(userId);
      }
    });
    this.generationInFlight.set(userId, request);
    return request;
  }

  private static async generateReportOnce(userId: string): Promise<StoredNutritionReport> {
    // 1. Fetch live user details, profile, conditions, and allergies
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userProfile: true,
        healthConditions: true,
        allergies: true,
      },
    });

    if (!user || !user.userProfile) {
      throw new Error('User profile must be initialized before generating a nutrition report.');
    }

    const profile = user.userProfile;
    const conditions = user.healthConditions.map((c) => c.condition);
    const allergens = user.allergies.map((a) => a.allergen);
    const otherConditions = profile.otherConditions || '';
    const otherAllergies = profile.otherAllergies || '';

    // Verify stats exist
    const { age, heightCm, weightKg, goal, activityLevel, dailyCalorieTarget } = profile;
    if (!age || !heightCm || !weightKg || !goal || !activityLevel || !dailyCalorieTarget) {
      throw new Error('Please complete Step 1 (statistics & goals) of onboarding first.');
    }

    // 2. Fetch seeded FNRI subset to inject as local food composition guidelines
    const localFoodsSubset = await getFNRISubset();
    const formattedLocalFoods = localFoodsSubset
      .map((f) => `- ${f.name} [Category: ${f.category || 'N/A'}, Cal: ${f.calories}kcal, P: ${f.proteinG}g, C: ${f.carbsG}g, F: ${f.fatG}g]`)
      .slice(0, 130)
      .join('\n');

    // 3. Compile prompt constraints
    const clinicalSystemInstruction = 
      NUTRITION_REPORT_SYSTEM_CONTEXT + "\n" +
      "You are a nutrition-guidance drafting assistant for a Philippine meal-planning application. " +
      "Do not claim to be a licensed clinician and do not diagnose, prescribe, or replace a physician or Registered Nutritionist-Dietitian. " +
      "Use Philippine Food and Nutrition Research Institute (FNRI) references where they are provided. " +
      "Your target demographic is young urban health-conscious Filipinos (18-35). " +
      "Prioritize medical suitability, affordability, preparation effort, and realistic availability in the Philippines. " +
      "Use the person's food-culture preference as context rather than an exclusive cuisine rule. Recommendations may include Filipino foods, " +
      "universally familiar meals, foods adopted from other cultures, and suitable convenience products. Avoid expensive or hard-to-source items " +
      "when an accessible alternative offers comparable nutritional value.";

    const prompt = 
      `Analyze this patient profile and generate a comprehensive clinical nutrition assessment:\n` +
      `\n` +
      `[PATIENT PROFILE]\n` +
      `- Age: ${age} years\n` +
      `- Height: ${heightCm} cm\n` +
      `- Current Weight: ${weightKg} kg\n` +
      `- Goal Target: ${goal} (Daily Caloric Target: ${dailyCalorieTarget} kcal/day)\n` +
      `- Activity Level: ${activityLevel}\n` +
      `- Dietary Preference Pattern: ${profile.dietaryPreference || 'OMNIVORE'}\n` +
      `- Carb Intake Level: ${profile.carbPreference || 'MODERATE'}\n` +
      `- Regional Cooking Style & Cultural Background: ${profile.foodCulture || 'Filipino'}\n` +
      `\n` +
      `[CLINICAL CONSTRAINTS]\n` +
      `- Diagnosed Medical Conditions (HARD BOUNDS): ${conditions.join(', ') || 'NONE'}${otherConditions ? '; Additional: ' + otherConditions : ''}\n` +
      `- Confirmed Food Allergies (HARD EXCLUSIONS): ${allergens.join(', ') || 'NONE'}${otherAllergies ? '; Additional: ' + otherAllergies : ''}\n` +
      `\n` +
      `[AVAILABLE NATIVE FILIPINO INGREDIENTS CONTEXT]\n` +
      `${formattedLocalFoods}\n` +
      `\n` +
      `Generate guidelines using the native food items above as references. Return a STRICT, valid JSON object containing exactly these fields:\n` +
      `{\n` +
      `  "foodsToAvoid": ["Array of specific food items or categories to AVOID based on conditions and allergies. Be specific to Filipino contexts. Minimum 3 items."],\n` +
      `  "foodsToLimit": ["Array of food items to LIMIT or control portions (e.g. white rice, sodium elements, saturated fats). Minimum 3 items."],\n` +
      `  "foodsRecommended": ["Array of nutritious native food recommendations to increase (e.g. malunggay, specific local fish). Minimum 3 items."],\n` +
      `  "drinksGuidance": ["Array of specific hydration instructions (water metrics, buko juice limits, herbal options). Minimum 2 items."],\n` +
      `  "generalSummary": "A clear educational nutrition-guidance paragraph (3-4 sentences) explaining how the listed health conditions (e.g. ${conditions.join(', ') || 'none'}) and goals relate to the calorie target. Do not diagnose, prescribe treatment, or claim clinician review."\n` +
      `}\n` +
      `\n` +
      `Rules for content generation:\n` +
      `- If user has HYPERTENSION, strictly exclude bagoong, patis, high-sodium instant noodles, SPAM, and salty chicharon. Recommends kangkong, banana, low sodium garlic.\n` +
      `- If user has DIABETES, restrict refined white sugar, sweetened soft drinks, condensed milk, and large portions of white rice. Suggest brown rice, ampalaya, tokwa.\n` +
      `- If user has SHELLFISH allergy, exclude shrimps, crabs, mussels, talaba, and bagoong alamang.\n` +
      `- If user has DAIRY allergy, exclude fresh milk, evaporated milk, condensed milk, cheese, and halo-halo with dairy.\n` +
      `- If user has GLUTEN allergy, exclude wheat flour pan de sal, regular soy sauce, pancit canton.\n` +
      `- Keep suggestions highly realistic, affordable, and practical for young Filipinos.\n` +
      `- Return ONLY the clean JSON output. Do not wrap in markdown code blocks.`;

    console.log('[Nutrition Report] Querying Gemini API for an authenticated user...');

    // Define Zod response schema
    const NutritionReportSchema = z.object({
      foodsToAvoid: z.array(z.string()),
      foodsToLimit: z.array(z.string()),
      foodsRecommended: z.array(z.string()),
      drinksGuidance: z.array(z.string()),
      generalSummary: z.string(),
    });

    // 4. Request the real Gemini AI model to perform the assessment
    const reportData = await generateGenerativeJSON<{
      foodsToAvoid: string[];
      foodsToLimit: string[];
      foodsRecommended: string[];
      drinksGuidance: string[];
      generalSummary: string;
    }>(prompt, clinicalSystemInstruction, NutritionReportSchema, 0.2);

    // Validate structure format
    if (
      !Array.isArray(reportData.foodsToAvoid) ||
      !Array.isArray(reportData.foodsToLimit) ||
      !Array.isArray(reportData.foodsRecommended) ||
      !Array.isArray(reportData.drinksGuidance) ||
      typeof reportData.generalSummary !== 'string'
    ) {
      throw new Error('Gemini API returned an invalid JSON schema format.');
    }

    const savedReport = {
      userId,
      generalSummary: reportData.generalSummary,
      foodsToAvoid: reportData.foodsToAvoid,
      foodsToLimit: reportData.foodsToLimit,
      foodsRecommended: reportData.foodsRecommended,
      drinksGuidance: reportData.drinksGuidance,
      basedOnConditions: conditions,
      basedOnAllergies: allergens,
    };

    // 5. Persist the real report to database and reset acknowledgedAt (so guard lock activates)
    console.log(`[Nutrition Report] Persisting completed report to PostgreSQL...`);
    return prisma.nutritionReport.upsert({
      where: { userId },
      update: {
        ...savedReport,
        generatedAt: new Date(),
        acknowledgedAt: null,
      },
      create: {
        ...savedReport,
      },
    });
  }
}
