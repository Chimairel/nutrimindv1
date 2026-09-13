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





