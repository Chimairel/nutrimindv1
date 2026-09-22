CREATE TYPE "MealPlanCycleStatus" AS ENUM (
  'PREPARING',
  'UNDER_REVIEW',
  'READY_TO_SHOP',
  'INCOMPLETE_AT_DEADLINE',
  'SHOPPING_STARTED',
  'ACTIVE',
  'REVALIDATION_REQUIRED',
  'COMPLETED',
  'SUPERSEDED'
);

CREATE TYPE "MealPlanCycleDeadlineOutcome" AS ENUM ('COMPLETE', 'INCOMPLETE');

CREATE TABLE "MealPlanCycle" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planType" "PlanType" NOT NULL,
  "cycleRevision" INTEGER NOT NULL DEFAULT 1,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "preparationOpensAt" TIMESTAMP(3) NOT NULL,
  "shoppingDeadlineAt" TIMESTAMP(3) NOT NULL,
  "expectedSlotCount" INTEGER NOT NULL,
  "status" "MealPlanCycleStatus" NOT NULL DEFAULT 'PREPARING',
  "deadlineOutcome" "MealPlanCycleDeadlineOutcome",
  "readyAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "incompleteAcknowledgedAt" TIMESTAMP(3),
  "shoppingStartedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "supersededById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MealPlanCycle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MealPlanCycle_date_order_check" CHECK ("endDate" >= "startDate"),
  CONSTRAINT "MealPlanCycle_expected_slots_check" CHECK ("expectedSlotCount" > 0),
  CONSTRAINT "MealPlanCycle_revision_check" CHECK ("cycleRevision" > 0),
  CONSTRAINT "MealPlanCycle_no_self_supersession_check" CHECK ("supersededById" IS NULL OR "supersededById" <> "id")
);

WITH group_stats AS (
  SELECT
    mp."planGroupId" AS id,
    mp."userId",
    mp."planType",
    MIN(mp."scheduledDate") AS start_date,
    MAX(mp."scheduledDate") AS end_date,
    MIN(mp."createdAt") AS created_at,
    MAX(mp."createdAt") AS updated_at,
    COUNT(DISTINCT (mp."scheduledDate", mp."mealType")) FILTER (WHERE mp."status" = 'APPROVED')::INTEGER AS approved_slot_count,
    COUNT(*) FILTER (WHERE mp."status" = 'PENDING_REVIEW')::INTEGER AS pending_count,
    BOOL_AND(mp."status" = 'CANCELLED') AS all_cancelled
  FROM "MealPlan" mp
  GROUP BY mp."planGroupId", mp."userId", mp."planType"
), ranked AS (
  SELECT
    gs.*,
    GREATEST(1, (FLOOR(EXTRACT(EPOCH FROM (gs.end_date - gs.start_date)) / 86400)::INTEGER + 1) * 3) AS expected_slots,
    ROW_NUMBER() OVER (
      PARTITION BY gs."userId", gs."planType", gs.start_date
      ORDER BY gs.created_at ASC, gs.id ASC
    )::INTEGER AS cycle_revision,
    ROW_NUMBER() OVER (
      PARTITION BY gs."userId", gs."planType", gs.start_date
      ORDER BY gs.all_cancelled ASC, gs.created_at DESC, gs.id DESC
    )::INTEGER AS current_rank
  FROM group_stats gs
), prepared AS (
  SELECT
    r.*,
    CASE
      WHEN r.current_rank > 1 OR r.all_cancelled THEN 'SUPERSEDED'::"MealPlanCycleStatus"
      WHEN r.end_date < DATE_TRUNC('day', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila' THEN 'COMPLETED'::"MealPlanCycleStatus"
      WHEN r.start_date <= DATE_TRUNC('day', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila'
       AND r.end_date >= DATE_TRUNC('day', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila' THEN 'ACTIVE'::"MealPlanCycleStatus"
      WHEN r.pending_count = 0 AND r.approved_slot_count >= r.expected_slots THEN 'READY_TO_SHOP'::"MealPlanCycleStatus"
      ELSE 'UNDER_REVIEW'::"MealPlanCycleStatus"
    END AS cycle_status
  FROM ranked r
)
INSERT INTO "MealPlanCycle" (
  "id",
  "userId",
  "planType",
  "cycleRevision",
  "startDate",
  "endDate",
  "preparationOpensAt",
  "shoppingDeadlineAt",
  "expectedSlotCount",
  "status",
  "deadlineOutcome",
  "readyAt",
  "activatedAt",
  "supersededAt",
  "createdAt",
  "updatedAt"
)
SELECT
  p.id,
  p."userId",
  p."planType",
  p.cycle_revision,
  p.start_date,
  p.end_date,
  CASE WHEN p."planType" = 'WEEKLY' THEN p.start_date - INTERVAL '4 days' ELSE p.created_at END,
  CASE WHEN p."planType" = 'WEEKLY' THEN p.start_date - INTERVAL '1 day' ELSE p.start_date END,
  p.expected_slots,
  p.cycle_status,
  CASE
    WHEN p.cycle_status = 'SUPERSEDED' THEN NULL
    WHEN p.end_date < DATE_TRUNC('day', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila'
      THEN CASE WHEN p.approved_slot_count >= p.expected_slots THEN 'COMPLETE'::"MealPlanCycleDeadlineOutcome" ELSE 'INCOMPLETE'::"MealPlanCycleDeadlineOutcome" END
    ELSE NULL
  END,
  CASE WHEN p.pending_count = 0 AND p.approved_slot_count >= p.expected_slots THEN p.updated_at ELSE NULL END,
  CASE WHEN p.start_date <= DATE_TRUNC('day', CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila') AT TIME ZONE 'Asia/Manila' AND p.cycle_status <> 'SUPERSEDED' THEN p.start_date ELSE NULL END,
  CASE WHEN p.cycle_status = 'SUPERSEDED' THEN p.updated_at ELSE NULL END,
  p.created_at,
  p.updated_at
FROM prepared p;

WITH chosen_successor AS (
  SELECT
    old_cycle."id" AS old_id,
    newest."id" AS successor_id
  FROM "MealPlanCycle" old_cycle
  JOIN LATERAL (
    SELECT candidate."id"
    FROM "MealPlanCycle" candidate
    WHERE candidate."userId" = old_cycle."userId"
      AND candidate."planType" = old_cycle."planType"
      AND candidate."startDate" = old_cycle."startDate"
      AND candidate."status" <> 'SUPERSEDED'
    ORDER BY candidate."cycleRevision" DESC
    LIMIT 1
  ) newest ON TRUE
  WHERE old_cycle."status" = 'SUPERSEDED'
)
UPDATE "MealPlanCycle" cycle
SET "supersededById" = chosen_successor.successor_id
FROM chosen_successor
WHERE cycle."id" = chosen_successor.old_id;

WITH plan_bounds AS (
  SELECT
    mp."planGroupId",
    mp."userId",
    MIN(mp."scheduledDate") AS start_date,
    MAX(mp."scheduledDate") AS end_date
  FROM "MealPlan" mp
  GROUP BY mp."planGroupId", mp."userId"
), grocery_matches AS (
  SELECT
    gl."id" AS grocery_id,
    pb."planGroupId",
    COUNT(*) OVER (PARTITION BY gl."id") AS match_count
  FROM "GroceryList" gl
  JOIN plan_bounds pb
    ON pb."userId" = gl."userId"
   AND gl."generatedAt" >= pb.start_date
   AND gl."generatedAt" < pb.end_date + INTERVAL '1 day'
  WHERE gl."planGroupId" IS NULL
), unique_grocery_matches AS (
  SELECT grocery_id, "planGroupId"
  FROM grocery_matches
  WHERE match_count = 1
)
UPDATE "GroceryList" gl
SET "planGroupId" = match."planGroupId"
FROM unique_grocery_matches match
WHERE gl."id" = match.grocery_id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "GroceryList" WHERE "planGroupId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce GroceryList cycle identity: at least one legacy list has no unique plan-group match.';
  END IF;
  IF EXISTS (
    SELECT "planGroupId"
    FROM "GroceryList"
    GROUP BY "planGroupId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one grocery list per cycle: duplicate plan-group grocery lists exist.';
  END IF;
  IF EXISTS (
    SELECT "planGroupId"
    FROM "MealPlanGenerationJob"
    WHERE "planGroupId" IS NOT NULL
    GROUP BY "planGroupId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce one generation job per cycle: duplicate completed plan-group jobs exist.';
  END IF;
END $$;

ALTER TABLE "GroceryList" ALTER COLUMN "planGroupId" SET NOT NULL;

CREATE UNIQUE INDEX "MealPlanCycle_userId_planType_startDate_cycleRevision_key"
  ON "MealPlanCycle"("userId", "planType", "startDate", "cycleRevision");
CREATE UNIQUE INDEX "MealPlanCycle_one_live_identity_key"
  ON "MealPlanCycle"("userId", "planType", "startDate")
  WHERE "status" <> 'SUPERSEDED';
CREATE INDEX "MealPlanCycle_userId_startDate_endDate_status_idx"
  ON "MealPlanCycle"("userId", "startDate", "endDate", "status");
CREATE INDEX "MealPlanCycle_shoppingDeadlineAt_status_idx"
  ON "MealPlanCycle"("shoppingDeadlineAt", "status");
CREATE INDEX "MealPlanCycle_supersededById_idx" ON "MealPlanCycle"("supersededById");
CREATE INDEX "MealPlan_planGroupId_idx" ON "MealPlan"("planGroupId");
CREATE UNIQUE INDEX "GroceryList_planGroupId_key" ON "GroceryList"("planGroupId");
CREATE UNIQUE INDEX "MealPlanGenerationJob_planGroupId_key" ON "MealPlanGenerationJob"("planGroupId");

ALTER TABLE "MealPlanCycle"
  ADD CONSTRAINT "MealPlanCycle_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealPlanCycle"
  ADD CONSTRAINT "MealPlanCycle_supersededById_fkey"
  FOREIGN KEY ("supersededById") REFERENCES "MealPlanCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MealPlan"
  ADD CONSTRAINT "MealPlan_planGroupId_fkey"
  FOREIGN KEY ("planGroupId") REFERENCES "MealPlanCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroceryList"
  ADD CONSTRAINT "GroceryList_planGroupId_fkey"
  FOREIGN KEY ("planGroupId") REFERENCES "MealPlanCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealPlanGenerationJob"
  ADD CONSTRAINT "MealPlanGenerationJob_planGroupId_fkey"
  FOREIGN KEY ("planGroupId") REFERENCES "MealPlanCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MealPlanCycleSnapshot"
  ADD CONSTRAINT "MealPlanCycleSnapshot_planGroupId_fkey"
  FOREIGN KEY ("planGroupId") REFERENCES "MealPlanCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
