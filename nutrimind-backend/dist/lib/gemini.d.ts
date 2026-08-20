import { ZodType } from 'zod';
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
export declare function generateGenerativeJSON<T = any>(prompt: string, systemInstruction?: string, schema?: ZodType<T>, temperature?: number): Promise<T>;
//# sourceMappingURL=gemini.d.ts.map