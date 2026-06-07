import { FoodItem } from '@prisma/client';
export interface LookupResult {
    food: Partial<FoodItem>;
    source: 'FNRI' | 'ESTIMATED';
}
/**
 * Executes the 4-step ingredient lookup chain:
 * 1. Exact Match (Case-insensitive check on FoodItem.name)
 * 2. Alias Match (Checks traditional synonyms in FoodAlias)
 * 3. Fuzzy Match (Checks if FoodItem.name contains the search term.
 *    If found, registers a new FoodAlias to speed up future runs)
 * 4. Gemini Estimation (AI fallback estimation per 100g serving)
 *
 * @param ingredientName The search term typed or requested
 */
export declare function lookupIngredient(ingredientName: string): Promise<LookupResult>;
/**
 * Selects ~120 representative common local food items from major categories
 * in our seeded database to inject into the Gemini context.
 */
export declare function getFNRISubset(): Promise<{
    name: string;
    category: string | null;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
}[]>;
//# sourceMappingURL=fnri.d.ts.map