# Batch 8 — Outside-meal estimate review and clarification

**Change ID:** CHG-20260923-05

**Implemented:** September 23, 2026

**Schema migration:** `20260923190000_outside_meal_review_thread`, applied to the authorized development database.

## Review boundary

An outside log is committed and counted before any RND decision. The review concerns the nutrient **estimate for that consumption**, not the safety or reusable certification of a recipe. Confirmation never inserts a `MealLibrary` row or condition clearance. User-facing copy uses “confirmed,” “corrected and confirmed,” “needs more information,” and “could not be confirmed.” `UNVERIFIABLE` retains the logged amount in the estimated tracker segment.

The queue accepts an explicit user request, detected safety conflict, large macro-energy inconsistency, or a wide calorie uncertainty interval. For the capstone demonstration, non-production environments also queue Gemini estimates under the explicit `DEMO_AI_ESTIMATE` reason. An ordinary manual entry does not automatically join the queue. Candidate nomination and separately governed clinical monitoring are Batch 9/later work. The queue returns at most 100 active records ordered by priority and age, below plan-blocking clinical work in the product workflow.

## Decision and clarification workflow

An eligible RND claims an item exclusively for 30 minutes. The claim captures its exact `OutsideMealLogItem.currentRevision`. A changed item releases the claim and cannot be decided using the old revision. RND actions are confirm, correct all displayed macros, ask for more information, or mark unverifiable; every action requires a reason. Corrections retain before/after values, reviewer identity, and a new immutable item revision. The parent meal and daily nutrition totals recompute atomically.

An information request creates a bounded review message and notification. The owner may reply once to the open question; the reply appends a new item revision and returns the review to the queue. Subsequent rounds are possible up to 12 messages total. The user can also edit the consumed item, which appends a revision and returns a previously decided or claimed review to pending. The RND screen shows the question/reply history and source context. Private images are fetched separately and only for the active claimant; list and claim JSON omit image bytes.

The user history shows queue state, messages, and the rationale of the current RND decision. Request/reply routes enforce item ownership; RND routes require the existing verified-nutritionist middleware. Account deletion cascades from the user-owned log through reviews, messages, revisions, and private image bytes. No generic messaging channel or admin health-content feed was added.

## Verification and limits

- Migration deployed to the authorized development database and Prisma client regenerated.
- Backend build, lint, script typecheck, and unit tests pass: **480 passed, 0 failed, 1 existing TODO** across 481 tests.
- Frontend typecheck, lint, production build, and unit tests pass: **201/201** across 53 files.
- `npm run test:acceptance:batch8-outside-review` uses disposable users and RNDs in the development database. It covers manual-entry queue selection, owner request, exclusive claim, claimed-photo authorization, clarification and reply revisions, stale decision rejection, correction and daily-total recalculation, re-pending after user edit, unverifiable estimated totals, and account-deletion cascade.
- The acceptance is service/database integration; it does not claim a full browser journey or production clinical validation. The current bounded RND list has no server cursor beyond its first 100 rows; pagination can be added when queue volume warrants it.
