# NutriMind — Agent Engineering Guide (`AGENTS.md`)

> **Documentation status — Partially superseded (August 19, 2026):** Preserve and follow the operational safety instructions in this file, but do not treat its feature-completion, testing, PWA, clinical-safety, or deployment claims as current evidence. The canonical current evidence source is [`docs/NUTRIMIND_ENGINEERING_RECORD.md`](docs/NUTRIMIND_ENGINEERING_RECORD.md), and contributor setup is in [`README.md`](README.md). Where this file conflicts with those current records or executable code, the engineering record and approved ADRs govern.
> **Target Audience**: AI Coding Assistants (e.g., Codex, Claude, Gemini) and Engineers working on the NutriMind repository.  
> **Historical audit date**: June 2026. Current verification evidence is dated August 19, 2026 in the engineering record.  
> **Purpose**: Provide operational engineering guidance for NutriMind. Current implementation evidence, verification levels, defects, and accepted decisions are maintained in `docs/NUTRIMIND_ENGINEERING_RECORD.md`.

---

## 1. Project Overview

### 1.1 Purpose and Problem Statement
**NutriMind** is an AI-powered, clinical-grade Progressive Web Application (PWA) designed for personalized nutrition, dietary management, and meal planning. It is tailored specifically for **health-conscious young urban Filipinos (aged 18–35)** as well as individuals managing chronic lifestyle conditions (such as Type 2 Diabetes, Hypertension, and Kidney Disease).

* **The Problem**: Mainstream nutritional and meal planning applications predominantly feature Western diets (e.g., kale, quinoa, avocado toast, asparagus) that are economically inaccessible, culturally foreign, or difficult to source in the Philippines. Furthermore, purely generative AI nutrition tools frequently hallucinate macro calculations and suggest dangerous foods to patients with medical contraindications without licensed professional oversight.
* **The Intended Solution**: NutriMind combines **Google Gemini AI** with the **FNRI (Food and Nutrition Research Institute) Philippine Food Composition Table** and nutritionist review. Intended safety controls include review queues, allergy/condition checks, and disclaimers; the engineering record documents known enforcement gaps and does not classify the system as clinically reviewed.

### 1.2 Target Users
1. **Regular Users (`USER`)**: Filipino adults seeking personalized calorie/macro-targeted meal plans tailored to their budget, shopping schedule, dietary preferences (Omnivore, Vegetarian, Vegan, Pescatarian), and medical conditions/allergies.
2. **Registered Nutritionist-Dietitians (`NUTRITIONIST`)**: PRC-licensed Filipino clinicians who audit AI-generated meal plans, approve/reject/flag recipes, curate the verified `MealLibrary`, and monitor user health parameters.
3. **Platform Administrators (`ADMIN`)**: System administrators who verify nutritionist PRC license credentials, oversee user accounts, and monitor platform analytics.

### 1.3 Major Workflows
1. **Authentication & Onboarding**: Split-screen registration (or Google OAuth) $\rightarrow$ 6-digit email OTP verification $\rightarrow$ 5-step biometric and clinical intake wizard (Stats $\rightarrow$ Preferences $\rightarrow$ Conditions $\rightarrow$ Allergies $\rightarrow$ Terms of Service) $\rightarrow$ AI Nutrition Report generation and acknowledgment.
2. **Weekly Plan Generation**: Calculation of BMR and TDEE using Mifflin-St Jeor $\rightarrow$ Schedule anchoring based on shopping preference (Weekend vs. Weekday) $\rightarrow$ Bridge/Starter plan or full 7-day 21-meal plan generation via Gemini (with 4-model fallback) matched against FNRI database and verified Meal Library.
3. **Daily Tracking & Logging**: Visual Calorie Ring tracking $\rightarrow$ Marking plan items as DONE or SKIPPED $\rightarrow$ Logging outside freestyle meals with real-time AI nutrient estimation and medical contraindication warnings $\rightarrow$ Water intake logging.
4. **Meal Swapping**: User-initiated slot replacement from the verified `MealLibrary` (capped at 3 swaps/week) with ±15% calorie delta imbalance safety warnings $\rightarrow$ Atomic ingredient and grocery list recalculation.
5. **Grocery List & PDF Export**: Aggregation of ingredient names into categorized checklists with local checkbox interactions and server-side PDF code. Quantities/units and runtime PDF behavior remain incomplete or unverified; no service-worker offline behavior exists.
6. **Nutritionist Review Queue**: Global audit queue sorted by clinical severity (`NEEDS_REVIEW` $\rightarrow$ `CAUTION` $\rightarrow$ `SAFE`) with a 30-minute lock claim mechanism, 1-click approvals, and granular meal rejection/regeneration triggers.
7. **Admin Licensing Verification**: Verification workflow requiring PRC license numbers, validity dates, university, and specialization before granting RND portal access.

### 1.4 State of Development
* **Backend (`backend`)**: Substantially implemented and statically verified as an Express.js + Prisma ORM + PostgreSQL API. Runtime, integration, deployment, and clinical verification are not established; important safety, authorization, transaction, and data-integrity defects remain open.
* **Frontend (`frontend`)**: Substantially implemented and statically verified as a Next.js 14 App Router application. Some pages call missing or stale backend endpoints, lint warnings remain, and browser E2E verification is not established.
* **Historical addendum implementation claims (1 through 7; current behavior must be verified against the engineering record and code):**
  * *Addendum 1*: Shopping-Day Anchored Cycles (`WEEKEND` / `WEEKDAY`) & Starter Bridge Plans.
  * *Addendum 2*: Autocomplete ingredient chips & Zod schema-aware AI prompting.
  * *Addendum 3*: Meal Library slot-by-slot matching with 3-day anti-repetition rotation algorithms.
  * *Addendum 4*: Nutritionist Meal Library CRUD & Cross-RND Flagging workflows.
  * *Addendum 5*: Atomic Meal Swapping with 3-swap weekly caps.
  * *Addendum 6*: Unified `/meals` tabbed interface (Plan, History, Library) & ±15% calorie delta warning alerts.
  * *Addendum 7*: Navigation overhaul, DiceBear pixel-art avatar customizer, mid-plan health re-check algorithms, and removal of manual 1-on-1 patient assignment tables.

---

## 2. Technology Stack

### Backend Stack (`backend`)
| Component | Technology / Library | Version | Purpose |
|---|---|---|---|
| Runtime / Framework | Node.js / Express.js | `^4.19.2` | REST API Server |
| Language | TypeScript | `^5.4.5` | Strict static typing |
| Database | PostgreSQL (Neon Serverless) | PG 15+ | Relational persistence |
| ORM | Prisma | `^5.14.0` | Schema migrations, type-safe queries |
| AI Integration | `@google/generative-ai` | `^0.11.0` | Google Gemini 3.5/2.5 API integration |
| Authentication | `jsonwebtoken` / `bcryptjs` | `^9.0.2` / `^2.4.3` | Access tokens (15m), Refresh tokens (7d), password hashing (12 rounds) |
| OAuth | `google-auth-library` | `^10.7.0` | Google ID Token verification |
| Validation | `zod` / `express-validator` | `^4.4.3` / `^7.1.0` | AI schema parsing and HTTP input sanitization |
| Security | `helmet` / `cors` / `cookie-parser` | `^7.1.0` / `^2.8.5` / `^1.4.7` | HTTP security headers, CORS origin handling, cookie parsing |
| Rate Limiting | `express-rate-limit` | `^8.5.2` | Brute-force & DDoS mitigation (dev: 500/15m, prod: 100/15m) |
| Email Dispatch | `nodemailer` | `^8.0.10` | SMTP OTP verification and password reset emails |
| PDF Engine | `@react-pdf/renderer` + `react` | `^3.4.4` + `^18.3.1` | Server-side PDF document generation & streaming |
| Dev Tooling | `tsx` / `nodemon` | `^4.10.5` / `^3.1.0` | TypeScript execution & hot reloading |

### Frontend Stack (`frontend`)
| Component | Technology / Library | Version | Purpose |
|---|---|---|---|
| Framework | Next.js (App Router) | `14.2.35` | React Server/Client Components, Routing |
| Language | TypeScript | `^5.x` | Type safety across client components |
| UI Primitives | `@radix-ui/react-*` (Dialog, Tabs, Checkbox, Avatar, Progress) | Various | Accessible, headless UI components |
| Icons | `lucide-react` | `^1.21.0` | Consistent line iconography across portals |
| Styling | Tailwind CSS / PostCSS / Autoprefixer | `^3.4.1` | Utility-first styling with bold 2px borders and custom dark/light theme |
| HTTP Client | `axios` | `^1.16.1` | Pre-configured API client with automatic token refresh interceptors |
| JWT Decoding | `jwt-decode` | `^4.0.0` | Client-side claim extraction for routing |
| Avatars | DiceBear Pixel-Art HTTP API | REST | Dynamic pixel-art avatar generation |

---

## 3. Repository Structure

```
Nutrimind/App2_vibecode/
├── AGENTS.md                                # THIS FILE: Primary context and instructions for AI agents
├── AI_AGENT_PROMPT.md                       # Comprehensive project prompt and original requirements
├── NUTRIMIND_FULL_SYSTEM_REFERENCE.md       # Full architecture and clinical specification reference
├── NUTRIMIND_HANDOFF_GUIDE.md               # Historical handoff guide and checklist
├── NUTRIMIND_MASTER_PROMPT.md               # Original foundational blueprint
├── UPDATE_LOG.md                            # Historical changelog of phases and addendums
├── fnri_foods.csv                           # Raw FNRI Philippine food composition dataset
├── backend/                                 # Express.js + Prisma API Backend
│   ├── package.json                         # Backend dependencies & npm scripts
│   ├── tsconfig.json                        # Backend TypeScript configuration
│   ├── .env.example                         # Template for backend environment variables
│   ├── .env                                 # Local backend environment secrets (DO NOT COMMIT)
│   ├── prisma/
│   │   ├── schema.prisma                    # Single source of truth for database models & enums
│   │   ├── seed.ts                          # Seeds ~1,500+ FNRI food items from data/fnri.csv
│   │   ├── seed-test-accounts.ts            # Seeds admin@gmail.com and nutritionist@gmail.com
│   │   └── data/
│   │       └── fnri.csv                     # Processed CSV dataset for food database seeding
│   └── src/
│       ├── server.ts                        # Entry point: calls dotenv.config() and starts HTTP listener
│       ├── app.ts                           # Express app initialization, middleware, and router mounts
│       ├── controllers/                     # HTTP request handlers (parameter extraction, response formatting)
│       │   ├── auth.controller.ts           # Login, register, Google OAuth, OTP verification, refresh, reset
│       │   ├── user.controller.ts           # Onboarding, profile, settings, nutrition report, avatars
│       │   ├── meals.controller.ts          # Plan generation, logging, checking, history, swap operations
│       │   ├── grocery.controller.ts        # Grocery generation, checkbox toggling, PDF streaming
│       │   └── progress.controller.ts       # Weight logging and adherence history
│       ├── services/                        # Core business logic, transactions, and AI pipelines
│       │   ├── admin.service.ts             # Analytics, user management, RND verification
│       │   ├── auth.service.ts              # Bcrypt hashing, token issuance, Google ID validation
│       │   ├── checkin.service.ts           # Weekly check-in streak tracking and profile updates
│       │   ├── cron.service.ts              # Daily adherence aggregator & weekly plan regenerator
│       │   ├── grocery.service.ts           # Recipe ingredient consolidation into categorized items
│       │   ├── health-validation.service.ts # Real-time allergy and medical contraindication evaluator
│       │   ├── meal-generation.service.ts   # 7-day / Starter meal plan generator with Gemini & FNRI
│       │   ├── meal-log.service.ts          # Outside meal logger and status toggling (DONE/SKIPPED)
│       │   ├── meal-swap.service.ts         # Profile-constrained library meal swapping and swap caps
│       │   ├── notification.service.ts      # User notification dispatcher and read tracking
│       │   ├── nutrition-report.service.ts  # Gemini-powered clinical nutrition report generator
│       │   ├── nutritionist.service.ts      # RND review queue, claim locks, MealLibrary CRUD & flags
│       │   ├── progress.service.ts          # Historical adherence and weight logs aggregator
│       │   ├── user.service.ts              # Profile CRUD, mid-plan safety rechecks, suggestions
│       │   └── weight-log.service.ts        # Weight entry recording and BMR recalculation
│       ├── routes/                          # Express route definitions, input validators, RBAC guards
│       │   ├── auth.routes.ts               # /api/auth/*
│       │   ├── user.routes.ts               # /api/user/* (onboarding, profile, reports, weight, checkin)
│       │   ├── meals.routes.ts              # /api/user/meals/* (generate, current, history, swap)
│       │   ├── grocery.routes.ts            # /api/user/grocery/* (generate, current, toggle, pdf)
│       │   ├── progress.routes.ts           # /api/user/progress/* (weight, history)
│       │   ├── nutritionist.routes.ts       # /api/nutritionist/* (queue, review, library, flags)
│       │   ├── admin.routes.ts              # /api/admin/* (analytics, users, nutritionists, verify)
│       │   ├── fnri.routes.ts               # /api/fnri/* (lookup chain)
│       │   └── cron.routes.ts               # /api/cron/* (daily-checkin, weekly-checkin-*)
│       ├── middleware/                      # Express middleware layers
│       │   ├── auth.ts                      # JWT authentication (validates Bearer token in Authorization header)
│       │   ├── rbac.ts                      # Role-Based Access Control (enforces USER, NUTRITIONIST, ADMIN)
│       │   ├── rateLimiter.ts               # API rate limiting (apiLimiter, authLimiter)
│       │   └── validate.ts                  # express-validator result handler
│       ├── lib/                             # Shared utility libraries
│       │   ├── prisma.ts                    # Global Prisma client singleton
│       │   ├── gemini.ts                    # Google Generative AI client with 4-model fallback cascade
│       │   ├── fnri.ts                      # 4-step FNRI food lookup chain (exact, alias, fuzzy, AI)
│       │   ├── calculations.ts              # Mifflin-St Jeor BMR and TDEE calorie target calculators
│       │   ├── jwt.ts                       # Token signing and verification helpers
│       │   ├── email.ts                     # Lazy-loaded Nodemailer SMTP transporter & email templates
│       │   ├── pdf.tsx                      # Server-side React-PDF document templates and stream piper
│       │   └── sanitizeError.ts             # Safe error message sanitizer to prevent data leakage
│       └── types/                           # Shared backend TypeScript type definitions
│           └── index.ts                     # JWTPayload, ApiResponse, AuthenticatedRequest
└── frontend/                                # Next.js 14 App Router Frontend
    ├── package.json                         # Frontend dependencies & scripts
    ├── tsconfig.json                        # Frontend TypeScript configuration
    ├── tailwind.config.ts                   # Custom design system tokens, fonts, and colors
    ├── postcss.config.mjs                   # PostCSS configuration
    ├── next.config.mjs                      # Next.js configuration
    ├── .env.local                           # Frontend environment variables (API URL, Google Client ID)
    ├── public/                              # Static public assets
    │   ├── manifest.json                    # PWA manifest
    │   ├── icons/                           # PWA icons (192x192, 512x512)
    │   └── favicon.ico                      # Site favicon
    └── src/
        ├── app/                             # Next.js App Router directory
        │   ├── layout.tsx                   # Root layout (AuthProvider, RouteGuard, Google Fonts)
        │   ├── globals.css                  # Global styles, Tailwind base, bold 2px borders, scrollbars
        │   ├── page.tsx                     # Landing page with hero, features, and role routing
        │   ├── unauthorized/page.tsx        # 403 Forbidden access denial page
        │   ├── nutrition-report/page.tsx    # Clinical nutrition report viewer, PDF download, ToS gate
        │   ├── (auth)/                      # Public authentication route group
        │   │   ├── login/page.tsx           # Split-screen login with Google OAuth
        │   │   ├── register/page.tsx        # Registration with password strength validator
        │   │   ├── verify-email/page.tsx    # 6-digit OTP email verification with auto-redirect
        │   │   ├── forgot-password/page.tsx # Password reset request page
        │   │   └── reset-password/page.tsx  # Password reset confirmation page
        │   ├── (onboarding)/                # Mandatory 5-step onboarding wizard
        │   │   └── onboarding/
        │   │       ├── stats/page.tsx       # Step 1: Age, sex, height, weight, goal-aware target weight
        │   │       ├── preferences/page.tsx # Step 2: Dietary preference, carb limit, food culture
        │   │       ├── conditions/page.tsx  # Step 3: Health conditions + custom free-text "Other"
        │   │       ├── allergies/page.tsx   # Step 4: Food allergens + custom free-text "Other"
        │   │       ├── shopping-day/page.tsx# Step 5: Weekend vs. Weekday shopping schedule selector
        │   │       └── tos/page.tsx         # Step 6: Mandatory clinical disclaimer & Terms of Service
        │   ├── (user)/                      # Authenticated User Portal layout & pages
        │   │   ├── layout.tsx               # Responsive layout (Desktop Sidebar + Mobile BottomNav)
        │   │   ├── dashboard/page.tsx       # Main dashboard: Calorie Ring, date switcher, meal cards, modal
        │   │   ├── meals/page.tsx           # Unified meals page: Plan grid, History logs, Library browser, Swaps
        │   │   ├── grocery/page.tsx         # Categorized grocery checklist with PDF export
        │   │   ├── progress/page.tsx        # Weight history line charts, macro adherence, clinical settings
        │   │   ├── profile/page.tsx         # Account security, password updates, DiceBear avatar customizer
        │   │   └── export/page.tsx          # Centralized data export hub
        │   ├── (nutritionist)/              # Authenticated Nutritionist Portal
        │   │   └── nutritionist/
        │   │       ├── reviews/page.tsx     # Review queue with claim locks, 2-panel inspection, approve/reject
        │   │       ├── library/page.tsx     # Verified MealLibrary CRUD, search, and cross-RND flagging
        │   │       ├── approved/page.tsx    # Archive of meal plans approved by this nutritionist
        │   │       └── profile/page.tsx     # RND credentials, PRC license info, bio, and specialization
        │   └── (admin)/                     # Authenticated Admin Panel
        │       └── admin/
        │           ├── overview/page.tsx    # Aggregate platform analytics & system status
        │           ├── users/page.tsx       # Paginated user accounts table with search
        │           ├── nutritionists/page.tsx# Nutritionist verification portal (PRC verification)
        │           └── analytics/page.tsx   # Deep nutritional analytics
        ├── components/                      # Reusable React components
        │   ├── ui/                          # 12 base UI primitives
        │   │   ├── Button.tsx               # Reusable button with variants, sizes, and loading spinners
        │   │   ├── Card.tsx                 # Base container with glassmorphic styling
        │   │   ├── Badge.tsx                # Status badge (variants: verified | pending | rejected | ai | user)
        │   │   ├── Input.tsx                # Styled input field with label and error handling
        │   │   ├── Modal.tsx                # Radix UI dialog wrapper with backdrop
        │   │   ├── Tabs.tsx                 # Radix UI tab container
        │   │   ├── Progress.tsx             # Progress bar component
        │   │   ├── Checkbox.tsx             # Radix UI checkbox primitive
        │   │   ├── Avatar.tsx               # DiceBear pixel-art / OAuth image avatar component
        │   │   ├── AutocompleteInput.tsx    # Debounced FNRI ingredient chip autocomplete selector
        │   │   ├── Sidebar.tsx              # Dynamic collapsible desktop navigation with persistent state
        │   │   └── BottomNav.tsx            # Mobile fixed bottom tab navigation
        │   ├── shared/                      # Global cross-cutting components
        │   │   ├── RouteGuard.tsx           # Layout guard verifying auth, role, onboarding, and ToS
        │   │   ├── Navbar.tsx               # Top header with user profile menu and notifications
        │   │   ├── NotificationDropdown.tsx # Real-time notification bell with polling and mark-as-read
        │   │   ├── LoadingSpinner.tsx       # Centralized loading spinner
        │   │   ├── EmptyState.tsx           # Standardized empty data placeholder
        │   │   └── ErrorBoundary.tsx        # React client component error boundary
        │   ├── auth/
        │   │   └── GoogleSignInButton.tsx   # Google Identity Services SDK sign-in button
        │   └── user/
        │       ├── CalorieRing.tsx          # SVG animated calorie adherence ring & macro progress bars
        │       ├── MealCard.tsx             # Simplified meal card with modal detail triggers
        │       └── CheckinModal.tsx         # Weekly 2-step check-in questionnaire modal
        ├── hooks/                           # Custom React hooks
        │   ├── useAuth.ts                   # Convenience hook for AuthContext
        │   ├── useMeals.ts                  # Meal plan fetching, status toggling, and logging
        │   ├── useNotifications.ts          # Notification polling (60s interval) and read mutations
        │   └── useProfile.ts                # Profile data fetching and updates
        ├── lib/                             # Frontend client utilities
        │   ├── auth.ts                      # Client-side JWT decoding and cookie helpers
        │   ├── axios.ts                     # Axios client with automatic 401 token refresh interceptor
        │   └── context/
        │       └── AuthContext.tsx          # Global authentication state provider
        └── types/                           # Frontend TypeScript type declarations
            └── index.ts                     # Interfaces for User, Profile, MealPlan, Grocery, Reports
```

---

## 4. System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Next.js 14 Frontend (Port 3000)                      │
│  ┌───────────────────────┐  ┌────────────────────────────────────────┐ │
│  │ AuthContext / Cookies │  │ RouteGuard (Auth, Role, Onboarding)    │ │
│  └──────────┬────────────┘  └───────────────────┬────────────────────┘ │
│             │ Axios Interceptor (Bearer Token)  │                      │
└─────────────┼───────────────────────────────────┼──────────────────────┘
              │ HTTP / REST                       │
              ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Express.js Backend (Port 5000)                       │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Global Middleware: Helmet, CORS, CookieParser, RateLimiter       │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│     ┌───────────────────────────────┼────────────────────────────┐     │
│     ▼                               ▼                            ▼     │
│ ┌──────────────┐            ┌──────────────┐             ┌───────────┐ │
│ │ Auth Router  │            │ User Router  │             │ Nutrition │ │
│ └──────┬───────┘            └──────┬───────┘             └─────┬─────┘ │
│        │                           │                           │       │
│        ▼                           ▼                           ▼       │
│ ┌──────────────┐            ┌──────────────┐             ┌───────────┐ │
│ │ Auth Service │            │ Meal Gen Svc │             │ RND Serv. │ │
│ └──────┬───────┘            └──────┬───────┘             └─────┬─────┘ │
│        │                           │                           │       │
│        │            ┌──────────────┴───────────────┐           │       │
│        │            ▼                              ▼           │       │
│        │    ┌────────────────┐             ┌───────────────┐   │       │
│        │    │ Gemini 3.5/2.5 │             │ FNRI Database │   │       │
│        │    │ 4-Model Chain  │             │ 4-Step Lookup │   │       │
│        │    └────────────────┘             └───────────────┘   │       │
│        │                                                       │       │
│        └───────────────────────────┬───────────────────────────┘       │
│                                    ▼                                   │
│                        ┌───────────────────────┐                       │
│                        │ Prisma Client ORM     │                       │
│                        └───────────┬───────────┘                       │
└────────────────────────────────────┼───────────────────────────────────┘
                                     ▼
                     ┌───────────────────────────────┐
                     │ PostgreSQL (Neon Serverless)  │
                     └───────────────────────────────┘
```

### 4.1 End-to-End Execution Flow
1. **Request Authentication**: The client stores the short-lived access token in a client-accessible cookie (`nutrimind_session`) and sends it via `Authorization: Bearer <token>`. The long-lived refresh token is stored in an `HttpOnly`, `SameSite=Lax`, `Secure` cookie (`nutrimind_refresh_token`).
2. **Silent Refresh Interceptor**: When an access token expires (15 minutes), backend endpoints return `401 Unauthorized`. The Axios response interceptor in `src/lib/axios.ts` intercepts this, queues pending requests, issues a `POST /api/auth/refresh` request sending the HttpOnly refresh cookie, stores the new access token, and retries the queued requests seamlessly.
3. **Route Protection & Gatekeeping**: The frontend `<RouteGuard />` component evaluates the user's live profile parameters in sequence:
   * Is authenticated? $\rightarrow$ If not, redirect to `/login`.
   * Is email verified? $\rightarrow$ If not, redirect to `/verify-email`.
   * Does role match URL prefix (`/admin`, `/nutritionist`, `/(user)`)? $\rightarrow$ If not, redirect to `/unauthorized`.
   * Is onboarding complete? $\rightarrow$ If not, redirect to `/onboarding/stats`.
   * Is ToS accepted? $\rightarrow$ If not, redirect to `/onboarding/tos`.
   * Is Nutrition Report acknowledged? $\rightarrow$ If not, redirect to `/nutrition-report`.
   * If all checks pass $\rightarrow$ Render destination page.

### 4.2 AI & Food Composition Pipeline
When generating meal plans:
1. **Calorie & Macro Computation**: The system calculates BMR using Mifflin-St Jeor and TDEE based on `ActivityLevel` and `Goal` (e.g., `-500 kcal` for `LOSE_WEIGHT`, `+300 kcal` for `GAIN_WEIGHT`).
2. **Meal Library Slot Matching**: `MealGenerationService` first queries the verified `MealLibrary` for approved meals matching the user's dietary preferences, calorie targets (within ±10%), and clinical restrictions. It applies an anti-repetition algorithm ensuring no recipe repeats within 3 days.
3. **Gemini AI Generation**: For remaining unfilled slots, the backend compiles a schema-aware prompt containing the user's biometric stats, medical conditions, allergies, cultural preferences, and a representative ~120-item FNRI food sample.
4. **4-Tier Model Fallback**: Prompt execution in `src/lib/gemini.ts` runs through a sequential cascade:
   $$\text{gemini-3.5-flash} \longrightarrow \text{gemini-2.5-flash} \longrightarrow \text{gemini-3.1-flash-lite} \longrightarrow \text{gemini-2.5-pro}$$
   Responses are parsed and validated against strict `Zod` schemas. If JSON parsing or validation fails, it cascades to the next model.
5. **FNRI Ingredient Resolution**: Generated ingredients run through the 4-step FNRI lookup chain in `src/lib/fnri.ts`:
   * **Step 1 (Exact Match)**: Case-insensitive match on `FoodItem.name`.
   * **Step 2 (Alias Match)**: Match against traditional Filipino synonyms in `FoodAlias`.
   * **Step 3 (Fuzzy Match)**: Substring match on `FoodItem.name`; if found, auto-registers the alias for future $O(1)$ lookups.
   * **Step 4 (Gemini Estimation)**: AI fallback estimation per 100g serving with `source = 'GEMINI_ESTIMATED'`.
6. **Plan Creation**: All meals are saved to the database with status `PENDING_REVIEW` and flagged with an `AIConfidenceFlag` (`SAFE`, `CAUTION`, or `NEEDS_REVIEW`).

---

## 5. Database Architecture

* **Database Engine**: PostgreSQL (hosted on Neon Serverless).
* **ORM**: Prisma (`schema.prisma`).
* **Source of Truth**: `backend/prisma/schema.prisma`.

> ⚠️ **CRITICAL WARNING**: Do NOT rename tables, columns, relations, or enum values casually. The frontend, backend controllers, and database depend on exact string matching.

### 5.1 Enums Reference
| Enum Name | Defined Values |
|---|---|
| `Role` | `USER`, `NUTRITIONIST`, `ADMIN` |
| `Goal` | `LOSE_WEIGHT`, `GAIN_WEIGHT`, `MAINTAIN`, `BUILD_MUSCLE` |
| `ActivityLevel` | `SEDENTARY`, `LIGHTLY_ACTIVE`, `ACTIVE`, `VERY_ACTIVE` |
| `DietaryPreference`| `OMNIVORE`, `VEGETARIAN`, `VEGAN`, `PESCATARIAN` |
| `CarbPreference` | `LOW`, `MODERATE`, `HIGH` |
| `HealthConditionType` | `DIABETES`, `HYPERTENSION`, `KIDNEY_DISEASE`, `HEART_CONDITION`, `PREGNANT`, `NONE` |
| `AllergenType` | `SHELLFISH`, `NUTS`, `DAIRY`, `GLUTEN`, `EGGS`, `NONE` |
| `MealType` | `BREAKFAST`, `LUNCH`, `DINNER`, `SNACK` |
| `MealPlanStatus` | `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `CANCELLED` |
| `AIConfidenceFlag` | `SAFE`, `CAUTION`, `NEEDS_REVIEW` |
| `MealLogSource` | `SYSTEM_GENERATED`, `USER_LOGGED`, `USER_SWAPPED`, `SAFETY_REPLACED` |
| `MealLogDataSource` | `FNRI`, `GEMINI_ESTIMATED`, `SYSTEM` |
| `MealIngredientDataSource` | `FNRI`, `GEMINI_ESTIMATED` |
| `MealLogStatus` | `DONE`, `PENDING`, `SKIPPED` |
| `NotificationType` | `PLAN_APPROVED`, `PLAN_REJECTED`, `REVIEW_REQUEST`, `ASSIGNMENT`, `WEEKLY_CHECKIN`, `MEAL_FLAGGED`, `FLAG_RESOLVED` |
| `AssignmentStatus` | `PENDING`, `ACTIVE`, `ENDED` |
| `ShoppingDayGroup` | `WEEKEND` (Sun–Sat cycle), `WEEKDAY` (Mon–Sun cycle) |
| `PlanType` | `STARTER` (bridge plan), `WEEKLY` (full 7-day plan) |
| `MealLibraryStatus`| `APPROVED`, `FLAGGED` |
| `FlagStatus` | `PENDING`, `RESOLVED_REMOVED`, `RESOLVED_KEPT` |

### 5.2 Core Data Models & Relations
```mermaid
erDiagram
    User ||--o| UserProfile : has
    User ||--o{ HealthCondition : has
    User ||--o{ Allergy : has
    User ||--o| NutritionReport : receives
    User ||--o| NutritionistProfile : "nutritionist role"
    User ||--o{ MealPlan : owns
    User ||--o{ MealLog : logs
    User ||--o{ WeightLog : logs
    User ||--o{ DailyNutritionLog : aggregates
    User ||--o{ GroceryList : generates
    User ||--o{ Notification : receives
    User ||--o{ PlanSwapTracker : tracks
    
    MealPlan ||--o{ MealIngredient : contains
    MealPlan ||--o{ MealLog : references
    MealPlan }o--o| MealLibrary : "swapped from"
    MealPlan }o--o| NutritionistProfile : "reviewed by"
    
    FoodItem ||--o{ FoodAlias : aliases
    FoodItem ||--o{ MealIngredient : references
    
    NutritionistProfile ||--o{ MealLibrary : verifies
    NutritionistProfile ||--o{ MealLibraryFlag : submits
    MealLibrary ||--o{ MealLibraryFlag : has
    
    GroceryList ||--o{ GroceryItem : contains
    PlanSwapTracker ||--o{ SwapLog : records
```

### 5.3 Critical Table Details & Constraints
* **`User`**: Primary account record (`id`, `name`, `email`, `passwordHash`, `role`, `emailVerified`, `onboardingDone`, `tosAccepted`, `image`).
  * Note: `name` is stored as a single consolidated string. The frontend splits this into First/Last name for display where appropriate.
* **`UserProfile`**: Biometric data (`age`, `biologicalSex`, `heightCm`, `weightKg`, `targetWeightKg`, `goal`, `activityLevel`, `dietaryPreference`, `carbPreference`, `foodCulture`, `dailyCalorieTarget`, `otherConditions`, `otherAllergies`, `shoppingDayGroup`, `lastCheckinAt`, `checkinStreak`).
* **`Allergy`**: Maps to table `Allgy` via `@@map("Allgy")` to preserve legacy database schema compatibility.
* **`MealPlan`**: Represents scheduled meal slots (`id`, `planGroupId`, `userId`, `status`, `mealType`, `mealName`, `calories`, `proteinG`, `carbsG`, `fatG`, `aiConfidenceFlag`, `planType`, `scheduledDate`, `claimedByNutritionistId`, `claimedAt`).
  * **Date Rule**: Uses `scheduledDate` (DateTime) for scheduled calendar dates.
* **`MealLog`**: Represents actual consumed/skipped meal records (`id`, `userId`, `mealPlanId`, `source`, `mealName`, `calories`, `macros`, `dataSource`, `status`, `loggedAt`).
  * **Date Rule**: Uses `loggedAt` (DateTime) for timestamps when items were checked off.
* **`MealLibrary`**: Nutritionist-approved recipe pool (`id`, `verifiedByNutritionistId`, `mealName`, `mealType`, `calories`, `suitableConditions`, `allergenFree`, `dietaryTags`, `status`, `usageCount`).
* **`PlanSwapTracker` / `SwapLog`**: Tracks user swap allowances per weekly `planGroupId` (`swapsUsed`, max 3) and records historical calorie deltas.

---

## 6. User Roles and Permissions

| Role | Accessible Routes / Portals | Key Responsibilities & Capabilities |
|---|---|---|
| **`USER`** | `/dashboard`, `/meals`, `/grocery`, `/progress`, `/profile`, `/export`, `/nutrition-report`, `/onboarding/*` | View personalized meal plans, check off eaten meals, log outside meals, swap up to 3 meals/week, download grocery/report PDFs, record weigh-ins, customize pixel-art avatar. |
| **`NUTRITIONIST`** | `/nutritionist/reviews`, `/nutritionist/library`, `/nutritionist/approved`, `/nutritionist/profile` | Operate as internal NutriMind staff: audit the shared pending-meal queue, approve plans with notes, reject and regenerate flagged meals, manage verified library recipes, and flag peer-reviewed recipes for clinical inaccuracy. |
| **`ADMIN`** | `/admin/overview`, `/admin/users`, `/admin/nutritionists`, `/admin/analytics` | Verify nutritionist credentials against PRC license database, view and search all platform users, inspect system analytics and AI usage statistics. |

### Permission Enforcement
* **Backend**: Enforced at the route level using `authenticate` (JWT validator) followed by `requireRole('USER' | 'NUTRITIONIST' | 'ADMIN')` in `src/middleware/rbac.ts`.
* **Frontend**: Enforced globally by `<RouteGuard />` in `src/components/shared/RouteGuard.tsx` and dynamically reflected in navigation items via `src/components/ui/Sidebar.tsx`.

---

## 7. Authentication and Security

### 7.1 Authentication Architecture
1. **Password Hashing**: `bcryptjs` with salt work factor of 12 rounds.
2. **Access Tokens**: Short-lived JWT (15 minutes), payload: `{ userId, email, role }`.
3. **Refresh Tokens**: Long-lived JWT (7 days) transmitted through the `HttpOnly`, `SameSite=Lax`, production-secure `nutrimind_refresh` cookie. The token is not persisted as a rotating/revocable `Session`; logout deletes session rows, but issuance does not create corresponding session records.
4. **Google OAuth 2.0**: Backend validates Google ID tokens via `OAuth2Client.verifyIdToken()` (`google-auth-library`). If the user does not exist, an account is created with `emailVerified = true` and a random secure hash.
5. **Email Verification**: 6-digit numeric OTP generated via `crypto.randomInt`, expiring in 24 hours. Emails dispatched via Nodemailer SMTP.

### 7.2 Security Guardrails & Hardening
* **Helmet**: Enforces HTTP security headers across all Express responses.
* **CORS**: Strictly whitelists `http://localhost:3000` and `http://localhost:3001` with `credentials: true`.
* **Rate Limiting**:
  * `authLimiter`: Strict limiter applied to brute-force targets (`/login`, `/register`, `/forgot-password`, `/google`).
  * `apiLimiter`: General API limiter (500 req/15min in development, 100 req/15min in production).
* **SQL Injection & ORM Safety**: All database interactions utilize Prisma parameterized queries. No raw unchecked SQL strings are executed.
* **Error Sanitization**: `src/lib/sanitizeError.ts` strips database connection strings, stack traces, and internal Prisma errors before sending responses to the client.
* **Claim Locking**: Nutritionist review uses a 30-minute `claimedAt` convention, but the read-then-update claim path is not proven atomic and does not fully prevent simultaneous-claim races.

---

## 8. Existing Features Inventory

> **Legacy inventory notice:** The `Complete` cells below are preserved as historical claims and are superseded. They do not mean runtime-tested, integration-tested, E2E-tested, deployed, or clinically reviewed. Use the feature implementation table in `docs/NUTRIMIND_ENGINEERING_RECORD.md` for current classifications and gaps.

| Feature | Description | Key Source Files | Database Tables | Legacy status (superseded) |
|---|---|---|---|---|
| **Stateless JWT + Refresh Auth** | Complete auth lifecycle with silent Axios token refresh | `auth.service.ts`, `auth.controller.ts`, `axios.ts`, `AuthContext.tsx` | `User`, `Session`, `Account` | Complete |
| **Google Sign-In** | One-tap Google OAuth login and registration | `GoogleSignInButton.tsx`, `auth.service.ts`, `auth.controller.ts` | `User`, `Account` | Complete |
| **Email OTP Verification** | 6-digit email verification with auto-redirect | `verify-email/page.tsx`, `email.ts`, `auth.service.ts` | `User` | Complete |
| **Biometric Onboarding Wizard** | 5-step clinical intake with goal-aware target weight validation | `(onboarding)/onboarding/*`, `user.service.ts` | `UserProfile`, `HealthCondition`, `Allergy` | Complete |
| **AI Nutrition Report** | Clinical dietary recommendations with PDF download | `nutrition-report/page.tsx`, `nutrition-report.service.ts`, `pdf.tsx` | `NutritionReport`, `User` | Complete |
| **7-Day Plan Generation** | Gemini AI + FNRI food lookup 21-meal generator | `meal-generation.service.ts`, `meals.controller.ts`, `fnri.ts` | `MealPlan`, `MealIngredient`, `FoodItem` | Complete |
| **Shopping-Day Anchored Cycles** | Weekend/Weekday cycle alignment with Starter bridge plans | `meal-generation.service.ts`, `cron.service.ts` | `UserProfile`, `MealPlan` | Complete |
| **Visual Dashboard & Calorie Ring** | Real-time SVG macro ring, date switcher, water logging | `dashboard/page.tsx`, `CalorieRing.tsx`, `MealCard.tsx` | `MealPlan`, `MealLog`, `DailyNutritionLog` | Complete |
| **Unified /meals Page** | Plan grid, history filter, library browser, swap UI | `(user)/meals/page.tsx`, `MealCard.tsx` | `MealPlan`, `MealLog`, `MealLibrary` | Complete |
| **Outside Meal Logging** | Freestyle meal logging with AI macro estimation & warnings | `meal-log.service.ts`, `health-validation.service.ts` | `MealLog`, `HealthCondition`, `Allergy` | Complete |
| **Meal Swapping System** | Profile-constrained swaps with 3/week cap & ±15% calorie delta alert | `meal-swap.service.ts`, `meals.controller.ts`, `(user)/meals/page.tsx` | `PlanSwapTracker`, `SwapLog`, `MealLibrary` | Complete |
| **Grocery List & PDF Export** | Auto-categorized checklist with checkboxes and PDF streaming | `grocery.service.ts`, `grocery.controller.ts`, `pdf.tsx`, `grocery/page.tsx` | `GroceryList`, `GroceryItem` | Complete |
| **Weight & Progress Tracker** | Weight log entries, SVG chart, and calorie adherence metrics | `progress.service.ts`, `weight-log.service.ts`, `progress/page.tsx` | `WeightLog`, `DailyNutritionLog` | Complete |
| **Weekly Check-In Modal** | 2-step Sunday check-in with conditional plan regeneration | `CheckinModal.tsx`, `checkin.service.ts`, `dashboard/page.tsx` | `UserProfile`, `MealPlan` | Complete |
| **Notification Dropdown** | Polling notification bell with read status mutation | `NotificationDropdown.tsx`, `notification.service.ts`, `useNotifications.ts` | `Notification` | Complete |
| **Nutritionist Review Portal** | Audit queue with severity sorting, claim locks, approve/reject | `(nutritionist)/nutritionist/reviews/page.tsx`, `nutritionist.service.ts` | `MealPlan`, `NutritionistProfile`, `Notification` | Complete |
| **Meal Library CRUD & Flags** | Verified recipe CRUD and cross-RND peer flagging | `(nutritionist)/nutritionist/library/page.tsx`, `nutritionist.service.ts` | `MealLibrary`, `MealLibraryFlag` | Complete |
| **Admin Verification Portal** | RND PRC license validation and user account management | `(admin)/admin/nutritionists/page.tsx`, `admin.service.ts` | `NutritionistProfile`, `User` | Complete |
| **DiceBear Pixel-Art Avatars** | Custom seed text input, presets, live preview, and sync | `profile/page.tsx`, `Avatar.tsx`, `user.service.ts` | `User` | Complete |
| **Mid-Plan Safety Recheck** | Automatic conflict scan and library swap on profile updates | `user.service.ts` (`runSafetyRecheck`) | `MealPlan`, `MealLibrary`, `HealthCondition` | Complete |

---

## 9. Incomplete or Planned Features

### Confirmed Incomplete / Future Roadmap
1. **Automated Unit & Integration Test Suite**: The repository lacks an automated unit, integration, or Playwright E2E suite. Historical manual-testing reports were not re-verified during the current baseline.
2. **Push Notifications (Web Push / Service Worker)**: The notification system currently operates on client-side interval polling (60s). Native Web Push via service workers is not yet wired.
3. **Multi-Nutritionist Real-Time Collaboration**: The 30-minute claim lock mechanism is polling-based and stored in PostgreSQL; WebSockets are not implemented.

### Inferred / Non-Blocking Observations
* Consumer nutritionist hiring and assigned-patient views are intentionally absent. Nutritionists are internal staff reviewers working from a shared queue rather than individually assigned providers.

---

## 10. Current Coding Conventions

### 10.1 Architecture Pattern
* **Backend intended direction**: 3-tier-style layering:
  $$\text{Routes (validation \& RBAC)} \longrightarrow \text{Controllers (HTTP parsing)} \longrightarrow \text{Services (business logic \& DB)}$$
  * New work should keep domain rules in services. Current controllers and routes still contain direct Prisma access, so strict layering is a target rather than verified current behavior.
* **Frontend**: Next.js App Router:
  $$\text{Page Component} \longrightarrow \text{Custom Hook / Context} \longrightarrow \text{Axios Instance (`@/lib/axios`)}$$
* **Standard API Response Shape**:
  ```typescript
  interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
  }
  ```

### 10.2 TypeScript & Error Handling
* **No `any` in New Catch Blocks**: Use `catch (error: unknown)` and inspect with `if (error instanceof Error)` or `axios.isAxiosError(error)`.
* **Sanitize Errors**: Backend routes must wrap exceptions using `sanitizeErrorMessage(error, fallbackText)` from `@/lib/sanitizeError`.

### 10.3 Styling & Design Tokens
* **Theme**: Premium Light Theme with clean off-white background (`#fbfdfc`), dark forest charcoal typography (`#111b15`), white card surfaces (`#ffffff`), and Sage Green secondary accents (`#e3efea`).
* **Dark Mode**: Claude-inspired dark charcoal background (`#1c201e`), card surfaces (`#282f2b`), soft green-white text (`#e8ece9`), and brand green accents (`#52B788`).
* **Bold Borders**: Globally configured 2px solid outlines (`border-2 border-brand-border`).
* **Typography**: Headings use `font-display` (Plus Jakarta Sans); body text uses `font-sans` (DM Sans / Inter).
* **Badge Component**: Only accepts exact variants: `'verified' | 'pending' | 'rejected' | 'ai' | 'user'`. Never pass arbitrary strings.

---

## 11. Rules for Future Agents (Codex Operational Rules)

1. **Inspect Before Editing**: Always read the destination file and its immediate dependencies before making modifications.
2. **Preserve Working Features**: Do not refactor or rewrite functioning modules unless explicitly instructed to fix a verified bug.
3. **One Goal at a Time**: Focus on the specific task requested. Do not make opportunistic edits across unrelated modules.
4. **No Placeholders or Mock Data**: Never insert `// TODO: implement later`, dummy JSON objects, `placeholder.png`, or hardcoded names/calories.
5. **Honor the 3-Tier Backend Pattern**: Keep HTTP handling in Controllers and database/AI operations in Services.
6. **Preserve Database Schema Integrity**: Never rename tables, columns, relations, or enum values in `schema.prisma`. Any required schema change must be accompanied by an explicit explanation and a Prisma migration.
7. **No Extra Frameworks / Libraries**: Do not install additional npm packages without explicit confirmation.
8. **Follow Established Design Tokens**: Adhere to existing Tailwind classes, bold 2px borders, and Badge variants.
9. **Never Commit Secrets**: Do not write real API keys, database credentials, or private secrets into source code or markdown files.
10. **Verify Compilation After Changes**: Always execute verification commands before concluding work:
    * Backend: `npx tsc --noEmit` in `backend` (Must return 0 errors).
    * Frontend: `npx next build` in `frontend` (Must complete with 0 errors).

---

## 12. Change-Safety Protocol

When modifying this repository, Codex must follow this 9-step execution protocol:

```
┌────────────────────────────────────────────────────────┐
│ 1. Read AGENTS.md and relevant source files            │
├────────────────────────────────────────────────────────┤
│ 2. Identify all affected dependencies and schemas      │
├────────────────────────────────────────────────────────┤
│ 3. Formulate a minimal, non-breaking execution plan    │
├────────────────────────────────────────────────────────┤
│ 4. Make surgical, targeted code edits                  │
├────────────────────────────────────────────────────────┤
│ 5. Verify database constraints and types               │
├────────────────────────────────────────────────────────┤
│ 6. Run `tsc --noEmit` on Backend (0 errors)            │
├────────────────────────────────────────────────────────┤
│ 7. Run `next build` on Frontend (0 errors)             │
├────────────────────────────────────────────────────────┤
│ 8. Test end-to-end user workflows in browser           │
├────────────────────────────────────────────────────────┤
│ 9. Document modified files and any residual risks      │
└────────────────────────────────────────────────────────┘
```

---

## 13. Development Commands

### 13.1 Installation & Setup
```bash
# Backend Setup
cd backend
npm install
npx prisma generate

# Frontend Setup
cd ../frontend
npm install
```

### 13.2 Database Migrations & Seeding
```bash
# Run Prisma Migrations
cd backend
npx prisma migrate dev --name <migration_name>

# Seed FNRI Food Database (~1,500 local food items)
npm run seed

# Seed Test Accounts (Admin and Nutritionist)
npx tsx prisma/seed-test-accounts.ts
```

### 13.3 Development Servers
```bash
# Start Backend API (runs on http://localhost:5000)
cd backend
npm run dev

# Start Frontend Dev Server (runs on http://localhost:3000)
cd frontend
npm run dev
```

### 13.4 Validation & Production Builds
```bash
# Backend Type Check
cd backend
npm run build        # runs tsc

# Frontend Production Build Check
cd frontend
npm run build        # runs next build
npm run lint         # runs next lint
```

---

## 14. Environment and Configuration

### 14.1 Backend Environment (`backend/.env`)
| Variable | Description | Example / Format |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string with SSL | `postgresql://user:pass@ep-xxx.neon.tech/nutrimind?sslmode=require` |
| `PORT` | API server port (Default: 5000) | `5000` |
| `NODE_ENV` | Environment mode | `development` or `production` |
| `JWT_SECRET` | 64-byte hex string for access token signing | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | 64-byte hex string for refresh token signing | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `GEMINI_API_KEY` | Google AI Studio API key | `AIzaSy...` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | `139603230965-xxx.apps.googleusercontent.com` |
| `CRON_SECRET` | Secret token guarding `/api/cron/*` routes | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SMTP_HOST` | SMTP server hostname | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username / email address | `example@gmail.com` |
| `SMTP_PASS` | SMTP App password (MUST be quoted in `.env`) | `"xxxx xxxx xxxx xxxx"` |
| `EMAIL_FROM` | Outgoing sender email address | `NutriMind <noreply@nutrimind.app>` |
| `FRONTEND_URL` | Frontend origin for CORS and email links | `http://localhost:3000` |

### 14.2 Frontend Environment (`frontend/.env.local`)
| Variable | Description | Value |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL for backend REST API | `http://localhost:5000/api` |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth Client ID matching backend | `139603230965-xxx.apps.googleusercontent.com` |

---

## 15. Important Module Dependencies

1. **`MealPlan` $\longleftrightarrow$ `MealIngredient` $\longleftrightarrow$ `FoodItem`**: `MealPlan` items contain multiple `MealIngredient` child records. Each ingredient optionally links to a `FoodItem` resolved through the FNRI database. Deleting a meal plan cascades to its ingredients.
2. **`MealPlan` $\longleftrightarrow$ `GroceryList`**: Generating or swapping a meal triggers `GroceryService.generateGroceryListFromPlan()`, which extracts unique ingredients across scheduled days and groups them into categorized checklist items (`GroceryItem`).
3. **`UserProfile` $\longleftrightarrow$ `HealthCondition` / `Allergy` $\longleftrightarrow$ `MealSwapService`**: The meal swapping engine strictly filters `MealLibrary` recipes against the user's active health conditions and allergens.
4. **`NutritionistProfile` $\longleftrightarrow$ `MealPlan` / `MealLibrary`**: Nutritionist reviews link to the reviewer's `NutritionistProfile`. Verifying a nutritionist updates their user `Role` from `USER` to `NUTRITIONIST`.
5. **`AuthContext` $\longleftrightarrow$ `RouteGuard` $\longleftrightarrow$ `Axios Interceptor`**: User state updates in `AuthContext` drive route protections in `<RouteGuard />`, while 401 expiration signals trigger silent token refresh in `src/lib/axios.ts`.

---

## 16. Known Risks and Technical Debt

| Priority | Issue / Risk | Location | Detail & Safe Mitigation |
|---|---|---|---|
| **HIGH** | **VPN / Neon Connection Blocker** | Neon PostgreSQL | Neon serverless database connections will fail if a strict VPN or corporate firewall blocks port 5432. Disable VPN if `P1001: Can't reach database server` occurs. |
| **HIGH** | **SMTP App Password Spacing** | `backend/.env` | Gmail App Passwords contain spaces. If `SMTP_PASS` is not wrapped in quotes, dotenv reads only the first word and email dispatch fails silently. Always use `SMTP_PASS="xxxx xxxx xxxx xxxx"`. |
| **MEDIUM** | **Google OAuth Port Lock** | Google Cloud Console | Authorized JavaScript Origin is hardcoded to `http://localhost:3000`. If Next.js starts on port 3001, Google OAuth returns `Error 400: origin_mismatch`. Kill any stale processes on port 3000. |
| **MEDIUM** | **Legacy Catch Blocks (`catch (error: any)`)** | Backend Services | Approximately 40 legacy catch blocks use `any`. All new code must strictly use `catch (error: unknown)` with type guards. |
| **LOW** | **Gemini Model Deprecation Guard** | `src/lib/gemini.ts` | Gemini 1.5 and 2.0 models are deprecated. The model fallback sequence must remain pinned to current models (`gemini-3.5-flash`, `gemini-2.5-flash`, `gemini-3.1-flash-lite`, `gemini-2.5-pro`). |

---

## 17. Areas That Must Not Be Changed Casually

1. **`prisma/schema.prisma`**: The schema models are heavily interconnected. Changing model names, foreign keys, or enum identifiers breaks API contracts and requires complex database migrations.
2. **`src/lib/calculations.ts` (Mifflin-St Jeor Constants)**: The BMR formulas (`+5` for Male, `-161` for Female) are clinically standardized. Do not alter formula multipliers.
3. **`src/lib/axios.ts` Interceptor Logic**: The 401 retry queue and `isRefreshing` lock prevent infinite refresh loops and race conditions during simultaneous API calls.
4. **`<RouteGuard />` Sequence**: The 6-tier onboarding and role verification chain ensures patients cannot bypass clinical disclaimers or access unauthorized administrative endpoints.
5. **`Badge.tsx` Variants**: Only `'verified'`, `'pending'`, `'rejected'`, `'ai'`, and `'user'` are accepted by the styling engine.

---

## 18. Recommended Development Order

If extending the platform or addressing future capstone requirements, follow this recommended progression:

```
┌────────────────────────────────────────────────────────┐
│ 1. Automated Test Suite (Jest / Vitest for Services)   │
├────────────────────────────────────────────────────────┤
│ 2. Web Push Notifications & Service Worker Integration │
├────────────────────────────────────────────────────────┤
│ 3. Multi-Nutritionist Real-Time WebSocket Review Queue │
├────────────────────────────────────────────────────────┤
│ 4. Enhanced Micronutrient Analytics & PDF Export Polish│
├────────────────────────────────────────────────────────┤
│ 5. Production Containerization (Docker / Cloud Run)    │
└────────────────────────────────────────────────────────┘
```

---

## 19. Source-of-Truth Files

When starting a task, inspect these primary files first:

| Purpose | File Path |
|---|---|
| **Database Schema & Enums** | `backend/prisma/schema.prisma` |
| **Backend App & Route Map** | `backend/src/app.ts` |
| **AI Generation Engine** | `backend/src/services/meal-generation.service.ts` |
| **Food Composition Lookup** | `backend/src/lib/fnri.ts` |
| **Gemini AI Client** | `backend/src/lib/gemini.ts` |
| **Frontend Root & Auth Provider** | `frontend/src/app/layout.tsx` |
| **Frontend Route Guard** | `frontend/src/components/shared/RouteGuard.tsx` |
| **Axios Interceptor** | `frontend/src/lib/axios.ts` |
| **Tailwind Tokens & Design System** | `frontend/tailwind.config.ts` |
| **Master System Prompt** | `AI_AGENT_PROMPT.md` |

---

## 20. Uncertainties and Verification Notes

1. **Email Service in Production**:
   * *Uncertainty*: Currently configured to use Gmail SMTP credentials via Nodemailer for development testing.
   * *Action for Developer*: For production deployment at scale, consider configuring a dedicated transactional email provider (e.g., Resend, SendGrid, or AWS SES).
2. **Production Cron Scheduler**:
   * *Uncertainty*: The cron routes (`/api/cron/*`) are secured by `CRON_SECRET`, but automated recurring execution in production depends on an external scheduler (e.g., Vercel Cron, Google Cloud Scheduler, or GitHub Actions).
   * *Action for Developer*: Ensure an external HTTP scheduler is configured to trigger these endpoints on Saturday/Sunday midnight.
3. **Pre-Existing Test Accounts**:
   * The database includes pre-seeded accounts for testing:
     * **User**: `chimairelp@gmail.com` / `Chimairel123`
     * **Admin**: `admin@gmail.com` / `Admin123`
     * **Nutritionist**: `nutritionist@gmail.com` / `Nutritionist123`
   * *Rule*: Do not delete or re-register these test accounts. Log in directly using these credentials during QA.
