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
import { getNutritionEligibleMealLogWhere } from '@/domain/meal-actionability.policy';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';

interface LogOutsideMealInput {
  userId: string;
  mealName: string;
  mealType: MealType;
  warningAcknowledged?: boolean;
  confirmationId?: string;
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
    const { userId, mealName, mealType, warningAcknowledged = false, confirmationId, notes } = input;

    if (warningAcknowledged) {
      if (!confirmationId) throw new Error('A valid warning confirmation is required. Please preview the meal again.');
      return prisma.$transaction(async (tx) => {
        const preview = await tx.outsideMealPreview.findFirst({
          where: {
            id: confirmationId,
            userId,
            mealName,
            mealType,
            consumedAt: null,
            expiresAt: { gt: new Date() },
          },
        });
        if (!preview) throw new Error('This warning preview expired or was already used. Please preview the meal again.');

        const estimate = preview.estimate as unknown as AIOutsideMealEstimate;
        const warnings = Array.isArray(preview.warnings) ? preview.warnings.filter((item): item is string => typeof item === 'string') : [];
        const savedLog = await tx.mealLog.create({
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
            warningType: warnings.join(',') || null,
            warningShown: warnings.length > 0,
            warningAcknowledged: true,
            notes: preview.notes || notes || `AI Ingredients: ${estimate.ingredients?.join(', ')}`,
          },
        });
        await tx.outsideMealPreview.update({
          where: { id: preview.id },
          data: { consumedAt: new Date() },
        });
        return { warningRequired: false, log: savedLog };
      });
    }

    // 1. Fetch user profile, health conditions, and allergies
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userProfile: true,
        healthConditions: true,
        allergies: true,
        safetyProfileEntries: true,
      },
    });

    if (!user || !user.userProfile) {
      throw new Error('User profile must be initialized before logging meals.');
    }

    const dailyCalorieTarget = user.userProfile.dailyCalorieTarget || 2000;
    const safetyRestrictions = adaptUserSafetyRestrictions({
      safetyEntries: user.safetyProfileEntries,
      healthConditions: user.healthConditions.map((item) => item.condition),
      allergies: user.allergies.map((item) => item.allergen),
      otherConditions: user.userProfile.otherConditions,
      otherAllergies: user.userProfile.otherAllergies,
    });
    const conditions = safetyRestrictions.conditions;
    const allergens = safetyRestrictions.allergies;

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

    if (safetyRestrictions.requiresReview) {
      detectedWarnings.push('RESTRICTION_REVIEW');
      conflictReasons.push(
        'Your health profile contains an unsupported, pending, or evidence-incomplete restriction. This meal requires individual review before it can be treated as compatible.'
      );
    }

    /**
     * Normalize text for allergen matching:
     * - lowercase
     * - strip diacritical marks (e.g. ñ → n)
     * - collapse multiple whitespace to single space
     * - trim
     */
    function normalize(text: string): string {
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/\s+/g, ' ')
        .trim();
    }

    /**
     * Check if any keyword matches in the target string.
     * Short keywords (≤ 3 chars) use word-boundary matching to avoid
     * false positives (e.g. "nut" matching "nutrition", "egg" matching "eggplant").
     * Longer keywords use simple substring includes.
     */
    function matchesAny(target: string, keywords: string[]): string | null {
      for (const kw of keywords) {
        if (kw.length <= 3) {
          // Word-boundary match for short keywords
          const regex = new RegExp(`\\b${kw}s?\\b`, 'i');
          if (regex.test(target)) return kw;
        } else {
          if (target.includes(kw)) return kw;
        }
      }
      return null;
    }

    // Build normalized search corpus from ingredients + meal name
    const lowerIngredients = (estimate.ingredients || []).map((i) => normalize(i));
    const joinedIngs = lowerIngredients.join(' ') + ' ' + normalize(mealName);

    // ── Allergen Keyword Checks ──

    if (allergens.includes(AllergenType.SHELLFISH)) {
      const keywords = [
        'shrimp', 'prawn', 'crab', 'lobster', 'shellfish', 'mussel', 'clam', 'oyster',
        'scallop', 'squid', 'pusit', 'calamari', 'octopus',
        'hipon', 'sugpo', 'alimango', 'alimasag', 'tahong', 'talaba', 'alamang',
        'bagoong alamang', 'ginataang hipon', 'seafood',
      ];
      const hit = matchesAny(joinedIngs, keywords);
      if (hit) {
        detectedWarnings.push('ALLERGY');
        conflictReasons.push(`Contains shellfish indicator ("${hit}") matching your shellfish allergy.`);
      }
    }

    if (allergens.includes(AllergenType.NUTS)) {
      const keywords = [
        'peanut', 'cashew', 'almond', 'walnut', 'pecan', 'pistachio', 'macadamia',
        'hazelnut', 'pine nut', 'pili nut', 'pili', 'mani', 'kasuy',
        'peanut butter', 'kare-kare', 'kare kare', 'satay', 'nut',
      ];
      const hit = matchesAny(joinedIngs, keywords);
      if (hit) {
        detectedWarnings.push('ALLERGY');
        conflictReasons.push(`Contains nut indicator ("${hit}") matching your tree nut/peanut allergy.`);
      }
    }

    if (allergens.includes(AllergenType.DAIRY)) {
      const keywords = [
        'milk', 'cheese', 'butter', 'cream', 'yogurt', 'yoghurt', 'dairy',
        'whey', 'casein', 'ghee', 'paneer', 'queso', 'keso',
        'gatas', 'condensed milk', 'evaporated milk', 'powdered milk',
        'cream cheese', 'sour cream', 'ice cream', 'mozzarella', 'parmesan', 'cheddar',
      ];
      const hit = matchesAny(joinedIngs, keywords);
      if (hit) {
        detectedWarnings.push('ALLERGY');
        conflictReasons.push(`Contains dairy indicator ("${hit}") matching your lactose/dairy allergy.`);
      }
    }

    if (allergens.includes(AllergenType.GLUTEN)) {
      const keywords = [
        'wheat', 'flour', 'bread', 'gluten', 'pasta', 'spaghetti', 'macaroni',
        'noodles', 'pancit', 'pansit', 'miki', 'bihon', 'sotanghon',
        'pan de sal', 'pandesal', 'panko', 'breadcrumb', 'crouton',
        'soy sauce', 'toyo', 'teriyaki', 'dumpling', 'siomai', 'wonton',
        'ramen', 'udon', 'barley', 'couscous', 'seitan',
      ];
      const hit = matchesAny(joinedIngs, keywords);
      if (hit) {
        detectedWarnings.push('ALLERGY');
        conflictReasons.push(`Contains gluten/wheat indicator ("${hit}") matching your wheat/gluten allergy.`);
      }
    }

    if (allergens.includes(AllergenType.EGGS)) {
      const keywords = [
        'egg', 'itlog', 'mayo', 'mayonnaise', 'balut', 'penoy',
        'meringue', 'custard', 'leche flan', 'flan', 'quiche',
        'tortang', 'torta', 'omelette', 'omelet', 'scrambled',
      ];
      const hit = matchesAny(joinedIngs, keywords);
      if (hit) {
        detectedWarnings.push('ALLERGY');
        conflictReasons.push(`Contains egg indicator ("${hit}") matching your egg allergy.`);
      }
    }

    // ── Clinical Health Condition Checks ──

    if (conditions.includes(HealthConditionType.HYPERTENSION)) {
      const highSodium = (estimate.sodium || 0) > 400;
      const sodiumKeywords = [
        'chicharon', 'chicharron', 'spam', 'hotdog', 'hot dog', 'sausage', 'longganisa',
        'instant noodle', 'lucky me', 'nissin', 'cup noodle',
        'tuyo', 'daing', 'tinapa', 'patis', 'bagoong', 'soy sauce', 'toyo',
        'salted', 'corned beef', 'canned', 'tocino', 'bacon', 'ham',
        'sisig', 'lechon kawali',
      ];
      if (highSodium || matchesAny(joinedIngs, sodiumKeywords)) {
        detectedWarnings.push('CONDITION');
        conflictReasons.push(`High sodium estimated (${estimate.sodium}mg), which is medically unsafe for Hypertension.`);
      }
    }

    if (conditions.includes(HealthConditionType.DIABETES)) {
      const highSugar = (estimate.sugars || 0) > 15;
      const sugarKeywords = [
        'sugar', 'sweet', 'cake', 'pastry', 'soda', 'coke', 'soft drink',
        'juice', 'condensed milk', 'honey', 'syrup', 'maple',
        'turon', 'bananacue', 'kamotecue', 'halo-halo', 'halo halo',
        'leche flan', 'ube halaya', 'bibingka', 'puto',
        'chocolate', 'candy', 'donut', 'doughnut', 'ice cream',
        'gulaman', 'kalamay', 'sapin-sapin', 'sapin sapin',
      ];
      if (highSugar || matchesAny(joinedIngs, sugarKeywords)) {
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
        ...getNutritionEligibleMealLogWhere(),
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
      const preview = await prisma.outsideMealPreview.create({
        data: {
          userId,
          mealName,
          mealType,
          estimate: estimate as object,
          warnings: detectedWarnings,
          reasons: conflictReasons,
          notes,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
      return {
        warningRequired: true,
        confirmationId: preview.id,
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
