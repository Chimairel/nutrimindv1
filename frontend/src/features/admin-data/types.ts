import axios from 'axios';

export type ReferenceDataDomain =
  'FOOD_COMPOSITION' | 'FOOD_CONSUMPTION' | 'INGREDIENT_PRICE' | 'MEAL_CATALOGUE' | 'MEAL_MEDIA';

export type ReleaseStatus = 'DRAFT' | 'STAGED' | 'ACTIVE' | 'RETIRED';

export interface DataSource {
  id: string;
  code: string;
  name: string;
  agencyName: string;
  domain: ReferenceDataDomain;
  homepageUrl: string;
  termsUrl?: string | null;
  attributionText: string;
  updateCadence?: string | null;
  isEnabled: boolean;
}

export interface DataRelease {
  id: string;
  sourceId: string;
  versionLabel: string;
  surveyYear?: number | null;
  sourceUrl: string;
  retrievedAt: string;
  contentSha256?: string | null;
  status: ReleaseStatus;
  activatedAt?: string | null;
  retiredAt?: string | null;
  source: Pick<DataSource, 'code' | 'name' | 'domain' | 'isEnabled'>;
  createdByAdmin: { name: string };
  activatedByAdmin?: { name: string } | null;
  mappings: Record<string, number>;
  _count: { consumptionStats: number; activations: number };
}

export interface WorkspaceSummary {
  foodItems: number;
  foodAliases: number;
  mealLibrary: number;
  completeMealLibrary: number;
  priceSources: number;
  pricePublications: number;
  priceObservations: number;
  consumptionStats: number;
  dataSources: number;
  activeReleases: number;
}

export interface DataWorkspace {
  summary: WorkspaceSummary;
  sources: DataSource[];
  releases: DataRelease[];
  consumptionCsvTemplate: string;
}

export interface FoodAlias {
  id: string;
  alias: string;
  verifiedAt?: string | null;
  verifiedByAdmin?: { name: string } | null;
}

export interface FoodItem {
  id: string;
  name: string;
  energyKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  aliases: FoodAlias[];
}

export interface FoodPage {
  foods: FoodItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ConsumptionStat {
  id: string;
  populationGroup: string;
  geographyLevel: string;
  regionName?: string | null;
  provinceHucName?: string | null;
  foodNameRaw: string;
  rank?: number | null;
  percentConsuming?: number | null;
  meanIntakeG?: number | null;
  mappingStatus: 'EXACT' | 'MANUAL' | 'REVIEW_REQUIRED' | 'UNMAPPED';
  foodItem?: { id: string; name: string } | null;
}

export interface ConsumptionPage {
  rows: ConsumptionStat[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export function getApiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export const fieldClassName =
  'w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-4 py-3 text-sm text-brand-text outline-none transition focus:border-brand-green/55 focus:ring-4 focus:ring-brand-green/10';
