# NutriMind Meal-Library Safety Evidence and Provenance Design

Status: First-class source implementation and owner-command migration deployment completed on August 30, 2026; runtime integration and clinical acceptance remain pending

Date: August 20, 2026

Risk classification: Critical; `CLINICAL-SAFETY-IMPACTING`

Related evidence: `docs/NUTRIMIND_RESTRICTION_POLICY_DESIGN.md`, ADR-008/009, REQ-010/011, DEF-027, RISK-019, TEST-029/030, UNC-015

## 1. Purpose and hard boundary

This document defines the minimum authoritative evidence contract a nutritionist-approved `MealLibrary` record needs before the generation adapter may consider it automatically eligible. It is a technical provenance and workflow design, not a medical rule set, clinical validation, or certification of any existing meal.

Batch 4B3 made documentation changes only. It did not modify production or test source, Prisma schema, migrations, database records, frontend, APIs, dependencies, configuration, credentials, generated output, tracked inventory, historical guidance, branches, or Git history. The Batch 4B2 behavior remains intact: legacy rows lack explicit complete evidence, evaluate to review, and continue through the existing unmatched-slot fallback.

## 2. Verified current-state findings

### 2.1 Schema and relationship findings

- `MealLibrary` stores nutrition values, nullable JSON `suitableConditions`, nullable JSON `allergenFree`, nullable JSON `dietaryTags`, a nullable verifier relation, `APPROVED | FLAGGED`, usage count, and creation time.
- `MealLibrary` has no ingredient rows, safety-completeness state, direct-allergen declarations, cross-contact assessment, evidence version, revision, current safety reviewer, invalidation timestamp, or review-history model.
- Ingredients belong to `MealPlan`, not `MealLibrary`. Each `MealIngredient` can identify `FNRI` or `GEMINI_ESTIMATED` provenance and can optionally link to `FoodItem`.
- `FoodItem.source` and an FNRI-linked ingredient establish nutrition-data provenance only. Neither `FoodItem` nor `FoodAlias` contains allergen or cross-contact evidence.
- The initial migration made `MealPlan.libraryMealId` unique. The meal-swap migration removed that uniqueness, so zero, one, or many historical plans may now refer to one library row.
- Batch 4B2 compatibility evaluation flattens ingredients from every linked historical plan. Later generation persistence separately fetches linked plans and uses an unordered in-memory `find()` to choose one source plan. With multiple plans, evaluation and copied ingredients can therefore use different evidence sets.
- Deleting a library row sets source plans' `libraryMealId` to null and cascades deletion of its flags. Deleting a source plan cascades deletion of its ingredients. Consequently, historical plan ingredients are not a durable library evidence authority.
- Editing approved-plan ingredients deletes and recreates plan ingredients. The recreation path does not retain `foodItemId`, so a review edit can remove existing FNRI linkage.
- Swap/replacement code mutates plan content and ingredients in place. If that plan remains linked to a library row, the only historical ingredient evidence can change after library creation. The existing library row has no revision/invalidation hook for this event.
- Library edit and flag-resolution edit paths change metadata/tags but do not update ingredient evidence because no library ingredient model exists.

### 2.2 Approval, edit, flag, delete, and authorization findings

- Approval currently copies the reviewed user's condition enum values into `suitableConditions` and allergy enum values into `allergenFree`. This records the user's restrictions, not an explicit declaration of what the nutritionist inspected or found.
- Library creation occurs before the transaction that updates the plan and optional ingredients. A later failure can leave partial workflow state; this is a pre-existing transaction risk and is not fixed here.
- Library mutation authority is normally the original verifier and does not re-check that verifier's current verification/license state. The service contains an admin override for an absent, wrong-role, or expired verifier, but the inspected nutritionist router admits only `NUTRITIONIST`, so no route to that admin branch was observed. This is ownership logic, not a reusable safety-review authority rule.
- Any user with the `NUTRITIONIST` role can reach nutritionist routes. The backend route group does not globally require `NutritionistProfile.isVerified` or a current PRC license.
- Another nutritionist may flag a meal but cannot edit or resolve it under the current ownership rule. Flagging sets `MealLibrary.status = FLAGGED`; dismissing a flag restores `APPROVED` without a new safety review.
- The current API accepts largely unvalidated request bodies for review and library mutations. The library UI converts missing/null tag arrays to empty arrays and offers no way to distinguish "not reviewed" from "reviewed and none declared."

### 2.3 Privacy-safe aggregate profile

On August 20, 2026, one aggregate-only Prisma query ran against the owner-confirmed shared development/demo target inside an explicit `READ ONLY`, repeatable-read transaction. It selected only the fields needed to compute counts. It output no identities, meal names, custom restrictions, health details, credentials, URLs, or tokens, and changed zero database records.

| Aggregate | Count |
| --- | ---: |
| Library records | 2 |
| Records linked to a nutritionist profile | 2 |
| Records with at least one historical source plan | 1 |
| Records with historical ingredients | 1 |
| Linked historical plan rows projected | 1 |
| Linked historical ingredient rows projected | 3 |
| Records with more than one ingredient-bearing historical plan | 0 |
| Records whose combined historical ingredients are all FNRI-linked | 0 |
| Records with any Gemini-estimated historical ingredient | 0 |
| Records with any unlinked historical ingredient | 1 |
| Records with empty `suitableConditions` | 1 |
| Records with empty `allergenFree` | 1 |
| Records with both arrays empty | 1 |
| Records with a null declaration array | 0 |
| Records with a malformed declaration array | 0 |
| Legacy records affected by the proposed lifecycle | 2 |

Interpretation: neither existing record can be certified or auto-backfilled as complete from current evidence. One has no usable historical ingredient source, and the other has unlinked ingredient evidence. Empty arrays also cannot prove that a nutritionist explicitly reviewed the relevant declaration domain and found none. Across the aggregate profiling/accounting queries, 2 library rows, 1 linked historical plan row, and 3 linked historical ingredient projections were read; 0 records were changed.

## 3. Proposed lifecycle

### 3.1 Evidence states

Add a safety-evidence lifecycle independent of `MealLibrary.status`:

| `safetyEvidenceStatus` | Exact meaning | Automatic adapter eligibility |
| --- | --- | --- |
| `INCOMPLETE` | Never certified under the current contract, legacy/unreviewed, or missing at least one certification prerequisite | Never |
| `COMPLETE` | A currently authorized nutritionist certified one exact evidence revision under a supported policy version and every structural prerequisite passed | Possible, but only after user-specific policy evaluation |
| `STALE` | A previously complete revision was invalidated by a material event or is no longer current | Never until re-reviewed |

`LEGACY` should not be a fourth completeness state. Existing rows migrate to `INCOMPLETE` with a `LEGACY_UNREVIEWED` origin/history event. This distinguishes provenance without allowing legacy status to become a safety claim.

### 3.2 State transitions

| Event | From | To | Who/guard | Required audit behavior |
| --- | --- | --- | --- | --- |
| Add lifecycle columns | existing row | `INCOMPLETE` | reviewed migration only | Add `LEGACY_UNREVIEWED`; do not infer or certify |
| Create a new draft/library record | none | `INCOMPLETE` | approval/library service transaction | Record initial revision/origin |
| Save incomplete evidence | `INCOMPLETE` | `INCOMPLETE` | currently verified/unexpired nutritionist; expected revision | Increment evidence revision for a material edit |
| Certify all prerequisites | `INCOMPLETE` or `STALE` | `COMPLETE` | currently verified/unexpired nutritionist; server revalidates all evidence | Store reviewer, timestamp, version, certified revision, and immutable review event |
| Material edit | `COMPLETE` | `STALE` | authorized content/evidence editor; never a client-selected state | Retain last reviewer/timestamp; record invalidation time/reason and new revision |
| Material edit | `INCOMPLETE` or `STALE` | unchanged | authorized content/evidence editor | Increment revision and retain incomplete/stale reason |
| Flag library row | `COMPLETE` | `STALE` | verified nutritionist flag workflow | Record `LIBRARY_FLAGGED`; also set operational status `FLAGGED` |
| Dismiss flag | `STALE` | `STALE` | authorized flag resolver | Operational status may return to `APPROVED`; never restore completeness automatically |
| Unsupported policy version | `COMPLETE` | ineligible; then `STALE` when processed | server policy/version gate | Record `POLICY_VERSION_CHANGED`; no periodic certificate expiry is proposed |
| Reviewer verification revoked | `COMPLETE` | ineligible; then `STALE` on the revocation event | admin verification workflow/server gate | Record `REVIEWER_NO_LONGER_ELIGIBLE` |
| Re-review | `STALE` | `COMPLETE` only if all current prerequisites pass | any currently verified/unexpired nutritionist | New review event; prior history remains immutable |

Operational status and evidence status remain distinct. Automatic use requires both `MealLibrary.status = APPROVED` and `safetyEvidenceStatus = COMPLETE`. A flag forces complete evidence stale, while dismissing a flag does not certify evidence. `INCOMPLETE`, `STALE`, null, malformed, and every unknown future evidence state are ineligible. `FLAGGED` is ineligible regardless of evidence state.

## 4. Proposed minimum data contract

### 4.1 `MealLibrary` current snapshot fields

The following table is the accepted design. Batch 4B4 implemented only the rows marked First except the optional `safetyReviewNote`; normalized ingredients, declarations, history, certification constraints, and certification writers remain deferred.

All rows below are fields on `MealLibrary`. "First" means required in the first implementation of the lifecycle foundation, even when the value is nullable until certification.

| Field | Type; nullability; default | First/later | Writer and change event | Constraint/index | Why necessary |
| --- | --- | --- | --- | --- | --- |
| `safetyEvidenceStatus` | enum; non-null; `INCOMPLETE` | First | migration, certification, and invalidation service only | index with operational `status`; reject unknown API values | Current lifecycle and default-deny query gate |
| `safetyEvidenceOrigin` | enum; non-null; migrated rows `LEGACY_UNREVIEWED`, new drafts `NUTRITIONIST_DRAFT` | First | migration on legacy rows; certification changes current origin to `NUTRITIONIST_REVIEW` while history retains legacy origin | no standalone index | Distinguishes legacy/unreviewed evidence from explicit review |
| `allergenDeclarationState` | enum; non-null; `NOT_REVIEWED` | First | verified nutritionist draft/review transaction | state/declaration consistency check | Distinguishes missing evidence from explicit reviewed-none |
| `conditionDeclarationState` | enum; non-null; `NOT_REVIEWED` | First | verified nutritionist draft/review transaction | state/declaration consistency check | Same distinction for condition review without inventing medical rules |
| `crossContactAssessment` | enum; non-null; `NOT_ASSESSED` | First | verified nutritionist reviewing documented preparation evidence | exact enum; nondefault UI acknowledgement | Prevents ingredient lists from implying cross-contact freedom |
| `safetyEvidenceRevision` | integer; non-null; `0` | First | server increments atomically on every material edit | nonnegative; optimistic-update predicate | Identifies the exact evidence revision reviewed |
| `certifiedEvidenceRevision` | integer; nullable; no default | First | certification transaction; retained after staleness as last-certified revision | `COMPLETE` requires equality to current revision | Prevents a certification from silently covering later edits |
| `safetyPolicyVersion` | bounded string; nullable; no default | First | certification transaction; server-selected, never client-authoritative | supported-version allow-list; optional index only if migration queries need it | Detects policy/evidence-contract mismatch |
| `safetyReviewedAt` | timestamp; nullable; no default | First | certification transaction | `COMPLETE` requires non-null | Records when the current/last revision was certified |
| `safetyReviewedByNutritionistId` | nutritionist ID; nullable before certification | First | certification transaction after current eligibility check | FK/index; `COMPLETE` requires non-null; audit event also keeps durable ID | Separates safety reviewer from creator/owner |
| `safetyInvalidatedAt` | timestamp; nullable; no default | First | server invalidation transaction | `STALE` requires non-null | Records when current certification became unusable |
| `safetyInvalidationReason` | stable reason code; nullable; no default | First | server invalidation transaction | `STALE` requires approved non-null code | Makes stale state explainable/testable |
| `safetyReviewNote` | bounded sanitized text; nullable; no default | Optional later | reviewer; changes that alter review basis are material | length/control-character rules; never searched for eligibility | Human context only; structured evidence remains authoritative |
| `updatedAt` | timestamp; non-null; server-updated | First | every library mutation | normal timestamp; not an eligibility field | General change trace and operational diagnosis |

Prisma cannot express every cross-field check directly. The application transaction must enforce them, and a reviewed SQL `CHECK` may be added where PostgreSQL can safely express the invariant. The minimum useful indexes are `(status, safetyEvidenceStatus)`, `safetyReviewedByNutritionistId`, and the unique/current keys described for the normalized child tables. Do not add speculative indexes before explaining the query they support.

Recommended invalidation codes are `INGREDIENT_CHANGED`, `DECLARATION_CHANGED`, `MEAL_CONTENT_CHANGED`, `LIBRARY_FLAGGED`, `POLICY_VERSION_CHANGED`, `REVIEWER_NO_LONGER_ELIGIBLE`, and `SOURCE_EVIDENCE_CHANGED`. Unknown codes must fail closed.

### 4.2 Explicit declaration-state comparison

| Storage option | Strength | Problem | Recommendation |
| --- | --- | --- | --- |
| Existing Prisma enum arrays | Exact for current enum keys and easy to edit | Requires enum migration for expansion; cannot represent fish/soy custom provenance; current copied arrays do not prove review | Retain as compatibility display input only, not authority |
| Unconstrained string arrays | Handles future/custom keys with a small schema | Typos, aliases, and provenance become ambiguous; exact querying/constraints remain weak | Reject as authority |
| JSON | Can represent richer declarations and snapshots | Shape/version/uniqueness/FK constraints move entirely into application code; null/empty ambiguity persists | Use only for an immutable audit snapshot/digest, not current matching |
| Normalized relation table | Exact rows, indexes, optional ingredient link, canonical/custom provenance, deterministic tests | More migration/API/UI work | Recommended for current declarations |
| Separate immutable declaration/evidence records per review | Strong historical reconstruction | Excessive if duplicated as the only current read model | Recommended only as compact append-only review history alongside normalized current rows |

Add a normalized `MealLibrarySafetyDeclaration` design with:

- `id`, `mealLibraryId`, optional `mealLibraryIngredientId`;
- `declarationType`: `ALLERGEN_PRESENT`, `ALLERGEN_REVIEWED_ABSENT`, or `CONDITION_REVIEWED`;
- exactly one of `canonicalKey` or sanitized `customKey`;
- `createdAt` and `updatedAt`.

The separate declaration-state fields are still required. Zero declaration rows plus `NOT_REVIEWED` means missing evidence. Zero declaration rows plus `REVIEWED_NONE_DECLARED` is an explicit nutritionist statement that none were declared within that domain. `REVIEWED_WITH_DECLARATIONS` requires at least one structurally valid declaration row.

`ALLERGEN_PRESENT` is direct nutritionist-reviewed allergen evidence. `ALLERGEN_REVIEWED_ABSENT` is a formulation/ingredient review statement only; it must not imply laboratory testing, regulatory "allergen-free" certification, or absence of cross-contact. Condition declarations remain review evidence only. Batch 4B1 continues to require review for known conditions until separate medical rules are approved.

No declaration may be produced from dish names, translations, fuzzy matches, substring matches, ingredient-name assumptions, or AI inference. Custom keys remain exact custom evidence and do not become automatic canonical matches.

Current canonical enums and the three approved aliases remain the only automatic vocabulary. Fish and soy remain custom, wheat is not converted to gluten, and pregnancy does not include lactation. These distinctions must survive frontend editing and API round trips. Future schema expansion adds an explicitly approved canonical key without rewriting historical custom evidence or changing prior review meaning.

Minimum child constraints: index `mealLibraryId`; unique normalized current declaration per `(mealLibraryId, declarationType, canonicalKey)`; exactly one of canonical/custom key; a bounded mechanically normalized custom key; and an ingredient FK only when the reviewer explicitly attributes a present allergen to a library ingredient. Null-key uniqueness must be handled explicitly rather than assumed from a nullable compound unique constraint.

### 4.3 First-class library ingredients

Three persistence options were considered:

| Option | Migration cost | Integrity | Decision |
| --- | --- | --- | --- |
| Continue reading historical `MealPlan.ingredients` | None | Evidence can be absent, detached, deleted, recreated without linkage, or ambiguous across multiple plans | Reject as authority |
| Add lifecycle/reviewer metadata only but keep historical ingredients | Low | Correctly labels incomplete/stale state but leaves the actual ingredient evidence mutable and ambiguous; cannot safely support `COMPLETE` | Accept only as the isolated Batch 4B4 foundation, never as final eligibility authority |
| Add only a JSON ingredient snapshot to `MealLibrary` | Moderate | Stable snapshot but weak relational integrity, provenance querying, and update constraints | Not recommended |
| Add normalized `MealLibraryIngredient` rows | Higher but bounded | Stable library-owned evidence, FK linkage, explicit provenance/resolution, deterministic revision invalidation | Recommended |

Proposed minimum `MealLibraryIngredient` fields:

| Field | Type; nullability; default | First/later | Constraint/writer/purpose |
| --- | --- | --- | --- |
| `id` | ID; non-null | First persistence batch | Primary key generated by server |
| `mealLibraryId` | ID; non-null | First | indexed FK with cascade only when the library record itself is intentionally deleted; owns the evidence |
| `position` | integer; non-null | First | nonnegative and unique per library; reviewer/UI writes order deterministically |
| `ingredientName` | bounded string; non-null | First | reviewer-visible identity snapshot; a change is material and never auto-mapped as an allergen |
| `category` | bounded string or approved enum; non-null/default only if truthful | First | copied exactly when available; category is organizational, not safety evidence |
| `foodItemId` | ID; nullable | First | indexed FK with `SET NULL`; null immediately prevents completeness and triggers stale on a certified row |
| `dataSource` | existing-compatible enum; non-null | First | `FNRI` or `GEMINI_ESTIMATED`; unknown/default fabrication prohibited |
| `resolutionStatus` | enum; non-null; `UNRESOLVED` | First | `RESOLVED_FNRI`, `ESTIMATED`, or `UNRESOLVED`; must agree with source/link fields |
| `sourceMealPlanId` | ID; nullable | First | indexed trace-only reference; never queried as current ingredient authority |
| `quantity`, `unit` | numeric/string; nullable | Optional later | add only when a separate recipe/quantity design has authoritative values; current rows cannot backfill these truthfully |
| `createdAt`, `updatedAt` | timestamps; non-null | First | server-managed mutation trace; any evidence-bearing update increments the parent revision |

The first minimum implementation should not invent quantity/unit values because current `MealIngredient` rows do not store them. A later nutrition/recipe design can add them separately.

Completeness requires at least one library ingredient and requires every ingredient to be `RESOLVED_FNRI`, have `dataSource = FNRI`, and have a non-null `foodItemId`. Any estimated, unresolved, unlinked, missing, or unknown-source ingredient prevents `COMPLETE`. FNRI linkage proves only nutrition provenance; it supplies no allergen declaration.

Ingredient identity, nutrition values, allergen declarations, cross-contact, and condition compatibility remain separate evidence dimensions. `ingredientName` plus `foodItemId` identifies the reviewed ingredient; FNRI supplies nutrition data; `MealLibrarySafetyDeclaration` supplies direct reviewed allergen statements; the parent field supplies cross-contact assessment; and condition declarations remain review evidence under a separate medical-policy boundary.

Once first-class rows exist, deleting or editing a historical source plan must not delete or rewrite them. If the optional trace FK becomes null, the certified snapshot remains usable because it was independently reviewed; the deletion is logged as a traceability event, not automatically treated as missing ingredient evidence. Before first-class certification exists, source-plan deletion continues to leave the legacy record incomplete. If the owner requires source preservation for audit, use archival/restrict behavior rather than making source plans the live safety authority.

### 4.4 Review history

Add append-only `MealLibrarySafetyReview` events rather than overwriting the only audit evidence. A minimum event stores:

- library ID and evidence revision;
- durable reviewer nutritionist ID, decision, review timestamp, and policy version;
- declaration states, cross-contact assessment, and stable reason codes;
- certification or invalidation outcome;
- a bounded structured snapshot/digest of the ingredient/declaration IDs reviewed.

The review table is required with the first certification workflow, not with a lifecycle-columns-only Batch 4B4. Index `(mealLibraryId, reviewedAt)` and `reviewerNutritionistId`; never update an existing event. A JSON snapshot is acceptable here because it is immutable audit context, not the operational matching authority.

Reviewer audit identity must survive account deactivation. A future schema must therefore avoid silently erasing the only reviewer identifier through the current user/profile cascade. The exact retention mechanism needs owner/privacy approval under UNC-015; no credential value or health record belongs in this history.

## 5. Certification and authorization rules

### 5.1 Who may certify

Only a requester who, at certification time, has all of the following may create a `COMPLETE` review:

1. authenticated `NUTRITIONIST` role;
2. an existing `NutritionistProfile`;
3. `isVerified = true`;
4. a PRC license expiry that has not passed;
5. access to the exact current evidence revision.

An admin may manage account verification but cannot certify meal safety. The original library creator/verifier does not receive special safety authority. Any currently eligible nutritionist may review or re-review, which prevents abandoned records while preserving the distinct creator/verifier fields.

### 5.2 Certification prerequisites

A transaction may set `COMPLETE` only when:

- both declaration domains are explicitly reviewed rather than `NOT_REVIEWED`;
- declaration rows match their domain states and contain no duplicate, malformed, unknown-structure, or contradictory claims;
- no canonical allergen is simultaneously declared present and reviewed absent;
- at least one first-class library ingredient exists and every ingredient is FNRI-linked/resolved;
- the current evidence revision matches the revision submitted for review;
- cross-contact has an explicit state (default `NOT_ASSESSED` is allowed as truthful evidence, but limits user-specific eligibility);
- the policy version is supported;
- the library has no unresolved pending flag and operational status is suitable for certification;
- all content and evidence changes plus the review event occur atomically.

`COMPLETE` means the structured review record is complete, not that the meal is universally safe. User-specific restrictions still pass through the deterministic policy. Exact detected-allergen conflicts block. Known conditions, custom/unknown restrictions, and unsupported evidence continue to review.

### 5.3 Cross-contact boundary

Cross-contact must be persisted now because omission would make an automatic allergy claim ambiguous. Its default is `NOT_ASSESSED`.

- For a user with no positive allergy restriction, `NOT_ASSESSED` does not by itself invent an allergy conflict, although all other evidence requirements still apply.
- For a user with a positive allergy restriction, `NOT_ASSESSED` must make the candidate ineligible/review-required.
- `RISK_IDENTIFIED` makes an allergy-profile candidate ineligible and must expose a stable reason, not raw notes.
- Only `ASSESSED_NO_KNOWN_RISK` can satisfy the cross-contact portion of automatic allergy eligibility. This wording is scoped to documented preparation evidence and is not a laboratory or facility-wide guarantee.

The owner and licensed RND must approve this exact UI wording and whether cross-contact can be assessed meaningfully with the information the product collects.

## 6. Material edits, staleness, and versioning

Material events are ingredient add/remove/name/link/source/resolution changes; direct declaration or declaration-state changes; cross-contact changes; meal name/description/type changes; nutrition/macro changes relevant to condition review; dietary-tag changes; flagging; and evidence-source changes. These increment the evidence revision and invalidate a complete certification in the same transaction.

Usage-count increments and read-only access are non-material. Review notes are material if they alter the basis of certification; purely administrative notes should be stored outside the safety evidence.

No arbitrary 30/90/365-day evidence expiry is proposed. Event-based invalidation is preferred. A policy-version mismatch or nutritionist verification revocation must fail closed at evaluation time and should create a stale event when processed. License expiry is separately checked at use/certification time; the owner must decide whether an automated lifecycle job may persist staleness or whether eligibility remains a read-time gate.

## 7. Proposed approval and re-review workflow

1. Approval of a pending plan may still create a library record, but it creates `INCOMPLETE` evidence and a first-class draft ingredient snapshot; it must not certify automatically.
2. The reviewer opens a dedicated safety-evidence form showing immutable source provenance, current library ingredients, direct declarations, declaration states, cross-contact, version, and current revision.
3. Draft changes validate and save atomically, incrementing the evidence revision and retaining `INCOMPLETE` or `STALE`.
4. Certification re-reads the requester profile, license, library status, pending flags, full evidence, and expected revision inside the transaction.
5. A successful certification writes `COMPLETE`, reviewer/timestamp/version/certified revision, and an append-only review event.
6. A later material edit or flag writes `STALE` and an invalidation event. Dismissing the flag leaves it stale.
7. Any currently verified/unexpired nutritionist may re-review the latest revision. Ownership of general library metadata remains a separate product/authorization rule.

One qualified nutritionist is sufficient for the capstone; a second reviewer is not required. Admin may verify accounts and manage operational issues but cannot certify safety. The original reviewer is not the only person allowed to re-review. A review note is optional unless a later owner/RND decision makes a bounded note mandatory for a specific exception; it never replaces structured evidence. A meal may truthfully contain an `ALLERGEN_PRESENT` declaration and still have structurally complete evidence, but it cannot be automatically eligible for a user whose deterministic allergy restriction conflicts with that declaration.

## 8. Migration and legacy strategy

### 8.1 Safe additive migration

Before applying any migration, run aggregate-only prechecks for total rows; null/invalid verifier links; null/malformed/empty compatibility metadata; zero/one/multiple linked source plans; zero/estimated/unresolved/unlinked ingredients; duplicate source ingredient positions/names where relevant; orphaned plan/ingredient/food links; pending flags; and existing rows/tables that would conflict with proposed names or constraints. Report counts only. Do not deduplicate, choose a winning plan, or alter a row as part of the precheck.

The smallest safe schema migration is additive:

- add lifecycle/origin/declaration-state/cross-contact/revision fields with conservative non-null defaults;
- add nullable reviewer/version/timestamp/invalidation fields;
- add first-class ingredient, declaration, and review-history tables only in their separately approved implementation slice;
- add indexes/uniqueness needed for library/revision/reviewer/declaration lookup;
- do not delete, merge, rename, or certify any existing row.

All existing rows become `INCOMPLETE`, `LEGACY_UNREVIEWED`, both declaration domains `NOT_REVIEWED`, cross-contact `NOT_ASSESSED`, and revision `0`. Both currently observed records remain preserved and adapter-ineligible.

### 8.2 What can and cannot be backfilled

Without external lookup, an implementation may copy exact historical ingredient name, category, existing `dataSource`, existing `foodItemId`, and source plan ID into an incomplete draft only when the source-plan selection is deterministic. Copying is provenance preservation, not certification.

Do not auto-select when zero or multiple plausible source plans exist. Do not use meal names, dates, `find()` order, fuzzy matching, translations, Gemini, or FNRI lookup to manufacture missing linkage. Do not convert empty arrays to reviewed-none. Do not convert a verifier relation into a safety reviewer. Do not infer allergens from FNRI nutrition records.

The current aggregate shows no record with complete FNRI-linked historical ingredients, so no existing row is eligible for automatic complete backfill. Both require nutritionist review; one also lacks a historical source plan and the other has unlinked ingredients.

### 8.3 Recovery and compatibility

Deploy schema defaults before any writer or adapter change. The existing application can ignore additive fields, and Batch 4B2 keeps all rows on fallback because no supported explicit evidence is supplied. Then deploy draft persistence, certification APIs/UI, and adapter mapping in separate reversible slices.

If an application deployment is rolled back after the additive migration, retain the new columns/tables; the old application ignores them. Destructive down-migration should not be the normal recovery path. Any later removal would require a separate backup/export, proof that no unique review history would be lost, and explicit owner authorization.

## 9. API, validation, and UI design

### 9.1 Proposed interfaces

Exact routes remain proposed:

- `GET /api/nutritionist/library/:id/safety-evidence`: return current revision, structured evidence, lifecycle, and review history metadata.
- `PUT /api/nutritionist/library/:id/safety-evidence`: save a validated draft with `expectedRevision`; never certify implicitly.
- `POST /api/nutritionist/library/:id/safety-evidence/certify`: certify one exact current revision after server-side authorization/revalidation.
- `POST /api/nutritionist/library/:id/safety-evidence/invalidate`: internal/admin workflow for stable invalidation events; not a substitute for flagging.

The backend must use strict DTO/schema validation: exact enums, bounded normalized strings, canonical/custom exclusivity, duplicate rejection, non-empty ingredient arrays, referential checks, finite numeric values, bounded notes/reasons, and rejection of unknown fields. It must never trust frontend reviewer/verified/version/status fields.

Use optimistic concurrency through `expectedRevision`; a mismatch returns `409` before mutation. Certification, current-snapshot update, revision check, and history append are one transaction. Responses expose scoped reason codes and evidence status without leaking private health information or credentials.

| Existing/future surface | Minimum future change | Failure/authorization behavior |
| --- | --- | --- |
| Library list response | add operational and evidence statuses, version, revision, stale reason, cross-contact state, and scoped reviewer/time summary | unknown state renders ineligible; do not return private reviewer/account fields |
| Library detail response | add first-class ingredients, declaration/domain states, provenance/resolution, flags, and review-history summary | `404` for absent; role/verified-profile policy before health-adjacent detail |
| Library edit request | strict allow-list; content/evidence materiality classified server-side; require `expectedRevision` | unauthorized `403`; malformed `400`; revision conflict `409`; never accept client-selected `COMPLETE` |
| Certification action | no arbitrary reviewer/status/version fields; server derives actor, time, supported version, and transition | `403` for nonqualified actor; `409` for stale revision/flag/state; `422` for incomplete evidence |
| Eligibility display | return a scoped `eligibleForAutomaticUse` plus stable reasons, never only a green "safe" boolean | unknown/mismatch defaults false |
| Audit display | reviewer identity allowed to nutritionists at the minimum needed level, timestamp/version/revision/outcome/reasons | no credential/license secret or raw user health data |
| Error contract | preserve `{ success: false, error }` and add stable machine reason codes when the project adopts the DTO | sanitized bounded messages; no raw Prisma/request evidence |

### 9.2 Proposed UI states

The nutritionist library should show separate badges for operational status and safety evidence: `Unreviewed/incomplete`, `Certified evidence`, `Stale - re-review required`, and `Flagged`. It must display the reviewer and timestamp for audit without calling the meal universally safe.

The form must require explicit choices:

- "Not reviewed" versus "Reviewed: none declared" versus "Reviewed: declarations recorded" for allergens and conditions;
- direct `Present` versus `Reviewed absent` allergen declarations;
- cross-contact state, with `Not assessed` selected by default;
- ingredient provenance/resolution per row;
- acknowledgement that FNRI linkage is nutrition provenance only.

Missing/null data must not render as an empty checked form. Estimated/unresolved rows must visibly prevent certification. Material edits warn that current evidence will become stale. Flag dismissal must not show a restored certification. General ownership controls and the safety-review action must be visually and authoritatively distinct.

## 10. Future adapter contract

The existing Batch 4B2 adapter must remain unchanged until the schema, workflow, and tests are implemented. A later adapter revision may map authoritative evidence as follows:

Required candidate input for possible eligibility is operational status; known evidence lifecycle; current/certified revision; supported policy version; current reviewer eligibility result; both declaration-domain states and canonical/custom declaration rows; cross-contact state; and a non-empty first-class ingredient array containing source, resolution, and linkage. Optional input is sanitized display/audit context and exact custom declarations; optional data can add review reasons but can never repair a missing required field. Raw review notes are not adapter input.

| Adapter evidence | Proposed source |
| --- | --- |
| Approved status | `MealLibrary.status = APPROVED` |
| Complete marker | `safetyEvidenceStatus = COMPLETE`, certified revision equals current revision, supported version |
| Reviewer authority | current reviewer profile verified and license current |
| Detected allergens | canonical `ALLERGEN_PRESENT` declarations only |
| Reviewed-absent coverage | canonical `ALLERGEN_REVIEWED_ABSENT` declarations plus explicit allergen domain state |
| Conditions | structured condition declarations, while known conditions still produce review under current Batch 4B1 rules |
| Ingredients | first-class `MealLibraryIngredient`, never historical plans |
| Provenance | every ingredient FNRI-linked/resolved; FNRI supplies nutrition values only |
| Cross-contact | explicit assessment; positive allergy plus `NOT_ASSESSED` or `RISK_IDENTIFIED` requires review/ineligibility |

Automatic eligibility requires all of the above plus the existing deterministic result `ALLOW`, complete metadata, no blocking conflict, no unresolved restriction, and no estimated/unresolved ingredient. Direct allergy conflict remains `BLOCK`. Condition/custom/unknown cases remain `REVIEW`. No meal name, dish category, ingredient text, translation, fuzzy match, or AI output may fill missing allergen evidence.

Lifecycle mapping is exact: `COMPLETE` may proceed to user-specific evaluation; `INCOMPLETE`, `STALE`, null, malformed, and unknown future values map to review/ineligible. `FLAGGED` and every non-`APPROVED` operational status are ineligible before policy outcome. Missing/unverified/expired reviewer evidence, revision mismatch, or policy-version mismatch maps to review/ineligible. Canonical declarations use only the approved exact vocabulary/aliases; custom declarations retain custom provenance and continue to review. No adapter path may mutate status or silently update a version.

Until that adapter revision is separately approved and verified, legacy/current rows continue to omit `safetyEvidence`, evaluate to review, and use fallback.

## 11. Test design

The implementation batch requires synthetic unit tests and database/API integration tests against a disposable development/test database. Minimum scenarios:

1. migration preserves every library row/link and gives all legacy rows conservative defaults;
2. explicit reviewed-none is distinguishable from missing/null/empty legacy data;
3. only verified, unexpired nutritionists can certify; role alone, admin, expired, and unverified actors cannot;
4. certification fails for no ingredients, estimated, unresolved, unlinked, malformed, duplicate, or contradictory evidence;
5. FNRI linkage never creates an allergen declaration;
6. exact direct allergen conflict blocks; dishes, translations, partial/fuzzy names, and unapproved aliases do not map;
7. positive allergy plus `NOT_ASSESSED` cross-contact remains ineligible;
8. complete no-restriction and complete non-conflicting canonical-allergy fixtures reach only the intended policy outcomes;
9. known conditions and custom/unknown restrictions still review;
10. every material edit increments revision and changes `COMPLETE` to `STALE`; usage-count change does not;
11. flagging stales complete evidence and dismissal does not restore it;
12. policy-version and reviewer-eligibility mismatch fail closed;
13. expected-revision conflict returns `409` with zero partial writes;
14. certification/history/current snapshot are atomic under retry/concurrency;
15. delete/deactivation behavior preserves required review audit identity/history;
16. migration importer refuses ambiguous/missing source plans and never auto-certifies;
17. adapter retains the existing one-batch fallback for every ineligible slot;
18. responses/logs contain no credentials, raw private health data, or unbounded review text.

No existing live row should be mutated to satisfy these tests.

## 12. Small roadmap and owner decisions

Recommended sequence after separate approval:

| Batch | Scope and affected files/models | Risk and database impact | Tests and acceptance | Recovery and documentation |
| --- | --- | --- | --- | --- |
| 4B4 - lifecycle foundation | `schema.prisma` plus one migration; add only current lifecycle/origin/domain/cross-contact/revision/reviewer/version/invalidation fields and relations | Critical design semantics; additive DDL; every legacy row remains `INCOMPLETE`; no eligibility/write behavior | migration upgrade on disposable copy; exact row/link/count preservation; defaults/constraints; old app still runs; zero legacy complete | application rollback leaves additive fields; forward-fix preferred; allocate new CHG/TEST/DOC and link REQ-011/ADR-009/DEF-027/RISK-019 |
| 4B5 - stable evidence persistence | add `MealLibraryIngredient`, `MealLibrarySafetyDeclaration`, and `MealLibrarySafetyReview`; approval creates incomplete draft snapshot only; deterministic import tool/service if separately approved | Critical schema/data; no external lookup; no auto-certification; ambiguous/missing sources untouched | table/FK/unique/state tests; exact-copy draft tests; zero/multiple source refusal; no deletion; audit immutability | disable writer and retain additive data on rollback; forward recovery; new migration/TEST/CHG/DOC IDs |
| 4B6 - certification API | nutritionist authorization policy, DTO validators, route/controller/service transaction, revision/invalidation/history logic | Critical clinical/security/write behavior; database writes only to explicit reviewed records | verified/unverified/expired/admin/ownership cases; incomplete/conflict/flag/version cases; `409` concurrency; atomic retry/no partial write | feature-disable endpoints while retaining evidence; transaction forward-fix; trace REQ-004/005/006/011 and new tests/change IDs |
| 4B7 - nutritionist UI | library list/detail/edit/review components/types; explicit states, provenance, cross-contact, stale and conflict presentation | High user-facing clinical wording; no new migration | component/browser flows; null not rendered empty; blocked certification reasons; no universal-safe claim; accessibility | hide/disable certification UI while API/data remain; new TEST/CHG/DOC IDs and licensed-RND wording approval |
| 4B8 - adapter revision | adapter types/mapping, generation query uses first-class evidence, focused service tests | Critical generation-selection behavior; read-only database use during selection | lifecycle/status/reviewer/version/declaration/cross-contact/provenance matrix; one-batch fallback; live read-only verification only if safely available | revert adapter/query together; schema/evidence retained; link existing TEST-015/016/027/028 plus new IDs |
| Later one-caller batches | consider swap, compatible-library, recheck, review warnings, logging, grocery, and cron separately | Critical and caller-specific; migrations unknown | one caller contract/runtime matrix per approval | independent rollback and new IDs; no blanket reuse or medical-rule expansion |

Batch 4B4 is the smallest next implementation because conservative lifecycle defaults can be added without creating certification writes or making any record eligible. Each row above requires its own owner authorization and exact new engineering IDs at execution time; this design does not pre-allocate IDs for unapproved changes.

Decisions resolved for Batch 4B4 and still required before later batches:

- Resolved for 4B4: use the exact lifecycle-foundation names in section 4.1 and split first-class evidence tables into a separately authorized later migration.
- approve normalized declaration types and exact custom-key retention rules;
- Resolved for 4B4: cross-contact uses `NOT_ASSESSED`, `ASSESSED_NO_KNOWN_RISK`, and `RISK_IDENTIFIED`; the no-known-risk state is limited to reviewed information and is not a laboratory, manufacturing, regulatory, medical, or cross-contact-free guarantee. Adapter eligibility remains deferred.
- choose the initial policy-version identifier and who may advance it;
- Resolved for the current snapshot: the reviewer is a distinct optional `NutritionistProfile` relation with `ON DELETE RESTRICT`; durable append-only history remains deferred.
- Resolved for 4B4: reviewer ineligibility fails closed at runtime later and may trigger event-based staleness, but this migration does not mutate rows when eligibility changes and invents no calendar expiry.
- approve the complete list of material fields, especially nutrition/macros, description, meal type, and dietary tags;
- decide hard-delete versus archival behavior for certified library records;
- approve the deterministic source-plan rule for draft import; ambiguous or missing sources must remain manual;
- confirm that condition declarations remain review-only until separately approved licensed-RND medical rules exist;
- approve scoped cross-contact and "reviewed absent" UI language with a licensed RND;
- separately authorize each later implementation batch. Batch 4B4 authorizes schema/migration/defaults only and does not authorize certification behavior.

## 13. Batch 4B4 implemented lifecycle foundation

On August 20, 2026, the owner authorized and the repository applied one additive Prisma migration to the previously verified shared capstone development/demo database. The target was confirmed through the established local configuration without printing its URL, hostname, credentials, records, meal names, or health data. Preflight found tenable migration history: nine applied migrations, no duplicate names, no failed or unapplied prior migration, and no live-schema/datamodel drift. The new migration then became the tenth applied migration.

The implementation adds four enums and thirteen `MealLibrary` columns: lifecycle status, origin, two declaration states, cross-contact assessment, current/certified revisions, policy version, a distinct optional safety-reviewer relation, review/invalidation timestamps, sanitized invalidation reason, and `updatedAt`. It adds nonnegative revision checks, indexes for `(status, safetyEvidenceStatus)` and reviewer lookup, and an `ON DELETE RESTRICT`/`ON UPDATE CASCADE` reviewer foreign key. It does not add `MealLibraryIngredient`, `MealLibrarySafetyDeclaration`, `MealLibrarySafetyReview`, application writers, routes, serializers, UI, or adapter mapping.

The migration uses the legacy origin only while adding the column, then changes the future-row default to `NUTRITIONIST_DRAFT`. This produced the required conservative aggregate for both existing rows: 2 `INCOMPLETE`, 2 `LEGACY_UNREVIEWED`, 2 condition `NOT_REVIEWED`, 2 allergen `NOT_REVIEWED`, 2 cross-contact `NOT_ASSESSED`, 2 revision zero, and 2 each with null certified revision, reviewer, review timestamp, policy version, and invalidation fields. There are 0 `COMPLETE`, 0 `STALE`, and 0 nutritionist-certified-origin rows. These defaults are absence-of-review markers, not proof of review.

Privacy-safe before/after snapshots matched for 6 users, 1 nutritionist profile, 0 accounts, 0 sessions, 1,537 food items, 2 library rows, 181 meal plans, 1,339 meal ingredients, and 0 library flags. Role counts, operational library statuses, compatibility arrays, ingredient and food linkage, creator/verifier links, plan/library links, and flag links also matched by aggregate counts and deterministic hashes. Application/domain records created, updated, or deleted were 0/0/0; only Prisma's migration-history row was created. No application service ran during deployment.

Compatibility remains conservative. New required columns have database defaults; reviewer/timestamp/version/invalidation columns are nullable; existing production source and API/frontend files were not changed. Current approval/library creation can continue without supplying certification fields and produces an incomplete nutritionist draft. Batch 4B2 still receives no authoritative `safetyEvidence` mapping, so legacy/incomplete rows remain ineligible and fall back. Prisma client generation was not required by this no-consumer batch and was attempted but could not replace the Windows query-engine binary because of an operating-system `EPERM`; schema validation, deployed-schema diff, backend tests, and both package type checks passed independently. A later API batch must regenerate the client and use explicit response selection before exposing any new field.

Recovery is forward-only by default: keep the additive columns if application checks fail, disable any future consumer, and issue a separately reviewed corrective migration. Do not reset, drop columns/types, rewrite migration history, or delete data without separate authorization. TEST-030, CHG-20260820-02, and DOC-016 contain the execution evidence. UNC-015 is resolved for this bounded migration; first-class evidence persistence, immutable review history, certification authorization/writes, invalidation events, serializers/UI, and adapter eligibility remain future work.

## 14. August 30 first-class implementation update

The owner later authorized the broader production-readiness implementation. Source now includes `MealLibraryIngredient`, `MealLibrarySafetyDeclaration`, and `MealLibrarySafetyReview`, plus soft archival and a strict certification endpoint. Approval creates an incomplete draft with a stable ingredient snapshot; it does not treat one user's restrictions as reusable safety declarations. A currently verified nutritionist with an unexpired license may certify only the current exact revision, only when every stable ingredient is FNRI-linked, both declaration domains are explicitly reviewed, and cross-contact is recorded as assessed with no known risk. Certification and its audit snapshot are transactional.

Material edits and flags stale current evidence. Dismissing a flag does not silently restore certification, and deletion is implemented as archival so review evidence remains auditable. Generation reads only first-class library evidence, verifies the reviewer and supported policy version at use time, applies the deterministic user-specific restriction adapter, and falls back to Gemini for every legacy, incomplete, stale, malformed, unsupported, or conflicting candidate. Known conditions remain review-only because no licensed-RND medical compatibility rules have been approved.

The nutritionist library UI exposes operational status separately from evidence status and provides an explicit evidence-review form with non-universal-safety wording. Strict request schemas bound review, edit, flag, resolution, and certification payloads. Synthetic policy tests cover conservative eligibility and claim/credential behavior.

The additive migration source is `backend/prisma/migrations/20260830110000_add_meal_library_safety_evidence/migration.sql`. On August 30 the owner ran `npx.cmd prisma migrate deploy` from the backend and supplied terminal evidence that Prisma found 12 migrations, applied this exact migration, and reported all migrations successfully applied. The SQL contains no application-row backfill or certification operation, so no existing library row was made complete or certified by deployment. Managed Codex post-deployment queries remain blocked by the previously recorded Windows TLS credential error; runtime/API/database integration and licensed clinical wording/rule review remain mandatory before production acceptance. Sections 2, 10, 12, and 13 above preserve the historical findings and staged plan that led to this implementation; where they say later layers are unimplemented, this section is the superseding current status.
