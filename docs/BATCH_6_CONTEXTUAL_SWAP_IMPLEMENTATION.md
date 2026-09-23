# Batch 6 — Eligible Library and Contextual Swap Implementation Evidence

**Change ID:** CHG-20260923-03  
**Implemented:** September 23, 2026  
**Schema migration:** `20260923120000_harden_contextual_swaps`, applied to the authorized development database.

## Delivered contract

- The library remains a server-searched, paginated view of meals that pass the user's current diet, allergen, condition-clearance, evidence-revision, and reviewer-eligibility checks. Cards show all reviewed meal-type labels and allow viewing or favoriting; they no longer offer a context-free swap.
- The meals workspace projects the current and upcoming cycles and exposes only evidence-cleared slots as actionable. Pending slots remain previews. Eating and skipping are restricted to today or the historical seven-day grace period; future slots cannot be consumed early.
- A swap starts from a specific uneaten, cleared plan slot. The replacement query applies safety, meal type, serving, rice, and calorie boundaries before ranking favorites, macro fit, variety, locality, and rice preference. Already-planned recipes remain visible with a label rather than silently disappearing.
- The preview shows the replacement serving and macros, calorie difference, projected daily total, grocery additions and removals, shopping state, and a ten-minute signed request key. Confirmation recomputes the entire safety/nutrition/shopping snapshot. Changed evidence or profile state requires a fresh preview.
- After shopping starts, confirmation requires explicit acknowledgment of the grocery changes. Within one transaction, the service replaces serving/ingredients, persists exact condition-clearance usage, updates the correct cycle's grocery projection, recalculates any daily nutrition log, records an idempotent swap audit row, and pins the user-selected slot. Competing pending or approved candidates for that slot are cancelled, so later routine review and deadline fallback cannot displace it. Safety invalidation and acknowledged profile rebuilds remain able to supersede it.
- No subscription entitlement or three-swap cap is used.

## Certified signature repair

Fifty existing development-library fixtures had `safetyEvidenceStatus = COMPLETE` and approval, but no `recipeSignature`. The cycle clearance check correctly refused to publish plans from them. The backfill script first re-evaluated base evidence and reviewer eligibility, checked for pending flags and signature collisions, then recorded one audit event per signed fixture. Dry run: **50 eligible, 0 collisions**. Applied: **50 signed**. The normal nutritionist certification path and future common-library seed now persist the same signature on approval, so new entries do not recreate the gap. A signature is evidence identity, not a new clinical approval.

## Verification

- Development migration deployed; Prisma client regenerated. The 50-signature backfill ran after its dry run.
- Backend build, script typecheck, lint, and unit suite passed: **475 passed, 0 failed, 1 existing TODO** across 476 tests.
- Frontend production build, lint, and unit suite passed: **201/201** tests across 53 files.
- Disposable development-database acceptance covers favorite ordering, exclusion of incomplete and flagged library evidence, current and upcoming swaps, grocery acknowledgment, idempotent replay, user pin and competing pending cancellation, evidence suspension between preview and confirmation, forced grocery failure rollback, and daily-total recalculation. It cleans up its user and meal fixtures.

## Operational limit

The contextual swap selector currently considers a bounded first 120 eligible library rows plus up to 120 eligible favorites. This covers the current certified development catalog; a larger future certified catalog needs cursor paging or a search control in the swap selector to expose every eligible alternative. The general library itself is paginated.
