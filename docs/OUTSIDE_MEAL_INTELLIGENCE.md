# Outside Meal Intelligence and Review

Status: implemented on `feature/outside-meal-intelligence`; all migrations plus deterministic and live-Gemini service/reviewer journeys pass against a disposable loopback-only PostgreSQL database. The migration has not been applied to a shared database, and an authenticated browser journey remains pending.

## Decision

Outside-meal logging is an item-level evidence workflow, not a single opaque AI total. A comma separates foods; ordinary spaces and the word `and` remain part of a food name. A measured FNRI portion can be written as `rice (150g)` or `rice - 150g`.

Resolution order is fixed:

1. An exact, currently approved and safety-certified Meal Library recipe compatible with the user's recorded profile.
2. An exact alias or strong FNRI match when the user supplies a measured gram portion. FNRI values are treated as per-100 g composition and scaled to that portion.
3. User-entered nutrition-label or menu values, identified as user-reported rather than verified.
4. Gemini estimation for unresolved items only, with current server-side Premium entitlement and quota checks.
5. Unresolved, stored with nullable item nutrition and excluded from totals. It is never presented as a zero-calorie resolution.

The Free tier retains verified-library, FNRI, manual-label logging, warnings, and nutritionist notifications. Premium AI estimation is capped at five items per Manila day and thirty items per rolling thirty-day period. A successful AI request consumes quota even if the user does not confirm the preview, because provider capacity was consumed.

## Tracker behavior

Reference and user-reported values count immediately. AI estimates also count immediately, but their calories are separately recorded as provisional. The parent `MealLog` stores the effective aggregate for existing dashboard/history consumers; item rows retain source, portion, compatibility, uncertainty range, and current nutrition state.

Unresolved items are excluded from the aggregate, and the log is marked `PARTIAL` or `UNRESOLVED`. Nutrition verification and compatibility are separate fields: a nutrient figure can be resolved while ingredient-level compatibility remains unknown.

## Review and correction

Every Gemini item creates a risk-prioritized `OutsideMealReview`. Verified nutritionists acquire a thirty-minute compare-and-set claim before deciding. They may:

- verify the estimate;
- replace all four displayed macros with a correction; or
- request more information.

Each decision appends an immutable `OutsideMealItemRevision`. A verify/correct decision updates the effective item, recomputes the parent aggregate transactionally, and notifies the owner that their tracker changed. The initial AI revision remains available for audit.

## Safety and limitations

Heuristic name/ingredient warnings are conservative prompts, not medical determinations. Only exact, current safety-certified library matches can receive `NO_KNOWN_CONFLICT`; FNRI and user-reported nutrition do not establish ingredient-level compatibility. The implementation must not be described as clinically reviewed until that separate evidence exists.

The migration is additive. It must be reviewed and applied to the intended database before this feature can run. No migration is automatically applied by application startup.

## Local acceptance evidence

`npm run test:acceptance:outside-meal-local` is guarded to run only against `127.0.0.1:55461/nutrimind_outside`. It proves measured FNRI scaling, manual-label aggregation, unresolved-item exclusion, preview replay/collision protection, one-time confirmation, database integrity constraints, Free-tier AI denial, provisional review creation, exclusive nutritionist claims, immutable correction revisions, parent-total recalculation, audit evidence, and user notification. It makes no provider request by default. With `OUTSIDE_MEAL_ACCEPTANCE_USE_GEMINI=1` and a locally supplied key, it additionally proves Premium entitlement, one live estimate, quota accounting, provisional persistence, review creation, and nutritionist verification without embedding credentials in the repository.
