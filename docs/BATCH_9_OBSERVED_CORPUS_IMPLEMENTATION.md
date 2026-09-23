# Batch 9 — Consented observed foods and recipe candidates

**Change ID:** CHG-20260923-06

**Implemented:** September 23, 2026

**Schema migration:** `20260923230000_observed_meal_candidates`, dry-run under rollback and then applied to the authorized development database.

## Admission and consent

Outside-meal confirmation remains a private nutrition-estimate decision. It creates no shared record. The user may separately opt in to deidentified food-detail reuse for the exact currently confirmed item revision. Image reuse requires its own checkbox and rights confirmation; the system records that decision but does **not** copy or publish user photos. Private notes, user identity, and image bytes never enter the shared reference or raw-recipe tables. The user can withdraw future reuse without losing their log or nutritionist review.

An eligible RND sees only current consented submissions and classifies each one as a food reference or a reproducible recipe candidate. Food references require a defined serving and confirmed macros; they appear in outside-meal autocomplete as uncertain estimates, never as eligible certified meals. Recipe candidates additionally require a curated canonical name, measured ingredient quantities and units, a preparation method, supported meal types, and recognized ingredients. The RND admission action creates a `RawRecipeCandidate` with `sourceName = USER_OBSERVED`, an internal source URI, no shared image, and no safety clearance. It does not create a `MealLibrary` row. A selected candidate follows the existing raw-corpus FNRI reconciliation, deterministic validation, pending-review, and RND certification path.

Content signatures include normalized name, serving, macros, ingredient names/quantities/units, and preparation. Exact repeats link to one shared record and contribute distinct observations; serving or preparation variants remain separate. Counts never grant safety authority or ranking priority. The candidate provider now returns source-specific provenance and reserves a bounded recent-observation window alongside Panlasang rows. Panlasang reindexing only updates Panlasang rows, so it cannot retire admitted observations.

An edit, void, new RND decision, or reopened review invalidates the consented revision and withdraws its submission. An observed recipe is retired from future retrieval when no active admitted submissions remain; a pending plan sourced from a retired observed recipe is also blocked at RND approval. Account deletion removes the private log, notes, photo, and owner links; an already admitted record remains deidentified and its source pointers become null. No user's name, email, or private notes are copied into shared tables.

## Verification and limits

- The additive migration was executed inside a rollback transaction before deployment. Prisma reports 65 applied migrations. A direct database-to-schema diff shows no Batch 9 object drift, but still reports older `ClinicalProfileReview` objects, historical index names, and defaults outside this batch; those require a separate migration-history reconciliation before the full Batch 10 drift gate can pass.
- Backend build, lint, script typecheck, and unit suite pass: **483 passed, 0 failed, 1 existing TODO** across 484 tests. Frontend typecheck, lint, production build, and **201/201** unit tests pass.
- `npm run test:acceptance:batch9-observed-corpus` passed against disposable development-database fixtures. It covers no automatic sharing, owner-only consent, independent image choice, reference and recipe admission, exact deduplication, a real preparation variant, shared-record privacy, provider provenance/retrieval, withdrawal, void-triggered retirement, and account-deletion deidentification.
- The acceptance proves the observed candidate reaches the existing raw provider with no library certification or condition clearance. The existing raw candidate path supplies the downstream FNRI, deterministic, and RND gates; an observed candidate's full browser and plan-to-library journey remains part of Batch 10 integrated testing.
- RNDs curate shareable text. The API rejects obvious contact details, but deidentification of free-form recipe prose still requires reviewer care. The recent-observation retrieval window is bounded to 30 per meal type; broader sampling or pagination will be needed if the corpus grows substantially.
