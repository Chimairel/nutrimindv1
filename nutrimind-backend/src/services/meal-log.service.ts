import prisma from '@/lib/prisma';
import { generateGenerativeJSON } from '@/lib/gemini';
import { 
  MealType, 
  MealLogSource, 
  MealLogDataSource, 
  MealLogStatus, 
  HealthConditionType, 
  AllergenType 
} from '@prisma/client';

interface LogOutsideMealInput {
  userId: string;
  mealName: string;
  mealType: MealType;
  warningAcknowledged?: boolean;
  notes?: string;
}

interface AIOutsideMealEstimate {
  name?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodium?: number; // mg
  sugars?: number; // g
  ingredients: string[];
}

export class MealLogService {
  /**
   * Evaluates and logs an outside meal.
   * Performs real-time AI estimations and cross-references against:
   * 1. Clinical conditions (sugar levels, high sodium)
   * 2. Food allergens (keyword ingredient mapping)
   * 3. Daily caloric budget overages
   * 
   * If any conflict is found and warningAcknowledged is false, returns the warnings
   * to the client without saving.
   */
  static async logOutsideMeal(input: LogOutsideMealInput) {
    const { userId, mealName, mealType, warningAcknowledged = false, notes } = input;

    // 1. Fetch user profile, health conditions, and allergies
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userProfile: true,
        healthConditions: true,
        allergies: true,
      },
    });

    if (!user || !user.userProfile) {
      throw new Error('User profile must be initialized before logging meals.');
    }

    const dailyCalorieTarget = user.userProfile.dailyCalorieTarget || 2000;
    const conditions = user.healthConditions.map((c) => c.condition);
    const allergens = user.allergies.map((a) => a.allergen);

    // 2. Perform Gemini AI nutritional and ingredient estimation
    console.log(`[Meal Log] Querying Gemini AI estimation for outside meal: "${mealName}"`);
    
    const systemInstruction = 
      "You are a clinical database dietitian specialized in estimating nutritional statistics for restaurant and home-cooked dishes in the Philippines.";

    const prompt = 
      `Estimate the nutritional values and main ingredients of one standard serving of: "${mealName}".\n` +
      `Return a strict, valid JSON object with the following keys:\n` +
      `{\n` +
      `  "calories": number,\n` +
      `  "proteinG": number,\n` +
      `  "carbsG": number,\n` +
      `  "fatG": number,\n` +
      `  "sodium": number (mg, estimate based on recipe standard),\n` +
      `  "sugars": number (g),\n` +
      `  "ingredients": ["Array of lowercase primary raw ingredients (e.g. ['pork', 'soy sauce', 'garlic', 'vinegar', 'sugar'])"]\n` +
      `}\n` +
      `Return ONLY raw JSON, do not include markdown code block wraps.`;

    const estimate = await generateGenerativeJSON<AIOutsideMealEstimate>(prompt, systemInstruction);

    // --- WARNING CHECKS LAYER ---
    const detectedWarnings: string[] = [];
    const conflictReasons: string[] = [];

    // Check Allergen Keywords
    const lowerIngredients = (estimate.ingredients || []).map((i) => i.toLowerCase());
    const joinedIngs = lowerIngredients.join(' ') + ' ' + mealName.toLowerCase();

    if (allergens.includes(AllergenType.SHELLFISH)) {
      const keywords = ['shrimp', 'prawn', 'crab', 'lobster', 'shellfish', 'mussel', 'clam', 'oyster', 'hipon', 'alimango', 'alimasag', 'tahong', 'talaba', 'alamang', 'seafood'];
      if (keywords.some((k) => joinedIngs.includes(k))) {
        detectedWarnings.push('ALLERGY');
        conflictReasons.push('Contains shellfish indicators matching your shellfish allergy.');
      }
    }

    if (allergens.includes(AllergenType.NUTS)) {
      const keywords = ['peanut', 'cashew', 'almond', 'walnut', 'pecan', 'nut', 'mani', 'kasuy', 'hazelnut'];
      if (keywords.some((k) => joinedIngs.includes(k))) {
        detectedWarnings.push('ALLERGY');
        conflictReasons.push('Contains nut indicators matching your tree nut/peanut allergy.');
      }
    }

    if (allergens.includes(AllergenType.DAIRY)) {
      const keywords = ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'dairy', 'gatas', 'keso', 'condensed milk', 'evaporated milk'];
      if (keywords.some((k) => joinedIngs.includes(k))) {
        detectedWarnings.push('ALLERGY');
        conflictReasons.push('Contains dairy indicators matching your lactose/dairy allergy.');
      }
    }

    if (allergens.includes(AllergenType.GLUTEN)) {
      const keywords = ['wheat', 'flour', 'bread', 'gluten', 'pasta', 'spaghetti', 'macaroni', 'noodles', 'pan de sal', 'soy sauce', 'toyo'];
      if (keywords.some((k) => joinedIngs.includes(k))) {
        detectedWarnings.push('ALLERGY');
        conflictReasons.push('Contains gluten/wheat indicators matching your wheat/gluten allergy.');
      }
    }

    if (allergens.includes(AllergenType.EGGS)) {
      const keywords = ['egg', 'itlog', 'mayo', 'mayonnaise', 'balut', 'penoy'];
      if (keywords.some((k) => joinedIngs.includes(k))) {
        detectedWarnings.push('ALLERGY');
        conflictReasons.push('Contains egg indicators matching your egg allergy.');
      }
    }

    // Check Clinical Health Conditions
    if (conditions.includes(HealthConditionType.HYPERTENSION)) {
      const highSodium = (estimate.sodium || 0) > 400;
      const sodiumKeywords = ['chicharon', 'spam', 'hotdog', 'sausage', 'instant noodle', 'tuyo', 'patis', 'bagoong', 'soy sauce', 'toyo', 'salted'];
      if (highSodium || sodiumKeywords.some((k) => joinedIngs.includes(k))) {
        detectedWarnings.push('CONDITION');
        conflictReasons.push(`High sodium estimated (${estimate.sodium}mg), which is medically unsafe for Hypertension.`);
      }
    }

    if (conditions.includes(HealthConditionType.DIABETES)) {
      const highSugar = (estimate.sugars || 0) > 15;
      const sugarKeywords = ['sugar', 'sweet', 'cake', 'pastry', 'soda', 'coke', 'juice', 'condensed milk', 'honey', 'syrup', 'turon', 'bananacue'];
      if (highSugar || sugarKeywords.some((k) => joinedIngs.includes(k))) {
        detectedWarnings.push('CONDITION');
        conflictReasons.push(`High simple sugar content estimated (${estimate.sugars}g), which may spike blood glucose for Diabetics.`);
      }
    }

    // Check Daily Calorie Target Exceedance
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const loggedToday = await prisma.mealLog.findMany({
      where: {
        userId,
        loggedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    const totalLoggedCalories = loggedToday.reduce((sum, m) => sum + m.calories, 0);
    const projectedTotal = totalLoggedCalories + estimate.calories;

    if (projectedTotal > dailyCalorieTarget) {
      detectedWarnings.push('CALORIE_EXCEEDED');
      conflictReasons.push(
        `Logging this meal puts you at ${Math.round(projectedTotal)} kcal, exceeding your daily target of ${dailyCalorieTarget} kcal by ${Math.round(projectedTotal - dailyCalorieTarget)} kcal.`
      );
    }

    // If warnings exist and have NOT been acknowledged, return warnings payload
    if (detectedWarnings.length > 0 && !warningAcknowledged) {
      console.log(`[Meal Log] Clinical warning flagged. Returning pre-check payload to client. Warnings: ${detectedWarnings.join(', ')}`);
      return {
        warningRequired: true,
        warnings: detectedWarnings,
        reasons: conflictReasons,
        estimate: {
          calories: estimate.calories,
          proteinG: estimate.proteinG,
          carbsG: estimate.carbsG,
          fatG: estimate.fatG,
        },
      };
    }

    // Persist log if clean OR acknowledged by user
    console.log(`[Meal Log] Saving outside meal log into database...`);
    const savedLog = await prisma.mealLog.create({
      data: {
        userId,
        source: MealLogSource.USER_LOGGED,
        mealName: estimate.name || mealName,
        calories: estimate.calories,
        proteinG: estimate.proteinG,
        carbsG: estimate.carbsG,
        fatG: estimate.fatG,
        dataSource: MealLogDataSource.GEMINI_ESTIMATED,
        status: MealLogStatus.DONE,
        warningType: detectedWarnings.length > 0 ? detectedWarnings.join(',') : null,
        warningShown: detectedWarnings.length > 0,
        warningAcknowledged: warningAcknowledged,
        notes: notes || `AI Ingredients: ${estimate.ingredients?.join(', ')}`,
      },
    });

    return {
      warningRequired: false,
      log: savedLog,
    };
  }
}
