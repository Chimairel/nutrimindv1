# NutriMind Engineering Record

Document status: Living project evidence record
Project: NutriMind
Owner: Chimairel Pacaldo
Started: August 19, 2026
Current architecture baseline: Next.js frontend + Express API + Prisma/PostgreSQL

---

## 1. Purpose and maintenance rules

This is the primary chronological and traceability record for NutriMind engineering work. It supports the Software Project Management Plan (SPMP), Software Requirements Specification (SRS), Software Design Description (SDD), and Software Test Documentation (STD).

Rules:

- Update this file during the same task as a code, schema, configuration, test, or documentation change.
- Record verified facts separately from requirements, proposals, and uncertainties.
- Do not delete old decisions or defects. Mark them resolved, rejected, or superseded and link the replacement ID.
- Do not record secret values, tokens, passwords, private health information, or raw production data.
- "Implemented" does not automatically mean integration-tested, E2E-tested, deployed, or clinically reviewed.
- Use the verification vocabulary in section 3.3 instead of the unqualified word "complete."

---

## 2. Identifier register

| Prefix | Meaning | Next ID |
| --- | --- | --- |
| REQ | Functional or non-functional requirement | REQ-014 |
| ADR | Architecture/design decision | ADR-016 |
| RISK | Technical, project, security, clinical, privacy, or operational risk | RISK-022 |
| DEF | Defect, inconsistency, or documentation mismatch | DEF-031 |
| CHG | Implemented change set, formatted CHG-YYYYMMDD-## | CHG-20260902-02 |
| TEST | Test case or verification procedure | TEST-071 |
| UNC | Unresolved uncertainty | UNC-016 |
| DOC | Documentation correction or addition | DOC-027 |

---

## 3. Current system baseline

### 3.1 Product summary

NutriMind is a partially implemented Filipino-focused nutrition and meal-planning web application. A `USER` can authenticate, complete health and preference onboarding, request a Gemini-assisted nutrition report and meal plan, log meals, generate groceries, track weight/progress, and receive notifications. A `NUTRITIONIST` can access a review queue and meal library. An `ADMIN` can view aggregate information and verify nutritionist records.

The repository contains meaningful implementation for these workflows. Cleanup work added centralized, default-deny actionability and restriction boundaries; the latest compile-first execution registers 128 deterministic tests: 124 pass, 0 fail, and 4 remain explicit TODO specifications. Pure policies and closest query boundaries are unit-tested, but the August 30 production-readiness migration and its new API/database workflows are not deployed or integration-tested, browser E2E evidence is incomplete, and no clinical review is established. Repository CI is configured but remote execution is not established by this local record. Remaining risks are recorded rather than treated as completed behavior.

### 3.2 Current architecture

| Area | Current implementation | Evidence | Verification level |
| --- | --- | --- | --- |
| Frontend | Next.js 14 App Router, React 18, TypeScript, Tailwind, Radix UI, Axios | `frontend/package.json`, `src/app`, `src/components`, `src/lib/axios.ts` | Statically verified |
| Backend | Separate Express 4/TypeScript REST API with route/controller/service layers of mixed consistency | `backend/package.json`, `src/app.ts`, `src/routes`, `src/controllers`, `src/services` | Statically verified |
| Database | Prisma 5 schema targeting PostgreSQL; eleven migrations present | `backend/prisma/schema.prisma`, `prisma/migrations` | Schema statically verified; live DB unverified |
| Authentication | Custom access JWT plus refresh JWT cookie; client auth context and route guard | `src/lib/jwt.ts`, `auth.service.ts`, `auth.controller.ts`, frontend `AuthContext.tsx`, `axios.ts` | Statically verified; runtime unverified |
| Authorization | Bearer authentication and role-only RBAC on route groups; prerequisite policies mainly client-side | backend `middleware/auth.ts`, `middleware/rbac.ts`; frontend `RouteGuard.tsx` | Partially implemented |
| AI | Google Gemini JSON generation with four configured fallback model names | `backend/src/lib/gemini.ts` | Implemented but externally unverified |
| Food data | FNRI CSV seed, database lookup, aliases, fuzzy matching, and Gemini estimation fallback | `prisma/seed.ts`, `src/lib/fnri.ts`, `prisma/data/fnri.csv` | Implemented but integration unverified |
| Email/OAuth/PDF | Nodemailer SMTP, Google ID-token verification, React PDF | `src/lib/email.ts`, `auth.service.ts`, `src/lib/pdf.tsx` | Implemented but externally unverified |

Request flow:

```text
Next.js client
  -> Axios bearer request (refresh cookie sent with credentials)
  -> Express global middleware and route-group auth/RBAC
  -> controller and/or service (some routes/controllers use Prisma directly)
  -> Prisma
  -> PostgreSQL/Neon
```

### 3.3 Verification-level vocabulary

- Planned
- Designed
- Partially implemented
- Implemented but unverified
- Statically verified
- Integration tested
- End-to-end tested
- Deployed
- Clinically reviewed

### 3.4 Repository and working-tree baseline

- Branch: `main`
- HEAD: `2a5f61d`, also shown as `origin/main` at inspection time.
- Recent history contains five broad feature/initialization commits.
- The working tree was already heavily modified before cleanup documentation began.
- Pre-existing changes include backend source, frontend source, package manifests/lockfile, and many generated `dist` files.
- Pre-existing untracked items include `AGENTS.md`, `NUTRIMIND_FULL_SYSTEM_REFERENCE.md`, the `codex/` guide folder, `nutrimind-backend/src/lib/sanitizeError.ts`, and `chatgptcontext.md`.
- There are 132 tracked files under `nutrimind-backend/dist`; `.next` is not tracked.
- The root `.gitignore` already lists backend `dist` and frontend `.next`, so tracked `dist` files continue to produce noise despite ignore rules.
- No existing `docs` directory was present before CHG-20260819-01.
- Ownership and intended final state of the pre-existing dirty changes are uncertain; they were not altered.

### 3.5 Package and route map

Frontend route groups:

| Group | Routes/purpose | Primary guard/layout evidence |
| --- | --- | --- |
| Public/auth | `/`, `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/unauthorized` | `src/app`, root layout, `RouteGuard.tsx` |
| Onboarding | `/onboarding/stats`, `/preferences`, `/conditions`, `/allergies`, `/shopping-day`, `/tos` | `src/app/(onboarding)`, onboarding layout |
| User | `/dashboard`, `/dashboard/[mealId]`, `/meals`, `/grocery`, `/progress`, `/profile`, `/nutritionists`, `/export` | `src/app/(user)`, user layout |
| Nutrition report | `/nutrition-report` | standalone page under `src/app` |
| Nutritionist | `/nutritionist/reviews`, `/approved`, `/library`, `/patients`, `/profile` | `src/app/(nutritionist)`, nutritionist layout |
| Admin | `/admin/overview`, `/users`, `/nutritionists`, `/analytics` | `src/app/(admin)`, admin layout |

Backend route groups:

| Mount | Responsibility | Policy observed |
| --- | --- | --- |
| `/api/auth` | register/login/Google, OTP, reset, refresh, logout | mixed public/authenticated routes; auth rate limiter on selected routes |
| `/api/user` | profile, onboarding, report, settings, notifications, weight, check-in | bearer auth globally; `USER` role after profile/avatar |
| `/api/user/meals` | generation, current/history/detail, status, outside logs, compatible library, swap | bearer auth + `USER` role |
| `/api/user/grocery` | generate/current/PDF/toggle | bearer auth + `USER` role |
| `/api/user/progress` | weight and history | bearer auth + `USER` role |
| `/api/nutritionist` | queue/review, library/flags, approved, profile | bearer auth + `NUTRITIONIST` role; verification/expiry policy not observed globally |
| `/api/admin` | analytics, users, nutritionists, verify | bearer auth + `ADMIN` role |
| `/api/fnri` | food lookup | authenticated access |
| `/api/cron` | daily and weekly jobs | shared `CRON_SECRET` bearer comparison |

Layering note: direct Prisma access exists in `meals.controller.ts`, `user.controller.ts`, and multiple route handlers, so the documented route-controller-service separation is not strict.

### 3.6 Authentication and prerequisite flow

1. Credential or Google login creates a 15-minute access JWT and a 7-day refresh JWT.
2. The backend writes the refresh token to the HttpOnly `nutrimind_refresh` cookie.
3. The frontend writes the access token to the JavaScript-readable `nutrimind_session` cookie for seven days.
4. Axios reads the access cookie and sends `Authorization: Bearer <token>`.
5. On most `401` responses, Axios posts to `/auth/refresh`, saves a new access token, and retries queued requests.
6. Express verifies access-token claims and role middleware checks `USER`, `NUTRITIONIST`, or `ADMIN`.
7. `AuthContext` calls `/user/profile` for live email/onboarding/ToS/report state.
8. `RouteGuard` redirects users based on email verification, role, onboarding, ToS, and report acknowledgement.

Important boundary: the client guard is a user-experience control. The backend route groups do not consistently enforce email verification, onboarding completion, ToS acceptance, report acknowledgement, nutritionist verification, or license validity.

### 3.7 Domain flow map

| Flow | Current path | Verification/gap summary |
| --- | --- | --- |
| Meal generation | profile/calorie target -> approved library matching -> Gemini fill -> FNRI resolution -> `MealPlan`/ingredients -> review state | Implemented but externally unverified; pending rows are preserved and may be returned as explicitly unverified read-only previews, while remaining excluded from actionable current data |
| FNRI resolution | exact food -> alias -> substring fuzzy match -> Gemini estimate | Implemented but unverified; fuzzy first-match and alias uniqueness risks |
| Review | pending queue -> detail/claim -> approve or reject -> library/notification/replacement | Implemented but unverified; sorting, claim atomicity/ownership, and transaction risks |
| Swap | compatible library/options -> preview delta -> confirm -> replace plan/ingredients/log/grocery | Implemented but unverified; ingredient provenance and duplicate-log risks |
| Planned logging | plan detail/current -> set `DONE`, `SKIPPED`, or `PENDING` -> create/update `MealLog` | Statically verified; allowed plan status, timestamp, provenance, and uniqueness defects |
| Outside logging | text/macros -> Gemini warning estimate -> optional acknowledgement -> save | Implemented but unverified; acknowledgement can rerun nondeterministic estimation |
| Grocery | latest approved/current plan group -> aggregate approved/current ingredient names -> recreate list -> toggle/PDF | Actionability boundary unit-verified; Prisma/API integration unverified; no quantities/provenance and checklist reset risk |
| Progress | meal/daily logs + weight history -> frontend summaries; two weight endpoints | Partially implemented; duplicated service behavior and daily uniqueness gap |
| Notifications | persisted notifications -> 60-second frontend polling -> mark read | Implemented but unverified |
| Cron/check-in | secret-protected jobs aggregate yesterday and regenerate by shopping group; user check-in updates profile/streak | Implemented but unverified; server-time, broad regeneration, uniqueness/idempotency gaps |

### 3.8 External interfaces and configuration names

| Interface | Purpose | Configuration names | Baseline verification |
| --- | --- | --- | --- |
| PostgreSQL/Neon | application persistence | `DATABASE_URL` | Prisma schema valid; live connection not tested |
| Gemini | reports, meals, estimates/replacements | `GEMINI_API_KEY` | code inspected; no network request made |
| Google OAuth | ID-token verification | `GOOGLE_CLIENT_ID`, frontend `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | not tested |
| SMTP | OTP and password-reset email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | not tested |
| Frontend/API URLs | Axios base and email links/CORS intent | `NEXT_PUBLIC_API_URL`, `FRONTEND_URL` | code inspected; CORS still hard-coded to localhost |
| Cron | job endpoint authorization | `CRON_SECRET` | code inspected; scheduler not found/tested |
| JWT | access and refresh signing | `JWT_SECRET`, `JWT_REFRESH_SECRET` | static code only |

The backend `.env.example` omits `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, and SMTP variables that exist in the local environment key inventory. Values were not read or recorded.

---

## 4. Requirements register

| ID | Requirement | Type | Actor/source | Priority | Acceptance criteria | Verification | Status | Related IDs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | Preserve Next.js frontend + Express API + Prisma/PostgreSQL unless migration is explicitly approved | Architecture | Codex master/cleanup guide and owner approval | Must | No implicit framework/auth/database migration | Inspection | Approved | ADR-001 |
| REQ-002 | Only approved meals may be actionable, logged, totaled, swapped, or included in groceries; pending meals may be shown only as explicitly unverified, non-actionable previews | Clinical/data integrity | Codex guide, owner-approved Batch 3 policy, and owner clarification on 2026-08-20 | Must | Non-approved/expired statuses are filtered from actionable current/grocery/totals and rejected before user mutations/swaps; every pending preview carries per-meal verification status and no controls | TEST-013/014/022/024/035 | Actionability boundary is implemented and unit/closest-boundary verified; pending-preview source/static contract passes, while expanded live rendering awaits owner verification | ADR-007, DEF-008/020/021/022/029, RISK-001/015/016 |
| REQ-003 | Deterministic restrictions must cover enum and custom conditions/allergies | Clinical safety | Codex guide | Must | One schema-aligned engine used by generation, swap, logging, review, and re-check | TEST-015/016/027/028; later caller tests | Partially implemented: generation library selection only | DEF-009, RISK-002 |
| REQ-004 | Backend must enforce role, ownership, and prerequisite gates | Security | Codex guide | Must | Direct API calls cannot bypass required account/profile states | Future tests | Proposed | DEF-010, RISK-003 |
| REQ-005 | Retriable/concurrent workflow operations must be transactional or idempotent | Data integrity | Codex guide | Must | Claim/log/aggregate/check-in/cron tests pass under retry/concurrency | Future tests | Proposed | RISK-004 |
| REQ-006 | Health/AI data must be validated, bounded, labelled, and redacted in logs | Clinical/privacy/security | Codex guide | Must | Invalid/unknown data is rejected or reviewed; no sensitive raw output logs | Future tests | Proposed | RISK-002, RISK-006 |
| REQ-007 | Documentation must distinguish implementation from verification, deployment, and clinical review | Documentation/quality | Codex guide and owner approval | Must | Canonical docs use section 3.3 vocabulary | TEST-005 through TEST-009 | Implemented for Batch 1 documentation | ADR-002, ADR-003, DOC-001, DOC-003 |
| REQ-008 | Critical behavior must have automated regression tests and CI before broad refactoring | Quality | Cleanup guide and owner approval | Must | Approved test runner covers priority rules; CI runs documented commands | TEST-010 through TEST-021 and TEST-027/028 | Partially implemented: 86 local tests pass, 5 specs remain TODO, and CI is absent | ADR-004, ADR-006, RISK-009 |
| REQ-009 | Business-date and weekly-boundary behavior must use `Asia/Manila`, independently of the host timezone | Data/operational | Owner-approved ADR-005 | Must | Deterministic boundary tests pass with explicit Philippine conversion and UTC storage | TEST-014 active for meal actionability; TEST-017 TODO system-wide | Partially implemented for meal actionability only | ADR-005, ADR-007, DEF-015, RISK-011 |
| REQ-010 | Restriction evaluation must use one deterministic, reason-coded, conservative policy covering enum/custom conditions and allergies plus metadata/provenance uncertainty | Clinical/data integrity | Owner-authorized Batch 4A/4B1/4B2 direction | Must | Exact schema vocabulary; mechanical-only normalization; unknown/null/custom/AI-unresolved evidence never becomes implicit `SAFE`; most-restrictive result wins | TEST-015/016/025-028 | Pure policy and generation library adapter implemented/unit-verified; other callers and clinical approval remain open | ADR-008, DEF-009/023-026, RISK-002/018, UNC-014 |
| REQ-011 | Automatic meal-library reuse must require current, explicit, nutritionist-certified safety evidence with durable ingredient provenance and conservative invalidation | Clinical/data integrity | Owner-authorized Batch 4B3/4B4 direction | Must | Legacy/default/missing evidence is incomplete; only a currently verified/unexpired nutritionist certifies one exact revision; material edits/flags stale it; FNRI proves nutrition provenance only; user-specific adapter evaluation still applies | TEST-029/030 and future workflow/adapter tests | Lifecycle/origin/declaration-state/cross-contact/revision/reviewer/version/invalidation schema foundation migrated and preservation-verified; write workflow, first-class evidence/history, and adapter revision remain unimplemented | ADR-009, DEF-027, RISK-019 |
| REQ-012 | USER onboarding must be resumable, strictly validated by the backend, complete before protected USER workflows, explicit about current health-data/AI consent, and use all calculation inputs without silent defaults | Security/privacy/data integrity | Owner-approved onboarding audit implementation | Must | Verified email; canonical six-step progression; adult 18-100 boundary; biological sex required for current Mifflin-St Jeor calculation; allow-listed DTOs; atomic restriction saves; current versioned consent; nutrition-report acknowledgement before normal USER features; OTP attempt lock and resend cooldown | TEST-038 plus migration/schema/static checks | Implemented in source with additive migration; migration deployment and post-deployment browser/API verification remain owner-controlled | ADR-010, DEF-030, RISK-020 |

---

## 5. Architecture decision records

| ID | Decision | Status | Date | Consequences | Related IDs |
| --- | --- | --- | --- | --- | --- |
| ADR-001 | Preserve Next.js + Express/JWT + Prisma/PostgreSQL architecture and harden it in place | Accepted | 2026-08-19 | Avoids high-risk migration; accepts two-package operation | REQ-001, DEF-001, RISK-003, RISK-005, UNC-001 |
| ADR-002 | Make this engineering record the canonical evidence/status record | Accepted | 2026-08-19 | Legacy documents are retained with explicit classifications | REQ-007, DEF-004, DOC-001, DOC-003 |
| ADR-003 | Use the explicit verification vocabulary; do not use unqualified "complete" | Accepted | 2026-08-19 | Produces defensible implementation/verification reporting | REQ-007, DEF-004, TEST-007 |
| ADR-004 | Establish a minimal automated test baseline before domain refactors | Accepted | 2026-08-19 | Batch 2 precedes behavior-changing safety refactors | REQ-008, RISK-009 |
| ADR-005 | Use `Asia/Manila` as the explicit product business timezone | Accepted | 2026-08-19 | Future time logic/tests must use an explicit Philippine business boundary | DEF-015, RISK-011, UNC-006 |
| ADR-006 | Use Node's built-in test runner through the existing `tsx` dependency for the minimal backend baseline | Accepted | 2026-08-19 | Adds no dependency; keeps initial scope deterministic and isolated; richer mocking/reporting remains optional later | REQ-008, RISK-009, TEST-010 through TEST-021 |
| ADR-007 | Centralize meal actionability as an explicit `APPROVED` allow-list plus current `Asia/Manila` schedule eligibility; unknown states deny by default | Accepted | 2026-08-19 | User actions share one pure policy while history/review visibility remains separate | REQ-002/009, DEF-008, RISK-001/011, TEST-013/014 |
| ADR-008 | Use a pure structured `ALLOW`/`REVIEW`/`BLOCK` restriction contract with existing confidence flags, stable reason codes, mechanical normalization, no fuzzy clinical matching, and most-restrictive precedence | Accepted for isolated Batch 4B1 policy; production integration and medical rules remain pending | 2026-08-19 | Separates technical normalization from semantic/medical approval and makes unknown evidence reviewable; approves only three exact aliases | REQ-003/006/010, DEF-009/023-026, RISK-002/018, TEST-015/016/025/026, UNC-014 |
| ADR-009 | Model library safety evidence as an independent `INCOMPLETE`, `COMPLETE`, or `STALE` lifecycle with first-class library ingredients, explicit declaration states, cross-contact assessment, evidence revision/version, qualified reviewer, and append-only review history | Accepted; Batch 4B4 lifecycle snapshot implemented, later evidence/workflow layers require separate approval | 2026-08-20 | Conservative defaults now persist without making rows eligible; first-class evidence/history and qualified certification remain deferred; Batch 4B2 fallback stays active | REQ-003/006/010/011, DEF-010/024/027, RISK-002/003/018/019, TEST-029/030 |
| ADR-010 | Treat backend onboarding state and current consent versions as authoritative; keep frontend guards and hydration as UX only | Accepted; implemented in source | 2026-08-27 | Adds one database prerequisite read to protected USER requests and preserves already-onboarded legacy accounts whose consent version columns are null; new completions must accept exact current versions | REQ-004/006/012, DEF-010/030, RISK-003/020, TEST-038 |
| ADR-011 | Treat nutritionists as internal NutriMind staff using a pooled review queue rather than a consumer marketplace or assigned-patient model | Accepted; misleading surfaces removed and pooled-review hardening implemented in source | 2026-08-30 | Keeps staff accounts authenticated through the shared `User`/role architecture; removes consultation/assignment promises; requires verified/unexpired eligibility, exclusive expiring claims, and claim-owned decisions | REQ-002/004/011, DEF-005/010/011/013, TEST-046-049 |

### ADR-001 - Stabilize the observed two-package architecture

- Date: 2026-08-19
- Approval date: 2026-08-19
- Status: Accepted by owner
- Context/current problem: Legacy vision material reportedly describes full-stack Next.js/NextAuth, while executable evidence is a separate Next.js client and Express/JWT API.
- Options considered: harden current architecture; migrate to full-stack Next.js/NextAuth; replace both with another design.
- Decision: preserve the current Next.js frontend, Express API, Prisma/PostgreSQL database, custom JWT model, and Axios boundary. Do not migrate to NextAuth or merge the API into Next.js without a later approved ADR.
- Reasoning: the current system is already broadly implemented in this shape; migration would broaden scope and risk without solving immediate safety defects.
- Tradeoff: custom refresh-session security and two-package deployment must be maintained explicitly.
- Security/clinical impact: neutral by itself; enables bounded hardening work.
- Positive consequences: cleanup can proceed in bounded domain slices without a framework migration; current route/API investments are preserved.
- Negative consequences: the custom auth/session design and two-package deployment remain engineering responsibilities.
- Migration impact: none for this decision.
- Related IDs: REQ-001, DEF-001, RISK-003, RISK-005, UNC-001, TEST-005, CHG-20260819-02.
- SDD destination: system architecture and deployment topology.

### ADR-002 - Canonical engineering evidence

- Date: 2026-08-19
- Approval date: 2026-08-19
- Status: Accepted by owner
- Decision: use `docs/NUTRIMIND_ENGINEERING_RECORD.md` for current facts, decisions, risks, changes, and test evidence. Retain older prompts/status documents with explicit historical, aspirational, partially superseded, or current-but-unverified notices.
- Reasoning: a living evidence source prevents older completion claims and architecture directions from silently governing current work.
- Positive consequences: traceable current facts and stable SPMP/SRS/SDD/STD extraction.
- Negative consequences: legacy material must be maintained with notices rather than treated as current by default.
- Related IDs: REQ-007, DEF-004, DOC-001, DOC-003, TEST-006, CHG-20260819-02.
- SDD destination: documentation/configuration governance.

### ADR-003 - Truth-status vocabulary

- Date: 2026-08-19
- Approval date: 2026-08-19
- Status: Accepted by owner
- Decision: use the vocabulary in section 3.3. A feature may have separate implementation and verification states; unqualified "complete" is not an accepted current status.
- Reasoning: static compilation is not runtime, integration, E2E, deployment, or clinical evidence.
- Consequences: current documentation must qualify retained historical completion language; future reports must name the exact verification level.
- Related IDs: REQ-007, DEF-004, TEST-007, DOC-003, CHG-20260819-02.
- SRS/STD destination: feature status and acceptance/verification terminology.

### ADR-004 - Test-before-refactor baseline

- Date: 2026-08-19
- Approval date: 2026-08-19
- Status: Accepted by owner; minimal local baseline implemented by Cleanup Batch 2A, with critical policy tests and CI still deferred
- Decision: add the smallest compatible backend test runner and isolated fixtures, starting with plan actionability and restriction rules, before changing those rules.
- Tradeoff: initial visible behavior changes are delayed by one bounded test-safety-net batch.
- Related IDs: REQ-008, RISK-001, RISK-002, RISK-009, TEST-001 through TEST-004, CHG-20260819-02.
- STD destination: test strategy, fixtures, and regression baseline.

### ADR-005 - Product timezone

- Date: 2026-08-19
- Approval date: 2026-08-19
- Status: Accepted by owner; implementation not started in Batch 1
- Decision: define business dates and weekly anchors in `Asia/Manila`; store instants in UTC and convert at domain boundaries.
- Tradeoff: existing data and deployed scheduler assumptions must be inspected before behavior changes.
- Related IDs: DEF-015, RISK-011, UNC-006, ADR-004, CHG-20260819-02.
- SDD/STD destination: time policy, scheduling algorithms, and boundary tests.

### ADR-006 - Minimal backend test runner

- Date: 2026-08-19
- Approval basis: Owner-authorized Cleanup Batch 2A
- Status: Accepted and implemented for the Batch 2A baseline
- Context/current problem: The backend had no test command or automated regression baseline, while production behavior and external integrations were explicitly out of scope.
- Options considered: Node's built-in `node:test` through existing `tsx`; Vitest; Jest with `ts-jest`.
- Decision: use `node:test` with `node:assert/strict`, executed by the already-installed `tsx`, plus a test-only TypeScript configuration.
- Reasoning: this provides TypeScript execution, TODO specifications, and deterministic assertions without adding dependencies or configuring a second transform/module stack. Vitest would add the Vite dependency graph; Jest/`ts-jest` would add more packages and CommonJS/TypeScript mapping configuration than this baseline needs.
- Tradeoff: the baseline intentionally lacks framework-specific mocking, coverage thresholds, and database/API harnesses. Revisit the choice only when an approved test scope demonstrates those capabilities are needed.
- Security/clinical impact: no production behavior changed; unsafe rules are represented as TODO specifications rather than approved passing expectations.
- Related IDs: REQ-008, RISK-009, TEST-010 through TEST-021, CHG-20260819-03.
- STD destination: backend unit-test runner, isolation policy, fixtures, and critical-behavior specification backlog.

### ADR-007 - Approved-meal actionability boundary

- Date: 2026-08-19
- Approval basis: Owner-authorized Cleanup Batch 3
- Status: Accepted and implemented
- Context/current problem: User-facing queries admitted `PENDING_REVIEW`, second group queries omitted status filters, and planned logging/swaps did not re-check plan approval. Separate services repeated approval conditions inconsistently.
- Decision: `src/domain/meal-actionability.policy.ts` is the single pure policy for user actionability. Only `MealPlanStatus.APPROVED` is status-eligible, only current/future `Asia/Manila` scheduled dates are actionable, and unknown/null/invalid statuses or dates deny by default. Only `MealLibraryStatus.APPROVED` is a replacement/generation candidate.
- Visibility separation: all known meal-plan statuses remain eligible for existing read-only history/audit representation; only `PENDING_REVIEW` is nutritionist-queue reviewable, while approved nutritionist archives remain available.
- Defense in depth: user-facing database queries use policy-derived filters; fetched rows are re-filtered where practical; owned mutation/swap targets are re-checked immediately before mutation. Cross-user lookups remain owner-scoped.
- API consequence: an owned plan that exists but is non-actionable returns the established `{ success: false, error }` body with `409 Conflict` on planned status and swap action paths. Cross-user/nonexistent behavior is not broadened.
- Data consequence: no records are deleted or rewritten. Existing historical logs, rejected/cancelled plans, nutritionist review records, and stored grocery/daily aggregates are preserved.
- Tradeoff: pure and query-boundary tests do not prove live Prisma/API integration. Stored grocery lists lack plan-group provenance, so pre-policy lists cannot be retroactively certified without schema/data work.
- Rollback unit: revert the policy, its focused controller/service callers, and TEST-013/014 activation together; no database rollback is required.
- Related IDs: REQ-002, REQ-008, REQ-009, DEF-008, DEF-020, RISK-001, RISK-015, TEST-013, TEST-014, CHG-20260819-04.
- SDD/STD destination: meal state policy, API state-transition guards, query filters, visibility rules, fixtures, and regression evidence.

### ADR-009 - Authoritative meal-library safety evidence

- Date: 2026-08-20.
- Approval basis: Owner-authorized Cleanup Batch 4B3 design direction and Batch 4B4 lifecycle-migration decisions.
- Status: Accepted; current lifecycle snapshot implemented by Batch 4B4, while first-class evidence/history, certification writes, APIs/UI, and adapter eligibility remain separately gated.
- Context: `MealLibrary` has no first-class ingredients or completeness/history fields. Current generation reads mutable historical plan ingredients, nullable tags do not prove review, and current nutritionist role checks do not prove verification/license eligibility.
- Options considered: keep historical plan evidence; add JSON snapshots/booleans; add normalized library-owned evidence with lifecycle and history.
- Decision: use independent `INCOMPLETE`, `COMPLETE`, and `STALE` evidence; explicit reviewed-none/declaration states; first-class library ingredients; cross-contact state; evidence revision/version; current qualified reviewer; and append-only review history. Operational `APPROVED | FLAGGED` remains separate.
- Authority: only a currently verified, unexpired nutritionist may certify. Any such nutritionist may re-review; original ownership and admin account management do not confer certification authority.
- Conservative behavior: legacy rows become incomplete; material edits/flags stale evidence; empty/missing arrays do not mean reviewed-none; estimated/unresolved/unlinked ingredients prevent completeness; FNRI is nutrition provenance only; no dish/fuzzy/translation/AI allergen inference; Batch 4B2 fallback remains.
- Tradeoff: this requires additive schema, migration, DTO/API/service/UI, concurrency, retention, and adapter work in separately approved batches.
- Migration/compatibility: preserve every current record and history, default all legacy rows incomplete, and copy historical fields only to an incomplete draft when source selection is deterministic. Never auto-certify or use external lookup during migration.
- Related IDs: REQ-003/006/010/011, DEF-010/024/027, RISK-002/003/018/019, TEST-029/030, DOC-015/016, CHG-20260820-01/02.
- SDD destination: `docs/NUTRIMIND_LIBRARY_SAFETY_EVIDENCE_DESIGN.md` lifecycle, data contract, authorization, migration, API/UI, adapter, and test sections.

---

## 6. Risk register

| ID | Risk | Category | Likelihood | Impact | Rating | Mitigation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RISK-001 | Non-approved meals can reach users, logs, totals, and groceries | Clinical/data | Low after Batch 3 source and Batch 3D runtime verification | Critical | Low-to-medium residual | Central default-deny policy, query/mutation guards, TEST-013/014/024; verify a naturally available approved-current live fixture later | Mitigated in source and authenticated runtime for exclusion/`409`; positive approved-current and stored provenance remain under RISK-015/UNC-013 |
| RISK-002 | Restrictions/allergies are incomplete or inconsistent, including custom entries | Clinical | High | Critical | Central deterministic engine; unknown metadata -> review | Open |
| RISK-003 | Backend prerequisite and nutritionist-verification policies are incomplete | Security/privacy | High | High | Backend policy middleware/service with direct API tests | Open |
| RISK-004 | Claims, approvals, replacements, logs, aggregates, check-ins, and cron can race or duplicate | Data integrity | High | High | Transactions, conditional updates, idempotency keys/constraints | Open |
| RISK-005 | Refresh JWTs are not robust revocable sessions | Security | Medium | High | Design hashed rotating sessions and reuse/revocation behavior | Open |
| RISK-006 | Unvalidated AI output/raw logging can create unsafe output or expose health data | Clinical/privacy | Medium | Critical | Bounds/schema checks, redaction, deterministic policy, AI limiter | Open |
| RISK-007 | Schema lacks uniqueness/indexes and library ingredient quantities | Data/technical | High | High | Inspect live duplicates, approved migrations/backfills | Open |
| RISK-008 | Stale/missing routes create broken user/nutritionist workflows | Product/technical | High | Medium | Decide implement/reframe/hide; contract tests | Open |
| RISK-009 | Critical behavior and CI lack an active automated safety net | Quality/project | Medium | High | 86 local tests pass and TEST-013 through TEST-016 plus TEST-027/028 are active; activate remaining specs and add CI only under separate approval | Open; partially mitigated by Batches 2A/3/4B1/4B2 |
| RISK-010 | Dirty working tree and tracked generated output can overwrite or obscure owner work | Configuration/project | High | High | Preserve changes, owner review, no reset/clean; later untracking approval | Monitoring |
| RISK-011 | Server-local date logic can produce incorrect Philippine daily/weekly behavior | Data/operational | Medium | High | ADR-005 and timezone boundary tests | Open |
| RISK-012 | External services/models/config may fail outside static validation | Operational | Medium | High | Controlled integration checks, health monitoring, complete env docs | Open |
| RISK-013 | A Gmail app-password-shaped value existed in tracked legacy documentation and may remain in Git history | Security | Medium | High | Redacted in working tree; owner should revoke/rotate the credential if it was ever valid and assess repository history/access | Open; working-tree exposure mitigated |
| RISK-014 | The hard-coded 500 kcal minimum may be clinically unsafe or unsupported for some profiles | Clinical | Medium | Critical | Obtain RND-approved lower/upper bounds and test them before changing or relying on the rule | Open |
| RISK-015 | Pre-Batch-3 stored grocery lists or daily aggregates may retain contributions from non-approved plans; Batch 3D excluded observed non-approved linked meal logs from current totals but cannot establish stored-grocery provenance | Clinical/data | Unknown | High | Preserve records; inspect privacy-safe provenance only under separate authorization; add Prisma/API integration coverage before claiming stored-data remediation | Open; current-total exclusion runtime-verified by TEST-024, stored grocery provenance unresolved |
| RISK-016 | Runtime safety verification can be blocked or unsafe when a remote shared development database is accessed from a restricted execution context | Operational/privacy | High in restricted execution environments | High | Use a network-permitted local diagnostic context; keep all verification read-only unless separately authorized; use existing owner-designated accounts | Connectivity and target classification resolved for read-only Batch 3D checks by TEST-023/024; mutation gate remains closed |
| RISK-017 | A persistent local runtime credential file could expose development/demo account credentials if tracked, printed, logged, or retained insecurely | Security/configuration | Low with controls | High | Exact root ignore rule; verify ignored and untracked before/after use; load values only in an isolated process; never print values/tokens; owner controls local retention | Mitigated for Batch 3D; monitor locally |
| RISK-018 | Fragmented restriction vocabularies, permissive null metadata, ignored custom restrictions, and incomplete ingredient provenance can produce inconsistent or understated safety decisions | Clinical/data/privacy | High | Critical | Integrate the verified policy only through approved callers; define authoritative library completeness evidence; retain review defaults; obtain clinical approval for medical rules | Open; generation library selection is conservatively mitigated by Batch 4B2, other callers remain unchanged |
| RISK-019 | Library safety evidence depends on mutable/detachable historical plan ingredients and ambiguous tags, so approval, edit, flag, delete, or source-plan changes can erase provenance or misstate review completeness | Clinical/data/audit | High | Critical | Critical | ADR-009 first-class ingredients/declarations/history; legacy-incomplete migration; atomic revision invalidation; verified-nutritionist certification; no auto-backfill | Open; partially mitigated by Batch 4B4 persisted default-deny lifecycle and Batch 4B2 fallback, but authoritative ingredients/history/writes are absent |
| RISK-020 | Onboarding processes sensitive health data and gates clinically consequential calculations/features; weak prerequisites, unstated AI transfer, silent sex defaults, or partial saves can create privacy, security, and safety failures | Security/privacy/clinical/data integrity | High | Critical | Critical | ADR-010; versioned explicit consent; backend readiness middleware; strict DTO schemas; adult boundary; required calculation sex; atomic restriction transactions; no pre-consent custom-health Gemini normalization; OTP lock/cooldown | Mitigated in source and deployment by CHG-20260827-01/02; full post-verification browser completion remains owner-assisted |

---

## 7. Defect and contradiction register

| ID | Defect/contradiction | Severity | Evidence | Expected behavior | Status |
| --- | --- | --- | --- | --- | --- |
| DEF-001 | Legacy full-stack Next.js/NextAuth direction conflicts with Express/custom JWT code | High | Codex master prompt; `backend/src/app.ts`, frontend `axios.ts` | One owner-approved architecture | Resolved for architecture direction by accepted ADR-001; legacy notices added |
| DEF-002 | Legacy model-count claims conflict with four configured Gemini fallbacks | Medium | Codex cleanup prompt; `backend/src/lib/gemini.ts` | One supported, verified model strategy | Open |
| DEF-003 | Fresh-start assumptions conflict with existing history and heavily dirty tree | High | `git status`, `git log` | Preserve existing implementation and owner work | Open/monitoring |
| DEF-004 | Completion claims conflict with missing routes and absent runtime tests | High | frontend callers, backend route inventory, package scripts | Truthful status vocabulary and canonical evidence | Documentation mitigated by accepted ADR-002/003 and CHG-20260819-02; product gaps remain |
| DEF-005 | Nutritionist patients page expects a removed assignment model and missing endpoint | High | patients page; migration `20260621101745_remove_nutritionist_assignment` | Remove the unsupported assigned-patient surface under ADR-011 | Resolved in source 2026-08-30; route and navigation removed |
| DEF-006 | PWA claim exceeds manifest/icons implementation | Medium | `public/manifest.json`; no service-worker registration/code | Label installable shell only or implement tested offline behavior | Open |
| DEF-007 | `Account`, `Session`, and `AssignmentStatus` concepts do not match active use | High | schema; source usage search; logout only deletes sessions | Adopt purposefully or deprecate through approved schema design | Open |
| DEF-008 | `PENDING_REVIEW` was treated as current/actionable and group fetches omitted status filtering | Critical | Pre-Batch-3 `meals.controller.ts` and `grocery.service.ts`; CHG-20260819-04 | Only approved, schedule-current meals exposed/aggregated or accepted for user actions | Resolved in source; TEST-013/014 and authenticated exclusion/`409` checks in TEST-024 pass; positive approved-current runtime path remains unavailable |
| DEF-009 | Allergy/condition logic and nutritionist allergen keys are inconsistent with schema/custom values | Critical | schema enums; safety/review services | One schema-aligned deterministic engine | Open |
| DEF-010 | Backend role checks omit account/profile prerequisite gates and nutritionist verification/expiry | High | route middleware and `RouteGuard.tsx` | Backend policies enforce required states | Partially resolved in source: USER prerequisites and verified/non-expired NUTRITIONIST middleware implemented; live nutritionist expiry boundary pending |
| DEF-011 | Frontend calls missing `/user/nutritionists` and `/nutritionist/patients`; consultation is placeholder | High | nutritionists/patients pages; backend route inventory | Remove marketplace/assignment surfaces and retain the pooled staff-review workflow | Resolved in source 2026-08-30 under ADR-011 |
| DEF-012 | `useMeals` calls missing `GET /user/meals` instead of `/user/meals/current` | Medium | `frontend/src/hooks/useMeals.ts:32`; backend meal routes | Synchronized frontend/backend route contract | Open |
| DEF-013 | Review queue sort converts priority zero to fallback; claims are non-atomic | High | review priority and claim/decision paths | Correct severity order and race-safe claim ownership | Resolved in source 2026-08-30 with compare-and-set claims and claim-owned serializable decisions; concurrent database integration remains unverified |
| DEF-014 | Meal/daily logs can duplicate; status updates alter timestamp and provenance | High | schema missing composites; `meals.controller.ts:315-327`; cron find/create | Unique/idempotent logs with correct event/schedule semantics | Open |
| DEF-015 | Cron and date windows use server-local `Date` operations | High | `cron.service.ts:12-17` | Explicit Asia/Manila business boundaries | Open; direction accepted in ADR-005, implementation deferred |
| DEF-016 | Profile/check-in code accepts broad request objects via spreading | High | `user.controller.ts:49`; `checkin.service.ts:52-54` | Explicit validated field allow-lists | Open |
| DEF-017 | Two legacy documents contained an unredacted Gmail app-password-shaped value | Critical | Batch 1 secret scan of `AI_AGENT_PROMPT.md` and `NUTRIMIND_HANDOFF_GUIDE.md` | Documentation must never contain credential values; any valid credential must be rotated and history/access assessed | Open security follow-up; working-tree value redacted by CHG-20260819-02, but rotation/history decision remains under RISK-013 |
| DEF-018 | Outside-meal confirmation can rerun AI estimation instead of persisting the exact preview the user acknowledged | High | `meal-log.service.ts` preview/confirm flow inspection | Confirmation persists the exact validated preview payload once, with provenance | Open |
| DEF-019 | `calculateDailyTarget` applies a 500 kcal floor without an approved clinical basis in repository evidence | Critical | `src/lib/calculations.ts`; UNC-008 | Use documented, RND-approved bounds and conservative escalation behavior | Open; current floor deliberately not encoded as a passing test |
| DEF-020 | `GroceryList` has no `planGroupId` or meal-plan provenance, so a stored pre-policy list cannot be proven to contain only actionable-plan ingredients | High | Prisma `GroceryList` model and `GroceryService.getGroceryList` | Persist sufficient provenance or regenerate under an approved compatibility design | Open; schema change was outside Batch 3 |
| DEF-021 | Backend startup unconditionally attempts SMTP transporter verification when SMTP credentials are configured | Medium | Batch 3B backend startup console; `src/app.ts:34-35`; `src/lib/email.ts:146-157` | Controlled local startup can opt out of external SMTP verification without changing email-delivery behavior | Open; pre-existing and outside Batch 3B correction scope |
| DEF-022 | `MealCard` can render DONE/SKIPPED/swap controls for a `PENDING_REVIEW` prop, and dashboard/meals status-toggle failures are only logged to the console | High | `MealCard.tsx:299-363`; dashboard/meals status handlers | Frontend provides defense-in-depth against non-actionable props and presents documented `409` state errors | Open; source-observed, not runtime-reproduced, and not caused by Batch 3 backend filtering |
| DEF-023 | Nutritionist allergen warnings use `PEANUTS`, `TREE_NUTS`, `EGG`, `WHEAT`, `FISH`, and `SOY`, while Prisma allergies are `SHELLFISH`, `NUTS`, `DAIRY`, `GLUTEN`, `EGGS`, `NONE` | Critical | `nutritionist.service.ts:163-181`; Prisma schema | Warning keys align with canonical vocabulary or approved aliases | Open; exact mismatch designed for Batch 4B, semantic mappings unapproved |
| DEF-024 | Null or empty meal-library safety metadata can be treated as compatible by generation, swap, compatible-library, and safety-recheck callers | Critical | Repeated legacy compatibility checks; Batch 4B2 generation adapter | Missing/unknown metadata produces structured review, never implicit compatibility | Partially resolved for meal generation only; swap/compatible-library/safety-recheck remain open |
| DEF-025 | Custom conditions/allergies are persisted and sent to selected AI prompts but omitted from deterministic generation, swap, logging, review, recheck, and library enforcement | Critical | Custom-field usage inventory; Batch 4B2 generation adapter | Custom restrictions retain provenance and exact/unmapped outcomes at every policy caller | Partially resolved for generation library selection only; other callers remain open |
| DEF-026 | Meal-generation confidence considers enum conditions only, so allergy-only, custom-only, and some provenance-incomplete plans can retain default `SAFE` | Critical | `meal-generation.service.ts:313-378`; read-only ingredient provenance profile | Confidence derives from the centralized result and scoped `SAFE` definition | Open; policy designed, implementation deferred |
| DEF-027 | `MealLibrary` has no first-class ingredients or review history, approval copies a user's restrictions into compatibility tags rather than recording explicit review findings, and route role checks do not prove current nutritionist eligibility | Critical | Prisma schema/migrations; nutritionist approval/edit/flag/delete service and routes; library/review UI; TEST-029/030 | Explicit reviewed-none/declarations, durable provenance, qualified reviewer/revision/version, stale transitions, and strict workflow validation | Partially resolved: Batch 4B4 adds the conservative lifecycle snapshot and distinct reviewer relation; evidence rows, history, authorization, and writes remain open |
| DEF-028 | `AuthProvider.login` performed `router.push` inside a `setUser` updater, allowing Router mutation during AuthProvider reconciliation | High | Owner console warning and `AuthContext.tsx` login callback | Navigation occurs only after live profile refresh, outside all render/state-updater callbacks, without weakening route guards | Resolved in source by CHG-20260820-07; static/type and three-role API compatibility pass; browser-console confirmation remains owner-assisted |
| DEF-029 | Successful generation persisted only `PENDING_REVIEW` rows, then the controller filtered its response to actionable rows and the dashboard presented the resulting empty array as generation failure | High | Read-only owner-database/API evidence; generation controller/dashboard contract | Preserve non-actionability while returning an explicitly unverified preview for every pending meal, render awaiting-review state, and reject empty false-success results | Resolved in source/API contract by CHG-20260820-07; existing 9-row pending STARTER group can be previewed without another mutation; expanded runtime/render verification remains owner-assisted |
| DEF-030 | Onboarding had ten coupled defects: missing biological sex with silent female calculation fallback, client-only prerequisites, broad profile spreading, non-atomic restriction/custom saves, contradictory NONE inputs, inaccurate AI/privacy claims, brute-forceable/resendable OTP, non-resumable pages, mismatched password guidance, and AI normalization before consent | Critical | Full onboarding/auth source audit and owner-approved implementation | Central policy and strict schemas; persistent consent/OTP metadata; server readiness middleware; atomic writes; frontend hydration/progress/accessibility; privacy-minimized AI prompts/logs; aligned password rules | Resolved in source and deployment by CHG-20260827-01/02; pre-verification runtime boundaries pass; full OTP-success/post-verification browser completion remains owner-assisted |

Contradiction resolution details:

| ID | Current behavior | Impact | Recommended resolution | Alternative/tradeoff | Owner approval? |
| --- | --- | --- | --- | --- | --- |
| DEF-001 | Separate frontend/API and custom JWT are executable | Architecture/security | ADR-001 accepted: harden current architecture | Migration remains possible only through a later approved ADR | Resolved 2026-08-19 |
| DEF-002 | Four model strings are configured; availability unverified | Reliability/cost | Treat code list as current, verify supported models later, document fallback policy | Keep legacy count claims, which preserves drift | Yes for product model policy |
| DEF-003 | Existing commits plus many uncommitted changes | Data/project | Never treat repository as empty; review dirty changes by ownership | Fresh rewrite risks loss and is prohibited | No for preservation; yes before cleanup/untracking |
| DEF-004 | Static checks pass, but workflows lack runtime evidence and some routes are absent | Project defense/trust | ADR-002/003 accepted; Batch 1 reconciled canonical/legacy status | Product gaps require later approved batches | Documentation decision resolved 2026-08-19 |
| DEF-005 | Page promises admin-assigned patients after assignment removal | Privacy/product | Temporarily reframe/hide until a consent/care model is approved | Reintroduce assignment model, which expands scope/data obligations | Yes |
| DEF-006 | Manifest and icons exist; no offline worker/cache | Product | Label as installable web app, not offline-ready | Implement/test offline behavior later | Yes |
| DEF-008 | Pre-Batch-3 pending/group rows could be returned and aggregated | Clinical/data | ADR-007 implemented: explicit approved/current policy, query filters, and mutation re-checks | Live positive approved-current and stored-grocery provenance remain separate evidence gaps | Source and authenticated negative-state runtime resolution accepted 2026-08-19; monitor RISK-015 |
| DEF-007 | Session/account/assignment artifacts are largely inactive | Security/schema | Keep until Phase 7 design; use Session for refresh or deprecate with migration | Immediate deletion risks data/migration breakage | Yes |

---

## 8. Uncertainty and open-question register

| ID | Uncertainty/question | Why it matters | Evidence needed | Decision owner | Status |
| --- | --- | --- | --- | --- | --- |
| UNC-001 | Does the owner accept ADR-001 as the long-term architecture? | Blocks stable cleanup direction | Owner approved ADR-001 on 2026-08-19 | Owner | Resolved |
| UNC-002 | Which pre-existing modified/untracked files are intentional and ready to keep? | Prevents safe commits/untracking/refactors | Owner review or commit grouping | Owner | Open |
| UNC-003 | Are current Gemini model IDs enabled and supported for the actual account? | AI features may fail at runtime | Controlled API integration test/current provider docs | Owner/engineer | Open |
| UNC-004 | Is there an external deployment, CI, scheduler, or monitoring setup not stored here? | Repository absence does not prove operational absence | Deployment/account inventory | Owner | Open |
| UNC-005 | Does live data contain duplicates that would block future unique constraints? | Determines migration cleanup rules | Privacy-safe aggregate queries on approved environment | Owner/engineer | Open |
| UNC-006 | What timezone is used by any deployed server/scheduler and historical records? | Affects date migration/compatibility | Deployment config and sample boundary checks | Owner | Open |
| UNC-007 | Should nutritionist-patient/consultation workflows be implemented, reframed, hidden, or removed? | Material product/privacy scope decision | Owner requirements and consent model | Owner | Open |
| UNC-008 | Have calorie thresholds, prompts, warnings, and restrictions been reviewed by an RND? | Cannot claim clinical validation without evidence | Signed review criteria/evidence | Owner/clinical reviewer | Open |
| UNC-009 | What calorie-target lower and upper bounds, population exclusions, and escalation rules are clinically approved? | TEST-021 cannot become a safe passing assertion without an authoritative policy | Signed RND-approved criteria with units, scope, contraindications, and review cadence | Owner/clinical reviewer | Open |
| UNC-010 | Do existing stored grocery lists, linked meal logs, or daily aggregates contain contributions from plans that were non-approved at action time? | Determines whether a future backfill/rebuild is needed; Batch 3 preserved all records | Privacy-safe aggregate inspection in an owner-approved database environment | Owner/engineer | Open |
| UNC-011 | Is the configured remote database an owner-approved development/test target? | Determines whether even bounded runtime checks are appropriate | Owner confirmed it is the shared persistent capstone development/demo database; no data-changing verification was authorized | Owner | Resolved for read-only Batch 3D scope |
| UNC-012 | Is there an existing owner-approved USER development account whose credentials may be used locally? | Required authenticated current/history/grocery/totals and non-mutating `409` verification without seeding or impersonation | Owner supplied an existing persistent USER account through the ignored local credential file | Owner | Resolved for read-only Batch 3D scope |
| UNC-013 | Do the full authenticated interactive browser/hydration flows behave correctly, and does the positive approved-current USER runtime path pass when a natural fixture exists? | Route-shell HTTP checks and owner-observed USER dashboard do not prove every client interaction; the designated USER had no approved current/future plan | Owner-assisted browser checks for remaining role/pages and a read-only rerun when an approved-current record naturally exists; do not create one for verification | Owner/engineer | Open |
| UNC-014 | Which semantic aliases, nutrient/keyword incompatibility rules, direct-allergy logging behavior, nutritionist override policy, and first-class restriction categories are approved? | Technical similarity cannot establish medical equivalence or safe workflow behavior | Owner decisions plus licensed RND review of each mapping/rule/threshold and user-facing claim | Owner/clinical reviewer | Partially resolved: owner approved only `PEANUTS -> NUTS`, `TREE_NUTS -> NUTS`, and `EGG -> EGGS`, NONE exclusivity, conservative metadata handling, and no override/logging integration for Batch 4B1; medical rules and later workflows remain open |
| UNC-015 | Exact lifecycle/schema names, cross-contact semantics, policy-version ownership, reviewer audit retention, license-expiry staleness, material-field scope, archival policy, and deterministic legacy draft-import rule remain owner/RND decisions | These choices affect clinical wording, authorization, data retention, migrations, and whether evidence can safely become adapter-eligible | Owner approval of ADR-009 details plus licensed-RND approval of cross-contact/reviewed-absent wording and a disposable migration test target | Owner/clinical reviewer | Resolved for Batch 4B4 only: exact lifecycle fields/enums, conservative cross-contact wording, distinct restricted reviewer relation, event-based staleness, no calendar expiry, and legacy defaults approved; later workflow/retention/import decisions remain outside this closed uncertainty |

---

## 9. API and interface register

### 9.1 Supported backend route inventory

| Route family | Methods and paths | Actor/policy | Status |
| --- | --- | --- | --- |
| Auth | `POST /register`, `/login`, `/google`, `/verify-email`, `/resend-verification`, `/forgot-password`, `/reset-password`, `/refresh`, `/logout` | Public/limited authenticated mix | Statically verified |
| User profile/onboarding | `GET /profile`, `PUT /profile/avatar`; `POST /onboarding/profile`, `/conditions`, `/allergies`, `/shopping-day`, `/tos`, `/complete`; `GET /onboarding/suggestions` | Auth; most `USER` | Statically verified |
| Report/settings | `GET /nutrition-report`, `/nutrition-report/pdf`; `POST /nutrition-report/generate`, `/acknowledge`; `PUT /profile`, `/conditions`, `/allergies`, `/settings` | `USER` | Statically verified |
| User misc | notification get/read; weight get/post; check-in status/submit | `USER` | Statically verified |
| Meals | generate/current/history/outside log/status/compatible library/detail/swap options/preview/execute | `USER` | Actionability policy/closest boundaries unit-verified; API integration unverified; DEF-012/014 remain |
| Grocery | generate/current/PDF/toggle | `USER` | Generation actionability boundary unit-verified; stored-list provenance/API integration unverified under DEF-020/RISK-015 |
| Progress | weight/history | `USER` | Statically verified |
| Nutritionist | queue/detail/review; library get/detail/update/delete/flag/resolve; approved; profile get/update | `NUTRITIONIST` role only | Statically verified with DEF-010/013 |
| Admin | analytics/users/nutritionists/verify | `ADMIN` | Statically verified |
| FNRI | lookup | Authenticated | Statically verified |
| Cron | daily, weekly weekend, weekly weekday | `CRON_SECRET` | Statically verified |

### 9.2 Known caller/route mismatches

| Frontend caller | Backend result | Status |
| --- | --- | --- |
| `GET /user/nutritionists` | Intentionally not exposed | Consumer hiring/directory concept removed by ADR-011 |
| `GET /nutritionist/patients` | Intentionally not exposed | Assignment model removed; staff use the shared review queue under ADR-011 |
| `GET /user/meals` in `useMeals` | No route; `/user/meals/current` exists | Stale caller; DEF-012 |

---

## 10. Data design and migration register

| Model/table | Purpose and key relationships | Current constraints | Known issues |
| --- | --- | --- | --- |
| `User` | identity/role; parent of profile, auth, clinical, plan/log/progress/grocery/notification data | unique email | prerequisite state not enforced broadly at backend |
| `Account`, `Session` | OAuth/session-shaped records | session token unique | Account unused; Session only deleted on logout, not created for refresh lifecycle |
| `UserProfile` | biometrics, preferences, calorie target, custom restrictions, shopping/check-in state | unique user | broad updates; clinical bounds/time behavior need tests |
| `HealthCondition`, `Allergy` | enum restrictions per user | no user/value composite uniqueness | duplicates possible; `Allergy` maps legacy `Allgy` |
| `NutritionReport` | generated guidance and acknowledgement | unique user | AI validation/clinical review uncertainty |
| `NutritionistProfile` | license/profile/verification and review/library relations | unique user and PRC number | verification/expiry not enforced on every nutritionist action |
| `FoodItem`, `FoodAlias` | nutrition records and lookup aliases | IDs only; food/alias names not unique | fuzzy first-match and duplicate alias risks |
| `MealPlan`, `MealIngredient` | per-slot plan and ingredient records | no group/status indexes shown; ingredient lacks amount/unit | actionability filtering and library provenance gaps |
| `MealLibrary`, `MealLibraryFlag` | approved reusable meals and cross-RND flags | lifecycle/origin/declaration-state/cross-contact/revision/reviewer/version/invalidation columns and two lifecycle/reviewer indexes; no normalized ingredients | legacy rows are explicitly incomplete, but historical-plan evidence fragility and no review history remain; current writer does not certify |
| Proposed `MealLibraryIngredient`, `MealLibrarySafetyDeclaration`, `MealLibrarySafetyReview` | stable library-owned ingredient provenance, explicit declarations, and append-only review audit | Design only; not present | separately authorize migration, retention, and workflow decisions before certification can function |
| `MealLog` | planned/outside logs | no unique user/plan | duplicates; timestamp/provenance semantics |
| `WeightLog`, `DailyNutritionLog` | progress history and daily aggregates | no user/date uniqueness | duplicated weight paths; daily race duplicates |
| `GroceryList`, `GroceryItem` | generated checklist | IDs only | no quantities; regeneration can reset progress |
| `Notification` | persisted in-app alerts | IDs only | polling only; indexes unverified |
| `PlanSwapTracker`, `SwapLog` | group swap cap/audit | unique planGroupId | group/user relationship and transaction behavior need tests |

No schema or migration changes are authorized in the first run. Before future uniqueness migrations, inspect live duplicate counts without exposing personal data, approve deterministic remediation, and define recovery.

---

## 11. Test register

| ID | Test title | Level | Expected result | Latest result | Evidence |
| --- | --- | --- | --- | --- | --- |
| TEST-001 | Backend TypeScript no-emit | Static | Exit 0 | Pass | `npx.cmd tsc --noEmit --incremental false`, backend, 2026-08-19 |
| TEST-002 | Frontend TypeScript no-emit | Static | Exit 0 | Pass | `npx.cmd tsc --noEmit --incremental false`, frontend, 2026-08-19 |
| TEST-003 | Prisma schema validation | Static | Schema valid | Pass | `npx.cmd prisma validate`, backend, 2026-08-19 |
| TEST-004 | Frontend lint without fix | Static | No errors | Pass with warnings | `npm.cmd run lint`, frontend, 2026-08-19 |
| TEST-005 | Current-document placeholder scan | Documentation/static | No template placeholders or TODO/TBD markers | Pass | `rg` scan of root/frontend README and `docs/`, 2026-08-19 |
| TEST-006 | Edited Markdown internal-link validation | Documentation/static | Every relative Markdown target exists | Pass | PowerShell Markdown-link target check, 2026-08-19 |
| TEST-007 | Completion-claim qualification scan | Documentation/static | No unqualified high-risk completion claims in current docs; retained legacy claims covered by notices | Pass | `rg` current/legacy claim scans, 2026-08-19 |
| TEST-008 | Documentation secret-pattern scan | Security/documentation | No credential values introduced or retained in edited documentation | Pass after remediation | Initial scan found DEF-017; final scan confirms redaction, 2026-08-19 |
| TEST-009 | Batch 1 documentation-only scope review | Configuration/documentation | Every file modified by Batch 1 is documentation | Pass | Focused `git diff --name-only` and `git status --short`, 2026-08-19 |
| TEST-010 | Mifflin-St Jeor sex-specific baselines | Backend unit | Deterministic male and female baselines match the implemented formula | Pass: 2 assertions | `npm.cmd test`, backend, 2026-08-19 |
| TEST-011 | Activity multipliers | Backend unit | All four activity levels apply their implemented multiplier | Pass: 4 assertions | `npm.cmd test`, backend, 2026-08-19 |
| TEST-012 | Goal adjustments | Backend unit | All four goals apply their implemented adjustment | Pass: 4 assertions | `npm.cmd test`, backend, 2026-08-19 |
| TEST-013 | Approved-meal actionability matrix and mutation/candidate guards | Backend policy/closest-boundary unit | Only approved, schedule-current owned plans are actionable; unknown statuses deny; only approved library candidates are eligible | Pass: 8 active cases | `npm.cmd test`; `tests/meal-actionability.test.ts`; REQ-002, ADR-007, DEF-008, RISK-001 |
| TEST-014 | Ineligible-plan exclusion, totals, history, and review separation | Backend policy/closest-boundary unit | Pending, rejected, cancelled, and expired rows are excluded from current/grocery/totals; rejected originals do not reappear; review/history remain defined | Pass: 7 active cases | `npm.cmd test`; `tests/meal-actionability.test.ts`; DEF-008/014, RISK-001/004/015 |
| TEST-015 | Enum/custom restriction consistency | Backend pure-policy unit | Enum/custom restrictions normalize mechanically; approved aliases map exactly; rejected mappings and NONE contradictions review | Pass: 13 active synthetic cases | `tests/restriction-policy.test.ts`; REQ-003/010, ADR-008, DEF-009, RISK-002 |
| TEST-016 | Unknown safety metadata and deterministic decisions | Backend pure-policy unit | Missing/unknown/estimated/unresolved/contradictory evidence never becomes implicit safe; exact allergy conflict blocks; precedence/reasons/output remain deterministic | Pass: 18 active synthetic cases | `tests/restriction-policy.test.ts`; REQ-003/006/010, ADR-008, DEF-009/024-026, RISK-002/006/018 |
| TEST-017 | Asia/Manila business boundary | Backend policy specification | Daily/weekly classification is independent of server timezone | TODO, not executed as passing behavior | Executable `node:test` TODO; REQ-009, ADR-005, DEF-015, RISK-011 |
| TEST-018 | Outside-meal preview confirmation | Backend workflow specification | Confirmation persists the exact acknowledged preview without re-estimation | TODO, not executed as passing behavior | Executable `node:test` TODO; DEF-018, RISK-004/006 |
| TEST-019 | Meal-log idempotency | Backend workflow specification | Retries cannot duplicate planned or daily logs | TODO, not executed as passing behavior | Executable `node:test` TODO; DEF-014, RISK-004/007 |
| TEST-020 | Review-claim concurrency | Backend workflow specification | Claims are atomic and owner/expiry-aware | TODO, not executed as passing behavior | Executable `node:test` TODO; DEF-013, RISK-004 |
| TEST-021 | Clinically approved calorie bounds | Backend clinical specification | Approved lower/upper bounds are enforced; the current 500 kcal floor is not presumed safe | TODO, blocked on clinical criteria | Executable `node:test` TODO; DEF-019, RISK-014, UNC-009 |
| TEST-022 | Batch 3B runtime/API/frontend smoke verification | Manual runtime/API/HTTP/static regression | Services start; harmless/public and protected boundaries behave; authenticated actionability, review, and browser flows execute only against a safe reachable environment | Substantially completed through Batch 3D: three-role authentication/RBAC, USER negative-state actionability, role read endpoints, and route shells pass; full browser interaction and positive approved-current USER path remain blocked | CHG-20260819-05/06/07; REQ-002; DEF-008/020/021/022; RISK-001/015/016/017; UNC-010/013 |
| TEST-023 | Database connectivity diagnosis and authenticated runtime unblocking | Manual network/TLS/Prisma/API integration | Expected env loads; URI is structurally valid; DNS/TCP/TLS/Prisma layers are classified without secrets; read-only existing-account checks run when safe | Pass: connectivity restored in permitted context; owner confirmed the shared persistent development/demo target; existing three-role accounts authenticate read-only | CHG-20260819-06/07; RISK-016/017; TEST-022/024 |
| TEST-024 | Owner-assisted three-role runtime and approved-meal boundary verification | Manual API/database-observed/HTTP route-shell/owner browser | Existing USER/NUTRITIONIST/ADMIN logins and RBAC pass; non-approved USER plans/logs are excluded; an owned invalid transition returns `409` without change; queue is pending-only; no records mutate | Pass for 42 runtime assertions and 28 automated tests; 0 final-cycle failures; 7 automated TODO; blocked: positive approved-current live path, full interactive browser matrix, stored-grocery provenance | CHG-20260819-07; REQ-002; DEF-008/020/022; RISK-001/015/016/017; UNC-010/013 |
| TEST-025 | Batch 4A restriction-vocabulary, rule-inventory, and aggregate-profile verification | Static inspection/read-only Prisma/documentation | Exact schema/frontend/backend keys and callers inventoried; privacy-safe aggregate profile produced in an explicitly read-only transaction; proposed policy covers required scenarios without implementation or clinical claims | Pass for Batch 4A design scope; TEST-015/016 remain TODO; no production behavior or database record changed | CHG-20260819-08; REQ-003/006/010; ADR-008; DEF-009/023-026; RISK-002/018; UNC-014 |
| TEST-026 | Batch 4B1 pure-policy regression, isolation, and scope verification | Backend unit/static/repository | TEST-015/016 pass; backend/frontend TypeScript, Prisma validation, lint, isolation, sensitive scan, diff check, no-production-import proof, and credential ignore/untracked checks satisfy the approved boundary | Pass; 64 registered backend tests: 59 pass, 0 fail, 0 skipped, 5 TODO | CHG-20260819-09; REQ-006/008/010; ADR-006/008; RISK-009/017/018 |
| TEST-027 | Meal-generation library compatibility adapter | Backend pure adapter unit | Only approved candidates with ALLOW and complete/resolved evidence are eligible; REVIEW/BLOCK/status/metadata/custom/provenance failures are excluded deterministically and privately | Pass: 18 active synthetic cases | `tests/meal-generation-library-compatibility.test.ts`; CHG-20260819-10; REQ-003/006/010; ADR-008; DEF-024/025; RISK-002/018 |
| TEST-028 | Meal-generation candidate filtering and fallback seam | Backend closest-boundary unit | Eligible candidates remain, REVIEW/BLOCK/non-approved candidates leave unmatched slots, one injected fallback batch fills them, eligible slots do not call fallback, and plan-status data is unchanged | Pass: 9 active synthetic cases; no Gemini/Prisma/network import | `tests/meal-generation-library-compatibility.test.ts`; CHG-20260819-10; REQ-003/008/010; ADR-006/008; DEF-024/025; RISK-009/018 |
| TEST-029 | Batch 4B3 library evidence/provenance design and aggregate profile | Static inspection/read-only Prisma/documentation | Schema/migrations/workflows/UI/adapter dependency are inventoried; explicit lifecycle/data/workflow/migration/API/UI/adapter/test design is complete; aggregate query is read-only and privacy-safe; zero record is certified or changed | Pass for design/profile scope: 2 legacy rows profiled, 0 with fully FNRI-linked combined historical ingredients, 0 records changed; implementation/runtime/clinical verification not run | `docs/NUTRIMIND_LIBRARY_SAFETY_EVIDENCE_DESIGN.md`; CHG-20260820-01; REQ-011; ADR-009; DEF-027; RISK-019; UNC-015 |
| TEST-030 | Batch 4B4 additive lifecycle migration, defaults, preservation, and compatibility regression | Prisma validate/format/status/diff/deploy; SQL scan; explicit read-only aggregate snapshots; backend tests; backend/frontend no-emit; frontend lint; repository audit | Prior history clean and schema in sync; one additive migration applies; both legacy rows become incomplete and none complete; counts/hashes/relations preserved; old source needs no new fields; active regressions pass | Pass: migration status/schema diff clean before and after; 0 domain rows created/updated/deleted; 91 backend tests registered, 86 pass, 5 TODO; both type checks and lint pass, with existing lint warnings; client generation limitation recorded | `schema.prisma`; `20260820090000_add_meal_library_evidence_lifecycle`; CHG-20260820-02; REQ-011; ADR-009; DEF-027; RISK-019; DOC-016 |
| TEST-031 | Batch 4B4R post-recovery generated-client verification | Local generated DMMF/exports; backend tests; backend/frontend no-emit; Prisma validation; frontend lint; Git/hash/artifact/credential/port audit | Generated Prisma Client v5.22.0 recognizes all four lifecycle enums, thirteen lifecycle scalar fields, and the optional named reviewer relation; regressions pass; no repository or database side effect | Pass: 91 tests registered, 86 pass, 0 fail, 5 TODO; both type checks and validation pass; lint passes with 22 existing warnings; zero tracked/untracked engine artifacts; authorized hashes unchanged | CHG-20260820-03; REQ-011; ADR-009; TEST-030; DOC-017 |
| TEST-032 | Stabilization Checkpoint S1 readiness and commit-boundary assessment | Complete Git status/diff classification; completed-batch inventory comparison; TODO production-path inspection; risk/defect/uncertainty re-ranking; B4B4R baseline reuse | Every changed/untracked path is assigned to cleanup, owner work, generated output, documentation, local-only, or owner-confirmation scope; commit groups and hold paths are explicit; no repository/database mutation occurs | Pass for assessment scope: 158 changed/untracked paths classified; B4B4R application/schema/migration/test/dependency baseline unchanged, so 91-test/static results reused rather than rerun | CHG-20260820-04; RISK-010; DEF-003; UNC-002; DOC-018 |
| TEST-033 | Stabilization Checkpoint S1A bounded commit execution and post-commit regression | Exact-path/hunk-level staging audit; four local commits; backend tests; backend/frontend no-emit; Prisma validation; frontend lint; Git/artifact/credential/port audit | Four approved cleanup groups are committed without absorbing owner work, generated output, held documents, credentials, or unrelated artifacts; established regression baseline remains passing | Commit execution recorded here with the first three hashes; final post-commit commands and GO decision are reported after the documentation commit and are not self-recorded by amending it | CHG-20260820-05; TEST-030/031/032; DOC-019 |
| TEST-034 | Feature F1 accessible password visibility controls | Complete rendered-password inventory; component/call-site and caret-restoration source assertions; frontend TypeScript no-emit; frontend lint; live server-rendered markup checks; browser-tool availability check | Eight existing password fields use independent hidden-by-default controls with native non-submit buttons, bidirectional type switching, dynamic accessible labels, pressed state, eye/eye-off icons, focus styling, unchanged controlled values/validation props, and post-type-change caret/selection restoration | Pass for source/static/type/lint and public initial-render scope: 8/8 fields covered; login/register/reset return `200` and expose 5/5 hidden fields with `Show password`; TypeScript passes; lint remains 22 existing warnings. Owner re-verification showed that layout-effect-only restoration was still overwritten by the browser; the correction now captures before pointer activation and restores both immediately and on the next animation frame. Interactive caret/range/keyboard re-verification remains owner-assisted because browser automation was unavailable | CHG-20260820-06; DOC-020 |
| TEST-035 | Defect D1 auth-navigation and pending-generation result contract | Four synthetic result-policy tests; backend suite; both no-emit checks; Prisma validation; lint; source assertions; authenticated read-only USER/current and three-role RBAC checks; owner-restarted runtime | Empty generation results throw; dashboard and Meal Plan expose every pending row as a safe preview with per-meal unverified labeling and no actions; the normal dashboard date selector and trackers remain visible but exclude pending estimates; connected responsive cards preserve the same safety boundary; existing pending state survives reload; AuthProvider has no router call in a state updater; no sensitive Gemini raw output is logged | Pass for unit/static/API scope: 95 registered, 90 pass, 0 fail, 5 TODO; authenticated current returned 0 actionable and all 9 STARTER previews, with all required fields and no internal IDs/status. Owner confirmed dashboard previews render; date/tracker, Meal Plan connection, and visual polish pass frontend type/lint/source/whitespace and route-shell checks, with final appearance owner-assisted | CHG-20260820-07; DEF-028/029; DOC-021 |
| TEST-036 | Frontend visual-system, public documentation, and shared portal-shell verification | Frontend TypeScript no-emit; Next lint; focused whitespace/source checks; live owner-server route-shell checks for public and all three role groups; browser-tool availability check | Landing and `/docs` compile; shared role-aware sidebar remains collapsible and local-storage-backed; USER/NUTRITIONIST/ADMIN layouts use one portal shell; existing API/auth/meal behavior is unchanged | Pass for source/static/HTTP scope: TypeScript exits 0; lint exits 0 with 21 pre-existing warnings and no visual-system finding; `/`, `/docs`, `/dashboard`, `/meals`, `/nutritionist/reviews`, and `/admin/overview` return 200. Final responsive visual judgment remains owner-assisted because the in-app browser is unavailable | CHG-20260820-08; DOC-022 |
| TEST-037 | Landing-system parity across authentication and authenticated role pages | Frontend TypeScript no-emit; Next lint; focused rewritten-file whitespace/source checks; owner-server HTTP route-shell compilation for five auth routes, six USER routes, five NUTRITIONIST routes, and four ADMIN routes; browser-tool availability check | Auth and role pages use the landing visual language; shared Card avoids accidental double padding; all role destinations compile without changing data/API/auth behavior | Pass for source/static/HTTP scope: TypeScript exits 0; lint exits 0 with the same 21 warnings and no parity-change finding; all 20 requested route shells return 200. Final browser visual/responsive/interaction judgment remains owner-assisted because the in-app browser is unavailable | CHG-20260821-01; DOC-023 |
| TEST-038 | Onboarding policy, validation, consent, and OTP regression | Eight synthetic policy/schema cases; full backend test suite; backend/frontend TypeScript no-emit; Prisma validation/client generation; frontend lint; SQL/package/Git/artifact/whitespace checks | Canonical resume order; completion gate; legacy/current consent; adult/allow-list/goal bounds; NONE contradictions; exact consent versions; OTP cooldown/lock; generated Client recognition; no database mutation | Pass for source/unit/static scope: 108 registered, 104 passed, 0 failed, 4 pre-existing TODO; both no-emit checks and schema validation pass; client v5.22.0 regenerated after owner stopped backend; lint exits 0 with 21 pre-existing warnings; live authenticated new-account flow not run because migration was intentionally not applied | CHG-20260827-01; DOC-024 |
| TEST-039 | Onboarding migration and runtime prerequisite acceptance | Owner migration deployment; owner-controlled backend health; existing USER credential login/profile/protected current-meal checks; synthetic registration/profile/pre-verification write/OTP lock checks; invalid existing-USER DTO requests | New columns readable; legacy account remains ready; strict DTOs reject before mutation; new account resumes at stats; unverified account cannot write onboarding; persistent lock blocks resend | Pass for available runtime scope: health/login/profile/current meal 200; three new consent fields and onboarding status present; unknown field and two NONE contradictions 400; synthetic registration 201/email sent; unverified onboarding write 403; six invalid codes 400 and post-lock resend 400. OTP-success and post-verification browser completion not run because codes are credentials | CHG-20260827-02; DOC-025 |

TEST-004 warnings include unused imports/variables, explicit `any`, missing React hook dependencies, unescaped JSX apostrophes, and a raw `<img>` warning.

Cleanup Batch 4B2's backend run reports 91 registered tests: 86 pass, 0 fail, 0 skipped, and 5 TODO. The 13 Batch 2A cases, 15 Batch 3 actionability cases, and 31 Batch 4B1 pure-policy cases remain passing; TEST-027/028 contribute 27 active adapter/caller cases. TEST-017 through TEST-021 remain executable TODO specifications and are not passing evidence.

Batch 3D added authenticated three-role API/database-observed evidence, owner-confirmed traditional and Google USER login/dashboard evidence, and HTTP route-shell checks. No database record mutation, automated OAuth, email delivery, Gemini, PDF, cron, accessibility, performance, deployment, or clinical validation test was executed. Full browser E2E/hydration evidence remains unavailable. The frontend still has no test script. No `.github` CI directory was found.

---

## 12. Chronological change log

### CHG-20260819-01 - Establish Phase 0-1 engineering evidence

- Date: 2026-08-19
- Request/source: Owner instructed the agent to follow Markdown guides inside `codex/`; first-run cleanup prompt limits work to Phases 0-1.
- Objective: preserve and measure the baseline, map the actual system, register contradictions/risks, and propose bounded cleanup work.
- Final status: Analysis/documentation only
- Risk classification: Medium
- Clinical-safety-impacting: No behavior changed; clinical risks documented
- Security-impacting: No behavior changed; security risks documented
- Schema/migration-impacting: No

Before:

- No `docs/NUTRIMIND_ENGINEERING_RECORD.md` existed.
- Current implementation and verification evidence was distributed across executable code and conflicting legacy material.

Changes:

| File/object | Change | Reason |
| --- | --- | --- |
| `docs/NUTRIMIND_ENGINEERING_RECORD.md` | Created living evidence record from the supplied template | Required by Codex master/cleanup guides |
| `docs/NUTRIMIND_CLEANUP_PLAN.md` | Created proposed bounded cleanup plan | Required Phase 0-1 deliverable |

Traceability:

- Requirements: REQ-001 through REQ-008
- Decisions: ADR-001 through ADR-005 (all proposed)
- Defects: DEF-001 through DEF-016
- Risks: RISK-001 through RISK-012
- Tests: TEST-001 through TEST-004
- Documentation: DOC-001, DOC-002

Verification:

| Command or procedure | Type | Result | Notes |
| --- | --- | --- | --- |
| `git status --short; git branch --show-current; git log -5 --oneline --decorate` | Static repository inspection | Pass | Dirty tree preserved |
| `npx.cmd tsc --noEmit --incremental false` (backend) | Static | Pass | No output/errors |
| `npx.cmd tsc --noEmit --incremental false` (frontend) | Static | Pass | No output/errors |
| `npx.cmd prisma validate` | Static schema | Pass | Loaded local env without displaying values; schema valid |
| `npm.cmd run lint` | Static | Pass with warnings | No auto-fix used |

Not verified:

- Runtime application behavior and all external/live services.
- Builds, formatters, generators, migrations, seeds, and package upgrades were intentionally not run.

Known limitations/follow-up:

- All ADRs remain proposed until owner approval.
- Pre-existing dirty changes remain unclassified by owner intent.

Documentation extraction notes:

- SPMP: baseline, risks, phases, change/configuration control.
- SRS: actors, feature status, prerequisite/actionability requirements.
- SDD: current architecture, routes, data relationships, external interfaces, proposed ADRs.
- STD: static baseline commands/results and missing test levels.

---

### CHG-20260819-02 - Cleanup Batch 1 canonical documentation and repository hygiene

- Date: 2026-08-19
- Request/source: Owner-approved Cleanup Batch 1 authorization and accepted ADR-001 through ADR-005.
- Objective: make repository documentation accurately describe the accepted architecture, implementation/verification status, setup, environment names, known limitations, and legacy-document classifications.
- Final status: Completed
- Risk classification: Medium documentation/configuration-governance work
- Clinical-safety-impacting: No application behavior changed; unsafe clinical claims were qualified
- Security-impacting: Documentation-only; DEF-017 credential-shaped value was redacted and RISK-013 opened
- Schema/migration-impacting: No

Before:

- ADR-001 through ADR-005 were proposed rather than accepted.
- There was no root contributor README.
- The frontend README was generic Create Next App text and implied a standalone deployment path.
- Multiple legacy prompts/references presented intended, missing, or statically checked behavior as complete/current.
- Environment names and purposes were not consolidated in a safe contributor reference.
- Two legacy documents contained an unredacted Gmail app-password-shaped value.

Changes:

| File/object | Change | Reason |
| --- | --- | --- |
| `README.md` | Created contributor entry point covering architecture, folders, setup, Prisma workflow, static checks, environment names, integrations, and gaps | Acceptance criteria 2, 5, 6, and 7 |
| `nutrimind-frontend/README.md` | Replaced generic framework boilerplate with NutriMind frontend setup/status and canonical links | Prevent standalone/full-stack/deployment ambiguity |
| `docs/NUTRIMIND_ENGINEERING_RECORD.md` | Accepted ADRs; added Batch 1 tests/change evidence, classifications, risk/defect/security findings, and extraction updates | Canonical traceability requirement |
| `docs/NUTRIMIND_CLEANUP_PLAN.md` | Marked Batch 1 complete and retained Batches 2-11 as separately approvable proposals | Prevent accidental start of Batch 2 |
| `AGENTS.md` | Added partially superseded notice; corrected high-impact architecture/status/session/PWA/claim/endpoint/layering claims; preserved operational instructions | Keep guidance useful without treating claims as evidence |
| `AI_AGENT_PROMPT.md`, `NUTRIMIND_MASTER_PROMPT.md`, `NUTRIMIND_HANDOFF_GUIDE.md` | Added historical/aspirational or partially superseded notices and canonical links | Resolve instruction precedence conflicts without deletion |
| `NUTRIMIND_SYSTEM_REFERENCE.md` | Labelled aspirational draft/partially superseded | Separates intended design from verified behavior |
| `NUTRIMIND_SYSTEM_REFERENCE_FOR_SPMP_SRS.md` | Labelled historical audit snapshot/current-but-unverified where applicable | Preserve useful gap analysis while making the living record canonical |
| `NUTRIMIND_FULL_SYSTEM_REFERENCE.md` | Labelled current-but-unverified snapshot/partially superseded | Qualify implementation/completion history |
| `UPDATE_LOG.md` | Labelled historical changelog | Changelog entries are not current verification evidence |
| `ADDENDUM_6_UNIFIED_MEALS_PAGE.md`, `GEMINI_TASK_ADDENDUM6.md` | Labelled historical specification/instructions | Prevent replay as a current task |
| `chatgptcontext.md` | Labelled non-canonical audit snapshot | Point portable context to the living record |
| `nutrimind-backend-prompt.txt`, `nutrimind-frontend-prompt.txt` | Added historical/aspirational notices | Preserve original planning prompts without current authority |
| `AI_AGENT_PROMPT.md`, `NUTRIMIND_HANDOFF_GUIDE.md` | Redacted a Gmail app-password-shaped value | Resolve DEF-017 in the working tree; RISK-013 remains for history/rotation |

Legacy classifications:

- Historical and aspirational/partially superseded: `AI_AGENT_PROMPT.md`, `NUTRIMIND_MASTER_PROMPT.md`, both package prompt text files.
- Historical handoff/partially superseded: `NUTRIMIND_HANDOFF_GUIDE.md`.
- Aspirational draft/partially superseded: `NUTRIMIND_SYSTEM_REFERENCE.md`.
- Historical audit snapshot/current but unverified where applicable: `NUTRIMIND_SYSTEM_REFERENCE_FOR_SPMP_SRS.md`.
- Current but unverified snapshot/partially superseded: `NUTRIMIND_FULL_SYSTEM_REFERENCE.md`.
- Historical changelog: `UPDATE_LOG.md`.
- Historical specification/instructions: Addendum 6 documents.
- Partially superseded operational guide: `AGENTS.md`.
- Current non-canonical audit snapshot: `chatgptcontext.md`.

Traceability:

- Requirements: REQ-001, REQ-007, REQ-008
- Decisions: ADR-001 through ADR-005 (accepted)
- Defects: DEF-001, DEF-003, DEF-004, DEF-006, DEF-007, DEF-011, DEF-012, DEF-017
- Risks: RISK-009, RISK-010, RISK-012, RISK-013
- Tests: TEST-005 through TEST-009
- Documentation: DOC-001 through DOC-006

Verification:

| Command or procedure | Type | Result | Notes |
| --- | --- | --- | --- |
| `rg` placeholder/TODO scan over current docs | Documentation/static | Pass | No template placeholders or TODO/TBD markers |
| PowerShell relative Markdown-link target validation | Documentation/static | Pass | All edited Markdown relative targets exist |
| `rg` completion-claim scans over current and legacy docs | Documentation/static | Pass | Current docs contain no unqualified high-risk claims; historical occurrences intentionally retained behind notices |
| `rg` common credential/private-key/connection-string scan | Security/documentation | Pass after working-tree redaction | DEF-017 remains open for rotation/history follow-up; placeholder URLs intentionally retained |
| Focused `git diff --name-only` and `git status --short` for Batch 1 paths | Configuration/documentation | Pass | Batch-created/edited files are documentation only |

Not verified:

- Application runtime, database, Gemini, OAuth, SMTP, PDF, cron, browser, integration, E2E, deployment, accessibility, performance, and clinical behavior were not exercised because Batch 1 authorized documentation only.
- Builds, migrations, seeds, formatters, generators, package changes, environment changes, and generated-output changes were not performed.

Known limitations/follow-up:

- Historical bodies retain completion terminology for provenance; each affected document now has a notice, and the `AGENTS.md` legacy feature table is explicitly superseded.
- The credential-shaped value may remain in Git history. If it was ever valid, revoke/rotate it and assess repository access/history under RISK-013.
- The 132 tracked backend `dist` files remain untouched and require separate approval before any untracking action.
- At the conclusion of Batch 1, Cleanup Batch 2 had not started and required separate review/approval; Batch 2A was subsequently authorized and recorded in CHG-20260819-03.

Documentation extraction notes:

- SPMP: accepted architecture/configuration control, bounded Batch 1 scope, dirty-tree preservation, documentation/security risks, and next-phase dependency.
- SRS: approved architecture constraint, truth-status vocabulary, known missing workflows, and external-interface configuration names.
- SDD: accepted system topology, custom JWT boundary, Asia/Manila time decision, package responsibilities, and external integrations.
- STD: documentation verification procedures/results plus explicit absence of automated/runtime evidence.

---

### CHG-20260819-03 - Cleanup Batch 2A minimal backend test baseline

- Date: 2026-08-19
- Request/source: Owner-authorized Cleanup Batch 2A attachment.
- Objective: establish the smallest deterministic backend automated-test foundation without changing production behavior or contacting live services.
- Final status: Completed
- Risk classification: Low test/configuration change; clinical defects specified but not altered
- Clinical-safety-impacting: No behavior changed; unsafe expectations remain TODO rather than being blessed as passing
- Security-impacting: Synthetic reserved data only; no real credentials, tokens, or health records used; DEF-017 and RISK-013 remain open
- Schema/migration-impacting: No

Before:

- The backend had no automated test script, test configuration, synthetic fixture baseline, or executable critical-behavior specifications.
- Pure calculation logic could be imported without live services, but most workflow modules cross Prisma or external-service boundaries and were not safe to expand under the no-production-change restriction.

After:

- One local `npm test` command type-checks and runs isolated TypeScript tests with no new dependency.
- Thirteen deterministic tests pass, while nine known safety/workflow expectations are explicitly registered as TODO and remain unverified.
- Production application behavior, schemas, APIs, UI, authentication, and external integrations are unchanged by this batch.

Framework decision:

- Selected Node's built-in `node:test` and `node:assert/strict`, executed through the existing `tsx` dependency.
- Considered Vitest, but its additional Vite dependency graph was unnecessary for the initial pure-unit scope.
- Considered Jest plus `ts-jest`, but it would add more packages and TypeScript/CommonJS mapping configuration.
- Added no dependency and made no package-lock change attributable to this batch. Pre-existing `cookie-parser` manifest/lock changes were preserved.

Changes:

| File/object | Change | Reason |
| --- | --- | --- |
| `nutrimind-backend/package.json` | Added deterministic `npm test` script | One documented local entry point |
| `nutrimind-backend/tests/tsconfig.json` | Added no-emit test-only TypeScript configuration | Type-check tests without changing production compilation |
| `nutrimind-backend/tests/fixtures/synthetic.ts` | Added reserved `.invalid` identities, `fixture-*` IDs, role/profile/restriction cases, and plan states | Deterministic coverage without personal or production-like data |
| `nutrimind-backend/tests/calculations.test.ts` | Added formula, activity, and goal unit cases | Passing baseline for a pure module; deliberately excludes the unapproved 500 kcal floor |
| `nutrimind-backend/tests/fixtures.test.ts` | Added fixture integrity tests | Prevent fixture drift toward real identities or missing state coverage |
| `nutrimind-backend/tests/critical-behavior.todo.test.ts` | Added nine executable TODO safety/workflow specifications | Preserve expected safe outcomes without encoding known defects as passing |
| `nutrimind-backend/tests/README.md` | Documented runner, isolation boundary, TODO meaning, and prohibited live imports | Keep the baseline safe and maintainable |
| Current engineering/cleanup docs and root `README.md` | Recorded exact status and commands | Keep repository evidence truthful |

Traceability:

- Requirements: REQ-002, REQ-003, REQ-005, REQ-006, REQ-008, REQ-009
- Decisions: ADR-004, ADR-005, ADR-006
- Defects: DEF-008, DEF-009, DEF-013, DEF-014, DEF-015, DEF-017, DEF-018, DEF-019
- Risks: RISK-001, RISK-002, RISK-004, RISK-006, RISK-007, RISK-009, RISK-011, RISK-013, RISK-014
- Tests: TEST-010 through TEST-021
- Uncertainties: UNC-009
- Documentation: DOC-002, DOC-003, DOC-007

Verification:

| Command or procedure | Type | Result | Notes |
| --- | --- | --- | --- |
| `npm.cmd install --ignore-scripts` | Dependency/install consistency | Pass | Lockfile already satisfied; no test dependency added |
| `npm.cmd test` | Backend unit/specification | Pass | 22 registered: 13 pass, 0 fail, 0 skipped, 9 TODO |
| Credential/integration environment-cleared `npm.cmd test` | Isolation | Pass | Same counts with database, Gemini, Google, SMTP, JWT, and cron variables removed from the child process |
| `npx.cmd tsc --noEmit --incremental false` (backend) | Static | Pass | No errors |
| `npx.cmd tsc --noEmit --incremental false` (frontend) | Static | Pass | No errors |
| `npx.cmd prisma validate` | Static schema | Pass | Schema valid; no migration or live application query |
| `npm.cmd run lint` (frontend) | Static | Pass with warnings | Same warning classes as baseline; no auto-fix |
| Test import and synthetic-fixture scans | Isolation/security | Pass | No Prisma client construction, application server import, external HTTP client, live identity, token, or secret fixture |
| `git diff --check` | Repository hygiene | Blocked by pre-existing owner changes | Existing trailing whitespace reported only in previously modified backend `dist` and frontend source files; Batch 2A package/test paths pass focused whitespace review |
| Focused `git status`/diff review | Scope control | Pass for Batch 2A scope | Only test/config/documentation additions attributable to this batch; pre-existing production and `cookie-parser` changes preserved |

Not verified:

- The nine TODO behaviors remain unimplemented/unverified and do not count as passing safety coverage.
- No application server, database query, Gemini, Google OAuth, SMTP, DiceBear, PDF, cron, browser, external HTTP, API integration, E2E, deployment, CI, or clinical validation was run.
- No production source, frontend source, schema, migration, controller, route, service, deployment, CI, environment, or generated file was changed by Batch 2A.

Known limitations/follow-up:

- At the conclusion of Batch 2A, TEST-013 through TEST-020 required separately approved production policy seams/fixes. Batch 3 subsequently activated TEST-013/014; TEST-015 through TEST-020 remain TODO, and TEST-021 additionally requires RND-approved bounds under UNC-009.
- DEF-017 and RISK-013 remain open until credential rotation and repository-history/access decisions are documented.
- The owner-authored dirty working tree and pre-existing `cookie-parser` changes remain preserved.
- Cleanup Batch 2A stops here; Batch 2B/Batch 3 require separate review and approval.

Documentation extraction notes:

- SPMP: Batch 2A scope, dependency decision, local quality-gate outcome, preserved dirty-tree boundary, and separately approvable next work.
- SRS: executable specifications for actionability, restrictions, safety metadata, time boundaries, preview identity, idempotency, concurrency, and clinically governed calorie bounds.
- SDD: ADR-006 test-runner choice, test-only TypeScript boundary, synthetic fixture design, and documented production-module testability limitations.
- STD: TEST-010 through TEST-021, exact 13 pass/0 fail/0 skipped/9 TODO counts, isolation evidence, static regression results, and explicit non-executed test levels.

---

### CHG-20260819-04 - Cleanup Batch 3 approved-meal actionability boundary

- Date: 2026-08-19
- Request/source: Owner-authorized Cleanup Batch 3 attachment plus explicit prohibition on Git-history/file cleanup.
- Objective: ensure only explicitly approved, schedule-current meals can participate in user actions, current results, groceries, current totals, or swaps while preserving history and nutritionist review.
- Final status: Completed in application source with pure/closest-boundary unit verification; API/database integration unverified
- Risk classification: Critical; `CLINICAL-SAFETY-IMPACTING`
- Security-impacting: No authorization model change; owner-scoped lookups and cross-user non-disclosure behavior preserved
- Schema/migration-impacting: No
- Git/history-impacting: No history command, tracked-file removal, historical-document reorganization, or unrelated cleanup performed

Root cause and prior behavior:

- User-facing current and grocery group selection admitted `APPROVED` and `PENDING_REVIEW`; the second group queries omitted status filters and could reintroduce rejected originals beside replacements.
- Planned status mutations and swap entry points loaded an owned row but did not require approval/current schedule eligibility.
- Replacement/library and aggregate filters were repeated across services; some totals could include logs linked to non-approved plans.
- Meal-plan expiry has no schema field and was inconsistently inferred from `scheduledDate` using server-local time.

Status-policy matrix:

| Meal-plan status | User-actionable | Read-only/history | Current plan | Planned log | Grocery | Current totals | Swap original | Library candidate | Nutritionist queue |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `APPROVED` | Yes when schedule-current | Yes | Yes when schedule-current | Yes when schedule-current | Yes when schedule-current | Yes | Yes when schedule-current | N/A | No; approved archive preserved |
| `PENDING_REVIEW` | No | Yes where existing history/status views represent it | No | No | No | No | No | N/A | Yes |
| `REJECTED` | No | Yes for audit/history | No | No | No | No | No | N/A | No; already reviewed |
| `CANCELLED` | No | Yes for audit/history | No | No | No | No | No | N/A | No |

Library status matrix:

| Meal-library status | Generation/replacement candidate | Nutritionist visibility |
| --- | --- | --- |
| `APPROVED` | Yes | Preserved |
| `FLAGGED` | No | Preserved for library/flag resolution |

Unknown, null, invalid, or future statuses and invalid dates default to non-actionable. Because Prisma has no expiry field, an approved row is schedule-current only when its `scheduledDate` is today or later in `Asia/Manila`.

After behavior:

- `POST /api/user/meals/generate` preserves pending rows for review but returns only approved/current rows in its actionable `meals` array; newly pending plans therefore do not immediately expose actions.
- `GET /api/user/meals/current` selects an approved/current group and applies the same approved/current filter to every returned row. Rejected originals, pending replacements, cancelled rows, and expired rows cannot re-enter through the group query.
- `PATCH /api/user/meals/:id/status` re-checks owned-row actionability before creating/updating a planned log. An owned ineligible row returns `409`; a cross-user/nonexistent row retains not-found behavior.
- Swap options, previews, and execution re-check the approved/current original; previews/totals use approved rows; replacement and compatible-library queries accept only `MealLibraryStatus.APPROVED`.
- Grocery generation selects and aggregates only approved/current rows.
- Outside-meal projected totals, daily cron totals, and swap-triggered daily recalculation exclude plan-linked logs unless the linked plan is approved; outside logs remain eligible.
- Nutritionist review queue selection remains `PENDING_REVIEW`; approved archive, review detail/transitions, history logs, admin counts, and all stored records remain available.

Production consumers changed:

| Consumer | Focused change |
| --- | --- |
| `meals.controller.ts` | Generation/current query filters, group re-filter, owner query helper, planned-log guard, `409` mapping for ineligible user actions |
| `grocery.service.ts` | Approved/current group selection and row aggregation |
| `meal-swap.service.ts` | Original guards, approved candidates, approved day totals, eligible log totals |
| `meal-generation.service.ts` | Central approved-library candidate filter; lifecycle cancellation behavior unchanged |
| `meal-log.service.ts` | Projected totals exclude logs linked to non-approved plans |
| `cron.service.ts` | Daily totals exclude logs linked to non-approved plans |
| `user.service.ts` | Central approved-library/historical-approved source filters; internal safety recheck states unchanged |
| `nutritionist.service.ts` | Central pending-review queue and approved-archive filters; review transitions unchanged |

Inspected but intentionally unchanged:

- `getMealDetails` remains an owner-scoped read-only detail response; mutations independently enforce actionability.
- `getPlanHistory` preserves historical logs regardless of current plan status.
- Nutritionist review detail, approve/reject, replacement generation, approved archive shape, library browsing, and flag resolution retain their existing lifecycle/history behavior.
- Admin approved/pending counts remain analytics, not user actionability.
- Meal generation cancellation of prior `APPROVED`/`PENDING_REVIEW` groups remains a lifecycle transition.
- User safety recheck continues inspecting both approved and pending rows and may approve an already verified library replacement; this explicit internal safety workflow is not a user action.
- Frontend consumers were compatibility-inspected but not changed: dashboard, meals, detail, export, grocery, check-in generation, history, swap/library, and nutritionist pages.
- Existing grocery-list retrieval/PDF cannot validate pre-policy provenance because `GroceryList` has no plan-group link (DEF-020).

Files/objects affected:

- Added `src/domain/meal-actionability.policy.ts`.
- Updated the eight backend consumers listed above, the backend test script, actionability tests/TODO registry, test documentation, and canonical project documentation.
- No database object, schema, migration, seed, frontend, dependency, lockfile dependency resolution, authentication, CI, deployment, environment, generated output, Git history, or historical guidance file was changed by Batch 3.

Tests and traceability:

- Requirements: REQ-002, REQ-008, REQ-009
- Decisions: ADR-005, ADR-006, ADR-007
- Defects: DEF-008, DEF-014 (actionability facet only), DEF-020
- Risks: RISK-001, RISK-004, RISK-009, RISK-011, RISK-015
- Tests: TEST-013 and TEST-014 activated; TEST-010 through TEST-012 regression; TEST-015 through TEST-021 remain TODO
- Uncertainties: UNC-010
- Documentation: DOC-002, DOC-003, DOC-007, DOC-008

Verification:

| Command or procedure | Type | Result | Notes |
| --- | --- | --- | --- |
| Environment-cleared `npm.cmd test` | Backend unit/closest-boundary | Pass | 35 registered: 28 pass, 0 fail, 0 skipped, 7 TODO |
| `npx.cmd tsc --noEmit --incremental false` (backend) | Static | Pass | No errors |
| `npx.cmd tsc --noEmit --incremental false` (frontend) | Static regression | Pass | No errors |
| `npx.cmd prisma validate` | Static schema | Pass | Existing schema valid; no migration/query |
| `npm.cmd run lint` (frontend) | Static regression | Pass with warnings | Existing warning classes; no auto-fix |
| Remaining status/query searches | Policy review | Pass with documented intentional cases | User-facing actionability conditions centralized; lifecycle/review/analytics conditions retained |
| Test import/network scan | Isolation | Pass | Tests import pure policy/calculations/fixtures only; no Prisma client construction, server, database, or external HTTP |
| `git diff --check` plus focused review | Repository hygiene | Global pre-existing whitespace remains; Batch 3 paths pass | Unrelated owner changes preserved |

Not verified:

- No Express server, live PostgreSQL/Neon, Prisma query, Gemini, OAuth, SMTP, DiceBear, PDF, cron execution, browser flow, API integration, E2E, deployment, CI, or clinical review was run.
- Pure/query-builder tests verify the policy and closest safe seams; they do not prove the live Prisma result sets or HTTP status mapping end to end.
- Existing persisted grocery lists, meal logs, and daily aggregates were not inspected, rewritten, or backfilled.

Known limitations/follow-up:

- DEF-020/RISK-015/UNC-010 cover pre-policy stored data and missing grocery provenance.
- TEST-017 remains TODO for system-wide timezone/cron behavior; Batch 3 tests only the actionability business-date boundary.
- DEF-014 duplicate/idempotency and timestamp/provenance defects remain open outside the actionability facet.
- Rollback is the policy plus its focused callers/tests/docs; no database rollback is required.

Documentation extraction notes:

- SPMP: completed clinical-safety Batch 3 scope, preserved configuration/history, rollback unit, residual integration/data risks, and next phase gate.
- SRS: explicit status matrices, default-deny rules, current/history separation, mutation/error acceptance criteria, ownership preservation, and actionability traceability.
- SDD: central policy exports, `Asia/Manila` schedule rule, database-filter plus mutation-recheck design, consumer map, and API `409` state behavior.
- STD: TEST-013/014 activation, synthetic policy/query fixtures, 28 pass/0 fail/0 skipped/7 TODO result, isolation evidence, and unverified integration levels.

---

### CHG-20260819-05 - Cleanup Batch 3B runtime and API smoke verification

- Date: 2026-08-19
- Request/source: Owner-authorized Cleanup Batch 3B attachment.
- Objective: exercise the approved-meal actionability boundary through the actual local backend/frontend runtime as far as the configured environment safely permits.
- Final status: Partially completed; startup, public/protected HTTP boundaries, server-side route compilation, source compatibility, unit regression, and static checks verified; authenticated database-backed and browser checks blocked.
- Risk classification: High; `CLINICAL-SAFETY-IMPACTING` verification.
- Security-impacting: Verification only; authentication implementation unchanged.
- Schema/migration-impacting: No.
- Data/Git impact: no database record was created, updated, deleted, approved, rejected, logged, swapped, regenerated, or backfilled; no Git-history command or historical Markdown reorganization occurred.

Environment and diagnosis:

- Required backend and frontend environment-variable names were inventoried without displaying values.
- The configured database destination was classified as remote Neon with an ambiguous database name. It could not be proven to be development/test, so all potentially mutating checks were prohibited.
- Both documented seed-account credential logins reached `POST /api/auth/login` and returned sanitized `400` responses. A subsequent aggregate-only Prisma connectivity probe could not reach the database, including after approved network access, so the login outcome is environmental/blocked rather than evidence of a Batch 3 regression.
- The initial documented backend startup automatically attempted SMTP transporter verification because credentials were configured. The connection failed and no email was sent. Subsequent startup masked SMTP username/password in the child environment to avoid another external attempt. This pre-existing behavior is DEF-021.
- The in-app browser was unavailable. Browser console, hydration, client navigation, network panels, route-guard behavior, infinite-loading checks, and authenticated role layouts therefore remain blocked.

Runtime result table:

| Check ID | Role | Endpoint/page | Preconditions/data used | Expected | Actual | Result | Mutated data | Evidence | Related IDs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| B3B-01 | Public | Backend `npm.cmd run dev` | Existing local config; no seed/migration | Listen on configured/default port | Started on port 5000 in development mode | Pass | No | Console | TEST-022, RISK-012 |
| B3B-02 | Public | `GET /health` | Running backend | `200` health response | `200`, success response | Pass | No | HTTP | TEST-022 |
| B3B-03 | Public | Frontend `npm.cmd run dev` | Existing `.env.local` | Compile and listen on port 3000 | Ready in 3.1 seconds | Pass | No | Console | TEST-022, RISK-012 |
| B3B-04 | Public | `/login` | Running frontend | Route compiles and returns HTML | `200`, compiled without server error marker | Pass | No | HTTP/console | TEST-022 |
| B3B-05 | ADMIN/NUTRITIONIST | `POST /api/auth/login` | Two repository-defined seed accounts; remote DB required | Credential login succeeds when accounts/database are available | Both returned sanitized `400`; database connectivity unavailable | Blocked | No | HTTP/database-observed | TEST-022, RISK-016, UNC-011 |
| B3B-06 | NUTRITIONIST | `GET /api/nutritionist/profile` | Successful login/token required | Authenticated profile succeeds | Not reached because login was blocked | Blocked | No | HTTP | TEST-022, RISK-016 |
| B3B-07 | ADMIN/NUTRITIONIST | Role layout | Successful browser login required | Correct role layout loads | Browser unavailable and login blocked | Blocked | No | Browser | TEST-022, UNC-011 |
| B3B-08 | USER | `GET /api/user/meals/current` | Safe USER account plus actionable-state fixtures | No pending/rejected/cancelled/expired rows | No safe authenticated USER fixture/database connection | Blocked | No | HTTP/database-observed | REQ-002, DEF-008, RISK-015/016 |
| B3B-09 | USER | `GET /api/user/meals/current` | Approved current/future fixture | Approved rows remain visible | Fixture unavailable | Blocked | No | HTTP/database-observed | REQ-002, TEST-013/014 |
| B3B-10 | USER | `GET /api/user/meals/current` | Rejected original plus approved replacement | Original does not reappear | Fixture unavailable | Blocked | No | HTTP/database-observed | DEF-008, TEST-014 |
| B3B-11 | USER | `PATCH /api/user/meals/:id/status` DONE | Owned non-actionable disposable fixture | `409`, no persisted log/status change | Mutating check prohibited; fixture unavailable | Blocked | No | HTTP/database-observed | REQ-002, DEF-008/014, RISK-015/016 |
| B3B-12 | USER | `PATCH /api/user/meals/:id/status` SKIPPED | Owned non-actionable disposable fixture | `409`, no persisted log/status change | Mutating check prohibited; fixture unavailable | Blocked | No | HTTP/database-observed | REQ-002, DEF-008/014, RISK-015/016 |
| B3B-13 | USER | Planned-meal log/status path | Owned non-actionable disposable fixture | `409`, no persisted log | Mutating check prohibited; fixture unavailable | Blocked | No | HTTP/database-observed | REQ-002, DEF-014, RISK-015/016 |
| B3B-14 | USER | Swap options/preview/execute | Owned non-actionable original | `409`; no replacement mutation | Authenticated fixture unavailable; execute mutation prohibited | Blocked | No | HTTP/database-observed | REQ-002, TEST-013, RISK-016 |
| B3B-15 | USER | Cross-user/nonexistent meal lookup/action | Two isolated USER fixtures | Same non-disclosing not-found behavior | Fixtures unavailable | Blocked | No | HTTP/database-observed | REQ-002, TEST-013, RISK-016 |
| B3B-16 | USER | `GET /api/user/grocery/current` | Safe USER with attributable stored list | Non-actionable rows excluded | Authentication/database/provenance unavailable | Blocked | No | HTTP/database-observed | REQ-002, DEF-020, RISK-015/016, UNC-010 |
| B3B-17 | USER | Current nutrition totals | Safe USER with approved/non-approved linked logs | Non-approved linked logs excluded | Fixture/database unavailable | Blocked | No | HTTP/database-observed | REQ-002, RISK-015/016, UNC-010 |
| B3B-18 | USER | `GET /api/user/meals/history` | Safe USER with historical rows | Read-only history remains available | Authentication/database unavailable | Blocked | No | HTTP/database-observed | REQ-002, TEST-014, RISK-016 |
| B3B-19 | NUTRITIONIST | `GET /api/nutritionist/queue` | Safe nutritionist login | Pending rows remain visible | Login/database unavailable | Blocked | No | HTTP/database-observed | REQ-002, TEST-014, RISK-016 |
| B3B-20 | NUTRITIONIST | `GET /api/nutritionist/approved` | Safe nutritionist login | Approved archive remains visible | Login/database unavailable | Blocked | No | HTTP/database-observed | REQ-002, TEST-014, RISK-016 |
| B3B-21 | Public | Protected current/grocery/history/queue endpoints | No token | Reject before record lookup | Each returned `401` | Pass | No | HTTP | RISK-003, TEST-022 |
| B3B-22 | USER | `/dashboard` | Running frontend; unauthenticated server render only | Route compiles without server crash | `200` HTML, no Next error marker | Pass | No | HTTP/console | TEST-022 |
| B3B-23 | USER | `/meals` plan/history shell | Running frontend; unauthenticated server render only | Route compiles without server crash | `200` HTML, no Next error marker | Pass | No | HTTP/console | TEST-022, DEF-022 |
| B3B-24 | USER | `/grocery` | Running frontend; unauthenticated server render only | Route compiles without server crash | `200` HTML, no Next error marker | Pass | No | HTTP/console | TEST-022, DEF-020 |
| B3B-25 | NUTRITIONIST | `/nutritionist/reviews` | Running frontend; unauthenticated server render only | Route compiles without server crash | `200` HTML, no Next error marker | Pass | No | HTTP/console | TEST-022 |
| B3B-26 | NUTRITIONIST | `/nutritionist/approved` | Running frontend; unauthenticated server render only | Route compiles without server crash | `200` HTML, no Next error marker | Pass | No | HTTP/console | TEST-022 |
| B3B-27 | All | Browser console/network/hydration/client states | Available in-app browser and authenticated sessions | No crashes, loops, unhandled `409`, bad empty state, or pending action controls | Browser unavailable; source review only found DEF-022 | Blocked | No | Browser | TEST-022, DEF-022, RISK-016 |

Source compatibility findings:

- Dashboard and unified meals pages consume `GET /user/meals/current` as `{ success, data }`, matching the Batch 3 response shape. Meals history and grocery use their existing `{ success, data }` shapes.
- Swap option, preview, and execute errors read `response.data.error`, so the Batch 3 `409` body shape is compatible.
- Dashboard and weekly-plan status-toggle handlers only log failures; they do not surface the `409` state to the user. `MealCard` also does not disable actions based on a pending status prop. Current-plan filtering should prevent that prop in normal Batch 3 flows, but defense-in-depth is incomplete under DEF-022.
- Nutritionist queue and approved pages still call their preserved endpoints and expect arrays under `data`; no source-level response-shape drift from Batch 3 was found.

Files changed:

- `docs/NUTRIMIND_ENGINEERING_RECORD.md`: added TEST-022, RISK-016, DEF-021/022, UNC-011, CHG-20260819-05, runtime evidence, and updated verification classifications.
- `docs/NUTRIMIND_CLEANUP_PLAN.md`: recorded Batch 3B's partial outcome and the repeat-verification gate.
- No application source, test source, schema, migration, seed, package, lockfile, environment, generated source, historical guidance, or Git history was changed.

Verification:

| Command or procedure | Type | Result | Notes |
| --- | --- | --- | --- |
| `npm.cmd run dev` (backend) | Runtime | Pass | Port 5000; startup exposed DEF-021; no email delivered |
| `GET http://localhost:5000/health` | API smoke | Pass | `200` |
| Protected endpoint requests without a token | API/security smoke | Pass | current, grocery, history, and queue returned `401` |
| `npm.cmd run dev` (frontend) | Runtime | Pass | Port 3000; ready in 3.1 seconds |
| HTTP GET of login/dashboard/meals/grocery/reviews/approved pages | Frontend server-render smoke | Pass | all `200`; no server error marker |
| Repository-defined credential login attempts | Auth/API smoke | Blocked | sanitized `400`; DB connectivity unavailable |
| Aggregate-only Prisma connectivity probe | Database-observed | Blocked | destination unreachable; no records returned or changed |
| Environment-cleared `npm.cmd test` | Backend unit/closest-boundary | Pass | 35 registered: 28 pass, 0 fail, 0 skipped, 7 TODO |
| `npx.cmd tsc --noEmit --incremental false` (backend/frontend) | Static | Pass | no errors in either package |
| `npx.cmd prisma validate` | Static schema | Pass | schema valid; no migration/query |
| `npm.cmd run lint` | Static | Pass with warnings | existing warning classes; no auto-fix |

Not verified:

- Authenticated current-plan, grocery, totals, history, mutation `409`, cross-user, nutritionist queue/archive, or role-layout behavior.
- Browser console, hydration, client network requests, empty/loading states, and interactive action controls.
- Successful approved-meal mutations were deliberately not attempted.
- No Gemini generation, Google OAuth, email delivery, cron, PDF, seed, migration, reset, destructive SQL, or clinical validation was exercised.

Traceability:

- Requirements: REQ-002 and REQ-008.
- Decisions: ADR-006 and ADR-007.
- Defects: DEF-008, DEF-020, DEF-021, DEF-022.
- Risks: RISK-001, RISK-009, RISK-012, RISK-015, RISK-016.
- Tests: TEST-013, TEST-014, TEST-022.
- Uncertainties: UNC-010 and UNC-011.
- Documentation: DOC-009.

Documentation extraction notes:

- SPMP: controlled runtime-check scope, environment gate, no-mutation decision, blocked-dependency evidence, and repeat-verification gate.
- SRS: runtime acceptance matrix for approved-meal API behavior and preserved review/history visibility.
- SDD: observed startup dependencies, API/frontend response-shape compatibility, and defense-in-depth gap.
- STD: complete Pass/Blocked matrix, exact commands, environment classification, evidence types, and non-executed external/data-changing checks.

---

### CHG-20260819-06 - Cleanup Batch 3C database connectivity diagnosis and authenticated runtime unblocking

- Date: 2026-08-19
- Request/source: Owner-authorized Cleanup Batch 3C attachment.
- Objective: classify the Batch 3B database failure without exposing or changing secrets, then repeat only safe read-only authenticated checks if connectivity can be restored.
- Final status: Completed for connectivity diagnosis and available ADMIN/NUTRITIONIST read-only verification; USER checks remain blocked by the absence of a repository-defined USER credential.
- Risk classification: High; security/privacy-sensitive and `CLINICAL-SAFETY-IMPACTING` verification.
- Security-impacting: Diagnosis and read-only authentication only; no authentication behavior changed.
- Schema/migration-impacting: No.
- Data/Git impact: database records were read but none were changed; no schema, migration history, environment file, application source, dependency, generated source, historical Markdown, branch, tracked-file inventory, or Git history was changed.

Safe environment and connection structure:

| Diagnostic | Result |
| --- | --- |
| Backend working directory | Expected `nutrimind-backend` directory |
| Expected environment file | Present |
| `DATABASE_URL` before `dotenv.config()` | Not present in the parent diagnostic process |
| `DATABASE_URL` after `dotenv.config()` | Present; expected file/key loaded without error |
| URI parsing | Valid URI |
| Protocol | PostgreSQL |
| Username/password/hostname/database name | Each structurally present; values not displayed |
| SSL query parameter | Present |
| Endpoint form | Pooled Neon endpoint |
| Port | PostgreSQL default 5432 |

Layered connectivity result:

| Layer | Default restricted context | Network-permitted diagnostic context | Classification |
| --- | --- | --- | --- |
| DNS | Pass | Pass; three IPv4 results | DNS and endpoint naming work |
| TCP/5432 | Fail: `SocketException` / `AccessDenied` | Pass | Restricted execution network denied outbound database TCP |
| PostgreSQL SSL negotiation | Not reachable after TCP denial | Pass; server advertised SSL | Server endpoint is available and SSL-capable |
| TLS | Not reachable | Pass; TLS 1.2 with remote certificate | No TLS/certificate configuration defect observed |
| Prisma `SELECT 1` | Previously blocked by TCP denial | Pass; one constant row | Credentials, database name, pooled endpoint, Prisma client, and PostgreSQL authentication work |

Sanitized failure category:

- Primary category: local execution sandbox/network-egress restriction.
- Failed layer in the restricted context: outbound TCP connection to PostgreSQL port 5432.
- Not indicated by evidence: missing/malformed environment, DNS failure, invalid credentials, TLS failure, database/project unavailability, pooled/direct endpoint mismatch, or Prisma configuration defect.
- Smallest restoration action: run database-dependent development checks from a local context that permits outbound PostgreSQL TCP. No connection-string replacement is currently indicated.
- Separate mutation gate: the owner must still confirm in the Neon dashboard that the target project/branch/database is development/test before any data-changing verification; the connection string must not be shared in chat.

Authenticated read-only results:

| Check | Role | Result | Database records read | Records changed | Evidence |
| --- | --- | --- | --- | --- | --- |
| Credential login | ADMIN | Pass: `200`; role and token/cookie presence confirmed without values | Existing ADMIN user row | 0 | HTTP plus login source inspection |
| Authorized role endpoint | ADMIN | Pass: analytics returned `200` success | Aggregate platform records | 0 | HTTP |
| Credential login | NUTRITIONIST | Pass: `200`; role and token/cookie presence confirmed without values | Existing NUTRITIONIST user row | 0 | HTTP plus login source inspection |
| Profile retrieval | NUTRITIONIST | Pass: `200` success | Existing nutritionist profile | 0 | HTTP |
| Review queue | NUTRITIONIST | Pass: `200`; 47 rows; every returned status was `PENDING_REVIEW` | 47 queue rows and selected relations | 0 | HTTP/database-observed |
| Approved archive | NUTRITIONIST | Pass: `200`; one row | One approved archive row | 0 | HTTP/database-observed |
| USER credential login | USER | Blocked: no repository-defined USER credential; no guessing, seeding, or impersonation | 0 | 0 | Repository seed inventory |
| Current plan/state exclusion | USER | Blocked by USER authentication prerequisite | 0 | 0 | HTTP not attempted |
| Meal history | USER | Blocked by USER authentication prerequisite | 0 | 0 | HTTP not attempted |
| Grocery retrieval | USER | Blocked by USER authentication prerequisite | 0 | 0 | HTTP not attempted |
| Current totals | USER | Blocked by USER authentication prerequisite | 0 | 0 | HTTP not attempted |
| Invalid-state `409` checks | USER | Blocked; no authenticated disposable USER/non-actionable target | 0 | 0 | HTTP not attempted |

Mutation and external-service controls:

- `AuthService.login` performs one `findUnique`, password comparison, and local JWT signing only. It does not create/update a session, timestamp, token record, or user record. Setting the refresh cookie changes only the HTTP response/client cookie jar.
- SMTP variables were cleared only in the temporary backend process; permanent environment configuration was not changed. Startup emitted no SMTP connection attempt for this run.
- Gemini, Google OAuth, SMTP delivery, DiceBear, cron, PDF, and other external integrations were not called.
- No migration, seed, reset, `db push`, `db pull`, administrative SQL, DDL, insert, update, delete, approval, rejection, logging, completion, skip, swap, generation, or fixture creation occurred.

Files changed:

- `docs/NUTRIMIND_ENGINEERING_RECORD.md`: added TEST-023, CHG-20260819-06, UNC-012, diagnosis evidence, and updated RISK-016/TEST-022 status.
- `docs/NUTRIMIND_CLEANUP_PLAN.md`: recorded Batch 3C completion, connectivity classification, authenticated results, and the remaining USER/environment-classification gate.
- No other file was changed by Batch 3C.

Traceability:

- Requirements: REQ-002 and REQ-008.
- Decisions: ADR-001, ADR-006, ADR-007.
- Defects: DEF-008, DEF-020, DEF-021, DEF-022 remain unchanged.
- Risks: RISK-001, RISK-012, RISK-015, RISK-016.
- Tests: TEST-022 and TEST-023.
- Uncertainties: UNC-010, UNC-011, UNC-012.
- Documentation: DOC-010.

Documentation extraction notes:

- SPMP: environmental dependency classification, least-change restoration, no-mutation controls, and remaining owner prerequisites.
- SRS: authenticated role and read-only review/archive acceptance results; USER actionability remains unverified.
- SDD: dotenv loading path, pooled PostgreSQL/SSL/TLS/Prisma layers, and read-only login behavior.
- STD: sanitized layer-by-layer diagnostics, authenticated Pass/Blocked matrix, records-read/changed accounting, and external-service isolation.

---

### CHG-20260819-07 - Cleanup Batch 3D owner-assisted three-role runtime verification

- Date: 2026-08-19.
- Request/source: Owner-authorized Cleanup Batch 3D attachment and follow-up authorization for one exact root `.gitignore` entry.
- Objective: use the owner's three existing persistent development/demo accounts to finish the safe read-only Batch 3 runtime matrix, without creating fixtures or mutating shared data.
- Final status: Completed within the approved read-only boundary. Batch 3 is sufficiently verified for capstone development use, but not release, clinical, or full browser-E2E readiness.
- Risk classification: High; security/privacy-sensitive and `CLINICAL-SAFETY-IMPACTING` verification.
- Security-impacting: Local credential handling and authentication verification only; authentication behavior did not change.
- Schema/migration-impacting: No.
- Production-code correction: None required; the final verification cycle found no Batch 3 regression.

Credential and repository safety:

- Added only `nutrimind-backend/.env.runtime-test.local` to the root `.gitignore`; no existing rule was reordered or cleaned.
- Verified the owner-created credential file exists, is ignored, is untracked, and contains exactly the six required non-empty variable names without malformed, duplicate, or unexpected keys.
- Values, tokens, cookies, connection details, identities, and health data were never printed or written to documentation. Tokens existed only in the runtime harness process.
- The owner corrected one local ADMIN email typo before the final test cycle. The corrected value matched the existing ADMIN record; the initial local-input failure is not an application failure.
- The file was not created, modified, deleted, or tracked by Batch 3D; the owner controls its local retention.

Authentication and authorization results:

| Check | Result |
| --- | --- |
| Existing USER credential login | `200`; returned `USER`; token received without disclosure |
| Existing NUTRITIONIST credential login | `200`; returned `NUTRITIONIST`; token received without disclosure |
| Existing ADMIN credential login | `200`; returned `ADMIN`; token received without disclosure |
| USER traditional login and dashboard | Owner-observed pass |
| USER Google login and dashboard | Owner-observed pass |
| Traditional/Google same-record identity | Pass; normalized unique-email flow and owner profile comparison showed the same USER record; no USER was created or updated |
| Cross-role denial matrix | Six protected cross-role requests returned `403` as expected |

Read-only API matrix:

- USER `200`: profile, current meals, meal history, current grocery, progress history, notifications, check-in status, and compatible library.
- NUTRITIONIST `200`: profile, pending queue, and approved archive.
- ADMIN `200`: analytics, user listing, and nutritionist listing.
- NUTRITIONIST queue returned 47 rows and every row was `PENDING_REVIEW`.
- All 20 endpoint/authorization assertions passed.

Approved-meal actionability evidence:

- The designated USER had pending, rejected, and cancelled plans plus meal logs linked to non-approved plans, but no approved current/future plan.
- `GET /api/user/meals/current` returned `200` with zero rows: no pending, rejected, cancelled, or non-approved linked-log contribution was returned or totaled.
- An existing owned non-approved plan was used only for a request expected to fail before mutation. `PATCH /api/user/meals/:id/status` with `DONE` returned `409`.
- A before/after snapshot confirmed the selected plan and related log state were unchanged.
- The positive approved-current live path was blocked because no natural approved fixture existed; no fixture was created. TEST-013/014 continue to cover that policy at the automated closest boundary.
- Current grocery retrieval returned `200`, but stored-list provenance remains uncertified under DEF-020/RISK-015/UNC-010. Generation was not run.

Frontend and regression evidence:

- Eleven route shells returned `200` without a server-error marker: USER dashboard/meals/grocery/progress/profile; nutritionist reviews/approved/profile; admin overview/users/nutritionists.
- These are HTTP/server-render checks, not full browser hydration or interaction evidence. The owner verified only the USER dashboards for traditional and Google login flows.
- Fresh runtime logs contained no token-like output. The only backend error-category lines were the two expected invalid-state actionability rejections; fresh frontend logs contained no error-category line.
- Backend regression suite: 35 registered, 28 pass, 0 fail, 0 skipped/cancelled, 7 TODO.
- Runtime assertion accounting: 42 pass, 0 final-cycle fail, 3 blocked categories (positive approved-current live path, full interactive browser matrix, stored-grocery provenance/generation).

Records and external-system accounting:

- Read: authentication user rows and role/profile metadata; USER current/history/grocery/progress/notification/check-in/library data; NUTRITIONIST profile/queue/archive; ADMIN aggregate/user/nutritionist listings; aggregate plan-status/log metadata and one invalid-target snapshot.
- Changed: zero users, meal plans, meal logs, grocery lists, weight logs, notifications, swap logs, or library flags; zero USER rows updated after service start.
- Not invoked: migration, seed, reset, generation, approval, rejection, successful meal logging/status change, swap, profile change, notification read, cron, Gemini, SMTP delivery, automated Google OAuth, or PDF.
- SMTP variables were blanked only in the temporary backend process. Permanent environment configuration was not changed.

Files changed:

- `.gitignore`: one exact authorized credential-file entry.
- `docs/NUTRIMIND_ENGINEERING_RECORD.md`: TEST-024, RISK-017, UNC-013, this change record, and updated status/traceability.
- `docs/NUTRIMIND_CLEANUP_PLAN.md`: Batch 3D outcome, residual boundary, and next separately reviewed work.
- No application source, test source, schema, migration, seed, dependency, generated source, environment file, historical Markdown guidance, branch, tracked-file inventory, or Git history was changed.

Traceability:

- Requirements: REQ-002 and REQ-008.
- Decisions: ADR-001, ADR-006, ADR-007.
- Defects: DEF-008 runtime negative-state boundary verified; DEF-020/022 remain open.
- Risks: RISK-001, RISK-015, RISK-016, RISK-017.
- Tests: TEST-013, TEST-014, TEST-022, TEST-023, TEST-024.
- Uncertainties: UNC-010 and UNC-013.
- Documentation: DOC-011.

Documentation extraction notes:

- SPMP: shared-development verification boundary, credential/configuration controls, exact no-mutation accounting, and Batch 3 acceptance for capstone development.
- SRS: authenticated approved-meal negative-state enforcement and three-role RBAC acceptance evidence.
- SDD: existing JWT/RBAC and actionability-policy runtime behavior; no design change.
- STD: exact API/route/actionability counts, records read/changed, blocked categories, and automated regression totals.

---

### CHG-20260819-08 - Cleanup Batch 4A deterministic restriction vocabulary and policy design

- Date: 2026-08-19.
- Request/source: Owner-authorized Cleanup Batch 4A attachment.
- Objective: establish a repository-backed specification for enum/custom restrictions, ingredient provenance, library metadata, uncertainty, reason-coded outcomes, and future caller enforcement without implementing the engine or inventing medical rules.
- Final status: Completed as inspection, privacy-safe read-only profiling, technical policy design, test planning, and documentation only.
- Risk classification: Critical; `CLINICAL-SAFETY-IMPACTING` with potential privacy impact.
- Security-impacting: Aggregate health/restriction data was read under explicit privacy controls; no identity, custom value, credential, or health record was output.
- Schema/migration-impacting: Analysis only; no schema or migration change.
- Runtime behavior: Unchanged.

Repository findings:

- Exact schema conditions are `DIABETES`, `HYPERTENSION`, `KIDNEY_DISEASE`, `HEART_CONDITION`, `PREGNANT`, `NONE`; allergies are `SHELLFISH`, `NUTS`, `DAIRY`, `GLUTEN`, `EGGS`, `NONE`.
- Onboarding, profile chips, shared frontend enum types, and library-edit enum values align with those schema keys, except the UI broadens some labels semantically.
- Nutritionist warnings use incompatible/unreachable allergen keys including `PEANUTS`, `TREE_NUTS`, `EGG`, `WHEAT`, `FISH`, and `SOY` (DEF-023).
- Custom restrictions are persisted and included in selected AI prompts, but omitted from deterministic safety callers and nutritionist detail (DEF-025).
- Library null/empty metadata is permissive in repeated callers (DEF-024).
- Generation confidence tests enum conditions only, not allergies/custom restrictions, and can retain default `SAFE` (DEF-026).
- Existing keyword/nutrient thresholds are unreviewed repository rules, not clinically validated facts.

Read-only aggregate profile:

- Enum conditions in use: `NONE` 2, `HEART_CONDITION` 1, `HYPERTENSION` 1; custom-condition profiles 0.
- Enum allergies in use: `NONE` 2, `DAIRY` 1, `EGGS` 1; custom-allergy profiles 0.
- Two library records have structurally non-null known-key arrays and nutritionist relations; one has both arrays empty; zero records are semantically certifiable as complete from the current schema.
- Ingredients: 829 FNRI-linked, 384 FNRI-labelled but unlinked, 126 Gemini-estimated and unlinked.
- Plan confidence: `SAFE` 147, `CAUTION` 14, `NEEDS_REVIEW` 20. Plan status: `APPROVED` 1, `PENDING_REVIEW` 47, `REJECTED` 1, `CANCELLED` 132.
- Library status: two `APPROVED`; pending library flags: zero. Meal-log provenance: 15 FNRI, 14 Gemini-estimated; one warning shown and acknowledged.
- Queries ran inside Prisma transactions set to `READ ONLY`; records changed: zero.

Design outcome:

- Proposed ADR-008: pure `ALLOW`/`REVIEW`/`BLOCK` result plus existing `SAFE`/`CAUTION`/`NEEDS_REVIEW`, stable reason codes, mechanical normalization, no fuzzy clinical matching, and most-restrictive precedence.
- Unknown/null/custom-unmapped/AI-estimated/unresolved evidence defaults to review; direct exact approved allergy conflicts default to block.
- `SAFE` is explicitly scoped to declared-restriction evaluation with complete approved metadata, not general medical safety.
- Semantic aliases and every condition/threshold/ingredient rule remain unapproved pending owner and licensed RND decisions under UNC-014.
- TEST-015/016 activation cases and the smallest Batch 4B caller set are specified but not implemented.

Files changed:

- `docs/NUTRIMIND_RESTRICTION_POLICY_DESIGN.md`: canonical vocabulary, mismatch/profile/rule inventories, normalization/alias proposals, contract, matrices, TEST-015/016 plan, Batch 4B plan, and exact decisions.
- `docs/NUTRIMIND_ENGINEERING_RECORD.md`: REQ-010, proposed ADR-008, RISK-018, DEF-023-026, TEST-025, UNC-014, DOC-012, this change record, and traceability updates.
- `docs/NUTRIMIND_CLEANUP_PLAN.md`: Batch 4A completion and Batch 4B approval gate.
- No production, frontend, backend test, schema, migration, seed, dependency, environment, generated, runtime credential, historical guidance, CI, branch, tracked-inventory, or Git-history file changed.

External and mutation controls:

- No Gemini, SMTP, OAuth, PDF, cron, application server, generation, approval, rejection, replacement, logging, profile update, seed, migration, or database mutation ran.
- The runtime credential file was not read, printed, modified, deleted, or tracked during Batch 4A.

Traceability:

- Requirements: REQ-003, REQ-006, REQ-010.
- Decision: proposed ADR-008.
- Defects: DEF-009, DEF-018, DEF-023-026.
- Risks: RISK-002, RISK-006, RISK-018.
- Tests: TEST-015, TEST-016, TEST-025.
- Uncertainty: UNC-014.
- Documentation: DOC-012.

Documentation extraction notes:

- SPMP: Batch 4A analysis boundary, critical risk, owner/RND decision dependencies, Batch 4B scope/rollback, and privacy/configuration controls.
- SRS: exact restriction vocabulary, structured outcomes, conservative acceptance rules, caller requirements, and clinical-decision exclusions.
- SDD: pure policy contract, normalization boundary, reason-code precedence, evidence sources, and caller interfaces.
- STD: privacy-safe aggregate fixture evidence and exact TEST-015/016 activation matrix without false passing claims.

---

### CHG-20260819-09 - Cleanup Batch 4B1 pure deterministic restriction policy and automated tests

- Date: 2026-08-19.
- Request/source: Owner-authorized Cleanup Batch 4B1 attachment.
- Objective: implement and verify one isolated deterministic restriction policy without importing it into any production caller.
- Final status: Completed for the pure-policy and synthetic-test boundary only; no production behavior changed.
- Risk classification: Critical; `CLINICAL-SAFETY-IMPACTING`; production impact none.
- Schema/database/external impact: None; no database, Prisma client, HTTP, Gemini, SMTP, OAuth, PDF, cron, or other external service was contacted.
- Prior behavior: Batch 4A had a design and TEST-015/016 TODO specifications only; no executable centralized restriction decision contract existed.
- New behavior: the pure contract is executable and unit-verified in isolation; production services still use their prior fragmented behavior because no caller imports the module.

Implemented source and contract:

- Added `nutrimind-backend/src/domain/restriction-evaluation.policy.ts`, a dependency-free module exporting the canonical enum constants, three approved aliases, stable reason-code order, scoped SAFE wording, result/input types, normalization/sanitization helpers, and `evaluateRestrictions`.
- The result includes `ALLOW | REVIEW | BLOCK`, `SAFE | CAUTION | NEEDS_REVIEW`, blocking state, structured matches/provenance, ordered reasons, templated explanation, completeness, unknown/custom, and estimated/unresolved flags.
- Precedence is `BLOCK > REVIEW > ALLOW`. Exact canonical/approved-alias allergy conflicts block. Known conditions, unreviewed condition-rule evidence, custom/unknown restrictions, and uncertain metadata require review.
- Only `PEANUTS -> NUTS`, `TREE_NUTS -> NUTS`, and `EGG -> EGGS` map. Wheat, fish, soy, lactose intolerance, lactation, subtypes, dishes, translations, partial words, and similar spellings remain unmapped.
- `NONE` is exclusive. Missing/null/malformed/unknown/contradictory/legacy-empty metadata and missing/estimated/unresolved/unlinked ingredient evidence never return ALLOW.
- Explanations are fixed templates; custom display provenance is NFKC-normalized, control-stripped, whitespace-collapsed, bounded, and credential-shaped text is redacted.

Test activation and scenarios:

- Added `tests/restriction-policy.test.ts` and imported it only from the existing explicitly executed TODO test entry point; no package script or dependency changed.
- Removed TEST-015/016 TODO registrations. TEST-015 now has 13 active cases covering every actual enum, all approved aliases, all explicitly rejected mappings, future values, NONE cases, normalization, deduplication, provenance, false positives, and sanitization.
- TEST-016 now has 18 active cases covering complete/incomplete evidence, exact canonical/alias conflicts, non-conflicting allergies, conditions/unreviewed rules, custom values, missing/null/legacy/malformed/unknown/contradictory metadata, Gemini/unresolved/unlinked ingredients, precedence, reason order, deterministic output/non-mutation, and explanation privacy.
- Backend result: 64 registered, 59 pass, 0 fail, 0 skipped, 5 TODO. TEST-017 through TEST-021 remain TODO.

Files changed by Batch 4B1:

- New source: `nutrimind-backend/src/domain/restriction-evaluation.policy.ts`.
- New test: `nutrimind-backend/tests/restriction-policy.test.ts`.
- Test activation/status: `nutrimind-backend/tests/critical-behavior.todo.test.ts`, `nutrimind-backend/tests/README.md`.
- Current documentation: `docs/NUTRIMIND_RESTRICTION_POLICY_DESIGN.md`, `docs/NUTRIMIND_ENGINEERING_RECORD.md`, `docs/NUTRIMIND_CLEANUP_PLAN.md`, and root `README.md` verification summary.
- No generation/swap/library/current/grocery/logging/review/profile/cron production service, frontend, API, request validation, schema, migration, seed, dependency, lockfile, environment, credential, generated, CI/deployment, historical guidance, tracked-inventory, branch, or Git-history file changed.

Verification and isolation:

- TEST-026 records the backend suite, backend/frontend TypeScript, Prisma schema validation, frontend lint, test import/isolation scan, changed-file sensitive-literal scan, focused `git diff --check`, focused status/diff review, no-production-import proof, and ignored/untracked runtime-credential proof.
- Identical inputs produce deeply identical outputs and inputs are not mutated.
- Production source search finds no caller import of the new policy. Batch 3 actionability remains independent.
- Commands: backend `npm.cmd test` -> 64 registered, 59 pass, 0 fail, 0 skipped, 5 TODO; backend and frontend `npx.cmd tsc --noEmit --incremental false` -> pass; backend `npx.cmd prisma validate` -> valid schema without a database connection; frontend `npm.cmd run lint` -> pass with pre-existing warnings; focused `rg`, `git diff --check`, `git status`, `git check-ignore`, and `git ls-files` checks -> pass.
- Not performed: application startup, live/API/database integration, mutation, browser E2E, Gemini, OAuth, SMTP/email, PDF, cron, deployment, accessibility, performance, and clinical validation because each is outside the pure Batch 4B1 scope.

Traceability:

- Requirements: REQ-003, REQ-006, REQ-008, REQ-010.
- Decisions: ADR-006, ADR-008.
- Defects: DEF-009, DEF-023-026 remain open at production callers.
- Risks: RISK-002, RISK-006, RISK-009, RISK-017, RISK-018.
- Tests: TEST-015, TEST-016, TEST-026.
- Uncertainty: UNC-014 partially resolved.
- Documentation: DOC-013.

Remaining boundary and proposed next slice:

- The policy is not clinically validated and adds no medical thresholds, keyword lists, disease-food rules, pregnancy/lactation rules, overrides, or outside-meal behavior.
- The smallest proposed Batch 4B2 slice is one read-only library-compatibility adapter plus caller-focused tests, defaulting incomplete legacy metadata to review and preserving the Batch 3 actionability prerequisite. It requires separate owner approval.

---

### CHG-20260819-10 - Cleanup Batch 4B2 meal-generation library compatibility adapter

- Date: 2026-08-19.
- Request/source: Owner-authorized Cleanup Batch 4B2 attachment.
- Objective: adapt already-loaded user/library evidence into the Batch 4B1 restriction policy and use it only for automatic meal-generation library candidate eligibility.
- Final status: Completed for meal-generation library selection and isolated fallback verification only.
- Risk classification: Critical; `CLINICAL-SAFETY-IMPACTING`; production impact limited to library candidates selected during generation.
- Prior behavior: approved library rows used permissive inline condition/allergen array predicates; null metadata skipped checks and custom/provenance evidence was omitted.
- New behavior: every approved queried candidate passes through a deterministic adapter; only ALLOW with complete/resolved evidence is eligible, while REVIEW/BLOCK continues through the existing unmatched-slot Gemini fallback path.

Files and behavior changed:

- Added `src/domain/meal-generation-library-compatibility.adapter.ts`, exporting input/result/evidence types, `evaluateMealGenerationLibraryCompatibility`, `filterEligibleMealGenerationLibraryCandidates`, and `runMealGenerationFallbackForUnmatchedSlots`.
- Updated only `MealGenerationService.generate7DayPlan`: its approved-only query additionally loads historical source-plan ingredient provenance; the old inline condition/allergen predicates were removed; adapter-eligible rows alone continue to existing meal-type/diet/goal/usage/random selection.
- The fallback body remains the existing single Gemini batch for all unmatched slots, invoked through an injectable seam. Prompt/model behavior, FNRI lookup, persistence, `PENDING_REVIEW` status, transactions, usage increments, notifications, and Batch 3 actionability were not changed.
- Added `tests/meal-generation-library-compatibility.test.ts` and imported it through the existing explicit test entry point; no package script/dependency changed.

Evidence availability and expected compatibility impact:

- Direct: enum/custom restrictions, library status, nullable JSON condition/allergen-free claims.
- Safe relation: historical source `MealPlan.ingredients` provides FNRI/Gemini provenance and nullable `foodItemId` linkage.
- Missing: explicit safety-completeness marker, direct detected-allergen declarations, cross-contact basis, evidence version/expiry. Nutritionist or FNRI linkage does not fill these gaps.
- The prior aggregate profile found two approved library rows, one with both compatibility arrays empty and zero rows certifiable as semantically complete. Both are therefore expected to be excluded automatically and any otherwise matching slots to use fallback. This was not live-executed.

Tests and exact outcomes:

- TEST-027: 18 active adapter cases for eligible ALLOW/SAFE and ALLOW/CAUTION, aliases, conflicts, conditions, custom values, null/missing/malformed/legacy/unknown metadata, estimated/unresolved ingredients, NONE, status default-deny, determinism/non-mutation, and privacy.
- TEST-028: 9 active generation-filter/fallback cases for eligible retention, REVIEW/BLOCK/status exclusion, one fallback batch, no fallback for an eligible slot, slot completeness, unchanged plan-status data, and injected no-Gemini behavior.
- Backend `npm.cmd test`: 91 registered, 86 pass, 0 fail, 0 skipped, 5 TODO.
- Backend/frontend `npx.cmd tsc --noEmit --incremental false`: pass. Backend `npx.cmd prisma validate`: pass without database access. Frontend `npm.cmd run lint`: pass with existing warnings.
- Static isolation/import, old-predicate, sensitive-literal, focused diff/status, and runtime-credential ignored/untracked checks: pass.

Impact boundaries:

- Database objects/schema/migrations/seeds/backfills: unchanged; records read/changed during testing: zero/zero.
- API/frontend/auth/environment/credential/dependency/lockfile/generated/CI/deployment/Git history: unchanged.
- No live generation, Gemini, database, HTTP, SMTP, OAuth, PDF, cron, or external service was contacted.
- No swap, compatible-library endpoint, current-plan, grocery, logging, nutritionist, profile/replacement, or cron caller imports the adapter.

Traceability:

- Requirements: REQ-003, REQ-006, REQ-008, REQ-010.
- Decisions: ADR-006, ADR-007, ADR-008.
- Defects: DEF-009, DEF-024/025 partially mitigated; DEF-023/026 and other caller aspects remain open.
- Risks: RISK-002, RISK-006, RISK-009, RISK-017, RISK-018.
- Tests: TEST-015/016/026/027/028.
- Uncertainty: UNC-014 remains partially resolved.
- Documentation: DOC-014.

Not verified and rollback:

- Not performed: live/API/database generation, browser E2E, external AI, mutation, deployment, performance, accessibility, or clinical validation because each is outside Batch 4B2.
- Rollback unit: adapter, generation caller integration, focused tests, and Batch 4B2 documentation. Reverting that unit restores the former predicates without schema/data rollback.
- Recommended Batch 4B3: design the authoritative library safety-evidence completeness/provenance contract before integrating another caller or attempting to make legacy rows eligible.

Documentation extraction notes:

- SPMP: bounded production impact, rollback unit, conservative compatibility consequence, remaining clinical/data risk.
- SRS: generation candidate eligibility matrix, default-deny evidence requirements, fallback and privacy constraints.
- SDD: adapter boundary, evidence mapping, pure policy dependency, generation selection/fallback sequence.
- STD: TEST-027/028 synthetic fixtures, exact outcomes, isolation, and unverified runtime levels.

---

### CHG-20260820-01 - Cleanup Batch 4B3 meal-library safety evidence and provenance design

- Date: 2026-08-20.
- Request/source: Owner-authorized Cleanup Batch 4B3 attachment.
- Objective: inspect current library evidence authority and design the smallest explicit contract required before a library record may become generation-adapter-eligible.
- Final status: Completed for inspection, aggregate read-only profiling, design, test planning, and current documentation only.
- Risk classification: Critical; `CLINICAL-SAFETY-IMPACTING`; production behavior unchanged.
- Schema/migration impact: None. Proposed additive models/fields are design only.

Current evidence and findings:

- Inspected Prisma models and all migrations affecting `MealLibrary`, source `MealPlan`, ingredients, verifier/flags, plan type, swap linkage, and ingredient provenance.
- Inspected nutritionist approval, ingredient override, library query/edit/delete, flag/resolve, route authority, review/library UI forms, and the Batch 4B2 generation adapter/persistence dependency.
- Confirmed library rows have no first-class ingredient, safety-completeness, direct-allergen, cross-contact, evidence-version/revision, current-reviewer, invalidation, or review-history authority.
- Confirmed approval copies the user's restrictions into compatibility arrays; empty/missing arrays do not prove explicit review. Route RBAC checks role but not global current verification/license eligibility.
- Confirmed historical ingredients can be absent, detached, cascaded, recreated without `foodItemId`, or ambiguous after the source-plan uniqueness constraint was removed.

Read-only data profile:

- Ran one aggregate-only Prisma query in an explicit `READ ONLY`, repeatable-read transaction against the owner-confirmed shared development/demo database.
- Results: 2 library rows; 2 nutritionist links; 1 historical source plan/ingredient set; 0 records with fully FNRI-linked combined historical ingredients; 0 with estimated historical ingredients; 1 with unlinked ingredients; 1 with both compatibility arrays empty; 0 null/malformed arrays.
- Records read/projected: 2 library rows, 1 linked historical plan row, and 3 linked historical ingredient rows, with only fields needed for aggregate computation. Records changed: 0. Identities, names, custom/health text, credentials, URLs, and tokens were not output or documented.
- Conclusion: both rows are legacy/incomplete and neither can be auto-certified or safely backfilled as complete.

Accepted design direction:

- ADR-009 defines independent `INCOMPLETE`, `COMPLETE`, and `STALE` evidence plus legacy origin, explicit declaration states, cross-contact assessment, revision/version, current qualified reviewer, invalidation, and append-only history.
- First-class normalized `MealLibraryIngredient` is recommended over JSON or historical-plan dependency. Complete evidence requires non-empty, wholly FNRI-linked/resolved ingredients, while FNRI remains nutrition provenance only.
- Normalized declarations plus explicit `NOT_REVIEWED`, `REVIEWED_NONE_DECLARED`, and `REVIEWED_WITH_DECLARATIONS` domain states distinguish missing from reviewed-none. Direct allergen evidence comes only from structured nutritionist review.
- Only a currently verified, unexpired nutritionist may certify; any such nutritionist may re-review. Original ownership and admin account management remain separate authorities.
- Material edits and flags stale certification. Flag dismissal does not restore it. No arbitrary evidence expiry is proposed; policy/reviewer events fail closed.
- Positive allergy plus cross-contact `NOT_ASSESSED` remains review/ineligible. Dish names, translations, fuzzy/substring matches, ingredient-text assumptions, AI inference, and FNRI nutrition linkage cannot manufacture allergen evidence.
- Existing rows default incomplete; deterministic historical copying may create only an incomplete draft and only when source selection is unambiguous. No auto-certification, external lookup, deletion, merge, or record rewrite is proposed.

Files changed:

- Added `docs/NUTRIMIND_LIBRARY_SAFETY_EVIDENCE_DESIGN.md`.
- Updated `docs/NUTRIMIND_RESTRICTION_POLICY_DESIGN.md`, this engineering record, and `docs/NUTRIMIND_CLEANUP_PLAN.md`.
- No production/test source, Prisma schema/migration/seed, API, frontend, dependency/lockfile, environment/credential, generated, CI/deployment, tracked-inventory, historical-guidance, branch, or Git-history file changed.

Verification and boundaries:

- TEST-029 covers complete-source inspection, aggregate privacy/read-only accounting, design requirements, documentation links/tables/whitespace, focused status review, sensitive-literal scan, and Batch 4B2 fallback preservation.
- No automated backend suite, TypeScript, Prisma validation, lint, application startup, browser E2E, live generation, Gemini, SMTP, OAuth, PDF, cron, migration, data mutation, or clinical validation was required or claimed for this documentation-only design.
- The smallest proposed next task is separately authorized Batch 4B4: additive lifecycle/revision/reviewer fields and a conservative legacy-incomplete migration with migration/link-preservation tests. First-class evidence persistence can follow as Batch 4B5 if the owner prefers a smaller migration split.
- Rollback unit: the four Batch 4B3 documentation changes only. Database/application rollback is not applicable.

Traceability:

- Requirements: REQ-003, REQ-006, REQ-010, REQ-011.
- Decisions: ADR-008, ADR-009.
- Defects: DEF-010, DEF-024, DEF-027.
- Risks: RISK-002, RISK-003, RISK-018, RISK-019.
- Tests: TEST-029.
- Uncertainty: UNC-015.
- Documentation: DOC-015.

Documentation extraction notes:

- SPMP: critical risk, bounded additive roadmap, rollback/recovery, owner/RND gates, privacy/read-only controls.
- SRS: explicit completeness, reviewer authority, declaration/cross-contact semantics, staleness, and automatic-eligibility prerequisites.
- SDD: lifecycle, proposed models, authorization, transactions, migration compatibility, API/UI validation, and adapter mapping.
- STD: aggregate profile, state/authorization/migration/concurrency/adapter scenarios, zero-mutation accounting, and unverified levels.

---

### CHG-20260820-02 - Cleanup Batch 4B4 additive meal-library evidence lifecycle migration

- Date: 2026-08-20.
- Request/source: Owner-authorized Cleanup Batch 4B4 attachment and resolved bounded UNC-015 decisions.
- Objective: add only the minimum additive lifecycle/origin/declaration-state/cross-contact/revision/reviewer/version/invalidation snapshot and preserve every current record and relationship.
- Final status: Migration deployed successfully to the same owner-confirmed shared capstone development/demo database; schema/default/preservation/regression evidence passes. No certification, API, frontend, adapter, or first-class evidence behavior was added.
- Risk classification: Critical; `CLINICAL-SAFETY-IMPACTING`, schema/migration impacting, non-destructive.

Preflight and migration:

- No application listener was running. Nine migration directories were unique; Prisma validation passed; migration status reported current; live schema and pre-change datamodel had no difference; no failed, unapplied prior, drifted, or ambiguous migration state was detected.
- Sanitized target confirmation used the established owner-confirmed configuration and revealed no URL, hostname, credentials, identities, meal names, or health data.
- Added four enums: `MealLibrarySafetyEvidenceStatus`, `MealLibrarySafetyEvidenceOrigin`, `MealLibraryDeclarationState`, and `MealLibraryCrossContactAssessment` with the accepted exact values.
- Added thirteen `MealLibrary` columns: `safetyEvidenceStatus`, `safetyEvidenceOrigin`, `conditionDeclarationState`, `allergenDeclarationState`, `crossContactAssessment`, `safetyEvidenceRevision`, `certifiedEvidenceRevision`, `safetyPolicyVersion`, `safetyReviewedByNutritionistId`, `safetyReviewedAt`, `safetyInvalidatedAt`, `safetyInvalidationReason`, and `updatedAt`.
- Added two nonnegative revision checks; indexes for `(status, safetyEvidenceStatus)` and `safetyReviewedByNutritionistId`; and one distinct optional reviewer FK to `NutritionistProfile` with `ON DELETE RESTRICT` and `ON UPDATE CASCADE`.
- Existing rows received `LEGACY_UNREVIEWED`; the migration then sets the future insert default to `NUTRITIONIST_DRAFT`. Every row defaults `INCOMPLETE`; no `UPDATE`, destructive DDL, type conversion, nullability tightening, data deletion, cascade delete, reset, or seed appears.
- Pre-deployment status showed only the one expected pending migration. Normal `prisma migrate deploy` applied it; post-status was current and the deployed schema exactly matched the datamodel.

Preservation and defaults:

- Before and after: 6 users, 1 nutritionist profile, 0 accounts, 0 sessions, 1,537 FoodItems, 2 MealLibrary rows, 181 MealPlans, 1,339 MealIngredients, and 0 LibraryFlags.
- Role counts, operational library statuses, compatibility arrays, food/ingredient links, plan/library links, creator/verifier links, and flag links matched through aggregate counts and privacy-safe deterministic hashes.
- Legacy aggregate: 2 incomplete, 0 complete, 0 stale; 2 legacy origin, 0 certified origin; 2 each condition/allergen not reviewed, cross-contact not assessed, and revision zero; 2 each with null certified revision, reviewer, review timestamp, policy version, and invalidation fields.
- Application/domain records created/updated/deleted: 0/0/0. Prisma migration-history records created: 1. No existing record was certified, backfilled complete, deleted, or rewritten by a data statement.

Compatibility and verification:

- Existing production/API/frontend source was unchanged. Required new columns have safe database defaults; certification-related fields are nullable. Existing creation may continue and yields an incomplete nutritionist draft. Batch 4B2 still omits authoritative lifecycle evidence, so current rows remain ineligible and fall back.
- Migration SQL safety scan passed. Prisma format and validation passed. Post-deploy status and schema diff passed. Backend: 91 registered, 86 pass, 0 fail, 5 documented TODO. Backend and frontend TypeScript no-emit passed. Frontend lint passed with pre-existing warnings.
- Prisma client generation was attempted twice during Batch 4B4 but Windows returned `EPERM` while replacing the query-engine binary. No source consumed the new fields, so Batch 4B4 remained compatible. Batch 4B4R subsequently resolved the operational lock after an owner restart and verified a successful Prisma Client v5.22.0 generation locally.
- No service remained running; the runtime credential remained ignored and untracked; no generated output, environment, dependency/lockfile, seed, historical guidance, or unrelated owner work was added by this batch.

Recovery and remaining boundary:

- Prefer a separately reviewed forward corrective migration; keep the additive schema if application checks fail. Do not reset, drop types/columns, rewrite migration history, or delete data without separate authorization.
- Remaining before certification can function: first-class library ingredients/declarations, append-only review history, verified/unexpired reviewer authorization, atomic revision/certification/invalidation writes, explicit generated-client/API serializers/contracts, UI, and a separately verified adapter revision.
- Files: `nutrimind-backend/prisma/schema.prisma`; `nutrimind-backend/prisma/migrations/20260820090000_add_meal_library_evidence_lifecycle/migration.sql`; four authorized current documentation files.
- Traceability: REQ-011, ADR-009, RISK-019, DEF-027, TEST-030, DOC-016. UNC-015 resolved for this bounded migration. Next IDs: CHG-20260820-03, TEST-031, DOC-017.

---

### CHG-20260820-03 - Cleanup Batch 4B4R Prisma client regeneration recovery

- Date: 2026-08-20.
- Request/source: Owner-authorized Batch 4B4R recovery and post-restart verification.
- Objective: recover Prisma client generation from the Windows engine-file `EPERM` without changing schema, migration, dependencies, application source, or database state.
- Final status: Completed. After the owner restarted Windows and ran the normal backend `npx.cmd prisma generate`, Prisma Client v5.22.0 generated successfully. Codex did not regenerate it again.
- Most likely original cause: an external Windows file handle on `query_engine-windows.dll.node`; exact owning process remained uncertain because no repository-owned Node process or app listener was present during the failed attempts.

Verification:

- Local generated exports and DMMF recognize `MealLibrarySafetyEvidenceStatus`, `MealLibrarySafetyEvidenceOrigin`, `MealLibraryDeclarationState`, and `MealLibraryCrossContactAssessment`.
- Generated `MealLibrary` metadata recognizes all thirteen lifecycle scalar fields and the optional `MealLibrarySafetyReviewer` relation `safetyReviewedByNutritionist` to `NutritionistProfile`.
- Backend tests: 91 registered, 86 pass, 0 fail, 5 TODO. Backend and frontend TypeScript no-emit pass. Prisma schema validation passes. Frontend lint passes with 22 existing warnings and 0 errors.
- Schema, Batch 4B4 migration, both package manifests, and both lockfiles match their authorized SHA-256 baselines. No engine/client file appears as a tracked or untracked Git artifact. Ten pre-existing ignored engine temporary files remain under `node_modules` and were not manually deleted.
- The runtime credential remains ignored and untracked. No repository-owned Node process or listener on ports 3000/5000 remained afterward. Existing unrelated owner changes were preserved.
- No database command, query, migration, schema change, dependency operation, source/test/frontend/environment/credential edit, or Git-history operation occurred.

Files changed and boundary:

- Documentation only: this engineering record and `docs/NUTRIMIND_CLEANUP_PLAN.md`.
- Traceability: TEST-031 and DOC-017. Next IDs are CHG-20260820-04, TEST-032, and DOC-018.
- Batch 4B4R closes only the client-generation recovery. It does not authorize or begin Batch 4B5. A short stabilization checkpoint should precede any separately approved feature batch.

---

### CHG-20260820-04 - Stabilization Checkpoint S1 feature-readiness and commit-boundary assessment

- Date: 2026-08-20.
- Scope: Assessment and planning only; no fix, feature, staging, commit, database action, or history operation.
- Readiness: `CONDITIONAL GO`. No application defect creates a blanket stop for unrelated feature development, but the 158-path dirty tree is not a safe development baseline until the owner approves and executes bounded commit separation.
- Baseline reuse: application, schema, migration, test, and dependency paths match the just-completed Batch 4B4R status and authorized critical hashes. Only this checkpoint's two authorized documentation files changed, so the 91-test/static B4B4R result was reused rather than rerun.

Working-tree classification:

| Primary class | Exact paths or groups | Assessment |
| --- | --- | --- |
| Approved cleanup | `.gitignore`; `nutrimind-backend/src/domain/*`; `nutrimind-backend/tests/*`; Batch 4B4 `schema.prisma` and its one migration; root/current documentation; historical-document notice/redaction diffs; test-script hunk; approved actionability/adapter hunks | Eligible for bounded commits only with the mixed-file exclusions below |
| Pre-existing owner/application work | 22 modified frontend source/config paths; backend auth/error/check-in/allergen/application changes; cookie-parser manifest/lock changes; `src/lib/sanitizeError.ts`; non-cleanup hunks in mixed Batch 3 consumers | Preserve and hold for owner review; do not absorb into cleanup commits |
| Generated/build output | 80 modified tracked files under `nutrimind-backend/dist/**` | Exclude from every proposed cleanup commit; tracked-output policy is a later owner decision |
| Documentation | 6 current/canonical paths and 10 tracked legacy-notice paths are approved Batch 1/current-record work | Commit as one documentation evidence unit after code/schema units |
| Local/machine-specific | Ignored `.env.runtime-test.local`, `node_modules/.prisma/**`, and Prisma engine temporary files do not appear in Git status | Never stage or include; current credential remains ignored/untracked |
| Owner confirmation required | `AGENTS.md`, `NUTRIMIND_FULL_SYSTEM_REFERENCE.md`, `chatgptcontext.md`, and `codex/*` are untracked documents whose substantial bodies pre-date or sit outside cleanup edits | Exclude until the owner approves committing each whole file |

Mixed files requiring hunk-level separation:

- `nutrimind-backend/package.json`: approved `test` script versus pre-existing cookie-parser dependency additions. `package-lock.json` contains the cookie-parser owner work and is not part of Cleanup Batch 2A.
- `src/controllers/meals.controller.ts`: Batch 3 actionability/query/`409` hunks versus pre-existing sanitizer/error changes.
- `src/services/cron.service.ts`: Batch 3 eligible-log filter versus pre-existing check-in streak changes.
- `src/services/meal-log.service.ts`: Batch 3 eligible-log filter versus pre-existing allergen normalization/keyword changes.
- The remaining Batch 3 consumer diffs in `grocery.service.ts`, `meal-generation.service.ts`, `meal-swap.service.ts`, `nutritionist.service.ts`, and `user.service.ts` align with the approved Batch 3/4B2 records, but still require focused diff review at staging time.

Proposed commit boundary, without staging now:

1. `chore(security): ignore local runtime verification credentials` — include only `.gitignore`; represents Batch 3D; exclude the credential file and every environment/generated path; independent and does not mix owner code.
2. `feat(safety): add tested meal actionability and restriction boundaries` — include `src/domain/*`, `tests/*`, only the `package.json` test-script hunk, and only the approved Batch 3/4B2 hunks in the eight recorded consumers; represents Batches 2A, 3, 4B1, and 4B2; exclude cookie-parser/lockfile, sanitizer, check-in, expanded keyword, frontend, `dist`, schema, environment, and unknown docs; mixed files require owner-observed hunk staging.
3. `feat(database): add conservative meal-library evidence lifecycle` — include only `schema.prisma` and `prisma/migrations/20260820090000_add_meal_library_evidence_lifecycle/migration.sql`; represents Batch 4B4; depends operationally on the already accepted migration evidence, not on owner application work; exclude generated Prisma client/engines and every other migration.
4. `docs: establish the canonical engineering and cleanup record` — include root `README.md`, `nutrimind-frontend/README.md`, `docs/*`, and the ten tracked legacy notice/redaction diffs; represents Batch 1 and documentation for Batches 2A through 4B4R/S1; place after code/schema commits so recorded state matches history; exclude `AGENTS.md`, `NUTRIMIND_FULL_SYSTEM_REFERENCE.md`, `chatgptcontext.md`, and `codex/*` until whole-file owner approval.

The pre-existing owner backend/frontend/package work is a hold set, not a safe fifth commit yet. It requires owner intent confirmation and targeted runtime review. All `dist/**` files remain excluded.

TODO disposition:

| Test | Current production evidence and impact | Proposed disposition |
| --- | --- | --- |
| TEST-017 | System-wide date windows still use server-local `Date`/`setHours` in cron, generation, logging, swap, and check-in paths. Wrong host timezone can shift daily/weekly behavior; current Singapore/Manila offsets happen to match. | Defect present; does not block unrelated features; fix before the capstone demonstration unless the entire demo/runtime timezone is explicitly pinned and verified, then retain as production hardening |
| TEST-018 | Dashboard warning acknowledgement repeats `POST /user/meals/log-outside`; `MealLogService` calls Gemini again, so the persisted estimate/warning may differ from the preview. | Defect present; fix before demonstrating outside-meal logging; not a blanket feature blocker |
| TEST-019 | Planned logs and daily aggregates use `findFirst` followed by update/create without database uniqueness or atomic upsert protection. Retry/double-submit races can duplicate totals. | Defect present; fix before demonstrating repeated logging/cron behavior; otherwise production data-integrity hardening |
| TEST-020 | Claim acquisition is read-then-update, and approve/reject permit absent or expired ownership; the queue's zero-priority value also falls through to the lowest sort rank. | Defect present; fix before a multi-nutritionist/review-workflow demonstration; not a blocker for unrelated USER features |
| TEST-021 | `calculateDailyTarget` still hard-codes a 500 kcal floor, but no licensed-RND bounds exist to make a safe assertion. | Keep TODO pending RND criteria; do not invent a fix. Before demo, remove/qualify clinical-grade claims or obtain approval; otherwise defer as clinical/production hardening |

Material re-ranking:

- Blocks new feature development: RISK-010, DEF-003, and UNC-002 only at the repository/change-control level. Resolve by owner-approved commit execution; scope-specific risks become blockers only when the new feature touches that domain.
- Fix or explicitly remove from the capstone demo: broken/stale routes and pages (RISK-008, DEF-005/011/012); outside-meal identity and retry duplication (DEF-018/014); review claim/sort behavior if the nutritionist flow is shown (DEF-013); server-time behavior if runtime timezone is not pinned (DEF-015); frontend action-error handling (DEF-022); and external Gemini/OAuth/SMTP startup checks (RISK-012, UNC-003, DEF-021).
- Security/safety gate before affected workflow work or an adversarial demo: backend prerequisite/nutritionist verification and broad DTO spreading (RISK-003, DEF-010/016); remaining restriction callers/confidence/warning-key mismatches (RISK-002/018, DEF-009/023-026).
- Safe to defer with truthful limitations: refresh-session hardening (RISK-005/DEF-007), schema indexes/quantified groceries (RISK-007), CI/monitoring (RISK-009/UNC-004), stored historical provenance (RISK-015/UNC-010), PWA/offline (DEF-006), and first-class library certification/history (RISK-019/DEF-027) because current default-deny/fallback remains.
- Documentation/history cleanup can wait: DEF-002/004 and historical guidance consolidation. Credential rotation/revocation should occur if the old value was ever valid, while history rewriting remains separately gated under RISK-013.
- Already resolved or adequately monitored: RISK-001/DEF-008 source and negative-state runtime boundary; RISK-016 read-only connectivity classification; RISK-017 ignored credential control; UNC-011/012 and the Batch 4B4 portion of UNC-015.

Smallest readiness gate:

- Required before features: one separately authorized S1A commit-boundary execution using the four groups above, with owner confirmation on every mixed hunk and hold path. No code fix is required for unrelated feature work.
- Conditional second batch only if the chosen feature touches a hold/mixed domain: reconcile and verify that exact owner-work path before feature changes. Do not start a generic cleanup or assume Batch 4B5.
- Exact files changed by S1: this engineering record and `docs/NUTRIMIND_CLEANUP_PLAN.md` only. Traceability: TEST-032 and DOC-018. Next IDs: CHG-20260820-05, TEST-033, DOC-019.

---

### CHG-20260820-05 - Stabilization Checkpoint S1A bounded commit execution

- Date: 2026-08-20.
- Scope: local staging and commits for the four owner-approved S1 cleanup groups only; no push, branch/history rewrite, cleanup, database operation, dependency installation, source rewrite, or feature work.
- Pre-commit gate: branch `main` at `2a5f61dffb9b3f4639f73e1389f83095e6a578f1`; zero pre-existing staged changes; 158 changed/untracked paths; runtime credential ignored/untracked and absent from normal status; no environment, generated Prisma Client, engine, or temporary artifact in normal status.
- Commit 1: `dd0fc5fadba9d4ec74e85e2f959e9911ec943ead` (`chore(security): ignore local runtime verification credentials`) contains only `.gitignore` and the exact Batch 3D ignore entry.
- Commit 2: `79a21c4ec1f39ddece297a322fc6ec6dc7536302` (`feat(safety): add tested meal actionability and restriction boundaries`) contains the 21 approved Batch 2A/3/4B1/4B2 paths/hunks. Hunk staging excludes cookie-parser/lockfile, sanitizer, check-in, expanded allergen-keyword, frontend, `dist`, Prisma, documentation, and uncertain owner work.
- Commit 3: `c61377f80fe8644cc2e165ea8ee6a9d8d64f5da8` (`feat(database): add conservative meal-library evidence lifecycle`) contains only the authorized schema and migration. Their SHA-256 baselines remained `9E59813DEC6A4826484296FEF5AFD9A7375CF73F4B3396CBE5C43F626B012081` and `1E92220D265349966A01B934DB1D8D6EF4FFF63341B6E4149354B64D57451D83`; staged whitespace and destructive-SQL checks passed.
- Commit 4: this documentation evidence unit uses message `docs: establish the canonical engineering and cleanup record`; its hash is intentionally not recorded through an amend. It includes only the S1-approved root/current documentation and ten tracked legacy notice/redaction diffs, while holding `AGENTS.md`, `NUTRIMIND_FULL_SYSTEM_REFERENCE.md`, `chatgptcontext.md`, and `codex/*`.
- Preservation: each completed commit was inspected by name/status/stat, contained no forbidden path, left the index empty afterward, and preserved the remaining owner/application, tracked `dist`, held-document, ignored credential, and local generated-file state.
- Verification boundary: final regression and repository/port audits run after Commit 4. Until those checks pass, readiness remains `CONDITIONAL GO`; the final report supplies results without rewriting this commit.
- Traceability: TEST-033 and DOC-019. Next IDs: CHG-20260820-06, TEST-034, DOC-020.

---

### CHG-20260820-06 - Feature F1 accessible password visibility toggles

- Date: 2026-08-20.
- Feature identifier: F1.
- Scope: frontend-only visibility controls for every existing rendered password field; no authentication-flow, validation, storage, API, backend, database, dependency, or design-system rewrite.
- Forms covered: login (`Password`); registration (`Password`, `Confirm Password`); reset password (`New Password`, `Confirm Password`); USER profile change-password form (`Current Password`, `New Password`, `Confirm New Password`). The forgot-password form is intentionally excluded because it renders only an email field. No other rendered frontend password input was found.
- Implementation: added `src/components/ui/PasswordInput.tsx`, which reuses the existing `Input` and Lucide `Eye`/`EyeOff` icons. Each mounted field owns an independent `useState(false)` visibility flag, uses `type="button"`, toggles only between `password` and `text`, exposes `Show password`/`Hide password`, `aria-pressed`, keyboard focus styling, a 40-by-40-pixel target, and input right padding. After owner verification showed that layout-effect-only restoration was still overwritten while the browser finalized the native input `type` mutation, the component was corrected to capture `selectionStart`/`selectionEnd`/`selectionDirection`/focus on pointer-down, retain keyboard-click capture, and restore both immediately after render and once on the next animation frame. The internal native-input ref remains safely merged with forwarded refs. Input focus is restored only when it owned focus before the pointer toggle; keyboard activation does not move focus away from the toggle button.
- Files changed: `PasswordInput.tsx`; login, registration, reset-password, and USER profile pages; this engineering record.
- Dirty-file preservation: login and registration already contained owner authentication and visual-design changes. F1 changes only their import and password-field component call sites. The dirty shared `Input.tsx` and every unrelated owner hunk remain untouched. Reset-password, USER profile, and this record were clean before F1.
- Verification: repository inventory still finds 8 fields and 8 `PasswordInput` instances. Focused source assertions confirm pointer/keyboard capture of selection start/end/direction and focus ownership, immediate plus animation-frame restoration after the type change, merged forwarded-ref support, conditional pointer-focus restoration, native keyboard button behavior, unchanged values, and preserved labels/pressed state. Live `GET` checks against the owner-running frontend returned `200` for login, registration, and reset-password and confirmed all 5 public fields still render hidden initially with `Show password`. Frontend TypeScript no-emit passes; frontend lint passes with the unchanged 22 warnings and no F1 finding; focused component whitespace passes. Backend tests were not rerun because no shared/backend dependency changed; the S1A baseline remains 91 registered, 86 pass, 0 fail, 5 TODO.
- Runtime limitation: the in-app browser remained unavailable. The exact synthetic scenarios—caret between `d`/`e`, selected `def`, caret at end, both toggle directions, unchanged `abcdef123`, no submission, and keyboard activation—require owner-assisted re-verification before F1 acceptance. The authenticated profile form's 3 fields remain source/type/lint verified only. The owner-controlled port-3000 frontend was reused read-only and left untouched.
- Boundary: no cleanup-plan, historical/held document, backend, schema, migration, dependency/lockfile, `dist`, credential/environment, staging, commit, or Git-history change.
- Traceability: TEST-034 and DOC-020. Next IDs: CHG-20260820-07, TEST-035, DOC-021.

---

### CHG-20260820-07 - Defect D1 generation-result contract and AuthProvider navigation

- Date: 2026-08-20.
- Scope: diagnose and correct only the USER dashboard generation failure consequence and the confirmed AuthProvider render-phase navigation warning; preserve approved-meal actionability, restriction defaults, nutritionist review, schema, dependencies, credentials, owner changes, and Git history.
- Confirmed runtime evidence: the designated USER authenticated and satisfied email/onboarding/ToS/report/profile prerequisites. The owner database contained 9 latest-group `PENDING_REVIEW` STARTER rows, 162 older `CANCELLED` rows, and 1 `REJECTED` row; current actionable count was zero. Both approved library rows remained evidence-`INCOMPLETE` and therefore ineligible, so one Gemini fallback batch supplied the 9 unmatched starter slots and persistence succeeded. No new generation call was made during D1 verification.
- Generation root cause and fix: generation was not lost. The controller queried only actionable rows after persistence and returned `success: true` with an empty `meals` array; consumers rendered that as `No Active Meal Plan`. A pure result policy now rejects a zero-row false success and exposes non-sensitive pending metadata plus display-only meal previews. `GET /current` reports the latest pending group when no approved plan exists. Following the owner's clarification, both the dashboard and unified Meal Plan tab consume this pending contract and render every pending meal through the dedicated preview card with its own `Pending verification` badge, explicit AI/unverified-estimates disclaimer, and no logging/status/swap/grocery controls. The Meal Plan tab groups the same pending records by date and suppresses its generate/regenerate affordances while review is active. Follow-up owner requests restored the dashboard's normal scheduled-date selector plus the check-in, weight, water, calorie-ring, and macro-tracker layout above those previews. Pending scheduled dates feed the selector when no approved plan exists, and each selection filters that day's dashboard cards. A bounded visual-polish pass then redesigned the shared pending card with meal-type iconography, stronger hierarchy, compact nutrition estimates, capped ingredient chips, and a persistent verification footer; it also adds a Meal Plan review-progress summary/day containers, refines dashboard date and pending-summary surfaces, replaces decorative wellness emoji with Lucide icons, and adds an opt-in `contentClassName` to the shared Card so focused cards avoid double padding without changing unrelated defaults. Pending estimates are explicitly excluded from tracker consumption and approved-only totals; without approved plan rows, the calorie target uses the stored `dailyCalorieTarget`. The dashboard generation action remains suppressed while pending, and an immediate ref guard blocks duplicate requests.
- Auth root cause and fix: `login` called `router.push` inside a `setUser` updater used only to inspect current state, producing the Router/AuthProvider render warning and potentially redundant/interrupted navigation. `refreshSession` now returns the applied live session; login enables loading, awaits that result, and routes afterward outside state reconciliation. Existing RouteGuard checks remain unchanged.
- Error/privacy behavior: the frontend continues to show sanitized API errors. Gemini parsing/validation no longer logs raw model output or validation detail, provider error text is not propagated, and the controller no longer logs a user identifier or raw generation error object. Model order, fallback count, prompt, restriction adapter, AI confidence, transaction, and `PENDING_REVIEW` persistence are unchanged. The client has no explicit generation timeout; none was added because aborting the client would not cancel backend persistence and could encourage unsafe retries.
- Verification: TEST-035 adds 4 passing synthetic result cases. Full backend result is 95 registered, 90 pass, 0 fail, 5 TODO. Backend/frontend no-emit and Prisma validation pass; frontend lint passes with the existing 22 warnings. Source checks confirm per-card badge/disclaimer text, the absence of action callbacks, preservation of the approved-only filter, safe preview omission of internal IDs/status, and zero staged paths. After the owner restarted backend, authenticated read-only current returned 0 actionable rows and all 9 STARTER `PENDING_REVIEW` previews; required display fields were present in every row and no internal ID/status field was exposed. The owner confirmed the dashboard previews rendered and the earlier AuthProvider warning was absent. Dashboard date/tracker restoration, Meal Plan connection, and the visual-polish pass all pass frontend no-emit, lint with the same 22 warnings, focused whitespace, `/dashboard` and `/meals` route-shell `200`, plus assertions that both pages consume pending metadata, the Meal Plan groups pending records by date and suppresses regeneration, pending dates feed the dashboard selector, previews filter by selected date, trackers precede previews, every redesigned card retains the verification note and no action callbacks, compact ingredient limiting works, and the review-progress hierarchy exists. Read-only runtime verification found 3 distinct pending scheduled dates with 3 meals per date, supporting both surfaces without a generation or database mutation. Final connected-page appearance, single-click network count, loading/error presentation, and full login/logout/three-role client navigation remain owner-assisted because the in-app browser is unavailable.
- Database accounting: read-only queries inspected aggregate prerequisite, status, latest-group, and library lifecycle counts. D1 verification created, modified, or deleted 0 records. The 9 pending rows were created by the owner's pre-fix generation attempt and were preserved. No direct synthetic Gemini call was needed because persisted fallback output already proved provider success.
- Google warnings: invalid GIS `width: '100%'` and repeated `initialize()` are separate source-observed issues in `GoogleSignInButton.tsx`; they were not evidenced as generation causes and are deferred to a dedicated OAuth UI lifecycle correction.
- Files: backend generation controller, Gemini helper, new result policy and test, existing test entry; frontend AuthContext, dashboard, unified Meal Plan page, shared Card/MealCard adjustments, and new dedicated pending-preview card; canonical engineering record and cleanup plan. No schema, migration, API route, package/lockfile, environment, `dist`, historical/held document, or unrelated form change.
- Dirty preservation: pre-existing owner hunks in controller sanitization, AuthContext HttpOnly-refresh work, and dashboard wellness/styling remain intact. The preflight recorded `main` at `8d72722dc42d43af2eef1b8616cfbceb1abc912e` with 126 dirty/untracked paths; the attachment's earlier 123-path count was stale. Nothing was staged or committed.
- Runtime boundary: all services remained owner-controlled. The owner restarted backend when requested; port 5000 was healthy and left running. The frontend later returned `200` for the dashboard route after the owner confirmed the pending cards. Codex did not start, stop, or restart either service; no agent process was started or stopped. One owner-authorized live generation remains optional for post-fix end-to-end mutation evidence and must declare cancellation/replacement effects before execution.
- Traceability: DEF-028/029, TEST-035, DOC-021. Next IDs: CHG-20260820-08, TEST-036, DOC-022.

---

### CHG-20260820-08 - Frontend visual system, public story, and role-aware portal shell

- Date: 2026-08-20.
- Scope: owner-authorized frontend theme replacement covering the global visual foundation, public landing page, a new public `/docs` project-story route, shared UI primitives, and the toggleable navigation shell used by USER, NUTRITIONIST, and ADMIN portals. No backend, API contract, authentication rule, meal safety/actionability rule, database, schema, migration, dependency, or environment behavior changed.
- Visual direction: replaces the earlier warm-grid presentation with a modern clinical-futurist system that supports both light and dark themes. The system uses deep botanical navigation surfaces, luminous lime/cyan accents, quieter translucent panels, tighter typography, more deliberate spacing, subtle grid/orb depth, and restrained motion. Shared Button, Card, Badge, Input, Modal, Checkbox, Tabs, Progress, Avatar, EmptyState, Navbar, Sidebar, and mobile navigation styling now derive from the same tokens.
- Public experience: the landing page now explains the product through a responsive hero and nutrition-cockpit mockup, capability bento, verified-library feedback loop, project-story preview, and clear onboarding/login calls to action. The header and footer expose the requested Docs link. `/docs` supplies a responsive editorial shell for origin, discovery, principles, system roles, and timeline content; every non-evidenced research/media area is explicitly identified as placeholder material rather than presented as a verified capstone finding.
- Portal navigation: the shared desktop sidebar retains independent local-storage collapse state, role-derived links, active-route state, profile/session controls, and logout. It now provides consistent USER/NUTRITIONIST/ADMIN styling and includes the existing nutritionist Patients route and each role's established destinations. Role layouts share one background/sizing/scroll shell; their mobile navigation uses the same compact dark dock treatment. The shared Navbar adds route-aware titles, role context, theme control, and system-state presentation without changing authentication or notification behavior.
- Verification: TEST-036 passes frontend TypeScript no-emit, lint with 21 pre-existing warnings and no new finding, focused source/whitespace checks for the theme files, and owner-server HTTP route shells. `/`, `/docs`, `/dashboard`, `/meals`, `/nutritionist/reviews`, and `/admin/overview` returned `200`. The in-app browser was unavailable, so no automated screenshot, responsive interaction, or pixel-level acceptance is claimed; final visual acceptance is explicitly owner-assisted.
- Runtime/change-control boundary: the healthy owner-controlled port-3000 Node service was reused read-only and left running. Codex started, stopped, or restarted no service. No Git path was staged or committed, and unrelated dirty backend, generated `dist`, credential, held-document, and owner application changes remain untouched.
- Files: frontend global stylesheet, Tailwind tokens, root metadata/layout, landing page, new `/docs` page, new shared public header, shared portal Navbar/Sidebar/BottomNav, three role layouts, and the shared UI primitives listed above; this record and the cleanup plan. Existing D1 dashboard/meal functionality is preserved.
- Traceability: TEST-036 and DOC-022. Next IDs: CHG-20260820-09, TEST-037, DOC-023.

---

### CHG-20260821-01 - Landing-system parity for authentication and role portals

- Date: 2026-08-21.
- Scope: owner-requested continuation of the frontend visual-system replacement so login, registration, account recovery/verification, and the page-level USER/NUTRITIONIST/ADMIN experiences use the same modern clinical-futurist language as the accepted landing page. Existing business behavior, route destinations, form validation, authentication calls, role guards, meal safety/actionability, database access, and API contracts remain unchanged.
- Authentication: added a shared two-panel auth shell with the landing page's dark intelligence surface, lime/cyan depth, editorial typography, product-story context, home/docs access, and responsive glass form panel. Login, registration, forgot-password, reset-password, and email-verification pages now use it. Existing form state, endpoints, accessible password controls, OTP behavior, cooldown, success/error handling, and redirect logic are preserved. The nested auth layout no longer emits a second `html`/`body` document. Google Identity button presentation is aligned to the new form surface and now supplies a bounded numeric width instead of the previously invalid percentage configuration.
- Authenticated shell: the portal background now suppresses the old page-level cream-grid impression in favor of role-independent radial depth. A shared dark `PortalPageHeader` establishes the landing hero hierarchy for page titles, context, actions, and status metadata. Dashboard, Meal Plan, Grocery, Progress, Profile, meal detail/export preview, nutritionist review/library/patients/approved/profile, and all admin screens adopt the shared hierarchy or a purpose-built cockpit/workspace equivalent.
- Components and page content: shared Card now detects explicit caller padding so the widespread `className="p-*"` pattern no longer receives a second default content inset. This removes the double-padded legacy-card appearance while retaining default padding for callers that do not supply it and respecting explicit `contentClassName`. Admin emoji metrics/status cells were replaced with Lucide icon tiles and structured metric/table surfaces. The nutritionist review queue is presented as a contained two-panel workspace; library filters and USER tab controls use the new glass/accent language. Notification surfaces and printable export's screen-only toolbar are aligned while print document styling remains intentionally white and unchanged in purpose.
- Verification: TEST-037 passes frontend TypeScript no-emit and lint with the same 21 pre-existing warnings. The owner-controlled development frontend returned `200` for login, register, forgot/reset password, verify email, Dashboard, Meal Plan, Grocery, Progress, Profile, Export, all five nutritionist destinations, and all four admin destinations. Focused rewritten-file whitespace/source checks pass. The in-app browser remains unavailable, so no automated visual, responsive, or interaction acceptance is claimed; the owner remains the final visual judge.
- Runtime/change-control boundary: the healthy owner-controlled port-3000 Node service was reused and left running. Codex started, stopped, or restarted no service. No backend, dependency/lockfile, schema, migration, database record, environment/credential, generated backend output, Git staging, commit, or history action occurred. Unrelated owner changes remain untouched.
- Traceability: TEST-037 and DOC-023. Next IDs: CHG-20260821-02, TEST-038, DOC-024.

---

### CHG-20260827-01 - Authoritative, resumable, privacy-aware USER onboarding

- Date: 2026-08-27.
- Scope: implement the complete owner-approved onboarding audit across registration guidance, email verification, six onboarding steps, current consent, nutrition-report eligibility, and normal USER feature prerequisites. Existing Next.js/Express/JWT/Prisma architecture, role destinations, meal actionability, nutritionist approval, dependencies, credentials, and Git history remain unchanged.
- Backend policy and validation: a pure onboarding policy now computes the first incomplete step from authoritative stored state. Strict Zod schemas allow-list profile fields, coerce bounded metrics, require adults aged 18-100 and `MALE`/`FEMALE` for the current calculation, reject unsupported fields and goal/target contradictions, require explicit condition/allergy selections, reject `NONE` contradictions, validate the shopping group, and require exact current consent versions plus three affirmative acknowledgements. Completion refuses incomplete state with `409 ONBOARDING_INCOMPLETE`; the existing Mifflin-St Jeor calculation receives stored biological sex instead of silently defaulting.
- Security and atomicity: verified email is required for onboarding writes. Nutrition-report routes additionally require completed onboarding and current consent; all normal USER meal, grocery, progress, profile, notification, weight, and check-in routes require verified email, completed onboarding, current consent, and acknowledged report. Profile persistence uses an explicit allow-list. Enum restrictions and custom text save in one transaction after deterministic normalization; unknown custom restrictions are retained conservatively and are not sent to Gemini before consent. Persistent OTP metadata enforces five failed attempts followed by a 15-minute lock, a 60-second resend cooldown, and existing IP limiters. Registration reports delivery failure truthfully without logging email/error detail.
- Consent and AI boundaries: the additive migration stores failed-attempt/lock/last-send state, accepted terms/privacy versions, and health-data consent time. The terms screen accurately discloses health-profile storage and conditional Google Gemini transfer, removes unsupported encryption/no-sharing claims, and distinguishes generated estimates from clinical care. Nutrition-report prompts no longer impersonate an RND, include the user's name, address the user by first name, or log identity; they explicitly prohibit diagnosis/prescription and clinician-review claims. Existing onboarded accounts with null version fields retain access; every new completion requires the current versions.
- Frontend UX/accessibility: all six steps hydrate stored values, preserve canonical progress labels, refresh authoritative session state after writes, and resume at the first incomplete path after login or route guarding. Statistics adds calculation-purpose biological-sex disclosure and HTML numeric bounds. Registration password guidance now matches backend uppercase/number rules, failed initial OTP delivery produces honest resend guidance, selection cards expose `aria-pressed`, and custom-entry combobox/listbox/remove controls receive programmatic accessibility state/labels.
- Data/change boundary: `20260827090000_harden_user_onboarding` is additive only. It was created and validated but not applied; no database query or record mutation occurred. Prisma Client v5.22.0 was regenerated locally after the owner stopped port 5000. No package or lockfile changed, and no generated engine/temp artifact entered Git.
- Verification: TEST-038 passes 108 registered backend tests (104 pass, 0 fail, 4 pre-existing TODO), backend/frontend TypeScript no-emit, Prisma schema validation, generated-client recognition through backend compilation, frontend lint with 21 pre-existing warnings and no onboarding finding, focused whitespace, additive-SQL, package/lockfile, Git-artifact, and port-ownership checks. Live new-account/API/browser acceptance is intentionally not claimed because the migration was not applied. The owner-controlled frontend on port 3000 remained running; the owner stopped the backend correctly with Ctrl+C for client generation, and Codex did not restart it.
- Files: additive migration/schema; onboarding/email-verification domain policies; Zod validation and middleware; auth/user middleware, routes, controllers, and services; nutrition-report prompt/log privacy changes; backend test entry/config/new regression file; frontend register/verify pages, six onboarding pages, profile hook, AuthContext, RouteGuard, AutocompleteInput; this canonical record.
- Traceability: REQ-012, ADR-010, RISK-020, DEF-030, TEST-038, DOC-024. Next IDs: CHG-20260827-02, TEST-039, DOC-025.

---

### CHG-20260827-02 - Onboarding migration deployment and bounded runtime acceptance

- Date: 2026-08-27.
- Deployment: the owner ran `npx.cmd prisma migrate deploy` from the backend and reported successful application of `20260827090000_harden_user_onboarding`. The managed Codex process could reach the Neon host over TCP but could not independently run Prisma schema-engine commands because Windows TLS returned P1011; deployment truth is therefore owner-command evidence corroborated by successful runtime reads of every new column.
- Runtime ownership: the owner stopped and later restarted the backend in their terminal. Codex briefly started one temporary backend only to classify the managed TLS limitation, recorded launcher PID 4900 and listener PID 17248, then stopped exactly those PIDs and verified port 5000 free. The final backend is owner-controlled PID 17092, health 200, and was reused without restart/stop. The owner frontend remained PID 9236 on port 3000 and untouched.
- Existing-account compatibility: the ignored USER fixture logged in with 200, received an access token, loaded `/api/user/profile` with 200, exposed all three new consent fields plus authoritative onboarding status, retained `onboardingDone=true`, and reached `/api/user/meals/current` with 200. This proves the deployed columns are queryable and the legacy-consent compatibility rule does not lock out the established USER.
- Strict negative contracts: authenticated requests containing an unknown profile field, `NONE` plus another condition, and `NONE` plus a custom allergy each returned 400 before controller persistence. No existing USER profile, health, meal, grocery, report, or log record was changed by these rejected requests.
- Synthetic account: one timestamped Gmail-plus alias derived from the existing USER test mailbox was registered with a random undisclosed password. Registration returned 201, supplied a session, and reported email delivery success. Profile returned 200 with next path `/onboarding/stats`; a valid-shaped onboarding write before verification returned 403. One cooldown check occurred after sufficient elapsed time and legitimately resent the code, so two verification emails were issued in total. Six invalid synthetic OTP attempts returned 400; the account remained unverified and subsequent resend returned 400 with the persistent lock response. No health/profile/onboarding data was saved for this account. It remains intentionally unverified/locked because the repository has no safe owner-scoped test-account deletion workflow and Codex did not request or inspect an OTP.
- Verification boundary: migration application, new-column runtime reads, legacy readiness, validation rejection, resume state, verified-email prerequisite, and failed-attempt lock are accepted. OTP-success, consent persistence, completion calculation, report acknowledgement, and the full hydrated browser journey remain owner-assisted because verification codes are credentials and were not requested or accessed.
- Traceability: TEST-039 and DOC-025. Next IDs: CHG-20260827-03, TEST-040, DOC-026.

---

## 13. Feature implementation status

| Feature | Actor | Implementation evidence | Verification level | Gaps/risks | Next action |
| --- | --- | --- | --- | --- | --- |
| Credentials/Google auth/OTP/reset/refresh | All | auth routes/controller/service; frontend auth pages/context | Existing USER/NUTRITIONIST/ADMIN credential login runtime-verified; render-phase AuthProvider navigation corrected and statically verified; owner previously verified USER traditional and Google login/dashboard | browser-console/client-routing recheck, GIS width/reinitialization warnings, revocation, OTP/reset/refresh | Owner browser recheck D1, then address remaining auth lifecycle separately |
| Password visibility controls (F1) | All frontend credential forms | reusable `PasswordInput`; login/register/reset/profile pages | 8/8 rendered password fields covered; source/static/type/lint verified | interactive browser/cursor/responsive verification unavailable in F1 session | Owner browser review with synthetic text, then commit as one isolated frontend/documentation unit |
| User onboarding/profile/ToS | USER | onboarding policy/schemas/prerequisite middleware; user routes/controller/service; six onboarding pages | Source/unit/static verified by TEST-038; migration/new columns, legacy readiness, strict negative DTOs, resume state, email prerequisite, and OTP lock runtime-verified by TEST-039 | OTP-success, consent/completion/report acknowledgement, and full browser journey remain owner-assisted; current binary calculation input may require later product-policy review | Owner performs one manual verified-email/browser completion using a disposable mailbox when convenient |
| Nutrition report/PDF | USER | report service/controller/page/PDF lib | Statically verified | AI/clinical validation, runtime PDF | Isolated integration and clinical review |
| Meal generation/FNRI | USER | generation service, Gemini/FNRI libs, actionability/result policies, restriction policy, generation library adapter | Owner pre-fix attempt proves library exclusion, Gemini fallback, FNRI preparation, transaction, and 9-row pending persistence; D1 pending-summary contract is unit/API verified | no post-fix mutating generation; legacy library evidence remains incomplete; prompt/clinical rules remain unreviewed | Owner browser recheck; optional separately authorized post-fix generation; keep review/actionability boundary |
| Current/history/detail/status | USER | meal routes/controller/pages, actionability policy | Unit/closest-boundary plus authenticated negative-state API integration verified; history/current route shells pass | positive approved-current live fixture unavailable; full browser interactions and duplicate/timestamp log semantics | Recheck positive path only when a natural fixture exists; do not create one for smoke verification |
| Outside logging | USER | meal-log service/controller/dashboard | Rule inventory/design verified only; explicitly excluded from Batch 4B1 | estimate identity, custom restrictions, unreviewed thresholds, direct-conflict acknowledgement policy | Separate owner/RND decision and implementation batch |
| Swapping/library options | USER | swap service, actionability policy, isolated restriction policy, and meals UI | Both pure policies unit-verified independently; Batch 4B2 adapter intentionally not imported | null/empty compatibility metadata, custom restrictions, ingredient provenance | Separate future batch after evidence contract; do not reuse without caller design |
| Grocery/PDF | USER | grocery service/controller/page, actionability policy | Generation policy unit-verified; authenticated current retrieval and grocery route shell verified | stored provenance, generation/PDF runtime, quantities, progress reset | Resolve provenance design only under a separate approved batch |
| Weight/progress/check-in | USER | progress/weight/check-in services/pages | Progress history and check-in status authenticated GETs plus route shells verified | mutating flows, idempotency, timezone | Consolidation and tests |
| Water tracking | USER | dashboard local state/storage | Partially implemented | not user/date scoped or backend persisted | Product decision |
| Nutritionist directory/consultation | USER | frontend page only | Partially implemented | missing API; placeholder consultation | Product decision |
| Review/approval/rejection | NUTRITIONIST | nutritionist service/routes/review page | Pending-only 47-row queue and approved archive authenticated API-verified read-only; role route shells pass; policy unit-verified | sorting, claims, ownership, transactions; no review mutation tested | Concurrency tests/fix in a separately approved batch |
| Nutritionist meal library/flags | NUTRITIONIST | routes/service/library page, isolated restriction policy, ADR-009 design, and Batch 4B4 lifecycle schema | Additive lifecycle/reviewer migration deployed and record/link/default preservation verified; no write/API/UI behavior changed | historical-plan evidence dependency, no first-class ingredients/declarations/history, no certification writer, role-only route gate | Separately approve stable evidence persistence and workflow design; keep every current row incomplete |
| Nutritionist patients | NUTRITIONIST | frontend page only | Partially implemented/stale | missing API and removed assignment model | Reframe/hide pending decision |
| Admin analytics/users/verification | ADMIN | admin service/routes/pages | Existing ADMIN login, analytics, user/nutritionist listings, RBAC denials, and three route shells authenticated/API or HTTP verified | mutation lifecycle and client interactions unverified; weak verification lifecycle | Product/security design |
| Notifications | USER | notification service/routes/hook | Authenticated notification GET verified without marking records read | polling/client interaction and mutations unverified | Integration tests |
| PWA/offline | All | manifest/icons | Partially implemented | no service worker/offline verification | Truthful label or future implementation |
| Export | USER | export page | Partially implemented | print-style snapshot, not full data export | Product decision |
| CI/deployment/monitoring | Project | no repository evidence found | Planned/uncertain | no quality/release gate | Confirm external state, then design |

---

## 14. SPMP extraction index

| SPMP topic | Source record IDs/sections | Current summary | Last updated |
| --- | --- | --- | --- |
| Scope and objectives | Section 3; REQ-001-009 | Stabilize current architecture in bounded phases | 2026-08-19 |
| Work breakdown/phases | `NUTRIMIND_CLEANUP_PLAN.md` | Documentation, tests, safety, auth, transactions, data/product, readiness | 2026-08-19 |
| Schedule/status | CHG-20260819-01 through 10; CHG-20260820-01 through 05 | Phase 0-1, Stabilization S1, and the authorized S1A commit separation are recorded; final post-commit regression determines `GO` for unrelated feature work | 2026-08-20 |
| Risk management | RISK-001-019 | Library authority/history risk is now explicitly designed; implementation, semantic/clinical approval, stored provenance, browser, auth, concurrency, credentials, and calorie policy remain | 2026-08-20 |
| Configuration/change control | ADR-001-007 accepted; ADR-008 implemented at bounded generation selection; ADR-009 lifecycle snapshot implemented; CHG-20260820-01 through 05 | Four bounded local cleanup commits separate approved work while owner/mixed/generated/held paths remain excluded and preserved | 2026-08-20 |
| Quality assurance | TEST-001-033; ADR-004/006/007/008/009 | B4B4R baseline is the expected post-S1A target; TEST-033 final regression is executed after the documentation commit; TODO disposition and demo gates remain explicit | 2026-08-20 |

---

## 15. SRS traceability matrix

| Requirement ID | Requirement summary | Actor | Design components | Test IDs | Status |
| --- | --- | --- | --- | --- | --- |
| REQ-001 | Preserve/harden current architecture | Project | frontend, API, auth, Prisma | TEST-001-005 | Approved by ADR-001 |
| REQ-002 | Only approved meals are actionable | USER | central policy, controller, grocery/log/swap/generation/review consumers | TEST-013/014/024 active | Implemented; unit/closest-boundary and authenticated negative-state integration verified; positive approved-current/stored provenance remain unverified |
| REQ-003 | Deterministic complete restrictions | USER/NUTRITIONIST | restriction engine plus generation library adapter; other callers future | TEST-015/016/027/028 active | Partially implemented for generation library selection |
| REQ-004 | Backend policy enforcement | All | auth/RBAC/prerequisite policies | Future | Proposed; defect open |
| REQ-005 | Transactional/idempotent mutations | All | services, schema, jobs | TEST-018-020 TODO | Proposed |
| REQ-006 | Validate/redact AI and health data | All | restriction policy and generation adapter plus future schemas/adapters/logging | TEST-016/027/028 active; TEST-018/021 TODO | Partially implemented in policy/generation library boundary |
| REQ-007 | Truthful documentation status | Project | engineering record and contributor/legacy documentation | TEST-005-009 | Implemented for Batch 1 |
| REQ-008 | Automated tests/CI | Project | test harness/CI | TEST-010-021/027/028 | 86 local tests passed in the latest Batch 4B2 run; 5 specs TODO and CI absent |
| REQ-009 | Asia/Manila business boundaries | All | date/schedule policy | TEST-014 active; TEST-017 TODO | Meal actionability implemented; system-wide behavior deferred |
| REQ-010 | Structured conservative deterministic restriction evaluation | USER/NUTRITIONIST/system | pure policy plus meal-generation library adapter; other callers proposed | TEST-015/016/025-028 pass | Generation boundary integrated; broader production integration and clinical decisions pending |
| REQ-011 | Current authoritative evidence before automatic library reuse | NUTRITIONIST/system | ADR-009 lifecycle snapshot plus future first-class ingredients/declarations/history, qualified writer, and adapter revision | TEST-029 design/profile and TEST-030 migration/preservation pass; future workflow tests | Lifecycle foundation implemented; both existing rows remain incomplete and fallback remains; certification cannot function |
| REQ-012 | Authoritative resumable USER onboarding and current health-data consent | USER/system | onboarding policy, strict schemas, prerequisite middleware, atomic services, versioned consent/OTP columns, hydrated six-step UI | TEST-038 unit/static and TEST-039 bounded runtime pass | Implemented/deployed; OTP-success and post-verification browser completion remain owner-assisted |

---

## 16. SDD extraction index

| SDD topic | Evidence | Current design summary | Needed next |
| --- | --- | --- | --- |
| System architecture | Section 3.2; ADR-001 | Accepted Next.js client + Express/custom JWT API + Prisma/PostgreSQL | Keep implementation aligned; later changes require ADR |
| Component design | Sections 3.5/3.7 | Mixed route/controller/service separation | Refactor only after tests |
| Database design | Section 10; ADR-009; DOC-015/016 | Relational health/meal/log/grocery models; additive lifecycle snapshot implemented; first-class library evidence proposed | Separately design/migrate evidence rows and history before any certification write |
| API/interface design | Section 9; ADR-009 | REST route groups via Axios; strict draft/certify/revision interfaces proposed | DTO, ownership/authority, concurrency, and contract tests |
| Security design | Section 3.6; RISK-003/005/019 | JWT/RBAC plus client prerequisites; verified/unexpired nutritionist certification proposed | Backend prerequisite policy, audit retention, and revocable sessions |
| State transitions | Section 3.7; ADR-009; DEF-008/013/014/027 | Status-driven plans/reviews/logs; independent library evidence lifecycle persisted with default incomplete | Implement and test guarded certification/invalidation transitions only after separate approval |

---

## 17. STD execution summary

| Test cycle/date | Scope | Environment | Passed | Failed | Blocked/not run | Defects | Acceptance status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline 2026-08-19 | Backend/frontend TS, Prisma, frontend lint | Local workspace; installed dependencies | 4 static checks | 0 | All runtime/unit/integration/E2E/external checks | DEF-001-016 from inspection | Static baseline accepted; product behavior unverified |
| Cleanup Batch 1, 2026-08-19 | Current documentation placeholders, links, completion claims, secrets, and diff scope | Local workspace; documentation only | 5 documentation/security checks | 0 after remediation | Application/runtime test levels not run | DEF-017 working-tree value redacted; security follow-up remains open | Batch 1 documentation accepted; runtime status unchanged |
| Cleanup Batch 2A, 2026-08-19 | Pure calculation units, synthetic fixture integrity, critical-behavior TODO specifications, static regression | Local workspace; external-service variables cleared for isolation rerun | 13 backend tests plus 5 existing static/install checks | 0 | 9 TODO specifications; API/integration/E2E/external/clinical checks | DEF-018/019 opened; known DEF-008/009/013/014/015 specified | Minimal local backend baseline accepted; production safety behavior remains unverified |
| Cleanup Batch 3, 2026-08-19 | Approved/current status policy, current/grocery/log/total/swap/candidate/review boundaries, static regression | Local workspace; external-service variables cleared; pure/query seams only | 28 backend tests plus existing static checks | 0 | 7 TODO; Prisma/API/E2E/live/external/clinical checks | DEF-008 resolved in source; DEF-020/RISK-015 opened | Source change accepted with unit evidence; runtime integration remains unverified |
| Cleanup Batch 3B, 2026-08-19 | Backend/frontend startup, health/protected HTTP boundaries, frontend route compilation, credential/auth diagnosis, Batch 3 regression/static suite | Local workspace; configured remote DB ambiguous and unreachable; in-app browser unavailable; no mutations | 2 service startups, health, 4 protected `401` checks, 6 frontend route renders, 28 backend tests, and 4 static checks | 0 confirmed Batch 3 regressions | 15 authenticated/data-backed checks plus browser client checks blocked; 7 automated TODO specifications remain | DEF-021/022 and RISK-016 recorded; no correction made | Partial acceptance: available runtime is healthy, but authenticated actionability remains uncertified |
| Cleanup Batch 3C, 2026-08-19 | Env loading, URI structure, DNS, TCP, PostgreSQL SSL/TLS, Prisma `SELECT 1`, read-only ADMIN/NUTRITIONIST authentication and endpoints | Restricted context compared with approved network-permitted context; SMTP suppressed; no mutations | All 5 connectivity layers in permitted context; 2 logins; ADMIN analytics; nutritionist profile, 47-row pending queue, 1-row approved archive | 0 application/database failures after network permission | USER current/history/grocery/totals/`409` checks blocked; target dev/test classification still owner-confirmed only | RISK-016 diagnosed/mitigated for read-only checks; UNC-011/012 remain | Connectivity diagnosis accepted; available authenticated runtime passes without source/config changes |
| Cleanup Batch 3D, 2026-08-19 | Existing USER/NUTRITIONIST/ADMIN login/RBAC, read-only role APIs, USER non-approved exclusion/`409`, nutritionist queue, frontend route shells, regression tests | Owner-confirmed shared persistent development/demo DB; ignored local credentials; network-permitted services; SMTP suppressed; no successful mutation | 42 runtime assertions plus 28 automated tests | 0 final-cycle runtime or automated failures | 3 runtime categories blocked; 7 automated TODO | No new application defect; DEF-020/022 and RISK-015 remain | Batch 3 accepted for capstone development within documented read-only/actionability boundary; not release/clinical/E2E readiness |
| Cleanup Batch 4A, 2026-08-19 | Schema/frontend/backend restriction vocabulary; hard-coded rule/caller inventory; privacy-safe aggregate profile; policy/test/implementation design | Local source plus owner-confirmed development/demo DB in explicit read-only transactions; no application runtime or external services | TEST-025 design/profile criteria | 0 | TEST-015/016 intentionally remain TODO; clinical/semantic decisions and Batch 4B implementation blocked | DEF-023-026 and RISK-018 recorded; existing DEF-009 expanded | Design accepted as evidence, not runtime behavior or clinical validation |
| Cleanup Batch 4B1, 2026-08-19 | Pure deterministic restriction contract, exact aliases, conservative evidence defaults, synthetic policy regression, and isolation | Local workspace only; no application runtime, database, Prisma client, HTTP, Gemini, or external service | 31 active restriction cases; 64 total backend tests; TEST-026 static/isolation suite | 0 | 5 unrelated TODO; no production caller integration or clinical validation | Production DEF-009/023-026 and RISK-018 remain open | Pure policy accepted as unit evidence only; live behavior unchanged |
| Cleanup Batch 4B2, 2026-08-19 | Meal-generation library compatibility adapter, approved-only/read-only evidence loading, candidate exclusion, and fallback seam | Local workspace only; synthetic callbacks; no application runtime, database, Prisma client, HTTP, Gemini, or external service | TEST-027/028: 27 active cases; 91 total backend tests; static/isolation suite | 0 | Live generation/API/database behavior and clinical completeness unverified; 5 unrelated TODO | DEF-024/025 partially mitigated for generation; legacy evidence gap remains | Source/unit acceptance for generation selection only; no live/runtime claim |
| Cleanup Batch 4B3, 2026-08-20 | Library schema/migration/workflow/UI/adapter inspection, privacy-safe aggregate profile, lifecycle/data/migration/API/UI/test design | Local source plus owner-confirmed development/demo DB through one aggregate-only explicit `READ ONLY` transaction; documentation changes only | TEST-029 design/profile criteria | 0 | Schema/migration/write/API/UI/adapter revision, automated implementation tests, runtime, and clinical review not run | DEF-027 and RISK-019 opened; UNC-015 records decisions | Design accepted; 2 legacy rows preserved, 0 certifiable from current evidence, 0 records changed |
| Cleanup Batch 4B4, 2026-08-20 | Additive lifecycle schema/migration, SQL safety, deployment, legacy defaults, exact count/hash/link preservation, compatibility regression | Owner-confirmed shared development/demo DB; no app service; sanitized migration tooling and explicit read-only aggregate snapshots | TEST-030; migration/status/schema parity; 91 backend tests; both no-emit checks; lint | 0 | Client generation blocked by Windows `EPERM` but not required by this no-consumer batch; certification/API/UI/adapter/clinical checks not run; 5 TODO | DEF-027/RISK-019 partially mitigated; no new application defect | Migration accepted: 2 legacy rows incomplete, 0 complete, 0 domain records changed/deleted, all counts/links preserved |
| Cleanup Batch 4B4R, 2026-08-20 | Post-restart Prisma Client v5.22.0 recovery; generated enum/field/relation metadata; regression and Git/artifact safeguards | Local workspace only; owner performed generation; Codex used generated metadata and static/test tools; no database connection | TEST-031; 91 backend tests; both no-emit checks; Prisma validation; lint; hash/Git/credential/port audit | 0 | 5 existing TODO; certification/API/UI/adapter/clinical checks not run | Original external Windows lock remains unattributed but cleared by restart | Recovery accepted; generated client matches Batch 4B4 schema and repository state is preserved |
| Onboarding hardening, 2026-08-27 | Resume policy, DTO validation, backend prerequisites, atomic health saves, current consent, OTP controls, privacy-minimized report prompt, accessible hydrated UI | Local workspace; owner stopped backend for generated-client recovery; frontend owner service reused; no database access or mutation | TEST-038; 108 registered/104 pass/0 fail/4 TODO; both no-emit checks; Prisma validation/client generation; lint; SQL/Git/artifact checks | 0 source/unit/static failures | Migration deployment and live authenticated new-account/API/browser flow not run | DEF-030 resolved in source; deployment/runtime acceptance pending | Source implementation accepted; not deploy/runtime accepted until migration and owner verification |
| Onboarding deployment/runtime, 2026-08-27 | Additive migration; new-column reads; existing USER compatibility; strict negative DTOs; synthetic resume/email prerequisite/OTP lock | Owner-applied migration; owner-controlled backend/frontend; ignored fixture credentials; one synthetic unverified account; no real health data | TEST-039 bounded runtime assertions all pass | 0 confirmed runtime failures | OTP-success, consent/completion/report acknowledgement, full browser journey | Managed Prisma schema-engine TLS P1011 is environmental; synthetic account remains locked/unverified | Deployment accepted for bounded runtime scope |

---

## 18. Current known limitations and next priorities

1. Database connectivity and existing USER/NUTRITIONIST/ADMIN authentication/RBAC are runtime-verified for the owner-confirmed shared development/demo target when outbound PostgreSQL TCP is permitted.
2. Approved-meal actionability is centralized and unit-verified; authenticated pending/rejected/cancelled and non-approved-log exclusion plus invalid-state `409` behavior are runtime-verified. The positive approved-current live path and stored-grocery provenance remain unverified under RISK-015/UNC-010/013.
3. Meal-generation library selection uses the restriction adapter and current rows fall back. ADR-009 lifecycle/reviewer/revision fields are now persisted with conservative defaults, but first-class provenance/history, certification writes, and adapter mapping are not implemented.
4. Onboarding source and additive migration are deployed with bounded API verification. OTP-success, consent/completion/report acknowledgement, and full hydrated browser acceptance remain owner-assisted. Four unrelated TODO specifications and absent CI remain open.

Recommended next action after S1A verification:

If TEST-033 passes, select one unrelated feature scope and reconcile only the exact preserved owner/held paths it must touch before implementation. Do not begin Batch 4B5 automatically; it remains separately gated.

---

## 19. Documentation register

| ID | Documentation item | Status | Evidence |
| --- | --- | --- | --- |
| DOC-001 | Establish canonical living engineering record | Accepted canonical/maintained | This file; ADR-002 |
| DOC-002 | Establish cleanup batch plan | Batches 1, 2A, and 3 completed; later batches proposed | `docs/NUTRIMIND_CLEANUP_PLAN.md` |
| DOC-003 | Create repository contributor entry point | Completed | `README.md` |
| DOC-004 | Classify legacy prompts, references, handoff notes, changelog, and addenda | Completed | Status notices in listed legacy documents |
| DOC-005 | Document all code/config-observed environment names without secret values | Completed | `README.md` environment-variable reference |
| DOC-006 | Replace generic frontend README with project-specific setup/status | Completed | `nutrimind-frontend/README.md` |
| DOC-007 | Document the minimal backend test harness, isolation rules, and TODO-specification semantics | Completed | `nutrimind-backend/tests/README.md`; ADR-006; CHG-20260819-03 |
| DOC-008 | Document the approved-meal status matrix, policy consumers, API behavior, tests, and residual limitations | Completed | ADR-007; CHG-20260819-04; cleanup plan; root/test README |
| DOC-009 | Document Batch 3B runtime/API/frontend evidence, blocked checks, environment gate, and residual risks without exposing secrets or health data | Completed | TEST-022; CHG-20260819-05; cleanup plan |
| DOC-010 | Document Batch 3C sanitized connectivity classification, read-only authenticated results, records-read/changed accounting, and remaining owner action | Completed | TEST-023; CHG-20260819-06; cleanup plan |
| DOC-011 | Document Batch 3D credential safeguards, three-role runtime/API evidence, no-mutation accounting, blocked positive/browser/provenance paths, and capstone-development acceptance boundary | Completed | TEST-024; CHG-20260819-07; cleanup plan |
| DOC-012 | Establish the Batch 4A canonical restriction vocabulary, aggregate profile, current-rule inventory, proposed contract/matrices, TEST-015/016 plan, Batch 4B boundary, and exact owner/RND decisions | Completed design evidence; not clinical approval | `docs/NUTRIMIND_RESTRICTION_POLICY_DESIGN.md`; TEST-025; CHG-20260819-08; cleanup plan |
| DOC-013 | Record the Batch 4B1 implemented pure contract, reason order, aliases/rejections, TEST-015/016 activation, isolation evidence, limitations, and Batch 4B2 boundary | Completed unit/static evidence; no production or clinical claim | `docs/NUTRIMIND_RESTRICTION_POLICY_DESIGN.md` section 15; TEST-026; CHG-20260819-09; cleanup/test/root README |
| DOC-014 | Record the Batch 4B2 adapter/evidence mapping, generation-only integration, eligibility/fallback behavior, existing-record impact, verification, rollback, and Batch 4B3 boundary | Completed source/unit/static evidence; no live generation or clinical claim | `docs/NUTRIMIND_RESTRICTION_POLICY_DESIGN.md` section 16; TEST-027/028; CHG-20260819-10; cleanup/test/root README |
| DOC-015 | Define the Batch 4B3 library evidence lifecycle, fields/models, declaration/cross-contact semantics, first-class ingredient provenance, reviewer authority, staleness, migration/backfill/recovery, API/UI, adapter mapping, tests, roadmap, and owner/RND decisions | Completed design/read-only aggregate evidence; no implementation or clinical claim | `docs/NUTRIMIND_LIBRARY_SAFETY_EVIDENCE_DESIGN.md`; restriction design section 17; ADR-009; TEST-029; CHG-20260820-01; cleanup plan |
| DOC-016 | Record the Batch 4B4 exact lifecycle schema/migration/defaults, preservation evidence, compatibility boundary, client-generation limitation, recovery plan, and remaining certification work | Completed migration/schema evidence; no certification, API/UI, adapter, or clinical claim | `docs/NUTRIMIND_LIBRARY_SAFETY_EVIDENCE_DESIGN.md` section 13; restriction design section 18; TEST-030; CHG-20260820-02; cleanup plan |
| DOC-017 | Record successful Batch 4B4R client regeneration, generated metadata verification, regression results, artifact/hash/credential/port safeguards, and stabilization boundary | Completed local operational recovery evidence; no database, schema, dependency, source, or feature change | TEST-031; CHG-20260820-03; cleanup plan |
| DOC-018 | Record S1 complete working-tree classification, proposed commit boundaries, TEST-017-021 disposition, material risk re-ranking, conditional feature readiness, and deferred cleanup | Completed assessment/planning evidence; no staging, code, database, dependency, or history change | TEST-032; CHG-20260820-04; cleanup plan |
| DOC-019 | Record S1A exact commit boundaries, first three commit hashes, hunk exclusions, preservation safeguards, and post-commit verification gate without self-amending the documentation commit | Completed local change-control evidence; final regression is reported after this commit | TEST-033; CHG-20260820-05; cleanup plan |
| DOC-020 | Record F1 password-field inventory, accessible visibility-control behavior, exact files, dirty-owner preservation, verification, exclusions, and browser limitation | Completed frontend feature evidence; interactive browser verification remains unclaimed | TEST-034; CHG-20260820-06 |
| DOC-021 | Record D1 AuthProvider and generation-result root causes, read-only database/API evidence, bounded fixes, privacy behavior, regression results, mutation gate, Google-warning disposition, and owner runtime steps | Completed source/unit/API/read-only evidence; browser/client and post-fix mutation checks remain owner-assisted | TEST-035; CHG-20260820-07; DEF-028/029; cleanup plan |
| DOC-022 | Record the frontend visual-system replacement, public project-story route, shared three-role navigation shell, placeholder-content boundary, static/route verification, runtime ownership, and owner-assisted visual acceptance | Completed source/static/HTTP evidence; automated browser and final responsive visual judgment remain unclaimed | TEST-036; CHG-20260820-08; cleanup plan |
| DOC-023 | Record landing-system parity across auth and role pages, shared AuthShell/PortalPageHeader/Card behavior, Google button presentation correction, exact verification boundary, runtime ownership, and owner visual-acceptance requirement | Completed source/static/HTTP evidence; automated browser and final responsive visual judgment remain unclaimed | TEST-037; CHG-20260821-01; cleanup plan |
| DOC-024 | Record authoritative onboarding policy, strict validation, server prerequisites, atomic health saves, versioned consent, OTP controls, privacy/accessibility corrections, additive migration boundary, and exact verification/deployment limits | Completed source/unit/static evidence; migration deployment and live authenticated/browser acceptance remain pending | REQ-012; ADR-010; RISK-020; DEF-030; TEST-038; CHG-20260827-01 |
| DOC-025 | Record owner-applied onboarding migration, managed TLS limitation, exact process ownership, new-column/legacy compatibility evidence, strict negative contracts, synthetic account/OTP-lock mutations, retained-account state, and unverified browser boundary | Completed bounded runtime evidence; OTP-success and post-verification browser journey remain owner-assisted | TEST-039; CHG-20260827-02 |

---

## 20. Shared modal theme-surface correction (2026-08-30)

**Change ID:** CHG-20260830-01

**Verification ID:** TEST-040

- Corrected the active shared modal at `frontend/src/components/ui/Modal.tsx` after the owner renamed the application directories to `backend` and `frontend`.
- Root cause: opacity modifiers on CSS-variable-backed theme utilities such as `bg-brand-surface/95` were not reliably emitted, allowing the dark overlay to show through behind light-theme text.
- Replaced the translucent modal, close-control, and divider utilities with solid semantic theme tokens (`brand-surface`, `brand-bgAlt`, `brand-border`, and `brand-text`). The correction applies consistently to light and dark themes without hardcoded modal colors.
- Added a `90vh` height limit with vertical overflow so longer modal forms remain usable on smaller viewports.
- Verification: frontend no-emit TypeScript passed; frontend lint completed with only pre-existing warnings; the Next.js production build compiled and generated all 35 routes successfully.
- Browser limitation: an unauthenticated in-app browser remained at the application's loading gate, so the authenticated weekly-check-in modal was not directly browser-accepted in that session. Final visual confirmation remains owner-assisted after reload.
- No backend, database, environment, dependency, or API behavior was changed.

---

## 21. Meal-plan generation progress experience (2026-08-30)

**Change ID:** CHG-20260830-02

**Verification ID:** TEST-041

- Replaced the dashboard's generation spinner with a dedicated theme-aware progress experience in `frontend/src/components/user/MealPlanGenerationProgress.tsx`, integrated by `frontend/src/app/(user)/dashboard/page.tsx`.
- Added an animated semantic progress bar, estimated percentage, estimated remaining time, six changing high-level pipeline messages, and a server-confirmed completion state.
- Progress is explicitly presented as estimated because the current generation endpoint is one synchronous request without server stage events. It advances on an elapsed-time curve, slows and caps at 94% during long requests, and reaches 100% only after a successful API response.
- The success state remains visible briefly before the completed meal plan replaces it. Errors continue through the dashboard's existing error handling.
- Styling uses the established `brand-surface`, `brand-bgAlt`, `brand-border`, `brand-green`, `brand-cyan`, `brand-accent`, `brand-text`, and `brand-muted` tokens for light/dark consistency. The progress region exposes live/busy and progressbar semantics.
- Verification: frontend no-emit TypeScript passed; frontend lint completed with only pre-existing warnings; the Next.js production build compiled and generated all 35 routes successfully.
- Browser limitation: the available in-app browser had no authenticated application session and remained at the existing loading gate, so starting a live generation request and final visual acceptance remain owner-assisted.
- No backend, database, environment, dependency, migration, or API contract was changed.

---

## 22. Accessible mixed-cuisine generation policy (2026-08-30)

**Change ID:** CHG-20260830-03

**Verification IDs:** TEST-042, TEST-043, TEST-044

- Reframed NutriMind's meal-generation objective from Filipino-only output to accessible, culturally aware mixed-cuisine planning for users living in the Philippines.
- Added the pure `backend/src/domain/meal-generation-cuisine.policy.ts` prompt builder and integrated it into `backend/src/services/meal-generation.service.ts`.
- The policy ranks clinical restrictions, allergies, dietary preference, nutrition targets, affordability, effort, and realistic Philippine availability above cuisine nationality. Food culture is an influence rather than an exclusive boundary.
- Generated plans may combine Filipino staples, universally familiar meals, locally popular foods originating from other cultures, and suitable ready-to-eat or convenience products. Clinical safety overrides convenience and variety.
- The FNRI reference remains authoritative nutrient context but is no longer described as an exclusive native-ingredient dictionary. `getFNRISubset()` now returns a balanced sample of up to ten items from each of all thirteen seeded FNRI categories rather than an arbitrary subset of six categories.
- Nutrition-report guidance and active frontend meal-plan wording were aligned with the mixed-cuisine accessibility goal. The generation prompt no longer transmits the user's name because it was unnecessary for the task.
- TEST-042 verifies culture-as-influence semantics; TEST-043 verifies explicit support for general/convenience foods and local availability; TEST-044 verifies clinical constraints remain higher priority.
- Verification: the three focused policy tests pass; backend no-emit TypeScript and production build pass; frontend no-emit TypeScript and the Next.js production build pass with all 35 routes generated. Existing frontend lint warnings remain unrelated.
- Full `tsx` suite execution remains environmentally blocked in the restricted Codex identity by Node v24 `uv_os_get_passwd` returning `ENOMEM`; the focused tests were compiled to an isolated temporary directory and executed with Node's built-in test runner.
- No database records, schema, migration, dependencies, environment values, live Gemini request, or persisted meal plan were changed. The policy applies to future generation requests after the backend restarts.

---

## 23. Repository structure and hygiene cleanup (2026-08-30)

**Change ID:** CHG-20260830-04

**Verification ID:** TEST-045

**Documentation ID:** DOC-026

- Renamed the application directories from `nutrimind-backend/` and `nutrimind-frontend/` to the concise `backend/` and `frontend/` paths while preserving source, migrations, lockfiles, assets, and substantive owner edits.
- Removed the previously tracked backend `dist/**` output from the versioned tree. Current backend `dist`, frontend `.next`, dependency directories, TypeScript generated files, and local environment files remain present only as ignored local artifacts where applicable.
- Generalized root ignore rules for nested build and environment outputs, retained package-level ignore rules, and added versionable backend/frontend environment templates containing names and placeholders only.
- Added the root Node 24 pin, package engine constraints, and `.github/workflows/ci.yml` for backend install/generate/test/build and frontend install/lint/build checks.
- Updated active contributor and agent documentation to use `backend/` and `frontend/`. Explicitly historical prompts and audit snapshots retain their period-accurate names.
- Corrected the stale frontend meal hook from `GET /api/user/meals` to the implemented `GET /api/user/meals/current` route and made backend credentialed CORS origins environment-configurable with safe development defaults and no implicit production allowlist.
- Repository audit found ignored `backend/.env`, `frontend/.env.local`, `node_modules`, backend `dist`, frontend `.next`, and `next-env.d.ts`; none are intended for version control. Secret-pattern matches in versionable files were placeholders/examples, not live credentials. No dependency directory, cache, generated build output, or local secret file is part of the intended change set.
- Verification passed: backend no-emit TypeScript, production build, and Prisma validation; frontend no-emit TypeScript, lint with existing warnings, and production build with all 35 routes generated.
- The standard backend `npm test` wrapper remains blocked only in the restricted Windows Codex identity by Node 24 `uv_os_get_passwd` returning `ENOMEM`. Compiling the same suite into an isolated temporary directory and executing it with Node's built-in test runner passed 107 tests with 0 failures and 4 TODO specifications.
- Package-lock metadata was synchronized without installing new dependencies or running package scripts. `npm` reported zero known vulnerabilities for both installed dependency trees during the lockfile-only checks.

---

## 24. Internal nutritionist operations and adaptive meal lifecycle (2026-08-30)

**Architecture decision:** ADR-011 — Accepted

**Change ID:** CHG-20260830-05

### Product boundary

- Nutritionists are authenticated internal NutriMind staff accounts with the `NUTRITIONIST` role. They are not consumer marketplace providers, individually hired consultants, or owners of assigned patient lists.
- Removed the unsupported user nutritionist directory/consultation surface and the nutritionist assigned-patients surface. No replacement assignment endpoint or schema was invented.
- All eligible nutritionists work from one shared pending-review queue. Claim acquisition is source-hardened as an atomic, time-limited compare-and-set operation that is recoverable after expiry and exclusive to one active reviewer; concurrent database integration remains pending.

### Meal lifecycle

1. Plan generation is library-first. The system should compose meals from currently approved library records that deterministically satisfy the user's restrictions, dietary preference, and nutrition tolerances.
2. Gemini is a fallback for uncovered meal slots, not the default source for every request. FNRI matches remain the preferred nutrition evidence for ingredients; unmatched values must stay explicitly estimated.
3. Newly generated AI meals may be visible to the user as `PENDING_REVIEW`/unverified previews, but they must not be described as clinically verified. Existing REQ-002 remains authoritative: non-approved meals do not become actionable grocery, logging, swap, or aggregate inputs.
4. The shared nutritionist queue receives pending meals independently of any one nutritionist's online state. Verified meals can enter the reusable library only through the qualified review lifecycle and evidence requirements recorded by ADR-009.
5. Reuse is based on deterministic compatibility, not an exact whole-profile match. Exact matching would fragment the library and waste safe reusable coverage; conditions, allergens, dietary tags, ingredient evidence, and bounded nutrition targets are evaluated separately.

### User choice and adaptation

- The user-facing library is a compatibility-filtered view of approved meals. It may support bounded swaps without exposing unsafe or incompatible options. Subscription-based limits are a future commercial decision and are not part of the current safety model.
- Weekly check-ins may adapt the next plan, but a single week's scale change is insufficient evidence by itself. Future adaptation must consider adherence, weight trend over multiple observations, goal direction, reported profile changes, and conservative calorie-adjustment bounds with a recorded explanation.
- Body, dietary, condition, and allergy changes remain user-editable because health context changes. They are user-reported updates, not proof that a condition was medically cured. Changes must trigger a safety recheck, preserve history/effective time, and clearly explain any affected meal replacements.
- The current Progress page can link to these controls, but long-term information architecture should separate progress measurement from a dedicated Health & Diet profile surface so safety-critical settings are not mistaken for ordinary chart filters.

### Minimum admin responsibility

The production-readiness admin scope is operational rather than clinical treatment: staff credential activation/expiry, review-queue workload and aging, claim conflicts, safety flags and library lifecycle, AI fallback/quota/reuse metrics, account support, and auditable privileged actions. Admins do not certify nutrition content unless they separately hold the required qualified role.

### Acceptance boundary

ADR-011 resolves the misleading marketplace and assignment UI. Source policy and transaction checks now enforce claim ownership and qualified reviewer eligibility, but concurrent database integration, safe library certification writes, weekly adaptation bounds, clinical correctness, and production deployment remain separate verification or implementation batches.

Source verification passed after the surface alignment: backend no-emit TypeScript and production build; frontend no-emit TypeScript, lint with existing warnings, and production build with all 33 remaining routes generated. No schema, migration, dependency, environment value, database record, or external service was changed.

---

## 25. Pooled nutritionist review hardening (2026-08-30)

**Change ID:** CHG-20260830-06

**Verification IDs:** TEST-046, TEST-047, TEST-048, TEST-049

- Added a pure review policy for severity priority, 30-minute claim activity/expiry, ownership, and `Asia/Manila` license-date eligibility. This corrects the previous zero-priority fallback that could demote `NEEDS_REVIEW` behind safer items.
- Added backend nutritionist-eligibility middleware. Every nutritionist workspace route now requires an existing profile that is admin-verified and whose PRC license date has not expired in the product business timezone.
- The shared queue now includes peer-claimed items for workload visibility while minimizing user identity fields. The frontend disables peer-owned cards and explains the current reviewer's exclusive 30-minute lock.
- Review-card opening acquires or renews a claim with one conditional `updateMany` compare-and-set. A simultaneous reviewer cannot overwrite a live claim; unclaimed and expired claims can be acquired by another eligible staff member.
- Approval and rejection require the caller's live claim at decision time. Their guarded status transition, notification, counter/library writes, edited ingredients, and claim release now execute transactionally at serializable isolation. Replacement generation begins only after a rejection commits.
- Unit verification passed all four new policy cases with zero failures. Backend test-project TypeScript and production build passed. Frontend no-emit TypeScript, lint with existing warnings, and production build passed with all 33 routes generated.
- No schema, migration, dependency, environment value, database record, live review, notification, or Gemini request was changed or executed. Concurrent PostgreSQL integration and reviewer-expiry HTTP tests remain required before deployment acceptance.

---

## 26. Production-readiness foundations (2026-08-30)

**Change ID:** CHG-20260830-06

**Verification IDs:** TEST-050, TEST-051, TEST-052

**Decision IDs:** ADR-012, ADR-013, ADR-014

**Documentation ID:** DOC-027

### Implemented source behavior

- Completed the first-class meal-library safety-evidence design. Library meals now own stable ingredient provenance, explicit reviewed declarations, and append-only review snapshots. User-plan approval creates an `INCOMPLETE` draft only; it never converts one user's conditions or allergies into reusable safety authority.
- Added strict qualified-nutritionist certification for one exact evidence revision. Certification requires an approved, unflagged record, current verified/non-expired reviewer eligibility, every stable ingredient linked to FNRI data, both declaration domains explicitly reviewed, the supported policy version, and a bounded no-known-risk cross-contact acknowledgement. It is a limited technical review statement, not universal or clinical safety certification.
- Material library edits and flags invalidate current certification. Flag dismissal does not revive stale evidence. Library deletion is now archival so ingredients, declarations, reviews, and actor history remain auditable.
- Generation is library-first only when the first-class evidence policy returns `ALLOW`; it never reconstructs authority from mutable historical plan ingredients. Legacy, incomplete, stale, revision-mismatched, unsupported, unlinked, estimated, custom, contradictory, or otherwise review-required rows fall back to one Gemini batch for uncovered slots. Known health conditions remain review-only pending approved RND rules.
- Added exact grocery-shopping day (`0` Sunday through `6` Saturday) while retaining the old group as a compatibility projection. The meal cycle starts the next day; a mid-cycle account receives a clearly bounded starter bridge. A daily scheduler prepares the next cycle three days before grocery day and catches up within the same lead window.
- Added durable per-user/plan-type/cycle generation jobs. The unique cycle key, guarded retry state, and stale-job timeout prevent duplicate Gemini plan creation and make daily scheduling safe to retry. Generation cancels only plans overlapping the new target dates.
- Replaced the old check-in side effect with one durable weekly check-in per cycle, bounded input validation, weight/adherence evidence, an adaptation explanation, and a stored profile snapshot. Trend alone never changes calories. Insufficient data and low adherence remain conservative; adequate-adherence stagnation requests professional review. Explicit body/goal/activity changes may recalculate the existing formula for the next plan.
- Added append-only body/diet, condition, and allergy profile revision snapshots so health-context changes remain traceable. The themed workspace is now split into `/progress` for weight/adherence and `/health-profile` for editable Body & diet and Safety sections, with a dedicated user-sidebar destination and shared form behavior.
- Added privacy-minimized Gemini operations telemetry containing provider/model, outcome, attempt count, latency, stable error code, and timestamp only. Prompts, names, conditions, allergies, and credentials are not stored. Admin overview now surfaces overdue/claimed reviews, reviewer expiry, library evidence readiness, generation failures/stuck jobs, pending upcoming plans, adaptation-review recommendations, and 24-hour Gemini success/failure counts.
- Removed consumer nutritionist-shopping and assigned-patient surfaces. Nutritionists are internal staff operating one pooled review queue. Request bodies for review, library edit/flag/resolution/certification, shopping day, and check-in now use strict allow-listed schemas.

### Decisions

- **ADR-012 — Reuse only current first-class evidence:** automatic reuse requires a current exact certification plus a user-specific deterministic `ALLOW`. FNRI linkage proves nutrition provenance, not allergen absence or medical suitability. Missing knowledge fails closed.
- **ADR-013 — Exact shopping-day cycles with daily idempotent preparation:** one daily scheduler is simpler than per-user cron definitions while still respecting each user's actual shopping day. Durable cycle jobs are the duplication boundary; legacy weekend/weekday endpoints are compatibility wrappers only.
- **ADR-014 — Conservative weekly adaptation:** a check-in records evidence and explains the next action. Weight trend without sufficient observations/adherence never causes an automatic calorie escalation; professional review is preferred when high-adherence progress is unexpectedly stagnant.

### Schema and deployment boundary

- Prepared additive migration `backend/prisma/migrations/20260830110000_add_meal_library_safety_evidence/migration.sql`. It adds first-class library evidence/history, archival status, exact shopping day, generation jobs, weekly check-ins, health-profile revisions, AI-usage events, indexes, checks, and foreign keys.
- After the owner stopped the backend, normal `npx prisma generate` succeeded under Codex. Managed `prisma migrate deploy` still stopped at `Schema engine error`; the owner then ran the same command in a normal Command Prompt and supplied terminal evidence that Prisma found 12 migrations, applied `20260830110000_add_meal_library_safety_evidence`, and reported all migrations successfully applied.
- The migration SQL contains no application-row update, backfill, certification, generation, notification, or external-service call. It adds schema structures and Prisma's migration-history entry; legacy library rows remain conservatively incomplete under their existing lifecycle defaults.
- A managed post-deployment aggregate query was attempted only after owner-reported success, but Prisma Client could not open the Neon TLS connection because the Codex Windows identity has no credential available in the security package. Therefore table-level integration results are not claimed. The database is schema-deployed by owner evidence; authenticated API/browser smoke tests remain the next acceptance gate.

### Verification evidence

- Prisma format/validation passed. Prisma Client type generation succeeded with `--no-engine`; normal engine replacement remains blocked while the owner-controlled backend holds the Windows DLL.
- Backend no-emit TypeScript and production build passed. Backend test-project TypeScript passed.
- The ordinary `tsx` wrapper remained blocked in the restricted Windows Codex identity by Node 24 `uv_os_get_passwd` returning `ENOMEM`. The equivalent full suite was compiled into an isolated ignored workspace and run through `node --test` with a test-only alias resolver: **128 registered, 124 pass, 0 fail, 0 skipped, 4 TODO**.
- TEST-050 covers current evidence eligibility and conservative failures. TEST-051 covers exact-day cycle, starter bridge, and three-day preparation. TEST-052 covers insufficient data, low adherence, review recommendation, and on-track outcomes with zero automatic trend-based calorie adjustment. TEST-046 through TEST-049 continue to cover review priority, claims, expiry, and reviewer eligibility.
- Frontend no-emit TypeScript passed. Lint passed with the existing warnings. The Next.js production build compiled and generated all 34 routes, including `/health-profile`. No authenticated browser, API/database integration, concurrency integration, migration deployment, accessibility audit, load test, or clinical validation was performed.

### Remaining production risks

1. Smoke-test the deployed schema through the owner-run backend: certification, invalidation, library reuse/fallback, check-in idempotency, generation-job contention, and admin metrics against PostgreSQL.
2. Obtain licensed-RND approval for medical compatibility rules, calorie bounds, declaration/cross-contact wording, and the condition-handling policy. Until then known conditions remain review-required.
3. Complete TEST-018/019/020/021: outside-meal confirmation provenance, database uniqueness for meal/daily logs, PostgreSQL claim concurrency integration, and clinically approved calorie bounds. TEST-020's pure claim policy now passes, but its database-concurrency acceptance remains TODO by design.
4. Finish older production hardening: refresh-token rotation/revocation, daily aggregate uniqueness and Manila date migration, persisted user/date water tracking, grocery quantities/units, complete data export, browser E2E/accessibility, and deployment monitoring/alerting.

## 27. Runtime, FNRI, export, and session hardening (2026-08-30)

**Change ID:** CHG-20260830-07

**Verification IDs:** TEST-053 through TEST-057; INT-001; E2E-001

**Documentation ID:** DOC-028

### Implemented source behavior

- Fixed the compiled backend startup blocker without adding a runtime package. The backend build now rewrites TypeScript `@/` aliases in emitted JavaScript, fails if any unresolved alias remains, and `npm start` successfully boots through plain Node.
- Made SMTP startup verification explicit through `SMTP_VERIFY_ON_STARTUP=true`. API startup no longer opens an external SMTP connection by default; actual email delivery remains unchanged.
- Replaced unsafe first-substring FNRI matching and automatic alias creation with a deterministic fail-closed lexical policy. Legacy aliases are accepted only when their target remains a strong lexical match. Processed or specialty collisions such as chicken-flavored puffs, egg crackers, and beef blood are rejected for generic ingredient queries.
- Corrected the FNRI ID-prefix category mapping. The prior seed swapped Meat & Poultry with Fish & Shellfish and shifted dairy, fats, and sweets. The idempotent seed reconciled the configured database from the bundled FNRI dataset. Read-only spot checks now resolve chicken and beef to Meat & Poultry, tilapia to Fish & Shellfish, chicken egg to Eggs, cheese to Milk & Dairy, and butter to Fats & Oils.
- Hardened refresh sessions using the existing `Session` table: refresh cookies now have unique JWT IDs, only hashed refresh tokens are stored, every refresh rotates the persisted token, replay of the old token is rejected, logout revokes sessions, and password reset revokes all existing sessions.
- Reworked the user export so it no longer claims to be an official clinical record or nutritionist-verified document. It compares the report's recorded condition/allergy context with the current profile, excludes stale AI guidance, labels every pending meal as pending review, uses cuisine-neutral plan wording, and prints a bounded non-medical disclaimer.
- Removed all frontend lint warnings through explicit request/history/icon/error types and stable hook dependencies; no lint rules were suppressed.

### Database and runtime evidence

- No new schema migration was required. The already deployed additive migration remained unchanged.
- FNRI reconciliation processed 1,541 source rows with 0 inserts and 1,541 updates. The operation only upserted `FoodItem` values from the repository dataset.
- `npm run test:integration:production` created reserved-domain synthetic records, verified refresh rotation/replay rejection, positive evidence certification, edit invalidation, concurrent weekly-check-in idempotency, and generation-job uniqueness, then removed all synthetic users and meals. Post-run counts for both fixture prefixes were zero.
- The compiled backend passed `/health`, ADMIN authentication, and live FNRI lookups: `chicken -> Chicken, whole`, `egg -> Egg, chicken, whole`, and `beef -> Beef lean meat`, all with the corrected categories and FNRI provenance.
- Authenticated browser smoke testing passed user routes (`/dashboard`, `/meals`, `/grocery`, `/progress`, `/health-profile`, `/profile`, `/export`), nutritionist routes (`/nutritionist/reviews`, `/nutritionist/library`, `/nutritionist/approved`, `/nutritionist/profile`), and administrator routes (`/admin/overview`, `/admin/analytics`, `/admin/users`, `/admin/nutritionists`). The corrected export rendered 21 explicit `PENDING REVIEW` labels and excluded the stale narrative that contradicted the user's current hypertension/dairy profile.

### Verification evidence

- Backend deterministic suite: **133 registered, 129 pass, 0 fail, 4 TODO**.
- Production database integration smoke: **pass**, with synthetic cleanup verified.
- Backend production build and plain-Node startup: **pass**.
- Frontend no-emit TypeScript, lint, and production build: **pass with zero warnings**.
- Authenticated route browser smoke: **pass** for all three roles and the principal portal pages listed above.

### Residual boundaries

- Existing pending plan rows generated before the FNRI matcher correction retain their historical ingredient links. They remain non-actionable and visibly pending nutritionist review; they were not silently rewritten because doing so would alter audit evidence.
- A full live Gemini generation/reuse/fallback cycle was not triggered, avoiding quota consumption and new patient-plan mutations. The deterministic selection/fallback tests and the positive database evidence path pass independently.
- TEST-018 through TEST-021 remain the next implementation targets: exact outside-meal confirmation provenance, database uniqueness for meal/daily logs, full claim-contention acceptance, and clinically approved calorie bounds.
- Grocery quantities/units, persisted water tracking, complete machine-readable user-data export, accessibility/load testing, deployment monitoring, and licensed clinical review remain outside this batch.

## 28. Production workflow completion and operational gates (2026-08-31)

**Change ID:** CHG-20260831-01

**Verification IDs:** TEST-058 through TEST-066; INT-002; LOAD-001; E2E-002

**Documentation IDs:** DOC-029, DOC-030

### Implemented behavior

- Meal plans now carry explicit safety-revalidation state, policy version, high-risk review state, approval count, and first-reviewer evidence. Approved plans are actionable only when current-policy revalidation is complete. Kidney/renal and pregnancy/lactation contexts require two independent RND approvals; the first approval remains pending and the same reviewer cannot provide the second.
- Library browsing, swap previews, swap commits, and profile-change safety rechecks now share the strict first-class library evidence rule. Legacy nullable JSON tags cannot authorize reuse. A candidate must have current complete evidence, a current eligible reviewer, certified revision, FNRI-linked ingredients, reviewed declaration domains, cleared cross-contact assessment, and deterministic compatibility with the current user profile.
- Profile changes reevaluate every remaining active meal. Current compatible certified-library meals remain actionable; other rows become non-actionable before replacement. Certified replacements copy stable ingredients and quantities directly. AI fallbacks remain pending review and high-risk rules are preserved.
- Generation jobs now expose persisted stage codes, stage messages, percentage, and timing. The dashboard polls this source instead of simulating elapsed progress.
- Outside-meal warning confirmation persists and consumes the exact previewed estimate once. Planned-meal logs and daily aggregates have database uniqueness boundaries and idempotent writes.
- Grocery items now aggregate compatible quantities/units, retain an honest unspecified state, show source-meal coverage, preserve checked/pantry state across regeneration, support pantry toggling, and include quantities in the PDF.
- Water intake is stored as bounded append-only daily events. User export now returns a machine-readable JSON package of the user's application data. Permanent deletion requires current-password verification plus an exact confirmation phrase.
- Admin operations now include account suspension/reinstatement with session revocation, audit events, pending safety incidents, operational metrics, and a themed `/admin/operations` workspace. Authentication rechecks the current database account role and suspension state.
- Production config fails closed on missing/placeholder/short secrets, wildcard credentialed CORS, and missing or mismatched clinical-policy approval. Request IDs, structured privacy-conscious HTTP logs, bounded JSON bodies, security headers, `/health`, and database-backed `/ready` are implemented.
- Added `docs/PRODUCTION_OPERATIONS_RUNBOOK.md`, a repeatable load smoke, and `docs/CLINICAL_POLICY_APPROVAL.md`. The runbook covers release checks, backup/restore drills, alerts, scheduler ownership, secret rotation, incident response, and privacy operations.

### Schema and deployment evidence

- Deployed `20260831090000_production_workflow_hardening`, adding plan safety/review fields, library/plan ingredient quantities, grocery quantities/pantry state, generation progress, audit events, exact outside-meal previews, and uniqueness for planned logs and user/date daily aggregates.
- Deployed `20260831120000_account_operations_and_hydration`, adding account-suspension state and bounded persisted water logs.
- `prisma migrate status` reports all 14 repository migrations applied and the database schema up to date.
- Preflight reported zero duplicate planned-meal groups and zero duplicate daily-aggregate groups before the uniqueness migration. The post-migration legacy-plan remediation found zero current/future approved rows needing requeue and changed zero meal rows.

### Verification evidence

- Backend deterministic suite: **139 registered, 138 pass, 0 fail, 1 TODO**. TEST-058 verifies fail-closed legacy approvals; TEST-059 through TEST-061 cover grocery quantities; TEST-062 through TEST-064 cover production configuration; TEST-065/066 cover exact high-risk review escalation.
- Controlled PostgreSQL integration INT-002: **pass**. It verified exact preview persistence and one-time consumption, concurrent planned-log and daily-aggregate idempotency, atomic/expiring RND claims, refresh rotation/replay rejection, evidence certification/invalidation, check-in idempotency, and generation-job contention, then removed all reserved-domain fixtures.
- Backend TypeScript production build, alias rewrite, plain-Node `npm start`, `/health`, and `/ready`: **pass**.
- LOAD-001: 100 local health/readiness requests at concurrency 10 completed with zero failures; measured average 110.3 ms and p95 989 ms against the configured managed database.
- Frontend lint: **pass with zero warnings**. Next.js production build: **pass**, generating all 35 routes including `/admin/operations`.
- E2E-002 browser smoke: the role guard rejected a USER session from `/admin/operations`; the login screen exposed labeled email/password inputs with no console errors; the authenticated user dashboard rendered navigation, persisted hydration controls, pending-review safety messaging, and 18 non-actionable preview meals without console errors.

### Remaining external production boundary

- TEST-021 remains deliberately TODO. NutriMind cannot honestly declare calorie bounds, medical compatibility rules, condition-specific thresholds, or adaptation wording clinically approved without a qualified reviewer. Production startup now enforces this boundary through `CLINICAL_POLICY_APPROVED_VERSION=NUTRIMIND_CLINICAL_DRAFT_V1`; the value must be set only after the approval record is completed. Code, database, workflow, build, integration, and local operations checks pass, but clinical sign-off and production hosting/provider configuration remain external actions.

## 29. Online nutritionist application and controlled activation (2026-09-02)

**Requirement ID:** REQ-013

**Decision ID:** ADR-015

**Change ID:** CHG-20260902-01

**Verification IDs:** TEST-067 through TEST-070; INT-003; E2E-003

### Requirement and decision

- Registered nutritionist-dietitians may apply online from anywhere in the Philippines. Physical proximity to the NutriMind office is not an eligibility boundary.
- Applying never grants the `NUTRITIONIST` role. The required lifecycle is `SUBMITTED -> UNDER_REVIEW -> CALL_REQUIRED -> CALL_SCHEDULED -> APPROVED -> ACTIVATED`, with `REJECTED` as a recorded terminal decision.
- A one-on-one online verification call is mandatory. Admin approval is rejected until a scheduled call exists and its scheduled time has passed.
- The administrator does not choose or receive the applicant's password. Approval creates a non-active professional account and sends a private 72-hour invitation; the applicant activates it by choosing their own password.
- ADR-015 accepts an online application plus manual PRC review and required video call as the capstone-sized governance model. Video transport remains an external Google Meet/Zoom link rather than an embedded conferencing subsystem.

### Implemented behavior

- Added a themed five-step `/nutritionist-apply` experience covering identity/contact, PRC credential data, professional background, multiple call-availability options, declaration, review, submission, and private reference-plus-email status tracking.
- Added a landing-page `For nutritionists` destination with separate apply and tracking actions. The workflow explicitly states that submission does not grant access or guarantee employment.
- Added an admin application pipeline within `/admin/nutritionists`: credential review, advancement to required call, selection/override of an applicant-proposed schedule, external meeting link, post-call approval, reason-required rejection, invitation-delivery status, invitation resend, completed applications, and active professionals.
- Added `/nutritionist-invitation` so an approved applicant creates their own policy-compliant password. Activation marks email ownership verified and consumes the invitation token.
- Application payloads use strict Zod allow lists and bounded fields. Duplicate application email, PRC license, existing user email, and existing professional license boundaries are rejected. Public status lookup returns only applicant-facing state; private contact/background/admin data remain in the protected admin API.
- Approval and activation are transactional and emit audit events. Invitation tokens are random, stored only as SHA-256 hashes, expire after 72 hours, and are rotated on resend. SMTP delivery failure does not falsely mark an invitation as sent.
- Added expected theme-class hydration suppression on the root element because the pre-hydration theme script intentionally changes that class from stored browser preference.

### Schema and deployment evidence

- Deployed additive migration `20260902090000_add_nutritionist_applications`. It adds the application status enum, application table, uniqueness/index boundaries, and reviewer/invitee relations; it does not rewrite existing users, nutritionist profiles, meals, or clinical data.
- `prisma generate`, backend production build, frontend lint, and frontend production build pass. The frontend build generates 37 routes, including the application and invitation pages.
- The deterministic backend suite registers 144 tests: **143 pass, 0 fail, 1 pre-existing clinical TODO**. TEST-067 through TEST-070 cover complete input normalization, expired-license/availability/unknown-field rejection, default-deny admin transition inputs and meeting URL policy, and decision/invitation-password validation.
- INT-003 submitted and retrieved one reserved-domain synthetic application through the live API, confirmed unauthenticated admin listing returns `401`, and then removed the exact synthetic application. No professional account, email, or meeting was created.
- E2E-003 rendered the public multi-step application in the browser with correct labeled controls and themed responsive layout. A non-admin authenticated session was redirected from the admin application screen to `/unauthorized`, confirming the role guard. An admin decision, external meeting, SMTP invitation, and applicant activation were not browser-executed in this change set.

### Remaining boundaries

- Production operation still requires a real administrator to independently verify PRC credentials, conduct the call, record an honest decision, and configure a trusted meeting provider and SMTP sender.
- Credential-document upload is intentionally excluded from this capstone-sized workflow. Adding it later requires encrypted object storage, malware scanning, retention/deletion policy, access logging, and a privacy review.
- The application/reference lookup is protected by a high-entropy reference plus matching email and a dedicated status-attempt limiter; submissions also have a stricter hourly limiter. Applicant email notifications for submission/call scheduling remain recommended before public internet deployment.

## 30. FNRI-backed common meal catalogue and public verifier details (2026-09-02)

**Requirement ID:** REQ-014

**Change ID:** CHG-20260902-02

**Verification ID:** TEST-071; INT-004

### Implemented behavior

- Added an idempotent common-meal catalogue containing 30 distinct recipes: 10 breakfasts, 10 lunches, and 10 dinners. The set intentionally mixes familiar Filipino plates with ordinary broadly eaten options such as scrambled eggs, oatmeal, sandwiches, canned tuna/sardines, rice bowls, potatoes, corn, fruit, tofu, chicken, beef, pork, and fish.
- Every ingredient resolves by exact name to one of 32 existing FNRI `FoodItem` records. Stored portions use grams, and calories/protein/carbohydrates/fat are calculated from the linked FNRI values rather than handwritten independently.
- Every inserted meal owns ordered first-class ingredients, explicit quantities and units, dietary-preference tags, all four supported goal tags, reviewed condition/allergen domains, an explicit cross-contact assessment, a draft evidence event, and a certified current-revision evidence event.
- Catalogue meals declare no condition-specific suitability. They are intended for profiles with no recorded health condition; the existing compatibility evaluator continues to deny reuse when a condition or unknown custom restriction requires review.
- The existing nutritionist account now has a complete fictional capstone profile (`Andrea Reyes, RND`) with a project-scoped PRC-style identifier, validity date, specialization, experience, education, and public professional bio. Seeded meals are attributed to this account through the normal verifier and safety-review relations.
- User library and swap API responses expose a bounded public verifier object: name, PRC identifier/validity, specialization, experience, university, and bio. Email, internal IDs, admin-verification metadata, and private account data are not exposed. The user library verifier badge is now a keyboard-accessible button that opens a themed professional-details dialog.
- Added `npm run seed:test-accounts`, plus `npm run seed:meal-library` as a read-only validation/dry run and `npm run seed:meal-library -- --apply` as the explicit additive population command. Existing non-catalogue rows with the same name are never overwritten; current catalogue rows are skipped idempotently.
- Prisma certification transactions now use a bounded 10-second acquisition wait and 15-second execution timeout so the serializable multi-query evidence workflow can complete against the managed database without weakening its isolation level.
- The backend test command now discovers every `tests/*.test.ts` suite instead of maintaining an incomplete hand-written list.

### Verification evidence

- TEST-071 validates catalogue uniqueness/completeness, exactly 10 meals per main slot, known ingredient-to-allergen declarations, omnivore availability, and all supported goal tags.
- The full deterministic backend suite registers 246 tests: **245 pass, 0 fail, 1 pre-existing clinical-policy TODO**.
- Backend and frontend production builds pass. The frontend build generates all 37 current routes.
- INT-004 resolved all 32 required exact FNRI names, populated the configured database, and then re-ran idempotently. The post-write evidence evaluator confirmed **30/30 current certified catalogue meals** with eligible reviewer evidence, linked FNRI ingredients, reviewed declarations, matching revisions, supported policy version, and no pending flags.
- The nutritionist profile's derived `totalVerified` was reconciled to **34**, retaining four existing verified-library records plus the 30 common catalogue meals.

### Scope boundary

- The catalogue is baseline reusable content, not a replacement for per-user restriction checks. A meal is still filtered on every selection and swap. Health-condition suitability remains deliberately undeclared, and custom/unsupported restrictions continue to fail closed into review or generation rather than inheriting a general-meal certification.

## 31. Verified-library fresh-user acceptance and derived grocery projection (2026-09-03)

**Requirement ID:** REQ-015

**Change ID:** CHG-20260903-01

**Verification IDs:** INT-005; E2E-004

### Implemented behavior

- Successful plan creation now automatically derives the user's grocery checklist whenever the result contains actionable meals. Users no longer need to run a second generation action for data already present in the plan.
- Current-plan and meal-detail responses expose the same bounded public verifier object as the library. Dashboard cards, the weekly-plan workspace, and the standalone meal-detail route provide a keyboard-accessible verifier control and themed professional-details dialog without exposing email, internal identifiers, or admin-only data.
- Swap options exclude the current meal and every library meal already assigned elsewhere in the same plan. The swap transaction independently enforces the same no-duplicate rule, so a stale or crafted client cannot bypass it.
- Health-profile selection removes the legacy `NONE` sentinel when a real condition/allergy or custom value is entered and restores it only when no restriction remains. Identical safety submissions are idempotent and do not invalidate the nutrition report or re-run plan safety work.
- A real safety change redirects to the required updated report. Remaining meals are re-evaluated, incompatible meals are replaced only from current certified evidence, and replacement selection avoids repeating a meal within three scheduled days.

### Controlled acceptance evidence

- INT-005 created one exact reserved-domain user fixture, generated a full 21-slot weekly plan, performed one user swap, recorded one eaten meal, added an egg allergy, acknowledged the refreshed report, and inspected the resulting database state. The plan contained seven breakfasts, seven lunches, and seven dinners; every slot was approved, library-backed, ingredient-backed, and attributed to Andrea Reyes, RND.
- The initial unrestricted plan used 21 distinct library meals. After the egg-allergy safety pass, zero egg-declared meals remained. The constrained result used 20 distinct meals because only six certified egg-free breakfasts exist; the unavoidable repeat remained at least three scheduled days apart.
- The grocery projection existed automatically and contained 29 aggregated items after the swap and safety replacement. The AI-usage count was unchanged from the pre-generation snapshot, proving the fully matched plan did not call Gemini.
- Weekly check-in status was not due for the first-week user. Admin analytics included the active plan and the completed meal log. Eligible swap results contained neither the current library meal nor a meal already used elsewhere in the plan.
- E2E-004 signed in through the actual browser UI, rendered the dashboard and standalone meal-detail route, displayed `Verified by Andrea Reyes, RND`, and opened the bounded PRC validity, specialization, experience, education, and biography dialog. No browser errors were recorded on that path.

### Verification and cleanup

- `npm test`: **246 registered, 245 pass, 0 fail, 1 pre-existing clinical-policy TODO**.
- Backend production build: pass. Frontend lint: pass with zero warnings. Frontend production build: pass with all 37 routes generated.
- `backend/scripts/library-reuse-acceptance.ts` owns setup, verification, report-alignment, and exact cleanup modes. Cleanup restores the catalogue usage counters captured before the run and deletes only the named fixture and its snapshot event.

### Remaining external boundary

- This acceptance proves implemented software behavior against the configured database and local browser. It does not replace licensed clinical approval, production provider configuration, or deployment monitoring. The clinical calorie-bound approval TODO remains intentionally open.

## 32. Condition-aware library coverage and nutritionist readiness monitor (2026-09-03)

**Requirement ID:** REQ-016

**Change ID:** CHG-20260903-02

**Verification IDs:** TEST-072; INT-006; E2E-005

### Implemented behavior

- Expanded the managed FNRI-backed catalogue from 30 to 43 meals: 13 breakfasts, 15 lunches, and 15 dinners. The 13 additions use exact existing FNRI food records and close seven-day slot-coverage gaps for vegetarian, pescatarian, and supported single-allergen profiles.
- Catalogue condition tags are now derived from measured meal data rather than assigned by name. A catalogue meal may declare diabetes suitability only at or below 60 g carbohydrate per meal and hypertension suitability only at or below 600 mg sodium per meal.
- Reuse for a matching diabetes or hypertension profile requires a current certification, complete linked FNRI evidence, an exact positive condition declaration, and an explicit reviewed-condition-rules marker. Missing, stale, incomplete, or contradictory evidence continues to require review.
- Kidney disease, heart conditions, pregnancy/lactation, and custom conditions remain individually review-gated even when a meal has a matching text declaration. They are not authorized by the catalogue's bounded diabetes/hypertension rules.
- Added a protected nutritionist coverage endpoint and a themed `Seven-day library readiness` monitor to the meal-library page. It reports breakfast/lunch/dinner compatibility counts and marks a profile week-ready only when every main slot has at least seven independently eligible meals.
- Versioned catalogue signatures make re-seeding deterministic. Existing managed V1 rows are upgraded to the exact V2 definition, their stale certification is invalidated, and new evidence is certified at the current revision. A second run performs no writes.

### Verification evidence

- TEST-072 verifies 43 unique definitions, 13/15/15 slot distribution, at least seven compatible choices per slot for vegetarian, pescatarian, and every supported single-allergen profile, and deterministic diabetes/hypertension threshold derivation.
- The full deterministic backend suite registers 250 tests: **249 pass, 0 fail, 1 pre-existing clinical-policy TODO**. Backend and frontend production builds pass; frontend lint passes with zero warnings and all 37 routes are generated.
- INT-006 populated 13 new catalogue rows and upgraded/certified all 43 managed rows. An immediate second apply reported **0 created, 0 certified, 43 already current**, establishing database idempotence.
- Live compatibility acceptance through the production services returned breakfast/lunch/dinner counts of **11/11/8** for diabetes, **12/15/15** for hypertension, **7/7/7** for vegetarian, **9/11/11** for pescatarian, and **9/14/14** for egg-free. A kidney-disease fixture returned **0/0/0**, confirming the unsupported high-risk path remains fail-closed. All exact reserved-domain fixtures were removed after the run.
- E2E-005 signed in through the real browser UI as the nutritionist test actor, opened the meal-library page, and observed 47 total database records plus all five week-ready coverage cards with counts matching INT-006. The page finished loading without browser console errors.

### Scope boundary

- The carbohydrate and sodium limits are conservative project rules used to make catalogue evidence measurable and testable; they are not a claim of licensed clinical approval. The existing clinical-policy approval TODO remains open, and deployment must not present the software as independently clinically certified until that external review is recorded.
