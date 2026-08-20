# NutriMind Repository Cleanup and Architecture Stabilization Prompt

Version: 1.0  
Prepared: August 19, 2026

Use this after giving the coding agent `NUTRIMIND_AGENT_MASTER_PROMPT.md`. The master prompt remains in force.

---

## TASK

Clean, stabilize, and organize the existing NutriMind repository without performing a big-bang rewrite and without destroying working or uncommitted owner changes.

The codebase contains contradictory documentation, partially implemented workflows, stale endpoints, inconsistent layering, missing tests, schema weaknesses, generated-file noise, and safety/security defects. The goal is not merely to make the folder tree look cleaner. The goal is to establish one truthful architecture, protect current behavior with tests, fix the most dangerous inconsistencies, and leave the project easier to understand, maintain, test, and document.

This is a multi-phase cleanup campaign. Do not attempt every phase in one uncontrolled change set.

---

## FIXED BASELINE DIRECTION

Unless the owner explicitly approves a migration, preserve this current architecture:

- `nutrimind-frontend`: Next.js 14 App Router frontend
- `nutrimind-backend`: Express/TypeScript REST API
- Prisma/PostgreSQL database
- Current custom JWT access/refresh authentication model, hardened in place
- Axios as the frontend API boundary
- FNRI/database-first food data with clearly labelled AI estimates
- Three roles: `USER`, `NUTRITIONIST`, and `ADMIN`

Do not migrate to NextAuth, merge the backend into Next.js, replace Prisma, change database engines, or rewrite the frontend framework as part of cleanup.

---

## FIRST-RUN SAFETY GATE

On the first run of this prompt:

1. Perform Phases 0 and 1 only.
2. Do not modify application code, schema, migrations, package manifests, generated files, or configuration.
3. You may create or update only the owner-approved living engineering record and a proposed cleanup plan if documentation writes are authorized.
4. Give the mandatory report and wait for the owner to approve the proposed architecture decisions and cleanup batches.

After approval, implement one bounded cleanup batch at a time. Each batch must have its own acceptance criteria, tests, engineering record entry, and report.

---

## PROHIBITED CLEANUP BEHAVIOR

Do not:

- Rewrite the entire application from scratch.
- Treat older fresh-start prompts as permission to replace the current repository.
- Run destructive Git reset/clean/checkout operations.
- Delete or overwrite unknown modified/untracked files.
- Rename large numbers of files for style alone.
- combine unrelated defect fixes into one enormous commit-sized change.
- Change public route names or response shapes without mapping every caller and providing a compatibility plan.
- Drop tables, columns, enums, or data without an approved migration and recovery plan.
- Add uniqueness constraints before checking and resolving existing duplicates safely.
- “Clean” the project by silencing lint/type errors with `any`, ignores, broad catches, or disabled rules.
- Move business rules into the frontend.
- replace deterministic safety rules with Gemini prompts.
- Mark missing features complete or delete them without a product decision.
- Update documentation to match desired behavior while leaving contradictory code unchanged, or vice versa.

---

## PHASE 0 — PRESERVE AND MEASURE THE BASELINE

Before editing:

1. Read all applicable repository instruction files.
2. Capture `git status`, current branch, recent commit context, modified files, and untracked files without changing them.
3. Inventory the top-level tree, frontend, backend, Prisma schema/migrations, documentation, scripts, tests, generated output, environment examples, and deployment-related files.
4. Identify which files appear owner-authored, generated, stale, duplicated, or uncertain. Do not delete uncertain files.
5. Run non-destructive baseline checks that do not rewrite output:
   - backend TypeScript no-emit check
   - frontend TypeScript no-emit check
   - Prisma schema validation
   - lint without auto-fix
   - existing tests, if any
6. Record exact commands and outcomes.
7. Do not run formatters, generators, builds, migrations, seeds, or package upgrades during this baseline unless explicitly authorized.

Deliverable: a baseline table containing check, command, result, warnings, and whether the check is runtime, static, mocked, or not performed.

---

## PHASE 1 — BUILD A TRUTHFUL SYSTEM MAP AND DECISION REGISTER

Produce a repository-backed map of:

- Packages and their responsibilities
- Frontend route groups, layouts, guards, pages, hooks, and API calls
- Backend routes, middleware, controllers, services, and direct Prisma access
- Database models, enums, relationships, constraints, and indexes
- Auth token lifecycle and prerequisite gates
- Meal generation, FNRI resolution, review, approval, rejection, swap, logging, grocery, progress, notification, and cron state flows
- External services and required environment variables
- Missing endpoints and stale callers
- Tests and untested critical paths
- Generated artifacts currently tracked
- Documentation claims that conflict with code

Create a contradiction register. For every contradiction, include:

- ID
- Sources in conflict
- Current repository behavior
- Intended behavior if known
- User/security/clinical/data impact
- Recommended resolution
- Alternatives and tradeoffs
- Whether owner approval is required

At minimum, explicitly address:

1. NextAuth/full-stack Next.js vision versus Express/custom JWT implementation.
2. Five-model versus four-model or currently configured Gemini fallback lists.
3. “Fresh start” prompts versus the existing dirty working tree.
4. Documentation claiming completion versus missing/stale endpoints and absent runtime tests.
5. Assigned-patient/nutritionist pages versus the reportedly removed assignment model.
6. PWA claims versus manifest-only or incomplete offline support.
7. Clinical/nutritionist approval claims versus current active-plan filters.
8. Schema models such as Account, Session, or AssignmentStatus versus active implementation use.

Recommend one target architecture and one truthful feature-status vocabulary:

- Planned
- Designed
- Partially implemented
- Implemented but unverified
- Statically verified
- Integration tested
- End-to-end tested
- Deployed
- Clinically reviewed

Do not use “complete” without specifying the applicable verification level.

Deliverable: proposed `ADR`, `DEF`, `RISK`, and `UNC` entries plus a cleanup batch plan. Wait for approval before application-code changes.

---

## PHASE 2 — DOCUMENTATION AND REPOSITORY HYGIENE

After approval, make the repository describe reality.

1. Establish or update `docs/NUTRIMIND_ENGINEERING_RECORD.md`.
2. Choose one canonical system overview and clearly label older prompts/specifications as historical, superseded, or aspirational without deleting them unless approved.
3. Correct completion claims in `AGENTS.md`, README files, system references, and update logs only where evidence supports the correction.
4. Document the frontend/backend local setup and every required environment-variable name without secret values.
5. Document exact static checks, test commands, migration commands, seed behavior, and known external-service dependencies.
6. Propose `.gitignore` corrections for generated output such as backend `dist` and frontend `.next`.
7. Before untracking generated files, verify that deployment does not require them and obtain approval for repository-index changes.
8. Identify duplicate or obsolete documents. Prefer a deprecation note and link to the canonical document before deletion.
9. Establish consistent naming only where renames are low-risk and valuable. Update imports, scripts, docs, and tests atomically.

Acceptance criteria:

- A new contributor can identify the actual architecture and start each package.
- Documentation distinguishes current, planned, missing, and uncertain features.
- Required environment keys are listed with descriptions and safe examples.
- No secret values appear.
- No working source file is deleted for cosmetic reasons.

---

## PHASE 3 — CREATE THE TEST SAFETY NET AND CI BASELINE

Before major refactoring, protect the most important rules.

1. Identify the existing test framework or propose the smallest compatible setup.
2. Add deterministic unit tests for:
   - BMR/TDEE and target bounds
   - restriction/allergy evaluation, including custom entries
   - plan status/actionability rules
   - FNRI matching decision behavior
   - date windows and Asia/Manila boundaries
   - plan repetition/selection rules
3. Add API integration tests for:
   - auth and refresh lifecycle
   - role/ownership/prerequisite gates
   - nutritionist claim and approval/rejection state transitions
   - meal logging uniqueness and allowed statuses
   - outside-meal preview/confirmation identity
   - daily aggregation/check-in/cron idempotency
4. Create minimal fixtures for `USER`, verified/unverified `NUTRITIONIST`, and `ADMIN`, plus clinically important profile variants.
5. Add CI only after the commands pass locally or in the available controlled environment.
6. CI should include dependency installation, Prisma validation, TypeScript, lint, tests, and build where appropriate.

Do not build a large testing platform before the first critical regression tests exist.

Acceptance criteria:

- Critical state and safety rules have automated regression coverage.
- Test data is isolated and contains no real personal data.
- CI failure messages identify the failing layer.
- The engineering record links each `TEST-###` to requirements/defects/risks.

---

## PHASE 4 — FIX CRITICAL SAFETY AND AUTHORIZATION CONTRADICTIONS

Implement as separate bounded batches, not one monolithic change.

Priority order:

1. Exclude pending, rejected, cancelled, expired, and other non-approved plan rows from user-actionable meals, logs, groceries, totals, and current-plan results.
2. Centralize deterministic health/allergy restriction evaluation using schema-aligned enum and custom values.
3. Treat unknown/null safety metadata conservatively.
4. Enforce email verification, onboarding, terms acceptance, report acknowledgement, role, ownership, nutritionist verification, and license validity at backend policy boundaries.
5. Replace mass assignment with endpoint-specific validated DTOs/field allow-lists.
6. Redact sensitive model/profile data from logs and apply rate limits to Gemini and sensitive auth endpoints.

For each batch:

- Write failing regression tests first when practical.
- Define one canonical policy function/service instead of duplicating checks.
- Update every caller and response type.
- Verify direct API calls, not only frontend navigation.
- Record clinical/security impact.

---

## PHASE 5 — REPAIR TRANSACTIONS, CONCURRENCY, AND IDEMPOTENCY

Address the following with schema-aware designs and tests:

- Atomic conditional nutritionist claims with expiry and owner enforcement
- Transactional approval/rejection/replacement/library/notification state changes
- Explicit behavior when replacement generation fails
- Same-plan duplicate meal-log prevention
- User/date daily-aggregate uniqueness
- Check-in due-date enforcement and idempotency
- Health/allergy updates that validate the complete new profile state once
- Grocery regeneration that preserves user checklist progress where valid
- Job-run or idempotency protection for cron operations
- Refresh-session rotation and revocation design

Before adding database uniqueness constraints:

1. Query for existing duplicates.
2. Report counts and affected keys without exposing personal data.
3. Propose deterministic deduplication rules.
4. Back up or preserve recoverability.
5. Apply data cleanup and constraints in a reviewed migration.
6. Test upgrade and rollback/forward-recovery behavior.

Never resolve duplicates by arbitrary deletion.

---

## PHASE 6 — NORMALIZE SERVICE, API, AND TYPE BOUNDARIES

Only refactor after tests protect behavior.

Target structure:

`route -> validation/auth policy -> controller -> domain service -> repository/Prisma or external adapter`

Rules:

- Routes declare middleware and delegate.
- Controllers translate HTTP input/output and do not own domain algorithms.
- Services own business transactions and state rules.
- Prisma access is centralized enough to protect invariants; avoid needless abstraction for trivial reads.
- External Gemini, FNRI, email, PDF, and time behavior uses explicit adapters/interfaces where testing benefits.
- Shared enums/contracts are derived or synchronized rather than manually drifting.
- Error responses follow one documented shape and status-code policy.
- Do not create “utils” dumping grounds or circular dependencies.

Refactor one domain slice at a time, for example:

1. Auth/session policies
2. Plan actionability/retrieval
3. Restriction engine
4. Nutritionist review workflow
5. Meal logging and aggregates
6. Grocery generation
7. Scheduling/check-ins

After each slice, run regression tests and report behavior equivalence plus intentional changes.

---

## PHASE 7 — SCHEMA, MEAL LIBRARY, AND GROCERY REDESIGN

Treat this as a design and migration project, not simple cleanup.

Evaluate and propose:

- First-class normalized library-meal ingredients
- Ingredient amount, unit, serving, and preparation metadata
- FoodItem/FoodAlias uniqueness and safe fuzzy-match review behavior
- Composite uniqueness for user conditions, allergies, daily aggregates, planned logs, and OAuth provider identity where applicable
- Indexes for user/date histories, review queues, claims, plan groups, notifications, and cron eligibility
- Removal, adoption, or deprecation of unused Account/Session/assignment-related models
- Correct handling of legacy mapped table names such as `Allgy`

For each schema change include:

- Current data model
- Target model
- Rationale
- Backfill strategy
- Duplicate/null handling
- Migration order
- Application compatibility window
- Rollback or forward-recovery plan
- Tests

Do not perform this phase without owner approval of the data design.

---

## PHASE 8 — RESOLVE STALE OR MISSING PRODUCT WORKFLOWS

For each item, recommend `implement`, `reframe`, `hide`, or `remove`, with scope and documentation impact:

- User nutritionist directory endpoint
- Consultation request/booking/messaging lifecycle
- Nutritionist patients page and care relationship model
- Nutritionist application/profile creation
- Direct meal-library creation
- Admin account controls and audit logs
- Real user-data export
- User/date-persisted water tracking
- Complete PWA/offline behavior
- Production scheduler/deployment/monitoring

Do not silently create a large consultation or patient-management subsystem under the label of cleanup.

---

## PHASE 9 — FINAL ORGANIZATION AND PRODUCTION-READINESS REVIEW

After earlier phases:

1. Re-run the full static, test, build, and allowed E2E suite.
2. Check for dead code using both static search and runtime/test evidence.
3. Remove code only when no supported behavior depends on it and the owner approves meaningful deletions.
4. Reconcile frontend/backend route and type inventories.
5. Reconcile Prisma schema and migrations.
6. Reconcile implementation status in documentation.
7. Produce a remaining-risk register.
8. Produce a release-readiness checklist covering migrations, backups, secrets, CORS, OAuth, SMTP, Gemini models, scheduler, logging, monitoring, privacy, accessibility, performance, and clinical review.

“Repository cleanup complete” means the system has a truthful architecture, consistent boundaries, protected invariants, traceable documentation, and a manageable remaining-risk list. It does not mean every future feature has been implemented.

---

## REQUIRED OUTPUT AFTER PHASES 0 AND 1

Return:

1. Baseline verification table
2. Current architecture map
3. Dirty-working-tree preservation notes
4. Contradiction register
5. Proposed architecture decisions
6. Feature truth-status table
7. Ranked defect/risk register
8. Proposed cleanup batches, each containing:
   - objective
   - files/domains affected
   - dependencies
   - risk level
   - migrations if any
   - tests required
   - rollback strategy
   - documentation IDs
9. Decisions needed from the owner
10. Recommended first implementation batch

End with the mandatory NutriMind task report from the master prompt. Do not modify application code during the first run.

---

## REQUIRED OUTPUT AFTER EVERY APPROVED CLEANUP BATCH

Return:

1. Approved batch and acceptance criteria
2. Before/after behavior
3. Files and schema objects changed
4. Tests added or updated
5. Exact verification results
6. Engineering record IDs
7. Remaining risks and known limitations
8. Whether the batch is safe to proceed from
9. The next smallest recommended batch
10. Mandatory NutriMind task report

