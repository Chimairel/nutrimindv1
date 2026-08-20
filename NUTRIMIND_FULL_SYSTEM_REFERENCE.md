# NutriMind — Comprehensive System Reference Document

> **Documentation status — Current but unverified snapshot; partially superseded (August 19, 2026):** This draft contains useful system history and design material, but its implementation and “complete” claims are not proof of runtime, integration, E2E, deployment, or clinical verification. The canonical living evidence source is [`docs/NUTRIMIND_ENGINEERING_RECORD.md`](docs/NUTRIMIND_ENGINEERING_RECORD.md).
## For SPMP, SRS & SDD Documentation Generation

> **Document Status:** Draft System Reference (Living Document)
> **Last Updated:** August 7, 2026
> **Project Start Date:** June 2, 2026
> **Primary Developer:** Pacaldo Chimairel
> **AI Development Assistants:** Claude (Antigravity IDE), Gemini 3.5 Flash, Codex AI
> **Repository:** Monorepo (`App2_vibecode/`) containing both `nutrimind-backend/` and `nutrimind-frontend/`

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Architecture](#3-system-architecture)
4. [Database Schema](#4-database-schema)
5. [Backend API Reference](#5-backend-api-reference)
6. [Frontend Pages & Components](#6-frontend-pages--components)
7. [AI Integration (Gemini)](#7-ai-integration-gemini)
8. [Clinical Safety Layer](#8-clinical-safety-layer)
9. [Design System](#9-design-system)
10. [Development Timeline & Changelog](#10-development-timeline--changelog)
11. [Known Issues & Technical Debt](#11-known-issues--technical-debt)
12. [Deployment & Environment](#12-deployment--environment)
13. [Functional Requirements (SRS)](#13-functional-requirements-srs)
14. [Non-Functional Requirements (SRS)](#14-non-functional-requirements-srs)
15. [Use Cases (SRS)](#15-use-cases-srs)
16. [Business Rules & Domain Logic (SRS)](#16-business-rules--domain-logic-srs)
17. [Constraints, Assumptions & Dependencies (SRS)](#17-constraints-assumptions--dependencies-srs)

---

## 1. Project Overview

### 1.1 What is NutriMind?
NutriMind is an AI-powered nutrition and meal planning web application tailored specifically for **Filipino users**. The system generates personalized 7-day meal plans using Google's Gemini AI, validated against the **FNRI (Food and Nutrition Research Institute) Philippine Food Composition Table** — the official Philippine government food nutrient database.

### 1.2 Core Mission
- Provide **culturally relevant** Filipino meal plans (adobo, sinigang, pinakbet, etc.)
- Enforce **clinical safety guardrails** for users with health conditions (diabetes, hypertension, kidney disease, pregnancy)
- Enable **licensed Registered Nutritionist-Dietitians (RNDs)** to review and approve AI-generated plans
- Track daily calorie/macro adherence with analytics

### 1.3 User Roles
| Role | Description | Access |
|------|-------------|--------|
| **USER** | Regular end-user (patient) | Dashboard, meal plans, meal logging, grocery lists, progress tracking, profile |
| **NUTRITIONIST** | Licensed RND professional | Review queue, meal library CRUD, patient plan approval/rejection, flagging |
| **ADMIN** | System administrator | User management, nutritionist verification, analytics overview |

### 1.4 Project Structure
```
App2_vibecode/
├── nutrimind-backend/         # Express.js + Prisma + TypeScript API server
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema (496 lines, 22 models, 18 enums)
│   │   ├── seed.ts            # FNRI CSV food database seeder
│   │   └── migrations/        # PostgreSQL migration history
│   ├── src/
│   │   ├── app.ts             # Express app configuration & route mounting
│   │   ├── server.ts          # HTTP server entry point (port 5000)
│   │   ├── controllers/       # 5 controller files (auth, meals, grocery, progress, user)
│   │   ├── services/          # 15 service files (business logic layer)
│   │   ├── routes/            # 9 route files (API endpoint definitions)
│   │   ├── middleware/        # 4 middleware files (auth, RBAC, validation, rate limiting)
│   │   ├── lib/               # 8 utility files (JWT, email, Gemini, FNRI, calculations, PDF, sanitizer)
│   │   └── types/             # TypeScript type definitions
│   └── package.json
├── nutrimind-frontend/        # Next.js 14 + TailwindCSS + TypeScript client
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   │   ├── (admin)/       # Admin panel pages (overview, users, nutritionists)
│   │   │   ├── (auth)/        # Login & Register pages
│   │   │   ├── (nutritionist)/ # RND portal (reviews, library, patients, profile)
│   │   │   ├── (onboarding)/  # 6-step user onboarding wizard
│   │   │   ├── (user)/        # User dashboard, meals, grocery, progress, profile
│   │   │   ├── nutrition-report/ # AI-generated nutrition report viewer
│   │   │   └── unauthorized/  # Access denied page
│   │   ├── components/
│   │   │   ├── auth/          # GoogleSignInButton
│   │   │   ├── shared/        # RouteGuard, Navbar, LoadingSpinner, EmptyState
│   │   │   ├── ui/            # 12 reusable UI components
│   │   │   └── user/          # MealCard, CalorieRing, CheckinModal
│   │   ├── hooks/             # useAuth custom hook
│   │   ├── lib/               # Axios instance with interceptors
│   │   └── types/             # Shared TypeScript interfaces
│   └── package.json
├── fnri_foods.csv             # FNRI food composition source data (~1,500 items)
├── NUTRIMIND_MASTER_PROMPT.md # Original system specification document
├── AI_AGENT_PROMPT.md         # AI coding agent rules & guidelines
└── UPDATE_LOG.md              # Feature changelog with dates
```

---

## 2. Technology Stack

### 2.1 Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20+ | Runtime environment |
| **Express.js** | 4.19.2 | HTTP server framework |
| **TypeScript** | 5.4.5 | Type-safe development |
| **Prisma ORM** | 5.14.0 | Database access layer & migrations |
| **PostgreSQL** | 16+ | Primary relational database |
| **Google Generative AI SDK** | 0.11.0 | Gemini API integration for meal plan generation |
| **JSON Web Tokens (jsonwebtoken)** | 9.0.2 | Stateless authentication |
| **bcryptjs** | 2.4.3 | Password hashing |
| **Zod** | 4.4.3 | Runtime schema validation for AI responses |
| **nodemailer** | 8.0.10 | Email sending (verification, password reset) |
| **Helmet** | 7.1.0 | HTTP security headers |
| **express-rate-limit** | 8.5.2 | API rate limiting |
| **express-validator** | 7.1.0 | Request body validation |
| **cookie-parser** | 1.4.7 | HttpOnly cookie parsing |
| **google-auth-library** | 10.7.0 | Google OAuth token verification |
| **@react-pdf/renderer** | 3.4.4 | Server-side PDF generation for nutrition reports |
| **tsx** | 4.10.5 | TypeScript execution (dev server) |

### 2.2 Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14.2.35 | React framework with App Router |
| **React** | 18.x | UI library |
| **TypeScript** | 5.x | Type-safe development |
| **TailwindCSS** | 3.4.1 | Utility-first CSS framework |
| **Axios** | 1.16.1 | HTTP client with interceptors |
| **Radix UI** | Various | Accessible headless UI primitives (Dialog, Checkbox, Tabs, Progress, Avatar) |
| **Lucide React** | 1.21.0 | Professional SVG icon library |
| **jwt-decode** | 4.0.0 | Client-side JWT payload extraction |

### 2.3 External Services
| Service | Purpose |
|---------|---------|
| **Google Gemini AI** (gemini-2.5-flash, with fallback chain) | Meal plan generation, nutrient estimation, nutrition reports |
| **Google OAuth 2.0** | Social sign-in |
| **DiceBear API** (`pixel-art` style) | User avatar generation |
| **YouTube** (via search URL) | Cooking tutorial links for each meal |

---

## 3. System Architecture

### 3.1 High-Level Architecture
```
┌──────────────────┐         ┌──────────────────┐        ┌────────────────┐
│   Next.js 14     │  HTTP   │   Express.js     │  SQL   │  PostgreSQL    │
│   Frontend       │ ──────> │   Backend API    │ ─────> │  Database      │
│   (Port 3000)    │  JSON   │   (Port 5000)    │ Prisma │                │
└──────────────────┘         └──────────────────┘        └────────────────┘
                                     │
                                     │ HTTPS
                                     ▼
                            ┌──────────────────┐
                            │  Google Gemini   │
                            │  AI API          │
                            └──────────────────┘
```

### 3.2 Authentication Flow
1. **Registration**: User submits `name`, `email`, `password` → backend hashes password with bcrypt → creates User record → generates 6-digit email verification OTP → sends verification email → returns access token + sets refresh token as HttpOnly cookie
2. **Login**: User submits `email`, `password` → backend verifies bcrypt hash → generates JWT access token (15-min expiry) + refresh token (7-day expiry) → refresh token stored in `nutrimind_refresh` HttpOnly secure cookie → access token returned in JSON body
3. **Token Refresh**: Frontend Axios interceptor catches `401 Unauthorized` → silently calls `POST /api/auth/refresh` with HttpOnly cookie → backend verifies refresh token → issues new access token → retries queued requests
4. **Google OAuth**: Frontend sends Google credential token → backend verifies with `google-auth-library` → creates/updates User with `emailVerified: true` → returns JWT tokens

### 3.3 Meal Plan Generation Pipeline
```
User Completes Onboarding
         │
         ▼
Calculate Daily Calorie Target (Mifflin-St Jeor)
         │
         ▼
Generate Nutrition Report (Gemini AI)
  ├── Foods to avoid (based on conditions)
  ├── Foods to limit
  ├── Recommended foods
  └── Drinks guidance
         │
         ▼
Generate 7-Day Meal Plan (Gemini AI)
  ├── 4 meals per day (Breakfast, Lunch, Dinner, Snack)
  ├── Must match calorie target ±15%
  ├── Filipino cuisine (cultural context)
  └── Avoid allergens + condition-restricted foods
         │
         ▼
FNRI Ingredient Matching (4-tier fallback)
  ├── 1. Exact name match in FoodItem table
  ├── 2. Alias match in FoodAlias table
  ├── 3. Fuzzy/partial text match
  └── 4. Gemini AI estimation (flagged as GEMINI_ESTIMATED)
         │
         ▼
Save MealPlan + MealIngredient records
  └── Status: PENDING_REVIEW (awaiting RND verification)
```

### 3.4 Calorie Calculation Formula (Mifflin-St Jeor)
```
BMR (Male):   10 × weight(kg) + 6.25 × height(cm) − 5 × age + 5
BMR (Female): 10 × weight(kg) + 6.25 × height(cm) − 5 × age − 161

Activity Multipliers:
  SEDENTARY:      × 1.2
  LIGHTLY_ACTIVE: × 1.375
  ACTIVE:         × 1.55
  VERY_ACTIVE:    × 1.725

TDEE = BMR × Activity Multiplier

Daily Target:
  LOSE_WEIGHT:  TDEE − 500 kcal
  GAIN_WEIGHT:  TDEE + 500 kcal
  MAINTAIN:     TDEE
  BUILD_MUSCLE: TDEE + 300 kcal

Minimum floor: 500 kcal (starvation prevention)
```

---

## 4. Database Schema

### 4.1 Enums (18 total)
| Enum | Values |
|------|--------|
| `Role` | USER, NUTRITIONIST, ADMIN |
| `Goal` | LOSE_WEIGHT, GAIN_WEIGHT, MAINTAIN, BUILD_MUSCLE |
| `ActivityLevel` | SEDENTARY, LIGHTLY_ACTIVE, ACTIVE, VERY_ACTIVE |
| `DietaryPreference` | OMNIVORE, VEGETARIAN, VEGAN, PESCATARIAN |
| `CarbPreference` | LOW, MODERATE, HIGH |
| `HealthConditionType` | DIABETES, HYPERTENSION, KIDNEY_DISEASE, HEART_CONDITION, PREGNANT, NONE |
| `AllergenType` | SHELLFISH, NUTS, DAIRY, GLUTEN, EGGS, NONE |
| `MealType` | BREAKFAST, LUNCH, DINNER, SNACK |
| `MealPlanStatus` | PENDING_REVIEW, APPROVED, REJECTED, CANCELLED |
| `AIConfidenceFlag` | SAFE, CAUTION, NEEDS_REVIEW |
| `MealLogSource` | SYSTEM_GENERATED, USER_LOGGED, USER_SWAPPED, SAFETY_REPLACED |
| `MealLogDataSource` | FNRI, GEMINI_ESTIMATED, SYSTEM |
| `MealIngredientDataSource` | FNRI, GEMINI_ESTIMATED |
| `MealLogStatus` | DONE, PENDING, SKIPPED |
| `NotificationType` | PLAN_APPROVED, PLAN_REJECTED, REVIEW_REQUEST, ASSIGNMENT, WEEKLY_CHECKIN, MEAL_FLAGGED, FLAG_RESOLVED |
| `AssignmentStatus` | PENDING, ACTIVE, ENDED |
| `ShoppingDayGroup` | WEEKEND, WEEKDAY |
| `PlanType` | STARTER, WEEKLY |
| `MealLibraryStatus` | APPROVED, FLAGGED |
| `FlagStatus` | PENDING, RESOLVED_REMOVED, RESOLVED_KEPT |

### 4.2 Models (22 total)

#### Core User Models
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| **User** | id, name, email, passwordHash, role, emailVerified, onboardingDone, tosAccepted, image | Central user account |
| **Account** | userId, provider, providerAccountId, access_token | OAuth provider accounts (Google) |
| **Session** | userId, sessionToken, expires | Active session tracking |
| **UserProfile** | userId, age, biologicalSex, heightCm, weightKg, targetWeightKg, goal, activityLevel, dietaryPreference, carbPreference, foodCulture, dailyCalorieTarget, shoppingDayGroup, lastCheckinAt, checkinStreak | Biometric + clinical profile |
| **HealthCondition** | userId, condition (enum) | User's medical conditions |
| **Allergy** | userId, allergen (enum) | User's food allergies |

#### Nutrition & Reporting
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| **NutritionReport** | userId, foodsToAvoid (JSON), foodsToLimit (JSON), foodsRecommended (JSON), drinksGuidance (JSON), generalSummary, basedOnConditions (JSON), basedOnAllergies (JSON) | AI-generated clinical nutrition guidance |
| **FoodItem** | name, category, calories, proteinG, carbsG, fatG, fiber, sodium, potassium, calcium, iron, vitamins, source | FNRI food composition data (~1,500 entries) |
| **FoodAlias** | foodItemId, alias | Alternative names for FNRI foods |

#### Meal Planning
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| **MealPlan** | userId, planGroupId, mealType, mealName, description, calories, proteinG, carbsG, fatG, status, aiConfidenceFlag, planType, scheduledDate, nutritionistId, libraryMealId | Individual meal slot in a weekly plan |
| **MealLibrary** | mealName, mealType, calories, macros, suitableConditions (JSON), allergenFree (JSON), dietaryTags (JSON), verifiedByNutritionistId, status | Nutritionist-verified reusable recipes |
| **MealIngredient** | mealPlanId, foodItemId, ingredientName, category, dataSource | Ingredients linked to meal plans |

#### Logging & Tracking
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| **MealLog** | userId, mealPlanId, source, mealName, calories, macros, dataSource, status, warningType | Individual meal consumption records |
| **WeightLog** | userId, weightKg, loggedAt | Weight tracking entries |
| **DailyNutritionLog** | userId, logDate, totalCalories, totalProteinG, totalCarbsG, totalFatG, targetCalories, adherencePct | Daily nutrition aggregation |

#### Shopping & Grocery
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| **GroceryList** | userId, weekLabel, generatedAt | Weekly shopping list header |
| **GroceryItem** | groceryListId, ingredientName, category, isChecked | Individual grocery checklist items |

#### Notifications & Swapping
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| **Notification** | userId, title, message, type, isRead | In-app notification records |
| **PlanSwapTracker** | planGroupId, userId, swapsUsed | Tracks swap count per weekly cycle (max 3) |
| **SwapLog** | planSwapTrackerId, mealPlanId, originalMealName, newMealName, calorieDelta, warningShown | Individual swap transaction records |

#### Professional Review
| Model | Key Fields | Purpose |
|-------|-----------|---------|
| **NutritionistProfile** | userId, prcLicenseNumber, prcLicenseExpiry, specialization, yearsOfExperience, university, bio, isVerified, rating, totalVerified | Licensed RND professional profile |
| **MealLibraryFlag** | mealLibraryId, flaggedByNutritionistId, reason, status | Cross-RND quality control flags |

---

## 5. Backend API Reference

### 5.1 Authentication Routes (`/api/auth`)
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/register` | Create new account (name, email, password) | No |
| POST | `/login` | Authenticate with email/password | No |
| POST | `/refresh` | Silent token refresh via HttpOnly cookie | No (cookie-based) |
| POST | `/logout` | Clear refresh token cookie | No |
| POST | `/google` | Google OAuth sign-in/sign-up | No |
| GET | `/verify-email/:token` | Verify email OTP | No |
| POST | `/forgot-password` | Send password reset email | No |
| POST | `/reset-password` | Reset password with token | No |

### 5.2 User Routes (`/api/user`)
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/profile` | Get user profile details | USER |
| PUT | `/profile` | Update biometric/dietary profile | USER |
| PUT | `/profile/settings` | Update account settings (name, email, password) | USER |
| PUT | `/profile/avatar` | Update DiceBear avatar seed | USER |
| GET | `/profile/checkin-status` | Get weekly check-in streak status | USER |
| POST | `/profile/checkin` | Submit weekly check-in with weight | USER |
| POST | `/profile/conditions` | Update health conditions | USER |
| POST | `/profile/allergies` | Update allergies | USER |
| GET | `/nutrition-report` | Get AI nutrition report | USER |
| POST | `/nutrition-report` | Generate new nutrition report | USER |
| POST | `/nutrition-report/acknowledge` | Acknowledge report before plan generation | USER |
| GET | `/onboarding-status` | Check onboarding completion | USER |
| POST | `/generate-plan` | Trigger AI meal plan generation | USER |
| GET | `/export/pdf` | Download nutrition report as PDF | USER |

### 5.3 Meal Routes (`/api/user/meals`)
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/current-plan` | Get active weekly meal plan | USER |
| GET | `/:mealId` | Get detailed meal plan item | USER |
| PATCH | `/:mealId/status` | Toggle meal status (DONE/SKIPPED/PENDING) | USER |
| POST | `/log-outside` | Log a meal not in the plan (Gemini estimation) | USER |
| GET | `/pre-check` | Pre-check outside meal for allergen/condition warnings | USER |
| GET | `/history` | Get meal consumption history | USER |
| GET | `/library` | Browse approved meal library | USER |
| POST | `/:mealId/swap` | Swap a meal with a library/AI alternative | USER |

### 5.4 Grocery Routes (`/api/user/grocery`)
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/` | Get current grocery list | USER |
| PATCH | `/:itemId/check` | Toggle grocery item checkbox | USER |

### 5.5 Progress Routes (`/api/user/progress`)
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/weight-logs` | Get weight log history | USER |
| GET | `/daily-logs` | Get daily nutrition adherence logs | USER |

### 5.6 Nutritionist Routes (`/api/nutritionist`)
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/profile` | Get RND's own profile | NUTRITIONIST |
| GET | `/review-queue` | Get pending meal plans for review | NUTRITIONIST |
| POST | `/review/:planGroupId` | Approve or reject a plan group | NUTRITIONIST |
| GET | `/library` | List nutritionist's own library meals | NUTRITIONIST |
| POST | `/library` | Create a new library meal | NUTRITIONIST |
| PUT | `/library/:id` | Update an owned library meal | NUTRITIONIST |
| DELETE | `/library/:id` | Delete an owned library meal | NUTRITIONIST |
| POST | `/library/:id/flag` | Flag another RND's library meal | NUTRITIONIST |
| GET | `/stats` | Get verification statistics | NUTRITIONIST |

### 5.7 Admin Routes (`/api/admin`)
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/users` | List all users with pagination | ADMIN |
| GET | `/nutritionists` | List all nutritionist profiles | ADMIN |
| PATCH | `/nutritionists/:id/verify` | Verify/approve a nutritionist | ADMIN |
| GET | `/analytics` | Get system-wide analytics | ADMIN |

### 5.8 FNRI Routes (`/api/fnri`)
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/search?q=` | Search FNRI food database (for autocomplete) | Any authenticated |

### 5.9 Cron Routes (`/api/cron`)
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/weekly-checkin` | Trigger weekly check-in processing | CRON_SECRET |
| POST | `/weekly-regen` | Trigger weekly meal plan regeneration | CRON_SECRET |

---

## 6. Frontend Pages & Components

### 6.1 Auth Pages (`/login`, `/register`)
- Split-screen layout: left hero panel + right form panel
- **Design (updated July 16, 2026):** Warm cream background with grid lines, lime accent blobs, black pill logo, outlined headline text, feature pills, and decorative lime accent cards
- Google OAuth button + email/password form
- Links to forgot-password and cross-navigation

### 6.2 Onboarding Flow (6 steps)
1. `/onboarding/stats` — Biometrics: age, sex, height, weight, target weight, goal, activity level
2. `/onboarding/preferences` — Dietary preference, carb preference, food culture
3. `/onboarding/conditions` — Health condition multi-select chips
4. `/onboarding/allergies` — Allergen multi-select chips
5. `/onboarding/shopping-day` — Shopping day group selection (weekend/weekday)
6. `/onboarding/tos` — Terms of Service & clinical disclaimer acceptance

### 6.3 User Dashboard (`/dashboard`)
- **Horizontal Date Switcher** — 7-day tab bar showing plan dates, auto-selects today
- **Daily Wellness Summary Cards** (added July 10, 2026):
  - Check-In Streak (🔥 weeks)
  - Weight Progress (current vs target)
  - Interactive Water Intake Tracker (localStorage-persisted, ±250mL buttons)
- **Calorie Ring Gauge** — SVG ring showing consumed vs target calories
- **Macronutrient Budget Bars** — Protein, Carbs, Fat progress bars
- **Meal Cards Grid** — 4 cards per day (Breakfast, Lunch, Dinner, Snack)
- **Floating Action Button (+)** — Triggers outside meal logging modal
- **Check-In Modal** — Weekly weight check-in form

### 6.4 Meal Detail Page (`/dashboard/[mealId]`)
- Full meal breakdown: name, type, calories, macros
- Macro badge grid (Protein/Carbs/Fat with color-coded backgrounds)
- Description text
- **YouTube Cooking Tutorial Banner** (added July 10, 2026) — Dynamic link: `youtube.com/results?search_query=how+to+cook+{mealName}`
- Ingredients list as chips
- AI Estimation Warning (for PENDING_REVIEW status)
- Action buttons: Mark as Eaten, Skip Meal, Reset Status

### 6.5 Meals Page (`/meals`)
Three-tab interface:
- **Plan Tab** — Active weekly meal plan cards
- **History Tab** — Consumption log with status filters
- **Library Tab** — Browse approved nutritionist recipes

### 6.6 Grocery Page (`/grocery`)
- Auto-generated grocery checklist from active plan ingredients
- Category-grouped items with checkbox toggles
- Regenerates on plan swap

### 6.7 Progress Page (`/progress`)
- Weight trend line chart
- Daily adherence calendar
- Biometrics/preferences update cards
- Health conditions & allergies edit chips

### 6.8 Profile Page (`/profile`)
- Account settings (name, email, password change)
- DiceBear pixel-art avatar customizer with preset seeds and live preview
- Log Out button

### 6.9 Nutrition Report Page (`/nutrition-report`)
- AI-generated clinical nutrition guidance
- Sections: Foods to Avoid, Foods to Limit, Recommended Foods, Drinks Guidance
- Acknowledgment flow before plan generation
- PDF export capability

### 6.10 Nutritionist Portal
- `/nutritionist/reviews` — Review queue sorted by AI confidence (NEEDS_REVIEW → CAUTION → SAFE)
- `/nutritionist/library` — CRUD management for owned recipes
- `/nutritionist/patients` — (Currently simplified) Patient list
- `/nutritionist/profile` — RND profile view

### 6.11 Admin Panel
- `/admin/overview` — System analytics dashboard
- `/admin/users` — User management with pagination
- `/admin/nutritionists` — Nutritionist verification controls

### 6.12 Reusable UI Components (12)
| Component | File | Description |
|-----------|------|-------------|
| `AutocompleteInput` | AutocompleteInput.tsx | FNRI food search with dropdown suggestions |
| `Avatar` | Avatar.tsx | DiceBear pixel-art or Google OAuth image |
| `Badge` | Badge.tsx | Status badges (verified, pending, rejected) |
| `BottomNav` | BottomNav.tsx | Mobile bottom navigation bar (dark theme) |
| `Button` | Button.tsx | Primary (black), secondary, accent (lime), ghost variants |
| `Card` | Card.tsx | Rounded-3xl borderless cards with shadow |
| `Checkbox` | Checkbox.tsx | Radix UI checkbox wrapper |
| `Input` | Input.tsx | Rounded-full text inputs |
| `Modal` | Modal.tsx | Radix Dialog-based popup modals |
| `Progress` | Progress.tsx | Radix progress bar |
| `Sidebar` | Sidebar.tsx | Collapsible dark sidebar (rounded-[28px], floating) |
| `Tabs` | Tabs.tsx | Radix tabs wrapper |

---

## 7. AI Integration (Gemini)

### 7.1 Model Fallback Chain
The system attempts AI calls through a cascading model fallback for resilience:
1. `gemini-2.5-flash` (primary)
2. `gemini-2.0-flash` (fallback 1)
3. `gemini-1.5-flash` (fallback 2)
4. `gemini-1.5-pro` (fallback 3)

### 7.2 AI Use Cases
| Feature | Input | Output |
|---------|-------|--------|
| **Nutrition Report** | User conditions, allergies, dietary preferences | JSON: foodsToAvoid, foodsToLimit, foodsRecommended, drinksGuidance, generalSummary |
| **7-Day Meal Plan** | Daily calorie target, food culture, conditions, allergies, dietary preferences | JSON array: 28 meal objects (name, description, type, calories, macros, ingredients) |
| **Outside Meal Estimation** | Meal name string | JSON: estimated calories, protein, carbs, fat |
| **Ingredient FNRI Matching** | Ingredient name when no DB match found | JSON: estimated nutritional values |
| **Safety Recheck** | Meal ingredients vs updated conditions/allergies | Boolean conflict detection |

### 7.3 Schema Enforcement
All AI responses are validated against Zod schemas. If the response fails validation, the system:
1. Catches the Zod parse error
2. Re-prompts Gemini with the error message asking it to self-correct
3. Retries up to 3 times before failing gracefully

---

## 8. Clinical Safety Layer

### 8.1 Allergen Scanner
- **Robust matching** with diacritics normalization and word-boundary regex
- **Expanded Tagalog/Filipino allergen keywords** (e.g., "hipon" for shrimp, "gatas" for dairy)
- Scans each meal plan ingredient against the user's allergen list
- Flags conflicts with `warningType` field in MealLog

### 8.2 Health Condition Guardrails
- Sodium warnings for HYPERTENSION
- Sugar/carb warnings for DIABETES
- Protein/potassium restrictions for KIDNEY_DISEASE
- Safety-appropriate nutrition for PREGNANT users

### 8.3 Safety Recheck on Profile Update
When a user updates their health conditions or allergies:
1. System scans all remaining unconsumed meals in the active plan
2. Identifies ingredient conflicts with new conditions/allergies
3. Attempts to swap conflicting meals with compatible library alternatives (cap-exempt)
4. If no library match found, regenerates the slot via Gemini AI (marked as PENDING_REVIEW)

### 8.4 Swap Calorie Warning
Before confirming a meal swap, the system:
1. Calculates the calorie delta between original and replacement meals
2. If the day's total shifts outside ±15% of the user's daily target → shows warning modal
3. User can acknowledge and proceed or cancel the swap

---

## 9. Design System

### 9.1 Current Theme: Warm Cream + Lime (as of July 2026)
| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| `--brand-bg` | `#eaecdf` (warm cream) | `#121210` |
| `--brand-surface` | `#ffffff` (white cards) | `#1e2320` |
| `--brand-text` | `#1a1a17` | `#e8ece9` |
| `--brand-muted` | `#55554c` | `#88928d` |
| `--brand-green` | `#1b4332` (dark forest) | `#52b788` (bright green) |
| `--brand-accent` | `#c6ef4e` (lime green) | `#c6ef4e` |
| `--brand-border` | `#d0d2c5` | `#353e39` |

### 9.2 Design Influences (from Reference Mockup)
- **Floating layout**: `md:p-5` outer padding on all layout containers
- **Rounded sidebar**: `rounded-[28px]` floating dark sidebar (not edge-to-edge)
- **Transparent navbar**: No background fill, no borders
- **Grid background**: CSS linear-gradient grid lines on body and `.bg-brand-bg`
- **Pill-shaped elements**: Buttons use `rounded-full`, cards use `rounded-3xl`
- **Background grid lines**: `background-size: 20px 20px` subtle gridlines

### 9.3 Typography
- Primary font: System default + `font-display` class for display headings
- All icons: Lucide React (professional SVG line icons)

---

## 10. Development Timeline & Changelog

### Phase 1: Core Infrastructure — June 2, 2026
**Session Start**: The project was initiated from the `NUTRIMIND_MASTER_PROMPT.md` specification document. Development was done through AI pair programming using Claude in Antigravity IDE.

**Key Events:**
- 17:25 PHT — Project started; AI read master prompt and planned phased implementation
- 17:27 PHT — Phase 1 began (Prisma schema, database setup)
- 17:39 PHT — User manually created PostgreSQL database `nutrimind`, set `.env` DATABASE_URL
- 17:47 PHT — User questioned FNRI food seeding completeness; AI confirmed all ~1,500 items were imported
- 17:49 PHT — Phase 2 manual interventions discussed
- 17:51 PHT — User set Google OAuth, JWT, and email secrets
- 17:54 PHT — Phase 4 began (meal logging)
- 18:00 PHT — User tested backend manually
- 18:03 PHT — Phase 5 began (nutritionist portal)
- 18:09 PHT — User set Gemini API key
- 18:13 PHT — Phase 7 began (cron + weekly regen)
- 18:23 PHT — User noticed CRON_SECRET placeholder needed updating
- 18:31 PHT — System essentially complete; first full-stack test

**Bug:** User asked "is the system done?" and noticed some issues — the conversation was briefly interrupted.

---

### Addendum 1: Shopping-Day Anchored Weekly Plan — June 12, 2026
- Shopping day selection during onboarding (WEEKEND/WEEKDAY)
- Dynamic starter plan bridging for mid-week signups
- Weekly cycle auto-transition logic

### Addendum 2: Autocomplete & AI Schema Enforcement — June 12, 2026
- FNRI autocomplete ingredient inputs
- Zod validation on all Gemini AI responses
- Auto-retry loop for schema format errors

### Addendum 3: Meal Library Slot Matching — June 12, 2026
- Slot-by-slot library matching by meal type
- Allergen/condition ingredient exclusions
- Anti-repetition 3-day rotation filter

### Addendum 4: Nutritionist Meal Library CRUD & Cross-Flagging — June 13, 2026
- Full CRUD for nutritionist-owned library meals
- Cross-RND flagging mechanism
- Automatic status cascade to NEEDS_REVIEW

### Addendum 5: User-Initiated Meal Swapping — June 13, 2026
- Swap Meal button on active plan slots
- 3-swaps-per-week cap with PlanSwapTracker
- Atomic transaction for swap execution

### Addendum 6: Unified /meals Page & Calorie Warning — June 20, 2026
- Merged separate views into unified 3-tab `/meals` page
- Swap calorie ±15% imbalance warning modal
- Fixed weekly plan regeneration cron bug

**Important context:** For this addendum, the developer used a workflow where Claude (Opus) acted as supervisor writing prompts, and Gemini 3.5 Flash executed the implementation. Claude then reviewed Gemini's work and fixed issues. This was due to conversation context limits.

---

### Major Update: UI Design Overhaul — June 21, 2026

**Bug encountered (June 21):** CSS not loading in browser — root cause was the dev server running on a different port (3001 instead of 3000) while CORS only allowed 3000. Fix: kill existing port 3000 process. This bug recurred multiple times.

**Changes implemented:**
- Premium light theme with off-white background, dark text
- Sage green secondary accent (`#e3efea`)
- Collapsible sidebar (localStorage-persisted state)
- DRY portal layouts (unified Sidebar + Navbar across USER/NUTRITIONIST/ADMIN)
- All emojis → Lucide React icons
- Meal card simplification with detail modal popup
- Active state redesign (green background fills instead of borders)
- Bold 2px border overrides
- Solid green scrollbars
- DiceBear pixel-art avatar integration with live preview
- Claude-inspired green dark mode
- Navigation restructure (removed Nutritionists/Profile from sidebar, added Progress)
- Safety recheck system on profile health updates

---

### Supervisor Audit — June 21, 2026
Another AI (Codex) audited the codebase and identified factual issues in a reference document:
- **Issue**: Document claimed refresh tokens stored in HttpOnly cookie — code stored both in JS-readable cookies
- **Fix**: Implemented proper HttpOnly cookie storage for refresh tokens
- **Issue**: Document said `GET /api/auth/refresh` — actual route was `POST`
- **Fix**: Corrected documentation
- **Issue**: Register payload documented as `firstName`/`lastName` — actual backend expected `name`
- **Fix**: Verified frontend sends combined `name` field

### Security Hardening — June 21, 2026 (post-audit)
- **Centralized exception sanitization**: Created `sanitizeError.ts` utility; updated 42+ controller/route catch blocks to prevent leaking database details
- **HttpOnly refresh cookies**: Properly configured backend to store refresh token in HttpOnly, Secure cookie `nutrimind_refresh`; removed from JSON response bodies; updated Axios interceptors with `withCredentials: true`
- **Robust allergen scanner**: Updated `meal-log.service.ts` with diacritics normalization, word-boundary regex matching, expanded Tagalog/Filipino allergen keywords
- **Check-in streak deceleration**: Updated cron to reset `checkinStreak` to 0 if user's `lastCheckinAt` > 7 days

---

### Design Overhaul: Warm Cream + Lime Theme — July 10, 2026
Reference design provided by user (financial dashboard mockup with cream background, lime green accents, black primary elements, grid background).

**Changes:**
- Rewrote `globals.css` with warm cream palette (`#eaecdf`)
- Added CSS grid background lines
- Dark sidebar with brand accent highlights
- Pill-shaped buttons and rounded-3xl cards
- Dashboard wellness cards: Check-In Streak, Weight Progress, Water Intake Tracker

### Dashboard Details & Contrast Fixes — July 10, 2026
- Split `--brand-green` (dark forest for text) from `--brand-accent` (lime for backgrounds)
- Solid white card surfaces (removed transparency)
- Macro text colors changed to high-contrast dark tones
- Added 3 interactive wellness summary cards below date switcher

### Floating Layout & Rounded Corners — July 10, 2026
- `md:p-5` outer framing on USER, NUTRITIONIST, ADMIN layouts
- Sidebar: `rounded-[28px]`, `h-full`, `shadow-card` (floating)
- Navbar: transparent background, no borders
- `md:pl-5` gap between sidebar and main content

### YouTube Cooking Tutorials — July 10, 2026
- Added YouTube tutorial banner inside MealCard modal (MealCard.tsx)
- Added YouTube tutorial banner on dedicated meal detail page (`/dashboard/[mealId]`)
- Dynamic URL: `youtube.com/results?search_query=how+to+cook+{mealName}`
- Styled as red YouTube-branded card with pill button

**Bug encountered (July 10):** Dev server crashed with `MODULE_NOT_FOUND` for vendor-chunks after builds. Root cause: stale `.next` cache. Fix: delete `.next` directory and restart dev server.

### Login/Register Redesign — July 16, 2026
- Replaced dark forest green gradient left panel with warm cream + grid theme
- Black rounded pill logo badge
- Outlined/hollow headline text (`WebkitTextStroke`)
- Black filled feature pills (instead of green outlined)
- Decorative lime accent card (🍱/🥗)
- Applied consistently to both `/login` and `/register` pages

---

## 11. Known Issues & Technical Debt

### 11.1 ESLint Warnings (Non-blocking)
- Multiple `@typescript-eslint/no-explicit-any` warnings in services and controllers
- `react-hooks/exhaustive-deps` warnings in useEffect hooks (meals, dashboard pages)
- `@typescript-eslint/no-unused-vars` in some files
- `@next/next/no-img-element` for nutritionists page avatar display
- `react/no-unescaped-entities` apostrophe warnings

### 11.2 Architectural Notes
- **No automated tests**: No unit tests, integration tests, or E2E tests exist yet
- **No CI/CD pipeline**: Deployment is manual
- **Food images not implemented**: User decided against meal images to avoid API costs; opted for YouTube tutorial links instead (June 19, 2026 conversation)
- **Water intake tracking**: Currently client-side only (localStorage); not persisted to backend database
- **Meal plan image strategy**: User explored Unsplash, Google Image API, and AI generation but all had limitations for Filipino dishes. Final decision: no images, rely on YouTube cooking links

### 11.3 Recurring Development Issues
| Issue | Cause | Solution | Frequency |
|-------|-------|----------|-----------|
| CSS not loading | Dev server on wrong port (3001 vs 3000); CORS mismatch | `npx kill-port 3000` then restart | Multiple times |
| Stale `.next` cache | Production builds corrupting dev cache | Delete `.next` folder, restart | Occasional |
| Context window limits | Long AI conversations hitting token limits | Switched between AI assistants (Claude, Gemini, Codex) | Several times |

---

## 12. Deployment & Environment

### 12.1 Environment Variables Required
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/nutrimind

# JWT Authentication
JWT_SECRET=<random-secret>
JWT_REFRESH_SECRET=<random-secret>

# Google OAuth
GOOGLE_CLIENT_ID=<google-oauth-client-id>

# Google Gemini AI
GEMINI_API_KEY=<gemini-api-key>

# Email (Nodemailer)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=<email@gmail.com>
EMAIL_PASS=<app-password>

# Cron Security
CRON_SECRET=<random-secret>

# Frontend (Next.js)
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<google-oauth-client-id>
```

### 12.2 Development Commands
```bash
# Backend
cd nutrimind-backend
npm install
npx prisma generate
npx prisma migrate dev
npm run seed          # Seed FNRI food data from CSV
npm run dev           # Start on port 5000

# Frontend
cd nutrimind-frontend
npm install
npm run dev           # Start on port 3000
npm run build         # Production build
```

### 12.3 Database Setup
1. Install PostgreSQL 16+
2. Create database: `CREATE DATABASE nutrimind;`
3. Set `DATABASE_URL` in `.env`
4. Run `npx prisma migrate dev` to create tables
5. Run `npm run seed` to import FNRI food data from `fnri_foods.csv`

---

> **Note to Documentation AI:** This document reflects the system's state as of August 7, 2026. The project has been developed incrementally through AI pair programming sessions with continuous feature additions and design iterations. Use the Development Timeline section (§10) as the primary source for chronological project management data (SPMP), the Architecture/Schema/API sections (§3-§8) as the primary source for software design documentation (SDD), and the Functional/Non-Functional Requirements, Use Cases, and Business Rules sections (§13-§17) as the primary source for the Software Requirements Specification (SRS).

---

## 13. Functional Requirements (SRS)

### 13.1 Authentication & Account Management

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-AUTH-001 | The system shall allow users to register with name, email, and password (min 8 characters) | High | Implemented |
| FR-AUTH-002 | The system shall send a 6-digit OTP email verification code upon registration | High | Implemented |
| FR-AUTH-003 | The system shall authenticate users via email/password and return a JWT access token (15-min expiry) | High | Implemented |
| FR-AUTH-004 | The system shall store refresh tokens (7-day expiry) in HttpOnly Secure cookies | High | Implemented |
| FR-AUTH-005 | The system shall silently refresh expired access tokens using the refresh token without user intervention | High | Implemented |
| FR-AUTH-006 | The system shall support Google OAuth 2.0 sign-in, automatically creating verified accounts | High | Implemented |
| FR-AUTH-007 | The system shall provide password reset via email with signed, short-lived reset tokens | Medium | Implemented |
| FR-AUTH-008 | The system shall enforce Role-Based Access Control (USER, NUTRITIONIST, ADMIN) on all protected endpoints | High | Implemented |
| FR-AUTH-009 | The system shall allow users to update their account settings (name, email, password) from the profile page | Medium | Implemented |
| FR-AUTH-010 | The system shall apply global API rate limiting to prevent abuse | Medium | Implemented |

### 13.2 User Onboarding

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-ONB-001 | The system shall collect biometric data: age, biological sex, height (cm), weight (kg), target weight (kg) | High | Implemented |
| FR-ONB-002 | The system shall collect fitness goal selection (Lose Weight, Gain Weight, Maintain, Build Muscle) | High | Implemented |
| FR-ONB-003 | The system shall collect activity level (Sedentary, Lightly Active, Active, Very Active) | High | Implemented |
| FR-ONB-004 | The system shall collect dietary preferences (Omnivore, Vegetarian, Vegan, Pescatarian) and carb preference (Low, Moderate, High) | High | Implemented |
| FR-ONB-005 | The system shall collect health conditions via multi-select chips (Diabetes, Hypertension, Kidney Disease, Heart Condition, Pregnant, None) with optional free-text "Other" field | High | Implemented |
| FR-ONB-006 | The system shall collect food allergies via multi-select chips (Shellfish, Nuts, Dairy, Gluten, Eggs, None) with optional free-text "Other" field | High | Implemented |
| FR-ONB-007 | The system shall collect shopping day group preference (Weekend or Weekday) to anchor weekly plan cycles | High | Implemented |
| FR-ONB-008 | The system shall require acceptance of Terms of Service and clinical disclaimer before granting dashboard access | High | Implemented |
| FR-ONB-009 | The system shall support backward navigation across all onboarding steps, preserving previously entered data | Medium | Implemented |
| FR-ONB-010 | The system shall calculate daily calorie target using the Mifflin-St Jeor equation upon onboarding completion | High | Implemented |

### 13.3 AI Meal Plan Generation

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-MEAL-001 | The system shall generate a 7-day meal plan with 4 meals per day (Breakfast, Lunch, Dinner, Snack) using Gemini AI | High | Implemented |
| FR-MEAL-002 | Generated meals shall be culturally appropriate Filipino cuisine matching the user's food culture preferences | High | Implemented |
| FR-MEAL-003 | Each generated meal shall include: name, description, meal type, estimated calories, protein (g), carbs (g), fat (g), and ingredient list | High | Implemented |
| FR-MEAL-004 | The system shall match meal ingredients against the FNRI Philippine Food Composition Table using a 4-tier fallback: exact match → alias match → fuzzy match → Gemini estimation | High | Implemented |
| FR-MEAL-005 | Ingredients matched via Gemini estimation shall be flagged with `dataSource: GEMINI_ESTIMATED` | High | Implemented |
| FR-MEAL-006 | All generated meal plans shall have initial status `PENDING_REVIEW` awaiting nutritionist verification | High | Implemented |
| FR-MEAL-007 | The system shall enforce an AI confidence flag (SAFE, CAUTION, NEEDS_REVIEW) on each generated meal | Medium | Implemented |
| FR-MEAL-008 | The system shall generate a clinical nutrition report (foods to avoid, limit, recommend; drinks guidance) before the first meal plan | High | Implemented |
| FR-MEAL-009 | The user shall acknowledge the nutrition report before plan generation is allowed | High | Implemented |
| FR-MEAL-010 | The system shall use a 4-model fallback chain (gemini-2.5-flash → 2.0-flash → 1.5-flash → 1.5-pro) for AI resilience | Medium | Implemented |
| FR-MEAL-011 | The system shall validate all AI-generated JSON against Zod schemas and auto-retry up to 3 times on validation failures | Medium | Implemented |
| FR-MEAL-012 | If a user signs up mid-week, the system shall generate a shorter "Starter" plan bridging to the next full cycle | High | Implemented |
| FR-MEAL-013 | The system shall automatically regenerate weekly meal plans on cycle transition days via cron job | High | Implemented |

### 13.4 Meal Logging & Tracking

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-LOG-001 | Users shall be able to mark scheduled meals as "Eaten" (DONE), "Skipped" (SKIPPED), or reset to "Pending" (PENDING) | High | Implemented |
| FR-LOG-002 | Users shall be able to log outside meals (not in the plan) by entering a meal name; the system estimates macros via Gemini AI | High | Implemented |
| FR-LOG-003 | Before logging an outside meal, the system shall perform a pre-check for allergen/condition conflicts and display warnings | High | Implemented |
| FR-LOG-004 | The system shall aggregate daily nutrition totals (calories, protein, carbs, fat) and calculate adherence percentage | High | Implemented |
| FR-LOG-005 | Users shall be able to view meal consumption history filtered by status | Medium | Implemented |
| FR-LOG-006 | Past-date meals with no log entry shall be automatically treated as "Skipped" in the UI | Medium | Implemented |

### 13.5 Meal Swapping

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-SWAP-001 | Users shall be able to swap an active plan meal with a compatible alternative from the meal library or AI-generated replacement | High | Implemented |
| FR-SWAP-002 | The system shall cap meal swaps at 3 per weekly plan cycle per user | High | Implemented |
| FR-SWAP-003 | Before confirming a swap, the system shall calculate the calorie delta; if the day's total shifts ±15% from target, a warning modal shall be displayed | High | Implemented |
| FR-SWAP-004 | Swapping shall atomically update the MealPlan, recreate MealIngredients, regenerate the grocery list, and log the swap in SwapLog | High | Implemented |
| FR-SWAP-005 | Safety-triggered swaps (from profile health updates) shall be exempt from the 3-swap weekly cap | Medium | Implemented |

### 13.6 Grocery Management

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-GROC-001 | The system shall auto-generate a grocery checklist from the active weekly meal plan's ingredients | High | Implemented |
| FR-GROC-002 | Grocery items shall be grouped by food category | Medium | Implemented |
| FR-GROC-003 | Users shall be able to check/uncheck individual grocery items | Medium | Implemented |
| FR-GROC-004 | The grocery list shall regenerate when a meal is swapped | High | Implemented |

### 13.7 Progress & Weight Tracking

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-PROG-001 | Users shall be able to log weight entries over time | Medium | Implemented |
| FR-PROG-002 | The system shall display a weight trend line chart | Medium | Implemented |
| FR-PROG-003 | The system shall display daily nutrition adherence logs | Medium | Implemented |
| FR-PROG-004 | The system shall track weekly check-in streaks (checkinStreak field) | Medium | Implemented |
| FR-PROG-005 | The cron job shall reset check-in streaks to 0 if the user's lastCheckinAt exceeds 7 days | Medium | Implemented |

### 13.8 Dashboard Wellness Features

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-DASH-001 | The dashboard shall display a horizontal date switcher for navigating plan days | High | Implemented |
| FR-DASH-002 | The dashboard shall display a Calorie Ring gauge showing consumed vs target calories | High | Implemented |
| FR-DASH-003 | The dashboard shall display macronutrient budget progress bars (Protein, Carbs, Fat) | High | Implemented |
| FR-DASH-004 | The dashboard shall display a Check-In Streak card showing current streak weeks | Medium | Implemented |
| FR-DASH-005 | The dashboard shall display a Weight Progress card showing current vs target weight | Medium | Implemented |
| FR-DASH-006 | The dashboard shall display an interactive Water Intake tracker with ±250mL buttons (localStorage-persisted) | Medium | Implemented |
| FR-DASH-007 | Each meal card on the dashboard shall link to a dedicated detail page or modal with full nutritional breakdown | High | Implemented |
| FR-DASH-008 | Each meal detail view shall include a YouTube cooking tutorial link dynamically constructed from the meal name | Low | Implemented |

### 13.9 Nutritionist Portal

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-RND-001 | Nutritionists shall be able to view a review queue of pending patient meal plans, sorted by AI confidence flag (NEEDS_REVIEW → CAUTION → SAFE) | High | Implemented |
| FR-RND-002 | Nutritionists shall be able to approve or reject a patient's entire plan group with optional notes | High | Implemented |
| FR-RND-003 | Nutritionists shall be able to create, read, update, and delete their own meal library entries | High | Implemented |
| FR-RND-004 | Nutritionists shall be able to flag another nutritionist's library meal with a reason text | Medium | Implemented |
| FR-RND-005 | Flagging a library meal shall automatically set its status to FLAGGED, hiding it from user rotation | Medium | Implemented |
| FR-RND-006 | Nutritionists shall only be able to modify/delete meals they created (ownership enforcement) | High | Implemented |

### 13.10 Admin Panel

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-ADM-001 | Admins shall be able to view all registered users with pagination | Medium | Implemented |
| FR-ADM-002 | Admins shall be able to view all nutritionist profiles and their verification status | Medium | Implemented |
| FR-ADM-003 | Admins shall be able to verify/approve nutritionist accounts by confirming PRC license details | High | Implemented |
| FR-ADM-004 | Admins shall be able to view system-wide analytics (total users, plans generated, etc.) | Low | Implemented |

### 13.11 Notifications & Communication

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-NOT-001 | The system shall generate in-app notifications for: plan approved, plan rejected, review request, weekly check-in due, meal flagged, flag resolved | Medium | Implemented |
| FR-NOT-002 | Users shall be able to view and dismiss notifications from the navbar | Medium | Implemented |
| FR-NOT-003 | The system shall send email notifications for: email verification (OTP), password reset link | High | Implemented |

### 13.12 Data Export

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-EXP-001 | Users shall be able to download their nutrition report as a PDF document | Medium | Implemented |

---

## 14. Non-Functional Requirements (SRS)

### 14.1 Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-PERF-001 | API response time for standard CRUD operations shall be under 500ms | < 500ms |
| NFR-PERF-002 | AI meal plan generation (Gemini API call) shall complete within 60 seconds | < 60s |
| NFR-PERF-003 | Frontend pages shall achieve a First Load JS under 150 kB per route | < 150 kB |
| NFR-PERF-004 | The FNRI food search autocomplete shall return results within 200ms | < 200ms |
| NFR-PERF-005 | The system shall support at least 50 concurrent users without degradation | 50 users |

### 14.2 Security

| ID | Requirement | Implementation |
|----|-------------|----------------|
| NFR-SEC-001 | All passwords shall be hashed using bcrypt with appropriate salt rounds | bcryptjs |
| NFR-SEC-002 | JWT access tokens shall expire after 15 minutes | jsonwebtoken config |
| NFR-SEC-003 | Refresh tokens shall be stored in HttpOnly, Secure cookies only | cookie-parser + express config |
| NFR-SEC-004 | All API responses shall be sanitized to prevent database detail leakage | sanitizeError.ts utility (42+ catch blocks) |
| NFR-SEC-005 | HTTP security headers shall be applied to all responses | Helmet.js middleware |
| NFR-SEC-006 | API endpoints shall enforce rate limiting to prevent brute-force attacks | express-rate-limit |
| NFR-SEC-007 | CORS shall be restricted to known frontend origins only | cors middleware (localhost:3000, 3001) |
| NFR-SEC-008 | Cron endpoints shall require a shared secret for invocation | CRON_SECRET header validation |
| NFR-SEC-009 | Google OAuth tokens shall be verified server-side using google-auth-library | OAuth token verification |
| NFR-SEC-010 | Email verification tokens and password reset tokens shall be short-lived and single-use | Expiry timestamps + nullification after use |

### 14.3 Usability

| ID | Requirement | Implementation |
|----|-------------|----------------|
| NFR-USE-001 | The application shall be responsive on mobile, tablet, and desktop viewports | TailwindCSS responsive utilities (md:, lg:) |
| NFR-USE-002 | Mobile users shall have a bottom navigation bar; desktop users shall have a collapsible sidebar | BottomNav.tsx + Sidebar.tsx |
| NFR-USE-003 | The application shall support light and dark color themes | CSS variables with html.dark class toggle |
| NFR-USE-004 | All interactive elements shall have visible hover/focus states and transition animations | Tailwind transition-colors, hover: prefixes |
| NFR-USE-005 | Loading states shall display spinners for all async operations | LoadingSpinner component |
| NFR-USE-006 | Empty states shall display descriptive messages with suggested actions | EmptyState component |
| NFR-USE-007 | Error messages shall be user-friendly and not expose technical details | sanitizeError.ts + frontend error handlers |
| NFR-USE-008 | Clinical warnings shall be visually prominent with distinct color coding (amber for warnings, red for errors) | Status color CSS variables |

### 14.4 Reliability

| ID | Requirement | Implementation |
|----|-------------|----------------|
| NFR-REL-001 | AI API calls shall use a 4-model fallback chain for service resilience | Gemini model cascade |
| NFR-REL-002 | AI response parsing shall auto-retry up to 3 times on schema validation failures | Zod validation + retry loop |
| NFR-REL-003 | Token refresh shall be transparent to the user, queuing failed requests until new token is obtained | Axios interceptor with request queue |
| NFR-REL-004 | Database operations involving multiple tables shall use transactions for atomicity | Prisma $transaction for swaps, plan generation |
| NFR-REL-005 | The system shall gracefully handle Gemini API outages by displaying informative error messages | Try/catch + user-facing error display |

### 14.5 Maintainability

| ID | Requirement | Implementation |
|----|-------------|----------------|
| NFR-MAIN-001 | The codebase shall be written in TypeScript with strict type checking | tsconfig strict mode |
| NFR-MAIN-002 | The application shall follow a layered architecture: routes → controllers → services → data access | Separated directories in backend src/ |
| NFR-MAIN-003 | Frontend components shall be modular and reusable | 12 UI components in components/ui/ |
| NFR-MAIN-004 | Database schema changes shall be managed through version-controlled migrations | Prisma migrations |
| NFR-MAIN-005 | All feature additions shall be documented in the UPDATE_LOG.md changelog | Established development practice |

### 14.6 Scalability

| ID | Requirement | Notes |
|----|-------------|-------|
| NFR-SCAL-001 | The database schema shall support horizontal scaling of food items (currently ~1,500 FNRI entries, expandable) | FoodItem + FoodAlias tables |
| NFR-SCAL-002 | The meal library shall grow organically as nutritionists add verified recipes | MealLibrary table with no hard limits |
| NFR-SCAL-003 | The weekly cron jobs shall process users in batches grouped by ShoppingDayGroup | cron.service.ts batch processing |

---

## 15. Use Cases (SRS)

### UC-001: New User Registration & Onboarding
- **Actor:** Unregistered User
- **Preconditions:** User has a valid email address
- **Main Flow:**
  1. User navigates to `/register`
  2. User enters name, email, password, confirm password
  3. System validates inputs (email format, password ≥ 8 chars, passwords match)
  4. System creates User record with `emailVerified: false`
  5. System sends 6-digit OTP to user's email
  6. User enters OTP on verification page
  7. System marks `emailVerified: true`
  8. System redirects to `/onboarding/stats`
  9. User completes 6-step onboarding wizard (stats → preferences → conditions → allergies → shopping-day → ToS)
  10. System calculates daily calorie target
  11. System marks `onboardingDone: true`
  12. System generates AI nutrition report
  13. User acknowledges nutrition report
  14. System generates first meal plan (STARTER or WEEKLY depending on day)
  15. User is redirected to `/dashboard`
- **Alternative Flow (Google OAuth):** User clicks "Sign in with Google" → System creates verified account → Skips email verification → Proceeds to onboarding
- **Postconditions:** User has active account, completed profile, nutrition report, and initial meal plan

### UC-002: Daily Meal Plan Interaction
- **Actor:** Authenticated User
- **Preconditions:** User has an active weekly meal plan
- **Main Flow:**
  1. User opens `/dashboard`
  2. System displays horizontal date switcher (auto-selects today)
  3. System displays 4 meal cards for selected date
  4. User clicks a meal card → navigates to detail page
  5. Detail page shows: meal name, macros, description, YouTube cooking link, ingredients, AI warning (if pending)
  6. User clicks "Mark as Eaten" → system creates MealLog with status DONE
  7. Dashboard updates consumed calories/macros in real-time
- **Alternative Flow (Skip):** User clicks "Skip Meal" → system creates MealLog with status SKIPPED
- **Alternative Flow (Reset):** User clicks "Reset Meal Status" → system reverts MealLog to PENDING
- **Postconditions:** MealLog records updated; daily nutrition aggregation recalculated

### UC-003: Log Outside Meal
- **Actor:** Authenticated User
- **Preconditions:** User is on dashboard
- **Main Flow:**
  1. User clicks the floating "+" action button
  2. Modal opens with meal name input and meal type selector
  3. User enters meal name (e.g., "Cheeseburger")
  4. User clicks "Check & Preview" → system calls Gemini to estimate macros
  5. System runs allergen/condition pre-check
  6. If conflicts found → system displays warning banner with specific allergen/condition details
  7. User acknowledges warning OR cancels
  8. If no conflicts or user acknowledges → meal is logged with source `USER_LOGGED`
  9. Dashboard updates consumed totals
- **Alternative Flow (Warning Cancel):** User sees allergen warning → clicks Cancel → meal is not logged
- **Postconditions:** MealLog created with Gemini-estimated macros; warnings recorded if applicable

### UC-004: Swap a Meal
- **Actor:** Authenticated User
- **Preconditions:** User has active plan with swaps remaining (< 3 used this cycle)
- **Main Flow:**
  1. User opens meal detail modal/page
  2. User clicks "Swap Meal"
  3. System queries meal library for compatible alternatives matching user's profile (meal type, allergen-safe, condition-safe)
  4. System calculates calorie delta between original and replacement
  5. If delta causes day total to shift ±15% → warning modal shown
  6. User confirms swap
  7. System atomically: updates MealPlan record, recreates ingredients, updates grocery list, logs SwapLog, increments PlanSwapTracker
  8. Dashboard refreshes with new meal
- **Alternative Flow (No Library Match):** System generates AI alternative via Gemini → marked as PENDING_REVIEW
- **Alternative Flow (Cap Reached):** "Swap Meal" button is disabled with tooltip "You've used all 3 swaps for this week"
- **Postconditions:** Meal replaced; swap count incremented; grocery list regenerated

### UC-005: Nutritionist Reviews Plan
- **Actor:** Verified Nutritionist (RND)
- **Preconditions:** Nutritionist is verified by admin; pending plans exist in queue
- **Main Flow:**
  1. Nutritionist navigates to `/nutritionist/reviews`
  2. System displays review queue sorted by AI confidence (NEEDS_REVIEW first)
  3. Nutritionist selects a plan group
  4. System displays all 28 meals in the plan with ingredients and macros
  5. Nutritionist reviews meals for clinical accuracy
  6. Nutritionist clicks "Approve" (with optional note) or "Reject" (with required reason)
  7. System updates all MealPlan records in group to APPROVED or REJECTED
  8. System sends notification to patient user
  9. If rejected → system may regenerate affected slots
- **Postconditions:** Plan status updated; patient notified; nutritionist stats incremented

### UC-006: Admin Verifies Nutritionist
- **Actor:** Admin
- **Preconditions:** Nutritionist has registered and submitted credentials
- **Main Flow:**
  1. Admin navigates to `/admin/nutritionists`
  2. System displays list of nutritionist profiles with verification status
  3. Admin clicks "Verify" on unverified nutritionist
  4. Admin confirms PRC license number and expiry date
  5. System marks `isVerified: true` and sets `verifiedAt` timestamp
  6. Nutritionist gains access to review queue
- **Postconditions:** NutritionistProfile updated; full portal access granted

### UC-007: Weekly Plan Regeneration (Automated)
- **Actor:** System (Cron Job)
- **Preconditions:** Weekly cycle transition day reached for a shopping day group
- **Main Flow:**
  1. Cron endpoint triggered with CRON_SECRET
  2. System queries all active users in the transitioning group
  3. For each user: generates new 7-day WEEKLY plan via Gemini AI
  4. New plan linked to new planGroupId
  5. PlanSwapTracker reset (new tracker for new group)
  6. Grocery list regenerated for new plan
  7. Previous plan remains in history but is no longer "current"
- **Postconditions:** All users in group have fresh weekly plans

### UC-008: Profile Health Update with Safety Recheck
- **Actor:** Authenticated User
- **Preconditions:** User has active meal plan
- **Main Flow:**
  1. User navigates to `/progress` or `/profile`
  2. User updates health conditions (e.g., adds "Diabetes")
  3. System saves new conditions to database
  4. System triggers safety recheck: scans all remaining unconsumed meals for conflicts
  5. For each conflicting meal:
     a. Try to swap with compatible library meal (cap-exempt)
     b. If no match → regenerate via Gemini AI (marked PENDING_REVIEW)
  6. User is notified of swapped/regenerated meals
- **Postconditions:** Active plan updated to be safe for new conditions; affected meals replaced

### UC-009: Nutritionist Flags Library Meal
- **Actor:** Verified Nutritionist
- **Preconditions:** Nutritionist is viewing another RND's library meal
- **Main Flow:**
  1. Nutritionist navigates to library section
  2. Nutritionist identifies a problematic recipe
  3. Nutritionist clicks "Flag" and provides reason text
  4. System creates MealLibraryFlag record
  5. System sets MealLibrary status to FLAGGED
  6. Flagged meal is hidden from user rotation until resolved
- **Postconditions:** Library meal flagged; removed from active rotation; original author can review

### UC-010: User Views Cooking Tutorial
- **Actor:** Authenticated User
- **Preconditions:** User is viewing a meal detail page
- **Main Flow:**
  1. User opens meal detail page (`/dashboard/[mealId]`) or meal detail modal
  2. User sees "Need cooking help?" YouTube banner
  3. User clicks "Watch Video"
  4. New browser tab opens with YouTube search: `how to cook {mealName}`
  5. User watches relevant Filipino cooking tutorials
- **Postconditions:** External YouTube page opened; no system state change

---

## 16. Business Rules & Domain Logic (SRS)

### 16.1 Calorie Calculation Rules

| Rule ID | Rule | Formula/Value |
|---------|------|---------------|
| BR-CAL-001 | BMR shall be calculated using the Mifflin-St Jeor equation | Male: `10w + 6.25h − 5a + 5`; Female: `10w + 6.25h − 5a − 161` |
| BR-CAL-002 | If user has PREGNANT condition, biological sex shall be forced to FEMALE | Override in calculation |
| BR-CAL-003 | TDEE multiplier: SEDENTARY=1.2, LIGHTLY_ACTIVE=1.375, ACTIVE=1.55, VERY_ACTIVE=1.725 | Applied to BMR |
| BR-CAL-004 | Goal adjustments: LOSE_WEIGHT=−500, GAIN_WEIGHT=+500, MAINTAIN=0, BUILD_MUSCLE=+300 | Applied to TDEE |
| BR-CAL-005 | Minimum daily calorie target shall be 500 kcal (starvation floor) | `Math.max(500, target)` |

### 16.2 Meal Plan Rules

| Rule ID | Rule |
|---------|------|
| BR-PLAN-001 | Each day shall have exactly 4 meal slots: Breakfast, Lunch, Dinner, Snack |
| BR-PLAN-002 | Total daily calories shall target the user's `dailyCalorieTarget` ±15% |
| BR-PLAN-003 | Plans generated mid-week shall be `STARTER` type (bridge to next cycle); full cycles are `WEEKLY` |
| BR-PLAN-004 | WEEKEND group anchors plans Sunday→Saturday; WEEKDAY group anchors Monday→Sunday |
| BR-PLAN-005 | All AI-generated plans start with status `PENDING_REVIEW` |
| BR-PLAN-006 | The system shall not repeat the same meal within a 3-day window (anti-repetition) |
| BR-PLAN-007 | Meal ingredients from allergen/condition-restricted categories shall be strictly excluded |

### 16.3 Meal Swap Rules

| Rule ID | Rule |
|---------|------|
| BR-SWAP-001 | Maximum 3 user-initiated swaps per weekly plan cycle |
| BR-SWAP-002 | Safety-triggered swaps (from profile updates) are exempt from the 3-swap cap |
| BR-SWAP-003 | If a swap causes day total to shift ±15% from target, a calorie imbalance warning shall be shown |
| BR-SWAP-004 | Swap replacement must match: same meal type, allergen-safe, condition-safe |
| BR-SWAP-005 | Swaps are atomic: MealPlan update + ingredient recreation + grocery update + swap log, all in one transaction |

### 16.4 Allergen Detection Rules

| Rule ID | Rule |
|---------|------|
| BR-ALLRG-001 | Allergen matching uses word-boundary regex for short ingredient names |
| BR-ALLRG-002 | Matching is case-insensitive with Unicode diacritics normalization |
| BR-ALLRG-003 | Tagalog/Filipino allergen synonyms are included (e.g., "hipon"=shrimp, "gatas"=dairy) |
| BR-ALLRG-004 | Outside meals flagged with allergen conflicts display warnings BEFORE logging |
| BR-ALLRG-005 | Users may acknowledge and override allergen warnings (informed consent) |

### 16.5 Nutritionist Review Rules

| Rule ID | Rule |
|---------|------|
| BR-RND-001 | Review queue is sorted: NEEDS_REVIEW → CAUTION → SAFE |
| BR-RND-002 | Nutritionists can only modify/delete library meals they themselves created |
| BR-RND-003 | Cross-flagging a meal automatically sets status to FLAGGED |
| BR-RND-004 | Nutritionist verification requires valid PRC license number and non-expired date |
| BR-RND-005 | Approved plans may be sourced from the meal library for future user matching |

### 16.6 Weekly Check-in Rules

| Rule ID | Rule |
|---------|------|
| BR-CHK-001 | Check-in streak increments by 1 for each weekly check-in completed |
| BR-CHK-002 | If lastCheckinAt exceeds 7 days at cron execution, streak resets to 0 |
| BR-CHK-003 | Check-in requires submitting current weight (creates WeightLog entry) |
| BR-CHK-004 | A breaking-streak notification is sent when streak is reset |

### 16.7 FNRI Data Source Rules

| Rule ID | Rule |
|---------|------|
| BR-FNRI-001 | The FNRI database contains ~1,500 Philippine food items seeded from CSV |
| BR-FNRI-002 | Food items include: calories, protein, carbs, fat, fiber, sodium, potassium, calcium, iron, vitamins A/C/B1/B2, niacin, water |
| BR-FNRI-003 | Food aliases support alternative names (e.g., "bangus" = "milkfish") |
| BR-FNRI-004 | Data source tracking: `FNRI` for matched items, `GEMINI_ESTIMATED` for AI-estimated items |

---

## 17. Constraints, Assumptions & Dependencies (SRS)

### 17.1 Constraints

| ID | Constraint |
|----|-----------|
| CON-001 | The system is designed for Filipino cuisine and FNRI food data; extending to other countries requires new food databases |
| CON-002 | AI meal generation depends on Google Gemini API availability; API outages will prevent plan generation |
| CON-003 | The system currently runs as a local development server; no production deployment infrastructure exists |
| CON-004 | Real-time notifications are in-app only; push notifications (mobile/browser) are not implemented |
| CON-005 | The system does not provide medical diagnoses; it generates meal suggestions based on user-reported conditions |
| CON-006 | Meal images are not included; the system provides YouTube cooking tutorial links as alternatives |
| CON-007 | Water intake tracking is client-side only (localStorage); it is not persisted to the backend database |
| CON-008 | No automated testing framework (unit tests, integration tests, E2E tests) is currently implemented |
| CON-009 | No CI/CD pipeline exists; build and deployment are manual processes |
| CON-010 | The system is designed for single-language use (English with Filipino food names); full internationalization is not implemented |

### 17.2 Assumptions

| ID | Assumption |
|----|-----------|
| ASM-001 | Users will accurately report their biometric data, health conditions, and allergies during onboarding |
| ASM-002 | Users have basic internet access sufficient to load a web application and call external APIs |
| ASM-003 | The FNRI Philippine Food Composition Table data is accurate and up-to-date as provided in the CSV |
| ASM-004 | Gemini AI generates nutritionally reasonable meal suggestions within the Filipino cuisine context |
| ASM-005 | Nutritionists registering on the platform hold valid PRC licenses; the system relies on admin manual verification |
| ASM-006 | Users understand that AI-generated plans are estimates and should be reviewed by a licensed professional |
| ASM-007 | The PostgreSQL database server is available and maintained by the deployment environment |
| ASM-008 | Email SMTP service (Gmail) is available for sending verification and password reset emails |

### 17.3 External Dependencies

| ID | Dependency | Purpose | Risk Level |
|----|-----------|---------|------------|
| DEP-001 | **Google Gemini AI API** | Meal plan generation, nutrient estimation, nutrition reports | High — Core feature depends on external API |
| DEP-002 | **Google OAuth 2.0** | Social sign-in | Medium — Alternative email/password auth exists |
| DEP-003 | **PostgreSQL** | Primary data store | High — All data storage |
| DEP-004 | **Gmail SMTP** | Email delivery (OTP, password reset) | Medium — Only affects verification flows |
| DEP-005 | **DiceBear API** | Avatar generation | Low — Cosmetic feature only |
| DEP-006 | **YouTube** (external link) | Cooking tutorial references | Low — Opens external site; no API dependency |
| DEP-007 | **FNRI CSV Dataset** | Philippine food composition data | Low — Seeded once at setup; no runtime dependency |
| DEP-008 | **npm Registry** | Package installation for Node.js dependencies | Low — Only during development/build |

### 17.4 Regulatory & Ethical Considerations

| ID | Consideration |
|----|--------------|
| REG-001 | The system includes a mandatory Terms of Service and clinical disclaimer (FR-ONB-008) that users must accept, explicitly stating that AI-generated meal plans are not medical advice |
| REG-002 | AI-generated plans are flagged as PENDING_REVIEW and require licensed RND verification before being classified as APPROVED |
| REG-003 | All plans carry an AI Confidence Flag (SAFE/CAUTION/NEEDS_REVIEW) to communicate estimation reliability |
| REG-004 | Allergen warnings are prominently displayed with the option to cancel potentially harmful meal logging |
| REG-005 | Nutritionist credentials (PRC license) are verified by administrators before granting professional review access |
| REG-006 | The system processes health data (conditions, allergies, biometrics); compliance with Philippine Data Privacy Act (RA 10173) should be evaluated before production deployment |
| REG-007 | User-initiated meal swaps include calorie deviation warnings to maintain awareness of nutritional impact |
