-- Additive preferences: existing National, Regional and Local values are unchanged.
ALTER TYPE "MealLocalityPreference" ADD VALUE IF NOT EXISTS 'NATIONAL_REGIONAL';
ALTER TYPE "MealLocalityPreference" ADD VALUE IF NOT EXISTS 'REGIONAL_LOCAL';
