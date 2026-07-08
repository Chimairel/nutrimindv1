# NutriMind System Reference for SPMP and SRS Drafting

Last prepared: 2026-07-08

This document summarizes the current NutriMind codebase and implementation state. It is intended as a reference input for generating Software Project Management Plan (SPMP) and Software Requirements Specification (SRS) documents.

Important context: the original `NUTRIMIND_MASTER_PROMPT.md` was used as the audit baseline, but the project has changed since that prompt was written. Some differences are intentional scope changes or later addenda, not necessarily defects. Treat this file as a snapshot of the implemented system, current progress, and known gaps.

## 1. System Overview

NutriMind is an AI-assisted nutrition and meal planning web application for health-conscious young urban Filipinos. The system generates meal plans, produces nutrition reports, tracks meal logs and progress, manages grocery lists, and supports Registered Nutritionist-Dietitian review workflows.

The application is implemented as two separate projects:

- `nutrimind-backend`: Express.js API server using TypeScript, Prisma ORM, PostgreSQL, JWT authentication, Google Gemini integration, FNRI food data, and React-PDF generation.
- `nutrimind-frontend`: Next.js 14 App Router application using TypeScript, Tailwind CSS, Axios, Radix UI primitives, and client-side route guarding.

The backend and frontend communicate over HTTP through an Axios instance configured with `NEXT_PUBLIC_API_URL`.

## 2. Primary User Roles

The system currently supports three roles:

- `USER`: Standard end user who completes onboarding, receives nutrition reports, generates meal plans, logs meals, views grocery lists, tracks progress, and browses nutritionists.
- `NUTRITIONIST`: Reviews AI-generated meal plans, approves or rejects meals, manages verified meal library entries, and maintains a nutritionist profile.
- `ADMIN`: Manages users, verifies nutritionists, and views platform analytics.

## 3. Current Technology Stack

Backend:

- Node.js
- Express.js
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT via `jsonwebtoken`
- Password hashing via `bcryptjs`
- Google Gemini via `@google/generative-ai`
- Google OAuth verification via `google-auth-library`
- Nodemailer for email verification and password reset
- React-PDF for report and grocery PDF generation
- Express Validator for request validation
- Helmet and CORS for baseline HTTP security
- Express Rate Limit for general and auth rate limiting

Frontend:

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Axios
- Radix UI primitives
- Lucide React icons
- JWT decode helper
- Google Fonts through Next font

## 4. High-Level Architecture

The architecture is a two-project web application:

1. The frontend renders user, nutritionist, admin, onboarding, auth, and reporting interfaces.
2. The frontend sends API requests through `src/lib/axios.ts`.
3. The backend routes requests to controller and service logic.
4. Prisma handles database access to PostgreSQL.
5. Gemini is used for nutrition report generation, meal plan generation, health validation, food estimation, outside meal estimation, and replacement meal generation.
6. FNRI food records are stored in the database and used as the preferred nutrition source before Gemini estimates are used.
7. PDFs are generated server-side and streamed to the client.

## 5. Current Backend Structure

Main backend folders:

- `src/controllers`: Request/response controllers for auth, users, meals, grocery, progress.
- `src/routes`: Express route definitions for auth, users, meals, grocery, nutritionist, admin, FNRI, cron, progress.
- `src/services`: Business logic for auth, users, nutrition reports, meal generation, meal logs, meal swaps, groceries, notifications, cron, check-ins, nutritionist workflows, admin workflows, progress, health validation.
- `src/lib`: Shared utilities for Prisma, JWT, Gemini, FNRI lookup, calculations, email, PDF generation.
- `src/middleware`: Auth, RBAC, validation, rate limiting.
- `prisma`: Prisma schema, migrations, seed scripts, and FNRI CSV data.

The backend follows the intended controller/service separation in many areas, but some route files still contain inline request handling logic.

## 6. Current Frontend Structure

Main frontend areas:

- `src/app/(auth)`: Login, registration, email verification, forgot password, reset password.
- `src/app/(onboarding)`: Stats, preferences, conditions, allergies, shopping day, terms of service.
- `src/app/(user)`: Dashboard, meal plan, grocery, profile, progress, export, nutritionist directory, meal detail.
- `src/app/(nutritionist)`: Reviews, approved plans, patients, library, profile.
- `src/app/(admin)`: Overview, users, nutritionists, analytics.
- `src/components/ui`: Reusable UI primitives such as Button, Card, Badge, Input, Modal, Tabs, Progress, Checkbox, Avatar, Sidebar, BottomNav.
- `src/components/shared`: Navbar, RouteGuard, LoadingSpinner, EmptyState, ErrorBoundary, NotificationDropdown.
- `src/components/user`: MealCard, CalorieRing, CheckinModal.
- `src/hooks`: Auth, profile, meals, notifications hooks.
- `src/lib`: Axios instance, auth helpers, AuthContext, ThemeContext.

## 7. Authentication and Authorization State

Implemented behavior:

- Email/password registration and login.
- Password hashing with bcrypt.
- JWT access token and refresh token generation.
- Refresh token endpoint.
- Google sign-in support through Google ID token verification.
- Email verification with OTP.
- Password reset flow using hashed reset tokens.
- Role-based middleware for user, nutritionist, and admin route groups.
- Frontend route guard that checks logged-in state, email verification, role, onboarding, ToS, and report acknowledgement.

Important current limitation:

- Tokens are currently returned in API JSON responses and stored in JavaScript-readable browser cookies through `document.cookie`.
- The original prompt expected JWTs in httpOnly cookies.
- Backend `Session` records exist in the schema, and logout deletes sessions, but the current auth flow does not appear to create session rows.

This is a key security and architecture decision that should be clarified before writing final SRS/SPMP security requirements.

## 8. Core Data Model Snapshot

The original master prompt described exactly 20 tables. The current schema has expanded beyond that because of later project changes. Current important models include:

- `User`
- `Account`
- `Session`
- `UserProfile`
- `HealthCondition`
- `Allergy`
- `NutritionReport`
- `NutritionistProfile`
- `FoodItem`
- `FoodAlias`
- `MealPlan`
- `MealLibrary`
- `MealIngredient`
- `MealLog`
- `WeightLog`
- `DailyNutritionLog`
- `GroceryList`
- `GroceryItem`
- `Notification`
- `MealLibraryFlag`
- `PlanSwapTracker`
- `SwapLog`

Important implemented enum extensions include:

- `MealLogSource`: includes `SYSTEM_GENERATED`, `USER_LOGGED`, `USER_SWAPPED`, `SAFETY_REPLACED`.
- `NotificationType`: includes original notification types plus flag-related types.
- `MealIngredientDataSource`: distinguishes FNRI-sourced and Gemini-estimated ingredients.
- `ShoppingDayGroup`: supports weekend and weekday meal plan cycles.
- `PlanType`: supports starter and weekly plans.

## 9. Implemented Backend API Areas

Auth routes:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

User routes:

- `GET /api/user/profile`
- `PUT /api/user/profile/avatar`
- `POST /api/user/onboarding/profile`
- `GET /api/user/onboarding/suggestions`
- `POST /api/user/onboarding/conditions`
- `POST /api/user/onboarding/allergies`
- `POST /api/user/onboarding/shopping-day`
- `POST /api/user/onboarding/tos`
- `POST /api/user/onboarding/complete`
- `GET /api/user/nutrition-report`
- `GET /api/user/nutrition-report/pdf`
- `POST /api/user/nutrition-report/generate`
- `POST /api/user/nutrition-report/acknowledge`
- `PUT /api/user/profile`
- `PUT /api/user/profile/conditions`
- `PUT /api/user/profile/allergies`
- `PUT /api/user/profile/settings`
- `GET /api/user/notifications`
- `PATCH /api/user/notifications/:id/read`
- `GET /api/user/weight-log`
- `POST /api/user/weight-log`
- `GET /api/user/checkin/status`
- `POST /api/user/checkin/submit`

Meal routes:

- `POST /api/user/meals/generate`
- `GET /api/user/meals/current`
- `GET /api/user/meals/history`
- `POST /api/user/meals/log-outside`
- `PATCH /api/user/meals/:id/status`
- `GET /api/user/meals/compatible-library`
- `GET /api/user/meals/:id`
- `GET /api/user/meals/:id/swap-options`
- `GET /api/user/meals/:id/swap-preview`
- `POST /api/user/meals/:id/swap`

Grocery routes:

- `POST /api/user/grocery/generate`
- `GET /api/user/grocery/current`
- `GET /api/user/grocery/pdf`
- `PATCH /api/user/grocery/items/:id/toggle`

Nutritionist routes:

- `GET /api/nutritionist/queue`
- `GET /api/nutritionist/queue/:id`
- `PATCH /api/nutritionist/review/:id`
- `GET /api/nutritionist/library`
- `GET /api/nutritionist/library/:id`
- `PATCH /api/nutritionist/library/:id`
- `DELETE /api/nutritionist/library/:id`
- `POST /api/nutritionist/library/:id/flag`
- `PATCH /api/nutritionist/library/:id/resolve-flag`
- `GET /api/nutritionist/approved`
- `GET /api/nutritionist/profile`
- `PATCH /api/nutritionist/profile`

Admin routes:

- `GET /api/admin/analytics`
- `GET /api/admin/users`
- `GET /api/admin/nutritionists`
- `PATCH /api/admin/nutritionists/:id/verify`

FNRI routes:

- `GET /api/fnri/lookup`

Cron routes:

- `POST /api/cron/daily-checkin`
- `POST /api/cron/weekly-checkin-weekend`
- `POST /api/cron/weekly-checkin-weekday`

Progress routes:

- `POST /api/user/progress/weight`
- `GET /api/user/progress/history`

## 10. Core Functional Workflows

### 10.1 User Registration and Login

The user registers with name, email, and password. The backend hashes the password, creates the user, sends an email OTP, and returns JWT tokens. Login verifies credentials and returns tokens.

The frontend stores tokens in browser cookies, updates `AuthContext`, fetches the user profile, then redirects based on role and completion status.

### 10.2 Email Verification

The backend generates a six-digit OTP, stores its bcrypt hash and expiry, and sends the OTP by email. Verification compares the entered OTP with the stored hash and marks `emailVerified` true.

### 10.3 Onboarding

Standard users complete onboarding across stats, preferences, clinical conditions, allergies, shopping day, and ToS. The backend stores profile details, health conditions, allergies, custom free-text condition/allergy inputs, shopping day preference, ToS acceptance, and calculated calorie target.

The calorie target is based on Mifflin-St Jeor and activity multipliers, with adjustments by goal.

### 10.4 Nutrition Report

The nutrition report is generated using Gemini. The service fetches the live user profile, conditions, allergies, and FNRI subset, then asks Gemini for strict JSON. The result is stored in `NutritionReport`, and acknowledgement is tracked with `acknowledgedAt`.

The frontend prevents normal dashboard access until the report is acknowledged.

### 10.5 Meal Plan Generation

Current generation has evolved beyond the original prompt:

1. The system checks the user's shopping day preference.
2. It may generate a `STARTER` plan if the user is between weekly cycle boundaries.
3. It checks verified `MealLibrary` entries for compatible meals.
4. Missing slots are generated through Gemini.
5. Ingredients are resolved through FNRI lookup, alias lookup, fuzzy lookup, or Gemini estimation.
6. Meals receive confidence flags:
   - `SAFE`
   - `CAUTION`
   - `NEEDS_REVIEW`
7. Existing active or pending plans are cancelled.
8. A new plan group and swap tracker are created.
9. Meal plan records and ingredients are saved.
10. Notifications are created when review is needed.

### 10.6 Meal Logging

Users can mark planned meals as `DONE`, `SKIPPED`, or `PENDING`. Planned meal logs are saved with system-generated source.

Users can also log outside meals. Gemini estimates nutrition and ingredients, then the system checks:

- allergy conflicts
- health condition conflicts
- daily calorie target exceedance

If warnings exist and are not acknowledged, the API returns a warning payload without saving. If acknowledged, the log is saved.

### 10.7 Meal Swap

The system supports meal swaps using compatible verified MealLibrary entries. It tracks swaps per plan through `PlanSwapTracker` and `SwapLog`. Swap previews can warn about calorie differences. Safety replacements can happen when user conditions or allergies are updated.

### 10.8 Grocery List

The grocery service aggregates ingredients from the active meal plan, normalizes categories, removes duplicates, and saves a grocery list. Users can toggle item completion and download a grocery PDF.

### 10.9 Progress and Check-In

Users can log weight and view progress data. The check-in service tracks last check-in date and check-in streak. A check-in can indicate whether user details changed and can trigger profile updates and meal regeneration through the frontend flow.

Current limitation: missed-check-in streak logic is not fully implemented. Successful check-ins increment streak, but the system does not clearly decrement or count missed check-ins.

### 10.10 Nutritionist Review

Nutritionists can view a review queue, open detailed meal cards, claim meals temporarily, inspect warnings, approve meals, reject meals, manage MealLibrary entries, flag library meals, and resolve flags.

Approval:

- marks meal approved
- links nutritionist
- saves meal to MealLibrary
- increments nutritionist verified count
- notifies the user

Rejection:

- marks the original meal rejected
- records note
- notifies the user
- attempts Gemini regeneration for that specific meal

### 10.11 Admin Workflows

Admins can:

- view analytics
- list users
- list nutritionists
- verify nutritionists

The planned admin library seed endpoint is not currently implemented.

## 11. Current Frontend Feature Coverage

Implemented or present pages include:

Auth:

- Login
- Register
- Verify email
- Forgot password
- Reset password

Onboarding:

- Stats
- Preferences
- Conditions
- Allergies
- Shopping day
- Terms of Service

User:

- Dashboard
- Meal plan
- Meal detail
- Grocery
- Profile
- Progress
- Export
- Nutritionist directory
- Nutrition report

Nutritionist:

- Reviews
- Approved plans
- Patients page
- Library
- Profile

Admin:

- Overview
- Users
- Nutritionists
- Analytics

Important current frontend/backend mismatches:

- User nutritionist directory calls `GET /api/user/nutritionists`, but that backend route is not implemented.
- Nutritionist patients page calls `GET /api/nutritionist/patients`, but that backend route is not implemented.
- A reusable `useMeals` hook calls `GET /api/user/meals`, but the backend exposes `GET /api/user/meals/current`.

## 12. Current Verification Results

Recent static verification results:

- Backend TypeScript check passed with `npx tsc --noEmit --incremental false`.
- Frontend TypeScript check passed with `npx tsc --noEmit --incremental false`.
- Frontend lint passed, but with warnings.

Frontend lint warnings included:

- unused imports
- `any` usage
- missing React hook dependencies
- unescaped apostrophes
- use of raw `img` instead of Next `Image`

No full runtime smoke test, database migration run, seed run, or end-to-end browser test was performed during the audit.

## 13. Current Progress by Phase

Phase 1: Mostly complete.

- Backend and frontend are scaffolded.
- Next.js 14 is used.
- Turbopack is not enabled.
- Basic backend app and health endpoint exist.

Phase 2: Implemented but expanded beyond original specification.

- Prisma schema exists.
- Migrations exist.
- FNRI CSV exists.
- Schema has more than the original 20 tables because of later feature changes.

Phase 3: Mostly implemented.

- JWT helpers, auth middleware, RBAC, validators, auth routes, and auth service exist.
- Important difference: original prompt expected httpOnly cookie auth; current implementation uses frontend-readable cookies and Authorization headers.

Phase 4: Mostly implemented.

- Axios, AuthContext, RouteGuard, shared UI components, layout components, and design system files exist.

Phase 5: Implemented and extended.

- Auth pages exist.
- Onboarding exists.
- Nutrition report exists.
- Email verification and password reset were added beyond the initial phase description.

Phase 6: Mostly implemented.

- Gemini integration exists.
- FNRI lookup chain exists.
- Nutrition report uses Gemini.
- Meal generation uses Gemini and FNRI lookup.
- `POST /api/fnri/import` is not implemented.

Phase 7: Mostly implemented and extended.

- Meal generation, current plan, history, outside meal logging, and status updates exist.
- Meal swaps and meal details are added.

Phase 8: Partially implemented.

- Grocery, profile, progress, notifications, PDF generation, and check-in exist.
- Some route names differ from original prompt.
- Cron exists but behavior differs from original prompt.

Phase 9: Partially implemented.

- Nutritionist review queue, approval/rejection, approved plans, library management, and profile exist.
- Admin users, nutritionists, analytics, and verification exist.
- Missing or incomplete: nutritionist patients endpoint, admin library seed endpoint, possibly assigned-patient prioritization depending on updated scope.

Phase 10: Partially implemented.

- Manifest and icons exist.
- PWA service worker/`next-pwa` setup is not complete.
- No `vercel.json` cron configuration was observed during the audit.

## 14. Known Gaps and Risks

Security and auth:

- JWTs are stored in JavaScript-readable cookies rather than httpOnly cookies.
- Refresh token handling is not backed by persistent sessions.
- Several API responses return raw `error.message`.
- AI-heavy endpoints have a defined Gemini limiter but do not appear to apply it to generation routes.

API and frontend contract:

- Some frontend pages call missing backend routes.
- Some route paths differ from the master prompt.
- Frontend shared types are behind backend enum extensions.

Cron and check-in:

- Weekly cron route names differ from the original prompt.
- Weekly cron currently regenerates plans broadly, instead of only after missed check-in rules.
- Missed-check-in tracking is not fully represented in current check-in logic.

Project documentation:

- `.env.example` does not document all environment variables used by implemented code, including SMTP, Google OAuth client ID, and frontend URL.
- The master prompt is outdated relative to current schema and feature additions.
- Addenda and current implementation should be reconciled into a new authoritative specification.

PWA and deployment:

- Manifest exists, but full PWA/service worker setup is incomplete.
- Deployment configuration and cron schedules are not finalized.

Testing:

- TypeScript checks pass.
- No automated backend test suite was observed.
- No automated frontend component or E2E test suite was observed.
- No recent verified database migration/seed run was performed during the audit.

## 15. Suggested SRS Content Inputs

Potential SRS sections based on current system:

- Purpose and scope
- Product perspective
- Product functions
- User classes and characteristics
- Operating environment
- Design and implementation constraints
- Assumptions and dependencies
- Functional requirements by role
- External interface requirements
- API requirements
- Data requirements
- Security requirements
- Privacy and legal disclaimer requirements
- Performance requirements
- Reliability and availability requirements
- Maintainability requirements
- Traceability matrix by feature

Suggested functional requirements:

- The system shall allow users to register and log in.
- The system shall require email verification before full access.
- The system shall require onboarding before dashboard access.
- The system shall calculate calorie targets based on user profile.
- The system shall generate nutrition reports using AI and user clinical context.
- The system shall require acknowledgement of nutrition reports before dashboard access.
- The system shall generate meal plans from verified library meals and AI-generated meals.
- The system shall classify meal confidence using FNRI and Gemini source data.
- The system shall allow users to log planned and outside meals.
- The system shall warn users about allergy, condition, and calorie conflicts.
- The system shall generate grocery lists from active meal plans.
- The system shall allow users to log weight and view progress.
- The system shall allow nutritionists to review, approve, reject, and manage meals.
- The system shall allow admins to manage users and verify nutritionists.
- The system shall send notifications for review, approval, rejection, check-ins, and flagged meals.

## 16. Suggested SPMP Content Inputs

Potential SPMP sections based on current system:

- Project overview
- Project organization
- Roles and responsibilities
- Development process
- Milestones and deliverables
- Work breakdown structure
- Schedule by phase
- Risk management
- Quality assurance plan
- Configuration management
- Communication plan
- Tools and infrastructure
- Deployment plan
- Maintenance plan

Suggested current milestone state:

- Backend and frontend foundation: substantially complete.
- Authentication and onboarding: implemented, but auth storage design needs decision.
- AI nutrition report and meal generation: implemented.
- User meal dashboard, grocery, progress: implemented or partially implemented.
- Nutritionist and admin portals: partially implemented.
- PWA/deployment readiness: incomplete.
- Documentation/spec alignment: needs update.

## 17. Recommended Next Documentation Step

Before producing final SPMP and SRS documents, create an updated authoritative master prompt/spec that decides:

1. Whether auth will remain bearer-token based or move to true httpOnly cookies.
2. Whether expanded schema models such as swaps, flags, shopping cycles, and starter plans are official.
3. Whether current cron route names and behavior are official.
4. Whether missing routes should be implemented or related frontend pages removed.
5. Whether the project scope includes PWA deployment in the current academic deliverable.
6. Which features are production requirements versus prototype/demo requirements.

Once those decisions are made, this reference can be converted into polished SPMP and SRS documents.
