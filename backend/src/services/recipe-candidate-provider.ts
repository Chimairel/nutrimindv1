import type { DietaryPreference, MealType, RecipeRiceRole } from '@prisma/client';

export type RecipeCandidateProvenance = 'PANLASANG_PINOY' | 'USER_OBSERVED';

export interface RecipeCandidateProjection {
  id: string;
  providerRecordId: string;
  provenance: RecipeCandidateProvenance;
  displayName: string;
  normalizedName: string;
  category: string | null;
  description: string | null;
  contentSignature: string;
  sourceUrl: string;
  applicableMealTypes: MealType[];
  dietaryTags: DietaryPreference[];
  ingredients: Array<{ name: string; quantity?: number; unit?: string }>;
  ingredientsComplete: boolean;
  nutrition: { calories: number; proteinG: number; carbsG: number; fatG: number } | null;
  servingDescription: string | null;
  riceRole: RecipeRiceRole | null;
  imageUrl: string | null;
  videoUrl: string | null;
  state: 'ACTIVE' | 'RETIRED';
}

export interface CandidatePage {
  items: RecipeCandidateProjection[];
  nextCursor: string | null;
}

export interface RecipeCandidateProvider {
  readonly provenance: RecipeCandidateProvenance | 'MIXED_CORPUS';
  list(input: {
    sourceKind?: RecipeCandidateProvenance;
    recentFirst?: boolean;
    mealType?: MealType;
    dietaryPreference?: DietaryPreference;
    search?: string;
    calorieMinimum?: number;
    calorieMaximum?: number;
    excludeIds?: readonly string[];
    cursor?: string;
    limit: number;
  }): Promise<CandidatePage>;
}
