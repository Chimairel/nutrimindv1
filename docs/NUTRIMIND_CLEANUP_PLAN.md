# NutriMind Proposed Cleanup Plan

Status: Cleanup through Batch 4B4R, Stabilization Checkpoint S1, and the authorized S1A commit-boundary execution is recorded by August 20, 2026; final post-commit regression determines `GO` for unrelated feature development; no new feature batch or Batch 4B5 is authorized
Prepared: August 19, 2026
Governing guides: `codex/NUTRIMIND_AGENT_MASTER_PROMPT.md` and `codex/NUTRIMIND_REPOSITORY_CLEANUP_PROMPT.md`

## 1. Accepted direction

ADR-001 through ADR-007 were accepted by the owner on August 19, 2026. Preserve and harden the current architecture:

- Next.js 14 App Router frontend
- Express/TypeScript REST API
- Prisma/PostgreSQL database
- Custom JWT access/refresh authentication, hardened in place
- Axios frontend API boundary
- FNRI/database-first nutrition values with clearly labelled AI estimates
- `USER`, `NUTRITIONIST`, and `ADMIN` roles

No framework, ORM, database, or auth-system migration is included. Batches 1, 2A, and the actionability-only Batch 3 are complete. Batch 3B-3D established the documented runtime boundary. Batch 4A designed restriction behavior, Batch 4B1 implemented the pure policy, Batch 4B2 integrated it only at meal-generation library candidate selection, and Batch 4B3 designed the missing authoritative library evidence contract without implementation. Other restriction callers remain fragmented and no medical rule is approved. Full browser interaction, a live positive approved-current USER path, stored-grocery provenance, and broader restriction integration remain uncertified. Every later implementation batch remains a proposal until separately reviewed and approved.

## 2. Ranked execution batches

### Batch 1 - Canonical documentation and repository hygiene (Completed)

- Objective: make contributor-facing documentation describe the executable architecture and safe commands truthfully.
- Domains/files: engineering record, canonical overview/README, environment example, setup/testing guide, documentation status notices, `.gitignore` proposal.
- Approval/completion date: August 19, 2026.
- Dependencies satisfied: ADR-001 through ADR-005 accepted; legacy documents classified non-destructively.
- Risk: Low.
- Migrations: None.
- Required verification: manual link/command review; backend/frontend TypeScript, Prisma validation, lint.
- Rollback: revert only Batch 1 documentation changes; do not touch owner source changes.
- IDs: REQ-001, REQ-007, ADR-001-003, DEF-001-007, RISK-010, DOC-001/002.
- Special rule: do not untrack `dist` until deployment requirements and repository-index changes are separately approved.

Acceptance criteria and outcome:

1. Met: root `README.md` states the current two-package architecture.
2. Met: current documentation uses the approved truth vocabulary; retained historical claims are explicitly qualified.
3. Met: setup, verification commands, and all code/config-observed environment names are documented without values.
4. Met: legacy/aspirational documents received non-destructive notices and links; none were deleted.
5. Met: no application behavior, schema, package, configuration, migration, environment, or generated files were changed by Batch 1.

### Batch 2A - Minimal backend test harness and passing baseline (Completed)

- Objective: add the smallest compatible backend test harness and deterministic fixtures before safety refactoring.
- Domains/files: backend test script, test-only TypeScript config, isolated unit tests, synthetic fixtures, executable TODO specifications, and documentation. CI was not authorized.
- Approval/completion date: August 19, 2026.
- Dependencies satisfied: Batch 1 status conventions and owner-authorized Batch 2A scope.
- Runner decision: Node's built-in `node:test` through existing `tsx`; no dependency added. See ADR-006.
- Risk: Low; production behavior unchanged.
- Migrations: None; tests must not use production-like data.
- Implemented active tests: formula/activity/goal calculations and synthetic-fixture integrity.
- Executable TODO specifications: actionability/exclusion, restrictions/unknown metadata, Asia/Manila boundaries, outside-meal preview identity, log idempotency, claim concurrency, and approved calorie bounds.
- Rollback: remove only the test script and new test/config/documentation files; production code remains unchanged.
- IDs: REQ-002/003/005/006/008/009, ADR-004/005/006, RISK-001/002/004/006/009/011/014, TEST-010 through TEST-021.

Acceptance criteria and outcome:

1. Met: `npm test` runs deterministically with 22 registered tests: 13 pass, 0 fail, 0 skipped, and 9 TODO.
2. Met: synthetic fixtures cover `USER`, verified/unverified `NUTRITIONIST`, `ADMIN`, enum/custom/no restrictions, and approved/pending/rejected/cancelled/expired plan states using reserved `.invalid` identities and `fixture-*` IDs.
3. Met within authorized scope: known unsafe behavior is represented by executable TODO specifications and is not encoded as passing behavior. Activating those specifications requires separately approved production policy seams/fixes; calorie bounds also require clinical criteria.
4. Met: backend/frontend TypeScript, Prisma validation, and frontend lint remain stable; lint passes with baseline warnings.
5. Met: no live database, Gemini, OAuth, SMTP, DiceBear, external HTTP, or application server was used; no real environment was required.
6. Met: no production source, frontend source, schema, migration, route, controller, service, deployment, CI, or generated-output change was made.

### Batch 2B - Activate critical backend policy tests (Superseded by completed Batch 3)

- Outcome: not executed as a separate batch. Batch 3 supplied the actionability policy seam and activated TEST-013/014 within the approved behavior-change scope. Other TODO tests remain assigned to their respective later batches.
- Original objective: introduce only the smallest separately approved, behavior-neutral policy seams or isolated adapters needed to turn critical TODOs into active regression tests around subsequent fixes.
- Dependencies: owner approval of exact actionability/state rules and the allowed production-code testability seam; RND approval is additionally required before TEST-021 can be activated.
- Risk: Medium; touching production modules, even without intended behavior change, requires focused contract review.
- Migrations: None expected.
- Required verification: active state-matrix/policy tests, both TypeScript checks, Prisma validation, frontend lint, and focused production diff review.
- Rollback: revert only the approved seam and its tests together.
- IDs: REQ-002/003/005/006/008/009, DEF-008/009/013/014/015/018/019, RISK-001/002/004/006/009/011/014.

### Batch 3 - Approved-meal actionability boundary (Completed)

- Objective: ensure only approved/actionable plan rows are returned, logged, totaled, swapped, or included in groceries.
- Domains/files: meal controller/service boundary, grocery service, meal logging, swap eligibility, frontend contracts/types as required.
- Approval/completion date: August 19, 2026.
- Dependencies satisfied: Batch 2A specifications and owner-approved status/actionability direction.
- Risk: Critical; `CLINICAL-SAFETY-IMPACTING`.
- Migrations: Prefer none in this batch.
- Required tests: state matrix for current/detail/status/grocery/totals/swap; ownership/direct API tests; rejected-original/replacement group regression.
- Rollback: revert centralized policy and callers as one batch; retain tests to demonstrate regression.
- IDs: REQ-002, DEF-008, DEF-014, RISK-001.

Acceptance criteria and outcome:

1. Met in source/unit scope: only `APPROVED` and schedule-current rows are user-actionable; unknown/null/invalid states deny.
2. Met: selected current group and every returned group row use the same policy-derived database filter and pure re-filter.
3. Met: planned status, swap options, preview, and execution re-check owned targets; owned ineligible actions map to `409`.
4. Met in source/unit scope: grocery generation and current/log-derived totals exclude non-approved plan rows/logs; live Prisma/API integration remains unverified.
5. Met: only `APPROVED` library entries are generation/replacement candidates; nutritionist pending queue/history/archive visibility is preserved.
6. Met: TEST-013/014 are active; total result is 28 pass, 0 fail, 0 skipped, 7 TODO.
7. Met: no schema, migration, seed, frontend, dependency, CI, deployment, generated-output, Git-history, historical-document, or unrelated cleanup change was made.
8. Residual: pre-policy stored grocery lists and aggregates were preserved and cannot be certified without provenance/live inspection (DEF-020, RISK-015, UNC-010).

### Batch 3B - Runtime and API smoke verification (Partially completed)

- Objective: verify Batch 3 through the real backend/frontend runtime without unsafe or permanent test data.
- Execution date: August 19, 2026.
- Risk: High; `CLINICAL-SAFETY-IMPACTING` verification.
- Migrations/data changes: None. No record was created, updated, deleted, approved, rejected, logged, swapped, regenerated, seeded, or backfilled.
- Evidence: TEST-022 and CHG-20260819-05.
- Environment gate: the configured database is remote and ambiguously named, could not be proven development/test, and was unreachable. The in-app browser was also unavailable.
- Outcome: backend and frontend development servers started; health returned `200`; protected current/grocery/history/review endpoints returned `401` without a token; login/dashboard/meals/grocery/review/archive pages compiled and returned `200` HTML; tests and static checks remained stable.
- Blocked: credential login, authenticated profile/role layout, all database-backed actionability checks, nutritionist queue/archive data, interactive browser console/network/hydration behavior, and successful/rejected user mutations.
- Regressions: no Batch 3 runtime regression was confirmed. DEF-021 (automatic SMTP verification on startup) and DEF-022 (pending-card/action-error frontend defense-in-depth) were recorded as pre-existing limitations and not corrected.
- Repeat gate: rerun only the blocked TEST-022 matrix against an explicitly identified, reachable development/test database with disposable synthetic USER/NUTRITIONIST fixtures and an available browser surface.

Acceptance criteria and outcome:

1. Met: backend startup, port, base path, and health endpoint are runtime-known.
2. Met: frontend startup and server-side compilation of requested routes are runtime-known.
3. Blocked: safe credential login and authenticated profile retrieval because the database was unreachable.
4. Blocked: Batch 3 actionability endpoints could not be exercised with safe authenticated data.
5. Partially met: relevant frontend routes compile without server crashes; client/browser behavior is blocked.
6. Blocked: nutritionist queue/archive contents require the unavailable database/login.
7. Met: blocked checks are reported rather than simulated; no unsafe data was created.
8. Not applicable: no Batch 3 regression was confirmed, so no production correction or regression test was added.
9. Met: no unrelated production behavior changed.
10. Met: no migration, seed, AI generation, OAuth, email delivery, cron execution, destructive data action, CI, or Git-history operation occurred. The documented backend startup did attempt and fail SMTP transporter verification before the follow-up startup masked SMTP credentials.
11. Met: the engineering record distinguishes unit verified, runtime/HTTP verified, browser blocked, authenticated/database blocked, and still unverified behavior.

### Batch 3C - Database connectivity diagnosis and authenticated runtime unblocking (Completed within safe available accounts)

- Objective: classify the database failure without exposing/changing secrets, then repeat only non-destructive authenticated checks if connectivity is restored.
- Execution date: August 19, 2026.
- Evidence: TEST-023 and CHG-20260819-06.
- Failure category: restricted execution environment denied outbound PostgreSQL TCP with `SocketException: AccessDenied`.
- Configuration result: expected `.env` loaded successfully; `DATABASE_URL` is a valid PostgreSQL URI with all required structural fields, SSL parameters, and a pooled Neon endpoint.
- Permitted-network result: DNS, TCP/5432, PostgreSQL SSL negotiation, TLS 1.2/certificate, and Prisma `SELECT 1` all passed.
- Authenticated result: existing ADMIN and NUTRITIONIST credential logins returned `200`; ADMIN analytics, nutritionist profile, 47-row all-pending review queue, and one-row approved archive returned `200` without mutations.
- USER result: blocked because the repository defines no USER credential and Batch 3C prohibited guessing, seeding, or impersonation.
- SMTP: suppressed in the temporary backend process; permanent environment values were untouched and no SMTP connection/delivery occurred.
- Data impact: existing user/profile/review/archive/aggregate records were read; zero database records were changed.
- Source/config impact: documentation only; no application, schema, migration, seed, dependency, environment, generated source, or Git-history change.

Acceptance criteria and outcome:

1. Met: failure specifically classified as restricted local network egress at TCP, not an application/configuration/credential/Neon/Prisma/TLS defect.
2. Met: no secret, identity, token, cookie, connection URL, hostname, query secret, or health record was placed in documentation.
3. Met: no database record or schema object was modified.
4. Met: no migration, seed, reset, push, pull, DDL, administrative SQL, or data-changing SQL ran.
5. Met within available accounts: safe read-only ADMIN/NUTRITIONIST authentication proceeded after connectivity restoration.
6. Met: the owner action is limited to confirming the target is development/test and identifying an existing disposable USER account locally; no credential replacement is indicated.
7. Met: Batch 4 remained unstarted.

### Batch 3D - Owner-assisted USER and three-role runtime verification (Completed within read-only boundary)

- Objective: use the owner's three existing persistent development/demo accounts to complete safe read-only authentication, RBAC, role API, and approved-meal negative-state checks without creating fixtures.
- Execution date: August 19, 2026.
- Evidence: TEST-024 and CHG-20260819-07.
- Target classification: owner-confirmed shared persistent capstone development/demo database; non-disposable and mutation-prohibited for this batch.
- Credential safety: the owner-created `nutrimind-backend/.env.runtime-test.local` contains the six required variables; the exact path was added to the root `.gitignore` and verified ignored/untracked before use. Values and tokens were never printed or documented.
- Authentication result: existing USER, NUTRITIONIST, and ADMIN credential logins returned `200` with expected roles; the owner manually verified USER traditional and Google login/dashboard flows and matching profile data.
- Authorization/API result: all 20 role endpoint and cross-role denial assertions passed; cross-role requests returned `403`.
- Actionability result: the USER's real pending/rejected/cancelled plans and non-approved linked logs were excluded from current results/totals; an owned invalid status request returned `409`; before/after snapshots were unchanged.
- Review result: the nutritionist queue returned 47 rows and all were `PENDING_REVIEW`; approved archive retrieval passed.
- Frontend result: 11 USER/NUTRITIONIST/ADMIN route shells returned `200` without a server-error marker. These were HTTP route-shell checks, not full browser hydration/interaction checks.
- Regression result: 35 registered backend tests, 28 pass, 0 fail, 0 skipped/cancelled, 7 TODO.
- Data impact: zero database records changed; no generation, approval, rejection, successful log/status update, swap, profile change, notification read, or cron request ran.
- Repository impact: one exact authorized `.gitignore` entry plus engineering documentation; no application/test source, schema, migration, seed, dependency, environment, generated source, tracked inventory, historical guidance, or Git-history change.

Acceptance criteria and outcome:

1. Met: three owner-designated roles authenticate and enforce the expected cross-role boundaries.
2. Met: read-only USER current/history/grocery/progress/notifications/check-in/library paths, nutritionist profile/queue/archive, and admin analytics/listings returned successful responses.
3. Met for real negative-state fixtures: pending/rejected/cancelled and linked non-approved logs are excluded from current actionability/totals.
4. Met: an invalid owned transition returns `409` before mutation and persisted state is unchanged.
5. Blocked without mutation: the USER had no naturally available approved current/future plan, so the live positive path was not fabricated.
6. Blocked by schema/scope: stored-grocery provenance and generation remain uncertified under DEF-020/RISK-015/UNC-010.
7. Partially met: owner verified both USER login dashboards; remaining pages passed route-shell checks, but a complete interactive browser/hydration matrix remains open under UNC-013.
8. Met: final-cycle runtime failures were zero; no application correction or new regression test was required.
9. Met: Batch 4 remained unstarted.

### Batch 4A - Deterministic restriction vocabulary and policy design (Completed; no behavior change)

- Objective: establish exact schema/frontend/backend vocabulary, profile aggregate usage, inventory every current restriction rule/caller, and specify a conservative future pure policy without inventing medical rules.
- Completion date: August 19, 2026.
- Evidence: `docs/NUTRIMIND_RESTRICTION_POLICY_DESIGN.md`, TEST-025, CHG-20260819-08.
- Risk: Critical; `CLINICAL-SAFETY-IMPACTING` with potential privacy impact.
- Database: aggregate-only queries in explicit read-only transactions; no identities/custom text output and zero records changed.
- Findings: DEF-023 incompatible nutritionist keys; DEF-024 permissive null/empty library metadata; DEF-025 custom restrictions omitted from deterministic enforcement; DEF-026 allergy/custom/provenance confidence gap; RISK-018 opened.
- Design: proposed ADR-008 defines `ALLOW`/`REVIEW`/`BLOCK`, existing confidence flags, stable reason codes, mechanical normalization, no fuzzy clinical matching, and most-restrictive precedence.
- Clinical boundary: existing thresholds, keywords, semantic aliases, and “safe/unsafe” claims remain unreviewed; UNC-014 lists exact owner/RND decisions.
- Tests: TEST-015/016 activation cases designed but deliberately remain TODO.
- Repository impact: the three authorized current documentation files only; no production/test/schema/migration/dependency/environment/generated/historical/Git-history change.

Acceptance criteria and outcome:

1. Met: exact schema condition, allergy, confidence, review, provenance, warning, and replacement vocabulary recorded.
2. Met: frontend/backend/schema mismatches and every required caller/rule class inventoried.
3. Met: privacy-safe live aggregate profile records enum/custom usage, library metadata, provenance, confidence/status, and pending review counts.
4. Met: mechanical normalization is separated from semantic aliases and medical rules.
5. Met: proposed contract, decision matrix, caller matrix, TEST-015/016 plan, and smallest Batch 4B plan are documented.
6. Met: no policy was implemented, no test activated, no database record changed, and no clinical claim approved.

### Batch 4B1 - Pure deterministic restriction policy and automated tests (Completed; no production integration)

- Objective: implement the owner-approved pure evaluator, exact aliases, conservative metadata behavior, stable reason codes, and synthetic regression coverage without changing live behavior.
- Completion date: August 19, 2026.
- Evidence: `src/domain/restriction-evaluation.policy.ts`, active TEST-015/016, TEST-026, CHG-20260819-09, and the design document section 15.
- Result: `BLOCK > REVIEW > ALLOW`; exact allergy conflicts block; unknown/custom/condition/incomplete/estimated/unresolved evidence reviews; complete non-conflicting known allergy evidence is `ALLOW`/`CAUTION`; the narrowly scoped complete/no-restriction result is `ALLOW`/`SAFE`.
- Aliases: only `PEANUTS -> NUTS`, `TREE_NUTS -> NUTS`, and `EGG -> EGGS`; rejected semantic mappings remain custom/unknown.
- Verification: 64 registered backend tests, 59 pass, 0 fail, 0 skipped, 5 TODO; static/isolation checks recorded by TEST-026.
- Boundary: no production import/call, database, Prisma, HTTP, Gemini, frontend, API, schema, migration, seed, dependency, lockfile, environment, credential, generated, CI, deployment, or Git-history change.

### Batch 4B2 - Meal-generation library compatibility adapter (Completed; generation selection only)

- Objective: connect one read-only meal-generation library-selection boundary to the approved pure evaluator while preserving Batch 3 actionability separately.
- Completion date: August 19, 2026.
- Implemented domain: `meal-generation-library-compatibility.adapter.ts`, `MealGenerationService.generate7DayPlan` candidate filtering/fallback seam, TEST-027/028, and current documentation.
- Eligibility: exact `APPROVED` plus policy `ALLOW`, complete evidence, no block, no unresolved restriction, and no estimated/unresolved ingredient; all REVIEW/BLOCK/unknown/malformed legacy outcomes are excluded.
- Risk: Critical; `CLINICAL-SAFETY-IMPACTING`.
- Migrations/database: None; no database or live generation was contacted during verification.
- Verification: TEST-027 has 18 adapter cases; TEST-028 has 9 caller/fallback cases; full backend result 91 registered, 86 pass, 0 fail, 0 skipped, 5 TODO.
- Compatibility result: current legacy library records have no explicit completeness/direct-allergen evidence and therefore default to REVIEW/ineligible; fallback remains one batch for all unmatched slots.
- Rollback: revert the adapter, generation caller changes, TEST-027/028, and Batch 4B2 documentation together; no schema/data rollback is needed.
- IDs: REQ-003/006/010, ADR-008, DEF-009/024-026, RISK-002/006/018, TEST-027/028, CHG-20260819-10, DOC-014.

### Batch 4B3 - Library safety-evidence completeness contract design (Completed; design only)

- Objective: design, without implementation, the smallest authoritative completeness/provenance contract that could allow reviewed library records to satisfy the adapter without fabricating evidence.
- Completion date: August 20, 2026.
- Inspection: schema and every relevant migration; approval/ingredient override/edit/flag/resolve/delete and authorization paths; review/library UI forms; generation adapter and historical-plan persistence dependency.
- Aggregate evidence: explicit read-only transaction found 2 preserved legacy rows, 1 with historical ingredients, 0 with fully FNRI-linked combined historical ingredients, 1 with unlinked ingredients, and 0 records changed.
- Design: ADR-009 `INCOMPLETE`/`COMPLETE`/`STALE` lifecycle; legacy origin; explicit reviewed-none/declaration states; first-class normalized ingredients/declarations; cross-contact; evidence revision/version; qualified reviewer; invalidation; append-only history.
- Authority: only a currently verified, unexpired nutritionist certifies; any such nutritionist may re-review; library ownership and admin account management remain separate.
- Safety boundary: FNRI is nutrition provenance only; estimated/unresolved/unlinked ingredients prevent completeness; no dish/fuzzy/translation/AI allergen inference; flags/material edits stale evidence; flag dismissal does not recertify.
- Migration direction: additive defaults make every legacy row incomplete; deterministic historical copying may create an incomplete draft only; no automatic certification, external lookup, deletion, merge, or source rewrite.
- Evidence: `docs/NUTRIMIND_LIBRARY_SAFETY_EVIDENCE_DESIGN.md`, ADR-009, REQ-011, TEST-029, CHG-20260820-01, DOC-015.
- Boundary: documentation only. No production/test/schema/migration/API/frontend/dependency/environment/generated/history behavior changed; Batch 4B2 fallback remains.

### Batch 4B4 - Additive library evidence lifecycle foundation (Completed; schema/migration/defaults only)

- Objective: add only lifecycle/origin/declaration-state/cross-contact/revision/reviewer/version/invalidation fields and a conservative migration that marks every legacy row incomplete.
- Completion date: August 20, 2026.
- Target/result: one additive migration applied to the owner-confirmed shared capstone development/demo database; prior and post migration history/schema parity were clean.
- Defaults: both current rows are `INCOMPLETE` with legacy origin, both declaration domains not reviewed, cross-contact not assessed, revision zero, and null certification/reviewer/version/invalidation data; zero rows are complete.
- Preservation: exact before/after counts and deterministic privacy-safe hashes matched for accounts/roles, users, nutritionists, FNRI/FoodItems, libraries/status/arrays, plans, ingredients/links, flags, and relevant relations. Domain records created/updated/deleted were 0/0/0; Prisma migration history added one row.
- Exclusions: no certification write workflow, first-class ingredient backfill, UI, adapter eligibility, other caller integration, medical rule, or legacy auto-certification.
- Verification: TEST-030 covers SQL safety, Prisma validation/status/deploy/schema parity, exact row/link/count/default preservation, old-application compatibility, 91 backend tests, both no-emit checks, lint, and repository safeguards. Initial client generation hit a Windows `EPERM`; Batch 4B4R subsequently recovered and verified Prisma Client v5.22.0 after an owner restart.
- Risk: Critical; additive schema and clinical-data semantics, but no intended live eligibility change.
- Rollback: keep additive fields if application rollback is needed; prefer forward recovery and prohibit destructive down-migration without separate authorization.
- IDs: REQ-011, ADR-009, DEF-027, RISK-019, TEST-030, CHG-20260820-02, DOC-016. UNC-015 is resolved for this bounded migration.

### Batch 4B4R - Safe Prisma client regeneration recovery (Completed; operational verification only)

- Completion date: August 20, 2026.
- Recovery: the owner restarted Windows and the repository's normal backend `npx.cmd prisma generate` completed successfully; Prisma Client v5.22.0 was generated from the unchanged Batch 4B4 schema.
- Generated metadata: all four lifecycle enums, all thirteen `MealLibrary` lifecycle scalar fields, and the optional named `safetyReviewedByNutritionist` relation are recognized.
- Regression: 91 backend tests registered, 86 pass, 0 fail, 5 TODO; backend/frontend no-emit, Prisma validation, and frontend lint pass. Lint retains 22 existing warnings and no errors.
- Safeguards: schema/migration/package/lockfile hashes match their authorized baselines; no tracked or untracked engine artifact entered Git; ignored temporary files were not manually deleted; the runtime credential remains ignored/untracked; ports 3000/5000 and repository-owned Node processes are stopped.
- Boundary: no database query/command, migration, schema, dependency, application/frontend/test, environment/credential, or Git-history change. Documentation only records recovery evidence.
- IDs: TEST-031, CHG-20260820-03, DOC-017. Batch 4B4R does not authorize Batch 4B5.

### Stabilization Checkpoint S1 - Feature-readiness and commit-boundary assessment (Completed; planning only)

- Readiness: `CONDITIONAL GO`. The application/test baseline is passing, but 158 changed/untracked paths contain cleanup, owner, generated, documentation, local-only, and whole-file-confirmation scopes that must not become one commit.
- Verification reuse: no application/schema/migration/test/dependency path changed after Batch 4B4R; authorized hashes and the recorded status inventory match. Reused the 91 registered/86 pass/5 TODO, type, Prisma, and lint baseline rather than rerunning identical checks.
- Safe cleanup commits proposed: (1) exact credential-ignore rule; (2) tested actionability/restriction policy unit using hunk-level separation; (3) Batch 4B4 schema plus its single migration; (4) canonical/current documentation plus tracked legacy notice/redaction diffs.
- Hold/exclude: 80 tracked `dist/**` changes; all frontend application changes; cookie-parser/package-lock owner changes; sanitizer/auth/check-in/keyword owner work; ignored credentials/Prisma engines; and untracked `AGENTS.md`, full-system/context documents, and `codex/*` until whole-file approval.
- TODO result: TEST-017 through TEST-021 remain valid and their underlying defects remain present. None blocks unrelated features globally; TEST-017-020 are demo gates when their workflows are shown, while TEST-021 requires RND criteria or explicitly qualified clinical claims.
- Next gate: separately authorize S1A commit-boundary execution only. A second reconciliation batch is conditional on the selected feature touching a mixed/held domain. Do not assume Batch 4B5.
- IDs: TEST-032, CHG-20260820-04, DOC-018.

### Stabilization Checkpoint S1A - Bounded cleanup commit execution (Completed through documentation commit; final regression follows)

- Pre-commit gate: `main` began at `2a5f61dffb9b3f4639f73e1389f83095e6a578f1` with zero staged changes and 158 classified changed/untracked paths. The runtime credential was ignored/untracked; no environment, Prisma engine/client, or temporary artifact appeared in normal status.
- Commit 1: `dd0fc5fadba9d4ec74e85e2f959e9911ec943ead`, message `chore(security): ignore local runtime verification credentials`, exact path `.gitignore`.
- Commit 2: `79a21c4ec1f39ddece297a322fc6ec6dc7536302`, message `feat(safety): add tested meal actionability and restriction boundaries`, 21 approved Batch 2A/3/4B1/4B2 paths. Hunk-level staging excluded cookie-parser/lockfile, sanitizer, check-in, expanded allergen-keyword, frontend, `dist`, Prisma, documentation, and uncertain owner changes.
- Commit 3: `c61377f80fe8644cc2e165ea8ee6a9d8d64f5da8`, message `feat(database): add conservative meal-library evidence lifecycle`, exact schema and one migration only. Both authorized SHA-256 baselines, staged whitespace, and additive migration safety checks passed.
- Commit 4: this documentation unit uses message `docs: establish the canonical engineering and cleanup record`; its own hash is intentionally not inserted by amend. Scope is the approved root/current documentation plus ten tracked legacy notice/redaction diffs.
- Preservation: all completed commits were inspected by name/status/stat and contained no forbidden path. Owner/application work, 80 tracked `dist/**` files, held documents, ignored credentials, and local generated files remain unmodified and excluded.
- Final gate: run TEST-033 after Commit 4. Unrelated feature development becomes `GO` only if the established regression, repository, credential, artifact, and port checks pass. A feature touching a preserved mixed/held domain still needs a narrow reconciliation decision; Batch 4B5 remains separately gated.
- IDs: TEST-033, CHG-20260820-05, DOC-019.

### Batch 4B5 - Stable meal-library evidence persistence (Proposed; separate approval required)

- Objective: add first-class library-owned ingredients, explicit safety declarations, and append-only review history required before any record can be certified.
- Boundary: no automatic certification/backfill, adapter eligibility, frontend, other caller integration, medical-rule expansion, external lookup, or destructive rewrite.
- Dependencies: exact retention/deletion semantics, immutable reviewer audit identity, declaration constraints, deterministic incomplete-draft import rule, disposable/shared-target preflight, and forward-recovery design.
- Required verification: additive SQL scan, migration-history/drift checks, exact record/link preservation, empty/ambiguous source refusal, no legacy completion, constraints/FKs/history immutability, client generation, and regression suite.
- Recovery: keep additive evidence tables and disable writers; prefer a separately reviewed forward corrective migration.

### Batch 5 - Backend authorization and validated DTO boundaries

- Objective: enforce prerequisite, verification, ownership, and explicit-field policies at the API boundary.
- Domains/files: auth/RBAC/policy middleware, user/nutritionist/admin routes/controllers, validation schemas, error contracts.
- Dependencies: Batch 2 integration harness; owner acceptance of prerequisite rules.
- Risk: High; security-impacting.
- Migrations: None expected.
- Required tests: direct API calls for email verification, onboarding, ToS, report acknowledgement, role, ownership, nutritionist verification, license expiry, and mass-assignment rejection.
- Rollback: policy middleware can be reverted as one bounded change; preserve tests/evidence.
- IDs: REQ-004/006, DEF-010/016, RISK-003/006.

Acceptance criteria:

1. Frontend guards are not the security boundary.
2. Every sensitive mutation uses an explicit validated field allow-list.
3. Nutritionist actions require current verification/license policy.
4. Ownership is tested for user health and plan data.

### Batch 6 - Nutritionist review correctness and transactions

- Objective: correct queue priority and make claim/approve/reject/replacement/library/notification state changes ownership-aware, expiry-aware, and atomic where required.
- Domains/files: nutritionist service/routes, Prisma transaction boundaries, review UI contract.
- Dependencies: Batches 2-5; explicit state-transition acceptance criteria.
- Risk: Critical; clinical/data-integrity impacting.
- Migrations: Possibly claim/index changes; any schema work requires a separate approved design.
- Required tests: simultaneous claims, expired claims, wrong owner, approve/reject failure injection, replacement failure behavior, library orphan prevention.
- Rollback: application transaction change rollback; schema work only with approved forward-recovery plan.
- IDs: REQ-002/005, DEF-013, RISK-004.

### Batch 7 - Logging, aggregates, check-ins, cron, and timezone

- Objective: establish correct timestamps/provenance, uniqueness/idempotency, and Asia/Manila business-time behavior.
- Domains/files: meal log/progress/weight/check-in/cron services and schema proposals.
- Dependencies: ADR-005; live duplicate inspection authorization; scheduler inventory.
- Risk: High.
- Migrations: Likely user/plan and user/date uniqueness/index migrations after privacy-safe duplicate analysis.
- Required tests: retry/concurrency, past/future scheduled meals, daily boundary/DST-independent Philippine dates, check-in due windows, cron idempotency, weight-path equivalence.
- Rollback: migration-specific forward recovery; never arbitrarily delete duplicates.
- IDs: REQ-005, DEF-014/015, RISK-004/007/011, UNC-004/005/006.

### Batch 8 - Refresh-session security hardening

- Objective: make refresh tokens rotating, hashed, revocable sessions with consistent logout/password-reset/reuse behavior.
- Domains/files: auth service/controller, JWT helpers, Session model/migration, Axios refresh behavior, auth tests.
- Dependencies: approved auth/session ADR to be written; integration fixtures; live session/data inspection.
- Risk: High; security and schema/migration impacting.
- Migrations: Expected; requires compatibility and rollout/recovery design.
- Required tests: login/refresh rotation, concurrent refresh, logout, password reset/change, expiration, revoked/reused token, auth-page expiration.
- Rollback: staged compatibility window supporting old/new tokens only if designed safely; otherwise coordinated forward recovery.
- IDs: REQ-004/005, DEF-007, RISK-005.

### Batch 9 - Meal library, FNRI, and grocery data design

- Objective: design first-class library ingredients, quantities/units, safe food aliases/matching, constraints, and indexes.
- Domains/files: Prisma schema/migrations, library/generation/swap/grocery services and UI/types.
- Dependencies: live duplicate/null inspection, owner-approved target design, backups/recovery, earlier tests.
- Risk: Critical; schema/migration and clinical/data impacting.
- Migrations: Required; design must include backfill, duplicate/null policy, compatibility window, and recovery.
- Required tests: migration upgrade, data backfill, matching determinism, swap ingredient retention, quantified groceries, checklist preservation.
- Rollback: forward-recovery plan preferred for deployed relational changes; backup/restore criteria documented before apply.
- IDs: REQ-003/005/006, RISK-002/004/007, UNC-005.

### Batch 10 - Resolve stale/missing product workflows

- Objective: explicitly implement, reframe, hide, or remove unsupported UI promises.
- Domains: nutritionist directory/consultation, patients/care relationship, nutritionist application, direct library create, admin controls/audit, export, water, PWA/offline.
- Dependencies: owner product/privacy decisions; do not treat these as cleanup-only technical details.
- Risk: Medium to Critical depending on consultation/patient data scope.
- Migrations: Unknown until choices are approved.
- Required tests: route contracts and E2E for every retained workflow.
- Rollback: feature flag/hide UI where possible; schema rollback only through approved recovery plan.
- IDs: DEF-005/006/011/012, RISK-008, UNC-007.

### Batch 11 - Production readiness and final reconciliation

- Objective: reconcile route/type/schema inventories and establish an evidence-backed release checklist.
- Domains: CI, builds, E2E, deployment, scheduler, secrets, CORS, OAuth, SMTP, Gemini, logs, monitoring, privacy, accessibility, performance, backup/recovery, clinical review.
- Dependencies: earlier critical batches and external access.
- Risk: High.
- Migrations: only those approved in earlier batches.
- Required tests: full static/unit/integration/build/E2E suite plus controlled external smoke checks.
- Rollback: deployment-specific documented rollback/forward recovery.
- IDs: RISK-009/012, UNC-003/004/008.

## 3. Accepted decisions and remaining owner decisions

Accepted on August 19, 2026:

1. ADR-001: preserve the current Next.js + Express/JWT + Prisma/PostgreSQL architecture.
2. ADR-002: make `docs/NUTRIMIND_ENGINEERING_RECORD.md` canonical while retaining labelled legacy material.
3. ADR-003: use explicit verification statuses and avoid unqualified current completion claims.
4. ADR-004: establish a minimal automated test baseline before behavior-changing refactors.
5. ADR-005: use `Asia/Manila` as the explicit business timezone.
6. Cleanup Batch 1 documentation changes.
7. ADR-006: use Node's built-in test runner through existing `tsx` for the minimal backend baseline.
8. Cleanup Batch 2A test/configuration/documentation changes.
9. ADR-007: centralize default-deny approved/current meal actionability while preserving history and review visibility.
10. Cleanup Batch 3 actionability policy, focused backend consumer, test, and documentation changes.
11. Cleanup Batch 4A inspection, read-only aggregate profiling, and documentation-only policy design.
12. ADR-008 for the isolated pure-policy boundary and Cleanup Batch 4B1, including only the three exact aliases and conservative decision/metadata behavior documented in the approved prompt.
13. Cleanup Batch 4B2 meal-generation library compatibility adapter, conservative legacy exclusion, and injected fallback seam.
14. Cleanup Batch 4B3 inspection, aggregate-only read-only profile, ADR-009 evidence contract, and documentation-only roadmap.
15. Cleanup Batch 4B4 additive lifecycle schema/migration, conservative legacy defaults, distinct reviewer relation, exact record/link preservation, and forward-only recovery boundary.
16. Cleanup Batch 4B4R owner-assisted Prisma Client v5.22.0 regeneration and local generated-metadata/regression/artifact verification.

Still needed for later batches:

1. Optional owner-assisted interactive browser checks for remaining USER/NUTRITIONIST/ADMIN pages and client error/empty states.
2. Read-only positive approved-current USER verification only if the existing account naturally receives such a plan; do not create or approve a fixture solely for smoke testing.
3. Remaining decisions in `docs/NUTRIMIND_RESTRICTION_POLICY_DESIGN.md` section 14, including medical rules, direct-allergy logging, nutritionist override, and first-class vocabulary; Batch 4B1 resolved only its explicitly approved technical subset.
4. Separately review Batch 4B5 before first-class evidence persistence; no legacy/current library record may become automatically certified or eligible in that slice.
5. Product direction for patients/consultation: implement, reframe, hide, or remove.
6. Confirmation of any CI, deployment, scheduler, or monitoring configuration outside the repository.
7. RND-approved calorie bounds and escalation criteria before TEST-021 can be activated.
8. Owner authorization for privacy-safe live inspection of pre-Batch-3 grocery/log/aggregate provenance if remediation is desired.

## 4. Recommended next owner action

After TEST-033 post-commit verification passes:

1. Select one unrelated feature scope.
2. Identify whether it touches any preserved mixed/held owner path.
3. If it does, authorize a narrow reconciliation decision for only those paths before feature edits.
4. Keep tracked `dist/**`, local credentials/generated files, and unrelated held documents out of feature commits.

Do not begin Batch 4B5 automatically. It remains a separate schema/workflow approval boundary.

TEST-021 should remain TODO until a clinical reviewer supplies the calorie policy recorded by UNC-009.

## 5. Completed-batch boundary

Batch 1 authorized documentation changes only. Batch 2A authorized the minimal test baseline. Batch 3 authorized only the approved-meal actionability boundary. In accordance with the governing guides and owner restrictions:

- No application code, schema, migration, package manifest, generated output, configuration, environment file, or `.gitignore` change was authorized or made in Batch 1.
- No formatter, generator, build, migration, seed, package upgrade, destructive Git command, or external deployment action was run.
- Batch 2A changed the backend test script and added test-only files; it added no dependency and changed no production source behavior.
- No live service, external HTTP request, application server, database query, deployment, or CI action was used in Batch 2A.
- Batch 3 added one pure backend policy, focused actionability callers, active tests, and documentation; it changed no schema, migration, frontend, dependency, CI, deployment, generated output, authentication, or unrelated behavior.
- Batch 3B changed engineering documentation only. It started the existing applications and made read-only/unauthenticated requests; no database record, schema, seed, environment file, application source, test source, dependency, or generated source was changed.
- Batch 3C changed engineering documentation only. It performed sanitized read-only network/TLS/Prisma diagnostics and existing-account authentication; database records were read but none were changed, and SMTP was suppressed in the temporary backend process.
- Batch 3D added only the exact authorized root `.gitignore` entry `nutrimind-backend/.env.runtime-test.local` plus engineering documentation. It used the owner-created ignored/untracked credential file without printing values and performed read-only requests plus one expected pre-mutation `409`; zero database records changed.
- Batch 4A changed only the three authorized current documentation files. It performed source inspection and explicit read-only aggregate profiling; no identity/custom text was output, no record changed, and no engine/test/schema/migration/runtime behavior was implemented.
- Batch 4B1 added one pure backend policy, one synthetic test file, activated TEST-015/016 through the existing harness, and updated only authorized current documentation. It did not import the policy into production or contact a database/external service.
- Batch 4B2 added one read-only adapter, changed only generation-time library candidate selection/fallback invocation, added synthetic tests, and updated current documentation. No live generation, database access/mutation, external call, schema, dependency, frontend, API, environment, or credential change occurred.
- Batch 4B3 added one dedicated design document and updated only current engineering documentation. It ran one aggregate-only explicit read-only database profile; two legacy records were inspected through selected fields and zero records changed. It made no production/test/schema/migration/API/frontend/dependency/environment/credential/generated/history change.
- Batch 4B4 changed only the authorized Prisma schema, one additive migration, and four current documentation files. It applied the migration to the owner-confirmed shared development/demo database, added one migration-history record, gave both legacy rows conservative defaults, preserved all domain records/relations, and changed no API/frontend/certification/adapter behavior.
- Batch 4B4R changed only this cleanup plan and the canonical engineering record after the owner successfully regenerated Prisma Client v5.22.0. Verification contacted no database and changed no schema, migration, dependency, source, test, frontend, environment, credential, generated Git artifact, or history.
- Stabilization Checkpoint S1 changed only this cleanup plan and the canonical engineering record. It inspected status/diffs and production/TODO evidence, reused the unchanged B4B4R baseline, and performed no staging, commit, source/schema/test/dependency/database/generated/history action.
- Stabilization Checkpoint S1A created four bounded local commits only: the exact credential-ignore rule; the approved tested safety/actionability unit with mixed owner hunks excluded; the authorized schema and single migration; and the approved documentation evidence unit. It did not push, rewrite history, run a database command, install dependencies, alter working source to simplify staging, or absorb owner/generated/held/local files.
- No Git history, branch, tracked-file inventory, historical guidance file, or unrelated owner modification was altered or cleaned.
- Batch 4B5 and Batches 5-11 must wait for separate owner review and approval.
