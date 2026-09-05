-- The foundation checks intentionally permit both normalization fields to be
-- absent, but SQL CHECK treats NULL as accepted. These additional constraints
-- close the unit-without-quantity half-state without changing the immutable
-- foundation migration.
ALTER TABLE "IngredientPriceCommodity" ADD CONSTRAINT "IngredientPriceCommodity_normalization_pair_strict" CHECK (
    ("normalizedQuantity" IS NULL AND "normalizedUnit" IS NULL) OR
    ("normalizedQuantity" IS NOT NULL AND "normalizedQuantity" > 0 AND "normalizedUnit" IS NOT NULL)
);

ALTER TABLE "IngredientPriceObservation" ADD CONSTRAINT "IngredientPriceObservation_normalization_pair_strict" CHECK (
    ("normalizedQuantity" IS NULL AND "normalizedUnit" IS NULL) OR
    ("normalizedQuantity" IS NOT NULL AND "normalizedQuantity" > 0 AND "normalizedUnit" IS NOT NULL)
);
