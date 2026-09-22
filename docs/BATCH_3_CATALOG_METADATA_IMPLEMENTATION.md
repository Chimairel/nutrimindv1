# Batch 3 — Catalog metadata, favorites, and source-neutral candidates

**Change ID:** CHG-20260922-03  
**Implemented:** September 22, 2026  
**Target database:** owner-authorized shared development Neon database

## Scope completed

Batch 3 turns recipe slot suitability, rice composition, favorites, and non-certified candidate sourcing into structured data. It preserves the existing safety boundary: a real recipe source can make a candidate more practical, but it supplies no clinical authority.

## Meal-type applicability

- `MealLibraryApplicableType` and `RawRecipeApplicableType` store one or more applicable `MealType` facts per recipe.
- The legacy singular `mealType` remains the primary display/default slot for compatibility with historical plans and signatures. Runtime lookup and swap matching use normalized applicability rows.
- Every legacy certified and raw recipe received an explicit backfilled primary applicability row.
- Import/classification can propose additional types. A nutritionist can replace those proposals in the existing library edit modal; saved RND selections are marked `NUTRITIONIST_REVIEW` / `REVIEWED`.
- Runtime requests never infer applicability from titles.

## Rice roles and composed servings

- Recipes now carry nullable `riceRole`, separate `riceRoleReviewStatus`, and optional `includedRiceG`:
  - `PAIR_WITH_RICE`
  - `STANDALONE`
  - `INCLUDES_RICE`
- Null remains unknown. Deterministic classification writes `PROPOSED`; only the nutritionist edit flow writes `REVIEWED`.
- `INCLUDES_RICE` with no evidenced gram amount remains unevaluable for serving composition. No portion is guessed.
- Every historical plan was backfilled with an immutable `BASE_RECIPE` `MealPlanServingComponent`. New library, raw-corpus, generated, replacement, and edited plan rows record a base recipe signature and base component.
- `composePlanWithPairedRice` accepts only a reviewed `PAIR_WITH_RICE` recipe and a governed FNRI food record, scales its per-100-g values to explicit cooked grams, writes a `COOKED_RICE` component, updates plan nutrition, and creates a distinct composed-serving signature.
- Grocery projection includes explicit cooked-rice components. Condition-clearance identity and exact plan usage also carry the composed-serving signature. A base-recipe clearance cannot authorize a changed rice composition.
- Batch 4 decides when and how much rice to add using the cycle snapshot and user rice preference. Batch 3 does not silently alter current plans.

## Favorites

- `MealFavorite` has unique `(userId, mealLibraryId)` identity, creation time, and cascade deletion with either account or recipe deletion.
- Add/remove endpoints are authenticated and user scoped. Repeated favorite creation is idempotent; another user cannot remove the owner’s favorite.
- Favorite state carries no safety meaning. A flagged, suspended, stale, or otherwise ineligible meal remains favorited but is excluded from eligible results.
- The user library now provides a favorite toggle and a favorites-only filter.

## Source-neutral candidate provider

- `RecipeCandidateProvider` defines a bounded projection containing provider record identity, provenance, normalized name, exact content signature, source URL, applicability, dietary tags, structured ingredient completeness, nutrition/serving evidence, rice proposal, media references, and active/retired state.
- `PanlasangRecipeCandidateProvider` is the first implementation. The meal generator now consumes it instead of querying the provider-specific Prisma table directly.
- Candidate results are deterministically ordered and cursor paginated. Corpus provenance contains no safety status, allergen clearance, condition clearance, or review shortcut.
- Gemini remains a generator, not a stored-corpus provider.

## Deduplication and corpus result

The raw corpus index ran first as a dry run and then as an idempotent apply:

- source records: **1,994**
- exact normalized-content duplicates collapsed: **34**
- available content-distinct recipes: **1,960**
- raw applicability facts: **3,073**

Title equality alone is not part of the signature. Genuine variants remain separate when their normalized name, ingredients, category, or nutrition differs. Library edits recompute the recipe signature, increment the evidence revision, invalidate current certification, and suspend incompatible clearances.

The deterministic Panlasang library classification was rerun across **1,949** imported records. It created applicability and rice-role proposals while preserving **zero automatic condition clearances**.

## Eligible-library contract

`GET /api/user/meals/compatible-library` now returns:

- a bounded page of eligible meals;
- authoritative `meta.total` after the final fail-closed compatibility policy;
- opaque `meta.nextCursor`;
- stable name-and-ID ordering at the query layer;
- server-side meal-type, search, favorites, and reviewed rice-role filters.

The server evaluates candidate rows in bounded database chunks rather than materializing the entire library. The user interface displays the server total and exposes an explicit **Load more recipes** action, so the first page is never presented as the whole library.

## Database migrations

- `20260922223000_add_catalog_metadata_and_favorites`
  - applicability, rice roles, favorites, serving components, and signature scope;
  - legacy applicability and base-serving backfill;
  - positive-quantity constraints.
- `20260922224000_scope_composed_clearances`
  - adds composed-serving signature to live clearance identity.

The authorized development database reports **60 migrations** and a current schema.

## Acceptance evidence

Database acceptance `test:acceptance:batch3-catalog` established:

- 1,960 available raw recipes and 1,960 unique content signatures;
- deterministic provider pagination with no cross-page duplicates;
- 2,014 library rows and 2,769 structured applicability facts;
- an authoritative eligible-library total of 50 for the unrestricted omnivore fixture query, with non-overlapping cursor pages;
- favorite idempotency and owner scoping;
- account-deletion cascade;
- favorite retention while a flagged meal is excluded from eligible results.

Focused policy tests cover multi-label applicability, rice-role uncertainty, FNRI scaling, composed-signature changes by gram amount, exact duplicate collapse, variant preservation, and the absence of safety authority from the provider contract.

Final verification passed:

- backend build, lint, and script typechecking;
- Prisma validation with all 60 development migrations applied;
- **466 passing backend tests**, zero failures, and one existing clinical-policy TODO across 467 tests;
- **201/201 passing frontend tests** across 53 files;
- frontend typecheck, lint, and the full 51-route production build;
- the live database acceptance listed above after the final service integrations.

## Boundary for Batch 4

Batch 3 provides facts and bounded retrieval. Batch 4 will consume the cycle snapshot, rice preference, reviewed rice role, candidate completeness, and certified clearance coverage to rank and place current/upcoming candidates. It must continue the retrieval order:

1. eligible certified library;
2. bounded real-recipe providers;
3. bounded Gemini generation.
