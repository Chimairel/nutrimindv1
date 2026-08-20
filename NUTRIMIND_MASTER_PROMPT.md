# ═══════════════════════════════════════════════════════════════
# NUTRIMIND — MASTER BUILD PROMPT FOR AI AGENTS

> **Documentation status — Historical and aspirational; superseded as a source of truth (August 19, 2026):** This build prompt preserves the original product vision. It does not describe the current repository reliably and must not override the accepted Next.js frontend + Express/custom JWT backend + Prisma/PostgreSQL architecture. Use [`docs/NUTRIMIND_ENGINEERING_RECORD.md`](docs/NUTRIMIND_ENGINEERING_RECORD.md) for current evidence and [`README.md`](README.md) for contributor setup. Statements below calling this file the single source of truth are retained only as historical text.
# ═══════════════════════════════════════════════════════════════
# This document is the single source of truth for building
# NutriMind. Every AI agent working on this project MUST read
# and follow this document. The human developer is vibe-coding
# this project — meaning YOU (the AI) do the heavy lifting,
# but there are specific points where ONLY the human can act.
#
# LAST UPDATED: 2026-06-02
# ═══════════════════════════════════════════════════════════════

---

# ⚠️ CRITICAL RULES FOR ALL AI AGENTS ⚠️

## Rule 1: STOP AND TELL THE USER when you hit a manual intervention point
There are things in this project that ONLY the human can do. These are
marked throughout this document with 🛑 HUMAN ACTION REQUIRED blocks.
When you reach one of these points:
- **STOP working immediately**
- **Tell the user exactly what they need to do** (copy-paste ready instructions)
- **Tell the user what file to edit and what value to paste**
- **DO NOT attempt to create databases, generate API keys, or fake credentials**
- **DO NOT put placeholder values like `your-key-here` and keep building** — STOP and wait
- **DO NOT loop trying to fix connection errors** that are caused by missing manual setup

## Rule 2: NEVER hallucinate files, tables, fields, or routes
- Build ONLY what is specified in this document
- Do NOT invent extra database columns
- Do NOT add routes not listed here
- Do NOT create files not in the project structure
- If something seems missing, ASK the user — do not guess

## Rule 3: NEVER give partial code
- Always give COMPLETE file implementations
- Never say "// ... rest of the code" or "// add similar logic here"
- Every file you create must be copy-paste ready and runnable

## Rule 4: Explain what you build
- The user is a CS student who wants to understand every line
- Add clear comments in the code
- Briefly explain what each file/function does when you create it

## Rule 5: Consistent error handling and response format
- EVERY API response must use: `{ success: boolean, data?: any, error?: string }`
- EVERY controller must have try/catch
- NEVER expose passwordHash in any response
- NEVER return raw Prisma errors to the client

## Rule 6: If something fails and you can't fix it in 2 attempts — STOP
- Tell the user what failed and why
- Ask if it's a manual setup issue (missing env var, database not running, etc.)
- Do NOT keep retrying the same approach in a loop

---

# 📋 ALL MANUAL INTERVENTION POINTS (SUMMARY)

Here is every point where the human must do something themselves.
These are repeated in context within each phase below, but this
is the master checklist.

| #  | What the human must do                          | When (before which phase) | How the agent should detect it's missing               |
|----|------------------------------------------------|--------------------------|-------------------------------------------------------|
| M1 | Install PostgreSQL locally                      | Before Phase 2           | `prisma migrate` fails with connection refused         |
| M2 | Create the database `nutrimind`                 | Before Phase 2           | `prisma migrate` fails with "database does not exist"  |
| M3 | Set `DATABASE_URL` in backend `.env`            | Before Phase 2           | `prisma migrate` fails with auth or connection error   |
| M4 | Obtain Google Gemini API key                    | Before Phase 6           | Gemini calls return 401/403 or "API key not valid"     |
| M5 | Set `GEMINI_API_KEY` in backend `.env`          | Before Phase 6           | `process.env.GEMINI_API_KEY` is undefined              |
| M6 | Obtain/prepare FNRI CSV data file               | Before Phase 2           | Seed script fails with "file not found"                |
| M7 | Generate and set `JWT_SECRET` in `.env`         | Before Phase 3           | JWT signing throws "secret required" error             |
| M8 | Generate and set `JWT_REFRESH_SECRET` in `.env` | Before Phase 3           | Refresh token signing fails                            |
| M9 | Generate and set `CRON_SECRET` in `.env`        | Before Phase 8           | Cron routes reject all requests                        |
| M10| Create Vercel projects                          | Before Phase 10          | Deployment fails                                       |
| M11| Set production env vars in Vercel               | Before Phase 10          | Production app crashes on startup                      |
| M12| Set up cloud PostgreSQL (Supabase/Neon/Railway) | Before Phase 10          | Production DB connection fails                         |

### When an agent detects any of the failure signatures above, it MUST:
```
1. STOP all work
2. Print: "🛑 MANUAL ACTION REQUIRED"
3. Tell the user exactly which manual step (M1-M12) is needed
4. Give copy-paste ready instructions
5. Wait for the user to confirm completion before continuing
```

---

# 🏗️ PROJECT OVERVIEW

## What is NutriMind?
NutriMind is an AI-powered PWA nutrition and meal planning system targeting
health-conscious young urban Filipinos aged 18-35. It generates personalized
7-day meal plans using the Google Gemini API and validates nutrition data
against the FNRI (Food and Nutrition Research Institute) Philippine Food
Composition Table.

## Architecture
- **Frontend**: Next.js 14 App Router + TypeScript + Tailwind CSS (separate project)
- **Backend**: Express.js + TypeScript + Prisma ORM + PostgreSQL (separate project)
- **AI**: Google Gemini API with 4-model fallback rotation
- **Data**: FNRI Philippine Food Composition Table (seeded into PostgreSQL)
- **Auth**: JWT tokens stored in httpOnly cookies
- **Deployment**: Vercel (frontend) + Vercel/Railway (backend)

## Two Separate Projects
```
nutrimind-backend/    ← Express.js API server (port 5000)
nutrimind-frontend/   ← Next.js web app (port 3000)
```
These are SEPARATE codebases. They communicate via HTTP/Axios.
NEVER import backend code into frontend or vice versa.

---

# ═══════════════════════════════════════════════════════════════
# PHASE 1 — PROJECT SCAFFOLDING
# Goal: Initialize both projects. Zero business logic.
# Dependencies: None — this is the starting point
# ═══════════════════════════════════════════════════════════════

## Phase 1A — Backend Scaffolding (`nutrimind-backend/`)

### Step 1.1: Initialize the project
```bash
mkdir nutrimind-backend
cd nutrimind-backend
npm init -y
```

### Step 1.2: Install production dependencies
```bash
npm install express typescript @prisma/client jsonwebtoken bcryptjs cors helmet express-validator dotenv @google/generative-ai @react-pdf/renderer react
```

### Step 1.3: Install dev dependencies
```bash
npm install -D prisma tsx nodemon @types/express @types/jsonwebtoken @types/bcryptjs @types/cors @types/node ts-node
```

### Step 1.4: Create `tsconfig.json`
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "jsx": "react"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Step 1.5: Create folder structure
```
nutrimind-backend/
  prisma/
    data/            ← FNRI CSV goes here (human provides)
    schema.prisma
    seed.ts
  src/
    controllers/
    middleware/
    routes/
    services/
    lib/
      prisma.ts
      gemini.ts
      fnri.ts
      jwt.ts
      pdf.ts
      calculations.ts
    types/
    app.ts
    server.ts
  .env
  .env.example
  package.json
  tsconfig.json
```

### Step 1.6: Create `.env.example`
```env
# Database (HUMAN MUST FILL)
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nutrimind

# JWT (HUMAN MUST FILL — generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=
JWT_REFRESH_SECRET=

# Gemini (HUMAN MUST FILL — get from https://aistudio.google.com/apikey)
GEMINI_API_KEY=

# Cron (HUMAN MUST FILL — generate same as JWT)
CRON_SECRET=

# Server
PORT=5000
NODE_ENV=development
```

### Step 1.7: Create `src/app.ts`
Basic Express app with:
- `cors({ origin: 'http://localhost:3000', credentials: true })`
- `helmet()`
- `express.json()`
- `GET /health` → `{ success: true, message: 'NutriMind API is running' }`

### Step 1.8: Create `src/server.ts`
Entry point that:
- Loads dotenv
- Imports app
- Starts server on `process.env.PORT || 5000`
- Logs "Server running on port XXXX"

### Step 1.9: Add scripts to `package.json`
```json
{
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "seed": "tsx prisma/seed.ts"
  }
}
```

### Verification: Phase 1A
- Run `npm run dev`
- Visit `http://localhost:5000/health`
- Should return `{ "success": true, "message": "NutriMind API is running" }`

---

## Phase 1B — Frontend Scaffolding (`nutrimind-frontend/`)

### Step 1.10: Initialize Next.js project
```bash
npx -y create-next-app@14 nutrimind-frontend --typescript --tailwind --eslint --app --src-dir --no-turbo --import-alias "@/*"
```
> ⚠️ Use Next.js 14 specifically. Do NOT use `--turbo` flag. Turbopack is DISABLED.

### Step 1.11: Install additional dependencies
```bash
cd nutrimind-frontend
npm install axios jsonwebtoken @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-checkbox @radix-ui/react-avatar @radix-ui/react-progress jwt-decode
npm install -D @types/jsonwebtoken
```

### Step 1.12: Create folder structure
```
nutrimind-frontend/
  src/
    app/
      (auth)/
        login/page.tsx
        register/page.tsx
      (onboarding)/
        onboarding/
          stats/page.tsx
          preferences/page.tsx
          conditions/page.tsx
          allergies/page.tsx
          tos/page.tsx
        nutrition-report/page.tsx
      (user)/
        dashboard/page.tsx
        meals/page.tsx
        grocery/page.tsx
        history/page.tsx
        profile/page.tsx
        nutritionists/page.tsx
      (nutritionist)/
        nutritionist/
          reviews/page.tsx
          approved/page.tsx
          patients/page.tsx
          library/page.tsx
          profile/page.tsx
      (admin)/
        admin/
          overview/page.tsx
          users/page.tsx
          nutritionists/page.tsx
          meals/page.tsx
          analytics/page.tsx
      layout.tsx
      page.tsx
    components/
      ui/
      user/
      nutritionist/
      admin/
      shared/
    lib/
      axios.ts
      auth.ts
      context/
        AuthContext.tsx
    hooks/
    types/
    public/
      manifest.json
      icons/
  next.config.js
  tailwind.config.ts
  .env.local
```

### Step 1.13: Configure `tailwind.config.ts` with design system
```typescript
// Colors:
//   Background:  #0d0d0d / #141416
//   Surface:     #1a1a1e
//   Border:      #2a2a2e
//   Green:       #4caf50 / #52B788
//   Text:        #f3f4f6
//   Muted:       #6B7280
//   Warning:     #FEF3C7 / #92400E
//   Verified:    #D1FAE5 / #065F46
//   Pending:     #FEF3C7 / #92400E
//   Error:       #FEE2E2 / #991B1B
//   Purple:      #EDE9FE / #5B21B6

// Typography (Google Fonts):
//   Headings: Plus Jakarta Sans
//   Body:     DM Sans
//   Mono:     JetBrains Mono
```

### Step 1.14: Set up `.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### Step 1.15: Ensure dev script does NOT use Turbopack
In `package.json`, the dev script must be:
```json
"dev": "next dev"
```
NOT `next dev --turbo`. NEVER enable Turbopack.

### Verification: Phase 1B
- Run `npm run dev`
- Visit `http://localhost:3000`
- Next.js default page renders with no errors

---

# ═══════════════════════════════════════════════════════════════
# PHASE 2 — DATABASE SCHEMA & SEED
# Goal: All 20 tables defined and migrated. FNRI data seeded.
# Dependencies: Phase 1A complete
# ═══════════════════════════════════════════════════════════════

## 🛑 HUMAN ACTION REQUIRED BEFORE PHASE 2

```
┌─────────────────────────────────────────────────────────────┐
│  The AI agent CANNOT proceed with Phase 2 until the human   │
│  completes ALL of the following steps:                       │
│                                                              │
│  1. INSTALL POSTGRESQL                                       │
│     → Download from https://www.postgresql.org/download/     │
│     → Install and remember the password you set for the      │
│       'postgres' user during installation                    │
│                                                              │
│  2. CREATE THE DATABASE                                      │
│     → Open pgAdmin or psql terminal                         │
│     → Run: CREATE DATABASE nutrimind;                        │
│                                                              │
│  3. SET DATABASE_URL IN .env                                 │
│     → Open nutrimind-backend/.env                           │
│     → Set: DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/nutrimind │
│     → Replace YOUR_PASSWORD with your actual postgres password│
│                                                              │
│  4. PROVIDE FNRI CSV FILE                                    │
│     → Place the Philippine Food Composition Table CSV at:    │
│       nutrimind-backend/prisma/data/fnri.csv                │
│     → Tell the agent what the column headers are             │
│                                                              │
│  ⚡ Tell the agent "Manual setup done" when ready           │
└─────────────────────────────────────────────────────────────┘
```

### IF THE AGENT ENCOUNTERS THESE ERRORS — IT IS A MANUAL SETUP ISSUE:
- `Error: P1001: Can't reach database server` → PostgreSQL not installed/running
- `Error: P1003: Database nutrimind does not exist` → Database not created
- `Error: P1000: Authentication failed` → Wrong password in DATABASE_URL
- `Error: ENOENT: no such file or directory, open '.../fnri.csv'` → CSV not provided

**DO NOT try to fix these programmatically. STOP and tell the user.**

---

## Step 2.1: Initialize Prisma
```bash
npx prisma init
```

## Step 2.2: Define ALL 20 tables in `prisma/schema.prisma`

### ENUMS — Define all of these FIRST:
```
Role:                USER | NUTRITIONIST | ADMIN
Goal:                LOSE_WEIGHT | GAIN_WEIGHT | MAINTAIN | BUILD_MUSCLE
ActivityLevel:       SEDENTARY | LIGHTLY_ACTIVE | ACTIVE | VERY_ACTIVE
DietaryPreference:   OMNIVORE | VEGETARIAN | VEGAN | PESCATARIAN
CarbPreference:      LOW | MODERATE | HIGH
HealthConditionType: DIABETES | HYPERTENSION | KIDNEY_DISEASE | HEART_CONDITION | PREGNANT | NONE
AllergenType:        SHELLFISH | NUTS | DAIRY | GLUTEN | EGGS | NONE
MealType:            BREAKFAST | LUNCH | DINNER | SNACK
MealPlanStatus:      PENDING_REVIEW | APPROVED | REJECTED | CANCELLED
AIConfidenceFlag:    SAFE | CAUTION | NEEDS_REVIEW
MealLogSource:       SYSTEM_GENERATED | USER_LOGGED
MealLogDataSource:   FNRI | GEMINI_ESTIMATED | SYSTEM
MealLogStatus:       DONE | PENDING | SKIPPED
NotificationType:    PLAN_APPROVED | PLAN_REJECTED | REVIEW_REQUEST | ASSIGNMENT | WEEKLY_CHECKIN
AssignmentStatus:    PENDING | ACTIVE | ENDED
```

### TABLES — Build EXACTLY these 20 tables with EXACTLY these fields:

**Table 1: User**
- id: String @id @default(cuid())
- name: String
- email: String @unique
- passwordHash: String
- role: Role @default(USER)
- tosAccepted: Boolean @default(false)
- tosAcceptedAt: DateTime?
- onboardingDone: Boolean @default(false)
- image: String?
- createdAt: DateTime @default(now())
- updatedAt: DateTime @updatedAt

**Table 2: Account** (OAuth placeholder — build but don't wire up OAuth yet)
- id: String @id @default(cuid())
- userId: String (FK → User)
- type: String
- provider: String
- providerAccountId: String
- access_token: String?
- refresh_token: String?
- expires_at: Int?

**Table 3: Session**
- id: String @id @default(cuid())
- userId: String (FK → User)
- sessionToken: String @unique
- expires: DateTime

**Table 4: UserProfile**
- id: String @id @default(cuid())
- userId: String @unique (FK → User)
- age: Int?
- heightCm: Float?
- weightKg: Float?
- targetWeightKg: Float?
- goal: Goal?
- activityLevel: ActivityLevel?
- dietaryPreference: DietaryPreference?
- carbPreference: CarbPreference?
- foodCulture: String?
- dailyCalorieTarget: Int?
- lastCheckinAt: DateTime?
- checkinStreak: Int @default(0)
- updatedAt: DateTime @updatedAt

**Table 5: HealthCondition**
- id: String @id @default(cuid())
- userId: String (FK → User)
- condition: HealthConditionType

**Table 6: Allergy**
- id: String @id @default(cuid())
- userId: String (FK → User)
- allergen: AllergenType

**Table 7: NutritionReport**
- id: String @id @default(cuid())
- userId: String @unique (FK → User)
- generatedAt: DateTime @default(now())
- acknowledgedAt: DateTime?
- foodsToAvoid: Json
- foodsToLimit: Json
- foodsRecommended: Json
- drinksGuidance: Json
- generalSummary: String
- basedOnConditions: Json
- basedOnAllergies: Json

**Table 8: NutritionistProfile**
- id: String @id @default(cuid())
- userId: String @unique (FK → User)
- verifiedByAdminId: String? (FK → User)
- prcLicenseNumber: String @unique
- prcLicenseExpiry: DateTime
- specialization: String?
- yearsOfExperience: Int?
- university: String?
- bio: String?
- isVerified: Boolean @default(false)
- rating: Float @default(0)
- totalVerified: Int @default(0)
- verifiedAt: DateTime?

**Table 9: NutritionistAssignment**
- id: String @id @default(cuid())
- userId: String (FK → User)
- nutritionistProfileId: String (FK → NutritionistProfile)
- status: AssignmentStatus @default(PENDING)
- assignedAt: DateTime @default(now())
- endedAt: DateTime?

**Table 10: FoodItem** (FNRI Dataset)
- id: String @id @default(cuid())
- name: String
- category: String?
- calories: Float
- proteinG: Float
- carbsG: Float
- fatG: Float
- fiber: Float?
- sodium: Float?
- potassium: Float?
- calcium: Float?
- iron: Float?
- vitaminA: Float?
- vitaminC: Float?
- vitaminB1: Float?
- vitaminB2: Float?
- niacin: Float?
- water: Float?
- source: String @default("FNRI")

**Table 11: FoodAlias**
- id: String @id @default(cuid())
- foodItemId: String (FK → FoodItem)
- alias: String
- createdAt: DateTime @default(now())

**Table 12: MealPlan**
- id: String @id @default(cuid())
- planGroupId: String (UUID — groups 21 meals of one 7-day plan)
- userId: String (FK → User)
- nutritionistId: String? (FK → NutritionistProfile)
- libraryMealId: String? @unique (FK → MealLibrary)
- status: MealPlanStatus @default(PENDING_REVIEW)
- mealType: MealType
- mealName: String
- description: String?
- calories: Float
- proteinG: Float
- carbsG: Float
- fatG: Float
- aiConfidenceFlag: AIConfidenceFlag @default(SAFE)
- nutritionistNote: String?
- scheduledDate: DateTime
- reviewedAt: DateTime?
- createdAt: DateTime @default(now())

**Table 13: MealLibrary**
- id: String @id @default(cuid())
- verifiedByNutritionistId: String? (FK → NutritionistProfile)
- mealName: String
- description: String?
- mealType: MealType
- calories: Float
- proteinG: Float
- carbsG: Float
- fatG: Float
- suitableConditions: Json?
- allergenFree: Json?
- dietaryTags: Json?
- usageCount: Int @default(0)
- addedAt: DateTime @default(now())

**Table 14: MealIngredient**
- id: String @id @default(cuid())
- mealPlanId: String (FK → MealPlan)
- foodItemId: String? (FK → FoodItem)
- ingredientName: String
- category: String?

**Table 15: MealLog**
- id: String @id @default(cuid())
- userId: String (FK → User)
- mealPlanId: String? (FK → MealPlan)
- source: MealLogSource
- mealName: String
- calories: Float
- proteinG: Float
- carbsG: Float
- fatG: Float
- dataSource: MealLogDataSource
- status: MealLogStatus @default(PENDING)
- warningType: String?
- warningShown: Boolean @default(false)
- warningAcknowledged: Boolean @default(false)
- loggedAt: DateTime @default(now())
- notes: String?

**Table 16: WeightLog**
- id: String @id @default(cuid())
- userId: String (FK → User)
- weightKg: Float
- loggedAt: DateTime @default(now())
- note: String?

**Table 17: DailyNutritionLog**
- id: String @id @default(cuid())
- userId: String (FK → User)
- logDate: DateTime
- totalCalories: Float
- totalProteinG: Float
- totalCarbsG: Float
- totalFatG: Float
- targetCalories: Float
- adherencePct: Float

**Table 18: GroceryList**
- id: String @id @default(cuid())
- userId: String (FK → User)
- weekLabel: String
- generatedAt: DateTime @default(now())

**Table 19: GroceryItem**
- id: String @id @default(cuid())
- groceryListId: String (FK → GroceryList)
- ingredientName: String
- category: String?
- isChecked: Boolean @default(false)

**Table 20: Notification**
- id: String @id @default(cuid())
- userId: String (FK → User)
- title: String
- message: String
- type: NotificationType
- isRead: Boolean @default(false)
- createdAt: DateTime @default(now())

## Step 2.3: Create `src/lib/prisma.ts` — Prisma singleton
```typescript
// Pattern: reuse prisma client in development to avoid
// "Too many Prisma clients" error with hot reloading
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
```

## Step 2.4: Run migration
```bash
npx prisma migrate dev --name init
```

## Step 2.5: Create `prisma/seed.ts`
- Read CSV from `prisma/data/fnri.csv`
- Parse each row into a FoodItem record
- Use `prisma.foodItem.upsert()` to avoid duplicates
- Log count of records inserted

## Step 2.6: Run seed
```bash
npx prisma db seed
```

### Verification: Phase 2
- `npx prisma studio` shows all 20 tables
- FoodItem table has rows from FNRI CSV
- All enums visible in schema

---

# ═══════════════════════════════════════════════════════════════
# PHASE 3 — BACKEND AUTH & MIDDLEWARE
# Goal: JWT auth (register/login/refresh/logout) + RBAC
# Dependencies: Phase 2 complete
# ═══════════════════════════════════════════════════════════════

## 🛑 HUMAN ACTION REQUIRED BEFORE PHASE 3

```
┌─────────────────────────────────────────────────────────────┐
│  Generate JWT secrets and add to nutrimind-backend/.env:     │
│                                                              │
│  Run this command TWICE to generate two different secrets:   │
│  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" │
│                                                              │
│  Then paste into .env:                                       │
│  JWT_SECRET=<first generated string>                         │
│  JWT_REFRESH_SECRET=<second generated string>                │
│                                                              │
│  ⚡ Tell the agent "Secrets are set" when ready              │
└─────────────────────────────────────────────────────────────┘
```

## Files to create in this phase:

### 3.1: `src/types/index.ts` — Shared TypeScript types
```typescript
// Must include at minimum:
export interface JWTPayload {
  userId: string;
  email: string;
  role: 'USER' | 'NUTRITIONIST' | 'ADMIN';
  iat: number;
  exp: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}
```

### 3.2: `src/lib/jwt.ts` — JWT helpers
- `signAccessToken(payload)` → expires in 15m
- `signRefreshToken(payload)` → expires in 7d
- `verifyAccessToken(token)` → returns decoded payload
- `verifyRefreshToken(token)` → returns decoded payload

### 3.3: `src/middleware/auth.ts` — Authentication middleware
- Extract `Bearer <token>` from Authorization header
- Verify with `verifyAccessToken()`
- Attach decoded payload to `req.user`
- Return 401 if missing or invalid

### 3.4: `src/middleware/rbac.ts` — Role-based access control
- `requireRole(...roles: string[])` → middleware function
- Check `req.user.role` against allowed roles
- Return 403 if role mismatch
- Route access rules:
  - `/api/user/*` → USER only
  - `/api/nutritionist/*` → NUTRITIONIST only
  - `/api/admin/*` → ADMIN only
  - `/api/auth/*` → public (no middleware)

### 3.5: `src/middleware/validate.ts` — Validation wrapper
- Wraps express-validator
- Returns consistent `{ success: false, error: "..." }` on validation failure

### 3.6: `src/services/auth.service.ts` — Auth business logic
- `register(name, email, password)`:
  - Check if email exists → error if so
  - Hash password with bcrypt (saltRounds: 12)
  - Create User record
  - Sign and return tokens
- `login(email, password)`:
  - Find user by email → error if not found
  - Compare password with bcrypt → error if mismatch
  - Sign and return tokens
- `refreshToken(token)`:
  - Verify refresh token
  - Fetch user from DB (might have changed role)
  - Sign and return new access token

### 3.7: `src/controllers/auth.controller.ts`
- Thin controller — calls service, formats response
- NEVER contains business logic

### 3.8: `src/routes/auth.routes.ts`
```
POST /api/auth/register   → auth.controller.register
POST /api/auth/login      → auth.controller.login
POST /api/auth/refresh    → auth.controller.refresh
POST /api/auth/logout     → auth.controller.logout
```

### 3.9: Create empty protected route files
- `src/routes/user.routes.ts` → uses `auth` + `requireRole('USER')`
- `src/routes/nutritionist.routes.ts` → uses `auth` + `requireRole('NUTRITIONIST')`
- `src/routes/admin.routes.ts` → uses `auth` + `requireRole('ADMIN')`

### 3.10: Mount all routes in `app.ts`

### Verification: Phase 3
Test with Postman, Thunder Client, or curl:
- `POST /api/auth/register` → creates user, returns tokens
- `POST /api/auth/login` → returns JWT with `{ userId, email, role }`
- Protected route without token → 401
- Protected route with wrong role → 403
- Password NEVER appears in any response

---

# ═══════════════════════════════════════════════════════════════
# PHASE 4 — FRONTEND FOUNDATION & DESIGN SYSTEM
# Goal: Axios, auth context, route guard, all 15 UI components
# Dependencies: Phase 1B complete (can run PARALLEL with Phases 2-3)
# ═══════════════════════════════════════════════════════════════

## Files to create:

### 4.1: `src/lib/axios.ts`
```typescript
// Axios instance configuration:
// - baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'
// - withCredentials: true (for httpOnly cookies)
// - Response interceptor:
//     401 → redirect to /login
//     403 → redirect to /unauthorized
```

### 4.2: `src/lib/auth.ts`
- JWT decode helper (client-side decode only — NOT verify)
- Cookie read/write/clear helpers

### 4.3: `src/lib/context/AuthContext.tsx`
```typescript
// Stores: userId, name, email, role, onboardingDone
// Provides:
//   login(token) → decode JWT, set state, save cookie
//   logout() → clear cookie, clear state, redirect /login
//   isLoading → true during initial auth check on mount
```

### 4.4: `src/hooks/useAuth.ts`
- Wraps AuthContext with `useContext`

### 4.5: `src/components/shared/RouteGuard.tsx`
```typescript
// Wraps every protected page. Checks IN THIS ORDER:
// 1. Is user logged in?         No → redirect /login
// 2. Does role match route?     No → redirect /unauthorized
// 3. Is onboarding done?        No → redirect /onboarding/stats
// 4. Is ToS accepted?           No → redirect /onboarding/tos
// 5. Is report acknowledged?    No → redirect /nutrition-report
```

### 4.6: `src/types/index.ts` — All shared frontend types

### 4.7: Build ALL 15 base UI components

**DESIGN SYSTEM RULES — apply to ALL components:**
- Dark theme throughout
- Background: `#0d0d0d` / `#141416`
- Surface: `#1a1a1e`
- Border: `#2a2a2e`
- Primary green: `#4caf50` / `#52B788`
- Text: `#f3f4f6`
- Muted text: `#6B7280`
- Cards: `rounded-2xl`, border, dark surface bg
- Buttons: `rounded-xl`, green primary
- Inputs: `rounded-xl`, dark bg, green focus ring
- Badges: `rounded-full`, color per status

**Component list (build ALL):**

| # | Component | File | Key features |
|---|-----------|------|-------------|
| 1 | Button | `components/ui/Button.tsx` | Variants: primary/secondary/ghost/danger. Loading state with spinner. Disabled state. |
| 2 | Card | `components/ui/Card.tsx` | rounded-2xl, border #2a2a2e, bg #1a1a1e. Optional header/footer slots. |
| 3 | Badge | `components/ui/Badge.tsx` | 5 variants: Verified (#D1FAE5/green), Pending (#FEF3C7/amber), Rejected (#FEE2E2/red), AI Gen (#EDE9FE/purple), User Log (#DBEAFE/blue) |
| 4 | Input | `components/ui/Input.tsx` | Label, error message, green focus ring, dark bg |
| 5 | Modal | `components/ui/Modal.tsx` | Uses @radix-ui/react-dialog. Dark overlay, rounded-2xl card. |
| 6 | Tabs | `components/ui/Tabs.tsx` | Uses @radix-ui/react-tabs. Underline style, green active. |
| 7 | Progress | `components/ui/Progress.tsx` | Uses @radix-ui/react-progress. Green fill bar. |
| 8 | Checkbox | `components/ui/Checkbox.tsx` | Uses @radix-ui/react-checkbox. Green check. |
| 9 | Avatar | `components/ui/Avatar.tsx` | Uses @radix-ui/react-avatar. Initials fallback. |
| 10 | Sidebar | `components/ui/Sidebar.tsx` | Desktop nav. Dark bg, icon + label items, active state. |
| 11 | BottomNav | `components/ui/BottomNav.tsx` | Mobile nav. 4 items: Home, Meals, Grocery, Profile. |
| 12 | LoadingSpinner | `components/shared/LoadingSpinner.tsx` | Centered, green, animated. |
| 13 | EmptyState | `components/shared/EmptyState.tsx` | Icon + message + optional CTA button. |
| 14 | ErrorBoundary | `components/shared/ErrorBoundary.tsx` | Catches errors, shows retry button. |
| 15 | Navbar | `components/shared/Navbar.tsx` | App logo, notification bell, user avatar. |

### Responsive breakpoints:
```
Mobile (<768px):   BottomNav, single column, full width buttons
Tablet (768-1024): Sidebar appears, two columns
Desktop (>1024):   Full sidebar, grid layouts (3+ columns)
```

### Verification: Phase 4
- All 15 components render without errors
- Dark theme colors match spec
- Fonts load (Plus Jakarta Sans, DM Sans)
- RouteGuard redirects work with mock state

---

# ═══════════════════════════════════════════════════════════════
# PHASE 5 — AUTH & ONBOARDING (FULL STACK)
# Goal: Register → Login → 5-step onboarding → nutrition report
# Dependencies: Phases 3 + 4 complete
# ═══════════════════════════════════════════════════════════════

## Backend:

### 5.1: Onboarding service + controller + routes
Add to `user.routes.ts`:
```
POST /api/user/onboarding/profile     → saves UserProfile (age, height, weight, goal, activity, dietary, carb, culture)
POST /api/user/onboarding/conditions  → saves HealthCondition records (delete old, insert new)
POST /api/user/onboarding/allergies   → saves Allergy records (delete old, insert new)
POST /api/user/onboarding/tos         → sets tosAccepted=true, tosAcceptedAt=now()
POST /api/user/onboarding/complete    → sets onboardingDone=true, calculates dailyCalorieTarget
```

### 5.2: Nutrition report service + controller + routes
Add to `user.routes.ts`:
```
POST /api/user/nutrition-report/generate     → calls Gemini (STUB WITH MOCK DATA for now)
POST /api/user/nutrition-report/acknowledge  → sets acknowledgedAt=now()
GET  /api/user/nutrition-report              → returns current report
```

> ⚠️ IMPORTANT: In this phase, the nutrition report generation should return
> MOCK DATA — do NOT call Gemini yet. That gets wired up in Phase 6.
> Use realistic-looking mock data that matches the NutritionReport schema.

### 5.3: Calorie target calculation (`src/lib/calculations.ts`)
```
BMR Calculation (Mifflin-St Jeor):
  Male:   10 × weight(kg) + 6.25 × height(cm) - 5 × age - 161
  Female: 10 × weight(kg) + 6.25 × height(cm) - 5 × age + 5

TDEE = BMR × Activity Multiplier:
  SEDENTARY:      × 1.2
  LIGHTLY_ACTIVE:  × 1.375
  ACTIVE:          × 1.55
  VERY_ACTIVE:     × 1.725

Daily Target:
  LOSE_WEIGHT:   TDEE - 500
  GAIN_WEIGHT:   TDEE + 500
  MAINTAIN:      TDEE
  BUILD_MUSCLE:  TDEE + 300
```

## Frontend:

### 5.4: Auth pages
- `/login/page.tsx` — Email + password → `POST /api/auth/login` → redirect by role:
  - USER → `/dashboard`
  - NUTRITIONIST → `/nutritionist/reviews`
  - ADMIN → `/admin/overview`
- `/register/page.tsx` — Name + email + password → `POST /api/auth/register` → `/onboarding/stats`

### 5.5: Onboarding pages (5 steps, mobile-first with progress bar)
1. `/onboarding/stats/page.tsx` — Goal chips, age/height/weight inputs, activity chips
2. `/onboarding/preferences/page.tsx` — Dietary chips, food culture text, carb preference chips
3. `/onboarding/conditions/page.tsx` — Condition chips + warning label. MUST select ≥1 (including None)
4. `/onboarding/allergies/page.tsx` — Allergen chips. MUST select ≥1 (including None)
5. `/onboarding/tos/page.tsx` — Scrollable ToS + 2 checkboxes:
   - "I understand AI plans are not medical advice"
   - "I agree to Terms of Service and Privacy Policy"
   - Button DISABLED until both checked

### 5.6: Nutrition report page
- `/nutrition-report/page.tsx`
- Summary card: condition, goal, calorie target
- Mobile: Tabs (Avoid / Limit / Good / Drinks)
- Desktop: all sections in columns
- Sticky acknowledge button at bottom
- Download PDF button
- CANNOT access /dashboard without acknowledging

### Verification: Phase 5
- Register a new user → lands on onboarding
- Complete all 5 steps → lands on nutrition report
- Acknowledge → can access dashboard
- Login again → goes straight to dashboard
- Login with wrong password → error message

---

# ═══════════════════════════════════════════════════════════════
# PHASE 6 — AI LAYER (FNRI + GEMINI)
# Goal: FNRI lookup chain + Gemini integration. Backend only.
# Dependencies: Phase 3 complete (Phase 5 recommended but not required)
# ═══════════════════════════════════════════════════════════════

## 🛑 HUMAN ACTION REQUIRED BEFORE PHASE 6

```
┌─────────────────────────────────────────────────────────────┐
│  The AI agent CANNOT proceed with Phase 6 until the human   │
│  completes these steps:                                      │
│                                                              │
│  1. GET A GEMINI API KEY                                     │
│     → Go to: https://aistudio.google.com/apikey             │
│     → Click "Create API Key"                                 │
│     → Copy the key                                           │
│                                                              │
│  2. ADD TO .env                                              │
│     → Open nutrimind-backend/.env                           │
│     → Add: GEMINI_API_KEY=<paste your key here>             │
│                                                              │
│  IF THE AGENT SEES THESE ERRORS, IT'S THIS:                 │
│  • "API key not valid" → key is wrong or not set            │
│  • "GEMINI_API_KEY is undefined" → not in .env              │
│  • 401/403 from Gemini → key issue                          │
│                                                              │
│  ⚡ Tell the agent "API key is set" when ready               │
└─────────────────────────────────────────────────────────────┘
```

## 6.1: `src/lib/gemini.ts` — Gemini client with 4-model fallback

```typescript
// Model rotation order (try in sequence, fallback on error/rate-limit):
// 1. gemini-2.5-flash
// 2. gemini-2.0-flash
// 3. gemini-1.5-pro
// 4. gemini-1.5-flash

// RULES (DO NOT DEVIATE):
// - Always fetch LATEST user profile from DB before each call
// - NEVER cache user profile
// - Always request strict JSON output (no markdown, no backticks, no preamble)
// - Include health conditions + allergies as HARD CONSTRAINTS
// - Inject filtered FNRI subset (~100-150 items by meal type/category) into prompts
```

## 6.2: `src/lib/fnri.ts` — FNRI 4-step lookup chain

```
EXACT IMPLEMENTATION — do not change the order or skip steps:

function lookupIngredient(name: string): { food: FoodItem, source: 'FNRI' | 'ESTIMATED' }

Step 1: Exact match (case insensitive)
  → SELECT * FROM FoodItem WHERE LOWER(name) = LOWER(input)
  → if found: return { food, source: 'FNRI' }

Step 2: Alias match
  → SELECT * FROM FoodAlias JOIN FoodItem WHERE LOWER(alias) = LOWER(input)
  → if found: return { food: alias.foodItem, source: 'FNRI' }

Step 3: Fuzzy match (contains)
  → SELECT * FROM FoodItem WHERE LOWER(name) LIKE '%' + LOWER(input) + '%'
  → if found:
      → INSERT INTO FoodAlias (alias=input, foodItemId=matched.id)
      → return { food: matched, source: 'FNRI' }

Step 4: Gemini estimate (LAST RESORT)
  → Ask Gemini to estimate nutrition values for this ingredient
  → return { food: estimatedValues, source: 'ESTIMATED' }
```

## 6.3: `src/lib/calculations.ts` — Update with nutrition math
```
Ingredient nutrition × serving → meal total
All meals in a day → day total
Upsert into DailyNutritionLog
```

## 6.4: `src/services/meal-generation.service.ts`

```
7-Day Plan Generation Logic:

1. Fetch user's profile, conditions, allergies from DB
2. Check MealLibrary for matching meals:
   → match on conditions + allergens + dietaryPreference + goal
   → if sufficient matches found:
      → serve verified meals
      → increment usageCount
      → set status: APPROVED
      → return

3. If no/insufficient MealLibrary matches:
   → Generate new planGroupId (UUID)
   → Call Gemini to generate 21 meals (3 meals × 7 days)
   → For each generated meal:
      → FNRI lookup per ingredient
      → Set aiConfidenceFlag:
          SAFE         = user has no conditions AND all ingredients are FNRI-sourced
          CAUTION      = user HAS conditions AND all ingredients are FNRI-sourced
          NEEDS_REVIEW = user HAS conditions AND some ingredients are ESTIMATED
      → Save as MealPlan with status: PENDING_REVIEW
      → Save ingredients as MealIngredient records

4. Cancel previous plan:
   → Set all MealPlan rows with user's old planGroupId to status: CANCELLED

5. If any meal has NEEDS_REVIEW:
   → Create Notification for assigned nutritionist (or global queue)
```

## 6.5: Replace nutrition report mock data with real Gemini call
Wire up the stub from Phase 5 to actually call Gemini.

## 6.6: FNRI routes
```
GET  /api/fnri/lookup?name=<ingredient>  → returns FNRI lookup result
POST /api/fnri/import                     → re-imports CSV (admin tool)
```

### Verification: Phase 6
- FNRI lookup returns FNRI data for "rice", "chicken breast"
- Unknown foods fall through to Gemini estimation
- FoodAlias auto-populated on fuzzy match
- Gemini returns valid JSON
- Test fallback by using an invalid model name
- Nutrition report now generates real data

---

# ═══════════════════════════════════════════════════════════════
# PHASE 7 — MEAL PLAN SYSTEM (FULL STACK)
# Goal: Generate, display, log, and review meal plans
# Dependencies: Phases 5 + 6 complete
# ═══════════════════════════════════════════════════════════════

## Backend:
```
POST   /api/user/meals/generate    → triggers 7-day plan generation (from Phase 6)
GET    /api/user/meals/current     → returns current plan (latest planGroupId, not CANCELLED)
GET    /api/user/meals/history     → returns all past plans grouped by planGroupId
POST   /api/user/meals/log-outside → logs outside meal + checks for warnings
PATCH  /api/user/meals/:id/status  → updates meal status (DONE/SKIPPED)
```

Outside meal warning detection:
```
When user logs an outside meal:
1. Gemini estimates nutrition for the meal name
2. Check against user's allergies → if conflict → warningType: 'ALLERGY'
3. Check against user's conditions → if conflict → warningType: 'CONDITION'
4. Check if daily total + this meal > dailyCalorieTarget → warningType: 'CALORIE_EXCEEDED'
5. Return warning to frontend if any found
6. If user acknowledges → save with warningAcknowledged: true
```

## Frontend:

### Components to build:
- `CalorieRing.tsx` — SVG progress circle. Green when under target, red when over.
- `MealCard.tsx` — Meal name, badge, calories, macros, ingredients. Nutritionist info if APPROVED.
- `WeeklyGrid.tsx` — 7-day layout (Mon-Sun), 3 meals per day.
- `WarningBanner.tsx` — Shows under PENDING_REVIEW meals:
  > "NutriMind AI can make mistakes. This plan has not yet been reviewed
  > by a licensed nutritionist. Please consult a healthcare professional
  > if you have concerns."
- `OutsideMealModal.tsx` — Meal name, type selector, time picker. Submit → check for warnings.

### Pages:
- `/dashboard/page.tsx` — Greeting, date, calorie ring, macro progress bars, today's meals, + FAB button
- `/meals/page.tsx` — 7-day grid, badges per meal, regenerate button

### Hooks:
- `useMeals.ts` — fetch current meals, meal history

### Verification: Phase 7
- Generate plan → 21 meals created
- Dashboard shows calorie ring with real data
- Meals page shows full 7-day grid
- Regenerate cancels old plan, creates new one
- Outside meal logs correctly with warnings

---

# ═══════════════════════════════════════════════════════════════
# PHASE 8 — SUPPORTING FEATURES (FULL STACK)
# Goal: Grocery, history, profile, weight, check-in, PDF, cron
# Dependencies: Phase 7 complete
# ═══════════════════════════════════════════════════════════════

## 🛑 HUMAN ACTION REQUIRED BEFORE PHASE 8

```
┌─────────────────────────────────────────────────────────────┐
│  Generate a CRON_SECRET and add to nutrimind-backend/.env:  │
│                                                              │
│  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" │
│                                                              │
│  Then add to .env:                                           │
│  CRON_SECRET=<generated string>                              │
│                                                              │
│  ⚡ Tell the agent "Cron secret is set" when ready           │
└─────────────────────────────────────────────────────────────┘
```

## Backend routes to implement:

### Grocery
```
GET   /api/user/grocery/current    → auto-aggregates ingredients from current plan by category
PATCH /api/user/grocery/:id/check  → toggles isChecked
GET   /api/user/grocery/pdf        → streams PDF
```

### Profile & Weight
```
GET   /api/user/profile       → returns UserProfile + conditions + allergies
PATCH /api/user/profile       → updates profile fields
GET   /api/user/weight        → returns WeightLog history
POST  /api/user/weight        → creates WeightLog entry
```

### Check-in
```
POST /api/user/checkin/submit → accepts { changed: boolean, updates?: {...} }
GET  /api/user/checkin/status → returns last checkin date, streak, whether due
```

### Notifications
```
GET   /api/user/notifications      → returns user's notifications (newest first)
PATCH /api/user/notifications/:id/read → marks as read
```

### PDF Generation
```
GET /api/user/nutrition-report/pdf → streams nutrition report PDF (React-PDF)
GET /api/user/grocery/pdf          → streams grocery list PDF (React-PDF)
```

### Cron (protected with CRON_SECRET header)
```
POST /api/cron/weekly-checkin    → Sunday 8PM: fires WEEKLY_CHECKIN notification
POST /api/cron/checkin-reminder  → Monday 8AM/12PM: reminder if not completed
```
Cron logic: After 3 missed check-ins → auto-generate plan using last profile.

## Frontend pages & components:
- `/grocery/page.tsx` — Categories: PRODUCE, MEAT & POULTRY, DAIRY & EGGS, PANTRY. Checkboxes + PDF download.
- `/history/page.tsx` — Timeline grouped by date. Source badges. Status chips.
- `/profile/page.tsx` — Stats, weight input, weight chart, editable sections, logout.
- `CheckinModal.tsx` — Week summary + pre-filled form + "Everything's the same" / "Update & Regenerate"
- `WeightChart.tsx` — Line chart from WeightLog data
- `GroceryList.tsx` — Grouped by category with checkboxes

---

# ═══════════════════════════════════════════════════════════════
# PHASE 9 — PORTALS (NUTRITIONIST + ADMIN)
# Goal: Nutritionist review system + Admin management panel
# Dependencies: Phase 7 complete
# ═══════════════════════════════════════════════════════════════

## Backend — Nutritionist routes:
```
GET   /api/nutritionist/queue       → review queue (assigned first, then global)
PATCH /api/nutritionist/review/:id  → approve/reject with optional note
GET   /api/nutritionist/patients    → list assigned patients
GET   /api/nutritionist/library     → browse MealLibrary
GET   /api/nutritionist/profile     → get own profile
PATCH /api/nutritionist/profile     → update bio, etc.
```

### Nutritionist Queue Logic — implement EXACTLY:
```
1. Fetch meal plans from assigned patients first
2. Then fetch unassigned/global queue
3. Sort ALL by: NEEDS_REVIEW → CAUTION → SAFE

On APPROVE:
  → MealPlan.status = APPROVED
  → MealPlan.reviewedAt = now()
  → MealPlan.nutritionistId = this nutritionist
  → Auto-save to MealLibrary (create new entry)
  → MealLibrary.usageCount = 1
  → Create Notification for user (type: PLAN_APPROVED)

On REJECT:
  → MealPlan.status = REJECTED
  → MealPlan.nutritionistNote = note from nutritionist
  → Trigger Gemini to regenerate THAT SPECIFIC MEAL (not whole plan)
  → New meal gets same planGroupId, scheduledDate, mealType
  → Create Notification for user (type: PLAN_REJECTED, include note)
```

## Backend — Admin routes:
```
GET   /api/admin/users                    → list all users with stats
GET   /api/admin/nutritionists            → list all nutritionists
PATCH /api/admin/nutritionists/:id/verify → set isVerified=true, verifiedByAdminId, verifiedAt
GET   /api/admin/analytics                → total users, active plans, pending reviews, library count, alias count
POST  /api/admin/library/seed             → pre-seed MealLibrary from verified meals
```

## Frontend — Nutritionist portal (DESKTOP ONLY layout):
Sidebar: 📋 Pending Reviews | ✅ Approved Plans | 👥 My Patients | 📚 Meal Library | 👤 My Profile

- `ReviewCard.tsx` — Patient info (name, age, conditions, allergies), meal info (name, type, calories, macros, ingredients with FNRI ✅ / ESTIMATED ⚠️ tags), note input, approve/edit/reject buttons
- `ReviewQueue.tsx` — Sorted list of ReviewCards
- All 5 nutritionist pages

## Frontend — Admin panel (DESKTOP ONLY layout):
Sidebar: 📊 Overview | 👥 Users | 👩‍⚕️ Nutritionists | 🍽️ Meals & AI | 📈 Analytics

- `StatsCard.tsx`, `UserTable.tsx`, `NutritionistTable.tsx`
- All 5 admin pages

## Frontend — User-facing nutritionist directory:
- `/nutritionists/page.tsx` — Grid of verified nutritionist cards with rating, PRC info, request button

---

# ═══════════════════════════════════════════════════════════════
# PHASE 10 — PWA, POLISH & DEPLOYMENT
# Goal: Make it installable, responsive, production-ready
# Dependencies: All previous phases complete
# ═══════════════════════════════════════════════════════════════

## 🛑 HUMAN ACTION REQUIRED BEFORE PHASE 10

```
┌─────────────────────────────────────────────────────────────┐
│  DEPLOYMENT SETUP — only the human can do these:            │
│                                                              │
│  1. Create Vercel account at https://vercel.com             │
│  2. Create TWO Vercel projects:                              │
│     → nutrimind-frontend                                     │
│     → nutrimind-backend                                      │
│                                                              │
│  3. Set up cloud PostgreSQL (pick one):                      │
│     → Supabase: https://supabase.com                        │
│     → Neon: https://neon.tech                                │
│     → Railway: https://railway.app                           │
│                                                              │
│  4. Set ALL environment variables in Vercel dashboard:       │
│     → DATABASE_URL (cloud PostgreSQL connection string)      │
│     → GEMINI_API_KEY                                         │
│     → JWT_SECRET                                             │
│     → JWT_REFRESH_SECRET                                     │
│     → CRON_SECRET                                            │
│     → NEXT_PUBLIC_API_URL (your deployed backend URL)        │
│                                                              │
│  5. Configure Vercel Cron Jobs in vercel.json                │
│                                                              │
│  ⚡ Tell the agent when deployment accounts are ready        │
└─────────────────────────────────────────────────────────────┘
```

## Tasks:
1. Set up `next-pwa` in `next.config.js`
2. Create `public/manifest.json` (app name, theme color, icons)
3. PWA icons at all required sizes
4. Audit ALL pages for responsive breakpoints (mobile/tablet/desktop)
5. Ensure BottomNav on mobile, Sidebar on tablet/desktop
6. Ensure EVERY data component has: loading state, error state, empty state
7. Verify all 5 legal protection layers:
   - Layer 1: `tosAccepted` + `tosAcceptedAt` on User
   - Layer 2: `acknowledgedAt` on NutritionReport
   - Layer 3: `PENDING_REVIEW` status on MealPlan
   - Layer 4: `warningShown` + `warningAcknowledged` on MealLog
   - Layer 5: `source` field (SYSTEM_GENERATED vs USER_LOGGED) on MealLog
8. Visual polish: transitions, hover effects, micro-animations
9. Audit all API responses for consistent `{ success, data?, error? }` format
10. Create `vercel.json` with cron schedules

---

# ═══════════════════════════════════════════════════════════════
# CODING CONVENTIONS — APPLY TO ALL PHASES
# ═══════════════════════════════════════════════════════════════

## Backend conventions:
- Express.js with TypeScript throughout (NEVER plain JS)
- Controllers handle request/response ONLY — no business logic
- Services handle ALL business logic
- Prisma client singleton at `src/lib/prisma.ts`
- Always validate request body with express-validator
- Always return: `{ success: boolean, data?: any, error?: string }`
- Always use try/catch in controllers
- NEVER expose passwordHash in any response
- JWT secrets from environment variables ONLY
- Gemini always returns strict JSON only
- NEVER cache user profile for Gemini prompts
- PDF generation streamed via API route
- CRON_SECRET required for all cron routes

## Frontend conventions:
- App Router ONLY — NEVER Pages Router
- `"use client"` only when needed (useState, useEffect, Axios, event handlers)
- Server Components for layout-only pages
- ALL API calls via Axios instance at `/lib/axios.ts`
- NEVER use `fetch()` directly — always Axios instance
- NEVER call backend from Server Components
- Always TypeScript — never plain JS
- Always handle: loading state, error state, empty state
- Radix UI primitives directly — NEVER use Shadcn CLI
- Turbopack DISABLED — NEVER suggest enabling it
- Role always from AuthContext — never hardcode
- Always wrap protected pages with RouteGuard
