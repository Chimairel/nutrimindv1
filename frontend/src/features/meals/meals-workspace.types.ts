import type { RetainedMealLog } from './RetainedMealLogs';
import type { PendingMealPreview } from '@/components/user/PendingMealPreviewCard';
import type { CycleMetaSnapshot } from '@/features/dashboard/model';
import type { MealCookingLink, MealPlan, PublicMealImage, PublicVerifier } from '@/types';

export type SwapNutritionMatch = 'CLOSE' | 'GAPS_REMAIN' | 'PARTIAL_DAY' | 'UNAVAILABLE';

export interface SwapOption {
  nutritionFitScore?: number;
  nutritionMatch?: SwapNutritionMatch;
  id: string;
  reuseBasis?: 'CERTIFIED_RECIPE' | 'PROFILE_MATCHED_APPROVAL' | 'PANLASANG_GENERAL_BASE';
  pairedRiceG?: number | null;
  ricePortionLabel?: string | null;
  mealName: string;
  description?: string;
  mealType: string;
  mealTypes: string[];
  riceRole?: 'PAIR_WITH_RICE' | 'STANDALONE' | 'INCLUDES_RICE' | null;
  riceRoleReviewStatus?: 'NOT_REVIEWED' | 'PROPOSED' | 'REVIEWED';
  includedRiceG?: number | null;
  servingDescription?: string;
  alreadyPlannedInCycle?: boolean;
  matchesDietaryPreference?: boolean;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  verifiedBy: string;
  prcLicenseNumber: string;
  verifier?: PublicVerifier | null;
  image?: PublicMealImage | null;
  cookingLink?: MealCookingLink | null;
}

export type SwapNutritionAnalysis = {
  before: { calories: number; proteinG: number; carbsG: number; fatG: number };
  after: { calories: number; proteinG: number; carbsG: number; fatG: number };
  target: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    explanation: string;
    basis: string;
  } | null;
  completeDay: boolean;
  warnings: string[];
  nutritionMatch?: SwapNutritionMatch;
  macroChanges?: Array<{
    nutrient: 'proteinG' | 'carbsG' | 'fatG';
    direction: 'CLOSER' | 'FURTHER' | 'UNCHANGED';
    status: 'WITHIN_ESTIMATE' | 'ABOVE' | 'BELOW';
  }>;
};

export interface MealHistoryLog {
  id: string;
  loggedAt: string;
  mealName: string;
  source: 'SYSTEM_GENERATED' | 'USER_LOGGED' | 'USER_SWAPPED';
  status: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  calorieDelta?: number | null;
  notes?: string | null;
  nutritionCompleteness?: 'COMPLETE' | 'PARTIAL' | 'UNRESOLVED';
  provisionalCalories?: number;
  hasImage?: boolean;
  voidedAt?: string | null;
  mealType?: string | null;
  outsideItems?: Array<{
    id: string;
    name: string;
    portionGrams?: number | null;
    calories?: number | null;
    proteinG?: number | null;
    carbsG?: number | null;
    fatG?: number | null;
    nutritionStatus?: string;
    source?: string;
    includedInTotals?: boolean;
    currentRevision?: number;
    revisions?: Array<{ revision: number; reason?: string | null }>;
    observedSubmissions?: Array<{
      id: string;
      sourceRevision: number;
      status: string;
      imageReuseConsentedAt?: string | null;
    }>;
    review?: {
      id: string;
      status: string;
      queueReason?: string | null;
      requestedByUserAt?: string | null;
      reviewedRevision?: number | null;
      reviewedAt?: string | null;
      messages: Array<{
        id: string;
        sender: 'USER' | 'NUTRITIONIST';
        itemRevision: number;
        content: string;
        createdAt: string;
      }>;
    } | null;
  }>;
}

export interface PendingReviewState {
  mealCount: number;
  planType: 'STARTER' | 'WEEKLY';
  reviewStatus: 'PENDING_REVIEW';
  meals: PendingMealPreview[];
}

export interface CurrentPlanSnapshot {
  retainedMealLogs?: RetainedMealLog[];
  meals: MealPlan[];
  pendingReview: PendingReviewState | null;
  awaitingGeneration?: { current: number; upcoming: number };
  generationStatus?: { current: string | null; upcoming: string | null };
  cycles?: {
    current?: CycleMetaSnapshot | null;
    upcoming?: CycleMetaSnapshot | null;
  } | null;
  isStarterPlan?: boolean;
  nextCycleDay?: string | null;
}
