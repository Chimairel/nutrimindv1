import prisma from '@/lib/prisma';
import { generateGenerativeJSON } from '@/lib/gemini';
import { FoodItem } from '@prisma/client';
import { normalizeFoodName, selectStrongFNRIMatch } from '@/domain/fnri-match.policy';

export interface LookupResult {
  food: Partial<FoodItem>;
  source: 'FNRI' | 'ESTIMATED';
}

/**
 * Executes the 4-step ingredient lookup chain:
 * 1. Exact Match (Case-insensitive check on FoodItem.name)
 * 2. Alias Match (accepts only a strong lexical target; legacy auto-aliases are untrusted)
 * 3. Strong lexical candidate match (never auto-registers an alias)
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

  if (
    aliasMatch?.foodItem
    && selectStrongFNRIMatch(cleanName, [aliasMatch.foodItem])
  ) {
    console.log(`[FNRI Lookup] Alias match resolved to "${aliasMatch.foodItem.name}" for search term: "${cleanName}"`);
    return {
      food: aliasMatch.foodItem,
      source: 'FNRI',
    };
  }

  if (aliasMatch?.foodItem) {
    console.warn(
      `[FNRI Lookup] Ignoring unsafe alias target "${aliasMatch.foodItem.name}" for "${cleanName}".`,
    );
  }

  // --- Step 3: Strong lexical candidate match ---
  // Search by the longest normalized token, then require every query token and
  // reject processed/specialty expansions that were not requested.
  const lookupToken = normalizeFoodName(cleanName)
    .split(' ')
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)[0];
  console.log(`[FNRI Lookup] Step 3: Searching strong lexical candidates for: "${cleanName}"`);
  const fuzzyCandidates = lookupToken ? await prisma.foodItem.findMany({
    where: {
      name: {
        contains: lookupToken,
        mode: 'insensitive',
      },
    },
    take: 50,
    orderBy: { name: 'asc' },
  }) : [];
  const fuzzyMatch = selectStrongFNRIMatch(cleanName, fuzzyCandidates);

  if (fuzzyMatch) {
    console.log(`[FNRI Lookup] Strong lexical match resolved to "${fuzzyMatch.name}".`);
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
    const estimated = await generateGenerativeJSON<Record<string, unknown>>(prompt, systemInstruction);
    
    const formattedFood: Partial<FoodItem> = {
      name: typeof estimated.name === 'string' ? estimated.name : cleanName,
      calories: Number(estimated.calories || 0),
      proteinG: Number(estimated.proteinG || 0),
      carbsG: Number(estimated.carbsG || 0),
      fatG: Number(estimated.fatG || 0),
      fiber: estimated.fiber !== null ? Number(estimated.fiber || 0) : null,
      sodium: estimated.sodium !== null ? Number(estimated.sodium || 0) : null,
      potassium: estimated.potassium !== null ? Number(estimated.potassium || 0) : null,
      calcium: estimated.calcium !== null ? Number(estimated.calcium || 0) : null,
      iron: estimated.iron !== null ? Number(estimated.iron || 0) : null,
      water: estimated.water !== null ? Number(estimated.water || 0) : null,
      source: 'GEMINI_ESTIMATED',
    };

    console.log(`[FNRI Lookup] Successfully estimated nutrient claims for: "${cleanName}"`, formattedFood);
    
    return {
      food: formattedFood,
      source: 'ESTIMATED',
    };
  } catch (err: unknown) {
    console.error(`[FNRI Lookup] Step 4 Gemini estimation failed:`, err);
    throw new Error(`Failed to resolve food item "${cleanName}" through database or AI estimation.`);
  }
}

/** Selects a balanced FNRI reference across every seeded food category. */
export async function getFNRISubset() {
  const referenceCategories = [
    'Cereals & Grains',
    'Starchy Roots & Tubers',
    'Dry Beans, Peas, Nuts & Seeds',
    'Vegetables',
    'Fruits',
    'Fish & Shellfish',
    'Meat & Poultry',
    'Eggs',
    'Milk & Dairy',
    'Fats & Oils',
    'Sugars & Sweets',
    'Beverages',
    'Miscellaneous',
  ];

  const foodsByCategory = await Promise.all(
    referenceCategories.map((category) =>
      prisma.foodItem.findMany({
        take: 10,
        where: { category },
        orderBy: { name: 'asc' },
        select: {
          name: true,
          category: true,
          calories: true,
          proteinG: true,
          carbsG: true,
          fatG: true,
        },
      })
    )
  );

  return foodsByCategory.flat();
}
