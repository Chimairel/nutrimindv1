# NutriMind Deterministic Restriction Policy Design

Status: Batch 4A design, Batch 4B1 pure policy, and Batch 4B2 generation-library adapter implemented; no broader caller integration or clinical approval
Date: August 19, 2026
Scope classification: `CLINICAL-SAFETY-IMPACTING`; potential privacy impact; schema analysis only; no migration

## 1. Purpose and evidence boundaries

This document specifies a future pure, deterministic restriction evaluator. It does not declare any food medically safe or unsafe, change runtime behavior, approve synonym mappings, or replace licensed nutritionist review.

Evidence labels used below:

- **Schema fact**: exact Prisma vocabulary or field shape.
- **Current behavior**: executable repository behavior, whether correct or not.
- **Unreviewed repository rule**: a medical/ingredient rule in code with no licensed-review evidence found.
- **Product requirement**: owner-authorized conservative direction for the future engine.
- **Technical proposal**: deterministic software behavior awaiting implementation approval.
- **Clinical decision**: requires a licensed reviewer; code presence is not validation.

`SAFE` in this design can only mean “no declared-restriction conflict found using complete approved metadata within this engine’s scope.” It must never mean medically safe in general.

## 2. Exact schema vocabulary

### 2.1 Restrictions and review/status values

| Schema concept | Exact values/shape | Current default | Notes |
| --- | --- | --- | --- |
| `HealthConditionType` | `DIABETES`, `HYPERTENSION`, `KIDNEY_DISEASE`, `HEART_CONDITION`, `PREGNANT`, `NONE` | None at row level | `HealthCondition.condition`; no composite uniqueness |
| `AllergenType` | `SHELLFISH`, `NUTS`, `DAIRY`, `GLUTEN`, `EGGS`, `NONE` | None at row level | `Allergy.allergen`; mapped table name is `Allgy` |
| Custom conditions | `UserProfile.otherConditions: String?` | `null` | Comma-separated free text in current controllers |
| Custom allergies | `UserProfile.otherAllergies: String?` | `null` | Comma-separated free text in current controllers |
| `MealPlanStatus` | `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `CANCELLED` | `PENDING_REVIEW` | Batch 3 separately governs actionability |
| `AIConfidenceFlag` | `SAFE`, `CAUTION`, `NEEDS_REVIEW` | `SAFE` | Confidence/review label, not clinical validation |
| `MealIngredientDataSource` | `FNRI`, `GEMINI_ESTIMATED` | `FNRI` | No explicit `UNRESOLVED` value |
| `MealLogDataSource` | `FNRI`, `GEMINI_ESTIMATED`, `SYSTEM` | Required | Outside logs currently use `GEMINI_ESTIMATED` |
| `MealLibraryStatus` | `APPROVED`, `FLAGGED` | `APPROVED` | Separate from plan approval |
| `FlagStatus` | `PENDING`, `RESOLVED_REMOVED`, `RESOLVED_KEPT` | `PENDING` | Cross-nutritionist library review |
| Safety replacement | `MealLogSource.SAFETY_REPLACED` | N/A | A log provenance value, not a safety decision |
| Warning acknowledgement | `MealLog.warningType: String?`, `warningShown: Boolean`, `warningAcknowledged: Boolean`; same booleans on `SwapLog` | false/null | Warning reason vocabulary is not constrained |
| Nutritionist review | `nutritionistId`, `nutritionistNote`, `reviewedAt`, `claimedByNutritionistId`, `claimedAt` on `MealPlan` | Nullable | Claim/approval concurrency is outside Batch 4A |

### 2.2 Related models and metadata

| Model/field | Restriction relevance | Limitation |
| --- | --- | --- |
| `HealthCondition` / `Allergy` | Persist enum selections | `NONE` is persisted like a positive restriction; direct API can submit contradictory arrays |
| `UserProfile.otherConditions` / `otherAllergies` | Persist custom entries | Free-text comma serialization; no canonical key/provenance/review state |
| `MealPlan.aiConfidenceFlag` | Queue severity and UI display | Default `SAFE`; allergy-only/custom-only profiles are not included in current generation flag calculation |
| `MealIngredient.ingredientName`, `foodItemId`, `dataSource` | Ingredient evidence and provenance | No allergen declarations; `foodItemId = null` is the only unresolved-link signal |
| `FoodItem` / `FoodAlias` | FNRI nutrient lookup | No allergen/safety fields; alias/fuzzy nutrient matching cannot prove restriction safety |
| `MealLibrary.suitableConditions` | JSON compatibility claims | Nullable, untyped JSON; no completeness/version/review marker |
| `MealLibrary.allergenFree` | JSON exclusion claims | Nullable, untyped JSON; no ingredient relation or cross-contact evidence |
| `MealLibrary.dietaryTags` | JSON diet/goal tags | Mixed dietary preferences and fitness goals in one untyped array |
| `NutritionReport.basedOnConditions` / `basedOnAllergies` | AI report provenance | JSON, not an enforcement boundary |
| `MealLibraryFlag` | Human dispute workflow | Free-text reason; pending flag is not consumed by the proposed engine yet |

No separate clinical-confidence field, safety-metadata completeness field, or persisted reason-code field exists.

## 3. Canonical vocabulary proposal

The proposed internal key for every enum row is the exact Prisma key. Labels and related words are display/input evidence only; they are not approved aliases.

| Category | Prisma key | User-facing label | Frontend value | Current backend value | Existing related terms | Proposed internal key | Evidence | Conflict/uncertainty | Approval |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Condition | `DIABETES` | Diabetes | `DIABETES` | `DIABETES` | Type 1, Type 2, gestational in custom suggestions | `DIABETES` | Schema/onboarding/profile/library | Subtypes are collapsed only in UI enum; semantic mapping unapproved | RND + owner |
| Condition | `HYPERTENSION` | Hypertension | `HYPERTENSION` | `HYPERTENSION` | Low-sodium library label | `HYPERTENSION` | Schema/onboarding/profile/library | Sodium rules/thresholds unreviewed | RND |
| Condition | `KIDNEY_DISEASE` | Kidney Disease | `KIDNEY_DISEASE` | `KIDNEY_DISEASE` | CKD/AKI/nephrotic syndrome in suggestions | `KIDNEY_DISEASE` | Schema/onboarding/profile/library | Distinct diseases cannot be collapsed automatically | RND + owner |
| Condition | `HEART_CONDITION` | Heart Condition | `HEART_CONDITION` | `HEART_CONDITION` | CAD/CHF/arrhythmia in suggestions | `HEART_CONDITION` | Schema/onboarding/profile/library | Broad category and fat rule unreviewed | RND + owner |
| Condition | `PREGNANT` | Pregnant / Lactating | `PREGNANT` | `PREGNANT` | Pregnancy-safe library label | `PREGNANT` | Schema/onboarding/profile/library | Schema says pregnant; UI adds lactating | RND + owner |
| Condition | `NONE` | None / Healthy | `NONE` | `NONE` | No restrictions | `NONE` | Schema/onboarding | Must be exclusive and must not erase non-empty custom values implicitly | Owner |
| Allergy | `SHELLFISH` | Shellfish | `SHELLFISH` | `SHELLFISH` | Seafood/mollusks/squid keywords | `SHELLFISH` | Schema/onboarding/profile/log/review | Keyword coverage is broader than the key | RND |
| Allergy | `NUTS` | Tree Nuts & Peanuts | `NUTS` | `NUTS` | `PEANUTS`, `TREE_NUTS`, Peanuts, Tree Nuts | `NUTS` | Schema/onboarding/profile/log/library | Nutritionist map keys cannot match enum; combined category loses granularity | RND + owner |
| Allergy | `DAIRY` | Dairy | `DAIRY` | `DAIRY` | Milk/lactose intolerance terms | `DAIRY` | Schema/onboarding/profile/log/library | Allergy and intolerance must not be conflated automatically | RND |
| Allergy | `GLUTEN` | Gluten / Wheat | `GLUTEN` | `GLUTEN` | `WHEAT`, Wheat | `GLUTEN` | Schema/onboarding/profile/log/library | Wheat allergy and gluten-related restrictions are not proven equivalent | RND + owner |
| Allergy | `EGGS` | Eggs | `EGGS` | `EGGS` | `EGG`, Egg | `EGGS` | Schema/onboarding/profile/log/library | Nutritionist map uses unreachable singular key | Owner; RND for ingredient scope |
| Allergy | `NONE` | No Allergies | `NONE` | `NONE` | None/nil/N/A rejected for custom input | `NONE` | Schema/onboarding | Must be exclusive and not coexist with custom allergies | Owner |

`FISH` and `SOY` are not Prisma `AllergenType` values. They appear in custom suggestions/placeholders and as unreachable nutritionist warning-map keys. They must remain custom restrictions until an explicit schema/product decision is approved.

## 4. Frontend/backend mismatch inventory

| ID | Area | Frontend/schema vocabulary | Backend behavior | Impact |
| --- | --- | --- | --- | --- |
| DEF-023 | Nutritionist allergen warning map | Enum is `NUTS`, `EGGS`, `GLUTEN`; no `FISH`/`SOY` enum | Map uses `PEANUTS`, `TREE_NUTS`, `EGG`, `WHEAT`, `FISH`, `SOY`; only `DAIRY` and `SHELLFISH` align | Most mapped warnings are unreachable for enum allergies |
| DEF-024 | Missing library metadata | Library UI permits empty arrays; schema permits null | Generation, swap, compatible library, and safety replacement skip checks when metadata is null and accept empty arrays as containing no compatible restriction | Unknown metadata can become eligible instead of review |
| DEF-025 | Custom restrictions | Onboarding/profile collect and persist custom text | Deterministic generation/library/swap/log/review/recheck rules ignore custom values; only AI prompts receive them in generation/report | Custom restrictions can be discarded at enforcement boundaries |
| DEF-026 | Confidence assignment | Allergies and custom restrictions are safety inputs | `userHasConditions` tests enum conditions only; allergy-only/custom-only AI plans can retain default `SAFE` | Confidence can understate review need |
| Existing DEF-009 | Fragmented rules | Shared enum types exist | Keyword sets, thresholds, normalization, outputs, and missing-data behavior differ by service | Inconsistent decisions and bypasses |
| Product mismatch | Pregnancy label | Prisma `PREGNANT` | UI says “Pregnant / Lactating” | One enum represents two states without evidence |
| Contract mismatch | Frontend `UserProfile` type | Schema contains `otherConditions` and `otherAllergies` | Shared frontend `UserProfile` omits them; progress page declares a local type | Type drift |
| Validation gap | Direct API arrays | UI makes `NONE` exclusive | Backend only checks `Array.isArray`, then passes values to Prisma; enum/custom updates are separate operations | Invalid/duplicate/contradictory requests are not coherently validated |

## 5. Privacy-safe read-only database profile

The owner-confirmed shared development/demo database was queried inside explicit read-only transactions. Only aggregate counts and safety-key occurrences were returned.

### 5.1 Restrictions in use

| Aggregate | Count |
| --- | ---: |
| Enum conditions: `NONE` | 2 |
| Enum conditions: `HEART_CONDITION` | 1 |
| Enum conditions: `HYPERTENSION` | 1 |
| Custom-condition profiles | 0 |
| Enum allergies: `NONE` | 2 |
| Enum allergies: `DAIRY` | 1 |
| Enum allergies: `EGGS` | 1 |
| Custom-allergy profiles | 0 |

No custom text, user identity, ID, profile, or health record was output.

### 5.2 Library metadata

| Aggregate | Count/result |
| --- | ---: |
| Meal-library records | 2 |
| Records with nutritionist relation present | 2 |
| Structurally non-null known-key arrays for both safety fields | 2 |
| Null/invalid-shape/unknown-key metadata | 0 / 0 / 0 |
| Records with both safety arrays empty | 1 |
| Condition-key occurrences | `HEART_CONDITION`: 1 |
| Allergen-key occurrences | `EGGS`: 1 |
| Clinically/semantically complete records certifiable from schema | 0 |

Structural presence is not clinical completeness. The schema cannot distinguish “reviewed and no claims” from “not annotated,” version the review basis, or connect a library record to normalized ingredients.

### 5.3 Ingredient provenance, confidence, and review state

| Aggregate | Count |
| --- | ---: |
| Meal ingredients | 1,339 |
| `FNRI` with linked `FoodItem` | 829 |
| `FNRI` without linked `FoodItem` | 384 |
| `GEMINI_ESTIMATED` with linked `FoodItem` | 0 |
| `GEMINI_ESTIMATED` without linked `FoodItem` | 126 |
| Plan confidence `SAFE` / `CAUTION` / `NEEDS_REVIEW` | 147 / 14 / 20 |
| Plan status `APPROVED` / `PENDING_REVIEW` / `REJECTED` / `CANCELLED` | 1 / 47 / 1 / 132 |
| Library status `APPROVED` / `FLAGGED` | 2 / 0 |
| Pending library flags | 0 |
| Meal-log data source `FNRI` / `GEMINI_ESTIMATED` | 15 / 14 |
| Logs with warning shown / acknowledged | 1 / 1 |

An `FNRI` label without a `FoodItem` link is provenance-incomplete. Neither `FNRI` linkage nor nutrient provenance supplies allergen/condition compatibility metadata.

## 6. Current restriction-rule inventory

Coverage abbreviations: EC enum conditions; CC custom conditions; EA enum allergies; CA custom allergies; ING ingredients; AI AI-estimated/unresolved ingredients.

| Rule | Source/callers | Inputs covered | Current output/enforcement | Deterministic/AI; persisted | Missing/unknown behavior | Review status and defect |
| --- | --- | --- | --- | --- | --- | --- |
| RSTR-001 | `HealthValidationService.normalizeHealthInput`; onboarding/profile controllers | CC, CA | Exact case-insensitive common-list match or Gemini-normalized string; persists free text | AI-dependent except exact list; persisted | Service failure is `503`; semantic result trusted from AI | Not clinical validation; update sequence can partially persist enums before custom failure |
| RSTR-002 | Meal-generation library matching | EC, EA; no CC/CA/ING/AI | Excludes when non-`NONE` enum is absent from metadata array | Deterministic; read-only filter | Null metadata skips check and becomes eligible | DEF-024/025; unreviewed semantics |
| RSTR-003 | Meal-generation prompt | EC, CC, EA, CA | Sends restrictions to Gemini as hard rules | AI-dependent; generated plan persisted | AI compliance not deterministically proven | Warning/prompt only, not safety enforcement |
| RSTR-004 | Meal-generation confidence assignment | EC, AI | EC + estimated -> `NEEDS_REVIEW`; EC + FNRI -> `CAUTION`; otherwise `SAFE` | Deterministic; persisted | EA/CC/CA ignored; FNRI-unlinked not distinguished | DEF-026; not clinically reviewed |
| RSTR-005 | `lookupIngredient` | ING, AI | Exact/alias/contains FNRI lookup; otherwise Gemini estimate | DB + fuzzy + AI; provenance persisted by caller | Contains match can auto-create an alias; unresolved failure throws | Nutrient resolution is not allergen safety; fuzzy safety matching prohibited in proposal |
| RSTR-006 | `UserService.checkSafetyConflict` | EC (`DIABETES`, `HYPERTENSION`), EA, ING | Boolean keyword conflict | Deterministic; not persisted directly | Missing/custom/other conditions return no conflict | Fragmented unreviewed keyword rules; false-positive/negative risk |
| RSTR-007 | `runSafetyRecheck` after profile update | EC, EA, ING; AI fallback | Replaces conflict with library meal or Gemini pending meal; regenerates grocery and notifies | Mixed deterministic/AI; mutating | Null library metadata allowed; custom ignored; AI fallback is `CAUTION` | High-risk automatic workflow; medical rules unreviewed |
| RSTR-008 | Swap options, compatible library, swap execution | EC, EA; no CC/CA/ING/AI | Filters or rejects when metadata lacks exact enum key | Deterministic; execution persists | Null metadata allowed; JSON shape unchecked | Same gap repeated three times; DEF-024/025 |
| RSTR-009 | Outside-meal preview/confirmation | EC (`DIABETES`, `HYPERTENSION`), EA, AI-estimated ING | Keyword/estimated-threshold warnings; acknowledgement allows log | AI estimate + deterministic warnings; warning/log persisted | CC/CA ignored; AI ingredient list trusted; direct conflict can be acknowledged | Thresholds and keyword mappings unreviewed; preview identity DEF-018 |
| RSTR-010 | Nutritionist review detail warnings | EC, EA, ING, AI | `CRITICAL`/`IMPORTANT`/`NOTICE` warning list | Deterministic; response only | Custom restrictions absent; mismatched allergen keys silently produce no warning | DEF-023/025; thresholds unreviewed |
| RSTR-011 | Nutritionist approval -> library | EC, EA | Copies the reviewed user’s enum arrays into `suitableConditions`/`allergenFree` | Deterministic copy; persisted | Custom restrictions and ingredient safety evidence omitted | Tags describe one user context, not a proven universal compatibility set |
| RSTR-012 | Nutritionist rejection replacement | EC, EA | Sends enums and rejection reason to Gemini; replacement is `PENDING_REVIEW`/`CAUTION` | AI-dependent; persisted | Custom restrictions omitted; no deterministic post-check | Human review fallback exists, but restriction completeness is insufficient |
| RSTR-013 | Current-plan and grocery boundaries | None beyond Batch 3 plan actionability | Approved/current filter only | Deterministic; read/aggregation | No restriction re-evaluation after metadata/profile drift | Must consume future engine without weakening Batch 3 |
| RSTR-014 | Cron/automatic generation | Delegates to generation service | Same as RSTR-002 through RSTR-005 | Mixed; mutating when run | Unknown restrictions inherit generation gaps | Cron must default to review; not executed in Batch 4A |

## 7. Proposed normalization rules

Normalization produces a comparison key while retaining the original sanitized display string and provenance.

### 7.1 Safe mechanical normalization

1. Require a string and reject control characters and over-limit input.
2. Apply Unicode `NFKC` to the comparison copy; preserve the original display value.
3. Trim leading/trailing Unicode whitespace and collapse repeated internal whitespace.
4. Use locale-independent case folding for free-text comparison.
5. For enum-like tokens only, convert runs of spaces/hyphens/underscores to one underscore, uppercase, and require an exact allow-list match.
6. Deduplicate only identical normalized keys while preserving all source entries for audit/reason reporting.
7. Treat empty values as missing metadata, not `NONE`.
8. Make `NONE` exclusive; any coexistence with a positive enum or non-empty custom restriction is contradictory and requires review.

### 7.2 Not mechanical; requires explicit mapping approval

- Singular/plural conversion (`EGG` -> `EGGS`).
- Medical subtype/general-category conversion.
- Punctuation deletion that changes token boundaries.
- Ingredient synonyms, Filipino/English translations, brand/dish-to-ingredient implications, derivatives, and cross-contact claims.
- `WHEAT` -> `GLUTEN`, Peanuts/Tree Nuts -> `NUTS`, lactose intolerance -> `DAIRY`, or fish -> shellfish.
- Fuzzy/edit-distance/substring matching for restriction conflicts.

## 8. Semantic mappings requiring approval

| Candidate mapping | Current evidence | Proposed Batch 4B treatment | Decision needed |
| --- | --- | --- | --- |
| `PEANUTS`, `TREE_NUTS` -> `NUTS` | UI combines them; schema has only `NUTS`; common suggestions separate them | Do not map until approved; surface custom/unmapped as review | Owner chooses granularity; RND approves safety meaning |
| `EGG` -> `EGGS` | Singular warning key versus plural enum | May be an explicit alias after approval | Owner approves technical alias; RND approves ingredient scope |
| `WHEAT` -> `GLUTEN` | UI combines; schema says `GLUTEN`; warning map says `WHEAT` | Do not treat as equivalent | RND + owner |
| `FISH` | Custom suggestion; no enum | Keep `CUSTOM_ALLERGY` with exact key and review | Owner decides future first-class enum separately |
| `SOY` | Custom suggestion; no enum | Keep `CUSTOM_ALLERGY` with exact key and review | Owner decides future first-class enum separately |
| `DAIRY` and lactose intolerance | Allergy enum versus custom condition suggestion | Keep distinct | RND |
| Diabetes/CKD/heart subtypes -> broad enums | Common suggestions and broad schema keys | Keep custom/unmapped unless explicit mapping table is approved | RND + owner |
| `PREGNANT` -> pregnant/lactating | UI label only | Do not extend schema meaning implicitly | RND + owner |
| Ingredient keyword lists | Multiple inconsistent service lists | Treat as unreviewed evidence tables, not validated mappings | RND approves each canonical allergen/ingredient set |

## 9. Proposed pure restriction-engine contract

No persisted enum or schema field is added in Batch 4A.

```ts
type RestrictionDecision = 'ALLOW' | 'BLOCK' | 'REVIEW';
type ReviewState = 'SAFE' | 'CAUTION' | 'NEEDS_REVIEW';

interface RestrictionEvaluation {
  decision: RestrictionDecision;
  reviewState: ReviewState;
  blockingConflict: boolean;
  matches: Array<{
    category: 'ENUM_CONDITION' | 'CUSTOM_CONDITION' | 'ENUM_ALLERGY' | 'CUSTOM_ALLERGY';
    canonicalRestrictionKey: string;
    evidenceSource: 'SCHEMA_ENUM' | 'APPROVED_ALIAS' | 'INGREDIENT_NAME' | 'FOOD_ITEM' | 'LIBRARY_METADATA' | 'AI_ESTIMATE' | 'UNRESOLVED';
    reasonCode: string;
  }>;
  reasonCodes: string[];
  explanation: string; // sanitized, templated, no diagnosis
  metadataComplete: boolean;
  unknownOrCustomRestriction: boolean;
  estimatedOrUnresolvedIngredient: boolean;
}
```

Proposed stable reason codes:

- `NO_DECLARED_RESTRICTION_CONFLICT`
- `EXACT_ALLERGEN_CONFLICT`
- `REPOSITORY_CONDITION_RULE_MATCH`
- `CUSTOM_RESTRICTION_EXACT_MATCH`
- `CUSTOM_RESTRICTION_UNMAPPED`
- `MISSING_SAFETY_METADATA`
- `NULL_COMPATIBILITY_METADATA`
- `UNKNOWN_RESTRICTION_KEY`
- `UNKNOWN_METADATA_KEY`
- `AI_ESTIMATED_INGREDIENT`
- `UNRESOLVED_INGREDIENT`
- `CONTRADICTORY_METADATA`
- `NONE_WITH_POSITIVE_RESTRICTION`
- `MULTIPLE_RESULTS_MOST_RESTRICTIVE`

Precedence is `BLOCK` > `REVIEW` > `ALLOW`; `NEEDS_REVIEW` > `CAUTION` > `SAFE`. Unknown future values return `REVIEW`/`NEEDS_REVIEW`. AI evidence may increase uncertainty but cannot produce a deterministic `SAFE` or disprove a direct conflict.

## 10. Proposed decision matrix

| Scenario | Outcome | Block user action | Nutritionist review | Generation | Swap eligible | Outside log with acknowledgement | Clinical approval |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1. No declared restrictions; complete approved metadata | `ALLOW` / scoped `SAFE` | No | No | Continue | Yes | Yes | Owner approves scoped meaning of `SAFE` |
| 2. Known enum restriction; complete metadata; no conflict | `ALLOW` / `CAUTION` | No | Condition-specific policy may require it | Continue | Yes only with exact compatible metadata | Yes if no conflict | RND for condition rules |
| 3. Enum allergy with exact approved ingredient conflict | `BLOCK` / `NEEDS_REVIEW` | Yes | Yes | Reject candidate; continue search | No | No under conservative proposal | RND + owner workflow decision |
| 4. Health condition with repository incompatibility | Until reviewed: `REVIEW`; after RND approval, matched rule may `BLOCK` | Yes while unresolved | Yes | Continue only to another candidate/review queue | No | Only with explicit policy; undecided | RND required |
| 5. Custom restriction with exact approved mapping | Same as mapped canonical rule, with custom provenance | Depends on mapped rule | As mapped | As mapped | As mapped | As mapped | Alias and clinical rule approval |
| 6. Custom restriction without deterministic mapping | `REVIEW` / `NEEDS_REVIEW` | Yes for actionable plan/swap | Yes | May generate candidate but keep non-actionable pending review | No | Yes only if no direct conflict and uncertainty is acknowledged | Owner + RND |
| 7. Missing meal safety metadata | `REVIEW` / `NEEDS_REVIEW` | Yes | Yes | Candidate may be produced but not actionable | No | Yes only as explicitly uncertain outside log | Owner |
| 8. Null library compatibility metadata | `REVIEW` / `NEEDS_REVIEW` | Yes | Yes | Do not use as verified match | No | N/A | Owner |
| 9. AI-estimated ingredient | `REVIEW` / `NEEDS_REVIEW` | Yes for plan/swap until review | Yes | Persist only pending review | No | Yes with uncertainty acknowledgement unless direct conflict | Owner + RND |
| 10. Unresolved FNRI ingredient/link | `REVIEW` / `NEEDS_REVIEW` | Yes for plan/swap until resolved/reviewed | Yes | Continue only as pending review | No | Yes with uncertainty acknowledgement unless direct conflict | Owner |
| 11. Unknown future enum/status | `REVIEW` / `NEEDS_REVIEW` | Yes | Yes | Default deny/action queue | No | No automatic acceptance | Owner |
| 12. Contradictory metadata | `REVIEW` / `NEEDS_REVIEW` | Yes | Yes | Stop that candidate | No | No automatic acceptance | Owner; RND if medical conflict |
| 13. Multiple restrictions with different outcomes | Most restrictive result; include every reason | If any result blocks | If any result reviews/blocks | Continue only if final result permits | Only if final result permits | Only if final result permits | Underlying rule approvals |

## 11. Proposed caller/enforcement matrix

| Future caller | `ALLOW` | `REVIEW` | `BLOCK` | Required behavior |
| --- | --- | --- | --- | --- |
| Meal generation | Candidate may proceed | Persist `PENDING_REVIEW`; do not expose as current | Reject candidate and search again | Never let AI alone downgrade review/block |
| Current-plan availability | Available only if Batch 3 actionability also passes | Non-actionable; explain review reason | Non-actionable | Re-evaluate on relevant profile/metadata change |
| Nutritionist review | Show evidence/reasons | Prioritize and require resolution | Show blocking reasons | Include custom restrictions and provenance without exposing unrelated data |
| Approval | Permit only when no unresolved reason remains | Require reviewed resolution and documented outcome | Reject approval unless conflict is removed; no silent override initially | Owner must define override/audit policy |
| Meal swapping | Candidate eligible | Exclude | Exclude | Recheck again inside transaction before mutation |
| Outside-meal preview | Normal preview | Warning + uncertainty reasons | Direct-conflict stop screen | Preserve exact preview identity for confirmation |
| Outside-meal confirmation | Persist exact preview if permitted | Require acknowledgement if policy permits | Do not persist as an accepted meal log under conservative proposal | Product decision required for factual consumption tracking |
| Mid-plan profile changes | No change if still actionable | Quarantine affected meals for review | Remove from actionability and seek replacement | No auto-approval of replacement |
| Grocery generation | Include only engine-allowed, Batch-3-actionable plans | Exclude | Exclude | Never infer safety from a stored list without plan provenance |
| Planned-meal logging | Allow if plan remains actionable | Reject with review reason | Reject | Re-evaluate at mutation boundary |
| Automatic/cron workflows | Proceed | Queue review; no automatic exposure | Skip/quarantine and report | Unknown values default to review; no Gemini safety override |

## 12. TEST-015 and TEST-016 activation plan

Do not activate these tests until Batch 4B is approved and the owner decisions in section 14 are resolved.

### TEST-015: vocabulary and deterministic evaluation

1. Every exact `HealthConditionType` and `AllergenType` key parses without drift.
2. `NONE` is exclusive; coexistence with positive enum/custom values yields `CONTRADICTORY_METADATA`.
3. Enum conditions and allergies produce stable canonical keys and source categories.
4. Custom condition/allergy exact approved aliases retain custom provenance.
5. Unmapped custom restrictions yield `REVIEW`/`NEEDS_REVIEW`, never disappear.
6. Mechanical normalization covers Unicode normalization, trim, case, whitespace, hyphen/underscore enum forms, and exact deduplication.
7. Singular/plural and semantic aliases do not map unless present in the approved alias table.
8. `NUTS` does not match unrelated “nutrition”; `EGGS` does not match “eggplant”; fish does not map to shellfish.
9. Multiple restrictions return all reasons and most-restrictive precedence.
10. Reason-code strings remain stable and ordered deterministically.

### TEST-016: missing/unknown/AI metadata

1. Null `suitableConditions` or `allergenFree` -> `NULL_COMPATIBILITY_METADATA` and review.
2. Missing field/empty unreviewed metadata -> `MISSING_SAFETY_METADATA` and review.
3. Unknown future enum or JSON key -> review, never `SAFE`.
4. Non-array/contradictory JSON -> `CONTRADICTORY_METADATA` and review.
5. `GEMINI_ESTIMATED` ingredient -> `AI_ESTIMATED_INGREDIENT` and review.
6. Null `foodItemId`, including an `FNRI`-labelled row -> `UNRESOLVED_INGREDIENT` and review.
7. AI evidence cannot clear an exact deterministic conflict.
8. Complete metadata with no declared restrictions can return only the scoped `SAFE` meaning.
9. Missing metadata combined with another blocking conflict remains `BLOCK` while retaining missing-data reasons.
10. Unknown/custom restriction plus unresolved ingredient returns deterministic `REVIEW` with both reason codes.

Fixtures must be synthetic and include every enum, custom/unmapped inputs, null/empty/invalid JSON, FNRI-linked/unlinked, AI-estimated, multiple simultaneous restrictions, and false-positive strings.

## 13. Smallest proposed Batch 4B implementation

### Minimum required implementation

1. Add one pure backend policy module, proposed `src/domain/restriction-evaluation.policy.ts`, containing types, mechanical normalization, exact allow-lists, result aggregation, and reason codes.
2. Add synthetic fixtures and activate TEST-015/016 with only approved semantic/clinical mappings.
3. Replace duplicated library compatibility checks in meal generation, all swap paths, compatible-library retrieval, and safety recheck.
4. Add the evaluator to AI-plan confidence assignment, nutritionist review details/approval guard, planned logging, current retrieval, and grocery-generation plan selection.
5. Pass custom condition/allergy values and ingredient provenance to every caller.
6. Keep unknown/null/AI-unresolved outcomes non-actionable and reviewable without schema changes.
7. Preserve Batch 3 approved/current policy as an independent prerequisite.

### Compatibility concerns

- Existing 384 `FNRI`-labelled/unlinked ingredients and 126 estimated/unlinked ingredients would become review-triggering; rollout must measure affected approved/current plans without mutating them first.
- Existing library arrays cannot prove semantic completeness. A compatibility adapter must default them to review rather than reinterpret them.
- Outside-meal behavior and direct allergy-conflict logging require an owner decision before implementation.
- Nutritionist approval tags cannot be treated as universal claims without a defined review contract.
- No schema change is required for the minimum pure policy, but durable reason/audit metadata is an optional later design.

### Verification

- Focused TEST-015/016 unit cases first.
- Full backend `npm.cmd test` with external-service variables cleared.
- Backend/frontend TypeScript, Prisma validation, and frontend lint.
- Read-only API integration against existing negative-state data.
- Synthetic/disposable mutation tests only in an isolated database if separately authorized.
- Owner-assisted browser checks for reason display; no Gemini/SMTP/OAuth/PDF/cron needed for the deterministic core.

### Rollback unit

Revert the policy module, all caller adapters, activated tests, and documentation together. Do not partially revert individual callers to their previous permissive logic.

### Optional later improvements

- Normalized library ingredients and explicit safety-metadata provenance/version/completeness.
- First-class custom restriction records and reviewed alias tables.
- Persisted structured reason/audit records.
- Schema enum expansion for product-approved allergens.
- Removal of fuzzy FNRI alias mutation and ingredient-provenance cleanup.

## 14. Exact owner and clinical decisions required

1. Approve the contract (`ALLOW`/`REVIEW`/`BLOCK` plus existing confidence flags), precedence, stable reason codes, and the restricted meaning of `SAFE`.
2. Approve the mechanical normalization rules and explicit prohibition on fuzzy clinical matching.
3. Decide whether `NONE` must be rejected when any positive enum/custom restriction exists.
4. Decide the semantic alias candidates in section 8 individually; no candidate is approved by this document.
5. Decide whether null and empty library arrays both mean incomplete/unreviewed for Batch 4B.
6. Decide whether a direct deterministic allergy conflict prevents outside-meal logging or permits factual logging under a distinct blocked/acknowledged workflow.
7. Decide whether nutritionists may override `BLOCK`, and if so the required evidence, reason, audit trail, and expiry/recheck behavior.
8. Obtain licensed RND approval or rejection for every current nutrient threshold, keyword/dish mapping, condition incompatibility, pregnancy/lactation rule, and user-facing “safe/unsafe” claim before enabling it as a medical rule.
9. Decide whether `FISH`, `SOY`, separate peanut/tree-nut concepts, wheat allergy, and lactation need future first-class schema vocabulary; that schema decision is outside Batch 4B minimum scope.
10. Approve Batch 4B separately after reviewing the affected-caller list and compatibility impact. No implementation is authorized by Batch 4A.

## 15. Batch 4B1 approved pure-policy implementation

The owner approved only the pure deterministic portion of the earlier Batch 4B proposal. The implemented module is `nutrimind-backend/src/domain/restriction-evaluation.policy.ts`. It has no production callers and does not change API, database, generation, swap, grocery, logging, review, cron, or frontend behavior.

### 15.1 Implemented contract and precedence

`evaluateRestrictions` returns `decision`, `reviewState`, `blockingConflict`, structured `matches`, ordered `reasonCodes`, a templated `explanation`, `metadataComplete`, `unknownOrCustomRestriction`, `estimatedOrUnresolvedIngredient`, and sanitized normalized restriction provenance. Precedence is `BLOCK > REVIEW > ALLOW`.

`SAFE` has only this scoped meaning: “No deterministic conflict was found within the complete evidence supplied to this evaluation.” The full template explicitly states that this does not establish medical, clinical, nutritionist, or universal safety.

Mechanical normalization is limited to Unicode NFKC, whitespace trim/collapse, locale-independent uppercase conversion, spaces/hyphens/underscores as enum separators, exact allow-list membership, and identical-normalized-key deduplication. No fuzzy, substring, similarity, dish implication, translation, AI synonym, or unapproved semantic mapping exists.

### 15.2 Approved aliases and conservative defaults

Only `PEANUTS -> NUTS`, `TREE_NUTS -> NUTS`, and `EGG -> EGGS` are implemented, with supplied alias provenance retained. `WHEAT`, `FISH`, `SOY`, lactose intolerance, lactation, condition subtypes, dish names, translations, partial words, and similar spellings remain custom/unknown and require review.

`NONE` is exclusive. Coexistence with a positive enum or custom restriction returns stable contradiction reasons and requires review unless a separately established exact allergy conflict raises the result to `BLOCK`.

Null, missing, malformed, unknown, contradictory, and legacy-empty safety metadata are incomplete. Gemini-estimated, unresolved, unlinked, missing, or unknown-source ingredient evidence requires review. Known conditions always require review because Batch 4B1 adds no approved medical rule. Exact approved allergy conflicts block; a known allergy with complete non-conflicting evidence returns only `ALLOW`/`CAUTION`.

### 15.3 Stable reason-code order

The exported order is:

1. `EXACT_ALLERGEN_CONFLICT`
2. `NONE_WITH_POSITIVE_RESTRICTION`
3. `CONTRADICTORY_RESTRICTIONS`
4. `CONTRADICTORY_METADATA`
5. `MALFORMED_RESTRICTION_INPUT`
6. `UNKNOWN_RESTRICTION_KEY`
7. `CUSTOM_RESTRICTION_UNMAPPED`
8. `MISSING_SAFETY_METADATA`
9. `NULL_COMPATIBILITY_METADATA`
10. `MALFORMED_SAFETY_METADATA`
11. `LEGACY_EMPTY_SAFETY_METADATA`
12. `INCOMPLETE_SAFETY_METADATA`
13. `MISSING_INGREDIENT_EVIDENCE`
14. `UNKNOWN_METADATA_KEY`
15. `AI_ESTIMATED_INGREDIENT`
16. `UNRESOLVED_INGREDIENT`
17. `UNREVIEWED_CONDITION_RULE`
18. `KNOWN_CONDITION_REQUIRES_REVIEW`
19. `KNOWN_ALLERGY_NO_CONFLICT`
20. `NO_DETERMINISTIC_CONFLICT_COMPLETE_EVIDENCE`
21. `MULTIPLE_RESULTS_MOST_RESTRICTIVE`

### 15.4 Verification and remaining boundary

TEST-015 and TEST-016 are active through 31 synthetic `node:test` cases. They cover all actual enums, approved/rejected mappings, normalization and false-positive prevention, metadata/provenance uncertainty, contradictions, precedence, deterministic repeated output, fixed explanations, and sanitization. No live database, Prisma client, HTTP, Gemini, or other external service is used.

This Batch 4B1 boundary was subsequently fulfilled only through the separately approved Batch 4B2 read-only generation-library adapter documented below. All other production integration remains deferred.

## 16. Batch 4B2 meal-generation library compatibility adapter

Status: Implemented and unit/statically verified for meal-generation library candidate selection only; no live generation, database mutation, or external call was performed.

### 16.1 Adapter and evidence mapping

`nutrimind-backend/src/domain/meal-generation-library-compatibility.adapter.ts` receives already-loaded user restrictions and candidate evidence. It performs no Prisma query, mutation, logging, environment access, clock access, or external call. It exports the adapter result/types, `evaluateMealGenerationLibraryCompatibility`, `filterEligibleMealGenerationLibraryCandidates`, and the injected `runMealGenerationFallbackForUnmatchedSlots` seam.

Evidence supplied by the generation caller:

| Evidence | Source | Availability and treatment |
| --- | --- | --- |
| Enum conditions/allergies | `User.healthConditions` / `User.allergies` | Direct arrays; passed unchanged to the Batch 4B1 policy |
| Custom conditions/allergies | `UserProfile.otherConditions` / `otherAllergies` | Direct nullable comma-stored strings; split mechanically, with original entries normalized/sanitized by the policy |
| Library status | `MealLibrary.status` | Direct; query remains approved-only and adapter independently requires exact `APPROVED` |
| Applicable conditions | `MealLibrary.suitableConditions` | Direct nullable/untyped JSON; validated structurally and passed as unreviewed condition-rule evidence |
| Excluded allergies | `MealLibrary.allergenFree` | Direct nullable/untyped JSON compatibility claim; used only to confirm coverage when separate explicit evidence exists, never inverted into a detected allergen |
| Ingredient provenance/linkage | historical `MealPlan.ingredients` relation | Available through an existing read-only relation; FNRI/Gemini provenance and `foodItemId` linkage are passed to the policy |
| Explicit safety completeness | No current schema field | Missing in production legacy rows; never fabricated, so those rows evaluate to `REVIEW` |
| Direct detected-allergen evidence | No current schema/library ingredient field | Missing in production legacy rows; meal names and ingredient names are not interpreted |
| Cross-contact/version/review basis | No current schema field | Missing; nutritionist linkage does not substitute for it |

The adapter returns eligibility, the full restriction evaluation, stable reason codes, templated explanation, and metadata-completeness state. Eligibility requires exact approved status plus `ALLOW`, complete evidence, no blocking conflict, no unresolved normalized restriction, and no estimated/unresolved ingredient.

### 16.2 Eligibility matrix

| Candidate/evaluation state | Automatic generation-library eligibility |
| --- | --- |
| `APPROVED`, explicit complete evidence, `ALLOW/SAFE` | Eligible |
| `APPROVED`, exact resolved allergy alias, complete non-conflicting evidence, `ALLOW/CAUTION` | Eligible |
| `REVIEW/NEEDS_REVIEW` for condition, custom/unknown, incomplete, estimated, or unresolved evidence | Ineligible; existing unmatched-slot fallback continues |
| `BLOCK/NEEDS_REVIEW` exact allergy conflict | Ineligible; existing unmatched-slot fallback continues |
| `FLAGGED`, unknown, malformed, or any non-`APPROVED` status | Ineligible regardless of an otherwise ALLOW evaluation |
| Legacy null/missing/malformed/empty compatibility arrays without explicit completeness | Ineligible |

### 16.3 Generation caller behavior

Only `MealGenerationService.generate7DayPlan` changed. The approved-only query now loads historical source-plan ingredient provenance. Every queried candidate is evaluated once before existing meal-type, dietary-tag, goal, usage-count, and random variant selection. The former inline `suitableConditions`/`allergenFree` predicates were removed.

All unmatched slots still enter one existing Gemini fallback batch. Prompt content, model call, FNRI resolution, transaction boundaries, usage increments, notifications, and `PENDING_REVIEW` persistence remain unchanged. The injected fallback seam exists only to prove call count and slot completeness without importing or calling Gemini in tests.

### 16.4 Existing-record impact and limitations

The earlier privacy-safe aggregate profile found two approved library records with structurally present arrays, one with both arrays empty, and zero records whose semantic completeness can be certified from the schema. Therefore both existing records are expected to be automatically excluded by this adapter: the empty-array record lacks completeness evidence, and the non-empty record still lacks an explicit completeness marker/direct detected-allergen evidence. Any slots they would otherwise fill are expected to follow the existing Gemini fallback. This is a source-based expectation; live generation was intentionally not run.

TEST-027 provides 18 active adapter cases and TEST-028 provides 9 active filtering/fallback cases. The full backend result is 91 registered, 86 pass, 0 fail, 0 skipped, and 5 TODO. The tests use synthetic fixtures and injected callbacks only.

Remaining production integration gaps include swaps, compatible-library APIs, current plans, grocery, planned/outside logging, nutritionist review/approval, profile rechecks/replacement, confidence assignment, and cron. None imports this adapter.

## 17. Batch 4B3 authoritative library-evidence design

Status: Designed and documented only; no schema, migration, production, test, API, frontend, database-record, or adapter behavior changed.

The Batch 4B2 adapter intentionally expects explicit evidence that the current schema cannot provide. Batch 4B3 inspected the complete `MealLibrary`/`MealPlan`/ingredient relationship, every relevant migration, nutritionist approval/edit/flag/delete paths, route authority, library/review UI, and the generation adapter's historical-plan dependency. The authoritative design is recorded in `docs/NUTRIMIND_LIBRARY_SAFETY_EVIDENCE_DESIGN.md`.

The proposed lifecycle is independent `INCOMPLETE`, `COMPLETE`, and `STALE` evidence. Legacy rows default to incomplete and are never auto-certified. Completeness requires explicit reviewed-none/declaration states, first-class library-owned ingredients with complete FNRI nutrition linkage, one exact evidence revision/version, and certification by a currently verified nutritionist with a current license. FNRI linkage is not allergen evidence. Direct allergen declarations come only from structured nutritionist review; dish names, ingredient text, translations, fuzzy matching, and AI inference are prohibited as substitutes. Cross-contact defaults to `NOT_ASSESSED` and keeps positive-allergy candidates in review.

Material edits and flags invalidate complete evidence; dismissing a flag does not restore it. Safety review authority is separate from original library ownership, and an append-only review history is proposed. The existing adapter/fallback remains unchanged until the additive schema, migration, strict write workflow, UI, and focused tests are separately approved and implemented.

TEST-029 records the aggregate-only, explicit read-only profile: 2 legacy library rows, both linked to nutritionist profiles, 1 with historical ingredients, 0 whose combined historical ingredients are fully FNRI-linked, 1 with unlinked ingredients, and 0 database records changed. Neither existing row can be safely auto-backfilled as complete.

## 18. Batch 4B4 additive evidence-lifecycle migration

Status: Implemented and deployed to the owner-confirmed shared capstone development/demo database; no policy, adapter, API, frontend, or certification-write behavior changed.

The schema now persists `INCOMPLETE | COMPLETE | STALE`, `LEGACY_UNREVIEWED | NUTRITIONIST_DRAFT | NUTRITIONIST_REVIEW`, explicit condition/allergen declaration-review states, and the three accepted cross-contact assessment states. It also persists revision/version, a distinct optional `NutritionistProfile` safety reviewer, review/invalidation timestamps/reason, and `updatedAt`. The additive migration gives both existing rows conservative legacy defaults and gives future library creation `INCOMPLETE` plus `NUTRITIONIST_DRAFT`; no row was certified or made adapter-eligible.

TEST-030 verified clean migration history and pre-deployment schema parity, SQL free of destructive/data-rewrite statements, successful deployment, post-deployment migration/schema parity, exact privacy-safe count/hash preservation, and the complete legacy-default aggregate. All 91 backend tests remain registered with 86 passing and 5 documented TODOs; backend/frontend no-emit checks pass; frontend lint passes with pre-existing warnings. Batch 4B2 intentionally still omits authoritative lifecycle evidence from its candidate input, so every current legacy/incomplete row remains default-deny and uses the established fallback.

The lifecycle columns are only a persistence foundation. They cannot produce `COMPLETE` safely without first-class library-owned ingredients and declarations, immutable review history, verified/unexpired-nutritionist authorization, atomic revision/certification/invalidation writes, client regeneration and explicit API serializers, reviewed UI wording, and a separately approved adapter revision. Forward corrective migration is the recovery strategy; destructive rollback is outside this batch.
