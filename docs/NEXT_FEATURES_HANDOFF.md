# NutriMind — Upcoming Features Handoff

**Recorded:** September 3, 2026

**Purpose:** Preserve owner decisions and the next implementation path independently of chat history.

**Status:** Phase 1, the structured-safety Phase 2, and the minimum combined-coverage catalogue addition are implemented. INT-011 populated and certified the two authorized meals, proved a zero-write repeat run, and measured live 7/7/7 Diabetes + vegetarian + egg-allergy coverage on `feature/combined-coverage-gap`.

## 1. Resume point

- Repository: `Chimairel/nutrimindv1`
- Working branch: `feature/combined-coverage-gap`
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

- PayMongo is the leading candidate for Philippine payment collection, not a final integration decision.
- Re-check current APIs, supported payment methods, sandbox behavior, fees, business/KYC requirements, webhook signing, payout capabilities, and terms immediately before implementation.
- Begin in sandbox/test mode. A live-money demonstration requires an explicit owner decision and approved operational checklist.

### User subscriptions

- Create checkout/payment intents on the backend only; provider secret keys must never reach the browser.
- Verify webhook signatures and process provider events idempotently.
- Model subscription state transitions, failed/late payments, cancellation, refunds, receipts, and reconciliation.
- Store an append-only sanitized payment-event audit trail; never log card/payment credentials or unnecessary personal data.
- Entitlements must derive from authoritative subscription state, not a client-controlled flag.

### Realistic benefit candidates

- Higher but still safety-bounded meal swap/library-choice allowance
- Longer progress/history analysis and richer exports
- Advanced planning or household-oriented convenience features
- Budget-oriented planning only where price coverage and freshness are disclosed
- Final pricing, tier names, quotas, and benefit selection remain owner decisions. Core safety, restrictions, verification status, and essential nutrition information stay available to free users.

## 6. Nutritionist compensation

- User billing and nutritionist compensation are separate accounting domains. A subscription payment must never directly and automatically pay a reviewer.
- Do not use a raw per-approved-meal salary formula; it incentivizes approval volume and weakens review quality.
- Preferred initial model: an admin-approved compensation ledger based on an agreed employment/contract period. Review workload, turnaround, disagreement, and quality metrics may inform administration but must not autonomously determine salary.
- Capstone-first option: record approved pay periods and manual/off-platform payouts without moving real money.
- If automated payouts are later adopted, independently model recipient verification, payout account data, approval separation, payout batches, idempotency, failures/retries, reversals, receipts, and reconciliation.

## 7. Budget and ingredient-price roadmap

- FNRI supplies nutrition composition, not dependable retail pricing.
- Price functionality needs a dated, location-aware catalogue with source/provenance, unit normalization, and freshness metadata. PSA/OpenSTAT or another authoritative source may seed only the data it actually publishes.
- Never require the owner to manually import every published record before prototyping; start with a bounded high-coverage basket and measurable coverage reporting.
- When a meal includes an ingredient without current price data, show `price unavailable` or a clearly labeled estimate/range and reduce the plan's coverage/confidence. Do not let Gemini invent an authoritative price.
- Budget filtering must not override clinical compatibility or silently substitute unsafe ingredients.

## 8. Required architecture decision before payment coding

Create and approve an ADR that fixes:

- Provider and exact APIs
- Sandbox versus live-demo boundary
- Fees and who bears them
- Subscription tiers and authoritative entitlements
- Refund/cancellation policy
- Nutritionist compensation and payout policy
- Webhook threat model and idempotency design
- Financial audit, reconciliation, data retention, and privacy controls
- Failure/recovery procedures and capstone scope

Only after this ADR should schema design and implementation begin.

## 9. Recommended execution order

1. Write the payment/subscription/compensation ADR using freshly verified provider information.
2. Implement subscription sandbox billing and admin reconciliation.
3. Add a manual compensation ledger; automate payouts only if still necessary and provider-supported.
4. Prototype price coverage separately, after core safety and payment flows remain stable.

## 10. Instructions for the next agent or conversation

1. Read `AGENTS.md` completely.
2. Treat `docs/NUTRIMIND_ENGINEERING_RECORD.md` as the canonical evidence source and this file as planned-work context.
3. Inspect Git status and preserve unrelated/user changes.
4. Confirm the intended starting branch with the owner before implementation; do not assume this feature branch should be merged.
5. Re-inspect current code and tests instead of trusting old completion claims.
6. Never expose `.env` values, mutate production/shared data without bounded authorization, or claim clinical/payment production readiness from static tests alone.
7. After each implemented phase, add dated requirement/change/verification evidence to the engineering record and update this handoff so completed items move out of the planned list.
