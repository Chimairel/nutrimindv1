-- Preserve raw recipe ingredient provenance without treating it as FNRI or as
-- safety review evidence. IF NOT EXISTS also reconciles development databases
-- that received the value during the original corpus import.
ALTER TYPE "MealIngredientDataSource" ADD VALUE IF NOT EXISTS 'SOURCE_RECIPE';
