# NutriMind

NutriMind is a Philippines-focused nutrition and meal-planning capstone application with separate user, internal nutritionist, and administrator experiences. Its plans mix accessible general meals, Filipino food, locally available international food, and appropriate convenience options instead of restricting users to Filipino dishes.

> **Current evidence source:** [`docs/NUTRIMIND_ENGINEERING_RECORD.md`](docs/NUTRIMIND_ENGINEERING_RECORD.md) is the canonical record for implemented behavior, verification level, accepted decisions, known defects, and risks. Older prompts, addenda, handoff notes, and system references are historical or aspirational unless the engineering record confirms their claims.

Operational deployment uses [`docs/PRODUCTION_OPERATIONS_RUNBOOK.md`](docs/PRODUCTION_OPERATIONS_RUNBOOK.md). Public production startup remains gated on the qualified sign-off recorded in [`docs/CLINICAL_POLICY_APPROVAL.md`](docs/CLINICAL_POLICY_APPROVAL.md).

## Current verification status

The repository contains substantial frontend and backend implementation. As of August 31, 2026:

- Backend TypeScript no-emit check and production build: **passed**
- Frontend TypeScript no-emit check and production build: **passed**
- Prisma schema validation: **passed**
- Frontend lint: **passed with zero warnings**
- Backend deterministic unit/policy baseline: **138 pass, 0 fail, 1 external-clinical TODO**
- Controlled API/database integration smoke suite: **passed against the configured PostgreSQL database**
- Authenticated browser smoke coverage: **passed for user, nutritionist, and administrator route groups**
- Repository CI configuration: **present; remote execution is not established by local evidence**
- All 14 additive database migrations: **deployed; Prisma reports the database schema up to date**
- Controlled production integration and local readiness/load smokes: **passed**
- Clinical review: **not established**

Use these status terms: Planned, Designed, Partially implemented, Implemented but unverified, Statically verified, Integration tested, End-to-end tested, Deployed, and Clinically reviewed.

## Architecture

The accepted architecture is:

```text
Next.js 14 frontend
  -> Axios REST requests with a bearer access token
  -> Express/TypeScript backend
  -> Prisma ORM
  -> PostgreSQL/Neon
```

Authentication uses custom short-lived access JWTs and refresh JWT cookies. The project does not use NextAuth, and the Express backend must not be merged into Next.js without a separately approved architecture change.

Weekly plan-cycle and shopping-day behavior uses `Asia/Manila`. Some older daily logging/aggregation paths still use server-local date operations and remain tracked for hardening.

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
| `docs/` | Canonical engineering evidence and cleanup planning |
| `codex/` | Current coding-agent operating and cleanup instructions |

The intended backend layering is route -> validation/policy -> controller -> service -> Prisma/external integration. The current implementation does not enforce this boundary strictly.

## Prerequisites

- Node.js 24 and npm, as pinned by the root `.nvmrc` and used by repository CI.
- A PostgreSQL database for backend persistence.
- Environment values for the integrations you intend to exercise.

Do not commit `.env` or `.env.local` files. Never put real credentials in documentation, screenshots, fixtures, or logs.

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

The ordinary `npm run seed:meal-library` command connects to the configured database for a read-only preflight, while `npm run seed:meal-library -- --apply` writes and certifies managed catalogue records. Both database-backed modes require explicit authorization for the configured target.

Migrations and seeds modify database state. Confirm the database target and authorization first. Do not use production-like data for development or tests.

## Frontend setup

In a second terminal:

```powershell
Set-Location frontend
npm install
npm run dev
```

The frontend defaults to `http://localhost:3000`. Axios defaults to `http://localhost:5000/api` when `NEXT_PUBLIC_API_URL` is absent.

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
| `FRONTEND_URL` | Password-reset email links | Frontend base URL in email; defaults to `http://localhost:3000` |
| `CORS_ORIGINS` | Browser API access | Comma-separated credentialed browser origins; required explicitly in production |
| `GOOGLE_CLIENT_ID` | Google sign-in | Expected audience for backend Google ID-token verification |
| `SMTP_HOST` | Email delivery | SMTP hostname; code defaults to Gmail SMTP |
| `SMTP_PORT` | Email delivery | SMTP port; code defaults to `587` |
| `SMTP_USER` | Email delivery | SMTP account username |
| `SMTP_PASS` | Email delivery | SMTP account password or app password |
| `EMAIL_FROM` | Optional sender override | From address; falls back to `SMTP_USER`, then a placeholder |
| `SMTP_VERIFY_ON_STARTUP` | Optional startup diagnostics | Set to `true` only when API startup should open an SMTP connection; defaults to disabled |

### Frontend: `frontend/.env.local`

| Name | Required when | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Non-default backend URL | Browser-visible API base; defaults to `http://localhost:5000/api` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google sign-in | Browser-visible Google Identity Services client ID |

Values prefixed with `NEXT_PUBLIC_` are exposed to browser code and must never contain secrets.

### Scheduled jobs

Call `POST /api/cron/daily-checkin` once per day for daily nutrition aggregates and `POST /api/cron/weekly-plan-preparation` once per day for upcoming meal plans. Both require `Authorization: Bearer <CRON_SECRET>`. The weekly scheduler evaluates each user's exact grocery-shopping day in `Asia/Manila`, prepares the next cycle three days ahead, catches up a missed run within the preparation window, and relies on a durable per-user/per-cycle generation key to prevent duplicate plans. The two older shopping-group weekly endpoints remain compatibility wrappers only and should not be configured for new deployments.

## Available verification commands

These checks passed during the August 30, 2026 verification:

```powershell
# Backend
Set-Location backend
npm test
npm run test:integration:production
npx tsc --noEmit --incremental false
npx prisma validate

# Frontend
Set-Location ..\frontend
npx tsc --noEmit --incremental false
npm run lint
npm run build
```

The backend `npm test` command uses Node's built-in test runner through the existing `tsx` dependency and requires no live database or external service. It covers actionability, deterministic restrictions, mixed-cuisine generation, nutritionist review ownership, meal-library evidence eligibility, exact shopping-day cycles, conservative weekly adaptation, FNRI category mapping, and fail-closed ingredient matching. `npm run test:integration:production` uses temporary reserved-domain fixtures against the configured PostgreSQL database, verifies refresh-token rotation, evidence certification/invalidation, weekly check-in idempotency, and generation-job contention, then removes its fixtures. The frontend has no automated component test script. Repository CI installs both packages, runs the backend tests/build, and runs frontend lint/build. These checks do not establish live Gemini generation, accessibility, load behavior, deployment monitoring, or clinical verification.

## External integrations

| Integration | Purpose | Verification caveat |
| --- | --- | --- |
| PostgreSQL/Neon | Persistence | Live database behavior was not baseline-tested |
| Google Gemini | Reports, plans, food estimates, replacements | Model/account behavior was not live-tested |
| FNRI data | Philippine food nutrition lookup | Seed/runtime matching was not executed in the baseline |
| Google OAuth | Google login/registration | Live OAuth was not tested |
| SMTP/Nodemailer | OTP and reset email | Live delivery was not tested |
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
- Nutritionists operate as internal NutriMind reviewers through a shared queue; consumer consultation hiring and assigned-patient directories are intentionally outside the product model.
- The PWA has a manifest and icons but no service worker/offline implementation.
- Grocery data lacks actionable quantities/units.
- Water tracking is local-only and not user/date scoped in backend persistence.
- The export view is not a complete user-data export.
- The backend has a growing deterministic unit/policy baseline; exact current counts and remaining TODO specifications are recorded in the latest engineering entry. No clinical review of the rules is established.

## Documentation map

- [`docs/NUTRIMIND_ENGINEERING_RECORD.md`](docs/NUTRIMIND_ENGINEERING_RECORD.md): canonical current evidence, ADRs, requirements, risks, defects, tests, and change history.
- [`docs/NUTRIMIND_CLEANUP_PLAN.md`](docs/NUTRIMIND_CLEANUP_PLAN.md): completed Batches 1, 2A, and 3 plus proposed future cleanup batches.
- [`chatgptcontext.md`](chatgptcontext.md): August 19 audit snapshot; useful context but not the canonical living record.
- Root legacy prompts, addenda, handoff guides, and system references: historical, aspirational, or partially superseded as described by their notices.

## Contribution rules

1. Inspect relevant code, schema, consumers, Git status, and the engineering record before editing.
2. Preserve unrelated modified and untracked owner work.
3. Keep changes bounded and update tests, types, and contracts together.
4. Never expose secrets or personal health data.
5. Record implementation and exact verification evidence in the engineering record.
6. Do not claim runtime, deployment, or clinical success without evidence.
