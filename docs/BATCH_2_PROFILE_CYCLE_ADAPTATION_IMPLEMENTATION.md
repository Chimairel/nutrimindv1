# Batch 2 — Profile, report, and cycle adaptation evidence

**Change ID:** CHG-20260922-02  
**Implemented:** September 22, 2026  
**Target database:** owner-authorized shared development Neon database

## Scope completed

Batch 2 now gives every nutrition-affecting profile save one deterministic revision and one explicit effect on the current and upcoming plan boundaries.

### Authoritative revision flow

- `UserProfile.revision` remains the monotonic identity for all nutrition-affecting profile data.
- `UserProfile.safetyRevision` increments with the profile revision for conditions, allergies, pregnancy, and newly introduced hard dietary exclusions.
- `NutritionReport.profileRevision` records the exact profile revision represented by the report.
- Onboarding now creates the matching immutable `NutritionReportVersion` row for acknowledged baseline version 1; later generated versions continue the same history.
- A report acknowledgment succeeds only for the current version when it is not stale and its `profileRevision` equals the live profile revision.
- `MealPlanCycleSnapshot` remains immutable. It records the weight, target, preferences, and profile/safety revisions used at generation time.
- `MealPlanCycle` now records mutable adaptation work through `profileAdaptationState`, requested revisions, acknowledged revision, and bounded change kinds.

### Ordinary profile changes

One semantic save of age, biological sex, height, weight, target weight, goal, activity, ordinary dietary preference, rice preference, food culture/locality, or shopping schedule:

1. updates the profile in one transaction;
2. increments `UserProfile.revision` once;
3. recalculates the live daily calorie target where enough data exists;
4. marks the current report stale and clears its acknowledgment;
5. leaves the active cycle snapshot unchanged;
6. leaves a shopping-started upcoming cycle unchanged;
7. places each unfrozen upcoming cycle in `AWAITING_REPORT_ACKNOWLEDGMENT` for that exact revision.

After exact report acknowledgment, a normal unfrozen upcoming cycle becomes `REBUILD_REQUIRED`. Its old rows remain available as input for the later preparation/reranking batch, but the cycle cannot be used for shopping. A shopping-day change supersedes the unfrozen upcoming dated identity, cancels its actionable slots, and stales its grocery projection because its dates are no longer authoritative. Batch 4 consumes `REBUILD_REQUIRED` to preserve compatible slots and rebuild the remainder.

Repeated identical saves return the current profile without incrementing a revision or creating a `HealthProfileRevision` row.

### Immediate safety changes

A safety change immediately:

- increments both profile and safety revisions;
- marks every current/future unconsumed actionable slot pending revalidation;
- sets every nonterminal current/future cycle to `SAFETY_REVALIDATION_REQUIRED` and status `REVALIDATION_REQUIRED`, including shopping-started cycles;
- stales grocery projections;
- runs the existing explicit-evidence safety recheck.

Report acknowledgment alone does not release this gate. The cycle returns to `CURRENT` only after the exact requested report revision is acknowledged and every expected slot is `APPROVED` with `requiresSafetyRevalidation = false`. A cycle with missing, conflicting, unknown, or pending evidence remains blocked.

### Explicit rice preference

The API, onboarding, profile editor, report prompt, generation prompt, nutritionist review detail, and TypeScript types now use:

- `NO_RICE`
- `FLEXIBLE`
- `WITH_RICE`

The earlier `LOW` / `MODERATE` / `HIGH` carbohydrate field was removed from `UserProfile` and `MealPlanCycleSnapshot`; it is no longer accepted by profile validation or used as a hidden rice proxy. Existing profiles were assigned `FLEXIBLE` with `DEFAULTED` provenance. Any explicit save changes provenance to `USER_SELECTED`.

The migration preflight found obsolete carb labels on 12 profiles (9 moderate, 1 high, 2 null) and 7 cycle snapshots (5 moderate, 1 high, 1 null). Removing those labels did not remove or recalculate stored calorie targets, macro targets, weight history, plans, groceries, or clinical evidence.

Recipe rice roles and composed-serving signatures remain Batch 3. This batch records the user preference without pretending that a recipe has already been classified as ulam, standalone, or rice-included.

## Weekly check-in behavior retained

The existing cycle-bound weekly check-in implementation already satisfies the Batch 2 boundary:

- closing the modal submits nothing;
- “no change” creates a response without a weight measurement;
- a real multi-field change advances the profile revision once;
- missed cycles remain absent rather than becoming fabricated flat weight points;
- the prompt remains tied to the current cycle until answered or the cycle ends.

## Database migrations

- `20260922190000_add_profile_cycle_adaptation`
  - completed the earlier nullable rice field with a default and provenance;
  - added cycle adaptation state and exact revision fields;
  - added rice preference and provenance to immutable snapshots.
- `20260922200000_remove_legacy_carb_preference`
  - removed the obsolete carb proxy from profiles and snapshots.
- `20260922210000_rename_rice_default_provenance`
  - generalized migrated/unconfirmed provenance to `DEFAULTED` while preserving explicit `USER_SELECTED` values.

The first deploy attempt exposed an already applied older `RicePreference` type and nullable profile column from migration `20260919010000_rice_preference`. The failed transaction made no partial changes. Its migration record was marked rolled back, the forward migration was corrected to complete the existing column instead of recreating it, and deployment then succeeded. Prisma reports **58 migrations applied** and a current schema.

## Runtime acceptance evidence

`npm run test:acceptance:profile-cycles` creates a disposable user and three synthetic cycle states in the development database, exercises the real services, asserts the results, and cascades the fixture away. It proved:

- ordinary update revision: `1`;
- repeated identical save remains revision `1` and creates no audit row;
- active snapshot retains the original `70 kg` value;
- unfrozen upcoming moves from acknowledgment wait to `REBUILD_REQUIRED`;
- shopping-day acknowledgment supersedes the unfrozen upcoming identity;
- shopping-started upcoming remains frozen for ordinary changes;
- explicit rice selection stores `WITH_RICE` / `USER_SELECTED`;
- safety revision increments to `1`;
- safety gate remains after acknowledgment while a slot is pending;
- gate releases only after the expected slot is explicitly revalidated.

## Verification

- Development database: 58 migrations, current.
- Backend: build passed; lint passed; script type checking passed.
- Backend tests: **461 passed, 0 failed, 1 existing clinical-policy TODO** across 462 tests.
- Frontend: production build passed; lint passed; **201/201 tests passed** across 53 files.
- Database acceptance: profile/cycle adaptation passed with cleanup.

## Boundaries retained for later batches

- Candidate preservation and reranking for a `REBUILD_REQUIRED` cycle is Batch 4.
- Recipe meal-type applicability, recipe rice role, FNRI-scaled paired rice, and composed-serving signatures are Batch 3.
- Progressive next-cycle grocery population is Batch 5.
- No subscription, entitlement, monetary-budget input, or Premium access behavior was restored.
