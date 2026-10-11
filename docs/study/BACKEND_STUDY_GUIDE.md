# KAINARA Backend Study Guide

**System:** KAINARA — AI-Powered Personalized Nutrition and Meal Planning System

**Study baseline:** repository commit `32f67b99f0326641b2872ae17d3355a8750b1db0`

**Guide date:** October 11, 2026

**Scope:** Express, TypeScript, Prisma, PostgreSQL, authentication, nutrition planning, clinical-review workflow, tracking, and audit behavior

## 1. How to use this guide

This guide explains how the backend is organized and how a request moves from HTTP entry to persisted state. It is a study aid, not a claim that every intended behavior has passed runtime, deployment, or clinical validation.

Use these evidence levels while reading:

- **Implemented:** behavior visible in executable source code.
- **Statically verified:** supported by type checks or source-level tests recorded in the engineering record.
- **Runtime verified:** exercised by a dated runtime or browser test recorded in the engineering record.
- **Clinically validated:** requires an appropriately qualified human review. Software tests do not establish this level.

The current evidence ledger is [`NUTRIMIND_ENGINEERING_RECORD.md`](../NUTRIMIND_ENGINEERING_RECORD.md). The dated [`Synthetic User-Flow Test Report — October 11, 2026`](../SYNTHETIC_USER_FLOW_TEST_REPORT_2026-10-11.md) records the associated verification scope and limitations: ordinary-login browser runs are navigation/layout smoke checks against the development API, while isolated browser acceptance uses seeded actors with fixture tokens against dedicated APIs. Neither test layer establishes clinical validation. Contributor commands and environment setup are in the repository [`README.md`](../../README.md).

## 2. Backend at a glance

The backend is an Express application written in TypeScript. Prisma maps domain operations to PostgreSQL. Most authenticated requests follow this shape:

```text
Browser request
    |
    v
Express app and global middleware
    |
    v
Route validation and role/prerequisite guards
    |
    v
Controller or route handler
    |
    v
Domain service and policy checks
    |
    v
Prisma transaction / PostgreSQL
    |
    +--> notification, audit, FNRI, or AI integration when required
    |
    v
JSON response with a request identifier
```

Important entry points:

- [`backend/src/server.ts`](../../backend/src/server.ts) starts the HTTP server after environment setup.
- [`backend/src/app.ts`](../../backend/src/app.ts) creates the Express application, installs middleware, mounts routers, and exposes health/readiness endpoints.
- [`backend/src/config/env.ts`](../../backend/src/config/env.ts) parses and validates runtime configuration.
- [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) is the authoritative physical data model.

## 3. Repository map

| Area | Responsibility | Starting point |
|---|---|---|
| `controllers/` | Translate HTTP input into service calls and format responses | [`auth.controller.ts`](../../backend/src/controllers/auth.controller.ts) |
| `routes/` | URL definitions, validators, authentication, role and prerequisite middleware | [`auth.routes.ts`](../../backend/src/routes/auth.routes.ts), [`meals.routes.ts`](../../backend/src/routes/meals.routes.ts) |
| `services/` | Business workflows, transactions, state transitions and integrations | [`meal-generation.service.ts`](../../backend/src/services/meal-generation.service.ts) |
| `middleware/` | Authentication, authorization, throttling, request validation and member gates | [`auth.ts`](../../backend/src/middleware/auth.ts) |
| `domain/` | Reusable rules and policies without HTTP concerns | [`backend/src/domain`](../../backend/src/domain) |
| `lib/` | Shared clients and infrastructure helpers | [`backend/src/lib`](../../backend/src/lib) |
| `prisma/` | Schema, migrations and controlled data tooling | [`backend/prisma`](../../backend/prisma) |
| `tests/` | Unit, integration-style and policy tests | [`backend/tests`](../../backend/tests) |

The intended layering is route → validation/guards → controller → service → Prisma. Some older or compact routes call a service or Prisma directly, so trace the actual import chain instead of assuming every endpoint has all five layers.

## 4. Application startup and global middleware

[`app.ts`](../../backend/src/app.ts) establishes global behavior before feature routers run. The order matters:

1. Security headers are applied with Helmet.
2. CORS evaluates the request origin against configured allowed origins.
3. Cookies and JSON/form request bodies are parsed.
4. A request identifier and request logging context are created.
5. Cache-control behavior is applied to sensitive API responses.
6. Authentication context can be resolved before global rate limiting and live-update processing.
7. Feature routers are mounted under `/api/...`.
8. Health and readiness routes expose process and dependency status.
9. Error handling converts failures into the API's response shape without leaking internal details.

### Configuration detail worth remembering

The current CORS parser in [`env.ts`](../../backend/src/config/env.ts) reads `CORS_ORIGINS`. In production, an empty setting produces an empty allowlist; in development, local origins are supplied. The implementation does **not** currently derive this list from `FRONTEND_URL`. When diagnosing a deployed cross-origin failure, inspect `CORS_ORIGINS` first.

Environment feature flags include deployment mode, memberships, and clinical clarifications. A feature flag changes route/service behavior; it is not evidence that the corresponding migration or deployment is healthy.

## 5. Authentication and session lifecycle

### 5.1 Main endpoints

[`auth.routes.ts`](../../backend/src/routes/auth.routes.ts) defines registration, password login, Google identity continuation, email verification, OTP resend, password reset, refresh, and logout endpoints. Input validators and endpoint-specific rate limits are attached before controllers run.

### 5.2 Password or Google sign-in

```text
Credentials or Google identity token
    -> route validation
    -> authentication service
    -> user and credential checks
    -> short-lived access token in JSON
    -> persisted refresh session
    -> HttpOnly refresh cookie
```

The browser sends the access token as `Authorization: Bearer <token>`. The refresh token is not exposed to frontend JavaScript; it is stored in the `nutrimind_refresh` HttpOnly cookie. The legacy cookie name is an internal identifier and does not change the public KAINARA product name.

### 5.3 Access-token authentication

[`middleware/auth.ts`](../../backend/src/middleware/auth.ts) verifies the bearer token, then loads live user/profile state. This live lookup is important because a previously issued token must not override a current suspension or changed account state.

### 5.4 Refresh rotation

Refresh sessions are persisted as hashes rather than raw tokens. A successful refresh rotates the session and returns a new access token. Database unavailability is treated differently from a rejected credential: a transient dependency failure should not be confused with proof that the user's cookie is invalid.

### 5.5 Authorization

[`middleware/rbac.ts`](../../backend/src/middleware/rbac.ts) enforces allowed roles such as `USER`, `NUTRITIONIST`, and `ADMIN`. Authentication answers “who is calling?”; role-based access answers “may this role enter this route?”; resource ownership checks inside services answer “may this caller act on this specific record?”

## 6. Member prerequisite chain

Role membership alone is not enough to generate or use a plan. [`userPrerequisites.ts`](../../backend/src/middleware/userPrerequisites.ts), [`clinicalEvidenceReady.ts`](../../backend/src/middleware/clinicalEvidenceReady.ts), and [`planning-readiness.service.ts`](../../backend/src/services/planning-readiness.service.ts) combine several gates:

```text
Authenticated USER
    -> verified email
    -> completed onboarding
    -> current Terms and Privacy consent
    -> sufficient current clinical/profile evidence
    -> no unresolved blocking clarification or proposal
    -> current nutrition report acknowledged
    -> membership entitlement when enabled
    -> planning action permitted
```

These checks should stay server-authoritative. A hidden frontend button is useful user experience, but it is not a security or clinical-safety boundary.

## 7. Profile review, clarifications and proposals

The clinical clarification workflow exists because an RND may need more information without directly editing a member's answers.

Key files:

- [`clinical-clarification.routes.ts`](../../backend/src/routes/clinical-clarification.routes.ts)
- [`clinical-clarification.service.ts`](../../backend/src/services/clinical-clarification.service.ts)
- [`planning-readiness.service.ts`](../../backend/src/services/planning-readiness.service.ts)

### 7.1 Clarification flow

1. An eligible nutritionist claims or opens the relevant review context.
2. The nutritionist publishes a clarification question tied to a particular profile or meal-review context.
3. The member submits an immutable response version.
4. If the member answers again, only the latest valid response can be resolved as current.
5. The nutritionist resolves the clarification, with the expected revision/context checked again in the transaction.
6. Notifications identify the workflow without copying sensitive question or answer text.
7. Audit events record the state transition.

A clarification answer does not silently mutate the member's profile.

### 7.2 Profile correction proposal flow

1. The RND proposes explicit profile changes and provides the member-facing explanation required by the workflow.
2. The proposal is bound to the profile revision it was based on.
3. The member either acknowledges/applies the proposal or requests correction.
4. Acceptance applies the recorded changes in a transaction and advances relevant revisions.
5. Dependent reports or reviews can become stale and are invalidated as required.
6. A fresh planning confirmation or guidance acknowledgment remains a separate step.

This separation preserves member agency and prevents “RND suggested a change” from being treated as “member has already accepted and confirmed the new planning facts.”

## 8. Nutrition reports and planning baseline

[`nutrition-report.service.ts`](../../backend/src/services/nutrition-report.service.ts) maintains versioned reports and the active planning baseline.

Core ideas:

- Reports are versioned rather than overwritten in place.
- The current report is bound to profile/safety context.
- Material profile or evidence changes can invalidate an earlier acknowledgment.
- Member acknowledgment includes the expected report version and profile revision, protecting against stale-tab acceptance.
- Deterministic guidance policy is separated from generative wording where possible.

Acknowledging a report records informed workflow consent; it does not establish medical diagnosis, treatment, or clinical validation.

## 9. Meal-plan generation pipeline

Key files:

- [`meals.routes.ts`](../../backend/src/routes/meals.routes.ts)
- [`meal-generation.service.ts`](../../backend/src/services/meal-generation.service.ts)
- [`meal-plan-composition.service.ts`](../../backend/src/services/meal-plan-composition.service.ts)
- [`meal-library-candidate-query.service.ts`](../../backend/src/services/meal-library-candidate-query.service.ts)
- [`meal-library-slot-selection.service.ts`](../../backend/src/services/meal-library-slot-selection.service.ts)

### 9.1 Request and readiness

The generate endpoint authenticates the member, evaluates prerequisite/planning readiness, determines the appropriate cycle window, and creates or reuses an idempotent generation job. Generation may represent a full weekly cycle, a starter window, or a partially completed plan that continues filling.

### 9.2 Candidate sources

The composition layer combines controlled sources:

1. Eligible nutritionist-certified meal-library candidates.
2. Recipes or food facts linked to bounded FNRI identifiers.
3. USDA fallback data when applicable.
4. Gemini generation for unmatched slots, subject to structured validation and safety/review states.

Gemini is not granted database access. The application selects and validates the context supplied to external AI.

### 9.3 Persistence and progress

A `MealPlanCycle` groups dated planning work. Individual scheduled slots are persisted as `MealPlan` records. Generation jobs and reservations protect against duplicated work and concurrent requests. A plan may be returned while some slots are incomplete; status and retry endpoints let the frontend show progress rather than pretending the complete 21-slot result already exists.

### 9.4 Safety and review status

Each composed meal carries safety/review information derived from recorded profile context, food data, validation policy, and review workflow. “Generated” is not equivalent to “nutritionist approved.” Meal actions should respect the current status and any stale-context invalidation.

## 10. Nutritionist review and exact-context reference evidence

Key files:

- [`nutritionist-approval.service.ts`](../../backend/src/services/nutritionist-approval.service.ts)
- [`reusable-review-reference.service.ts`](../../backend/src/services/reusable-review-reference.service.ts)
- [`reusable-review-reference.policy.ts`](../../backend/src/domain/reusable-review-reference.policy.ts)

Review operations use claim ownership, expected context keys, and transaction-time checks to prevent two reviewers or a stale browser from silently deciding against different facts.

The system may display a prior review as **reference evidence** when an HMAC/hash confirms that the recorded profile, clinical facts, clarifications, and serving digest exactly match. That reference:

- exposes only permitted reviewer attribution and numeric plate facts;
- excludes private member details;
- excludes disputed, rejected, flagged, or outdated records;
- helps the current reviewer understand prior evidence;
- still requires a separate current review decision.

An exact match is therefore not automatic cross-member clinical approval or clinical clearance.

## 11. Daily tracking, progress and groceries

### Scheduled meals

[`scheduled-meal-log.service.ts`](../../backend/src/services/scheduled-meal-log.service.ts) allows a member to log only an owned, loggable, cleared scheduled meal. The transaction upserts the meal log and recalculates the aggregate `DailyNutritionLog`.

### Outside meals

[`meal-log.service.ts`](../../backend/src/services/meal-log.service.ts) records food consumed outside the plan. Nutrient estimation and contraindication warnings can use FNRI and constrained AI assistance. Warnings support informed review; they are not a diagnosis.

### Weight and check-ins

[`progress.service.ts`](../../backend/src/services/progress.service.ts) stores weight entries and can advance profile/calorie-target revisions. [`checkin.service.ts`](../../backend/src/services/checkin.service.ts) records version-checked weekly check-ins and can publish adaptation/report state. Automatic calorie adjustment is not assumed merely because a check-in exists.

### Water

[`water.service.ts`](../../backend/src/services/water.service.ts) persists `WaterLog` records by user and timestamp and calculates the current Manila day for today/remove/reset operations. This is user-scoped server data, not only browser-local state.

### Groceries

The grocery service aggregates planned ingredients into categorized records and supports checklist operations and a PDF route. Review current implementation and dated evidence before claiming complete quantity/unit fidelity or production PDF behavior.

## 12. Administration and audit history

[`admin-audit.routes.ts`](../../backend/src/routes/admin-audit.routes.ts) and the audit services expose filtered administrator/RND histories, related case activity, detail views, sensitive-access/annotation controls, subscription history, and meal-log views.

Audit records are append-oriented evidence of actions and context. They should not be rewritten to match the latest state. Analytics code also distinguishes “metric unavailable” from a real numeric zero; silently coercing missing data to zero would produce a misleading dashboard.

## 13. Data-model orientation

The physical schema is in [`schema.prisma`](../../backend/prisma/schema.prisma). A useful conceptual grouping is:

| Domain | Representative records |
|---|---|
| Identity | `User`, `Profile`, `NutritionistProfile`, `RefreshSession` |
| Clinical/profile review | `ClinicalProfileReview`, clarification forms/responses/resolutions, profile proposals |
| Guidance | `NutritionReport` and immutable/versioned report records |
| Planning | `MealPlanCycle`, `MealPlanGenerationJob`, `MealPlan` |
| Review evidence | `MealPlanReviewDecision`, `MealReviewReference`, `MealLibrary` |
| Tracking | `MealLog`, `DailyNutritionLog`, weight/check-in records, `WaterLog` |
| Shopping | grocery and grocery-item records |
| Governance | `AuditEvent`, notifications, membership/subscription records |

Do not infer a relationship from a diagram alone. Confirm the Prisma relation, nullability, unique constraints, indexes, and transaction behavior.

## 14. External integrations and failure boundaries

| Integration | Purpose | Defensive principle |
|---|---|---|
| PostgreSQL/Neon | Durable application state | Use transactions, revision checks and unique constraints; surface dependency failure accurately |
| Google Gemini | Structured assistance for reports/meals/estimation | Supply bounded context, validate structured output, retain non-AI rules and review gates |
| FNRI dataset | Philippine food composition data | Preserve source identifiers and deterministic lookup/fallback behavior |
| USDA data | Secondary food-data fallback | Distinguish source and verify normalized nutrient units |
| SMTP | OTP and account email | Avoid returning sensitive delivery details in API errors |
| Google Identity | OAuth identity assertion | Verify token audience/issuer before local account continuation |
| React PDF | Server-side exports | Treat successful template creation separately from deployed streaming verification |

Provider availability is not under application control. Graceful degradation, retry policy, and truthful user-visible state are part of correctness.

## 15. Testing and evidence discipline

Common backend checks are listed in [`README.md`](../../README.md). Tests cover policies, services, route behavior and guarded database workflows, but the exact accepted evidence for a change belongs in [`NUTRIMIND_ENGINEERING_RECORD.md`](../NUTRIMIND_ENGINEERING_RECORD.md).

When recording a result, state:

1. exact command;
2. date and environment;
3. database/provider mode;
4. test scope and account fixture;
5. passed, failed, skipped, or not run;
6. known gaps.

Do not convert “the service has code for this” into “production verified,” and do not convert synthetic software checks into clinical validation.

## 16. Guided code-tracing exercises

### Exercise A: Trace login and refresh

1. Start at [`auth.routes.ts`](../../backend/src/routes/auth.routes.ts).
2. Follow the login controller into the authentication modules.
3. Find where access and refresh tokens are issued.
4. Find where the refresh-session hash is persisted.
5. Follow a later bearer request through [`auth.ts`](../../backend/src/middleware/auth.ts).
6. Explain why authentication, role authorization and resource ownership are three separate checks.

### Exercise B: Trace a plan-generation request

1. Find the generate route in [`meals.routes.ts`](../../backend/src/routes/meals.routes.ts).
2. List every middleware/gate before generation.
3. Follow readiness into [`planning-readiness.service.ts`](../../backend/src/services/planning-readiness.service.ts).
4. Follow the job into [`meal-generation.service.ts`](../../backend/src/services/meal-generation.service.ts).
5. Identify the cycle, job, reservation, scheduled meal and review records involved.
6. Find how a partial result is reported and retried.

### Exercise C: Trace a profile proposal

1. Start at [`clinical-clarification.routes.ts`](../../backend/src/routes/clinical-clarification.routes.ts).
2. Identify the RND eligibility and expected-revision checks.
3. Find the immutable member response/proposal state.
4. Find the acceptance transaction and dependent invalidation.
5. Explain why a new planning acknowledgment is separate.

## 17. Review questions

1. Why is a live user lookup still needed after a JWT signature is valid?
2. What race does an expected profile revision prevent?
3. Why are clarification answers immutable and versioned?
4. What is the difference between a meal-library candidate, a scheduled `MealPlan`, and a `MealLog`?
5. Why can a generation endpoint return before all weekly slots exist?
6. Why must exact-context prior approval remain reference-only?
7. Which rules must remain server-side even if the frontend disables a button?
8. How would you distinguish a provider outage, a validation error, a stale-state conflict and an unauthorized request?

## 18. Current documentation cautions

When older documents disagree with code, use current executable code, approved decisions and the engineering record. Known documentation drift to avoid repeating includes:

- CORS does not currently fall back from `CORS_ORIGINS` to `FRONTEND_URL` in code.
- Water tracking is currently persisted and user/date scoped.
- A notification service worker exists, but that is not the same as full offline application caching.
- Meal generation is not always a single immediate 7-day/21-slot response; starter and partial/progressive states exist.
- Legacy `nutrimind_*` internal names remain in places even though the product name is KAINARA.

These are study observations, not authorization to change runtime behavior in a documentation-only task.
