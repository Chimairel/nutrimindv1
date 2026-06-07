export type Role = 'USER' | 'NUTRITIONIST' | 'ADMIN';

export type Goal = 'LOSE_WEIGHT' | 'GAIN_WEIGHT' | 'MAINTAIN' | 'BUILD_MUSCLE';

export type ActivityLevel = 'SEDENTARY' | 'LIGHTLY_ACTIVE' | 'ACTIVE' | 'VERY_ACTIVE';

export type DietaryPreference = 'OMNIVORE' | 'VEGETARIAN' | 'VEGAN' | 'PESCATARIAN';

export type CarbPreference = 'LOW' | 'MODERATE' | 'HIGH';

export type HealthConditionType = 'DIABETES' | 'HYPERTENSION' | 'KIDNEY_DISEASE' | 'HEART_CONDITION' | 'PREGNANT' | 'NONE';

export type AllergenType = 'SHELLFISH' | 'NUTS' | 'DAIRY' | 'GLUTEN' | 'EGGS' | 'NONE';

export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

export type MealPlanStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type AIConfidenceFlag = 'SAFE' | 'CAUTION' | 'NEEDS_REVIEW';

export type MealLogSource = 'SYSTEM_GENERATED' | 'USER_LOGGED';

export type MealLogDataSource = 'FNRI' | 'GEMINI_ESTIMATED' | 'SYSTEM';

export type MealLogStatus = 'DONE' | 'PENDING' | 'SKIPPED';

export type NotificationType = 'PLAN_APPROVED' | 'PLAN_REJECTED' | 'REVIEW_REQUEST' | 'ASSIGNMENT' | 'WEEKLY_CHECKIN';

export type AssignmentStatus = 'PENDING' | 'ACTIVE' | 'ENDED';

export interface JWTPayload {
  userId: string;
  email: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  tosAccepted: boolean;
  tosAcceptedAt?: string;
  onboardingDone: boolean;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  targetWeightKg?: number;
  goal?: Goal;
  activityLevel?: ActivityLevel;
  dietaryPreference?: DietaryPreference;
  carbPreference?: CarbPreference;
  foodCulture?: string;
  dailyCalorieTarget?: number;
  lastCheckinAt?: string;
  checkinStreak: number;
  updatedAt: string;
}

export interface HealthCondition {
  id: string;
  userId: string;
  condition: HealthConditionType;
}

export interface Allergy {
  id: string;
  userId: string;
  allergen: AllergenType;
}

export interface NutritionReport {
  id: string;
  userId: string;
  generatedAt: string;
  acknowledgedAt?: string;
  foodsToAvoid: unknown; // JSON structure
  foodsToLimit: unknown;  // JSON structure
  foodsRecommended: unknown; // JSON structure
  drinksGuidance: unknown;   // JSON structure
  generalSummary: string;
  basedOnConditions: unknown;
  basedOnAllergies: unknown;
}

export interface FoodItem {
  id: string;
  name: string;
  category?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiber?: number;
  sodium?: number;
  potassium?: number;
  calcium?: number;
  iron?: number;
  vitaminA?: number;
  vitaminC?: number;
  vitaminB1?: number;
  vitaminB2?: number;
  niacin?: number;
  water?: number;
  source: string;
}

export interface MealPlan {
  id: string;
  planGroupId: string;
  userId: string;
  nutritionistId?: string;
  libraryMealId?: string;
  status: MealPlanStatus;
  mealType: MealType;
  mealName: string;
  description?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  aiConfidenceFlag: AIConfidenceFlag;
  nutritionistNote?: string;
  scheduledDate: string;
  reviewedAt?: string;
  createdAt: string;
  ingredients?: MealIngredient[];
  mealLogs?: MealLog[];
}

export interface MealIngredient {
  id: string;
  mealPlanId: string;
  foodItemId?: string;
  ingredientName: string;
  category?: string;
}

export interface MealLog {
  id: string;
  userId: string;
  mealPlanId?: string;
  source: MealLogSource;
  mealName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  dataSource: MealLogDataSource;
  status: MealLogStatus;
  warningType?: string;
  warningShown: boolean;
  warningAcknowledged: boolean;
  loggedAt: string;
  notes?: string;
}

export interface WeightLog {
  id: string;
  userId: string;
  weightKg: number;
  loggedAt: string;
  note?: string;
}

export interface DailyNutritionLog {
  id: string;
  userId: string;
  logDate: string;
  totalCalories: number;
  totalProteinG: number;
  totalCarbsG: number;
  totalFatG: number;
  targetCalories: number;
  adherencePct: number;
}
