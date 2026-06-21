# NutriMind — Feature Addendum
# Weekly Regeneration Fix + Unified /meals Page + Swap Calorie Accountability

## REVISION NOTE
This is the FINAL consolidated version of this addendum.
It merges the /meals tab restructure with the swap
calorie warning system. Previous drafts are superseded.

## CONTEXT
Two issues observed during manual testing:

1. Dashboard shows "No meals scheduled for this day
   offset" because the current week was never generated
   — the previous week's plan expired with nothing
   replacing it. The weekly cron job from the
   shopping-day-anchored addendum is not regenerating
   plans for all users.

2. The current navigation has a separate "Meal History"
   sidebar tab, plus a "Dashboard" button and a "Browse
   Library" button (modal) on the Meal Plan page. This
   is being consolidated into ONE page (/meals) with
   three internal tabs: Plan, History, Library.

Additionally, a calorie accountability gap was identified
in the swap feature: swapping a 500 kcal meal for an
800 kcal meal silently breaks the day's calorie math
without informing the user.

This addendum does not change the database schema beyond
what is explicitly listed in Part 4.

---

## PART 1 — FIX: WEEKLY REGENERATION MUST ACTUALLY FIRE

### Root Cause
The `runWeeklyCheckin(group)` function currently only
sends notifications and auto-regenerates ONLY for users
with 3+ missed check-ins. It does NOT regenerate plans
for normal users each week. After the first week, users
see "No meals scheduled."

### Required Fix
`runWeeklyCheckin(group)` must ALWAYS call
`MealGenerationService.generatePlanForUser(userId)` for
ALL users in the shopping day group when their cycle
resets — not just users with 3+ missed check-ins.

The existing `generatePlanForUser()` already handles:
- Cancelling the previous plan's rows
- Creating a new planGroupId
- Creating a new PlanSwapTracker with swapsUsed: 0
- Determining STARTER vs WEEKLY plan type

The fix is: move the plan generation call OUTSIDE the
"missedCheckins >= 3" conditional block. Generate for
everyone, unconditionally.

### For LOCAL DEVELOPMENT
The cron endpoints are already manually invokable:
```
POST /api/cron/weekly-checkin-weekend
POST /api/cron/weekly-checkin-weekday
Authorization: Bearer <CRON_SECRET>
```
No separate test endpoint needed.

### Verification Steps (must pass)
1. Manually invoke the WEEKEND cron endpoint for a test
   user whose shoppingDayGroup is WEEKEND
2. Confirm a new MealPlan set is created with a new
   planGroupId, planType: WEEKLY, correct 7-day range
3. Confirm PREVIOUS week's MealPlan rows are updated to
   status: CANCELLED (not deleted, not left dangling)
4. Confirm the Plan tab on /meals displays the NEW
   week's meals immediately after
5. Confirm a new PlanSwapTracker row is created for the
   new planGroupId with swapsUsed: 0

---

## PART 2 — UNIFIED /meals PAGE STRUCTURE

### Navigation Changes
- REMOVE the "Meal History" sidebar item entirely
  (the one with href: '/history', icon: '📜')
- REMOVE the "Dashboard" and "Browse Library" buttons
  from the current /meals page header
- REPLACE with three tab controls at the top of /meals:
  **[ Plan ] [ History ] [ Library ]**
- Clicking a tab does NOT change the URL and does NOT
  open a modal — it swaps the rendered content below
  the tab bar in place, on the same page
- "Plan" is the default active tab when /meals loads

### Tab: Plan (default)
Shows the EXACT existing Weekly Meal Plan behavior,
unchanged:
- Current week's live MealPlan data
- Swappable per meal (existing Swap modal, unchanged)
- Checkable meal completion
- Swap counter ("X of 3 swaps used this week")
- AI Estimation Warning on PENDING_REVIEW meals
- Macro/calorie targets per day
- "Regenerate Plan" button (visible only on this tab)

### Tab: History
Shows MealLog data — what actually happened across past
weeks, including outside meals and swapped meals.

Required elements:
- Search bar (search by meal name)
- Filters: by date range, by source
  (System-Generated / Outside Meal / Swapped / All),
  by status (Done / Skipped)
- Chronological list grouped by date, most recent first
- Each entry shows: meal name, source badge, status,
  calories + macros
- Source badges (three distinct visual labels):
  - SYSTEM_GENERATED → [NutriMind] green badge
  - USER_LOGGED → [Outside Meal · AI Estimated] amber badge
  - USER_SWAPPED → [Swapped] blue badge (NEW)
- For USER_SWAPPED entries, also show the calorie delta:
  e.g. "+120 kcal from original" as a subtle indicator
- Entries are READ-ONLY — no swap button, no checkbox,
  since these represent things that already happened
- Must preserve SYSTEM_GENERATED vs USER_LOGGED source
  labeling — this is one of the five legal protection
  layers and must remain visible

### Tab: Library
Shows the user's profile-matched verified meals for
general browsing/awareness.

Required elements:
- Search bar (search by meal name)
- Filters: by meal type (Breakfast/Lunch/Dinner/Snack)
- Grid of matching MealLibrary entries, filtered
  server-side to ONLY meals matching the user's own
  profile (condition + allergens + dietaryPreference)
  — reuses the eligibility query from
  MealSwapService.getCompatibleLibraryMeals()
- Each entry shows: meal name, calories + macros,
  verified-by nutritionist name + PRC license badge
- BROWSE-ONLY — tapping a meal shows its details but
  does NOT trigger a swap action

### How Swapping Still Works (unchanged, reaffirmed)
Swapping remains exclusively initiated from the PLAN
tab, via the per-meal "Swap This Meal" button → opens
existing focused Swap modal. The Library tab is for
browsing/awareness only; it is intentionally NOT a
second entry point for swapping.

---

## PART 3 — SWAP CALORIE WARNING (OPTION B)

### The Problem
Each day's meals are calculated to match the user's
daily calorie target. Swapping silently breaks the day's
calorie math even though every individual meal is
"verified" and "safe."

### The Solution — Inform, Don't Restrict
When the user selects a replacement meal in the Swap
modal, BEFORE confirming:

1. Call the swap preview endpoint to calculate:
   - calorieDelta = newCalories - originalCalories
   - projectedDayTotal = sum of all meals that day
     with the swap applied
2. If projectedDayTotal is OUTSIDE ±15% of the daily
   calorie target, show a warning modal:

   ```
   "This swap puts you at [X] kcal for [Day]
   ([+/-Y] from your [Target] kcal target)"

   [ Cancel ] [ Swap Anyway ]
   ```

3. If WITHIN ±15% range, swap proceeds immediately
   (no warning shown)

### Philosophy
The user is self-aware — they chose to use this app to
change themselves. The system is a GUIDE, not a
gatekeeper. Users are responsible for their own choices.
But every choice leaves a visible trace so they can
understand their patterns later.

This mirrors the outside meal logging pattern exactly:
- Outside meal: conflict detected → warn → user decides
- Meal swap: calorie imbalance → warn → user decides

Same philosophy, same UX pattern, same legal logic.

---

## PART 4 — SCHEMA CHANGES

### Extend MealLogSource Enum
```prisma
enum MealLogSource {
  SYSTEM_GENERATED
  USER_LOGGED
  USER_SWAPPED      // Verified library meal chosen by
                    // user as replacement, not system
}
```

A swapped meal is still system-generated in nature (it
came from the verified library), but it was NOT part of
the ORIGINAL plan — the USER chose it. This third value
prevents the false binary of "system picked it" vs
"user typed it in freestyle."

### New Table: SwapLog
```prisma
model SwapLog {
  id                  String           @id @default(cuid())
  planSwapTrackerId   String
  planSwapTracker     PlanSwapTracker  @relation(fields: [planSwapTrackerId], references: [id], onDelete: Cascade)
  mealPlanId          String
  mealPlan            MealPlan         @relation(fields: [mealPlanId], references: [id], onDelete: Cascade)
  originalMealName    String
  originalCalories    Float
  newMealName         String
  newCalories         Float
  calorieDelta        Float            // newCalories - originalCalories
  warningShown        Boolean          @default(false)
  warningAcknowledged Boolean          @default(false)
  swappedAt           DateTime         @default(now())
}
```

This enables pattern detection queries like:
"Show all swaps where calorieDelta > 0 for users with
a LOSE_WEIGHT goal" — evidence trail for why goals
were or weren't met.

### Update PlanSwapTracker (add relation)
```prisma
model PlanSwapTracker {
  ...existing fields...
  swapLogs    SwapLog[]   // NEW relation
}
```

### Update MealPlan (add relation)
```prisma
model MealPlan {
  ...existing fields...
  swapLogs    SwapLog[]   // NEW relation
}
```

---

## PART 5 — API ROUTES

```
GET  /api/user/meals/current
  EXISTING — returns active planGroupId's MealPlan data
  for the Plan tab (unchanged)

GET  /api/user/meals/history
  NEW — returns MealLog entries across past weeks for
  the History tab. Supports query params:
  - search (meal name)
  - source (SYSTEM_GENERATED / USER_LOGGED / USER_SWAPPED / all)
  - status (DONE / SKIPPED / all)
  - startDate, endDate (date range)
  Returns entries with source label intact.
  For USER_SWAPPED entries, include calorie delta
  from the related SwapLog.

GET  /api/user/library
  NEW — returns MealLibrary entries filtered to the
  requesting user's profile. Reuses eligibility query
  from MealSwapService.getCompatibleLibraryMeals().
  Supports query params: search, mealType
  READ-ONLY browse endpoint — distinct from the
  slot-specific swap-options endpoint.

GET  /api/user/meals/:mealPlanId/swap-preview
  NEW — called when user selects a replacement in the
  Swap modal BEFORE confirming. Returns:
  {
    originalMealName,
    originalCalories,
    newMealName,
    newCalories,
    calorieDelta,
    projectedDayTotal,
    dailyTarget,
    warningRequired  (boolean: projected total outside
                     ±15% of dailyTarget)
  }

POST /api/user/meals/:mealPlanId/swap
  EXISTING (modified) — now additionally:
  - Creates a SwapLog row with original/new calories,
    delta, and warning acknowledgment status
  - Creates a MealLog with source: USER_SWAPPED
  - Accepts additional body param:
    { libraryMealId, warningAcknowledged }

POST /api/cron/weekly-checkin-weekend
POST /api/cron/weekly-checkin-weekday
  EXISTING (fixed per Part 1) — now unconditionally
  regenerates plans for ALL users in the group
```

---

## PART 6 — FLEXIBILITY NOTE
If wiring real cron scheduling proves time-consuming
before deadline, an acceptable temporary fallback for
DEMO purposes only is a manually-triggered "Generate
This Week" button visible in a dev/admin context,
calling the exact same generatePlanForUser() logic.
Note explicitly if this fallback is used.

---

## SUMMARY OF WHAT THIS LOCKS IN
1. Weekly plan regeneration fires for ALL users in the
   shopping day group unconditionally — blocking bug fix
2. /meals becomes ONE page with three in-page tabs:
   Plan, History, Library — no separate routes, no
   modal for browsing
3. Plan tab = existing live MealPlan behavior, unchanged
4. History tab = MealLog data with three source badges
   (NutriMind / Outside Meal / Swapped), search/filters,
   read-only, source labeling preserved
5. Library tab = profile-matched MealLibrary browsing,
   search/filters, browse-only, NOT a swap entry point
6. Swapping remains via per-meal Swap button on Plan tab
   → existing Swap modal (unchanged entry point)
7. Swap calorie warning (Option B) — inform user if day
   total goes outside ±15% of target, let them decide
8. USER_SWAPPED enum value for transparent tracking
9. SwapLog table for calorie delta pattern detection
