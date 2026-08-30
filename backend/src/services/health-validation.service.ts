import { generateGenerativeJSON } from '../lib/gemini';

export const COMMON_CONDITIONS = [
  "Diabetes (Type 1)",
  "Diabetes (Type 2)",
  "Gestational Diabetes",
  "Hypertension",
  "Hypotension",
  "Chronic Kidney Disease (CKD)",
  "Acute Kidney Injury (AKI)",
  "Nephrotic Syndrome",
  "Coronary Artery Disease (CAD)",
  "Congestive Heart Failure (CHF)",
  "Arrhythmia",
  "Hyperthyroidism",
  "Hypothyroidism",
  "Polycystic Ovary Syndrome (PCOS)",
  "Asthma",
  "COPD",
  "GERD",
  "Irritable Bowel Syndrome (IBS)",
  "Inflammatory Bowel Disease (IBD)",
  "Celiac Disease",
  "Gout",
  "Rheumatoid Arthritis",
  "Osteoarthritis",
  "Osteoporosis",
  "Anemia",
  "Fatty Liver Disease",
  "Liver Cirrhosis",
  "Gallstones",
  "Kidney Stones",
  "Lactose Intolerance",
  "Epilepsy",
  "Migraine",
  "Sleep Apnea",
  "Obesity",
  "Hyperlipidemia",
  "Hyperuricemia",
  "G6PD Deficiency",
];

export const COMMON_ALLERGIES = [
  "Peanuts",
  "Tree Nuts",
  "Shellfish",
  "Mollusks",
  "Fish",
  "Dairy",
  "Eggs",
  "Soy",
  "Wheat",
  "Sesame",
  "Mustard",
  "Celery",
  "Lupin",
  "Sulfites",
  "Mango",
  "Pineapple",
  "Kiwi",
  "Strawberry",
  "Citrus",
  "Banana",
  "Avocado",
  "Garlic",
  "Onion",
  "Tomato",
  "Eggplant",
  "Coconut",
  "Honey",
  "Chocolate",
  "Yeast",
  "Corn",
  "Chicken",
  "Beef",
  "Pork",
  "MSG",
];

interface NormalizationResponse {
  normalized: string;
  isValid: boolean;
}

export class HealthValidationService {
  /**
   * Cleans, checks, and normalizes a custom condition or allergy entered by a user.
   * Leverages Gemini to correct spelling and parse shorthand to standardized medical or culinary terms.
   * If the input is invalid or garbage, returns "INVALID".
   */
  static async normalizeHealthInput(
    rawText: string,
    type: 'condition' | 'allergy'
  ): Promise<string> {
    const prompt = `
      Analyze the user input representing a ${type}: "${rawText}".
      
      Determine if this is a plausible, real medical condition or food allergy.
      - If it is real (even with typos, spelling mistakes, shorthand, or Filipino phrasing/shorthand), correct it to its standard professional medical or culinary term.
      - If it is not a real condition or allergy (gibberish like "asdf", random phrases, greeting words, "none", "nil", "n/a", etc.), mark it as invalid.
      
      Return a JSON object conforming exactly to this structure:
      {
        "normalized": "standardized term if valid, or empty string",
        "isValid": true or false
      }
    `;

    try {
      const response = await generateGenerativeJSON<NormalizationResponse>(prompt);
      if (!response.isValid || !response.normalized) {
        return 'INVALID';
      }
      return response.normalized.trim();
    } catch (error) {
      console.error('[HealthValidationService] Gemini normalization error:', error);
      // Let it throw to indicate service failure/timeout
      throw error;
    }
  }
}
