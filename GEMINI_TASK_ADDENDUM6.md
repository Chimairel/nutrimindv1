# GEMINI IMPLEMENTATION TASK — Addendum 6
# Weekly Regen Fix + Unified /meals Page + Swap Calorie Warning

Read ADDENDUM_6_UNIFIED_MEALS_PAGE.md FIRST — that is your
spec. Then read AI_AGENT_PROMPT.md for behavioral rules.
This file tells you EXACTLY what to change and in what order.

IMPORTANT RULES:
- Do NOT run `npm run build` while `npm run dev` is running.
  Use `npx tsc --noEmit` for type-checking instead.
- Do NOT rewrite entire files. Only change the specific
  parts described below.
- Preserve all existing comments and docstrings.
- After ALL changes, verify with `npx tsc --noEmit` in
  both backend and frontend directories.

---

## STEP 1 — SCHEMA CHANGES (backend)

### File: `nutrimind-backend/prisma/schema.prisma`

1a. Add `USER_SWAPPED` to the `MealLogSource` enum:
```prisma
enum MealLogSource {
  SYSTEM_GENERATED
  USER_LOGGED
  USER_SWAPPED
}
```

1b. Add a new `SwapLog` model AFTER `PlanSwapTracker`:
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
  calorieDelta        Float
  warningShown        Boolean          @default(false)
  warningAcknowledged Boolean          @default(false)
  swappedAt           DateTime         @default(now())
}
```

1c. Add `swapLogs SwapLog[]` relation to `PlanSwapTracker`:
```prisma
model PlanSwapTracker {
  id          String    @id @default(cuid())
  planGroupId String    @unique
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  swapsUsed   Int       @default(0)
  updatedAt   DateTime  @updatedAt
  swapLogs    SwapLog[]
}
```

1d. Add `swapLogs SwapLog[]` relation to `MealPlan` model
    (add it after the existing `mealLogs` relation line).

1e. Run migration:
```bash
cd nutrimind-backend
npx prisma migrate dev --name add-swap-log-and-user-swapped
```

---

## STEP 2 — CRON FIX (backend)

### File: `nutrimind-backend/src/services/cron.service.ts`

The `runWeeklyCheckin(group)` method currently only calls
`MealGenerationService.generatePlanForUser(userId)` inside
the `if (missedCheckins >= 3)` block. This means normal
users never get their plans regenerated weekly.

FIX: Move the plan generation call OUTSIDE the conditional.
Every user in the group should get a new plan generated
unconditionally when the cron fires.

Change the logic inside the `for (const user of users)` loop to:

```typescript
// Generate new weekly plan for this user
console.log(`[CronService] Generating new weekly plan for ${user.email}...`);
const { MealGenerationService } = await import('@/services/meal-generation.service');
await MealGenerationService.generatePlanForUser(user.id);

// Send weekly check-in notification
await prisma.notification.create({
  data: {
    userId: user.id,
    title: '🛒 Weekly Check-In',
    message: 'Your new weekly meal plan is ready! Let us know if your health goals or dietary needs have changed.',
    type: 'WEEKLY_CHECKIN',
  },
});

// Handle missed check-in streak notification (keep existing logic)
const missedCheckins = profile.checkinStreak < 0 ? Math.abs(profile.checkinStreak) : 0;
if (missedCheckins >= 3) {
  await prisma.notification.create({
    data: {
      userId: user.id,
      title: '⚠️ Missed Check-Ins',
      message: 'You have missed several weekly check-ins. Please review your updated meal plan and confirm your health profile is still accurate.',
      type: 'WEEKLY_CHECKIN',
    },
  });

  // Reset streak
  await prisma.userProfile.update({
    where: { userId: user.id },
    data: { checkinStreak: 0 },
  });
}

results.push({ userId: user.id, email: user.email, notified: true });
```

The key change: `generatePlanForUser()` is called for ALL
users, not just those with missedCheckins >= 3.

---

## STEP 3 — SWAP PREVIEW ENDPOINT (backend)

### File: `nutrimind-backend/src/services/meal-swap.service.ts`

Add a new static method `getSwapPreview`:

```typescript
static async getSwapPreview(userId: string, mealPlanId: string, libraryMealId: string) {
  // 1. Fetch the current meal plan slot
  const mealPlan = await prisma.mealPlan.findFirst({
    where: { id: mealPlanId, userId },
  });
  if (!mealPlan) throw new Error('Meal plan slot not found.');

  // 2. Fetch the proposed replacement library meal
  const libraryMeal = await prisma.mealLibrary.findUnique({
    where: { id: libraryMealId },
  });
  if (!libraryMeal) throw new Error('Library meal not found.');

  // 3. Fetch all meals on the same day in the same planGroup
  const startOfDay = new Date(mealPlan.scheduledDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(mealPlan.scheduledDate);
  endOfDay.setHours(23, 59, 59, 999);

  const dayMeals = await prisma.mealPlan.findMany({
    where: {
      planGroupId: mealPlan.planGroupId,
      userId,
      scheduledDate: { gte: startOfDay, lte: endOfDay },
    },
  });

  // 4. Calculate projected day total (replace current meal's cals with new)
  let projectedDayTotal = 0;
  for (const meal of dayMeals) {
    if (meal.id === mealPlanId) {
      projectedDayTotal += libraryMeal.calories;
    } else {
      projectedDayTotal += meal.calories;
    }
  }

  // 5. Get daily target
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  const dailyTarget = profile?.dailyCalorieTarget || 2000;

  // 6. Determine if warning is needed (±15%)
  const lowerBound = dailyTarget * 0.85;
  const upperBound = dailyTarget * 1.15;
  const warningRequired = projectedDayTotal < lowerBound || projectedDayTotal > upperBound;

  return {
    originalMealName: mealPlan.mealName,
    originalCalories: mealPlan.calories,
    newMealName: libraryMeal.mealName,
    newCalories: libraryMeal.calories,
    calorieDelta: libraryMeal.calories - mealPlan.calories,
    projectedDayTotal: Math.round(projectedDayTotal),
    dailyTarget,
    warningRequired,
  };
}
```

### File: `nutrimind-backend/src/services/meal-swap.service.ts`

Modify the existing `swapMeal` method. After step 7
(increment swap count), add steps to:

8b. Create a SwapLog entry:
```typescript
// 8b. Create SwapLog entry for calorie tracking
await tx.swapLog.create({
  data: {
    planSwapTrackerId: swapTracker.id,
    mealPlanId,
    originalMealName: mealPlan.mealName,
    originalCalories: mealPlan.calories,
    newMealName: libraryMeal.mealName,
    newCalories: libraryMeal.calories,
    calorieDelta: libraryMeal.calories - mealPlan.calories,
    warningShown: warningShown || false,
    warningAcknowledged: warningAcknowledged || false,
  },
});
```

8c. Create a MealLog with source USER_SWAPPED:
```typescript
// 8c. Create MealLog with USER_SWAPPED source
await tx.mealLog.create({
  data: {
    userId,
    mealPlanId,
    source: 'USER_SWAPPED',
    mealName: libraryMeal.mealName,
    calories: libraryMeal.calories,
    proteinG: libraryMeal.proteinG,
    carbsG: libraryMeal.carbsG,
    fatG: libraryMeal.fatG,
    dataSource: 'FNRI',
    status: 'PENDING',
  },
});
```

The `swapMeal` method signature must also accept two new
optional parameters: `warningShown` and `warningAcknowledged`
(both booleans). Update the method signature and the
controller to pass them through from `req.body`.

### File: `nutrimind-backend/src/controllers/meals.controller.ts`

Add a new `getSwapPreview` static method:
```typescript
static async getSwapPreview(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized.' });
    }
    const mealPlanId = req.params.id;
    const libraryMealId = req.query.libraryMealId as string;
    if (!libraryMealId) {
      return res.status(400).json({ success: false, error: 'Missing libraryMealId query parameter.' });
    }
    const preview = await MealSwapService.getSwapPreview(userId, mealPlanId, libraryMealId);
    return res.status(200).json({ success: true, data: preview });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error.message });
  }
}
```

Update the existing `executeSwap` method to also extract
`warningShown` and `warningAcknowledged` from `req.body`
and pass them to `MealSwapService.swapMeal()`.

### File: `nutrimind-backend/src/routes/meals.routes.ts`

Add the new swap preview route BEFORE the `/:id/swap` route:
```typescript
router.get('/:id/swap-preview', MealsController.getSwapPreview);
```

Update the existing history endpoint to support query
params. The existing `getPlanHistory` already returns all
logs — add query param filtering for `search`, `source`,
`status`, `startDate`, `endDate`. Filter in the Prisma
query `where` clause, not in-memory.

---

## STEP 4 — FRONTEND NAVIGATION CHANGES

### File: `nutrimind-frontend/src/components/ui/Sidebar.tsx`

Remove the "Meal History" nav item from the USER array.
Change line 32 from:
```
{ label: 'Meal History', href: '/history', icon: '📜' },
```
DELETE this entire line. The final USER array should be:
```typescript
USER: [
  { label: 'Dashboard', href: '/dashboard', icon: '📊' },
  { label: 'Meal Plan', href: '/meals', icon: '🍽️' },
  { label: 'Grocery List', href: '/grocery', icon: '🛒' },
  { label: 'Nutritionists', href: '/nutritionists', icon: '👥' },
  { label: 'Profile', href: '/profile', icon: '👤' },
],
```

---

## STEP 5 — UNIFIED /meals PAGE WITH TABS (frontend)

### File: `nutrimind-frontend/src/app/(user)/meals/page.tsx`

This is the biggest change. Restructure the page to have
three in-page tabs: **Plan**, **History**, **Library**.

Key architecture:
- Add a `activeTab` state: `'plan' | 'history' | 'library'`
- Render a tab bar at the top with three buttons
- Below the tab bar, conditionally render the content
  based on `activeTab`
- The Plan tab content = the existing meal plan grid
  (move existing code into it, do NOT rewrite)
- History tab = NEW component/section with search,
  filters, and MealLog list
- Library tab = NEW component/section with search,
  filters, and library meal grid

Tab bar styling:
- Use the existing brand design system
- Active tab: `bg-brand-green/10 text-brand-green border-b-2 border-brand-green`
- Inactive tab: `text-brand-muted hover:text-brand-text`
- Tab bar should have a bottom border: `border-b border-brand-border`

REMOVE from the page header:
- The "Dashboard" button (if it exists)
- The "Browse Library" button/modal (if it exists)
- Keep the "Regenerate Plan" button but only show it when
  `activeTab === 'plan'`

### History Tab Content:
- Search bar (filters by meal name, client-side or via API)
- Source filter: All / NutriMind / Outside Meal / Swapped
- Status filter: All / Done / Skipped
- Fetch from `GET /api/user/meals/history`
- Group entries by date (most recent first)
- Each entry shows:
  - Meal name
  - Source badge:
    - SYSTEM_GENERATED → green [NutriMind] badge
    - USER_LOGGED → amber [Outside Meal] badge
    - USER_SWAPPED → blue [Swapped] badge
  - Status (Done/Skipped)
  - Calories + macros row
- For USER_SWAPPED: show calorie delta if available
- READ-ONLY — no action buttons

### Library Tab Content:
- Search bar (by meal name)
- Meal type filter: All / Breakfast / Lunch / Dinner / Snack
- Fetch from `GET /api/user/meals/compatible-library`
  (this endpoint already exists and works)
- Grid of meal cards showing:
  - Meal name
  - Calories + macros
  - Verified-by nutritionist name + PRC badge
- BROWSE-ONLY — no swap or select actions from this tab

### Swap Modal Update:
When user selects a replacement meal in the existing swap
modal, BEFORE confirming:
1. Call `GET /api/user/meals/:mealPlanId/swap-preview?libraryMealId=<id>`
2. If `warningRequired` is true, show a warning:
   "This swap puts you at [projectedDayTotal] kcal for
   this day ([+/-calorieDelta] from your [dailyTarget]
   kcal target)"
   with [Cancel] and [Swap Anyway] buttons
3. If `warningRequired` is false, proceed with swap directly
4. When executing the swap, pass `warningShown` and
   `warningAcknowledged` in the POST body

---

## STEP 6 — FRONTEND TYPE UPDATES

### File: `nutrimind-frontend/src/types/index.ts`

The `MealLogSource` type should already have values listed
as string literals. Make sure `USER_SWAPPED` is included:
```typescript
export type MealLogSource = 'SYSTEM_GENERATED' | 'USER_LOGGED' | 'USER_SWAPPED';
```

---

## STEP 7 — VERIFY

After ALL changes are complete:
```bash
cd nutrimind-backend
npx tsc --noEmit

cd ../nutrimind-frontend
npx tsc --noEmit
```

Both must pass with zero errors. Do NOT run `npm run build`.

---

## WHAT NOT TO DO
- Do NOT create separate route pages for History or Library
- Do NOT open Library as a modal (it's a tab now)
- Do NOT change the URL when switching tabs
- Do NOT modify the swap modal entry point — swaps are
  ONLY triggered from Plan tab meal cards
- Do NOT run `npm run build` while dev server is running
- Do NOT delete or rewrite the existing Plan tab code —
  wrap it in the tab structure
- Do NOT forget to add the SwapLog creation inside the
  existing `prisma.$transaction` in `swapMeal()`
