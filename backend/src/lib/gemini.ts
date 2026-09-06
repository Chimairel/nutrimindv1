import { GoogleGenerativeAI } from '@google/generative-ai';
import { ZodType } from 'zod';
import prisma from '@/lib/prisma';
import { AiUsageStatus } from '@prisma/client';
import {
  buildGeminiGenerationConfig,
  GEMINI_MODEL_SEQUENCE,
} from '@/domain/gemini-model.policy';

// Retrieve API Key
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('⚠️ GEMINI_API_KEY is not defined in environment variables.');
}

async function recordAiUsage(event: {
  model?: string;
  status: AiUsageStatus;
  attempts: number;
  latencyMs: number;
  errorCode?: string;
}) {
  try {
    await prisma.aiUsageEvent.create({
      data: {
        provider: 'GOOGLE_GEMINI',
        model: event.model,
        status: event.status,
        attempts: Math.max(1, event.attempts),
        latencyMs: Math.max(0, event.latencyMs),
        errorCode: event.errorCode,
      },
    });
  } catch {
    // Telemetry must never turn a successful AI response into a user failure.
    console.warn('[Gemini AI] Usage telemetry could not be recorded.');
  }
}

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
 * @returns Parsed and validated JSON object of type T
 */
export async function generateGenerativeJSON<T = any>(
  prompt: string,
  systemInstruction?: string,
  schema?: ZodType<T>
): Promise<T> {
  const startedAt = Date.now();
  if (!apiKey) {
    await recordAiUsage({
      status: AiUsageStatus.FAILED,
      attempts: 1,
      latencyMs: Date.now() - startedAt,
      errorCode: 'MISSING_API_KEY',
    });
    throw new Error('🛑 Google Gemini API Key is missing. Please set GEMINI_API_KEY in your .env file.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: any = null;
  let attempts = 0;
  let lastModel: string | undefined;

  // Try each model sequentially in the cascade sequence
  for (const modelName of GEMINI_MODEL_SEQUENCE) {
    attempts += 1;
    lastModel = modelName;
    try {
      console.log(`[Gemini AI] Attempting prompt execution on model: ${modelName}`);

      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction || undefined,
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: buildGeminiGenerationConfig(),
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
          await recordAiUsage({
            model: modelName,
            status: AiUsageStatus.SUCCESS,
            attempts,
            latencyMs: Date.now() - startedAt,
          });
          return zodResult.data;
        }

        console.log(`[Gemini AI] Successfully executed and parsed response from: ${modelName}`);
        await recordAiUsage({
          model: modelName,
          status: AiUsageStatus.SUCCESS,
          attempts,
          latencyMs: Date.now() - startedAt,
        });
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
  await recordAiUsage({
    model: lastModel,
    status: AiUsageStatus.FAILED,
    attempts,
    latencyMs: Date.now() - startedAt,
    errorCode: 'ALL_MODELS_FAILED',
  });
  throw new Error(
    `🛑 All Gemini fallback models failed to resolve the request. Last error: ${lastError?.message || lastError}`
  );
}
