# Batch 4 — Upcoming preparation, ranking, and deadline-aware review

**Change ID:** CHG-20260923-01

**Status:** Implemented in the development worktree and migrated in the authorized shared development database

**Policy version:** `UPCOMING_PREPARATION_V1`

## Scope delivered

### One idempotent upcoming-cycle operation

`UpcomingPlanPreparationService` calls `MealGenerationService.ensureUpcomingPlanForUser` from:

- the daily backend check-in scheduler;
- dashboard meal-cycle access;
- grocery access; and
- nutrition-report acknowledgment after profile changes.

The operation resolves the next authoritative weekly window in Asia/Manila, returns an existing cycle when one already exists, and uses the existing unique generation-job identity to coalesce concurrent creation attempts. Acknowledged `REBUILD_REQUIRED` and `SAFETY_REVALIDATION_REQUIRED` upcoming cycles are regenerated against the newly acknowledged profile revision. Preparation opens three calendar days before the shopping cutoff for `BASE`/`STANDARD`, and five days before it for `ENHANCED`.

### Candidate order and ranking

Each slot follows the locked order:

1. bounded eligible certified-library query;
2. bounded raw-recipe provider lookup;
3. FNRI reconciliation and deterministic validation;
4. bounded Gemini generation only for slots still empty.

Candidate scores run only after hard eligibility checks. The persisted score has explainable reason codes for clearance coverage, allergen evidence, ingredient and nutrient completeness, diet/meal-type fit, review count, calorie fit, rice preference, locality evidence, and variety. It is never presented as a probability of safety or approval. Certified meals are allocated while the planner walks earliest slots, so exhausted certified supply leaves later slots provisional. A reviewed `PAIR_WITH_RICE` recipe can receive an explicit 75 g, 150 g, or 225 g FNRI cooked-rice component only when the composed serving remains inside the slot range; recipes with an existing rice component are not given extra rice.

### Review identity, deadlines, and coalescing

Pending candidates persist a SHA-256 `reviewWorkKey` over recipe signature, evidence revision, sorted condition/allergen scope, safety-policy version, and reviewer requirement. The RND queue:

- sorts by shopping deadline, cook date, enhanced second review, then existing confidence priority;
- returns intended cycle/date/type, assurance tier, review stage, remaining reviewer count, deterministic findings, provenance, fallback availability, and ranking reasons;
- shows source, deadline, cook date, assurance tier, remaining reviews, and coalesced dependent count in the current queue UI; and
- coalesces equivalent work while retaining a decision record on every dependent slot.

The first enhanced decision propagates only to unclaimed equivalent work. The independent Lead decision then publishes those same dependents. Different reviewer IDs, Lead eligibility, blind rationale handling, profile-revision checks, and claim compare-and-set behavior remain enforced. An edited review is scoped to the edited slot and is not propagated.

### Rejection and deadline fallback

Rejected candidates now try, in order:

1. a currently eligible certified replacement;
2. the next viable raw-corpus recipe through FNRI preparation and deterministic checks; and
3. at most three schema-validated, deterministically checked Gemini replacement attempts.

The old candidate remains in history and points to its replacement through `supersededByMealPlanId`. At the shopping deadline, unresolved slots retry certified selection with the wider 30% calorie tolerance. If no eligible fallback exists, pending rows are cancelled, an audit event records the gap, the cycle becomes `INCOMPLETE_AT_DEADLINE`, and no pending content enters groceries.

### Publication gate

`READY_TO_SHOP` now requires all expected distinct slots plus all of the following:

- `APPROVED` and not awaiting safety revalidation;
- persisted base/composed recipe signatures and safety-policy version;
- a current approved/complete library dependency for certified candidates;
- an active, unexpired, signature/revision-bound clearance usage for every current condition on certified candidates;
- the required number of distinct RND approval decisions on non-library candidates; and
- a successfully committed, non-stale grocery projection.

Grocery aggregation and the final lifecycle transition occur in the same transaction. A projection failure leaves the future cycle under review. A suspended, stale, revoked, expired, or signature-mismatched dependency therefore fails closed on the next lifecycle synchronization.

## Schema and migration

Migration `20260922233000_add_upcoming_preparation_metadata` adds:

- version/tier/trigger metadata to `MealPlanCycle`;
- candidate rank, score, reason codes, and fallback availability to `MealPlan`;
- exact coalesced review-work identity; and
- an auditable self-reference from a superseded candidate to its replacement.

The migration was applied to the owner-authorized shared development Neon database. Prisma reports 61 applied migrations and a current schema.

## Verification evidence

- Prisma format, validate, client generation, and migration status: pass.
- Backend production build: pass.
- Backend lint: pass.
- Backend full suite: **471 passed, 0 failed, 1 existing clinical-policy TODO** across 472 tests.
- Batch 4 policy tests: 5 passed for lead times, ranking, work-key stability/scope, rice portioning, and deadline priority.
- Batch 4 development-database acceptance: migration columns present; unresolved deadline slot cancelled; cycle became `INCOMPLETE_AT_DEADLINE`; final grocery publication remained blocked; complete evidence remained `UNDER_REVIEW` until a grocery projection existed; then became `READY_TO_SHOP`; certified fallback produced an approved replacement and persisted candidate supersession.
- Frontend production build: pass, 51 routes.
- Frontend lint: pass.
- Frontend suite: **201 passed** across 53 files.
- Runtime backend health: HTTP 200 from `http://localhost:5000/health` after migration.

## Verification limits and next boundary

The isolated in-app browser rendered the current login shell with no console error, but its React client effects did not settle, so an authenticated RND visual journey was not claimed from that browser session. No new live Gemini request was made for this batch; the source-order and generation integrations retain the prior checkpoint evidence while the new deterministic and database paths were verified without consuming external AI calls.

Batch 5 owns the progressive current/next grocery interface, incomplete-subset presentation/export rules, and user-facing preparation progress. This batch supplies the lifecycle and projection guarantees Batch 5 depends on; it does not add that UI early.
