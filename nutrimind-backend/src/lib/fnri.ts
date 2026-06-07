import prisma from '@/lib/prisma';
import { generateGenerativeJSON } from '@/lib/gemini';
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
export async function lookupIngredient(ingredientName: string): Promise<LookupResult> {
  const cleanName = ingredientName.trim();
  if (!cleanName) {
    throw new Error('Ingredient name cannot be empty.');
  }

  // --- Step 1: Exact Match (Case-insensitive) ---
  console.log(`[FNRI Lookup] Step 1: Searching exact match for: "${cleanName}"`);
  const exactMatch = await prisma.foodItem.findFirst({
    where: {
      name: {
        equals: cleanName,
        mode: 'insensitive',
      },
    },
  });

  if (exactMatch) {
    console.log(`[FNRI Lookup] Exact match found in database for: "${cleanName}"`);
    return {
      food: exactMatch,
      source: 'FNRI',
    };
  }

  // --- Step 2: Alias Match ---
  console.log(`[FNRI Lookup] Step 2: Searching alias database for: "${cleanName}"`);
  const aliasMatch = await prisma.foodAlias.findFirst({
    where: {
      alias: {
        equals: cleanName,
        mode: 'insensitive',
      },
    },
    include: {
      foodItem: true,
    },
  });

  if (aliasMatch && aliasMatch.foodItem) {
    console.log(`[FNRI Lookup] Alias match resolved to "${aliasMatch.foodItem.name}" for search term: "${cleanName}"`);
    return {
      food: aliasMatch.foodItem,
      source: 'FNRI',
    };
  }

  // --- Step 3: Fuzzy Match (Contains) ---
  console.log(`[FNRI Lookup] Step 3: Searching fuzzy matches (contains) for: "${cleanName}"`);
  const fuzzyMatch = await prisma.foodItem.findFirst({
    where: {
      name: {
        contains: cleanName,
        mode: 'insensitive',
      },
    },
  });

  if (fuzzyMatch) {
    console.log(`[FNRI Lookup] Fuzzy match resolved to "${fuzzyMatch.name}". Registering alias mapping...`);
    
    // Auto-register search term as an alias so future lookups hit Step 2
    try {
      await prisma.foodAlias.create({
        data: {
          foodItemId: fuzzyMatch.id,
          alias: cleanName.toLowerCase(),
        },
      });
    } catch (aliasErr) {
      console.warn(`[FNRI Lookup] Non-blocking alias registration warning:`, aliasErr);
    }

    return {
      food: fuzzyMatch,
      source: 'FNRI',
    };
  }

  // --- Step 4: Gemini AI Estimation Fallback (Last Resort) ---
  console.log(`[FNRI Lookup] Step 4: Performing Gemini AI clinical estimation for: "${cleanName}"`);
  
  const systemInstruction = 
    "You are a clinical database dietitian specialized in the Philippine Food Composition Table. " +
    "Provide accurate, realistic macronutrient and micronutrient estimations per 100 grams of raw, standard raw edible portion.";

  const prompt = 
    `Estimate the nutritional values per 100g portion of: "${cleanName}".\n` +
    `Return a strict, valid JSON object with the following keys:\n` +
    `{\n` +
    `  "name": "Clean name of the food (e.g. Chicken Adobo)",\n` +
    `  "calories": number,\n` +
    `  "proteinG": number,\n` +
    `  "carbsG": number,\n` +
    `  "fatG": number,\n` +
    `  "fiber": number or null,\n` +
    `  "sodium": number or null,\n` +
    `  "potassium": number or null,\n` +
    `  "calcium": number or null,\n` +
    `  "iron": number or null,\n` +
    `  "water": number or null\n` +
    `}\n` +
    `Strictly follow these rules:\n` +
    `- Provide realistic, clinically defensible values matching standard dietary books.\n` +
    `- Return only the raw JSON object. Do not include markdown code block wraps.`;

  try {
    const estimated = await generateGenerativeJSON<any>(prompt, systemInstruction);
    
    const formattedFood: Partial<FoodItem> = {
      name: estimated.name || cleanName,
      calories: parseFloat(estimated.calories || 0),
      proteinG: parseFloat(estimated.proteinG || 0),
      carbsG: parseFloat(estimated.carbsG || 0),
      fatG: parseFloat(estimated.fatG || 0),
      fiber: estimated.fiber !== null ? parseFloat(estimated.fiber || 0) : null,
      sodium: estimated.sodium !== null ? parseFloat(estimated.sodium || 0) : null,
      potassium: estimated.potassium !== null ? parseFloat(estimated.potassium || 0) : null,
      calcium: estimated.calcium !== null ? parseFloat(estimated.calcium || 0) : null,
      iron: estimated.iron !== null ? parseFloat(estimated.iron || 0) : null,
      water: estimated.water !== null ? parseFloat(estimated.water || 0) : null,
      source: 'GEMINI_ESTIMATED',
    };

    console.log(`[FNRI Lookup] Successfully estimated nutrient claims for: "${cleanName}"`, formattedFood);
    
    return {
      food: formattedFood,
      source: 'ESTIMATED',
    };
  } catch (err: any) {
    console.error(`[FNRI Lookup] Step 4 Gemini estimation failed:`, err);
    throw new Error(`Failed to resolve food item "${cleanName}" through database or AI estimation.`);
  }
}

/**
 * Selects ~120 representative common local food items from major categories
 * in our seeded database to inject into the Gemini context.
 */
export async function getFNRISubset() {
  const commonCategories = [
    '%cereal%', '%fish%', '%vegetable%', '%fruit%', '%meat%', '%poultry%'
  ];
  
  // Pull common food items from database
  const foods = await prisma.foodItem.findMany({
    take: 130,
    where: {
      OR: commonCategories.map(cat => ({
        category: {
          contains: cat.replace(/%/g, ''),
          mode: 'insensitive'
        }
      }))
    },
    select: {
      name: true,
      category: true,
      calories: true,
      proteinG: true,
      carbsG: true,
      fatG: true,
    }
  });

  return foods;
}
