-- Compensation remains separate from the removed user subscription system.
-- Remove the abandoned provider-specific name while preserving the generic
-- future external-disbursement option and any historical enum value usage.

ALTER TYPE "CompensationPayoutMethod"
  RENAME VALUE 'PAYMONGO_DISBURSEMENT' TO 'EXTERNAL_DISBURSEMENT';
