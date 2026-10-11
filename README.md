# KAINARA

KAINARA is a Philippines-focused nutrition and meal-planning capstone application with separate user, internal nutritionist, and administrator experiences. Its plans mix accessible general meals, Filipino food, locally available international food, and appropriate convenience options instead of restricting users to Filipino dishes.

> **Current evidence source:** [`docs/NUTRIMIND_ENGINEERING_RECORD.md`](docs/NUTRIMIND_ENGINEERING_RECORD.md) records implemented behavior, verification levels, accepted decisions, known defects, and risks. Older prompts, addenda, and handoff notes are collected as [project history](docs/history/PROJECT_EVOLUTION.md). They are not current specifications.

Operational deployment uses [`docs/PRODUCTION_OPERATIONS_RUNBOOK.md`](docs/PRODUCTION_OPERATIONS_RUNBOOK.md). Public production startup remains gated on the qualified sign-off recorded in [`docs/CLINICAL_POLICY_APPROVAL.md`](docs/CLINICAL_POLICY_APPROVAL.md).

Capstone rehearsal, aggregate evaluation, bounded synthetic read benchmarks and isolated restore/concurrency drills use [`docs/CAPSTONE_REHEARSAL_RUNBOOK.md`](docs/CAPSTONE_REHEARSAL_RUNBOOK.md). [Current follow-up evidence](docs/CAPSTONE_RELIABILITY_FOLLOWUP_2026-10-10.md) separates verified results from remaining deployment/provider gates.

The [October 11 synthetic user-flow report](docs/SYNTHETIC_USER_FLOW_TEST_REPORT_2026-10-11.md) records actual member/RND/admin browser checks and isolated database acceptance. Study the current implementation using the [backend guide](docs/study/BACKEND_STUDY_GUIDE.md) and [frontend guide](docs/study/FRONTEND_STUDY_GUIDE.md).

The hosted capstone demonstration uses [`docs/VERCEL_RAILWAY_DEMO_DEPLOYMENT.md`](docs/VERCEL_RAILWAY_DEMO_DEPLOYMENT.md), with normal registration/login and the existing release-mode startup gates. Public interface wording follows the current engineering-record entry. It keeps production security enabled and does not constitute clinical approval.

Administrator-managed nutrition sources, aggregate consumption releases, FNRI mappings, publication, and rollback use [`docs/ADMIN_REFERENCE_DATA_RUNBOOK.md`](docs/ADMIN_REFERENCE_DATA_RUNBOOK.md).

Meal flags, independent re-review, quarantine release, related-case admin oversight, and JSON draft batches use [`docs/MEAL_REVIEW_GOVERNANCE.md`](docs/MEAL_REVIEW_GOVERNANCE.md). The additive governance migration must be applied to a confirmed database target before deploying this workflow.

Admin meal-log history and meal popularity use [`docs/MEAL_LOG_AUDIT.md`](docs/MEAL_LOG_AUDIT.md). Apply the additive meal-log audit migration to a confirmed target before opening these views. Historical age, membership and earlier edits remain explicitly unavailable; the migration does not invent them.

Standardized capstone recipe portions, nutrient calculations, guarded development imports and inactive condition-rule proposals use [`docs/DEMO_RECIPE_PREPARATION.md`](docs/DEMO_RECIPE_PREPARATION.md).
Member-specific RND relevance assessments that preserve the reported diagnosis use [`docs/CONDITION_PLANNING_ASSESSMENTS.md`](docs/CONDITION_PLANNING_ASSESSMENTS.md).

Profile clarification has been implemented and tested in five reviewed batches. See [RND clarification implementation plan](docs/RND_CLARIFICATION_IMPLEMENTATION_PLAN.md). Persistent questions survive claim handoffs; Profile queue corrections require member acknowledgment or a recorded correction request, followed by fresh profile confirmation and current guidance acknowledgment. Meal reviews bind to their original context and return the canvas to the queue when that context becomes outdated. RND replacement search supports explicit complete-plate nutrient limits; swaps remain pending and a recorded no-suitable-replacement rejection holds automatic regeneration. Exact prior review references expose only recorded RND attribution and numeric plate facts, without another member's private details or automatic clinical approval. Remaining-date repairs preserve eaten/skipped records and previous purchases as read-only history; purchases do not automatically become pantry stock. All five additive migrations and `CLINICAL_CLARIFICATIONS_ENABLED=true` rollout require a confirmed database target. The default disabled mode retains the existing workflow without querying the new tables; shared rollout and demo promotion remain separate.

## Current verification status

The application has substantial frontend and backend implementation. Verification results change as work continues; use the latest dated entry in the [engineering record](docs/NUTRIMIND_ENGINEERING_RECORD.md) and rerun the relevant checks for the code you are studying. Automated, browser, and disposable-database tests do not establish clinical approval. The [clinical policy approval record](docs/CLINICAL_POLICY_APPROVAL.md) is the separate release gate.

Use these status terms: Planned, Designed, Partially implemented, Implemented but unverified, Statically verified, Integration tested, End-to-end tested, Deployed, and Clinically reviewed.

## Architecture

The accepted architecture is:

```text
Next.js 15 frontend with React 19
  -> Axios REST requests with a bearer access token
  -> Express/TypeScript backend
  -> Prisma ORM
  -> PostgreSQL/Neon
```

Authentication uses custom short-lived access JWTs and refresh JWT cookies. The project does not use NextAuth, and the Express backend must not be merged into Next.js without a separately approved architecture change.

Weekly plan-cycle and shopping-day behavior uses `Asia/Manila`. Some older daily logging/aggregation paths still use server-local date operations and remain tracked for hardening.

Meal generation uses a hybrid retrieval pipeline rather than giving Gemini database access. The backend first screens nutritionist-certified meals, retrieves bounded FNRI records, and supplies exact record identifiers in the prompt. USDA FoodData Central provides a fallback for unambiguous ingredient identities that FNRI does not resolve. Gemini can compose unmatched slots, but the backend resolves its ingredient identifiers and retains the existing review and clinical-safety gates.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `frontend/` | Next.js UI for public, onboarding, user, nutritionist, and admin routes |
| `frontend/src/app/` | Route groups, layouts, and pages |
| `frontend/src/components/` | Shared, UI, auth, and user-facing React components |
| `frontend/src/lib/` | Axios, client auth helpers, and React contexts |
| `backend/` | Express REST API and business services |
| `backend/src/routes/` | API route definitions and middleware composition |
| `backend/src/controllers/` | HTTP handlers; some currently contain direct Prisma access |
| `backend/src/services/` | Auth, plans, logs, groceries, review, progress, notifications, and job logic |
| `backend/src/lib/` | Prisma, JWT, Gemini, FNRI, email, PDF, and calculation helpers |
| `backend/prisma/schema.prisma` | Current Prisma data model |
| `backend/prisma/migrations/` | Database migration history |
| `backend/prisma/data/fnri.csv` | FNRI data used by the seed script |
| `.github/workflows/ci.yml` | Backend and frontend verification on pushes and pull requests |
| `docs/` | Engineering record, operational references, historical archive, and verification evidence |
| `AGENTS.md` | Current shared-checkout and change-safety rules for coding agents |

The intended backend layering is route -> validation/policy -> controller -> service -> Prisma/external integration. The current implementation does not enforce this boundary strictly.

## Start reading the code

1. Open `frontend/src/app/layout.tsx` and the route group for the screen you want to understand. Follow its API calls through `frontend/src/lib/axios.ts`.
2. Find the corresponding endpoint in `backend/src/app.ts` and `backend/src/routes/`, then trace its controller, service, and policy modules.
3. Use `backend/prisma/schema.prisma` to understand persisted models and `backend/tests/` or `frontend/src/` tests to check intended behavior.
4. Compare older design ideas with the [project evolution archive](docs/history/PROJECT_EVOLUTION.md) only when you want the history behind a decision. The latest engineering-record entry and code take precedence.

Useful entry points after the workspace refactor:

| Area | Where to follow the code |
| --- | --- |
| Member page composition | `features/dashboard/DashboardWorkspace.tsx`, `features/meals/MealsWorkspace.tsx`, `features/grocery/GroceryWorkspace.tsx` under `frontend/src/`; see [refactoring plan](docs/REFACTORING_PLAN.md) |
| Landing sections | `frontend/src/features/landing/`: hero, platform, process, nutritionists, sources, guides and call to action; `components/landing/LandingHome.tsx` composes them |
| Member detail sections | `frontend/src/features/progress/sections/`, `profile/account/`, `meal-card/`, `meal-history/`, `meal-activity-calendar/`, `dashboard/outside-meal/` and `meals/swap/`; each screen retains its public entry point |
| Staff and public document sections | `frontend/src/features/nutritionist-profile/`, `nutritionist-profile-review/`, `nutritionist-outside-meals/`, `nutritionist-reviews/sections/`, `nutritionist-library/sections/`, `admin-analytics/sections/`, `nutritionist-application/steps/` and `app/docs/chapters/` |
| Meal API handlers | `backend/src/controllers/meals/`: plan reads, generation, cycles, scheduled logs and swaps; `meals.controller.ts` preserves route entry points |
| Authentication workflows | `backend/src/services/auth/`: registration, Google identity, email verification, password auth and sessions; `auth.service.ts` preserves the public API |
| Cached lists across roles | `frontend/src/hooks/useSessionQuery.ts` and `frontend/src/lib/session-resource-cache.ts` |
| Meals tabs | `frontend/src/features/meals/useMealsWorkspace.ts`, `useMealHistory.ts`, and `useMealLibrary.ts` |
| Case review screen | `frontend/src/features/nutritionist-reviews/CaseReviewWorkspace.tsx`, `CaseReviewQueue.tsx`, and `useNutritionistReviews.ts` |
| Outside-food capture | `frontend/src/features/dashboard/OutsideMealModal.tsx` and `OutsideMealPreview.tsx`; backend `outside-meals.controller.ts` |
| Scheduled meal logging and presentation | `backend/src/services/scheduled-meal-log.service.ts` and `meal-plan-presentation.service.ts` |
| Approval and swaps | `backend/src/services/nutritionist-approval.service.ts`, `meal-swap.service.ts`, and `meal-swap-serving.service.ts` |

These modules separate presentation, client state, and backend operations. Eligibility checks and database transactions remain in the backend services and domain policies.

For onboarding meal times, device notification permissions, stable VAPID keys and reminder scheduling, see [Device notifications and meal reminders](docs/WEB_PUSH_MEAL_REMINDERS.md).

## Partially prepared meal plans

The persistent preparation worker fills at most one earliest remaining calendar day per turn. New/retried work wakes it immediately and active work continues every 30 seconds. An empty queue or worker failure waits up to 15 minutes before its next pass, while known future retries use their persisted schedule. It tries current source recipes before AI; restricted-profile candidates still need their existing RND approval. Temporary provider outages and quota pauses retain a scheduled retry. Source, ingredient, profile and validation failures never grant approval.

During worker turns, recovery scans eligible current/future cycles no more often than every five minutes (an otherwise idle process may wait up to 15 minutes) for gaps left behind in completed jobs or source-unavailable failures. Jobs paused at a passed shopping deadline can also resume once their cycle becomes active; upcoming cycles still respect that deadline. It queues fresh replacements without restoring cancelled rows. Frozen shopping plans, accepted incomplete plans, expired cycles and changed profiles are excluded. Passed days are not backdated or counted as meals still awaiting preparation. A new database schema or broader catalogue alone does not fix an already completed job with cancelled slots; this reconciliation addresses that case. Available evidence and calorie constraints can still prevent a suitable replacement.

`npm --prefix backend run test:acceptance:partial-plan` checks progressive filling, concurrent recovery, source evidence, review holds and grocery invalidation. It refuses any database except the fresh disposable loopback target named in its script and requires external provider credentials to be empty. Do not point acceptance scripts at the shared development database.

## Active RND case approval queue

Every currently eligible RND has equal access to the shared member case, profile and clinical-document queues. Expertise, experience, online status and the legacy availability switch do not reserve cases. Claim locks, credential checks, clinical evidence readiness and reviewer independence remain enforced. Priority routing is retired: old configuration/episodes cannot hide cases, the admin enable endpoint rejects activation, and recorded expertise/experience are credential information only. Historical routing decisions remain available as history.

Member meal approval requests appear only for today and future Philippine meal dates in plans that have not ended, completed or been replaced. Queue counts use the same rule. Expired requests leave the active queue automatically; their saved meal rows, decisions, flags and audit snapshots remain in history. Stale preview, claim, decision and swap requests are rejected by the API. This expiry rule does not retire reusable recipe verification, recipe flags, profile reviews or outside-food reviews.

To close the saved pending status of obsolete member meal requests, run `npx tsx scripts/close-stale-meal-reviews.ts` from `backend` for a dry run. After the owner authorizes cleanup on the printed development target, use `--apply --confirm-target TOKEN --expect-count COUNT` (also `--allow-shared-development` for a remote development database). It saves an ignored local rollback snapshot before an atomic cancellation and per-request audit entry. It preserves all meal rows, decisions and evidence; active meal requests and the other review queues are excluded. It refuses changed candidate counts or concurrent changes. No migration is needed.

## Prerequisites

- Node.js 24 and npm, as pinned by the root `.nvmrc` and used by repository CI.
- A PostgreSQL database for backend persistence.
- Environment values for the integrations you intend to exercise.
- Docker Desktop with its Linux engine running, only when using the optional container workflow.

Do not commit `.env` or `.env.local` files. Never put real credentials in documentation, screenshots, fixtures, or logs.

Install all three lockfiles and run the ordinary repository gate from the root:

```powershell
npm run install:all
npm run check
```

`npm run check` verifies formatting, backend and frontend lint, deterministic backend and frontend tests, and both production builds. Run `npm run audit` for all three dependency trees and `npm run test:e2e` for the Playwright browser smoke separately.

## Backend setup

From the repository root:

```powershell
Set-Location backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

The development server defaults to `http://localhost:5000`; `GET /health` is the basic health endpoint.

In development, the interactive OpenAPI explorer is available at `http://localhost:5000/api/docs` and the machine-readable OpenAPI 3.1 document at `http://localhost:5000/api/openapi.json`. Production keeps both routes disabled unless `API_DOCS_ENABLED=true` is an explicit release decision. The contract documents the primary API surface; executable validation and service policies remain authoritative.

Run `npx prisma migrate deploy` whenever the repository contains an unapplied migration. Do not start a source version that queries new models against an older database schema.

Before startup, create `backend/.env` from the available example and supply the required values. The example does not contain every currently used variable, so use the name inventory below.

### Prisma/database workflow

Validate the schema without changing it:

```powershell
Set-Location backend
npx prisma validate
```

Generate the Prisma client after installing dependencies or changing an approved schema:

```powershell
npx prisma generate
```

For an approved local database, use the command appropriate to the task:

```powershell
# Apply existing migrations without creating a migration
npx prisma migrate deploy

# Development-only workflow when authoring an approved schema change
npx prisma migrate dev
```

The optional seed command writes FNRI records to the configured database:

```powershell
npm run seed
```

Validate the managed meal catalogue and project its certified-profile coverage from the checked-in FNRI CSV without connecting to a database:

```powershell
npm run seed:meal-library -- --offline-dry-run
```

The common catalogue is historical test data. Its offline projection remains available for regression work; `--apply` is disabled. The active baseline uses Panlasang Pinoy recipes, with the existing nutritionist review gates before reuse.

Migrations and seeds modify database state. Confirm the database target and authorization first. Do not use production-like data for development or tests.

Source nutrient completion uses `npm --prefix backend run nutrients:complete` (dry run by default). See [catalogue nutrient evidence](docs/CATALOGUE_NUTRIENT_COMPLETION.md) for the guarded import, source fingerprints and remaining recipe gaps. Apply its additive migration before using the new nutrient fields; the import does not certify meals or fabricate missing recipe values.

### Synthetic accounts in the normal localhost app

Use **Admin → People → Accounts → Create test accounts** in the local development app, or `npm --prefix backend run test:accounts`, to preview a create-only set of admin, member and RND accounts. It bypasses email proof, onboarding and RND application **for those marked synthetic accounts only**, with ordinary password login and unchanged application authorization. No Gmail account or provider request is needed. After explicitly confirming the development database target, create from the UI or apply the CLI target token. See [development test accounts](docs/DEV_TEST_ACCOUNTS.md) for conditions, RND status, returned login credentials and the CLI credential guide. Existing accounts and passwords are preserved.

### Compare Gemini food estimates

`npm --prefix backend run evaluate:gemini-nutrition` inspects eight weighed portions from the saved FNRI table without making provider calls. Add `-- --live` to make one batch request per configured model, using the same outside-food prompt and validation as the application. Live runs consume up to four API requests, are paced 35 seconds apart, stop on provider quota errors, and save a timestamped report under `docs/verification/`. They send public food descriptions only and do not read member data or write to the database. Use `--output <path>` to explicitly choose the report path.

Reports compare calories, protein, carbs and fat with saved reference composition. A small sample cannot establish clinical accuracy or a model uptime ranking. The application starts routine estimates with Flash-Lite and complex meal generation/replacements with full Flash models; review and eligibility checks still apply.

## Frontend setup

In a second terminal:

```powershell
Set-Location frontend
npm install
npm run dev
```

The frontend defaults to `http://localhost:3000`. Axios defaults to `http://localhost:5000/api` when `NEXT_PUBLIC_API_URL` is absent.

The development command uses Webpack. On the current Windows checkout, Turbopack exits during the first home-page compilation, so `npm run dev` in `frontend/` (or `npm run dev:frontend` at the repository root) uses the verified Webpack path. `npm run dev:webpack` remains an alias, and `npm run dev:turbo` is available for explicit Turbopack troubleshooting. The first route after starting the server still compiles. For timing a finished UI without development compilation, run `npm run build` followed by `npm run start` from `frontend/`; that preview does not reload edits automatically. API-backed screens can still wait on the configured database, especially when a remote database resumes after idling.

The backend reads credentialed CORS origins from `CORS_ORIGINS`, falling back to `FRONTEND_URL` when present and to `http://localhost:3000,http://localhost:3001` in development. Production startup has no implicit origin allowlist.

## Environment-variable reference

Only names and purposes are documented. No real values are included.

### Backend: `backend/.env`

| Name | Required when | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Persistence and Prisma commands | PostgreSQL connection string used by Prisma |
| `JWT_SECRET` | API startup/auth | Signs and verifies access JWTs; startup fails if absent |
| `JWT_REFRESH_SECRET` | API startup/auth | Signs and verifies refresh JWTs; startup fails if absent |
| `GEMINI_API_KEY` | AI reports, plans, estimates, replacements | Authenticates Google Generative AI requests |
| `CRON_SECRET` | Scheduled-job endpoints | Bearer secret checked by `/api/cron/*` |
| `PORT` | Optional | Express port; defaults to `5000` |
| `NODE_ENV` | Optional but important in deployment | Controls cookie security, rate limits, logging, and Prisma singleton behavior |
| `TRUST_PROXY` | Reverse-proxy deployments | Trusts forwarded protocol/address information; enable only behind the documented proxy topology |
| `API_DOCS_ENABLED` | Optional production documentation | Exposes `/api/docs` and `/api/openapi.json`; development enables them automatically |
| `FRONTEND_URL` | Password-reset email links | Frontend base URL in email; defaults to `http://localhost:3000` |
| `CORS_ORIGINS` | Browser API access | Comma-separated credentialed browser origins; required explicitly in production |
| `GOOGLE_CLIENT_ID` | Google sign-in | Expected audience for backend Google ID-token verification |
| `EMAIL_PROVIDER` | Email delivery | `smtp` (default) or `brevo` HTTPS delivery; Railway Free/Trial/Hobby needs HTTPS |
| `BREVO_API_KEY` | Brevo email delivery | Server-only API key; account activation and a verified sender are required |
| `SMTP_HOST` | Email delivery | SMTP hostname; code defaults to Gmail SMTP |
| `SMTP_PORT` | Email delivery | SMTP port; code defaults to `587` |
| `SMTP_USER` | Email delivery | SMTP account username |
| `SMTP_PASS` | Email delivery | SMTP account password or app password |
| `EMAIL_FROM` | Sender address | Required verified plain email address for Brevo; SMTP falls back to `SMTP_USER`, then a placeholder |
| `SMTP_VERIFY_ON_STARTUP` | Optional startup diagnostics | Set to `true` only when API startup should open an SMTP connection; defaults to disabled |
| `NUTRIMIND_TEST_MAIL_CAPTURE_PATH` | Local automated tests only | Absolute JSONL path used only with `NODE_ENV=test` to capture synthetic OTP/reset/invitation evidence without SMTP |
| `CLOUDINARY_URL` | Administrator meal-image uploads | Server-only Cloudinary credential URL; never expose it through a `NEXT_PUBLIC_*` variable |

### Frontend: `frontend/.env.local`

| Name | Required when | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Non-default backend URL | Browser-visible API base; defaults to `http://localhost:5000/api` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google sign-in | Browser-visible Google Identity Services client ID |

Values prefixed with `NEXT_PUBLIC_` are exposed to browser code and must never contain secrets.

### Scheduled jobs

Arrange an external daily caller for `POST /api/cron/daily-checkin`, for example at 00:10 Asia/Manila (16:10 UTC on the preceding calendar date). It requires `Authorization: Bearer <CRON_SECRET>`. The call records yesterday's nutrition aggregates, retries safety revalidation, and prepares eligible next-week cycles before shopping. User visits to meals or groceries also trigger preparation recovery. The repository does not install a scheduler: a running backend and a configured external caller are required for preparation to start without a user visit. Generated candidates still require the ordinary safety checks and RND review before their slots become actionable.

## Available verification commands

The ordinary repository gates can be run from the root:

```powershell
npm run check
npm run audit
npm run test:e2e
```

`npm run check` starts with a source-architecture guard. Handwritten backend and frontend modules must remain at or below 900 lines; additions that cross the boundary must first separate transport, state, policy, persistence, or presentation responsibilities.

The backend `npm test` command uses Node's built-in test runner through `tsx` and requires no live database or external service. It covers actionability, deterministic restrictions, mixed-cuisine generation, nutritionist review ownership, meal-library evidence eligibility, exact shopping-day cycles, conservative weekly adaptation, FNRI category mapping, bounded weight/list input, fail-closed ingredient matching, runtime configuration, API contracts, and user-action validation. Frontend tests use Vitest and Testing Library; Playwright covers the public landing and adversarial registration paths. `npm run test:integration:production` and acceptance scripts require an explicitly authorized disposable database target. These local checks do not establish full authenticated-browser coverage, accessibility conformance, deployment monitoring, clinical verification, or production readiness.

## Local PostgreSQL for development and defense

Use [local development and defense rehearsal](docs/LOCAL_DEVELOPMENT_AND_DEFENSE.md) to run persistent loopback-only PostgreSQL, restore a verified local archive, apply migrations to the explicitly confirmed local target and switch only the localhost API. Start the database with `npm run local-db:up`; inspect it with `npm run local-db:status`. Hosted Neon data remains separate, with no automatic synchronization. Local development consumes no Neon database quota; external providers still need their own connectivity and limits.

## Optional local Docker workflow

Docker packages the existing applications; it does not replace the Next.js/Express architecture. Create `backend/.env` first, keep provider switches disabled unless their own test is authorized, and run from the repository root:

```powershell
npm run docker:config
npm run docker:up
```

The web and API are then exposed at `http://localhost:3000` and `http://localhost:5000`. Stop them with `npm run docker:down`. Docker does not create or migrate PostgreSQL in this local Compose file; the API uses the explicitly configured `DATABASE_URL`.

Deployment is a separate, guarded workflow described in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). It requires immutable image digests, runs only `prisma migrate deploy`, binds application ports to loopback, and expects HTTPS termination through Nginx or Caddy. The older operational and clinical gates still apply.

## External integrations

| Integration | Purpose | Verification caveat |
| --- | --- | --- |
| PostgreSQL/Neon | Persistence | Disposable PostgreSQL behavior is integration-tested; shared/production state is separate |
| Google Gemini | Reports, plans, food estimates, replacements | Model/account behavior was not live-tested |
| FNRI data | Philippine food nutrition lookup | Seed/runtime matching was not executed in the baseline |
| Google OAuth | Google login/registration | Live OAuth was not tested |
| Brevo HTTPS or SMTP/Nodemailer | OTP, reset, applicant-status and invitation email | Mocked provider delivery and local capture are verified; live delivery requires provider activation and hosted testing |
| React PDF | Report and grocery PDFs | Runtime output was not tested |
| DiceBear | Browser-loaded avatars | Availability/privacy behavior was not integration-tested |

## Known incomplete or unsafe areas

Consult the engineering record for the ranked register. Important limitations include:

- Approved-meal actionability is centralized and unit-verified; controlled API/database integration now passes, while pre-policy stored grocery/log/aggregate provenance remains unverified.
- Deterministic condition/allergy handling is incomplete, especially for custom entries.
- User prerequisite gates and nutritionist verification/license checks exist in source, but the new production-readiness migration and live expiry/authorization boundaries still require deployment verification.
- Review claims and approve/reject transitions are guarded and transactional in source; concurrent PostgreSQL integration evidence is still required.
- Refresh JWTs are not robust rotating/revocable persisted sessions.
- Meal logs and daily aggregates can duplicate; timestamp/provenance behavior is inconsistent.
- Nutritionists operate as internal KAINARA reviewers through a shared queue; consumer consultation hiring and assigned-patient directories are intentionally outside the product model.
- The PWA has a manifest and icons but no service worker/offline implementation.
- Grocery data lacks actionable quantities/units.
- Water tracking is local-only and not user/date scoped in backend persistence.
- The export view is not a complete user-data export.
- The backend has a growing deterministic unit/policy baseline; exact current counts and remaining TODO specifications are recorded in the latest engineering entry. No clinical review of the rules is established.

## Documentation map

- [`docs/NUTRIMIND_ENGINEERING_RECORD.md`](docs/NUTRIMIND_ENGINEERING_RECORD.md): canonical current evidence, ADRs, requirements, risks, defects, tests, and change history.
- [`docs/history/PROJECT_EVOLUTION.md`](docs/history/PROJECT_EVOLUTION.md): phase-by-phase history and preserved old prompts, plans, audits, and handoffs. Its archived decisions do not override current code.
- [`AGENTS.md`](AGENTS.md): concise working rules for agents using the shared checkout.
- Root legacy prompts, addenda, handoff guides, and system references: historical, aspirational, or partially superseded as described by their notices.

## Contribution rules

1. Inspect relevant code, schema, consumers, Git status, and the engineering record before editing.
2. Preserve unrelated modified and untracked owner work.
3. Keep changes bounded and update tests, types, and contracts together.
4. Never expose secrets or personal health data.
5. Record implementation and exact verification evidence in the engineering record.
6. Do not claim runtime, deployment, or clinical success without evidence.

## Phone testing through a Cloudflare quick tunnel

Run both local servers (frontend port 3000 and backend port 5000), then run `cloudflared tunnel --url http://localhost:3000` and keep it running. Mobile browser API calls use `/api`; Next.js forwards them to the local backend, so a second tunnel for port 5000 is unnecessary.

Add the exact HTTPS origin printed by cloudflared to `backend/.env`, preserving your localhost entries:

```dotenv
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,https://YOUR-CURRENT-HOST.trycloudflare.com
```

Use only the origin, without `/nutritionist-apply` or a trailing path. Restart the backend after changing this setting. Quick-tunnel addresses can change when cloudflared restarts; update this entry to match. A Cloudflare tunnel error means the public tunnel is unavailable; an `ORIGIN_NOT_ALLOWED` API response means its origin has not been configured. Do not enable all Cloudflare origins or strip browser Origin headers to bypass this check. Local environment files must not be committed.
