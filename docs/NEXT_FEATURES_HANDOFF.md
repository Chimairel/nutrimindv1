# NutriMind — Upcoming Features Handoff

**Recorded:** September 3, 2026

**Purpose:** Preserve owner decisions and the next implementation path independently of chat history.

**Status:** Structured safety and the minimum combined-coverage catalogue addition are implemented. The owner removed the subscription product on September 22, 2026. Premium tiers, payment adapters, entitlements, advance future-cycle plans, paid swap caps, admin access grants, and billing UI are no longer part of the active application. Historical branch and ADR references below are retained only as provenance for the abandoned experiment.

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

## 5. Subscription removal decision

- KAINARA has one user access level. Meal planning, compatible swaps, recipe browsing, grocery tools, outside-meal intelligence within fair-use compute quotas, reports, and the Salakot avatar accent are available to every user.
- The application does not pre-generate or expose a paid next-cycle plan. It generates the active cycle on demand or through the idempotent current-cycle rollover path.
- The forward cleanup migration removes the abandoned billing, payment, entitlement, and provider projection tables while retaining historical migrations so already-migrated databases remain reproducible.
- Reintroducing monetization requires a new product decision and a new forward implementation. Historical payment code is available from Git history and is not maintained in the active branch.

## 6. Nutritionist compensation

- Nutritionist compensation is an internal work-record domain and is independent of user access.
- Do not use a raw per-approved-meal salary formula; it incentivizes approval volume and weakens review quality.
- `feature/nutritionist-compensation-admin` now writes first-class immutable work credits with valid completed review actions. It does not infer compensation from `NutritionistProfile.totalVerified`, mutable plan state, claims, timeouts, or approval counts.
- The implemented engine uses a versioned base retainer plus capped workload-band allowance plus independently approved signed adjustments. Approve/reject/escalate outcomes receive equal ordinary-review credit; independent high-risk second review has its declared fixed weight.
- ADMIN policy, period, deterministic statement, adjustment, reconciliation, and manual payout-evidence workflows enforce maker-checker separation. The NUTRITIONIST view is profile-derived and own-only. Payout amount is server-derived; no bank/e-wallet detail or provider movement exists.
- Source tests, all-migration disposable PostgreSQL lifecycle acceptance, and authenticated desktop/mobile browser checks pass. The new additive migration remains unapplied to shared development. Commercial amounts/contracts, tax/legal treatment, dispute operations, retention, deployment, and any automated disbursement remain separate gates.
- Automated disbursement remains deferred behind a separate decision covering employment/tax status, provider approval, wallet funding, recipient data, maker-checker controls, retries/reversals, and reconciliation.

## 7. Budget and ingredient-price roadmap

- FNRI supplies nutrition composition, not dependable retail pricing.
- Price functionality needs a dated, location-aware catalogue with source/provenance, unit normalization, and freshness metadata. PSA/OpenSTAT or another authoritative source may seed only the data it actually publishes.
- Never require the owner to manually import every published record before prototyping; start with a bounded high-coverage basket and measurable coverage reporting.
- When a meal includes an ingredient without current price data, show `price unavailable` or a clearly labeled estimate/range and reduce the plan's coverage/confidence. Do not let Gemini invent an authoritative price.
- Budget filtering must not override clinical compatibility or silently substitute unsafe ingredients.
- ADR-018 and the full September 6 source review are recorded in [`BUDGET_PRICE_FOUNDATION.md`](BUDGET_PRICE_FOUNDATION.md). The additive schema, two migrations, pure estimation policies, disposable rehearsal, and shared-development acceptance exist on `feature/budget-price-shared-migration`; both migrations are applied to shared development and the catalogue is empty.
- PSA/OpenSTAT is the only reviewed source with a documented structured API and explicit general CC BY 4.0 terms. DA weekly NCR bulletins and DTI package-specific SRPs remain manual/unverified ingestion candidates with distinct semantics and unresolved or publication-specific reuse checks.
- A later bounded branch commits an unchanged, attributed PSA/OpenSTAT snapshot for the exact City of Cebu geography, eight reviewed commodities, January-August 2026, deterministic parsing/import, and coverage evidence. Shared development remains empty and the importer is loopback-only pending a separate data-import gate.

## 8. Accepted architecture and remaining production decisions

The historical ADR-017 payment experiment is superseded by the September 22 subscription-removal decision. Its commits remain in Git history but no active route, UI, environment variable, service, schema model, or product claim depends on it.

Budget-price Phase 1 supplies six append-only evidence models, deterministic additive SQL, and DB-independent policies for units, PHP ranges, exact mapping, freshness/locality, supersession, partial coverage, and clinical-first ranking. Disposable rehearsal and guarded shared-development acceptance both passed for the foundation (`54ee88a…feab210ff7d`) and normalization hardening (`f3b92e5c…d5aefd4f11`) migrations. Shared development now has 19 accepted migrations and six empty price tables; all 56 old-domain hashes were preserved.

The bounded PSA ingestion foundation uses City of Cebu code `072217000` directly. Its eight-commodity selection represents 47.69% of catalogue ingredient rows across 86.27% of meals. Seven source-to-raw-FNRI mappings are exact and green munggo is ambiguous. Current cells produce only 22.05% exact same-identity row coverage across 68.63% of meals because cooked identities remain separate and munggo, chicken breast, and tilapia are unavailable. The snapshot and importer remain internal, with no endpoint, UI, scheduler, or runtime estimate.

DEF-031 is resolved in source: Prisma now declares the exact mapped names and column order of both `MealPlan` indexes already created by `20260831090000_production_workflow_hardening`. No migration or shared-database write was required. The revalidation index directly supports the approved legacy-plan revalidation query; the high-risk index remains faithful physical-schema metadata while the current queue prioritizes those fields in memory.

Production remains blocked on clinical evidence, nutritionist contracts and compensation amounts, external security review, and the recorded go-live checklist.

## 9. Recommended execution order

1. Review the committed bounded PSA/OpenSTAT snapshot, mapping decisions, and coverage report. If accepted, authorize a separate guarded shared-development import; the current CLI rejects non-loopback databases.
2. Define reviewed purchased-weight-to-edible-weight and raw-to-cooked conversion evidence before connecting a price repository or estimator to meal quantities.
3. Add internal query adapters only after those gates. Public endpoints, frontend estimates, scheduled retrieval, and basket expansion remain later phases.
4. Treat subscriptions and payment collection as removed scope. Any future return starts as a new owner-approved architecture rather than reviving stale runtime code.

## 10. Instructions for the next agent or conversation

1. Read `AGENTS.md` completely.
2. Treat `docs/NUTRIMIND_ENGINEERING_RECORD.md` as the canonical evidence source and this file as planned-work context.
3. Inspect Git status and preserve unrelated/user changes.
4. Continue price work from the clean pushed `feature/psa-price-ingestion-foundation` commit reported at handoff. Do not merge or touch `main` without a separate instruction.
5. Re-inspect current code and tests instead of trusting old completion claims.
6. Never expose `.env` values, mutate production/shared data without bounded authorization, or claim clinical/payment production readiness from static tests alone.
7. After each implemented phase, add dated requirement/change/verification evidence to the engineering record and update this handoff so completed items move out of the planned list.
