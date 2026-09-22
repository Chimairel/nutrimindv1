# Batch 5 — Progressive Current and Next Grocery Implementation Evidence

**Change ID:** CHG-20260923-02  
**Implemented:** September 23, 2026  
**Schema migration:** None. `GroceryList.planGroupId` already provides the required one-list-per-cycle identity.

## Delivered contract

- Added one authenticated grocery workspace response containing the authoritative current and upcoming cycle projections. Each projection carries its cycle identity, cleared/expected/unresolved slot counts, grocery rows, and server-derived actionability.
- The grocery page now has universal **Current week** and **Next week** views. There are no entitlement, Premium, subscription, checkout, or swap-cap checks.
- Upcoming previews aggregate only slots returned by the same evidence-complete clearance authority used for cycle readiness. `MealPlan.status = APPROVED` by itself is insufficient.
- Preparing and under-review projections are view-only and say that quantities may increase. Checkboxes, purchased-amount editing, pantry actions, and PDF export remain disabled.
- Ready lists become final/actionable. Incomplete-at-deadline lists require explicit acknowledgment, then freeze and export with an `INCOMPLETE LIST` label plus unresolved-slot count.
- The first checklist or pantry mutation records shopping start atomically. Automatic review events cannot enlarge a list after shopping starts or after an incomplete subset is acknowledged. Explicit swap and safety-replacement paths may rebuild the exact cycle projection and preserve same-cycle purchased quantities.
- Revalidation/stale projections fail closed: actions and new exports are disabled while the warning remains visible.
- PDF requests accept an owned cycle ID and re-evaluate actionability server-side. A client cannot export a preview by bypassing the UI.

## Main implementation points

- `backend/src/domain/grocery-actionability.policy.ts`: deterministic lifecycle-to-action policy.
- `backend/src/services/meal-plan-cycle.service.ts`: shared evidence-complete cleared-meal authority used by readiness and grocery aggregation.
- `backend/src/services/grocery.service.ts`: current/upcoming workspace, progressive aggregation, freeze behavior, cycle-scoped mutation checks, and exact cleared-slot counts.
- `backend/src/controllers/grocery.controller.ts` and `backend/src/routes/grocery.routes.ts`: `/api/user/grocery/workspace` and cycle-scoped PDF handling.
- `frontend/src/features/grocery/current-grocery.ts` and `frontend/src/app/(user)/grocery/page.tsx`: typed workspace client, current/next tabs, coverage/status explanations, incomplete acknowledgment, and action disabling.

## Verification

- Backend unit suite: **475 passed, 0 failed, 1 pre-existing clinical-policy TODO** across 476 tests.
- Batch 5 policy tests cover preview-only states, final states, incomplete acknowledgment, and stale/revalidation fail-closed behavior.
- Development-database acceptance: `npm run test:acceptance:batch5-grocery` passed using disposable, cascade-cleaned fixture data. It proved:
  - pending and competing candidates contribute no preview ingredients;
  - an approval increases cleared coverage and quantities;
  - complete coverage enables checklist and PDF actions;
  - a delayed approval after shopping start cannot enlarge the frozen list;
  - incomplete lists require acknowledgment and then remain explicitly incomplete.
- Backend build and lint passed.
- Frontend: **201/201 tests passed** across 53 files; production build and lint passed.
- No database migration or persistent fixture data was introduced.

## Boundary retained for Batch 6

Batch 5 permits the existing explicit swap/replacement service paths to rebuild a frozen cycle projection. Batch 6 must show ingredient additions/removals in the swap confirmation before that explicit commit and must enforce all contextual eligibility rules. Automatic approvals remain unable to modify the frozen list.

