# 📜 NutriMind — Project Update Log & Changelog

> **Documentation status — Historical changelog (August 19, 2026):** Entries preserve what earlier development sessions reported; they do not independently prove current behavior or runtime, integration, E2E, deployment, or clinical verification. Consult [`docs/NUTRIMIND_ENGINEERING_RECORD.md`](docs/NUTRIMIND_ENGINEERING_RECORD.md) for current evidence and accepted status vocabulary.
A comprehensive timeline of all features, specifications, addendums, and bug fixes implemented in the NutriMind application from inception to June 21, 2026.

---

## 🚀 PHASE 1: CORE INFRASTRUCTURE & AUTHENTICATION (April–May 2026)
*The foundation of the NutriMind application, establishing secure user sessions and clinical role layers.*

- **JWT Authentication Flow:** Fully stateless authentication utilizing access tokens (`15m` lifespan) and refresh tokens (`7d` lifespan).
- **Google OAuth Integration:** Support for Google Sign-In, automatically creating verified user profiles and matching credentials.
- **Email Verification (OTP):** Security guardrail requiring a 6-digit email OTP (One-Time Password) before completing registration.
- **Self-Service Password Recovery:** Secure forgot/reset password system utilizing signed, short-lived tokens and email verification links.
- **RBAC (Role-Based Access Control):** Custom middleware enforcing strict access paths for three distinct user roles: `USER`, `NUTRITIONIST`, and `ADMIN`.

---

## 📋 PHASE 2: USER ONBOARDING & CLINICAL PROFILING (May 2026)
*Capturing user biometric indicators and health variables to serve as input for clinical guardrails.*

- **Biometric Stat Collection:** Onboarding questionnaire capturing `age`, `biologicalSex`, `heightCm`, `weightKg`, and `targetWeightKg`.
- **Target Weight Guidance:** Dynamic validation adjusting boundaries relative to the user's selected goal (Lose Weight / Gain Weight / Maintain).
- **Nutritional & Cultural Mapping:** Capturing dietary preferences (Omnivore, Vegetarian, Vegan, Pescatarian), carb limits, and preferred food cultures.
- **Clinical Conditions & Allergies Intake:** Selectable indicators for key health conditions (Diabetes, Pregnancy, etc.) and allergens (Dairy, Gluten, etc.) along with free-text custom "Other" text fields.
- **Interactive Terms of Service (ToS):** Mandatory clinical disclaimer and terms agreement prior to dashboard access.
- **Back Navigation:** Multi-step wizard supporting backward history restoration across all onboarding steps.

---

## 🧠 PHASE 3: AI NUTRITION & WEEKLY PLAN GENERATION (May–June 2026)
*Leveraging Gemini AI models with local clinical databases to build structured weekly meal plans.*

- **Clinical Nutrition Report Generator:** Automatically compiles a detailed nutrition report recommending specific foods, listing foods to avoid/limit, and providing drinks guidance based on the user's conditions and allergies.
- **Daily Calorie Target Calculator:** Standardized Mifflin-St Jeor equation implementation mapping BMR with activity multipliers.
- **7-Day Meal Plan Generator:** Connects to the Gemini API (under a 4-tier model fallback chain) to build a structured 7-day, 21-meal plan matching the user's daily calorie targets and Filipino food culture.
- **FNRI Philippine Food composition lookup:** Sequentially searches exact matches, aliases, fuzzy terms, and utilizes Gemini estimation as a fallback to link meal plan ingredients to official nutritional metrics.

---

## 🍽️ PHASE 4: MEAL LOGGING & ADHERENCE TRACKING (June 2026)
*Giving users the tools to track daily calories, log outside items, and record overall compliance.*

- **Plan Completion Checklist:** Checkbox toggles on plan items to mark meals as eaten, immediately updating consumed macros.
- **Outside Meal Logger:** Allows logging freestyle dishes not in the active plan, utilizing Gemini to estimate macro metrics.
- **Clinical Guardrail Warnings:** Performs real-time checks on logged outside meals. Warns the user if the meal contains ingredients conflicting with their recorded allergies or health conditions (e.g., sodium warnings for Hypertension).
- **Horizontal Date Switcher:** Multi-day navigation on the dashboard to select and view scheduled meals.
- **Macronutrient Analytics (Calorie Ring):** Visual Adherence Gauge (Calorie Ring) showing consumed vs target calories and macros (Protein, Carbs, Fat).
- **Progress & Weight Logger:** Linear weight chart tracking weigh-ins over time.

---

## 👥 PHASE 5: PROFESSIONAL NUTRITIONIST PORTAL (June 2026)
*Connecting patients with licensed Registered Nutritionists-Dietitians (RNDs) for plan audits.*

- **User-Facing Nutritionist Directory:** Regular users can browse verified, active RND profiles showing specializations, university backgrounds, ratings, and request consultation assignments.
- **Nutritionist Review Queue:** RND dashboard listing pending patient meal plans waiting for audit.
- **Plan Approval & Flags:** RND can approve a patient's plan, or flag specific meals with custom textual feedback. Flagging triggers selective replacement of those slots.
- **RND Profile Verification:** Admin dashboard interface to verify registered nutritionist credentials, inputting active PRC license numbers and expiry dates before granting RND portal access.

---

## 📅 ADDENDUM 1: SHOPPING-DAY ANCHORED WEEKLY PLAN (June 12, 2026)
*Altering plan cycles to match real-world grocery buying schedules.*

- **Shopping Day Selection:** Users choose during onboarding whether they shop on **Weekends** (anchors plan Sunday to Saturday) or **Weekdays** (anchors plan Monday to Sunday).
- **Dynamic Bridging ("Starter Plans"):** If a user signs up mid-week, the system dynamically calculates the number of remaining days until the next cycle start and generates a short-term `STARTER` plan.
- **Weekly Cycle Transitions:** Upon reaching the transition boundary, the system automatically transitions the user from their starter plan to a full 7-day `WEEKLY` cycle aligned to their group's anchor day.

---

## 🧪 ADDENDUM 2: AUTOCOMPLETE CHIP VALIDATIONS & SCHEMA-AWARE AI PROMPTING (June 12, 2026)
*Securing data entry interfaces to prevent free-text input failures.*

- **Ingredient Autocomplete Inputs:** Replaced free-text boxes with autocomplete selection chips connected to the FNRI food database.
- **AI Schema Enforcement:** Upgraded backend Gemini prompts to inject strict JSON schemas (`Zod` validation rules) matching the database constraints exactly.
- **Conflict Handling Loop:** Integrated retry wrappers in the AI generation service that catch validation schema formatting errors and automatically re-prompt the API to self-correct.

---

## 🔄 ADDENDUM 3: MEAL LIBRARY SLOT MATCHING & ROTATION ALGORITHMS (June 12, 2026)
*Enhancing meal variety and profile matching.*

- **Slot-by-Slot Library Matching:** Queries the `MealLibrary` to match approved nutritionist recipes to specific meal categories (Breakfast, Lunch, Dinner, Snack) while verifying calorie and macro distribution.
- **Ingredient Exclusions & Restrictions:** Strictly filters matches based on the user's clinical allergy list and health conditions.
- **Anti-Repetition Rotation:** Implemented a rotation filter ensuring that the same recipe is not suggested consecutively or duplicated within a 3-day window.

---

## 🛡️ ADDENDUM 4: NUTRITIONIST MEAL LIBRARY CRUD & CROSS-FLAGGING (June 13, 2026)
*Enforcing peer-review standards on clinical recipes.*

- **RND Meal Management:** Full, permission-checked CRUD endpoint stack allowing logged-in nutritionists to manage their own library contributions.
- **Cross-RND Flagging Mechanism:** Nutritionists can audit recipes uploaded by other RNDs. If they spot an error or clinical mismatch, they can file a flag record (`MealLibraryFlag`) explaining the issue.
- **Recipe Status Cascade:** Flagging a meal automatically changes its library status to `NEEDS_REVIEW`, temporarily hiding it from user rotation until verified or corrected.

---

## 🔄 ADDENDUM 5: USER-INITIATED MEAL SWAPPING (June 13, 2026)
*Empowering users with alternative selections.*

- **Plan Swapping triggers:** Users can click a "Swap Meal" button on active plan slots to view alternative profile-compatible recipes.
- **3-Swaps Weekly Cap:** Integrates a tracking schema (`PlanSwapTracker`) restricting users to a maximum of 3 swaps per weekly cycle.
- **Atomic Data Execution:** Swapping a meal updates the `MealPlan` record, deletes and recreates associated `MealIngredient` list items, recalculates the active grocery list, and adjusts daily compliance records atomically in a transaction.

---

## 📋 ADDENDUM 6: UNIFIED /MEALS PAGE & CALORIE WARNING SYSTEM (June 20, 2026)
*Improving usability and clinical calorie accountability.*

- **Consolidated Dashboard tabs:** Merged the separate sidebar history view and browse modals into one single `/meals` page with three tab segments: **Plan**, **History**, and **Library**.
- **Swap Calorie Imbalance Warning:** Triggers a preview calculation prior to confirming a swap. If the replacement meal shifts the day's total calories outside ±15% of the user's target, it displays an alert modal letting the user decide whether to proceed.
- **Unconditional Weekly Plan Regeneration:** Corrected the weekly check-in cron task so that new plans are generated unconditionally for all active users in a group on cycle transition day.

---

## 🛠️ RECENT REFINEMENTS & BUG FIXES (June 21, 2026)
*Targeted fixes resolving session timeouts and history views.*

- **Unchecked Meals History Fix:** Resolved a bug where unchecking a meal plan item on the Plan tab left a `PENDING` meal log that remained visible in history. Modified `getPlanHistory` on the backend to exclude `PENDING` status logs from default history listings and removed the "Pending" option from the frontend dropdown.
- **Silent Token Refresh (Axios Interceptor):** Implemented an industry-standard refresh token interceptor on the frontend. Captures `401 Unauthorized` responses when the 15-minute access token expires, silently calls `POST /api/auth/refresh` using the stored 7-day refresh token, updates cookies, and retries queued API requests without logging the user out.
- **Premium Light Theme (June 21, 2026):** Redesigned the application's visual system to default to a clean light-theme experience. Set a crisp off-white page background (`#fbfdfc`), high-contrast dark forest charcoal text/typography (`#111b15`), and white card/surface backgrounds (`#ffffff`). Structured all panels and buttons with sharp, solid outlines (`#111b15`) mimicking the requested design sketch.
- **Sage Green Secondary Accent (June 21, 2026):** Implemented a premium light sage green shade (`#e3efea`) as a prominent card and selection accent background, replacing the warm beige/sand color tones.
- **Claude-Style Collapsible Sidebar (June 21, 2026):** Implemented dynamic collapsible logic inside the generic `<Sidebar />` component (supporting smooth animation resizing from `w-64` to `w-20` on desktop, hiding names/emails/labels in collapsed mode, and displaying centered icons and Circular avatar details). Persisted the toggle state in `localStorage` across page loads and route switches.
- **DRY Portal Layouts (June 21, 2026):** Cleaned up and refactored the separate nutritionist portal (`/nutritionist/*`) and admin panel (`/admin/*`) layouts to mount the central generic `<Sidebar />` and standard `<Navbar />` components, reducing code duplication and unifying collapsible menus across all user roles.
- **Lucide React Icon Migration (June 21, 2026):** Replaced all emojis in the navigation arrays (`Sidebar.tsx` and `BottomNav.tsx`) with professional line icons from the `lucide-react` package (e.g., `LayoutDashboard`, `Utensils`, `ShoppingCart`, `Users`, `User`, `ClipboardList`, `CheckSquare`, `BookOpen`, `Stethoscope`, `TrendingUp`, `LogOut`, `Brain`, `PanelLeftClose`, `PanelLeftOpen`).
- **Meal Card Simplification & Detail Modal (June 21, 2026):** Simplified the layout of meal plan cards in the grid views across the dashboard and meals pages by removing checkbox toggles and action controls. Shifted macro details, ingredients list, and AI estimation warnings into a dedicated pop-up details modal.
- **Detailed Action Triggers (June 21, 2026):** Implemented primary/secondary action flows within the modal. Users can click `Mark as Eaten` (green button), `Skip Meal` (red outline button), or `Swap Meal` (if eligible). Completed or skipped meals present a `Reset Meal Status` button to revert and re-enable selection. Updated status toggle bindings in `/dashboard` and `/meals` page layout hooks.
- **Lucide React Icon Migration Expansion (June 21, 2026):** Completed the conversion of all remaining raw emojis to premium Lucide React icons across all remaining nutritionist portals (verified total count, empty states, flagged banners, medical tags) and the entire 6-step user onboarding flow (biometric metrics, conditions, allergens lists, shopping-day preferences, Terms of Service agreements, back button arrows, and safety warning indicators). Verified successful typescript compilation and completed a production Next.js optimized build.
- **Premium Design Overhaul: Bold Borders & Green Active States (June 21, 2026):**
  - *Active States*: Updated active navigation links in the Sidebar, horizontal date offset switcher on the Dashboard, and multi-step choice cards in the onboarding questionnaire to render a solid green background (`bg-brand-green` / `#2d6a4f` in light mode, `#52B788` in dark mode) with high-contrast white text (`text-white`) and bold borders.
  - *Bold Borders*: Overrode the default Tailwind `.border`, `.border-t`, `.border-b`, `.border-l`, and `.border-r` utilities in `globals.css` to enforce a bold `2px` width globally. Realigned the tabs switcher in `/meals` to render button-style chips with `border-2 border-brand-border` outlines.
  - *Solid Green Scrollbars*: Integrated a custom `::-webkit-scrollbar` styling system. Configured the scrollbar thumb to always display a solid brand green background with no border outline and no hover effect transition.

- **Interactive DiceBear Pixel-Art Avatars Customizer (June 21, 2026):**
  - *Backend Integration*: Updated `UserService.getUserProfileDetails` to fetch and return the user's `image` configuration. Implemented `updateUserImage` method in `UserService` and added a `PUT /api/user/profile/avatar` endpoint in the user routes to save the chosen avatar seed string.
  - *Unified Avatar Component*: Upgraded the `<Avatar />` component in `Avatar.tsx` to integrate the DiceBear `pixel-art` SVG avatar HTTP API. It checks if the image string starts with `http` (such as Google OAuth pictures) and uses it directly, otherwise it falls back to dynamically rendering a pixel-art character using the string as a seed.
  - *Live Preview Profile Card*: Added a customization card on the user Profile page featuring an interactive text input for custom seeds, preset buttons for instant selector choice (`John`, `Jane`, `Felix`, `Coco`, `Cookie`, `Simba`, `Buster`, `Lucky`, `Shadow`, `Sparky`), a live SVG character preview, and an atomic save action that synchronizes session state immediately across the sidebar and header.

- **Claude-Inspired Green Dark Mode (June 21, 2026):**
  - *Color Variables*: Overhauled the dark mode CSS variables (`html.dark`) in `globals.css` to transition from pitch black to Claude's warm dark charcoal layout contrast, customized with a subtle green-charcoal background (`#1c201e`), secondary backgrounds (`#212623`), card surfaces (`#282f2b`), borders (`#353e39`), soft green-white text (`#e8ece9`), and sage-tinted muted subheadings (`#88928d`).
  - *Dynamic Templates*: Replaced hardcoded color values with theme-aware dynamic classes inside `page.tsx` (for landing page footer background) and `nutrition-report/page.tsx` (for the summary card gradient layout).

- **Navigation Restructure & Removal of Nutritionist Assignment (June 21, 2026):**
  - *Database cleanup*: Dropped the `NutritionistAssignment` table and associations from the schema. Created and ran SQL migrations and regenerated the Prisma Client.
  - *Backend services refactoring*: Updated `getReviewQueue` in `nutritionist.service.ts` to return all pending review meal plans globally, sorted by clinical confidence flag order (`NEEDS_REVIEW` -> `CAUTION` -> `SAFE`). Deleted the obsolete `getPatients` method.
  - *Safety Recheck and Swapping Flow*: Implemented `UserService.runSafetyRecheck` and `checkSafetyConflict`. On health condition or allergy updates, the service scans remaining unconsumed meals in the active plan for conflicts, swaps them with approved compatible library items (cap-exempt), or calls Gemini AI to regenerate them as pending review slots.
  - *User Settings Controller*: Created a new `updateAccountSettings` method on `UserController` mapping to `PUT /api/user/profile/settings` to allow users to update their name, email, and password (enforcing strength validations).
  - *Sidebar Restructuring*: Removed "Nutritionists" and "Profile" from the USER sidebar array. Added a new "Progress" tab. Linked the bottom-pinned user card to the settings page (`/profile`). Removed "My Patients" from the NUTRITIONIST sidebar menu.
  - *Progress & Settings Overhaul*: Recreated `/progress` page as a centralized biometrics/preferences card, health conditions/allergies choice chips, autocomplete inputs, SVG weight charts, and adherence calendars. Redesigned `/profile` exclusively for credentials, password changes, and DiceBear avatar seeds.
  - *Build and Compile*: Successfully verified backend/frontend compilation and Next.js static build optimized bundle checks.

---

## 📅 ADDENDUM 8: MEAL HISTORY ACTIVITY CALENDAR & NOTE-TAKING SYSTEM (September 2026)
*Overhauling the meal history timeline into an interactive activity heatmap matrix with glowing meal-type cards and user note-taking capability.*

- **Interactive Intake Activity Heatmap Matrix (`MealActivityCalendar.tsx`):**
  - Replaced the linear list in `/meals` (History tab) with an interactive GitHub/Codex-style contribution matrix.
  - Aligned with NutriMind's signature color palette: Level 0 crisp neutral sage, Level 1 soft mint emerald (`#a7f3d0`), Level 2 NutriMind forest pine (`#08705b`), and Level 3 electric lime glow (`#b8f45f`).
  - Added dynamic time range filtering: **Year** (40-week rolling bird's-eye view), **Month** (5-week focused month matrix with larger tiles), and **Week** (responsive 7-day horizontal card view with daily calorie counters).
  - Clicking any date dynamically focuses that day and reveals its meals in the feed below.
- **Glowing Meal History Card Variant (`MealHistoryCard.tsx`):**
  - Reusable card variant adhering to the dashboard aesthetic and shadcn/ui tactile conventions.
  - Features glowing radial-gradient icon containers tailored to meal types: warm amber with `Egg` icon for Breakfast, coral/rose with `Flame` icon for Lunch and Dinner, and mint/cyan with `Apple` icon for Snack.
  - Bold green category tags, macro breakdown, and status indicators (`DONE`, `SKIPPED`, `OUTSIDE MEAL`, `SWAPPED`).
- **Interactive Meal Note-Taking:**
  - Expanded accordion drawer with an interactive personal note editor (`textarea` with 1,000 character limit).
  - Added `PATCH /api/user/meals/logs/:id/notes` endpoint and updated `updateMealStatus` to accept and persist notes on `MealLog`.
  - Optimistic UI updates with instant feedback (`"Note saved"`) and session resource cache invalidation.
- **Test Coverage:**
  - Verified backend unit tests for `mealStatusBodySchema` and `updateMealLogNotesBodySchema` (520 tests passing).
  - Added unit tests for `MealActivityCalendar` and `MealHistoryCard` (87 tests passing across 24 test files).
  - Zero ESLint errors or warnings.

---

## ⏱️ ADDENDUM 9: RETROACTIVE MEAL LOGGING GRACE PERIOD & CATCH-UP SYSTEM (September 2026)
*Establishing clinical adherence integrity by allowing a 7-day retrospective grace window for passive inactions, preventing ghost data, and enabling 1-click catch-up.*

- **Backend Actionability Separation (`meal-actionability.policy.ts`):**
  - Clarified policy: untouched meals are never automatically marked as skipped, preventing false clinical compliance deterioration and phantom database entries.
  - Added `MEAL_PLAN_LOG_GRACE_DAYS = 7` constant and `isMealPlanScheduleLoggable` function.
  - Added `assertUserLoggableMealPlan(mealPlan, now, graceDays)` to permit logging past meals within 7 days.
  - Added `assertUserSwappableMealPlan(mealPlan, now)` to strictly prevent swapping past scheduled meals (swapping remains restricted to current and upcoming days).
  - Updated `updateMealStatus` controller to stamp `loggedAt: mealPlan.scheduledDate` and record `mealType`, ensuring retroactively checked meals attach to their scheduled calendar day rather than the moment of catch-up.
- **Frontend Catch-Up Experience (`UnloggedMealCatchUpCard.tsx`):**
  - Implemented interactive catch-up card featuring meal type icons, macro details, and 1-click `[ Mark as Eaten ]` and `[ Skip ]` action buttons with integrated loading spinners.
  - Integrated into the `/meals` History tab: when a user clicks on a past day in the Activity Matrix (or when viewing a day with untouched plan items), unlogged scheduled meals are surfaced in a prominent catch-up section.
  - Toggling status from the catch-up cards instantly updates both plan state and meal history cache, immediately lighting up the day's heatmap cell.
- **Plan Workspace Synchronization (`MealCard.tsx`):**
  - Removed visual bug where unlogged past meals were falsely rendered as strikethrough with a "Skipped" badge.
  - Added amber "Unlogged" badge with clock icon for scheduled past meals within the grace period.
  - Enabled "Mark as Eaten" and "Skip Meal" in the modal for past items within the 7-day grace period, while disabling "Swap Meal" with an informative tooltip (`"Past scheduled meals cannot be swapped."`).
  - Added expiration alert for meals older than 7 days (`"The 7-day logging grace period for this scheduled meal has passed."`).
- **Test Suite & Verification:**
  - Backend: Added `[TEST-015]` in `meal-actionability.test.ts` verifying 7-day grace window logging acceptance, past swap rejection, and >7-day rejection (521 passed, 0 failed, 1 clinical todo).
  - Frontend: Added unit tests in `UnloggedMealCatchUpCard.test.tsx` verifying render, eaten toggle, and skip toggle (90 passed across 25 test files).
  - Frontend Lint: `npm run lint` passed with 0 errors and 0 warnings.

---

## 📅 ADDENDUM 10: 3-MONTH CAROUSEL REDESIGN & FUTURE MONTH LOCKING (September 2026)
*Multi-month side-by-side activity visualization with navigation chevrons, future-month locking, and calendar alignment.*

- **Side-by-Side 3-Month Matrix Layout (`MealActivityCalendar.tsx`):**
  - Redesigned Month view to present 3 consecutive months horizontally: Previous Month (`[Month - 1]`), Focused Center Month (`[Month 0]`), and Next Month (`[Month + 1]`).
  - Added interactive navigation chevrons between the month panels:
    - Left chevron `<`: shifts focus to previous months.
    - Right chevron `>`: shifts focus back towards the current month.
  - Positioned navigation chevrons vertically centered with the calendar day grids (`pt-8 sm:pt-9`).
- **Future Month & Chevron Locking Rules:**
  - When the center month is the active/current month (`monthOffset === 0`), the next month panel is recognized as strictly in the future.
  - The right chevron `>` is unclickable and disabled (`disabled={!canGoNext}`, `cursor-not-allowed`, `opacity-30`).
  - The future month panel is displayed with grayish locked styling (`opacity-40 grayscale select-none pointer-events-none cursor-not-allowed`) and a subtle `Locked` badge.
  - Future month cells are unclickable.
  - When navigating backwards in time with `<`, the right chevron re-enables to allow advancing back to the current month.
- **Calendar Grid Alignment & Aesthetic:**
  - Individual day-of-week vertical axes (`Sun`, `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`) for each month.
  - Clean column structure with invisible placeholders for days outside the month boundary, guaranteeing 100% vertical row alignment.
  - High-contrast meal count badges (`1`, `2`, `3+`) inside days with logged activity, styled with NutriMind's theme palette.
  - Header badge dynamically reports active days count for the focused month (`2 active days (month)`).
- **Test Suite & Verification:**
  - Added unit tests in `MealActivityCalendar.test.tsx` testing 3-month side-by-side rendering, future month locking, disabled right chevron at current month, chevron re-enabling after backwards navigation, and day selection (6 passed).
  - ESLint check: passed with 0 errors and 0 warnings.
  - Next.js production build: 52/52 routes successfully compiled.

---

## 📅 ADDENDUM 11: FULL CALENDAR YEAR MATRIX & FUTURE DAY LOCKING (September 2026)
*Full 52/53-week calendar year visualization (Jan 1 to Dec 31) with aligned 12-month headers and faint locked styling for future days.*

- **Full Calendar Year Representation (`MealActivityCalendar.tsx`):**
  - Updated Year mode from a rolling 40-week backward window that truncated at the current date to a full calendar year spanning January 1st through December 31st of the current year (53 weeks).
  - Out-of-bounds days prior to January 1st and after December 31st are rendered as invisible placeholder slots (`opacity-0 pointer-events-none`) preserving exact weekday alignment (e.g., January 1st starts on its accurate day of the week).
- **Future Day Locking & Grayed-Out Styling:**
  - Future days (dates past today through December 31st) are locked and unclickable (`disabled={cell.isFuture}`, `cursor-not-allowed`).
  - Styled with faint dashed border and muted grayish tint matching the Month view design token:
    `border border-dashed border-[#c6d6ce]/60 bg-[#e8efec]/40 opacity-40 cursor-not-allowed dark:border-white/[0.04] dark:bg-white/[0.02] dark:opacity-30`.
  - Accessible `title` and `aria-label` indicate `Upcoming (Locked)` status.
- **Pixel-Perfect 12-Month Header Alignment:**
  - Generated all 12 month labels (`Jan` through `Dec`) mapped to the exact week column where each month begins.
  - Replaced imprecise `justify-between` spacing with week-column-matched slots (`flex gap-1` mirroring the 53 week columns) and matching day-of-week axis spacer (`w-7 sm:w-8`).
  - Guarantees each month label sits directly aligned under its starting week without drift or premature cutoff.
- **Test Suite & Verification:**
  - Expanded `MealActivityCalendar.test.tsx` (7/7 tests passing) verifying all 12 month labels render, future days are disabled with locked labels, and active days remain clickable with live status updates.
  - ESLint check: passed with 0 errors and 0 warnings.

---

## 📅 ADDENDUM 12: THEME-NATIVE ACCESSIBLE CUSTOM SELECT COMPONENT (September 2026)
*Replaced unstyled OS native `<select>` dropdowns with custom NutriMind theme-aligned, keyboard-accessible dropdown components.*

- **Custom Select Component (`frontend/src/components/ui/Select.tsx`):**
  - Replaced native `<select>` and OS popup options with a custom accessible combobox/listbox dropdown.
  - Styled with NutriMind theme tokens:
    - Trigger button: rounded `rounded-xl`, subtle border (`border-brand-border/80 dark:border-white/10`), background (`bg-brand-bgAlt/60 dark:bg-white/5`), focus ring (`ring-brand-green/20 dark:ring-brand-accent/20`), and animated rotating chevron (`ChevronDown`).
    - Menu panel: popover anchored beneath trigger with `bg-brand-surface dark:bg-[#121e18]`, rounded `rounded-xl`, border `dark:border-white/10`, and deep shadow (`dark:shadow-[0_12px_32px_rgba(0,0,0,0.75)]`).
    - Option rows: rounded `rounded-lg`, distinct hover state, emerald/electric lime selection highlight (`bg-brand-green/15 text-brand-green dark:bg-brand-accent/20 dark:text-brand-accent`), and checkmark indicator (`Check` icon).
    - Supports option icons for quick visual scanning.
  - Fully accessible:
    - Click-outside handling.
    - Escape key closes menu.
    - Keyboard navigation with `ArrowUp`, `ArrowDown`, `Enter`, and `Space`.
    - WAI-ARIA combobox/listbox attributes (`role="combobox"`, `aria-expanded`, `aria-haspopup="listbox"`, `role="listbox"`, `role="option"`, `aria-selected`).
- **Meal History Tab Integration (`frontend/src/app/(user)/meals/page.tsx`):**
  - Upgraded both `historySource` (`All Sources`, `NutriMind`, `Outside Meal`, `Swapped`) and `historyStatus` (`All Statuses`, `Done`, `Skipped`) filter dropdowns to use `<Select>`.
  - Decorated options with context-specific Lucide icons (`Sparkles`, `ShieldCheck`, `FileText`, `Repeat2`, `ListChecks`, `CheckCircle2`, `Clock3`).
- **Test Suite & Verification:**
  - Added unit test suite `frontend/src/components/ui/Select.test.tsx` (5/5 tests passing).
  - Vitest suite (15 tests across 3 suites) passing.
  - ESLint check: passed with 0 errors and 0 warnings.

---

## 📅 ADDENDUM 13: SLEEK ULTRA-THIN SCROLLBARS & SIDEBAR HORIZONTAL OVERFLOW FIX (September 2026)
*Eliminated horizontal scrollbar in collapsed desktop sidebar and implemented ultra-thin, theme-native scrollbars across the application.*

- **Sidebar Horizontal Scrollbar Removal (`frontend/src/components/ui/Sidebar.tsx`):**
  - Added `overflow-x-hidden` to the sidebar `<nav id="nutrimind-sidebar-navigation">` container to prevent subpixel layout calculations in collapsed mode (84px width) from triggering an unwanted horizontal scrollbar track/thumb.
  - Configured custom ultra-thin scrollbar styling for the sidebar (`[&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 hover:[&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-track]:bg-transparent`).
- **Global Sleek Scrollbar Styling (`frontend/src/app/globals.css`):**
  - Implemented cross-browser thin scrollbar rules (`scrollbar-width: thin` and `::-webkit-scrollbar` with width/height: 6px).
  - Configured rounded pill thumbs with translucent brand emerald tint in light mode and subtle white translucent tint in dark mode (`rgba(255, 255, 255, 0.15)`).
  - Added utility classes `.scrollbar-thin` (5px) and `.scrollbar-none` for tight UI components (such as dropdowns and heatmaps).
- **Test Suite & Verification:**
  - ESLint check: passed with 0 errors and 0 warnings.
  - Vitest tests: all suites passing (12 tests).
  - Route check: `http://localhost:3000/meals` responds with HTTP 200 OK.

---

## 📅 ADDENDUM 14: TRANSIENT 503 RECOVERY, SIDEBAR HOVER TOOLTIPS, & PRODUCT DOCS REMOVAL (September 2026)
*Automatic retry resilience for serverless database cold-starts, floating tooltips enabled across all sidebar tabs, and removal of Product docs link.*

- **Automatic 503 Recovery & Resilient Polling (`frontend/src/lib/axios.ts`, `useNotifications.ts`, `ProgressWorkspace.tsx`):**
  - Configured Axios interceptor to automatically retry idempotent `GET` and `HEAD` requests once after a 400ms delay upon encountering HTTP 503 Service Unavailable (e.g., Neon serverless PostgreSQL compute cold-start wake-up).
  - Updated background notification polling (`useNotifications.ts`) to use `console.warn` instead of `console.error` on failed polling attempts, preventing Next.js development overlay redbox popups.
  - Added user-facing inline error banner with a manual "Retry" action in `ProgressWorkspace.tsx`.
- **Sidebar Floating Hover Tooltips (`frontend/src/components/ui/Sidebar.tsx`):**
  - Updated collapsed sidebar navigation container `<nav>` to use `overflow-visible` in collapsed mode, preventing the floating tooltip pill (`left-[calc(100%+12px)]`) from being clipped by container overflow.
  - Enabled hover tooltips for all navigation items (Dashboard, Meals, Grocery, Progress, Profile) across both active and inactive states.
- **Product Docs Link Removal (`frontend/src/components/ui/Sidebar.tsx`):**
  - Removed the `/docs` "Product docs" navigation link and Sparkles icon from the sidebar bottom panel.
- **Sidebar Bottom-Pinned Profile & Stronger Red Logout (`frontend/src/components/ui/Sidebar.tsx`):**
  - Added `flex-1` to the collapsed `<nav>` and set `mt-auto` on the footer container, ensuring Profile and Logout are consistently pinned to the bottom of the sidebar across both expanded and collapsed modes.
  - Upgraded the Logout button to a vibrant, saturated red (`text-red-500`, hover `text-red-400` and `bg-red-500/15`, stroke `2.25`) with hover suppression handling on click/blur/mouseleave for crisp visibility.
- **Verification:**
  - ESLint check: passed with 0 errors and 0 warnings.
  - Vitest test suite: 15 passed across 3 test files.
  - Live routes: `http://localhost:3000/meals` and `http://localhost:3000/progress` responding with HTTP 200 OK.

---

## 📅 ADDENDUM 15: FRAMELESS CENTERED MEAL GENERATION PROGRESS (September 2026)
*Freed the meal generation loading bar and status from enclosing box/div containers, providing a seamless, centered experience.*

- **Frameless Centered Meal Generation (`frontend/src/components/user/MealPlanGenerationProgress.tsx`):**
  - Removed enclosing card container styling (`rounded-[28px]`, `border border-brand-border`, `bg-brand-surface`, `shadow-card-lg`, and the top gradient bar).
  - Removed inner card container around the stage message (`border border-brand-border bg-brand-bgAlt p-4`), allowing stage status and shimmering text to sit seamlessly directly on the workspace background.
  - Balanced the layout into a clean, centered stack (`flex min-h-[65vh] flex-col items-center justify-center text-center`) with glowing icon, title, subtitle, centered progress bar (`max-w-md`), and status updates.
- **Automated Verification:**
  - Added unit test suite `MealPlanGenerationProgress.test.tsx` asserting frameless layout and completed states.
  - Vitest suite: 19 passed across 5 test files.
  - ESLint check: passed with 0 errors and 0 warnings.
  - Live dev servers: backend (port 5000) and frontend (port 3000) running and healthy.

---

## 📅 ADDENDUM 16: AUTHENTIC CULINARY PHOTO PLACEHOLDERS FOR MEALS (September 2026)
*Replaced abstract SVG icon symbols with appetizing, authentic Philippine food photography placeholders for Breakfast, Lunch, Dinner, and Snack.*

- **Authentic Culinary Photo Placeholders (`frontend/public/meals/`, `frontend/src/components/user/MealImage.tsx`):**
  - Added high-resolution, culturally authentic food photography assets to `frontend/public/meals/`:
    - `placeholder-breakfast.jpg`: Garlic fried rice (*sinangag*), golden sunny-side egg, sliced tomatoes, calamansi, and spiced vinegar.
    - `placeholder-lunch.jpg`: Savory chicken adobo with rich sauce over steamed white rice, bay leaves, peppercorns, and sautéed greens (*kangkong*).
    - `placeholder-dinner.jpg`: Nourishing pork *sinigang* tamarind soup with water spinach, radish, eggplant, and steamed jasmine rice.
    - `placeholder-snack.jpg`: Fresh ripe mango slices, sliced banana, and light merienda snack plate.
  - Updated `MealImage.tsx`:
    - Integrated `resolveMealTypePlaceholder(mealType, mealName)` to automatically map missing or unreviewed meal images to the matching authentic culinary photo.
    - Preserved a 3-tier fallback hierarchy: (1) Verified exact dish photo -> (2) Meal-type culinary placeholder photo (`BREAKFAST`, `LUNCH`, `DINNER`, `SNACK`) -> (3) SVG category illustration fallback.
    - Displayed clear, unobtrusive "Representative image" badge on placeholder photos with smooth image fade-in.
- **Automated Verification:**
  - Expanded `MealImage.test.tsx` to assert placeholder photo resolution across Breakfast, Lunch, Dinner, and Snack, as well as graceful fallback recovery.
  - Vitest suite: 34 passed across 6 test files.
  - ESLint check: passed with 0 errors and 0 warnings.

---

## 📅 ADDENDUM 17: DASHBOARD DAILY INTAKE CARD FULL-HEIGHT SYNCHRONIZATION (September 2026)
*Eliminated the empty vertical gap below the Daily Intake card so both primary dashboard panels match bottom edges flush.*

- **Full-Height Alignment (`frontend/src/features/dashboard/CockpitDashboard.tsx`):**
  - Removed `items-start` from the outer dashboard grid container, allowing grid cells to stretch naturally to equal heights.
---

## 📅 ADDENDUM 18: BORDERLESS MODERN AESTHETICS & PAST DAY RETENTION IN DASHBOARD (September 2026)
*Eliminated harsh white borders on inner status callouts/pills and restored historical days to the day selector with muted grayish past-day styling.*

- **Elimination of Harsh/White Borders (`CockpitDashboard.tsx`, `meals/page.tsx`, `globals.css`):**
  - Removed `border border-brand-border/60` from the "Remaining budget" pill in `.daily-intake-card`, converting it into a sleek, borderless inner container with subtle translucent tint (`bg-black/25 dark:bg-black/35`).
  - Removed `border border-status-pending-text/20` from the "Awaiting review" callout in `CockpitDashboard.tsx` and weekly meal plan preview cards (`meals/page.tsx`), opting for clean, modern borderless banners with gentle background tints (`bg-status-pending-bg/50` and `bg-status-pending-bg/30`).
  - Added global CSS border-color fallbacks in `globals.css` for `:root .border-brand-border`, `:root [class*='border-brand-border/']`, and status opacity variants (`border-status-pending-text/`, `border-status-error-text/`, `border-status-verified-text/`) to prevent Tailwind color tokens from falling back to `currentColor` (white).
- **Past Day Visibility & Management in Dashboard (`dashboard/page.tsx`):**
  - Removed the `dateKey >= todayKey` filter in `uniqueDates`, allowing previous days of the scheduled cycle (e.g., Sun 13) to remain visible and interactive in the day selector.
  - Automatically defaults selection to the current day (`isToday`), while keeping past days accessible.
  - Styled past day buttons with a theme-consistent muted grayish aesthetic (`bg-black/[0.04] text-slate-400 dark:bg-white/[0.03] dark:text-zinc-500`) without borders, distinguishing past dates from current/future dates.
  - Added a subtle green indicator dot on the current day (`isToday`) when browsing other dates.
- **Backend Current Weekly Cycle Retention (`meals.controller.ts`):**
  - Updated `MealsController.getCurrentPlan` to anchor its schedule window on `getCurrentWeeklyCycleWindow(profile, now).startDate` rather than `getStartOfManilaBusinessDay(now)`. Previously, midnight date rollovers caused the backend database query to drop all previous days of the active weekly cycle (e.g. Sunday 13) from both approved and pending review plan responses.
  - Ensured all 7 days of the active weekly cycle are retained and returned to the client in full.
- **Automated Verification:**
  - Vitest suite: 102 passed across 27 test files.
  - ESLint check: passed with 0 errors and 0 warnings.
  - Backend test suite: 521 passed with 0 failures.
  - Live API validation: verified `/api/user/meals/current` returns all 21 meals and all 7 scheduled dates (Sep 12T16:00Z through Sep 18T16:00Z) for active user.

---

## 📅 ADDENDUM 19: FIXED SALAKOT PROFILE PICTURE ADORNMENT & FILIPINO AVATAR PRESETS (September 2026)
*Added a fixed traditional Filipino salakot hat tilted onto the user's profile avatar, integrated Google account photo fallback for the 'Default' avatar option, and localized pixel-art preset seeds to authentic Filipino names.*

- **Salakot Hat Overlay (`Avatar.tsx`, `salakot.svg`):**
  - Updated `public/icons/salakot.svg` viewBox to `360 60 865 790` to tightly frame the conical hat and eliminate unnecessary empty canvas padding.
  - Updated `<Avatar />` to feature a fixed salakot hat overlay positioned tilted on the top-right corner (`-top-[14%] -right-[8%] w-[64%] select-none pointer-events-none z-10 drop-shadow-sm`).
  - Allowed `AvatarPrimitive.Root` to overflow visibly while wrapping the inner avatar image and fallback in an `overflow-hidden rounded-[inherit]` container, ensuring the avatar image is neatly clipped to its border radius while the salakot sits atop the container naturally.
  - Added optional `showSalakot` prop (defaults to `true`) across all avatar variants (`sm`, `md`, `lg`).
- **Default Profile Picture Support (Google OAuth & Initials Fallback):**
  - Updated `AuthService.googleAuth` (`backend/src/services/auth.service.ts`) to persist the user's Google profile picture (`picture`) into the `Account` table upon OAuth login, and ensure default avatars adopt the Google photo.
  - Updated `UserService.getUserProfileDetails` (`backend/src/services/user-profile.service.ts`) to query the linked Google account and expose `googleImage` in profile responses.
  - Updated `UserController.updateAvatar` (`backend/src/controllers/user.controller.ts`) to resolve `'default'` or empty avatar seeds to the user's linked Google photo (or `null`), restoring the authentic Google profile photo upon selection.
  - Updated `AuthContext.tsx` (`frontend/src/lib/context/AuthContext.tsx`) to track `googleImage` in `UserSession`.
- **Filipino Avatar Presets (`AccountSettings.tsx`):**
  - Replaced English pet/person names with authentic Filipino presets: `Default`, `Juan`, `Maria`, `Bayani`, `Tala`, `Luningning`, `Datu`, `Mayari`, `Malakas`, and `Maganda`.
  - Configured `'Default'` to dynamically preview the user's Google profile picture (or clean fallback initials if registered via email), while presets call the DiceBear Pixel-Art API using the Filipino name seed.
- **Automated Verification:**
  - Added `Avatar.test.tsx` testing the salakot overlay, `showSalakot={false}` opt-out, fallback initials on `'default'`, DiceBear pixel-art rendering on Filipino name seeds, and external Google photo URL rendering.
  - Vitest frontend suite: 107 passed across 28 test files.
  - ESLint check: passed with 0 errors and 0 warnings.
  - Backend test suite: 521 passed with 0 failures.

---

## 📅 ADDENDUM 20: ONBOARDING PLAN GENERATION DECOUPLING & DIRECT DASHBOARD REDIRECT (September 2026)
*Decoupled mandatory onboarding completion from automatic meal plan generation, directing new users straight to their dashboard so they can inspect their clinical report and choose when to generate plans.*

- **Dashboard Redirect on Onboarding Completion (`tos/page.tsx`):**
  - Removed automatic background meal-generation trigger upon Terms of Service agreement.
  - Users are now routed directly to `/dashboard` upon finishing onboarding, preserving their autonomy to review their clinical nutrition report first before generating a 7-day or starter meal plan.

---

## 📅 ADDENDUM 21: FOOD & PLANNING PROFILE OVERHAUL & THREE-STOP LOCALITY CONTROLS (September 2026)
*Overhauled the food and planning profile view, integrated the clinical nutrition report directly into profile tabs, and added a 3-stop geographical locality slider.*

- **Three-Stop Locality Preferences (`MealLocalityPreferenceControl.tsx`):**
  - Added interactive 3-stop locality control (`National`, `Regional`, `Provincial/Local`) reflecting Philippine sourcing and food availability.
  - Linked locality controls with region and province selection models, ensuring valid geographic boundaries are enforced before unlocking localized meal suggestions.
- **Nutrition Report Integration in Profile (`features/reports/NutritionReportWorkspace.tsx`):**
  - Consolidated `/profile/nutrition-report` and `/nutrition-report` into a single reusable `NutritionReportWorkspace`.
  - Added report history versioning tabs, PDF export preview, and clinical disclaimer acknowledgment gating.

---

## 📅 ADDENDUM 22: UNIVERSAL TERRACOTTA ACTION BANNER (`AnnouncementBanner`) (September 2026)
*Standardized system-wide urgent action announcements by reusing the high-visibility terracotta/coral banner design originally crafted for unverified meals.*

- **Reusable Component (`AnnouncementBanner.tsx`):**
  - Created a modular `AnnouncementBanner` featuring high-contrast terracotta borders (`border-[#c85a32]/40`), warm translucent background (`bg-[#c85a32]/10`), coral alert icons, and primary action call-to-actions.
  - Replaced ad-hoc yellow/amber alert boxes across the user portal with the unified terracotta banner.
- **Fixed Top Placement in User Shell (`UserLayout.tsx`):**
  - Pinned the `AnnouncementBanner` directly beneath the top `Navbar` and outside the scrollable `<main>` container, ensuring critical notices (such as required nutrition report acknowledgment) remain permanently visible during scrolling.
  - Cleaned up page headers across `/dashboard`, `/meals`, `/grocery`, and `/progress` by stripping redundant green icons and eyebrow tags ("Daily overview", "Personal meal intelligence", etc.).

---

## 📅 ADDENDUM 23: REUSABLE FLOATING UNAUTHORIZED STATE COMPONENT (September 2026)
*Created a reusable, floating graphic state using `unauthorized.svg` for clinical report gating and platform-wide RBAC access restriction.*

- **Floating Component Architecture (`UnauthorizedState.tsx`):**
  - Built a borderless, card-free floating container pairing the enlarged vector illustration (`/logo/unauthorized.svg`, 380px–400px responsive) with right-aligned titles, explanatory descriptions, and actionable button groups.
  - Supports both clinical gate variants (report acknowledgment required) and RBAC unauthorized variants (access denied for nutritionist/admin portals) with custom action callbacks.
- **Automated Verification:**
  - Added comprehensive unit tests (`UnauthorizedState.test.tsx`) testing default report-pending state, custom props, and RBAC action callbacks.

---

## 📅 ADDENDUM 24: REPORT PREREQUISITE REVISION SYNC, FLICKER ELIMINATION & DARK MODE FLOATING SHADOWS (September 2026)
*Synchronized profile revision tracking between backend prerequisites and client auth context, eliminated split-second empty plan flashes on tab switch, and created 3D floating shadows with luminous ambient elevation in dark mode.*

- **Prerequisite Revision Synchronization (`user-profile.service.ts`, `AuthContext.tsx`):**
  - Added `profileRevision: true` to the Prisma query in `UserProfileService.getFullUserProfile`.
  - Updated `AuthContext.refreshSession` to check `nutritionReport.profileRevision === userProfile.revision`. When profile settings change and bump the revision, `user.reportAcknowledged` accurately flips to `false` in the frontend session, ensuring the top action banner and feature gates display immediately.
  - Updated `NutritionReportWorkspace.tsx` to automatically trigger report regeneration when the existing report's `profileRevision` is out of date with the user's active profile revision.
- **Tab-Switch Empty Plan Flicker Elimination (`dashboard/page.tsx`):**
  - Memoized `isReportPending` upfront and guarded the `fetchCurrentPlan` call to prevent wiping error states or dispatching redundant plan queries when report acknowledgment is pending.
  - Gated dashboard rendering so `isReportPending` evaluates before `currentMeals.length === 0`, completely eliminating the ~100ms flash of "No Active Meal Plan" when switching tabs away and returning to Kainara.
- **Floating Depth & Dark-Mode Luminous Elevation (`globals.css`, `Sidebar.tsx`, `UnauthorizedState.tsx`):**
  - Added `.floating-glow-graphic`: Natural drop shadow in light mode (`rgba(0,0,0,0.22)`); deep elevation drop shadow paired with signature emerald/teal ambient halo glow (`rgba(84,199,190,0.32)`) in dark mode on the SVG graphic.
  - Added `.floating-glow-text`: Soft lifted depth in light mode; dark drop-shadow with subtle ethereal backglow in dark mode on titles, descriptions, and buttons in `UnauthorizedState`.
  - Added `.floating-sidebar-shadow`: Smooth elevation shadow in light mode; deep black drop-shadow + ambient cyan/teal halo (`rgba(84,199,190,0.15)`) in dark mode on the desktop `Sidebar`.
- **Automated Verification:**
  - Backend TypeScript build (`npm run build`): passed with 0 errors.
  - Frontend Vitest suite: 169 passed across 43 test suites.
  - Frontend ESLint: passed with 0 errors and 0 warnings.

---

## 📅 ADDENDUM 25: PROVINCE/HUC ZERO-LAG INSTANT RENDER, LOCATION CACHING & INTERACTIVE GOOGLE MAP EMBED (September 2026)
*Eliminated combobox start-up delays and slider layout jumping in Food & Planning preferences, and replaced the stylized vector map with an interactive, dark-mode-adapted Google Map embed.*

- **Province/HUC Field Enablement (`PlanningLocationFields.tsx`):**
  - Resolved an issue where the "Province / highly urbanized city" combobox started disabled on page mount with the placeholder "Choose a region first" while the `/user/onboarding/planning-locations` endpoint was in flight.
  - Introduced `isRegionEffective`: if the user's profile already has a saved region name, the province/HUC field is immediately enabled and interactive on first paint without waiting for asynchronous network resolution.
- **Locality Slider Jump Elimination (`MealLocalityPreferenceControl.tsx`):**
  - Clamping logic previously defaulted `maxStop = 1` while location options were empty, forcing saved `LOCAL` (Stop 3) preferences to render at Stop 1 and abruptly animate to Stop 3 after 200–400ms.
  - Added `effectiveRegionValid` and `effectiveProvinceValid` fallbacks against the user's present location names, allowing the slider to mount directly at Stop 3 (Local) with zero visual jump.
- **Client-Side Location Cache & Request Deduplication (`usePlanningLocations.ts`):**
  - Added module-level caching (`cachedPlanningLocations`) and in-flight promise deduplication (`planningLocationsPromise`).
  - Subsequent mounts, tab switches, and dialog openings resolve official Philippine PSA geographic options in 0ms synchronously from memory.
- **Interactive Google Maps Embed (`PhilippineDynamicMap.tsx`, `next.config.mjs`):**
  - Replaced the abstract SVG polygon canvas with an interactive, pan-and-zoomable Google Maps embed:
    `https://maps.google.com/maps?q=${locationQuery}&t=m&z=${zoomLevel}&output=embed`
  - Dynamic focal zoom and queries:
    - Level 1 (National): `Philippines` at zoom 5.
    - Level 2 (Regional): `[Region Name], Philippines` at zoom 8.
    - Level 3 (Local): `[Province/City Name], Philippines` at zoom 10.
  - Configured CSP in `next.config.mjs` to authorize `frame-src https://accounts.google.com https://www.google.com https://maps.google.com`.
  - Added tailored dark-mode styling (`dark:invert-[0.9] dark:hue-rotate-[170deg] dark:contrast-[1.1] dark:brightness-[0.88]`) to harmonize Google Maps with Kainara's dark palette without harsh white glare.
  - Preserved HUD status indicators (Level badge, animated radar pulse, real-world coordinates, and external Google Maps anchor link).
- **Automated Verification:**
  - Frontend Vitest suite: 169 passed across 43 test suites (100% pass rate).
  - Frontend ESLint: passed with 0 errors and 0 warnings.
  - Backend test suite: 526 tests passed with 0 failures.

---

## 📅 ADDENDUM 26: INSTANT ROUTE TRANSITIONS, SKELETON BOUNDARIES, HOVER PREFETCHING & TOP PROGRESS BAR (September 2026)
*Eliminated navigation latency and "frozen on dashboard" perception when switching between user portal pages by wiring up Next.js App Router loading skeletons, hover prefetching, and a luminous top progress bar.*

- **Next.js App Router Suspense Boundaries (`loading.tsx`):**
  - Connected existing feature skeleton primitives into dedicated route loading boundaries:
    - `src/app/(user)/meals/loading.tsx` rendering `MealPlanSkeleton`
    - `src/app/(user)/dashboard/loading.tsx` rendering `DashboardSkeleton`
    - `src/app/(user)/grocery/loading.tsx` rendering `GrocerySkeleton`
    - `src/app/(user)/progress/loading.tsx` rendering `ProgressSkeleton`
    - `src/app/(user)/loading.tsx` as a fallback layout skeleton for profile and settings
  - Clicking any navigation item now unmounts the previous page immediately and displays the matching skeleton layout instead of stalling on the prior screen.
- **Route Prefetching on Hover & Touch (`Sidebar.tsx`, `BottomNav.tsx`):**
  - Enabled `prefetch={true}` on all primary workspace navigation `<Link>` elements.
  - Attached `onMouseEnter` and `onTouchStart` prefetch triggers (`router.prefetch(item.href)`). During the 150–300ms window between hovering and clicking, Next.js warms up and loads the target page's code bundles.
- **Luminous Top Navigation Progress Bar (`TopNavigationProgress.tsx`, `layout.tsx`):**
  - Added a global, zero-dependency 2.5px progress bar at the very top edge of the browser viewport with an emerald/teal luminous gradient and neon cyan glow.
  - Automatically intercepts internal link clicks to trigger immediate (0ms) visual confirmation that navigation has begun, completing and fading smoothly upon URL/search parameter changes.
- **Automated Verification:**
  - Frontend Vitest suite: 172 passed across 44 test suites (100% pass rate).
  - Frontend ESLint: passed with 0 errors and 0 warnings.

---

## 📬 PHASE 15: EMAIL MODERNIZATION, 1-ON-1 CALL NOTIFICATIONS & AUTH UX POLISH (September 17, 2026 — 3:08 PM PHT)
*Timestamp: 2026-09-17T15:08:00+08:00 (Philippine Standard Time, UTC+8) | Commits: 0feab36, e34395a, ddac37a, 9f63850*

- **KAINARA Theme SMTP Email Engine:** Complete modernization of all outgoing emails to KAINARA's obsidian/emerald/lime responsive HTML layout (`#050a08` backdrop, `#0d1712` card, `#b8f45f` lime buttons, `#f1f7f4` text, `noreply@kainara.ph` fallback). Upgraded OTP, password reset, and nutritionist approval invitation emails.
- **Nutritionist 1-on-1 Verification Call Notifications:** Automated email dispatch when an administrator confirms a call schedule with date/time in PHT, Google Meet/Zoom room link, reference code, and physical PRC ID preparation instructions.
- **Application Receipt & Rejection Emails:** Instant confirmation email delivering tracking reference code (`NM-XXXXXX`) upon submission; constructive feedback email upon administrative rejection.
- **Mobile Auth & Landing UI Polish:** Scaled mobile hero typography (`text-[2.35rem] sm:text-5xl font-black`), tightened spacing, disabled cramped grid on mobile viewports (`hidden md:block`), and added smooth 1200ms auto-scroll to form.
- **Login Redirect Loading State:** Eliminated blank screen on `/login` for authenticated users by replacing `return null;` with `<PortalLoadingState fullScreen message="Redirecting to your workspace..." />`.
- **Automated Verification:**
  - Backend test suite: 527 passed (100% pass rate), including `[TEST-146-EXT]`.
  - Frontend Vitest suite: 187 passed across 47 test suites (100% pass rate).
  - TypeScript & ESLint: 0 errors and 0 warnings across both frontend and backend.














