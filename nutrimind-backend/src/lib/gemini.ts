import { GoogleGenerativeAI } from '@google/generative-ai';

// Retrieve API Key
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('⚠️ GEMINI_API_KEY is not defined in environment variables.');
}

// Model sequence rotation (order of preference)
const MODEL_SEQUENCE = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash'
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
 * @returns Parsed JSON object of type T
 */
export async function generateGenerativeJSON<T = any>(
  prompt: string,
  systemInstruction?: string
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
          temperature: 0.1, // Low temperature for highly consistent, deterministic structure
        },
      });

      const response = result.response;
      const rawText = response.text();
      
      if (!rawText) {
        throw new Error(`Model ${modelName} returned an empty response.`);
      }

      const cleanedText = cleanJsonString(rawText);
      
      try {
        const parsed = JSON.parse(cleanedText) as T;
        console.log(`[Gemini AI] Successfully executed and parsed response from: ${modelName}`);
        return parsed;
      } catch (parseErr) {
        console.error(`[Gemini AI] JSON parse failure on text from model ${modelName}. Raw content:`, rawText);
        throw new Error(`Failed to parse generative response from model ${modelName} as JSON.`);
      }

    } catch (err: any) {
      lastError = err;
      console.warn(`⚠️ [Gemini AI] Call failed for model ${modelName}. Error: ${err.message || err}. Attempting fallback...`);
    }
  }

  // If all models failed in sequence, throw aggregate error
  throw new Error(
    `🛑 All Gemini fallback models failed to resolve the request. Last error: ${lastError?.message || lastError}`
  );
}
