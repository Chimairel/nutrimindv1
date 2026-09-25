import { GoogleGenerativeAI } from '@google/generative-ai';
import { ZodType } from 'zod';
import prisma from '@/lib/prisma';
import { AiUsageOperation, AiUsageStatus } from '@prisma/client';
import { buildGeminiGenerationConfig, GEMINI_MODEL_SEQUENCE } from '@/domain/gemini-model.policy';
import { AiCapacityDeferredError, AiCapacityService } from '@/services/ai-capacity.service';

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
  operation?: AiUsageOperation | keyof typeof AiUsageOperation;
  purpose?: string;
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
        operation: (event.operation as AiUsageOperation | undefined) ?? AiUsageOperation.OTHER,
        purpose: event.purpose,
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
  schema?: ZodType<T>,
  usage: { operation?: AiUsageOperation | keyof typeof AiUsageOperation; purpose?: string } = {}
): Promise<T> {
  const startedAt = Date.now();
  if (!apiKey) {
    await recordAiUsage({
      status: AiUsageStatus.FAILED,
      attempts: 1,
      latencyMs: Date.now() - startedAt,
      errorCode: 'MISSING_API_KEY',
      ...usage,
    });
    throw new Error('🛑 Google Gemini API Key is missing. Please set GEMINI_API_KEY in your .env file.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: any = null;
  let attempts = 0;
  let lastModel: string | undefined;

  // Try each model sequentially in the cascade sequence
  for (const modelName of GEMINI_MODEL_SEQUENCE) {
    lastModel = modelName;
    let reservationId: string | null = null;
    try {
      reservationId = await AiCapacityService.reserve({
        model: modelName,
        estimatedTokens: AiCapacityService.estimateTokens(prompt, systemInstruction),
        operation: (usage.operation as AiUsageOperation | undefined) ?? AiUsageOperation.OTHER,
      });
      attempts += 1;
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
            const issues = zodResult.error.issues.slice(0, 8).map((issue) => ({
              path: issue.path.join('.'),
              code: issue.code,
              message: issue.message.slice(0, 180),
            }));
            console.warn(`[Gemini AI] Response validation failed for model ${modelName}.`, issues);
            throw new Error(`Response validation failed for model ${modelName}.`);
          }
          console.log(`[Gemini AI] Successfully executed and Zod-validated response from: ${modelName}`);
          await recordAiUsage({
            model: modelName,
            status: AiUsageStatus.SUCCESS,
            attempts,
            latencyMs: Date.now() - startedAt,
            ...usage,
          });
          return zodResult.data;
        }

        console.log(`[Gemini AI] Successfully executed and parsed response from: ${modelName}`);
        await recordAiUsage({
          model: modelName,
          status: AiUsageStatus.SUCCESS,
          attempts,
          latencyMs: Date.now() - startedAt,
          ...usage,
        });
        return parsed as T;
      } catch {
        console.warn(`[Gemini AI] JSON parsing or response validation failed for model ${modelName}.`);
        throw new Error(`Failed to parse or validate the response from model ${modelName}.`);
      }
    } catch (cause: unknown) {
      if (cause instanceof AiCapacityDeferredError) throw cause;
      const quotaFault = cause as { status?: unknown; message?: unknown };
      if (
        quotaFault?.status === 429 ||
        (typeof quotaFault?.message === 'string' && /RESOURCE_EXHAUSTED|quota exceeded|rate limit exceeded/iu.test(quotaFault.message))
      ) {
        await recordAiUsage({
          model: modelName,
          status: AiUsageStatus.FAILED,
          attempts,
          latencyMs: Date.now() - startedAt,
          errorCode: 'PROVIDER_QUOTA',
          ...usage,
        });
        // A project quota fault is not a reason to spend the same project's
        // remaining allowance on every model in the fallback cascade.
        throw new AiCapacityDeferredError(
          'Gemini quota is temporarily unavailable. Please try again later.',
          new Date(Date.now() + 60_000)
        );
      }
      const err = new Error('The AI service could not generate a valid meal plan. Please try again later.');
      lastError = err;
      const providerError = cause as { status?: unknown; statusText?: unknown; message?: unknown };
      const diagnostic = {
        status: typeof providerError?.status === 'number' ? providerError.status : undefined,
        statusText: typeof providerError?.statusText === 'string' ? providerError.statusText.slice(0, 80) : undefined,
        message: typeof providerError?.message === 'string' ? providerError.message.slice(0, 240) : undefined,
      };
      console.warn(`⚠️ [Gemini AI] Call failed for model ${modelName}. Attempting fallback...`, diagnostic);
    } finally {
      if (reservationId) {
        try {
          await AiCapacityService.finish(reservationId);
        } catch {
          console.warn('[Gemini AI] Capacity reservation completion failed; lease will expire.');
        }
      }
    }
  }

  // If all models failed in sequence, throw aggregate error
  await recordAiUsage({
    model: lastModel,
    status: AiUsageStatus.FAILED,
    attempts,
    latencyMs: Date.now() - startedAt,
    errorCode: 'ALL_MODELS_FAILED',
    ...usage,
  });
  throw new Error(
    `🛑 All Gemini fallback models failed to resolve the request. Last error: ${lastError?.message || lastError}`
  );
}
