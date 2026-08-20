# NutriMind

NutriMind is a Filipino-focused nutrition and meal-planning capstone application with separate user, nutritionist, and administrator experiences.

> **Current evidence source:** [`docs/NUTRIMIND_ENGINEERING_RECORD.md`](docs/NUTRIMIND_ENGINEERING_RECORD.md) is the canonical record for implemented behavior, verification level, accepted decisions, known defects, and risks. Older prompts, addenda, handoff notes, and system references are historical or aspirational unless the engineering record confirms their claims.

## Current verification status

The repository contains substantial frontend and backend implementation. As of August 19, 2026:

- Backend TypeScript no-emit check: **passed**
- Frontend TypeScript no-emit check: **passed**
- Prisma schema validation: **passed**
- Frontend lint: **passed with warnings**
- Backend deterministic unit/policy baseline: **28 passed, 0 failed; 7 critical-behavior specifications remain TODO**
- API/database integration and E2E tests: **not present**
- Repository CI configuration: **not present**
- Runtime, deployment, and external-service verification: **not established by current repository evidence**
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

Business-date behavior is intended to use `Asia/Manila`. Existing server-local date behavior has not yet been fully migrated or tested against that decision.

## Repository layout

| Path | Responsibility |
| --- | --- |
| `nutrimind-frontend/` | Next.js UI for public, onboarding, user, nutritionist, and admin routes |
| `nutrimind-frontend/src/app/` | Route groups, layouts, and pages |
| `nutrimind-frontend/src/components/` | Shared, UI, auth, and user-facing React components |
| `nutrimind-frontend/src/lib/` | Axios, client auth helpers, and React contexts |
| `nutrimind-backend/` | Express REST API and business services |
| `nutrimind-backend/src/routes/` | API route definitions and middleware composition |
| `nutrimind-backend/src/controllers/` | HTTP handlers; some currently contain direct Prisma access |
| `nutrimind-backend/src/services/` | Auth, plans, logs, groceries, review, progress, notifications, and job logic |
| `nutrimind-backend/src/lib/` | Prisma, JWT, Gemini, FNRI, email, PDF, and calculation helpers |
| `nutrimind-backend/prisma/schema.prisma` | Current Prisma data model |
| `nutrimind-backend/prisma/migrations/` | Database migration history |
| `nutrimind-backend/prisma/data/fnri.csv` | FNRI data used by the seed script |
| `docs/` | Canonical engineering evidence and cleanup planning |
| `codex/` | Current coding-agent operating and cleanup instructions |

The intended backend layering is route -> validation/policy -> controller -> service -> Prisma/external integration. The current implementation does not enforce this boundary strictly.

## Prerequisites

- Node.js and npm compatible with Next.js 14, Prisma 5, and the installed lockfiles. The repository does not pin a Node version.
- A PostgreSQL database for backend persistence.
- Environment values for the integrations you intend to exercise.

Do not commit `.env` or `.env.local` files. Never put real credentials in documentation, screenshots, fixtures, or logs.

## Backend setup

From the repository root:

```powershell
Set-Location nutrimind-backend
npm install
npx prisma generate
npm run dev
```

The development server defaults to `http://localhost:5000`; `GET /health` is the basic health endpoint.

Before startup, create `nutrimind-backend/.env` from the available example and supply the required values. The example does not contain every currently used variable, so use the name inventory below.

### Prisma/database workflow

Validate the schema without changing it:

```powershell
Set-Location nutrimind-backend
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

Migrations and seeds modify database state. Confirm the database target and authorization first. Do not use production-like data for development or tests.

## Frontend setup

In a second terminal:

```powershell
Set-Location nutrimind-frontend
npm install
npm run dev
```

The frontend defaults to `http://localhost:3000`. Axios defaults to `http://localhost:5000/api` when `NEXT_PUBLIC_API_URL` is absent.

The backend currently permits credentialed CORS requests from `http://localhost:3000` and `http://localhost:3001`. `FRONTEND_URL` is used for email links but is not currently the backend CORS source of truth.

## Environment-variable reference

Only names and purposes are documented. No real values are included.

### Backend: `nutrimind-backend/.env`

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
| `GOOGLE_CLIENT_ID` | Google sign-in | Expected audience for backend Google ID-token verification |
| `SMTP_HOST` | Email delivery | SMTP hostname; code defaults to Gmail SMTP |
| `SMTP_PORT` | Email delivery | SMTP port; code defaults to `587` |
| `SMTP_USER` | Email delivery | SMTP account username |
| `SMTP_PASS` | Email delivery | SMTP account password or app password |
| `EMAIL_FROM` | Optional sender override | From address; falls back to `SMTP_USER`, then a placeholder |

### Frontend: `nutrimind-frontend/.env.local`

| Name | Required when | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Non-default backend URL | Browser-visible API base; defaults to `http://localhost:5000/api` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google sign-in | Browser-visible Google Identity Services client ID |

Values prefixed with `NEXT_PUBLIC_` are exposed to browser code and must never contain secrets.

## Available verification commands

These checks passed during the August 19, 2026 baseline:

```powershell
# Backend
Set-Location nutrimind-backend
npm test
npx tsc --noEmit --incremental false
npx prisma validate

# Frontend
Set-Location ..\nutrimind-frontend
npx tsc --noEmit --incremental false
npm run lint
```

The backend `npm test` command uses Node's built-in test runner through the existing `tsx` dependency and requires no live database or external service. TEST-013/014 verify approved-meal actionability; TEST-015/016 verify the deterministic restriction policy; TEST-027/028 verify the meal-generation library compatibility adapter and isolated fallback seam. The current result is 91 registered tests: 86 pass, 0 fail, 0 skipped, and 5 TODO. The frontend has no automated test script, and no repository CI workflow was found. Unit/static checks do not establish API/database integration, live generation, E2E, deployment, accessibility, or clinical verification.

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

- Approved-meal actionability is now centralized and unit-verified, but live API/database integration and pre-policy stored grocery/log/aggregate provenance remain unverified.
- Deterministic condition/allergy handling is incomplete, especially for custom entries.
- Backend prerequisite gates and nutritionist verification/license policies are incomplete.
- Review claims and related state changes are not fully race-safe or transactional.
- Refresh JWTs are not robust rotating/revocable persisted sessions.
- Meal logs and daily aggregates can duplicate; timestamp/provenance behavior is inconsistent.
- Frontend pages call missing `/api/user/nutritionists` and `/api/nutritionist/patients` endpoints.
- `useMeals` calls stale `GET /api/user/meals` instead of the implemented `/current` route.
- The PWA has a manifest and icons but no service worker/offline implementation.
- Grocery data lacks actionable quantities/units.
- Water tracking is local-only and not user/date scoped in backend persistence.
- The export view is not a complete user-data export.
- The backend has a deterministic unit/policy baseline; 7 critical specifications remain TODO, and no CI, repository deployment setup, or clinical-review evidence is present.

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
