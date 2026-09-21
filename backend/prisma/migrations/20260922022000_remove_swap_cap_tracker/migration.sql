-- Swap quantity is no longer a product limit. Preserve SwapLog as the
-- idempotent activity record and remove the obsolete per-plan counter.

ALTER TABLE "SwapLog"
  DROP CONSTRAINT IF EXISTS "SwapLog_planSwapTrackerId_fkey";

ALTER TABLE "SwapLog"
  DROP COLUMN IF EXISTS "planSwapTrackerId";

DROP TABLE IF EXISTS "PlanSwapTracker";
