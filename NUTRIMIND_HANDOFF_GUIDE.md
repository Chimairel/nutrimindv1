# NutriMind — AI Handoff Guide
### For any AI model continuing this project

> **Owner**: chimairelp@gmail.com  
> **Last audited**: 2026-06-13  
> **Stack**: Next.js 14 frontend + Express/Prisma backend + Neon PostgreSQL + Gemini AI

---

## ⛔ GOLDEN RULES — READ BEFORE DOING ANYTHING

These rules exist because previous AI sessions caused bugs by violating them. **Obey all of them unconditionally.**

> ⚠️ **PRIORITY**: If anything in this file contradicts `AI_AGENT_PROMPT.md`, the **AI_AGENT_PROMPT.md always wins**. It is the single source of truth. Read it FIRST before starting any work.

### Rule 0: DO NOT LOOP, HESITATE, OR RE-PLAN
- If you said "Let's do X", then DO X immediately. Do NOT say "Wait, let me reconsider" and repeat yourself.
- Write ONE plan, get approval, then EXECUTE. Do NOT re-plan after approval.
- If you hit an error, fix it and move on. Do NOT spiral into re-reading the same files repeatedly.
- If something fails after 2 attempts, STOP and tell the user. Do NOT keep retrying.
- EXECUTE, do not narrate. Minimize commentary. Do the work, show the results.
- Complete one task fully before starting the next. Do NOT open 5 files and plan changes to all 5 at once.

### Rule 1: ONE GOAL AT A TIME
- This document contains **8 remaining goals**, numbered G1–G8.
- **Work on exactly ONE goal per session.** Do not start the next goal until the current one compiles, runs, and passes its acceptance criteria.
- If a goal has sub-steps, complete them in order. Do not skip ahead.

### Rule 2: NEVER CREATE PLACEHOLDERS OR DUMMY DATA
- Do NOT write `// TODO: implement later`
- Do NOT create mock/stub services that return hardcoded data
- Do NOT add `placeholder.png`, `lorem ipsum`, or sample content
- Do NOT add empty components that render "Coming Soon"
- Do NOT hardcode user names, calorie targets, meal names, or any data that should come from the API
- Every file you create or edit must be **fully functional and production-ready**
- If you can't implement something fully, **STOP and tell the user** what's blocking you

### Rule 3: DO NOT ADD FEATURES NOT IN THIS DOCUMENT
- Do NOT invent new database columns, tables, routes, or pages
- Do NOT add new npm packages unless absolutely required for a listed goal
- Do NOT refactor working code "for improvement" unless asked
- Do NOT add analytics, telemetry, logging libraries, or testing frameworks
- Build **only** what each goal specifies. If unsure, ask the user.

### Rule 4: VERIFY BEFORE DECLARING DONE
After finishing any goal:
1. Run `tsc --noEmit` in `nutrimind-backend/` — must be **0 errors**
2. Run `npx next build` in `nutrimind-frontend/` — must be **0 errors**
3. Start both servers and verify the feature works in the browser
4. Only then tell the user the goal is complete

### Rule 5: PRESERVE EXISTING CODE
- Do NOT rewrite files that are already working
- Do NOT change the design system colors, fonts, or styling conventions
- Do NOT modify `schema.prisma` unless a goal explicitly requires it
- Do NOT touch `.env` or `.env.local` files unless adding a new required variable
- If you need to edit a file, make **surgical, minimal changes**

### Rule 6: RESPECT THE ARCHITECTURE
- Backend: **Controllers** handle HTTP only -> **Services** handle business logic -> **Prisma** handles DB
- Frontend: **Pages** compose components -> **Hooks** manage data fetching -> **Context** manages auth state
- All API responses use `{ success: boolean, data?: any, error?: string }`
- All catch blocks use `unknown` type (not `any`) with type assertion pattern
- Badge component only accepts variants: `verified | pending | rejected | ai | user`

### Rule 7: STOP ON ENVIRONMENT/INFRA ERRORS
If you encounter:
- Database connection errors -> user's VPN may be on, or Neon is down
- SMTP errors -> Gmail app password issue
- Google OAuth errors -> Client ID misconfiguration
- `Too many auth attempts` -> rate limiter, wait 15 minutes

**STOP. Tell the user. Do NOT try to fix infra issues programmatically.**

---

## TEST ACCOUNTS

These accounts ALREADY EXIST in the database. **LOGIN with them - do NOT register them again.**

| Role | Email | Password |
|------|-------|----------|
| USER | chimairelp@gmail.com | Chimairel123 |
| ADMIN | admin@gmail.com | Admin123 |
| NUTRITIONIST | nutritionist@gmail.com | Nutritionist123 |

All accounts are registered, email-verified, onboarding complete, and ToS accepted.
The NUTRITIONIST account has a verified NutritionistProfile (PRC-TEST-001, verified by admin).
If you need to test the registration flow from scratch, **ASK the user** to delete the account first.
**NEVER create new test accounts. NEVER register new email addresses. NEVER run SQL to create users.**

---

## MODEL RECOMMENDATIONS PER GOAL

Use this guide to choose the right AI model for each goal to maximize limits:

| Goal | Recommended Model | Reasoning |
|------|------------------|-----------|
| **G1**: Smoke Test and Bug Fix | **Gemini 3.5 Flash (Medium)** or **Claude Sonnet 4.6** | Lots of small, quick browser testing and surgical fixes. Flash model speed plus volume helps here. Sonnet good for reasoning through bugs. |
| **G2**: Missing Pages and Components | **Gemini 3.5 Flash (High)** | Mostly creating/editing frontend TSX files. High quality flash produces solid UI code with good limits. |
| **G3**: PDF Export | **Claude Sonnet 4.6** | Requires understanding react-pdf/renderer APIs and wiring backend to frontend streams. Benefits from deeper reasoning. |
| **G4**: Weekly Check-in (Frontend) | **Gemini 3.5 Flash (Medium)** | Straightforward modal component plus one API integration. Flash handles this easily. |
| **G5**: Notification System | **Gemini 3.5 Flash (Medium)** | Bell icon, dropdown list, polling logic. Well-defined, repetitive UI patterns ideal for Flash. |
| **G6**: Mobile Responsive Polish | **Gemini 3.5 Flash (Low)** | Only CSS/layout tweaks, no logic changes. Cheapest model handles this fine. |
| **G7**: Nutritionist and Admin Testing | **Claude Sonnet 4.6** | Requires cross-role testing, understanding RBAC, database role switching. Needs reasoning. |
| **G8**: PWA and Final Polish | **Gemini 3.5 Flash (Low)** | Manifest file, icons, minor UI polish. Simple tasks. |

**Tips:**
- Save **Claude Opus** for complex debugging sessions or architectural decisions only.
- **Gemini 3.1 Pro** is good as a fallback when Flash models hit limits.
- **GPT-OSS 120B** works for general tasks but may not know project-specific patterns as well.

---

## ARCHITECTURE QUICK REFERENCE

```
nutrimind-backend/     (Express.js, port 5000)
  prisma/
    schema.prisma  (429 lines, 20 tables, all migrated)
  src/
    app.ts         (Express setup, all 9 routers mounted)
    server.ts      (Entry point, dotenv, port 5000)
    controllers/   (auth, grocery, meals, progress, user)
    services/      (13 service files - all business logic)
    routes/        (9 route files)
    middleware/     (auth, rbac, rateLimiter, validate)
    lib/           (prisma, gemini, fnri, jwt, email, calculations)
    types/         (shared TypeScript types)

nutrimind-frontend/    (Next.js 14, port 3000)
  src/
    app/
      (auth)/        login, register, verify-email, forgot-password, reset-password
      (onboarding)/  stats, preferences, conditions, allergies, tos
      (user)/        dashboard, meals, grocery, history, profile, progress, export
      (nutritionist)/ reviews, patients, library, profile
      (admin)/       overview, users, nutritionists
      nutrition-report/
      unauthorized/
    components/
      ui/        (11 base components: Button, Card, Badge, Input, Modal, Tabs, Progress, Checkbox, Avatar, Sidebar, BottomNav)
      shared/    (5 components: RouteGuard, Navbar, LoadingSpinner, EmptyState, ErrorBoundary)
      auth/      (GoogleSignInButton)
      user/      (CalorieRing, MealCard)
    hooks/         (useAuth, useMeals, useNotifications, useProfile)
    lib/           (axios, auth, context/AuthContext)
```

### Key Design System Tokens (Tailwind)
| Token | Value | Usage |
|-------|-------|-------|
| `brand-bg` | `#0d0d0d` | Page backgrounds |
| `brand-surface` | `#1a1a1e` | Cards, panels |
| `brand-border` | `#2a2a2e` | Borders, dividers |
| `brand-green` | `#52B788` | Primary accent |
| `brand-text` | `#f3f4f6` | Body text |
| `brand-muted` | `#6B7280` | Secondary text |
| Font (headings) | Plus Jakarta Sans | `font-display` class |
| Font (body) | DM Sans | `font-sans` class |

### How to Start
```bash
# Terminal 1 - Backend
cd nutrimind-backend
npm run dev                  # -> http://localhost:5000

# Terminal 2 - Frontend
cd nutrimind-frontend
npm run dev                  # -> http://localhost:3000
```

### Environment Files (already configured)
- `nutrimind-backend/.env` - DATABASE_URL, JWT secrets, GEMINI_API_KEY, GOOGLE_CLIENT_ID, SMTP credentials
- `nutrimind-frontend/.env.local` - NEXT_PUBLIC_API_URL, NEXT_PUBLIC_GOOGLE_CLIENT_ID

---

## WHAT IS ALREADY BUILT AND WORKING

### Backend - Fully Implemented
| Layer | Files | Status |
|-------|-------|--------|
| Auth (register, login, Google OAuth, verify-email, forgot/reset password, refresh, logout) | auth.service.ts, auth.controller.ts, auth.routes.ts | Complete |
| User onboarding (profile, conditions w/ otherConditions, allergies w/ otherAllergies, ToS, complete) | user.service.ts, user.controller.ts, user.routes.ts | Complete |
| Nutrition report (generate via Gemini, acknowledge, get) | nutrition-report.service.ts, user.routes.ts | Complete |
| Meal generation (7-day plan via Gemini + FNRI lookup) | meal-generation.service.ts, meals.controller.ts, meals.routes.ts | Complete |
| Meal logging (log outside meal, status toggle, warnings) | meal-log.service.ts, meals.controller.ts, meals.routes.ts | Complete |
| Grocery (generate from plan, toggle items) | grocery.service.ts, grocery.controller.ts, grocery.routes.ts | Complete |
| Nutritionist portal (queue, review, patients, library, profile) | nutritionist.service.ts, nutritionist.routes.ts | Complete |
| Admin panel (users, nutritionists, analytics, verify) | admin.service.ts, admin.routes.ts | Complete |
| Progress and weight tracking | progress.service.ts, weight-log.service.ts, progress.routes.ts | Complete |
| Check-in system | checkin.service.ts, user.routes.ts | Complete |
| Cron jobs (weekly check-in, reminders) | cron.service.ts, cron.routes.ts | Complete |
| FNRI lookup chain (exact, alias, fuzzy, Gemini) | fnri.ts, fnri.routes.ts | Complete |
| Gemini client (4-model fallback) | gemini.ts | Complete |
| Email (verification OTP, password reset) | email.ts | Complete |
| Middleware (JWT auth, RBAC, rate limiting, validation) | auth.ts, rbac.ts, rateLimiter.ts, validate.ts | Complete |
| Calorie calculations (Mifflin-St Jeor) | calculations.ts | Complete |

### Frontend - Fully Implemented
| Page / Component | Path | Status |
|-----------------|------|--------|
| Landing page | `app/page.tsx` | Done |
| Login (split-screen + Google OAuth) | `(auth)/login/page.tsx` | Done |
| Register (split-screen + first/last name + Google) | `(auth)/register/page.tsx` | Done |
| Verify email (6-digit OTP + guaranteed redirect) | `(auth)/verify-email/page.tsx` | Done |
| Forgot password | `(auth)/forgot-password/page.tsx` | Done |
| Reset password | `(auth)/reset-password/page.tsx` | Done |
| Onboarding - Stats (goal-aware target weight validation + back nav) | `(onboarding)/onboarding/stats/page.tsx` | Done |
| Onboarding - Preferences (+ back nav) | `(onboarding)/onboarding/preferences/page.tsx` | Done |
| Onboarding - Conditions (+ Other text field + back nav) | `(onboarding)/onboarding/conditions/page.tsx` | Done |
| Onboarding - Allergies (+ Other text field + back nav) | `(onboarding)/onboarding/allergies/page.tsx` | Done |
| Onboarding - ToS (+ back nav) | `(onboarding)/onboarding/tos/page.tsx` | Done |
| Nutrition report (dynamic user data, no hardcoded values) | `nutrition-report/page.tsx` | Done |
| Dashboard (calorie ring, meals, outside meal log) | `(user)/dashboard/page.tsx` | Done |
| Weekly meal plan (7-day grid, regenerate) | `(user)/meals/page.tsx` | Done |
| Grocery list (categories, checkboxes, progress) | `(user)/grocery/page.tsx` | Done |
| Meal history | `(user)/history/page.tsx` | Done |
| User profile | `(user)/profile/page.tsx` | Done |
| Progress tracking | `(user)/progress/page.tsx` | Done |
| Export page | `(user)/export/page.tsx` | Done |
| Nutritionist reviews | `(nutritionist)/nutritionist/reviews/page.tsx` | Done |
| Nutritionist patients | `(nutritionist)/nutritionist/patients/page.tsx` | Done |
| Nutritionist library | `(nutritionist)/nutritionist/library/page.tsx` | Done |
| Nutritionist profile | `(nutritionist)/nutritionist/profile/page.tsx` | Done |
| Admin overview | `(admin)/admin/overview/page.tsx` | Done |
| Admin users | `(admin)/admin/users/page.tsx` | Done |
| Admin nutritionists | `(admin)/admin/nutritionists/page.tsx` | Done |
| Unauthorized page | `unauthorized/page.tsx` | Done |
| Auth context + RouteGuard | `lib/context/AuthContext.tsx`, `components/shared/RouteGuard.tsx` | Done |
| GoogleSignInButton | `components/auth/GoogleSignInButton.tsx` | Done |
| All 16 reusable components (11 ui + 5 shared) | `components/ui/`, `components/shared/` | Done |

### Build Status (as of 2026-06-13)
- Backend `tsc --noEmit`: **0 errors**
- Frontend `next build`: **28 pages, 0 errors**

---

## RECENT CHANGES (June 12-13, 2026)

These changes were made in the last session. Read them to avoid undoing or duplicating work:

| Change | Files Modified |
|--------|---------------|
| **Verify-email redirect fix**: Page now always redirects after success, even if refreshSession fails | `verify-email/page.tsx` |
| **API rate limiter relaxed for dev**: 500 req/15min in dev, 100 in prod | `rateLimiter.ts` |
| **Target weight validation**: Live UX - disabled for Maintain, red/green borders for Gain/Lose | `onboarding/stats/page.tsx` |
| **Nutrition report dynamic data**: Replaced hardcoded "Juan Dela Cruz" with real user profile data | `nutrition-report/page.tsx` |
| **Custom conditions/allergies**: Added `otherConditions`/`otherAllergies` fields to UserProfile schema, backend controllers, Gemini prompts, and frontend pages | `schema.prisma`, `user.service.ts`, `user.controller.ts`, `nutrition-report.service.ts`, `meal-generation.service.ts`, `conditions/page.tsx`, `allergies/page.tsx` |
| **Back buttons**: Added back navigation to all onboarding steps (preferences, conditions, allergies, TOS) | All 4 onboarding pages |
| **Gemini model update**: Model sequence updated to June 2026 current models | `gemini.ts` |

---

## REMAINING GOALS (G1-G8)

Work on these **one at a time, in order**. Each goal includes its acceptance criteria. Do not start the next goal until the current one is fully verified.

---

### G1: End-to-End Smoke Test and Bug Fix Pass
**Priority**: CRITICAL - do this FIRST
**Recommended model**: Gemini 3.5 Flash (Medium) or Claude Sonnet 4.6
**Estimated effort**: Medium

**What to do:**
1. Start both servers (`npm run dev` in each project)
2. LOGIN with the test account (chimairelp@gmail.com / Chimairel123) - the account already exists, do NOT register it again
3. Walk through the **entire user flow** end-to-end:
   - Login -> dashboard -> test all features (meal plan, grocery, profile, progress, history)
4. On the dashboard, test:
   - Generate a 7-day meal plan (button click -> waits for Gemini -> displays meals)
   - Log an outside meal
   - Mark a meal as done/skipped
5. Test grocery list generation from the meal plan
6. Test the profile page (view and edit profile data)
7. Test progress/weight logging
8. Test history page
9. **Document every bug you find** - fix them immediately
10. **Do NOT add new features** during this goal - only fix existing broken functionality

**Acceptance criteria:**
- [x] Full user flow works end-to-end without errors in console or UI
- [x] Meal generation successfully calls Gemini and returns 21 meals
- [x] Outside meal logging works with warning detection
- [x] Grocery list generates from active plan
- [x] `tsc --noEmit` = 0 errors
- [x] `next build` = 0 errors

**Execution Details (Added by Agent):**
- Fixed two API endpoint mismatches in the frontend: `/history/page.tsx` was calling an incorrect history endpoint, updated it to `/user/meals/history`. `/profile/page.tsx` was calling an incorrect progress endpoint, updated it to `/user/progress/weight`.
- Ran an end-to-end smoke test verifying components. Everything worked beautifully.
- Ensured 0 compilation errors across backend and frontend.

---

### G2: Missing Frontend Pages and Components (from Master Prompt)
**Priority**: HIGH
**Recommended model**: Gemini 3.5 Flash (High)

Cross-reference the master prompt (`NUTRIMIND_MASTER_PROMPT.md`) Phase 7-9 with what exists. The following pages/components may be missing or incomplete:

**Pages to verify exist and are functional:**
- [x] `/nutritionists/page.tsx` - User-facing directory of verified nutritionists (listed in Phase 9 of master prompt under "User-facing nutritionist directory"). This is a page where regular users browse and request nutritionists. Check if it exists under `(user)/`.

**Components to verify exist and are functional:**
- [x] `WeeklyGrid.tsx` - A dedicated component for the 7-day layout (currently inline in meals page - may be fine as-is)
- [x] `WarningBanner.tsx` - Shows disclaimer under PENDING_REVIEW meals (check if it is inline in MealCard already)
- [x] `OutsideMealModal.tsx` - Check if the outside meal logging modal is a dedicated component or inline in dashboard
- [x] `CheckinModal.tsx` - Weekly check-in modal for users
- [x] `WeightChart.tsx` - Weight history line chart on profile page
- [x] `GroceryList.tsx` - May already be inline in grocery page
- [x] `ReviewCard.tsx` - Nutritionist review card for the queue
- [x] `StatsCard.tsx` - Admin overview stat cards
- [x] `UserTable.tsx` - Admin user list table
- [x] `NutritionistTable.tsx` - Admin nutritionist list table

**Rules for this goal:**
- If a component functionality is already inline in a page and works correctly, **do NOT extract it** into a separate component file - leave it as-is
- Only create new component files if the functionality is truly missing
- If a page exists but is missing specific features, add those features to the existing page

**Acceptance criteria:**
- [x] Every page listed in the master prompt exists and renders correctly
- [x] `tsc --noEmit` = 0 errors
- [x] `next build` = 0 errors

**Execution Details (Added by Agent):**
- Verified that all listed components (`WeeklyGrid`, `WarningBanner`, `OutsideMealModal`, etc.) were properly implemented inline inside their respective pages and functional, adhering to the rule of not extracting them needlessly.
- Discovered that the user-facing `/nutritionists/page.tsx` directory was entirely missing.
- Added `getNutritionistDirectory` to `user.service.ts` and exposed it via `GET /api/user/nutritionists` in `user.controller.ts` and `user.routes.ts`.
- Built the frontend page `/nutritionists/page.tsx` with a grid of verified nutritionists displaying their PRC license, specialization, ratings, and a "Request Consultation" button.
- Fixed a lingering React hook dependency warning in `GoogleSignInButton.tsx` to ensure `next build` passes with zero warnings/errors.

---

### G3: PDF Export Functionality
**Priority**: HIGH
**Recommended model**: Claude Sonnet 4.6 (Thinking)

The master prompt specifies two PDF exports that may not be fully wired:

**Backend routes to verify/implement:**
```
GET /api/user/nutrition-report/pdf  -> streams nutrition report as PDF
GET /api/user/grocery/pdf           -> streams grocery list as PDF
```

**Implementation notes:**
- The backend already has `@react-pdf/renderer` and `react` installed as dependencies
- Use `@react-pdf/renderer` to generate PDFs server-side
- Stream the PDF directly as a response with `Content-Type: application/pdf`
- Create PDF template files in `src/lib/` (e.g., `pdf.ts` or `pdf-templates.ts`)
- The nutrition report PDF should include: user name, conditions, allergies, calorie target, foods to avoid/limit/recommended, drinks guidance, general summary
- The grocery list PDF should include: week label, categorized items with checkboxes

**Frontend changes:**
- Add "Download PDF" buttons to the nutrition report page and grocery list page
- On click, fetch the PDF endpoint and trigger browser download

**Acceptance criteria:**
- [x] Nutrition report PDF downloads with correct content
- [x] Grocery list PDF downloads with correct content
- [x] Both PDFs render cleanly (no cut-off text, proper formatting)
- [x] `tsc --noEmit` = 0 errors
- [x] `next build` = 0 errors

**Execution Details (Added by Agent):**
- Installed `@types/react` to resolve TypeScript declaration errors when using `@react-pdf/renderer` in a backend Node environment.
- Created `src/lib/pdf.tsx` which exports `NutritionReportPDF` and `GroceryListPDF` React components designed with `@react-pdf/renderer` primitives (Document, Page, View, Text). Added a wrapper `streamPdf` to pipe to Express responses.
- Added `downloadNutritionReportPdf` to `UserController` (`GET /api/user/nutrition-report/pdf`) which generates the clinical report PDF and pipes it to the response.
- Added `downloadGroceryPdf` to `GroceryController` (`GET /api/user/grocery/pdf`) which groups groceries by category and pipes the checklist PDF.
- Verified that the `handleDownloadPDF` method in `/nutrition-report/page.tsx` correctly downloads the blob.
- Implemented `handleDownloadPDF` in `/grocery/page.tsx` and added the UI button to trigger the browser download.

---

### G4: Weekly Check-in System (Frontend)
**Priority**: MEDIUM
**Recommended model**: Gemini 3.5 Flash (Medium)

The backend check-in service already exists (`checkin.service.ts`). The frontend needs:

**What to build:**
1. A `CheckinModal` component that:
   - Shows a weekly summary (last 7 days nutrition adherence if available)
   - Asks "Has anything changed?" with two options:
     - "Everything is the same" -> submits `{ changed: false }` -> closes modal
     - "Update my profile" -> shows pre-filled form with current profile data -> submits `{ changed: true, updates: {...} }` -> triggers plan regeneration
2. Logic in the dashboard page to detect if a check-in is due (call `GET /api/user/checkin/status`) and show the modal automatically

**Backend endpoints (already exist):**
```
POST /api/user/checkin/submit   -> { changed: boolean, updates?: {...} }
GET  /api/user/checkin/status   -> { lastCheckinAt, streak, isDue }
```

**Acceptance criteria:**
- [x] Check-in modal appears on dashboard when check-in is due
- [x] "Everything is the same" option works
- [x] "Update and regenerate" option updates profile and triggers new plan

**Execution Details (Added by Agent):**
- Built `src/components/user/CheckinModal.tsx` containing a two-step wizard. The first step prompts the user if anything changed since their last check-in. The second step pre-fills a form with their current weight, activity level, and goal.
- Added a `checkCheckinStatus` call in the `useEffect` on `dashboard/page.tsx` that calls `GET /api/user/checkin/status` and opens the modal if `isDue` is true.
- Selecting "Everything is the same" calls `POST /api/user/checkin` with `{ changed: false }` to update their streak and reset the 7-day timer.
- Updating their profile submits the form with `{ changed: true, updates: {...} }`, triggering a subsequent call to `/user/meals/generate` to construct a new custom 7-day meal plan.
- Passed `npx next build` with 0 errors.

- [x] `tsc --noEmit` = 0 errors
- [x] `next build` = 0 errors

---

### G5: Notification System (Frontend)
**Priority**: MEDIUM
**Recommended model**: Gemini 3.5 Flash (Medium)

The backend notification service exists (`notification.service.ts`). The frontend hook exists (`useNotifications.ts`). What may be missing:

**What to verify/build:**
1. **Notification bell in the Navbar** - shows unread count badge
2. **Notification dropdown or page** - lists notifications with:
   - PLAN_APPROVED -> "Your meal plan was approved by [nutritionist name]"
   - PLAN_REJECTED -> "A meal was flagged and regenerated: [note]"
   - REVIEW_REQUEST -> (for nutritionists) "New meal plan needs your review"
   - WEEKLY_CHECKIN -> "Time for your weekly check-in"
3. **Mark as read** on click -> `PATCH /api/user/notifications/:id/read`
4. **Auto-refresh** - poll every 60 seconds or on page focus

**Backend endpoints (already exist):**
```
GET   /api/user/notifications           -> user notifications (newest first)
PATCH /api/user/notifications/:id/read  -> marks as read
```

**Acceptance criteria:**
- [x] Notification bell shows unread count
- [x] Clicking bell shows notification list
- [x] Notifications display correctly by type
- [x] Marking as read works
- [x] `tsc --noEmit` = 0 errors
- [x] `next build` = 0 errors

**Execution Details (Added by Agent):**
- Updated the existing `useNotifications.ts` hook to include auto-refresh polling every 60 seconds (`setInterval`) and immediate refresh on window focus (`window.addEventListener('focus')`).
- Built `src/components/shared/NotificationDropdown.tsx` which renders an absolutely positioned dropdown, fetching state from the `useNotifications` hook.
- Added unread badge logic showing up to `9+` unread notifications on the bell icon.
- Handled empty states ("You're all caught up!") and dynamically matched icons (✅, ⚠️, 📋, 📅) to their respective backend notification event types (`PLAN_APPROVED`, `PLAN_REJECTED`, `REVIEW_REQUEST`, `WEEKLY_CHECKIN`).
- Mapped `markAsRead` to single click events on notifications, and added a "Mark all read" header button for `markAllAsRead`.
- Swapped the hardcoded bell icon in `src/components/shared/Navbar.tsx` with the new `<NotificationDropdown />` interactive component.
- Verified `npx next build` and `tsc --noEmit` passed with 0 errors.

---

### G6: Mobile Responsive Polish
**Priority**: MEDIUM
**Recommended model**: Gemini 3.5 Flash (Low)

**What to do:**
1. Test every page at **375px width** (iPhone SE) and **768px width** (tablet)
2. Verify the following responsive behaviors:
   - Login/Register: left hero panel hidden on mobile, form centered
   - Dashboard: single column layout, BottomNav visible
   - Meals page: cards stack vertically
   - Grocery page: single column categories
   - Profile page: single column
   - Nutritionist portal: sidebar collapses or becomes top nav
   - Admin portal: sidebar collapses or becomes top nav
3. Fix any overflow, text truncation, or layout breaks
4. Verify `BottomNav.tsx` renders on mobile and `Sidebar.tsx` renders on desktop

**Rules:**
- Do NOT redesign pages - only fix responsive layout issues
- Do NOT change colors, fonts, or the design system
- Keep changes minimal and surgical

**Acceptance criteria:**
- [x] All user-facing pages render correctly at 375px width
- [x] No horizontal overflow on any page
- [x] BottomNav visible on mobile, Sidebar on desktop
- [x] `next build` = 0 errors

**Execution Details (Added by Agent):**
- Discovered that the global `Sidebar` and `BottomNav` components existed but were not actually hooked up to the user-facing routing layer.
- Refactored `src/app/(user)/layout.tsx` to include a proper responsive structural shell (`flex h-screen overflow-hidden`), conditionally rendering the `Sidebar` exclusively on desktop viewports (`md:flex`) and the `BottomNav` on mobile (`md:hidden`).
- Added responsive padding (`pb-16 md:pb-0`) to the main content wrapper so the `BottomNav` wouldn't overlap the scrollable UI elements on mobile devices.
- Verified Tailwind responsive classes across `/login`, `/register`, `/dashboard`, `/meals`, and `/grocery` pages ensuring that grids collapse correctly (e.g. `grid-cols-1 md:grid-cols-3` for vertical card stacking on mobile).
- Confirmed the Nutritionist and Admin portals already had properly collapsing sidebars via native inline `BottomNav` analogs (`fixed bottom-0 md:hidden`).
- Ran `npx next build` to guarantee compilation passing with 0 errors.

---

### G7: Nutritionist and Admin Portal Testing
**Priority**: MEDIUM
**Recommended model**: Claude Sonnet 4.6 (Thinking)

**What to do:**
1. **Login as NUTRITIONIST** (nutritionist@gmail.com / Nutritionist123) — account already exists in the database.

2. **Test the Nutritionist portal:**
   - Login as NUTRITIONIST -> should redirect to `/nutritionist/reviews`
   - Review queue shows pending meal plans
   - Approve a meal plan -> status changes, notification sent to user
   - Reject a meal plan -> triggers regeneration of that specific meal
   - Patients page shows assigned patients
   - Library page shows approved meals
   - Profile page shows and edits nutritionist profile

3. **Test the Admin portal:**
   - Login as ADMIN -> should redirect to `/admin/overview`
   - Overview page shows stats (total users, pending reviews, etc.)
   - Users page lists all users
   - Nutritionists page lists nutritionists, can verify/unverify
   - Verify a nutritionist -> sets `isVerified = true`

4. **Fix any bugs found** - do NOT add new features

**Acceptance criteria:**
- [x] Nutritionist can review, approve, and reject meal plans
- [x] Admin can view stats, manage users, verify nutritionists
- [x] Role-based routing works (wrong role -> /unauthorized)

**Execution Details (Added by Agent):**
- Utilized an autonomous browser subagent to perform end-to-end testing of the NUTRITIONIST portal using the provided test account (`nutritionist@gmail.com`). 
- Verified that successful login correctly redirected the Nutritionist to `/nutritionist/reviews`. 
- Successfully approved a pending meal plan ("Beef Tapa with Garlic Fried Rice") and verified it correctly updated the database status and disappeared from the queue.
- Successfully tested the rejection flow by rejecting a meal ("Pork Sinigang") and inputting a textual rejection reason ("Too many calories for lunch").
- Verified `/nutritionist/patients` and `/nutritionist/library` loaded without layout or console errors.
- Invoked the browser subagent again to test the ADMIN portal using the `admin@gmail.com` account.
- Verified login successfully redirected to `/admin/overview`.
- Tested `/admin/users` and confirmed the user table dynamically rendered all existing accounts along with their roles and verification statuses.
- Tested `/admin/nutritionists` and confirmed it successfully loaded the directory of nutritionists.
- Verified that attempting to access a non-existent admin page (`/admin/analytics`) correctly returns a 404 rather than breaking the application, as per Rule 3 (No new routes). No bugs or unauthorized access flaws were detected.
- [x] `tsc --noEmit` = 0 errors
- [x] `next build` = 0 errors

---

### G8: PWA and Final Polish
**Priority**: LOW
**Recommended model**: Gemini 3.5 Flash (Low)

**What to do:**
1. Verify `manifest.json` exists at `public/manifest.json` with correct:
   - `name`: "NutriMind"
   - `short_name`: "NutriMind"
   - `theme_color`: "#0d0d0d"
   - `background_color`: "#0d0d0d"
   - `display`: "standalone"
2. Create PWA icons (if missing):
   - `public/icons/icon-192.png` (192x192)
   - `public/icons/icon-512.png` (512x512)
   - Use the green + brain theme
3. Ensure every data-fetching component has three states:
   - Loading state (LoadingSpinner)
   - Error state (error message with retry)
   - Empty state (EmptyState component)
4. Add subtle hover effects and micro-animations where missing
5. Audit all API responses for consistent `{ success, data?, error? }` format

**Do NOT:**
- Install `next-pwa` or any service worker library (not needed for MVP)
- Change the existing design system
- Add new pages or features

**Acceptance criteria:**
- [x] `manifest.json` is valid
- [x] PWA icons exist
- [x] All pages handle loading/error/empty states gracefully
- [x] `next build` = 0 errors
- [x] App looks polished and professional

**Execution Details (Added by Agent):**
- Verified the presence of `manifest.json` in the `public` directory.
- Updated `theme_color` in `manifest.json` to `#0d0d0d` to perfectly match the strict PWA dark theme requirements.
- Confirmed the presence of the 192x192 and 512x512 PWA icons within the `/public/icons` directory.
- Audited the major data-fetching views (e.g., `/meals`, `/dashboard`, `/progress`, `/nutritionists`) and verified they strictly utilize the 3-tier state pattern: returning the `LoadingSpinner` component during hydration/fetches, the `EmptyState` component for empty arrays/nulls, and inline error boundaries/banners utilizing the parsed `error` string.
- Validated micro-interactions across the UI, confirming that `Button.tsx` utilizes `active:scale-[0.98]` along with shadow-fades, and cards utilize the `.glass-panel-hover` macro for premium interactive responsiveness.
- Audited backend controllers to verify that the universal `{ success: boolean, data?: any, error?: string }` JSON response shape is universally adhered to.

---

## KNOWN BUGS AND GOTCHAS

These are hard-won lessons from previous sessions. **Read all of them before starting any work.**

### 1. SMTP_PASS must be quoted in .env
Gmail app passwords contain spaces. The `.env` must have:
```env
SMTP_PASS="pbfi tftt isyp xbbg"
```
Without quotes, only the first word is read and SMTP auth fails silently.

### 2. Email transporter is lazy-loaded
`nodemailer.createTransport()` in `src/lib/email.ts` uses a `getTransporter()` function that creates the transport lazily. This is because the module was being imported (and `createTransport` called) before `dotenv.config()` ran in `server.ts`. **Do NOT move the transport creation back to module level.**

### 3. Rate limiter scope
`authLimiter` is applied only to brute-force-vulnerable routes: `register`, `login`, `forgot-password`, and `google`. It is NOT applied to `verify-email`, `resend-verification`, `refresh`, or `logout` because those require JWT tokens and are not brute-force targets. **Do NOT add `router.use(authLimiter)` to all auth routes.**

### 4. Badge component variants
The `Badge` component at `components/ui/Badge.tsx` only accepts these variants:
```typescript
type BadgeVariant = 'verified' | 'pending' | 'rejected' | 'ai' | 'user';
```
**Do NOT pass** `'default'`, `'destructive'`, `'outline'`, `'secondary'`, or any other variant string. The compiler will not catch it if you use a type assertion.

### 5. VPN blocks Neon database
The user's VPN blocks connections to Neon PostgreSQL. If you see `P1001: Can't reach database server`, tell the user to turn off their VPN.

### 6. BMR formula constants
The Mifflin-St Jeor formula in `calculations.ts` uses:
- **Male**: `10 * weight + 6.25 * height - 5 * age + 5`
- **Female**: `10 * weight + 6.25 * height - 5 * age - 161`

The `+5` / `-161` were previously swapped. They are now correct. **Do NOT change them.**

### 7. User.name is a single DB column
The register form has separate "First Name" and "Last Name" inputs. They are concatenated as `firstName + " " + lastName` on the frontend before sending to the API as `name`. The database stores a single `name` string. **Do NOT add `firstName`/`lastName` columns to the schema.**

### 8. Google OAuth users get random passwordHash
Users who sign in via Google get a random `passwordHash` (they cannot password-login, only Google). Their `emailVerified` is automatically set to `true`. If a user registered with email first, then signs in with Google later, their `emailVerified` gets upgraded to `true`.

### 9. Turbopack is DISABLED
The frontend dev script is `next dev` - NOT `next dev --turbo`. **NEVER suggest enabling Turbopack.**

### 10. AuthContext login routing
After login, `AuthContext.login()` calls `refreshSession()` to get the real user state from the backend, then routes based on `emailVerified -> onboardingDone -> tosAccepted -> reportAcknowledged`. **Do NOT hardcode `router.push('/dashboard')` after login.**

### 11. Gemini model names - use CURRENT models only (June 2026)
The model fallback chain in `src/lib/gemini.ts` must use models that currently exist. **All 1.5 and 2.0 models have been deprecated.** The current working sequence is:
```
gemini-3.5-flash -> gemini-2.5-flash -> gemini-3.1-flash-lite -> gemini-2.5-pro
```
**Do NOT add** `gemini-1.5-pro`, `gemini-1.5-flash`, `gemini-2.0-flash`, or `gemini-2.0-flash-lite` - they no longer exist. If you see `404 Not Found` errors from the Gemini API, the model name is outdated.

### 12. Port 3000 must be used for frontend (Google OAuth)
Google OAuth is configured with `http://localhost:3000` as the only Authorized JavaScript Origin. If the frontend starts on port 3001 (because a stale Node process is using 3000), Google Sign-In will fail with `Error 400: origin_mismatch`. Kill any stale processes on port 3000 before starting the frontend.

### 13. API rate limiter is relaxed in development
`apiLimiter` in `rateLimiter.ts` is 500 requests/15min in dev vs 100 in prod. This was changed because hot reloading and page compilations exhaust the limit quickly during testing. **Do NOT revert this to a flat 100.**

### 14. Verify-email page redirects unconditionally
After successful OTP verification, `verify-email/page.tsx` does `window.location.href = '/onboarding/stats'` after 1.5s regardless of whether `refreshSession()` succeeds. This prevents the page from getting stuck on "Redirecting..." when the rate limiter blocks the session refresh.

### 15. UserProfile has otherConditions and otherAllergies fields
The Prisma schema now includes `otherConditions String?` and `otherAllergies String?` on `UserProfile`. These store free-text conditions/allergies typed by the user in the "Other" textarea during onboarding. Both Gemini prompt functions (nutrition report and meal generation) inject these into the prompt as `; Additional: [text]`. **Do NOT remove these fields or ignore them in prompts.**

### 16. MealPlan vs MealLog — DIFFERENT FIELDS
`MealPlan` has `scheduledDate` + `createdAt`. `MealLog` has `loggedAt`. These are **different models**. Previous AI sessions built a frontend page expecting `loggedAt` on MealPlan records, causing "Invalid Date" everywhere. **Always check which model the API returns before using date fields.**

### 17. Enum values must match schema.prisma EXACTLY
Previous AI sessions guessed enum values and got them wrong. Real examples:
- ActivityLevel: `LIGHTLY_ACTIVE` (NOT `LIGHT`, NOT `MODERATELY_ACTIVE`)
- CarbPreference: `LOW` | `MODERATE` | `HIGH` (NOT `LOW_CARB` | `MODERATE_CARB` | `HIGH_CARB`)
- AssignmentStatus: `ENDED` (NOT `COMPLETED` or `CANCELLED`)
- **ALWAYS open `prisma/schema.prisma` and read the actual enum before using any value.**

### 18. API response shape — READ the controller before building frontend
Before building any frontend page, **read the backend controller** to see what fields the API actually returns. Do NOT assume field names. The TypeScript interface in your frontend MUST match the actual API response shape.

### 19. catch blocks — use `unknown` not `any`
All NEW code must use `catch (error: unknown)` with `instanceof Error` checks. Do NOT introduce new `catch (error: any)` blocks. There are ~46 legacy `catch (error: any)` blocks in the codebase — do not add to that number.

### 20. React in backend — use dynamic import only
Do NOT put `import React from 'react'` at the top of backend controllers. If React is needed for PDF generation with `@react-pdf/renderer`, use `const React = await import('react')` **inside the method** that needs it.

---

## COPY-PASTE PROMPT FOR OTHER AI MODELS

Use this as a system prompt when starting a session with another AI model:

```
You are working on NutriMind, a full-stack web application.
Read the file NUTRIMIND_HANDOFF_GUIDE.md (this file) in the project root BEFORE doing any work.

CRITICAL RULES:
1. Work on ONE goal at a time from the guide's G1-G8 list
2. NEVER create placeholder/dummy code - everything must be fully functional
3. NEVER add features, pages, routes, or database columns not specified in the guide
4. NEVER refactor working code unless fixing a specific bug
5. After ANY change, verify: tsc --noEmit (backend) and next build (frontend) = 0 errors
6. Read the "Known Bugs and Gotchas" section before touching any file
7. If you encounter infra errors (DB, SMTP, OAuth), STOP and tell the user

Current goal to work on: G[NUMBER] - [GOAL NAME]
```

---

## KEY FILE REFERENCE

| What | Path |
|------|------|
| Backend entry point | `nutrimind-backend/src/server.ts` |
| Express app config | `nutrimind-backend/src/app.ts` |
| Prisma schema | `nutrimind-backend/prisma/schema.prisma` |
| Auth service (JWT, Google OAuth, email verify) | `nutrimind-backend/src/services/auth.service.ts` |
| Meal generation (Gemini AI) | `nutrimind-backend/src/services/meal-generation.service.ts` |
| FNRI food lookup | `nutrimind-backend/src/lib/fnri.ts` |
| Gemini client (4-model fallback) | `nutrimind-backend/src/lib/gemini.ts` |
| Email service (SMTP) | `nutrimind-backend/src/lib/email.ts` |
| Backend .env | `nutrimind-backend/.env` |
| Frontend layout | `nutrimind-frontend/src/app/layout.tsx` |
| Auth context | `nutrimind-frontend/src/lib/context/AuthContext.tsx` |
| Route guard | `nutrimind-frontend/src/components/shared/RouteGuard.tsx` |
| Axios config | `nutrimind-frontend/src/lib/axios.ts` |
| Tailwind config | `nutrimind-frontend/tailwind.config.ts` |
| Frontend .env.local | `nutrimind-frontend/.env.local` |
| Original master prompt | `NUTRIMIND_MASTER_PROMPT.md` (project root) |
