/**
 * Stable Gemini text models used for structured NutriMind generation.
 *
 * Keep this list pinned to explicit GA model IDs. Moving aliases such as
 * `gemini-flash-latest` make production behavior and audit evidence drift over
 * time without a corresponding code change.
 */
export const GEMINI_MODEL_SEQUENCE = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
] as const;

export type NutriMindGeminiModel = (typeof GEMINI_MODEL_SEQUENCE)[number];

/**
 * Gemini 3.6+ deprecates the legacy temperature/top-p/top-k sampling controls.
 * NutriMind only asks the provider for JSON here; Zod remains the authoritative
 * application-level response validator.
 */
export function buildGeminiGenerationConfig() {
  return {
    responseMimeType: 'application/json' as const,
  };
}
