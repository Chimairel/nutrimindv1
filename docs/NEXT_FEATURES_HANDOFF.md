# NutriMind — Upcoming Features Handoff

**Recorded:** September 3, 2026

**Purpose:** Preserve owner decisions and the next implementation path independently of chat history.

**Status:** Structured safety and the minimum combined-coverage catalogue addition are implemented. Billing Phase 1 and both Phase 2 migration gates are complete. Phase 3A now supplies disabled TEST-only PayMongo checkout and signed-webhook boundaries with deterministic fakes; runtime HTTP/database adapters remain disconnected. All 22 billing tables remain empty. Real sandbox/provider traffic, webhook persistence/processing, reconciliation, entitlement activation, UI, credentials, money movement, and deployment have not started.

## 1. Resume point

- Repository: `Chimairel/nutrimindv1`
- Billing-foundation branch: `feature/billing-foundation`, commit `753be3d`
- Migration-rehearsal branch: `feature/billing-migration-rehearsal`, created from exact billing-foundation commit `753be3d`
- Shared-migration branch: `feature/billing-shared-migration`, created from exact rehearsal commit `7f5eb3d`
- PayMongo-boundary branch: `feature/paymongo-adapter-boundary`, created from exact shared-migration commit `1f31a83`
- `main` baseline at the time of this handoff: `d17b304`
- Latest roadmap commit before this file: `802fa34`
- Implemented feature commits on the branch:
  - `1ccd9b7` — condition-aware meal-library workflows
  - `483047d` — combined restriction coverage matrix
  - `4defe0f` — structured multi-value safety intake source and additive migration
- Phase 2 adds one structured restriction adapter across production consumers, exact combined-profile coverage evidence, operational API/UI evidence, and a guarded incompatible-plan fixture. See engineering-record section 36.
- INT-011 left the configured database with 51 complete current managed catalogue meals and reconciled the existing configured reviewer's `totalVerified` counter to 55. The first apply created/certified exactly two meals and skipped 49; the immediate second run performed no writes and skipped all 51.
- The current branch passed the backend suite (271 registered, 270 passed, 0 failed, 1 intentional clinical-policy TODO), backend production build, frontend lint, frontend production build, the offline FNRI projection, and live production-evaluator measurement. See engineering-record section 37. Earlier configured-database and browser evidence remains in sections 32–36.
- Do not merge into `main`, deploy, introduce live payments, or broaden clinical claims without fresh owner approval.
- Local port ownership: port `3000` is available and reserved for NutriMind; the unrelated Antigravity project uses port `3030`. A database-only migration rehearsal does not require either application server and must not disturb the Antigravity process.

## 2. Product model that must remain intact

- Users receive personalized plans from current verified-library evidence first; Gemini fills only genuine coverage gaps.
- Newly generated meals remain visible but unverified until reviewed. Nutritionists review through a shared prioritized queue with bounded claim locks; approval creates reusable evidence only through the established certification lifecycle.
- Verified meals are reusable by any compatible profile, based on deterministic restrictions rather than exact whole-profile identity.
- Users can browse only meals compatible with their complete health context. Grocery data is derived automatically from the active plan.
- Multiple nutritionists are company/platform participants, not clinicians whom each user individually hires and waits for.
- Admins oversee nutritionist applications/credentials, platform operations, and future financial reconciliation.
- Safety controls and essential restriction information must never become paid-only features.

## 3. Current phase — structured multi-value safety intake

### September 5 acceptance status

- The additive structured-safety migration is applied to the configured shared Neon database. The source, migration, deterministic tests, guarded integration fixture, and authenticated browser flows are present on `feature/structured-safety-intake`.
- INT-009 proves mixed structured persistence/reload, canonical alias resolution, legacy synchronization, one revision per semantic change, report invalidation, idempotent resubmission, exact cleanup, and preservation of a still-compatible certified plan and its derived grocery list.
- E2E-007 proves onboarding and editable Health profile behavior at desktop and 390x844 mobile widths, including separators, multi-word entries, mixed sources, statuses/errors, chip removal, keyboard confirmation, save, and reload with no browser warnings/errors.
- An incompatible structured restriction replacing or blocking an active meal was not repeated because that bounded fixture would mutate shared catalogue usage counters or create temporary certified catalogue rows. Prior INT-005 covers the older enum/allergy replacement path. Treat a structured incompatible-plan fixture as the remaining optional Phase 1 evidence gap, not as proof for arbitrary clinical combinations.
- See engineering-record section 35 for exact migration, runtime, browser, and cleanup evidence.

### Goal

Replace fragile custom condition/allergy strings with a reusable, structured entry experience while continuing to support existing predefined choices.

### Included fields

- Medical conditions
- Food allergies
- Food intolerances
- Foods or ingredients to avoid
- Medication entry is a possible later category only if a separately approved medication–food policy is added; it is not part of the initial scope.

### Required interaction

1. Predefined buttons and custom/autocomplete selections feed one unified chip collection.
2. Users may mix both sources, such as selecting Hypertension and then adding Gout through autocomplete.
3. The input may accept commas, semicolons, slashes, or line breaks as convenience separators. Display a short note explaining this behavior.
4. Never split on ordinary spaces; multi-word entries such as `chronic kidney disease` must remain intact.
5. Parse into a preview and require review/confirmation before saving. Each item becomes a removable chip.
6. Trim whitespace, discard empty segments, match without case sensitivity, normalize approved aliases, and merge duplicates. Example: `high blood pressure` and `Hypertension` become one canonical entry.
7. Keep condition and allergy catalogues separate so a match cannot cross semantic categories.

### Catalogue and persisted representation

- Start with version-controlled backend catalogues; a database-managed catalogue and curation UI may follow later.
- Each catalogue item needs a stable code, display name, approved aliases/search terms, support state, and policy/evidence reference.
- Store the canonical entry and the user's original wording/provenance. Do not preserve only a combined string.
- Suggested states:
  - `SUPPORTED`
  - `RECOGNIZED_UNSUPPORTED`
  - `NEEDS_CLARIFICATION`
  - `PENDING_REVIEW`
  - `INVALID`
- Frontend autocomplete is only assistance. Every saved code and classification must be revalidated by the backend.

### Validation and safety behavior

- Reject whitespace-only, duplicate-only, oversized, or clearly invalid input with accessible inline feedback.
- Do not diagnose symptoms or vague phrases. Ask the user to clarify terms such as “high sugar” or “heart problem.”
- Gemini may suggest possible catalogue matches but cannot be the authority that validates a diagnosis or allergy.
- Apply all recognized restrictions as an intersection. Never relax one restriction merely because coverage is insufficient.
- Any ambiguous, unsupported, custom-unmapped, or evidence-incomplete entry must fail closed: request clarification or route the plan to review; never label it compatible or verified automatically.
- Profile changes must retain revision history, invalidate stale nutrition guidance when appropriate, and run the existing safety recheck idempotently.

### Minimum acceptance evidence

- Unit tests for separators, multi-word terms, aliases, duplicates, mixed predefined/custom entries, invalid values, and `NONE` contradictions.
- API tests proving clients cannot forge supported codes or classifications.
- Policy tests proving every combined condition/allergy/intolerance/exclusion is evaluated conservatively.
- Browser tests for keyboard autocomplete, chip removal, mobile layout, errors, confirmation, save/reload, and profile editing.
- A live database-backed flow showing that an added restriction replaces or blocks incompatible meals and refreshes the derived grocery projection without leaving stale safety claims.

## 4. Coverage work after structured intake

- INT-011 re-measured the exact 51 certified managed meals with the production evaluator and structured profiles: Diabetes + vegetarian + egg allergy is **7/7/7** breakfast/lunch/dinner; Hypertension + pescatarian + dairy allergy is **9/14/14**; Diabetes + Hypertension + gluten allergy is **9/14/11**.
- The shared catalogue now contains the one FNRI-backed vegan lunch (`Tokwa Ampalaya Rice Bowl`) and one FNRI-backed vegan dinner (`Tokwa Sayote and Sitaw Dinner Plate`) added without changing a threshold. A repeat apply performed zero writes and skipped all 51 managed definitions.
- Structured rows are now authoritative for generation/library reuse, swaps, recheck/replacement, outside-meal warnings, nutrition-report context, nutritionist review displays, library browsing, and coverage/admin evidence. Legacy fields remain an explicit fallback for profiles without structured rows.
- Arbitrary multiple allergies, custom conditions, Kidney Disease, Heart Condition, and pregnancy/lactation remain outside proven automatic coverage.
- Add catalogue meals only to close measured gaps. Every addition needs first-class FNRI ingredient linkage, explicit allergen/condition declarations, current certification evidence, deterministic compatibility tests, and idempotent population behavior.
- Do not manufacture “verified” state through raw seed flags or by copying one user's profile declarations into reusable authority.

### Completed Phase 2 runtime gate

- The owner authorized one INT-010 execution on September 5, 2026. Structured `EGGS` incompatibility replaced `Pandesal, Egg and Tomato Breakfast` with certified, egg-reviewed-absent `Tofu Tomato Breakfast Rice Bowl`; the production evaluator allowed the replacement, the grocery ingredient projection refreshed, report invalidation/revision/replacement evidence completed, and identical resubmission was idempotent.
- Cleanup restored only the selected replacement's fixture-owned counter increment through compare-and-set and deleted the exact `e2e.structured-replacement.acceptance@example.invalid` namespace. A read-only post-check proved zero reserved users, structured entries, plans, meal ingredients, grocery lists/items, revisions, notifications, and replacement logs plus both involved meal counters at their baseline of zero. No external service or permanent catalogue write occurred.
- The fixture cleaned itself before a browser could reuse its authenticated actor. Authenticated coverage/review/admin and replacement/grocery UI surfaces therefore remain static/build evidence; the public shell and unauthenticated route guard retain E2E-008 browser evidence.

## 5. Planned payments and subscriptions

### Provider direction

- ADR-017 selects PayMongo as the first **sandbox collection adapter**. Production remains conditional on account verification/capability activation, written approval of NutriMind's exact business model, confirmed commercial terms, tax/refund decisions, and the production gates in [`PAYMENT_SUBSCRIPTION_COMPENSATION_ARCHITECTURE.md`](PAYMENT_SUBSCRIPTION_COMPENSATION_ARCHITECTURE.md).
- The sandbox MVP uses one monthly Premium test price and card/Maya only when the account exposes those test capabilities. PHP 199 may be used only as a demo placeholder; it is not an approved commercial price. GCash is not promised because current official provider material leaves its subscription availability account/support dependent.
- Begin in sandbox/test mode. A live-money demonstration requires an explicit owner decision and approved operational checklist.

### User subscriptions

- Keep collection, user entitlement, and compensation in separate models and ledgers.
- Create provider resources on the backend only; provider secret keys and raw payment credentials must never reach NutriMind browser state, persistence, or logs.
- Mount the future raw-body webhook before the current global JSON middleware, verify the environment-specific signature over the exact body, persist an immutable idempotent inbox/outbox record before 2xx, process asynchronously, and reconcile independently.
- Grant Premium from durable paid-invoice periods established by verified webhooks or server reconciliation. Redirects and client flags never grant access.
- Preserve an already-paid period through cancellation; bound any `past_due` grace to 72 hours; do not create a new grant for incomplete or unpaid periods. Refund-to-entitlement behavior must be explicit and auditable.

### Realistic benefit candidates

- The only Premium MVP behavior is a six-swap weekly cap versus the existing Free cap of three. Both tiers use the same complete-profile compatibility and meal-actionability rules.
- All safety intake, restriction enforcement, warnings, verification labels, weekly safe planning, logging, grocery data/PDF, compatible-library access, and account data export remain available to Free users.
- Longer derived comparisons, richer convenience exports, and favorites are candidates after the MVP. Existing raw history cannot be removed from Free.
- Household/multi-person planning, price-aware budgets, unlimited AI, priority licensed review/SLA, and promised medical outcomes are deferred.

## 6. Nutritionist compensation

- User billing and nutritionist compensation are separate accounting domains. A subscription payment must never directly and automatically pay a reviewer.
- Do not use a raw per-approved-meal salary formula; it incentivizes approval volume and weakens review quality.
- Use first-class immutable work credits written with valid completed review actions. Do not infer compensation from `NutritionistProfile.totalVerified`, mutable plan state, claims, or approval counts.
- Preferred initial formula: contracted base retainer plus a capped workload-band allowance plus independently approved adjustments. Approve/reject/escalate outcomes receive equal ordinary-review credit; quality metrics trigger review rather than automatic bonus multipliers.
- Capstone scope records approved periods, statements, adjustments, and manual/off-platform payouts without storing bank details or moving money.
- PayMongo **Disbursements**, rather than merchant **Payouts**, is the potentially relevant later provider function. It remains deferred behind a separate ADR covering employment/tax status, provider approval, wallet funding, recipient data, maker-checker controls, retries/reversals, and reconciliation.

## 7. Budget and ingredient-price roadmap

- FNRI supplies nutrition composition, not dependable retail pricing.
- Price functionality needs a dated, location-aware catalogue with source/provenance, unit normalization, and freshness metadata. PSA/OpenSTAT or another authoritative source may seed only the data it actually publishes.
- Never require the owner to manually import every published record before prototyping; start with a bounded high-coverage basket and measurable coverage reporting.
- When a meal includes an ingredient without current price data, show `price unavailable` or a clearly labeled estimate/range and reduce the plan's coverage/confidence. Do not let Gemini invent an authoritative price.
- Budget filtering must not override clinical compatibility or silently substitute unsafe ingredients.
- ADR-018 and the full September 6 source review are recorded in [`BUDGET_PRICE_FOUNDATION.md`](BUDGET_PRICE_FOUNDATION.md). The additive schema/migration and pure estimation policies exist on `feature/budget-price-foundation`; the migration is unapplied and the catalogue is empty.
- PSA/OpenSTAT is the only reviewed source with a documented structured API and explicit general CC BY 4.0 terms. DA weekly NCR bulletins and DTI package-specific SRPs remain manual/unverified ingestion candidates with distinct semantics and unresolved or publication-specific reuse checks.

## 8. Accepted architecture and remaining production decisions

ADR-017 is recorded in the engineering record and fully specified in [`PAYMENT_SUBSCRIPTION_COMPENSATION_ARCHITECTURE.md`](PAYMENT_SUBSCRIPTION_COMPENSATION_ARCHITECTURE.md). It fixes the sandbox provider direction, domain boundaries, MVP entitlement, webhook/idempotency design, financial and compensation records, failure/reconciliation behavior, phased tests, rollback boundaries, and capstone scope.

Payment Phase 1 supplies additive persistence definitions, deterministic SQL, and pure policies for state, paid-period entitlement, 3-versus-6 swap caps, money/refund invariants, provider-event idempotency, append-only work-credit reversal, capped workload-band compensation, payout bounds, and maker-checker separation. Its shared-development migration is applied, while the adapter remains disabled and no provider call has occurred.

Budget-price Phase 1 supplies six append-only evidence models, deterministic unapplied SQL, and DB-independent policies for units, PHP ranges, exact mapping, freshness/locality, supersession, partial coverage, and clinical-first ranking. It adds no data, caller, endpoint, UI, or Premium behavior.

Production remains blocked on PayMongo's written business approval and actual account capabilities, final commercial terms and PHP price, Philippine tax invoice/official-receipt and refund policy, financial retention/pseudonymization, nutritionist contracts and compensation amounts, external security review, and the recorded go-live checklist. These open decisions do not authorize provider calls, accounts, credentials, or live money.

## 9. Recommended execution order

1. Rehearse `20260906120000_ingredient_price_foundation` only in a task-owned disposable PostgreSQL target; verify checks, append-only triggers, supersession, schema parity, rollback, and complete resource cleanup.
2. After migration/reuse acceptance, build one small PSA/OpenSTAT basket from exact frequently used managed-meal ingredients, one explicit geography, and current monthly observations. Measure meal-slot and grocery item-count coverage before expanding.
3. Add price repositories and internal query adapters only after the basket is accepted. Public endpoints, frontend estimates, scheduled ingestion, and Premium claims remain later gates.
4. PayMongo Phase 3B is paused indefinitely at the existing manual provider gate. Resume only on a new owner instruction after account/business acceptance and sandbox capability are available.

## 10. Instructions for the next agent or conversation

1. Read `AGENTS.md` completely.
2. Treat `docs/NUTRIMIND_ENGINEERING_RECORD.md` as the canonical evidence source and this file as planned-work context.
3. Inspect Git status and preserve unrelated/user changes.
4. Continue price work from the clean pushed `feature/budget-price-foundation` commit reported at handoff. Do not merge or touch `main` without a separate instruction.
5. Re-inspect current code and tests instead of trusting old completion claims.
6. Never expose `.env` values, mutate production/shared data without bounded authorization, or claim clinical/payment production readiness from static tests alone.
7. After each implemented phase, add dated requirement/change/verification evidence to the engineering record and update this handoff so completed items move out of the planned list.
