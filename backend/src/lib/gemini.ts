import { GoogleGenerativeAI } from '@google/generative-ai';
import { ZodType } from 'zod';

// Retrieve API Key
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('⚠️ GEMINI_API_KEY is not defined in environment variables.');
}

// Model sequence rotation (order of preference, updated June 2026)
// Free-tier Flash models first, heavier Pro models as fallback
const MODEL_SEQUENCE = [
  'gemini-3.5-flash',       // Latest, fastest — best free-tier option
  'gemini-2.5-flash',       // Stable, production-ready
  'gemini-3.1-flash-lite',  // High-volume, low-cost fallback
  'gemini-2.5-pro',         // Heavyweight reasoning fallback
];

/**
 * Cleans the generated text to ensure it's a valid JSON string by stripping
 * any accidental markdown code block wraps (e.g. ```json ... ```) that the
 * model might supply.
 */
function cleanJsonString(rawText: string): string {
  let cleaned = rawText.trim();
  
  // Strip opening markdown tags
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?\s*/i, '');
  }
  
  // Strip closing markdown tags
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\s*```$/i, '');
  }
  
  return cleaned.trim();
}

/**
 * Executes a generative content prompt requesting a strict JSON response.
 * Implements a 4-model cascade rotation fallback sequence in case of rate limits,
 * API faults, or regional quota limitations.
 * 
 * @param prompt The main text prompt to analyze
 * @param systemInstruction Optional system directives to enforce role behavior
 * @param schema Optional Zod schema to validate response against
 * @param temperature Optional temperature for token generation (defaults to 0.2)
 * @returns Parsed and validated JSON object of type T
 */
export async function generateGenerativeJSON<T = any>(
  prompt: string,
  systemInstruction?: string,
  schema?: ZodType<T>,
  temperature?: number
): Promise<T> {
  if (!apiKey) {
    throw new Error('🛑 Google Gemini API Key is missing. Please set GEMINI_API_KEY in your .env file.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: any = null;

  // Try each model sequentially in the cascade sequence
  for (const modelName of MODEL_SEQUENCE) {
    try {
      console.log(`[Gemini AI] Attempting prompt execution on model: ${modelName}`);

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction || undefined,
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: temperature !== undefined ? temperature : 0.2, // Default to 0.2 per addendum
        },
      });

      const response = result.response;
      const rawText = response.text();
      
      if (!rawText) {
        throw new Error(`Model ${modelName} returned an empty response.`);
      }

      const cleanedText = cleanJsonString(rawText);
      
      try {
        const parsed = JSON.parse(cleanedText);
        
        if (schema) {
          const zodResult = schema.safeParse(parsed);
          if (!zodResult.success) {
            console.warn(`[Gemini AI] Response validation failed for model ${modelName}.`);
            throw new Error(`Response validation failed for model ${modelName}.`);
          }
          console.log(`[Gemini AI] Successfully executed and Zod-validated response from: ${modelName}`);
          return zodResult.data;
        }

        console.log(`[Gemini AI] Successfully executed and parsed response from: ${modelName}`);
        return parsed as T;
      } catch {
        console.warn(`[Gemini AI] JSON parsing or response validation failed for model ${modelName}.`);
        throw new Error(`Failed to parse or validate the response from model ${modelName}.`);
      }

    } catch {
      const err = new Error('The AI service could not generate a valid meal plan. Please try again later.');
      lastError = err;
      console.warn(`⚠️ [Gemini AI] Call failed for model ${modelName}. Error: ${err.message || err}. Attempting fallback...`);
    }
  }

  // If all models failed in sequence, throw aggregate error
  throw new Error(
    `🛑 All Gemini fallback models failed to resolve the request. Last error: ${lastError?.message || lastError}`
  );
}
