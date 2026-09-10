UPDATE "GroceryItem" SET "quantity" = "quantity" * 1000, "purchasedQuantity" = "purchasedQuantity" * 1000, "unit" = 'g'
WHERE lower(trim("unit")) IN ('kg', 'kilogram', 'kilograms');
UPDATE "GroceryItem" SET "quantity" = "quantity" * 1000, "purchasedQuantity" = "purchasedQuantity" * 1000, "unit" = 'mL'
WHERE lower(trim("unit")) IN ('l', 'liter', 'liters', 'litre', 'litres');
UPDATE "GroceryList" SET "isStale" = true;
