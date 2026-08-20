# NutriMind Repository Audit and ChatGPT Context

> **Documentation status — Current audit snapshot, non-canonical (August 19, 2026):** This export remains useful as portable context, but it is not the living source of truth. Use [`docs/NUTRIMIND_ENGINEERING_RECORD.md`](docs/NUTRIMIND_ENGINEERING_RECORD.md) for accepted decisions, later changes, tests, and current statuses.

> Prepared from a read-only inspection of the repository on August 19, 2026.
>
> This document describes the **current local working tree**, not necessarily `origin/main`. The repository already had many modified generated files, source files, package manifests, frontend files, and several untracked files before this document was created. No existing project file was changed as part of the audit.

## 1. Executive Summary

NutriMind is a partially implemented clinical nutrition and meal-planning web application aimed primarily at Filipino users. It combines:

- Personalized biometric and health onboarding
- Calorie and macro calculations
- AI-generated meal plans through Google Gemini
- Food matching against an FNRI Philippine food database
- Meal logging, swapping, groceries, progress, and notifications
- Nutritionist review and meal-library workflows
- Administrator analytics and nutritionist verification

The basic full-stack architecture is coherent and substantial portions of the UI and API exist. However, the repository is **not production-ready or clinically safe in its current state**. Several workflows described as complete in `AGENTS.md` are missing, only partially implemented, or contradicted by the code. The highest-priority issues concern authorization gates, unapproved meals being shown as active, allergy/clinical validation gaps, race conditions in nutritionist review, logging correctness, schema constraints, and absent automated tests.

Static checks succeeded, but no live database, external service, browser, or end-to-end runtime verification was performed.

## 2. What the System Does

NutriMind supports three roles:

1. **USER**
   - Registers with credentials or Google OAuth
   - Verifies their email through OTP
   - Completes biometric, dietary, medical, allergy, shopping-day, and terms onboarding
   - Generates and acknowledges an AI nutrition report
   - Receives starter or weekly meal plans
   - Views meals, marks them done or skipped, and logs outside meals
   - Swaps meals with library alternatives
   - Generates grocery lists and PDFs
   - Tracks weight, adherence, check-ins, and notifications

2. **NUTRITIONIST**
   - Reviews AI-generated plans in a global review queue
   - Claims plans using a time-limited lock
   - Approves or rejects meals
   - Maintains or flags verified meal-library entries
   - Views approved-plan history and a profile page

3. **ADMIN**
   - Views aggregate statistics and analytics
   - Lists users and nutritionists
   - Marks nutritionists as verified

The intended differentiator is the combination of Filipino food data, Gemini generation, and nutritionist oversight. The code only partially fulfills the claimed clinical safety guarantees.

## 3. Architecture

### 3.1 High-level flow

```text
Next.js 14 frontend
  -> Axios REST client and client-side auth context
  -> Express/TypeScript API
  -> controllers and services (layering is mixed)
  -> Prisma ORM
  -> PostgreSQL / Neon

External integrations:
  -> Google Gemini for report and meal generation/estimation
  -> FNRI CSV-backed food records in PostgreSQL
  -> Google OAuth ID-token validation
  -> SMTP through Nodemailer
  -> React PDF for server-generated documents
  -> DiceBear for avatar images
```

### 3.2 Frontend

The frontend uses Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Radix UI primitives, Lucide icons, Axios, `jwt-decode`, and DiceBear.

Important frontend mechanisms:

- `src/app/layout.tsx` installs global providers and route protection.
- `src/lib/context/AuthContext.tsx` owns the current client auth state.
- `src/lib/axios.ts` adds access tokens and retries most `401` responses through refresh.
- `src/components/shared/RouteGuard.tsx` performs client-side role and onboarding redirects.
- Route groups separate auth, onboarding, user, nutritionist, and admin pages.
- Most application pages are client-rendered and call the Express API directly.

### 3.3 Backend

The backend uses Express, TypeScript, Prisma, PostgreSQL, JWT, bcrypt, Google Auth Library, Zod, express-validator, Helmet, CORS, cookie-parser, express-rate-limit, Nodemailer, React PDF, and Google Generative AI.

The intended structure is:

```text
routes -> controllers -> services -> Prisma/external services
```

In practice, boundaries are inconsistent. Some routes and controllers access Prisma or contain business behavior directly, while several services combine validation, persistence, AI calls, notifications, and workflow state transitions.

Global middleware includes Helmet, CORS, JSON parsing, cookie parsing, rate limiting, authentication, and role checks. API groups cover auth, users, meals, groceries, progress, FNRI lookup, nutritionists, admins, and cron-style jobs.

### 3.4 AI and FNRI pipeline

The generation path generally:

1. Calculates BMR/TDEE and a target using profile data.
2. Attempts to select approved meal-library entries.
3. Uses Gemini to fill remaining slots.
4. Parses structured AI output with schemas.
5. Resolves ingredients through exact food matches, aliases, fuzzy matching, and AI estimation.
6. Saves meal-plan rows and ingredients with clinical confidence/status metadata.
7. Places generated meals into a nutritionist review workflow.

The implementation does not fully enforce the documented calorie matching, anti-repetition, allergy handling, or deterministic safety behavior.

## 4. Technology and Dependencies

### Backend

- Node.js and Express 4
- TypeScript 5
- Prisma 5 and PostgreSQL
- `@google/generative-ai`
- `jsonwebtoken` and `bcryptjs`
- `google-auth-library`
- Zod and express-validator
- Helmet, CORS, cookie-parser, express-rate-limit
- Nodemailer
- `@react-pdf/renderer` and React
- `tsx` and Nodemon for development

### Frontend

- Next.js 14.2.35 with App Router
- React 18
- TypeScript
- Tailwind CSS 3
- Radix UI components
- Axios
- `jwt-decode`
- Lucide React
- DiceBear HTTP avatars

### Configuration observations

Backend environment key names found include:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `GEMINI_API_KEY`
- `CRON_SECRET`
- `PORT`
- `NODE_ENV`
- `FRONTEND_URL`
- `GOOGLE_CLIENT_ID`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`

Frontend key names found include:

- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

Secret values were not read or copied. The backend `.env.example` does not document all required variables, including several SMTP/Google/frontend-related values. CORS is hard-coded for localhost ports rather than consistently using `FRONTEND_URL`.

## 5. Important Files and Folders

### Repository documents and data

- `AGENTS.md` — extensive project claims and instructions, but several completion claims conflict with the code.
- `NUTRIMIND_SYSTEM_REFERENCE_FOR_SPMP_SRS.md` — appears closer to the observed state and acknowledges multiple gaps.
- `NUTRIMIND_MASTER_PROMPT.md` — foundational requirements/specification.
- `UPDATE_LOG.md` — historical implementation notes.
- `fnri_foods.csv` and `nutrimind-backend/prisma/data/fnri.csv` — food composition seed data.

### Backend

- `nutrimind-backend/prisma/schema.prisma` — database source of truth.
- `nutrimind-backend/prisma/migrations/` — schema history.
- `nutrimind-backend/prisma/seed.ts` — FNRI data seeding.
- `nutrimind-backend/prisma/seed-test-accounts.ts` — test/admin/nutritionist accounts.
- `nutrimind-backend/src/app.ts` — Express setup and router mounts.
- `nutrimind-backend/src/server.ts` — process entry point.
- `nutrimind-backend/src/services/auth.service.ts` — credentials, OAuth, and token flow.
- `nutrimind-backend/src/services/meal-generation.service.ts` — central plan generation pipeline.
- `nutrimind-backend/src/services/meal-swap.service.ts` — library replacement logic.
- `nutrimind-backend/src/services/meal-log.service.ts` — planned and outside meal logging.
- `nutrimind-backend/src/services/nutritionist.service.ts` — review queue, claims, approvals, library, and flags.
- `nutrimind-backend/src/services/health-validation.service.ts` — health/allergy checks.
- `nutrimind-backend/src/services/cron.service.ts` — adherence and scheduled-generation behavior.
- `nutrimind-backend/src/services/user.service.ts` — profile and health-change logic.
- `nutrimind-backend/src/lib/gemini.ts` — Gemini client/fallback handling.
- `nutrimind-backend/src/lib/fnri.ts` — food lookup chain.
- `nutrimind-backend/src/lib/calculations.ts` — BMR/TDEE/target calculations.
- `nutrimind-backend/src/middleware/auth.ts` — bearer-token authentication.
- `nutrimind-backend/src/middleware/rbac.ts` — role authorization.

### Frontend

- `nutrimind-frontend/src/app/layout.tsx` — root application layout.
- `nutrimind-frontend/src/lib/context/AuthContext.tsx` — auth state.
- `nutrimind-frontend/src/lib/axios.ts` — API client and refresh interceptor.
- `nutrimind-frontend/src/components/shared/RouteGuard.tsx` — client routing gates.
- `nutrimind-frontend/src/app/(user)/dashboard/page.tsx` — primary daily dashboard.
- `nutrimind-frontend/src/app/(user)/meals/page.tsx` — plan/history/library interface.
- `nutrimind-frontend/src/app/(user)/grocery/page.tsx` — grocery checklist.
- `nutrimind-frontend/src/app/(user)/progress/page.tsx` — weight and adherence.
- `nutrimind-frontend/src/app/(nutritionist)/nutritionist/reviews/page.tsx` — plan-review interface.
- `nutrimind-frontend/src/app/(nutritionist)/nutritionist/library/page.tsx` — library interface.
- `nutrimind-frontend/src/app/(admin)/admin/overview/page.tsx` — admin summary.
- `nutrimind-frontend/src/hooks/useMeals.ts` — meal API hook, including at least one stale/missing endpoint.
- `nutrimind-frontend/src/types/index.ts` — frontend domain types.

## 6. Database Model and Relationships

The precise model and enum definitions are in `nutrimind-backend/prisma/schema.prisma`.

### Core relationships

- A `User` has optional one-to-one `UserProfile`, `NutritionReport`, and `NutritionistProfile` records.
- A `User` has many authentication `Account` and `Session` records.
- A `User` has many conditions, allergies, meal plans, meal logs, weight logs, daily nutrition logs, grocery lists, notifications, and swap trackers.
- A `NutritionistProfile` is linked to reviewed meal plans, claimed meal plans, verified meal-library entries, and library flags.
- A `MealPlan` belongs to a user and can optionally reference a nutritionist and a meal-library record.
- A `MealPlan` owns meal ingredients, related logs, and swap logs.
- A `FoodItem` owns aliases and is referenced by meal ingredients.
- A `MealLibrary` record can be referenced by meal plans and owns flags.
- A `GroceryList` belongs to a user and owns grocery items.
- A `PlanSwapTracker` belongs to a user/plan cycle and owns swap logs.

### Schema weaknesses and technical debt

- `Account`, `Session`, and `AssignmentStatus` appear effectively unused by the active implementation.
- The allergy table uses the legacy mapped database name `Allgy`.
- Important composite uniqueness constraints are missing, such as:
  - user + health condition
  - user + allergy
  - user + date for daily nutrition logs
  - user + meal plan for planned meal logs
  - OAuth provider + provider account identity
- `MealLibrary` does not have its own normalized ingredient relationship. Services copy ingredient data from historical plans, which is fragile.
- Meal ingredients do not contain useful quantity/serving-unit information for a real grocery list.
- Explicit indexes are sparse for expected queue, history, date, and user-scoped queries.
- Null clinical metadata on library records can pass compatibility filters.

## 7. Authentication and Authorization Flow

### Current flow

1. Registration/login/Google auth returns:
   - an access JWT with approximately 15-minute lifetime
   - a refresh JWT with approximately 7-day lifetime
2. The access token is placed in a JavaScript-readable `nutrimind_session` cookie.
3. The refresh token is placed in an HttpOnly, SameSite=Lax cookie.
4. Axios sends the access token as a bearer token.
5. Most `401` responses trigger a refresh request and retry queued requests.
6. Express authentication middleware verifies the JWT and attaches its claims.
7. RBAC middleware limits route groups to `USER`, `NUTRITIONIST`, or `ADMIN`.
8. `AuthContext` fetches `/user/profile` to construct client state.
9. `RouteGuard` redirects based on email verification, role, onboarding, ToS acceptance, and report acknowledgement.

### Major auth and authorization concerns

- Email verification, onboarding completion, ToS acceptance, and nutrition-report acknowledgement are mostly frontend route gates. The backend does not consistently enforce them, so a user with a valid token can directly call protected user APIs before satisfying the intended requirements.
- The database `Session` model is not used to manage issued refresh tokens. Logout removes database sessions, but the active refresh JWT is not actually tied to a revocable persisted session.
- Refresh tokens are not rotated or robustly revoked.
- Password reset/change does not invalidate existing access or refresh tokens.
- The access token is stored in a JavaScript-readable cookie, increasing impact if an XSS bug occurs.
- The Axios interceptor skips refresh on some auth routes, including verification flows. A user whose access token expires during email verification may become stuck.
- Changing an email does not clearly require password confirmation or re-verification, and token claims can stay stale until refresh.
- A transient profile-fetch failure can set the client user to null while auth cookies remain present, producing inconsistent state.
- Nutritionist routes enforce the `NUTRITIONIST` role but do not consistently re-check `isVerified` or license expiry at request time.

## 8. Features That Appear Implemented

These features have meaningful backend and/or frontend code. This does **not** mean every edge case is correct or that the feature has been runtime-tested.

- Credential registration and login
- Google sign-in backend/frontend integration
- Email OTP verification and resend
- Forgot/reset password
- Access-token refresh path
- Multi-step user onboarding
- Profile and account settings
- BMR/TDEE and calorie-target calculations
- AI nutrition report generation and PDF output
- Starter/weekly meal-plan generation
- FNRI food lookup and aliasing
- Current plan and meal history views
- Planned meal done/skipped actions
- Outside meal logging with Gemini estimation
- Meal swapping and swap tracking
- Grocery generation, item toggling, and PDF output
- Progress and weight views
- Weekly check-in UI/service behavior
- In-app notification polling and read state
- Nutritionist review queue, claims, approval, rejection, approved archive
- Meal-library browse/edit/delete and cross-nutritionist flagging
- Nutritionist profile display/edit behavior
- Admin overview, analytics, user lists, and nutritionist verification action
- Responsive user/nutritionist/admin layouts
- Dark/light styling and avatar customization

## 9. Partial or Missing Features

### User and nutritionist discovery

- The frontend `/user/nutritionists` page calls a backend endpoint that does not exist.
- Consultation is a placeholder using `alert('Request feature coming soon!')`.
- No consultation request, booking, messaging, or lifecycle model is implemented.

### Nutritionist patients

- The nutritionist patients page calls a missing `/nutritionist/patients` endpoint.
- It assumes an assigned-patient model that was reportedly removed from the current design.
- A product decision is required: remove/reframe this page or design a consent-based care relationship.

### Nutritionist onboarding

- No complete application/profile-creation workflow for becoming a nutritionist was found.
- Nutritionist records appear to require seed data or manual database administration.

### Meal API inconsistencies

- `useMeals` calls a missing `GET /user/meals` endpoint while the backend exposes `/user/meals/current`.
- The hook may currently be unused, indicating dead or stale code rather than an immediately visible runtime error.

### Meal library

- No direct backend endpoint for creating a library meal was found.
- Library records appear to be created automatically during approval.
- Library ingredient storage is incomplete and depends on plan history.

### Water, groceries, and exports

- Water tracking uses a single localStorage key; it is not scoped by date or user and is not persisted in the backend.
- Grocery items lack reliable quantities and units.
- The export page appears to print the current screen/sheet rather than export a complete user data archive.

### Admin controls

- User management is primarily read-only.
- No complete suspension, deletion, role management, or audit-log workflow was found.
- PRC verification is a manual click and does not validate license data externally or manage expiry/rejection/unverification well.

### Operations and platform completeness

- No FNRI import API endpoint was found.
- The PWA has a manifest/icons but no service worker or meaningful offline behavior.
- No Web Push or WebSocket real-time layer exists.
- No automated test suite was found.
- No CI pipeline, Docker setup, production deployment configuration, or external scheduler configuration was found.

## 10. Major Risks and Likely Bugs

### Critical clinical/data integrity risks

1. **Unapproved plans can be treated as active.** `PENDING_REVIEW` meals are included in current/active plan selection, so users may view and mark AI meals before nutritionist approval.

2. **Allergy confidence is incomplete.** AI confidence logic focuses on enum-based conditions and does not consistently include custom conditions, custom allergies, or all allergy data. An AI-estimated ingredient that conflicts with an allergy may still be labelled `SAFE`.

3. **Safety checks disagree across workflows.** Custom restrictions may be included in prompts but are ignored by deterministic swap, outside-meal, nutritionist-warning, or mid-plan safety logic.

4. **Nutritionist allergen keys do not match schema enums.** Warning code uses names such as `PEANUTS`, `TREE_NUTS`, `EGG`, `WHEAT`, `FISH`, and `SOY`, while the actual enum vocabulary differs, so several expected allergen warnings may never fire.

5. **Clinical AI output is trusted too heavily.** Nutrition reports can role-play a licensed professional and are not comprehensively validated by deterministic clinical rules. The calorie-target floor appears as low as 500 kcal, which is unsafe without strict clinical governance.

### Meal generation and library risks

6. **Documented matching behavior is not fully implemented.** The code does not reliably enforce claimed ±10% calorie matching or true three-day anti-repetition.

7. **Same-generation repetition is possible.** Library usage counters are not incremented during slot selection, allowing one meal to be selected multiple times in a plan.

8. **Library ingredients are fragile.** A swapped plan is updated and its old ingredients are deleted, then ingredient-copy logic may search for an approved plan referencing the same library item. It can find the now-empty plan or no suitable plan, producing empty meal/grocery ingredients.

9. **Unknown safety metadata is permissive.** Null library condition/allergy metadata can be considered compatible rather than blocked for review.

10. **Plan retrieval can mix rejected and replacement rows.** Current-plan logic finds an active plan group and then fetches group rows without applying the same status filter, allowing rejected originals and replacement meals to appear together.

### Nutritionist workflow risks

11. **Queue priority sorting has a falsy-zero bug.** `NEEDS_REVIEW` is assigned priority `0`, but code using `value || 2` converts that priority back to `2`.

12. **Claiming is race-prone.** Claim logic reads and then updates without a conditional atomic operation; simultaneous nutritionists could race for the same meal.

13. **Approval/rejection does not strongly enforce ownership.** Operations may proceed for expired, absent, or mismatched claims.

14. **Approval is not fully transactional.** Library creation can occur before the plan update transaction, leaving an orphaned library record on failure.

15. **Rejected replacement can silently fail.** The system can mark a plan rejected, notify the user, fail to generate a replacement, catch the failure, and still return success.

### Logging, adherence, and progress risks

16. **Meal logs can duplicate.** Swapping can create another pending log without removing an existing log, and the database lacks a uniqueness constraint preventing duplicate user/plan logs.

17. **Status updates corrupt provenance.** Updating a log can overwrite sources like `USER_SWAPPED` or `SAFETY_REPLACED` with `SYSTEM_GENERATED`, and can label all plans as FNRI-based even when nutrition values were AI-estimated.

18. **`loggedAt` semantics are wrong.** Planned meal status changes set timestamps to the click time. Past/future meal actions can distort daily history and adherence, and even returning a status to pending updates the timestamp.

19. **Invalid plan statuses can be logged.** Ownership is checked, but rejected/cancelled plans may still accept status changes.

20. **Outside-meal acknowledgement is nondeterministic.** The warning preview calls Gemini, but acknowledgement calls Gemini again and may persist a different estimate from the one the user accepted.

21. **Outside-meal input validation is weak.** No strict request schema was found for all numeric values, so invalid or negative values may be accepted.

22. **Dashboard totals are incomplete.** The calorie ring counts scheduled completed meals but may ignore outside meals. Its target can be derived from summed plan meals rather than the profile's daily target.

23. **Daily aggregates can duplicate.** `DailyNutritionLog` lacks a user/date uniqueness constraint, and find-then-create cron behavior can race.

24. **Weight flows are duplicated and inconsistent.** `/user/weight-log` and `/user/progress/weight` use different services; one recalculates calories and one does not. One flow creates a log before validating the profile and is not transactional.

25. **Check-ins can be submitted repeatedly.** Due-date enforcement and idempotency are insufficient, allowing streak inflation or repeated updates.

26. **Concurrent health updates can race.** The frontend saves conditions and allergies with `Promise.all`, while both writes can trigger safety re-checks against partially updated profile state.

### Grocery and automation risks

27. **Grocery generation includes inappropriate plan rows.** It can aggregate all rows in a group, including rejected meals.

28. **Regeneration can destroy checklist progress.** Automatic grocery regeneration may wipe checked-item state.

29. **No quantities are available.** Ingredient/grocery models cannot produce an actionable quantified shopping list.

30. **Weekly cron timing is internally inconsistent.** Comments say generation occurs before the shopping anchor, but calls on Saturday/Sunday can produce starter behavior instead of the intended full weekly plan.

31. **Cron regeneration is too broad.** It can regenerate for all users in a group every cycle rather than only users meeting the intended missed-check-in criteria.

32. **Timezone handling is uncertain/unsafe.** Day boundaries rely on server timezone rather than explicit Asia/Manila business-time handling.

### Security and privacy risks

33. **Mass assignment is possible.** Profile and check-in paths spread arbitrary request bodies into Prisma update data rather than explicitly allow-listing fields.

34. **Frontend-only gates are bypassable.** Direct API calls can avoid email/onboarding/ToS/report prerequisites.

35. **Refresh sessions are not truly revocable.** The schema suggests sessions, but the token implementation does not use persistent hashed refresh-session records.

36. **Sensitive AI output may be logged.** Raw Gemini output is logged on parsing errors and may expose health-profile data.

37. **Gemini limiter is defined but not applied.** This creates cost, abuse, and service-exhaustion risk.

38. **FNRI fuzzy matching is unsafe.** Substring `contains` plus first-result selection can pick arbitrary foods. Auto-created aliases lack strong uniqueness protections and can duplicate or lock in bad matches.

### Frontend routing and UX risks

39. **Nutrition report can hang.** The report page is not consistently protected by the same route guard; unauthenticated direct navigation may leave an infinite loading state.

40. **Role route detection is incomplete.** `/export` and `/nutritionists` are not consistently recognized as user-only prefixes, so other roles can render user layout UI and then fail on API calls.

41. **Nutrition report display has a type mismatch.** The frontend appears to expect condition objects while the backend returns condition strings, so the displayed condition list may be empty.

42. **React hook dependencies are incomplete.** Lint reported missing dependencies in meal-related components, risking stale values or inconsistent refresh behavior.

### Engineering and operational debt

43. **No automated tests exist.** Critical clinical, auth, plan state, claim, swap, and logging rules have no regression protection.

44. **No CI or deployment baseline exists.** Static checks are manual, and no reliable release gate was found.

45. **Generated backend `dist` is tracked.** This produces noisy diffs and can drift from source.

46. **Documentation overstates completion.** `AGENTS.md` claims all routers/services/features are complete and tested, but multiple endpoints and workflows are missing or inconsistent. The generic frontend README is also not useful project documentation.

47. **Service layering is inconsistent.** Controllers/routes sometimes bypass services, and transactions do not encompass all state changes and notifications.

48. **External model availability is uncertain.** The configured Gemini model identifiers may be unavailable, renamed, or deprecated depending on the active API account and date. This was not verified against the network.

## 11. Coding Conventions Observed

- TypeScript is used throughout frontend and backend.
- Backend generally uses route/controller/service separation but does not enforce it consistently.
- Prisma is the main persistence abstraction.
- Static service classes are common in backend business logic.
- API responses often use JSON objects with `success`, `message`, or data fields, but response/error conventions are not fully centralized.
- Frontend pages rely heavily on client components and local state.
- Axios is the shared API boundary.
- Tailwind utility classes and a small UI component library define visual conventions.
- Enums and uppercase status strings drive most workflows.
- Some comments and documentation describe desired behavior more strongly than the implementation warrants.
- Lint warnings show use of `any`, unused imports, missing hook dependencies, unescaped JSX punctuation, and raw `<img>` elements.

## 12. Validation Performed

The following read-only/non-output-writing checks passed against the current working tree:

- Backend TypeScript: `tsc --noEmit --incremental false`
- Frontend TypeScript: `tsc --noEmit --incremental false`
- Prisma schema validation: passed
- Frontend lint: passed with warnings

No build command was run because builds would create or update generated output such as `dist` or `.next`, contrary to the original no-modification audit instruction.

Not verified:

- Application startup
- Live PostgreSQL/Neon connectivity
- Migration application against a real database
- Seed execution
- Gemini API behavior or model availability
- Google OAuth behavior
- SMTP/email delivery
- PDF runtime output
- Browser behavior or responsive UI
- Cron execution in a deployed environment
- End-to-end user, nutritionist, or admin flows
- Performance, load, penetration, accessibility, or clinical validation

## 13. Recommended Development Roadmap

### Phase 1: Establish a trustworthy baseline

- Decide which document is authoritative and update claims to reflect reality.
- Review and separate the pre-existing dirty working tree into intentional commits.
- Stop tracking generated output if the deployment process does not require it.
- Add CI for install, Prisma validation, TypeScript, lint, unit tests, and integration tests.
- Add a minimal local/deployment guide and complete environment-variable documentation.
- Establish test fixtures for each role and clinically important profile type.

### Phase 2: Fix clinical and data-integrity blockers

- Prevent `PENDING_REVIEW`, rejected, and cancelled plans from appearing as actionable user meals.
- Centralize a deterministic restriction engine that covers enum and custom conditions/allergies.
- Treat missing safety metadata as requiring review, not as safe.
- Correct allergen enum mappings.
- Fix current-plan status filtering and duplicate meal logs.
- Make outside-meal preview and confirmation persist the exact same estimate.
- Correct date/time semantics for scheduled meals and adherence.
- Add clinically reviewed lower/upper bounds and validation to target calculations.

### Phase 3: Repair transactions and concurrency

- Implement conditional atomic review claims with expiry enforcement.
- Require a valid claim owner for approve/reject operations.
- Make approval, rejection, replacement, library writes, notifications, and related changes transactional where appropriate.
- Make plan generation, cron aggregation, check-ins, and grocery regeneration idempotent.
- Add database uniqueness constraints and indexes after cleaning existing duplicates.

### Phase 4: Redesign the meal library and grocery data

- Give library meals first-class normalized ingredients.
- Store amount, unit, serving size, and preparation metadata.
- Implement tested ±10% matching and three-day anti-repeat logic.
- Increment selection usage within the generation transaction.
- Rebuild grocery aggregation using active approved meals only.
- Preserve checked grocery progress when regeneration is safe or explicitly warn before reset.

### Phase 5: Harden authentication and API input

- Enforce email, onboarding, ToS, and report gates in backend middleware or policy functions.
- Store hashed refresh-token/session identifiers in the database.
- Rotate refresh tokens and revoke them on logout, password reset, credential changes, and suspicious reuse.
- Validate `isVerified` and license validity for nutritionist actions.
- Replace request-body spreading with explicit schemas and field allow-lists.
- Add endpoint-specific rate limits for AI, auth, and sensitive mutations.
- Review CSRF, cookie, CSP, XSS, logging, and PII-handling policy.

### Phase 6: Fix automation and production scheduling

- Define all business dates in `Asia/Manila` explicitly.
- Correct shopping-anchor generation rules.
- Use an external production scheduler and authenticated/idempotent job endpoints.
- Generate only for eligible users and record job/run state.
- Add retries, dead-letter/error tracking, and operational visibility.

### Phase 7: Complete product workflows

- Decide the correct nutritionist-patient relationship model or remove the stale patients page.
- Implement verified nutritionist directory and consultation request flow.
- Add nutritionist application/profile creation and admin approval lifecycle.
- Add direct library creation if required by product scope.
- Complete admin account controls and audit history.
- Implement a real user data export.
- Make water intake user/date scoped and persisted if it is a committed feature.

### Phase 8: Production readiness

- Add unit tests for calculations, restrictions, matching, date windows, swaps, and state transitions.
- Add API integration tests for auth, role/policy gates, generation, review claims, logging, groceries, and cron idempotency.
- Add end-to-end tests for the three roles.
- Add health/readiness endpoints, structured redacted logging, monitoring, error tracking, and alerts.
- Configure deployment, migrations, backups, secret handling, and disaster recovery.
- Complete PWA/offline behavior only if it remains a product requirement.
- Obtain clinical review of prompts, rules, disclaimers, thresholds, and user-visible claims before production use.

## 14. Suggested Priority Order

If work starts immediately, the first sequence should be:

1. Block unapproved meals and rejected rows from user-facing active plans.
2. Unify deterministic clinical/allergy validation, including custom entries.
3. Fix auth policy enforcement and refresh-token revocation.
4. Correct review claims and approval/rejection transactions.
5. Add core database uniqueness constraints and indexes.
6. Fix logging timestamps, duplicate logs, daily aggregation, check-in idempotency, and timezone handling.
7. Redesign library ingredients and grocery quantities.
8. Add automated tests and CI before expanding features.
9. Finish or remove stale directory, consultation, patients, export, and water workflows.
10. Add deployment, monitoring, scheduler, and clinical governance.

## 15. Uncertainties

The following should be treated as uncertain rather than assumed:

- Whether the current dirty working tree represents intended unreleased work.
- Whether a deployed environment or private CI configuration exists outside this repository.
- Whether external cron scheduling is already configured elsewhere.
- Whether the configured Gemini model names currently work for the project's API account.
- Whether production CORS, secrets, SMTP, Google OAuth, Neon, and environment values are configured outside the checked templates.
- Whether any database already contains duplicate records that would block new constraints.
- Whether nutritionist-patient assignment was intentionally removed or is expected to be rebuilt.
- Whether clinical rules and calorie thresholds have been reviewed by a licensed dietitian.
- Whether some apparently unused hooks, schema models, or endpoints are retained for planned future work.

## 16. Bottom Line

NutriMind is a serious capstone codebase with a broad implemented surface, a recognizable architecture, and several end-to-end paths represented in code. Its strongest assets are the role-separated UI, substantial domain schema, meal-generation pipeline, FNRI integration, nutritionist review concept, and breadth of screens.

Its central problem is that documented completion and safety guarantees exceed what the implementation currently enforces. Before adding many new features, development should focus on clinical correctness, authorization policies, transactional state changes, schema constraints, deterministic logging, test coverage, and operational reliability.
