# 📜 NutriMind — Project Update Log & Changelog
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




