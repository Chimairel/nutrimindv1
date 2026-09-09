export const OUTSIDE_MEAL_MAX_ITEMS = 10;
export const OUTSIDE_MEAL_AI_DAILY_CAP = 5;
export const OUTSIDE_MEAL_AI_ROLLING_30_DAY_CAP = 30;

export type OutsideMealItemSource =
  'VERIFIED_LIBRARY' | 'FNRI' | 'USER_REPORTED' | 'GEMINI_ESTIMATED' | 'NUTRITIONIST_REVIEWED' | 'UNRESOLVED';

export type OutsideMealNutritionStatus =
  | 'REFERENCE_RESOLVED'
  | 'USER_REPORTED'
  | 'PENDING_REVIEW'
  | 'VERIFIED'
  | 'CORRECTED'
  | 'NEEDS_MORE_INFO'
  | 'UNRESOLVED';

export interface OutsideMealMacros {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface ParsedOutsideMealItem {
  name: string;
  portionGrams: number | null;
}

export function resolveOutsideMealAiLimits(env: NodeJS.ProcessEnv = process.env) {
  const parse = (name: string, fallback: number, maximum: number) => {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    if (!/^\d+$/.test(raw)) throw new Error(`${name} must be a positive integer.`);
    const value = Number(raw);
    if (value < 1 || value > maximum) throw new Error(`${name} must be between 1 and ${maximum}.`);
    return value;
  };
  const dailyCap = parse('OUTSIDE_MEAL_AI_DAILY_CAP', OUTSIDE_MEAL_AI_DAILY_CAP, 20);
  const rolling30DayCap = parse('OUTSIDE_MEAL_AI_30_DAY_CAP', OUTSIDE_MEAL_AI_ROLLING_30_DAY_CAP, 300);
  if (rolling30DayCap < dailyCap) throw new Error('OUTSIDE_MEAL_AI_30_DAY_CAP cannot be lower than the daily cap.');
  return { dailyCap, rolling30DayCap };
}

export interface OutsideMealResolvedItem extends OutsideMealMacros {
  source: OutsideMealItemSource;
  nutritionStatus: OutsideMealNutritionStatus;
  includedInTotals: boolean;
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

export function assertValidOutsideMealMacros(value: OutsideMealMacros): void {
  if (
    !finiteNonNegative(value.calories) ||
    !finiteNonNegative(value.proteinG) ||
    !finiteNonNegative(value.carbsG) ||
    !finiteNonNegative(value.fatG)
  ) {
    throw new RangeError('Nutrition values must be finite, non-negative numbers.');
  }
  if (value.calories > 10_000 || value.proteinG > 1_000 || value.carbsG > 2_000 || value.fatG > 1_000) {
    throw new RangeError('Nutrition values exceed the supported per-item range.');
  }
}

export function parseOutsideMealItems(value: string): ParsedOutsideMealItem[] {
  const rawItems = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (rawItems.length === 0) throw new Error('Enter at least one food item.');
  if (rawItems.length > OUTSIDE_MEAL_MAX_ITEMS) {
    throw new Error(`Log at most ${OUTSIDE_MEAL_MAX_ITEMS} food items at once.`);
  }

  return rawItems.map((raw) => {
    const match = raw.match(/^(.*?)(?:\s*[-(]\s*)(\d+(?:\.\d+)?)\s*g(?:rams?)?\s*\)?$/i);
    const name = (match?.[1] ?? raw).trim();
    if (!name) throw new Error('Every food item needs a name.');
    if (name.length > 180) throw new Error('Each food item must be 180 characters or fewer.');
    const portionGrams = match ? Number(match[2]) : null;
    if (portionGrams !== null && (!Number.isFinite(portionGrams) || portionGrams <= 0 || portionGrams > 5_000)) {
      throw new Error('Food portions must be between 0 and 5,000 grams.');
    }
    return { name, portionGrams };
  });
}

export function scalePer100GramMacros(macros: OutsideMealMacros, portionGrams: number): OutsideMealMacros {
  if (!Number.isFinite(portionGrams) || portionGrams <= 0 || portionGrams > 5_000) {
    throw new RangeError('A measured portion between 0 and 5,000 grams is required for FNRI nutrition.');
  }
  assertValidOutsideMealMacros(macros);
  const scale = portionGrams / 100;
  return {
    calories: macros.calories * scale,
    proteinG: macros.proteinG * scale,
    carbsG: macros.carbsG * scale,
    fatG: macros.fatG * scale,
  };
}

export function summarizeOutsideMealNutrition(items: readonly OutsideMealResolvedItem[]) {
  const included = items.filter((item) => item.includedInTotals);
  const provisional = included.filter(
    (item) => item.nutritionStatus === 'PENDING_REVIEW' || item.nutritionStatus === 'NEEDS_MORE_INFO'
  );
  const unresolved = items.filter((item) => !item.includedInTotals || item.source === 'UNRESOLVED');
  const sum = (field: keyof OutsideMealMacros, rows = included) => rows.reduce((total, item) => total + item[field], 0);
  return {
    totals: {
      calories: sum('calories'),
      proteinG: sum('proteinG'),
      carbsG: sum('carbsG'),
      fatG: sum('fatG'),
    },
    provisionalCalories: sum('calories', provisional),
    provisionalItemCount: provisional.length,
    unresolvedItemCount: unresolved.length,
    completeness: unresolved.length > 0 ? (included.length > 0 ? 'PARTIAL' : 'UNRESOLVED') : 'COMPLETE',
  } as const;
}

export function resolveOutsideMealAiAllowance(input: {
  tier: 'FREE' | 'PREMIUM';
  requestedItems: number;
  usedToday: number;
  usedRolling30Days: number;
  dailyCap?: number;
  rolling30DayCap?: number;
}) {
  const dailyCap = input.dailyCap ?? OUTSIDE_MEAL_AI_DAILY_CAP;
  const rolling30DayCap = input.rolling30DayCap ?? OUTSIDE_MEAL_AI_ROLLING_30_DAY_CAP;
  const remainingToday = Math.max(0, dailyCap - input.usedToday);
  const remainingRolling = Math.max(0, rolling30DayCap - input.usedRolling30Days);
  if (input.tier !== 'PREMIUM') {
    return { allowed: false, reason: 'PREMIUM_REQUIRED', remainingToday, remainingRolling } as const;
  }
  if (input.requestedItems <= 0) {
    return { allowed: true, reason: 'NO_AI_NEEDED', remainingToday, remainingRolling } as const;
  }
  if (input.requestedItems > remainingToday) {
    return { allowed: false, reason: 'DAILY_LIMIT_REACHED', remainingToday, remainingRolling } as const;
  }
  if (input.requestedItems > remainingRolling) {
    return { allowed: false, reason: 'ROLLING_LIMIT_REACHED', remainingToday, remainingRolling } as const;
  }
  return { allowed: true, reason: 'ALLOWED', remainingToday, remainingRolling } as const;
}

export function outsideMealReviewPriority(input: {
  compatibilityStatus: string;
  warningCount: number;
  uncertaintyRatio?: number | null;
}): number {
  let priority = 10;
  if (input.compatibilityStatus === 'CONFLICT_DETECTED') priority += 90;
  else if (input.compatibilityStatus === 'REVIEW_REQUIRED') priority += 60;
  else if (input.compatibilityStatus === 'INSUFFICIENT_EVIDENCE') priority += 40;
  priority += Math.min(20, Math.max(0, input.warningCount) * 5);
  if ((input.uncertaintyRatio ?? 0) >= 0.3) priority += 15;
  return priority;
}
