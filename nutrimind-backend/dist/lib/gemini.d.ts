/**
 * Executes a generative content prompt requesting a strict JSON response.
 * Implements a 4-model cascade rotation fallback sequence in case of rate limits,
 * API faults, or regional quota limitations.
 *
 * @param prompt The main text prompt to analyze
 * @param systemInstruction Optional system directives to enforce role behavior
 * @returns Parsed JSON object of type T
 */
export declare function generateGenerativeJSON<T = any>(prompt: string, systemInstruction?: string): Promise<T>;
//# sourceMappingURL=gemini.d.ts.map