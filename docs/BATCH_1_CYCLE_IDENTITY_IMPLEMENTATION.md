# Batch 1 — Authoritative Plan Cycle Implementation Evidence

**Implemented:** September 22, 2026

**Change ID:** CHG-20260922-01

**Target:** Owner-authorized shared development database

**Starting commit:** `ea52c0d`

## Scope completed

Batch 1 establishes `MealPlanCycle` as the dated, mutable lifecycle root for one plan group. `MealPlanCycleSnapshot` remains the immutable record of the profile inputs and targets used to generate that cycle.

The implementation provides:

- independent authoritative current and upcoming cycle lookup;
- Asia/Manila start, end, preparation-open, and shopping-cutoff timestamps;
- lifecycle states separate from each slot's `MealPlanStatus`;
- persisted complete versus incomplete deadline outcome;
- explicit acknowledgment for an incomplete grocery subset;
- an explicit start-shopping action and an atomic first-purchase transition;
- grocery projection freeze after shopping begins;
- profile-shopping-day independence for an already-created current cycle;
- one live cycle identity per user and start date;
- supersession and revision history for replaced cycles;
- relational integrity from plans, groceries, generation jobs, and snapshots to the cycle root;
- idempotent lifecycle synchronization and promotion on current/upcoming reads.

Automatic candidate population of the upcoming root, deadline fallback ranking, and the progressive next-week grocery interface remain in Batches 4 and 5. Batch 1 supplies the cycle identity and state transitions those workflows consume.

## Pre-migration evidence

The initial database had 53 applied migrations and was current. Aggregate inspection found:

| Record | Count |
| --- | ---: |
| Users | 20 |
| User profiles | 12 |
| Meal-plan rows | 100 |
| Distinct plan groups | 10 |
| Grocery lists | 4 |
| Cycle snapshots | 7 |
| Generation jobs | 6 |
| Weekly check-ins | 1 |

Three historical plan groups had no snapshot. This did not block the cycle-root backfill because the root owns identity and lifecycle while the snapshot remains optional immutable generation evidence.

Three grocery lists had a null legacy `planGroupId`. Each had exactly one user-and-timestamp match to an existing plan group. No grocery list or generation job referenced an unknown group, and no duplicate generation-job cycle link existed.

## Migration dry run and application

Migration `20260922150000_add_authoritative_plan_cycles` was executed inside an explicit transaction and rolled back before application. Its 22 statements would produce:

- 8 `COMPLETED` cycle roots;
- 2 `SUPERSEDED` duplicate historical starter roots;
- 0 orphan plan rows;
- 0 orphan grocery lists;
- 0 orphan snapshots;
- 0 orphan generation jobs.

The migration then applied successfully. Original record counts remained unchanged and all three legacy grocery lists received a required cycle identity.

A second additive migration, `20260922160000_tighten_live_cycle_identity`, was also transactionally dry-run before application. It found no conflicting live identities, then replaced the initial partial index with a stricter unique index on `(userId, startDate)` for every non-superseded cycle. The development database now has 55 applied migrations and reports current status.

Both migrations fail closed when legacy data cannot be mapped unambiguously. No historical migration was changed.

## Current naming map

| Contract concept | Implemented schema/API name |
| --- | --- |
| Cycle root | `MealPlanCycle` |
| Existing plan-group identity | `MealPlanCycle.id` / `MealPlan.planGroupId` |
| Immutable generation inputs and targets | `MealPlanCycleSnapshot` |
| Cycle state | `MealPlanCycle.status` / `MealPlanCycleStatus` |
| Deadline result | `MealPlanCycle.deadlineOutcome` / `MealPlanCycleDeadlineOutcome` |
| Gap acknowledgment | `MealPlanCycle.incompleteAcknowledgedAt` |
| Shopping freeze boundary | `MealPlanCycle.shoppingStartedAt` |
| Current/upcoming lookup | `GET /api/user/meals/cycles` |
| Acknowledge partial list | `POST /api/user/meals/cycles/:cycleId/acknowledge-incomplete` |
| Explicit shopping start | `POST /api/user/meals/cycles/:cycleId/start-shopping` |

## Runtime behavior

`MealPlanCycleService` is the shared authority for cycle reconciliation. It counts distinct cleared date-and-meal-type slots, records when the complete slot set was actually ready, evaluates the cutoff without rewriting a late completion as on time, promotes a cycle on its start date, and completes it after its end date. `REVALIDATION_REQUIRED` remains fail closed while the cycle is current.

The current-plan controller, grocery service, and weekly check-in service now resolve the current cycle from the persisted root. They no longer recalculate identity from the user's live `shoppingDayOfWeek` or `shoppingDayGroup`. Regenerating a current cycle retains its authoritative dates even if the live profile changed.

The first grocery purchase/check and the explicit start action both use the same compare-and-set shopping transition. An incomplete cycle must be acknowledged first. Once shopping has started, ordinary projection retries return the existing frozen list and cannot silently add ingredients from a delayed review.

## Fixture compatibility

All acceptance fixtures that directly create `MealPlan` or `GroceryList` rows now create a valid cycle root first. Fixtures unrelated to current-cycle behavior attach to `SUPERSEDED` roots so they cannot influence current/upcoming lookup. The account-deletion acceptance now also proves that the user-owned cycle root cascades away while shared library data and the deidentified audit event remain.

## Verification

- Prisma schema validation: passed.
- Migration status: 55 migrations applied; database current.
- Backend TypeScript build: passed.
- Backend lint: passed.
- Backend script type checking: passed.
- Backend deterministic suite: 458 tests, 457 passed, 0 failed, 1 pre-existing clinical-policy TODO.
- Batch 1 tests cover all seven shopping weekdays, Manila cutoff boundaries, starter timing, late readiness, immutable deadline outcome, incomplete on-time activation, schema/FK authority, and service centralization.
- `test:acceptance:plan-cycles`: passed current identity persistence across profile edits, independent current/upcoming lookup, database rejection of duplicate live identity, idempotent promotion, one-time shopping start, and post-start grocery freeze.
- `test:acceptance:account-deletion`: passed, including cycle-root cascade.
- Frontend tests: 201 passed across 53 files.
- Frontend lint: passed.
- Frontend production build: passed for all 51 routes.
- `git diff --check`: passed.

## Remaining batch boundaries

- Batch 2 applies profile and report revisions to an unfrozen or frozen upcoming cycle.
- Batch 4 creates and fills upcoming cycles ahead of the deadline, including RND deadline ordering and safe fallbacks.
- Batch 5 exposes progressive current/upcoming grocery views.
- Batch 6 adds the explicit grocery-delta acknowledgment needed for a user-authorized post-shopping swap.
