# KAINARA Frontend Study Guide

**System:** KAINARA — AI-Powered Personalized Nutrition and Meal Planning System

**Study baseline:** repository commit `32f67b99f0326641b2872ae17d3355a8750b1db0`

**Guide date:** October 11, 2026

**Scope:** Next.js App Router, React, TypeScript, session handling, member/RND/admin workspaces, server-state synchronization, responsive UI, and frontend testing

## 1. How to use this guide

This guide explains how the KAINARA frontend presents backend workflows. It describes implementation visible in the current source; it does not treat browser presentation as the authority for permissions, clinical readiness, or persisted facts.

Use the repository [`README.md`](../../README.md) for setup and [`NUTRIMIND_ENGINEERING_RECORD.md`](../NUTRIMIND_ENGINEERING_RECORD.md) for the canonical evidence ledger. The dated [`Synthetic User-Flow Test Report — October 11, 2026`](../SYNTHETIC_USER_FLOW_TEST_REPORT_2026-10-11.md) distinguishes ordinary-login navigation/layout smoke checks against the development API from isolated browser acceptance that uses seeded actors with fixture tokens against dedicated APIs. Neither test layer constitutes clinical validation.

## 2. Frontend at a glance

The frontend uses Next.js 15 App Router and React 19 with TypeScript, Tailwind CSS, Radix UI primitives, Axios, and feature-oriented components/hooks.

```text
Next.js route page
    |
    v
Role layout + RouteGuard
    |
    v
Workspace component
    |
    +--> feature hook / view model
    |       |
    |       +--> session-scoped cache
    |       +--> Axios API client
    |
    v
Rendered loading, success, empty, blocked, stale, or error state
```

Important entry points:

- [`frontend/src/app/layout.tsx`](../../frontend/src/app/layout.tsx) defines the application-wide provider and UI shell.
- [`frontend/src/lib/context/AuthContext.tsx`](../../frontend/src/lib/context/AuthContext.tsx) owns browser authentication/session state.
- [`frontend/src/components/shared/RouteGuard.tsx`](../../frontend/src/components/shared/RouteGuard.tsx) handles route-level authentication, role, onboarding and consent navigation.
- [`frontend/src/lib/axios.ts`](../../frontend/src/lib/axios.ts) is the shared HTTP client and refresh coordinator.
- [`frontend/next.config.mjs`](../../frontend/next.config.mjs) defines security headers, API rewriting and production build behavior.

## 3. App Router and provider tree

The root layout installs local fonts and global providers for theme, authentication, notifications, live updates, breadcrumbs/navigation progress, toast messages and the install prompt.

Conceptually:

```text
RootLayout
  -> Theme provider
  -> Auth provider
  -> Notification/live-update providers
  -> navigation/breadcrumb helpers
  -> route-group layout
  -> page workspace
  -> modal/toast/installation UI
```

Route groups organize source files without adding those group names to the URL:

- `(auth)` contains sign-in, registration, verification and password recovery.
- `(onboarding)` contains the staged member intake.
- `(user)` contains authenticated member experiences.
- `(nutritionist)` contains RND review and library experiences.
- `(admin)` contains platform administration.

Pages are usually thin. They import a workspace or compose feature sections; business-heavy client state belongs in feature hooks/view models, while durable rules remain on the API.

## 4. Authentication and session state

### 4.1 Access token

After login, [`AuthContext.tsx`](../../frontend/src/lib/context/AuthContext.tsx) stores the short-lived access token in the browser-accessible `nutrimind_session` cookie and exposes current session state. The name is a legacy internal identifier; the product is KAINARA.

### 4.2 Provisional and authoritative identity

JWT claims can provide provisional role/user information while the page starts. The frontend then requests the live profile and treats that server response as authoritative. This avoids trusting an old browser claim after suspension, profile revision, onboarding, or consent state has changed.

### 4.3 Route guard

[`RouteGuard.tsx`](../../frontend/src/components/shared/RouteGuard.tsx) evaluates:

1. authentication;
2. verified email;
3. route-role compatibility;
4. onboarding completion;
5. current Terms/Privacy consent;
6. role-specific destination rules.

The guard improves navigation and prevents accidental page exposure. The backend must still repeat permission and prerequisite checks because frontend state can be stale or manipulated.

## 5. HTTP client, refresh and error behavior

[`axios.ts`](../../frontend/src/lib/axios.ts) centralizes API behavior:

- sends credentials so the HttpOnly refresh cookie can travel;
- attaches the bearer access token;
- uses longer timeouts for known long-running workflows;
- coordinates one refresh operation while queuing other failed requests;
- retries eligible requests after a successful refresh;
- applies a narrow retry policy for idempotent transient failures;
- emits application update events after relevant mutations;
- does not convert every `403` into a generic redirect.

The browser cannot read the refresh cookie. It calls the refresh endpoint and receives a replacement access token. If refresh is rejected, auth state is cleared. A dependency outage should be shown as a temporary failure rather than mislabeled as bad credentials.

## 6. Session-scoped server-state cache

[`useSessionQuery.ts`](../../frontend/src/hooks/useSessionQuery.ts) and [`session-resource-cache.ts`](../../frontend/src/lib/session-resource-cache.ts) provide a small account-scoped, in-memory query cache.

Important properties:

- cache keys are scoped to the active account/session;
- duplicate consumers can share an in-flight request;
- successful mutations can invalidate or refresh related resources;
- sign-out/account change clears relevant cached data;
- sensitive health data is not used as durable `localStorage` cache content.

This is not a replacement for server transactions. It reduces unnecessary requests and coordinates views inside one browser session.

## 7. Layouts and navigation by role

### Member shell

The user route layout combines `RouteGuard`, membership/announcement context, a desktop sidebar, navbar and mobile bottom navigation. Primary destinations include dashboard, meals, grocery, progress, profile and export.

### Nutritionist shell

The RND layout exposes review queue, meal library, audit/history and profile/credential experiences. Credential/verification state still comes from the backend.

### Administrator shell

The admin layout groups overview, people, data, meals and additional governance tools. Admin screens should preserve “unavailable” metrics rather than display invented zeroes.

## 8. Member workflow map

| URL area | Page/workspace | Main responsibility |
|---|---|---|
| Dashboard | [`dashboard/page.tsx`](<../../frontend/src/app/(user)/dashboard/page.tsx>) → [`DashboardWorkspace.tsx`](../../frontend/src/features/dashboard/DashboardWorkspace.tsx) | Daily meals, calorie/macro status, outside-meal logging, plan notices |
| Meals | [`meals/page.tsx`](<../../frontend/src/app/(user)/meals/page.tsx>) → [`MealsWorkspace.tsx`](../../frontend/src/features/meals/MealsWorkspace.tsx) | Cycle/plan views, generation state, history, library and swaps |
| Grocery | [`grocery/page.tsx`](<../../frontend/src/app/(user)/grocery/page.tsx>) → [`GroceryWorkspace.tsx`](../../frontend/src/features/grocery/GroceryWorkspace.tsx) | Categorized checklist, progress and export actions |
| Progress | [`progress/page.tsx`](<../../frontend/src/app/(user)/progress/page.tsx>) → [`useProgressWorkspace.ts`](../../frontend/src/features/progress/useProgressWorkspace.ts) and sections | Weight/adherence history, profile safety state and regeneration flow |
| Profile | [`profile/page.tsx`](<../../frontend/src/app/(user)/profile/page.tsx>) | Account details, security and avatar/preferences |
| Report | [`nutrition-report/page.tsx`](../../frontend/src/app/nutrition-report/page.tsx) → [`NutritionReportWorkspace.tsx`](../../frontend/src/features/reports/NutritionReportWorkspace.tsx) | Versioned report display and acknowledgment |

## 9. Dashboard composition

[`DashboardWorkspace.tsx`](../../frontend/src/features/dashboard/DashboardWorkspace.tsx) is the current dashboard composition entry. It delegates state to [`useDashboardWorkspace.ts`](../../frontend/src/features/dashboard/useDashboardWorkspace.ts) and renders focused components such as date navigation, plan notices, daily meal rows and the outside-meal modal.

Study the separation:

- the workspace coordinates the page;
- the hook loads/caches server resources and exposes actions;
- presentation components render stable props;
- API mutations remain authoritative for log/status changes;
- safety warnings and readiness blocks are displayed rather than inferred away.

Outside-meal entry is divided into search, photo, nutrition and confirmation sections. This keeps a complex form testable and makes the member's final submitted data visible before persistence.

## 10. Meals workspace and generation progress

[`MealsWorkspace.tsx`](../../frontend/src/features/meals/MealsWorkspace.tsx) presents plan-cycle, history and library experiences. [`useMealGenerationProgress.ts`](../../frontend/src/features/meals/useMealGenerationProgress.ts) interprets backend generation/job state.

The UI must represent at least these distinctions:

- no current plan versus a request still being prepared;
- starter/partial plan versus a complete cycle;
- retryable provider/infrastructure failure versus invalid member prerequisites;
- a generated meal versus one cleared by the relevant review state;
- current context versus a stale plan/review invalidated by profile changes.

The frontend should never manufacture missing meal slots just to complete the visual grid. It displays the backend's actual progress and provides retry/acknowledgment actions only when permitted.

## 11. Clinical clarifications and profile proposals

Member components:

- [`MemberClarifications.tsx`](../../frontend/src/features/clinical-clarification/MemberClarifications.tsx)
- [`MemberProfileProposals.tsx`](../../frontend/src/features/clinical-clarification/MemberProfileProposals.tsx)

These components display server-issued questions/proposals and submit version-bound member decisions. Key interface principles are:

- show which item is current;
- preserve the member's typed response across recoverable UI transitions;
- reject or refresh stale expected versions instead of overwriting newer state;
- make “apply proposal” and “request correction” distinct actions;
- explain that applying a proposal does not automatically complete separate planning confirmation or report acknowledgment.

RND-side wording must also avoid implying that a proposal edits the member's profile before the member accepts it.

## 12. Nutrition report acknowledgment

[`NutritionReportWorkspace.tsx`](../../frontend/src/features/reports/NutritionReportWorkspace.tsx) displays the active/versioned nutrition report and the acknowledgment controls.

The component should send the report version and current profile revision expected by the user. If either is stale, the correct behavior is to refresh and present the current report, not to silently acknowledge a different version. Report acknowledgment is a workflow prerequisite, not a claim of diagnosis or clinical validation.

## 13. Nutritionist review workspace

The RND queue is coordinated by [`useNutritionistReviews.ts`](../../frontend/src/features/nutritionist-reviews/useNutritionistReviews.ts) and its associated workspace/components.

The hook handles:

- queue polling and filtering;
- selected-review loading;
- claim and release actions;
- approve/reject actions;
- expected context keys and stale-context errors;
- selection races when the queue changes;
- draft preservation across recoverable refreshes.

### Prior exact-match review references

When the backend returns eligible exact-context reference evidence, the UI may show it to the current RND. The interface must communicate that it is prior evidence only. Even an exact match of recorded profile/clinical inputs, clarifications and serving digest requires a separate current decision; it is not automatic cross-member clinical approval.

Never display private facts from the source member. The frontend should render only the bounded reference fields returned by the server.

## 14. Meal library and swap interfaces

The meal library lets permitted RND users curate reusable meal records and lets members browse only options allowed by the member-facing API. Swap screens display backend-calculated compatibility and imbalance information.

Client filtering is useful for search and presentation, but it is not proof that a swap is safe. The mutation endpoint must re-evaluate current profile context, weekly cap, ownership and target-slot state.

## 15. Progress, check-ins and water

The progress area is intentionally composed instead of relying on one monolithic `ProgressWorkspace.tsx` file. [`useProgressWorkspace.ts`](../../frontend/src/features/progress/useProgressWorkspace.ts) and the files under [`features/progress/sections`](../../frontend/src/features/progress/sections) coordinate overview, history, profile/safety and regeneration modal state.

Weight charts use normalized chart data and explicit empty states. Check-in/profile changes can make reports or plans stale, so the UI must display the server's required next step.

Water logs are currently backed by user-scoped API persistence. The UI should not describe them as browser-only state.

## 16. Grocery workspace

[`GroceryWorkspace.tsx`](../../frontend/src/features/grocery/GroceryWorkspace.tsx) loads the current grocery data and composes categorized checklist/progress/export sections. Checkbox interactions should reconcile with server state and report failed mutations rather than permanently showing an optimistic value that was never saved.

The existence of a PDF button or route is not by itself proof that deployed export behavior and all quantity/unit semantics are complete; use dated runtime evidence for that claim.

## 17. Admin workspaces and audit UI

[`AdminAuditWorkspace.tsx`](../../frontend/src/features/admin-audit/AdminAuditWorkspace.tsx) exposes administrator actions, RND history, subscription information and meal logs, with staff/action/date/mine filters and related activity.

Admin analytics should distinguish:

- exact zero;
- no records for the selected scope;
- metric not returned;
- request failure.

Collapsing all four into `0` makes system health and audit interpretation unreliable.

## 18. Live updates, notifications and service worker scope

The root providers coordinate notification polling and application update events so multiple visible screens can refresh after a mutation. A notification service worker file exists for device notification behavior.

Do not infer full offline PWA support from that service worker. Notification delivery and offline application caching are different capabilities, and current claims must be tied to current runtime evidence.

## 19. UI state design

Every data workspace should distinguish these states explicitly:

| State | Expected presentation |
|---|---|
| Loading | Skeleton/spinner that does not imply empty data |
| Empty | A valid no-records message with the next available action |
| Blocked | Exact prerequisite and safe route to resolve it |
| Partial | Real progress, missing portions and retry/status controls |
| Stale/conflict | Refresh current version; preserve safe drafts where possible |
| Unauthorized | Role/resource-specific denial without leaking private existence |
| Provider/dependency failure | Temporary failure language and allowed retry |
| Validation error | Field/action-specific feedback without discarding valid input |

Avoid a single generic error screen for all of these. Their recovery actions are different.

## 20. Responsive design, theme and accessibility

The design uses a desktop sidebar and mobile bottom navigation, light/dark theme tokens, local font loading, Tailwind utilities and Radix primitives.

When reviewing a component, check:

- keyboard focus order and visible focus indicators;
- accessible label/name for icon-only buttons;
- dialog title, description, focus trap and close behavior;
- color contrast in both themes;
- status meaning that does not rely on color alone;
- responsive tables/cards without hidden required actions;
- motion/loading behavior that does not trap the user;
- touch targets and fixed mobile navigation overlap.

## 21. Testing structure

Frontend tests live beside features and in the end-to-end directory. Examples include dashboard component tests, progress chart/data tests, clinical-clarification tests, membership tests and Playwright browser journeys.

Use the scripts in [`frontend/package.json`](../../frontend/package.json) and the commands in [`README.md`](../../README.md). A reliable report should state browser/viewport, theme, backend/database mode, provider mode, account fixture, command, date and result.

Do not describe an in-progress browser run as a completed pass. Do not treat a response-stubbed test as evidence of the real API, and do not treat a synthetic real-API test as clinical validation.

## 22. Guided code-tracing exercises

### Exercise A: Trace session startup

1. Start at [`app/layout.tsx`](../../frontend/src/app/layout.tsx).
2. Find where `AuthContext` loads provisional token claims.
3. Find the live profile request.
4. Follow route decisions in [`RouteGuard.tsx`](../../frontend/src/components/shared/RouteGuard.tsx).
5. Simulate an expired access token and follow the refresh queue in [`axios.ts`](../../frontend/src/lib/axios.ts).

### Exercise B: Trace dashboard meal logging

1. Start at the member dashboard page.
2. Follow [`DashboardWorkspace.tsx`](../../frontend/src/features/dashboard/DashboardWorkspace.tsx) into its hook.
3. Find the scheduled-meal and outside-meal actions.
4. Identify which cached resources are refreshed after success.
5. Verify how validation, contraindication warning and dependency failure differ visually.

### Exercise C: Trace an RND decision

1. Start with [`useNutritionistReviews.ts`](../../frontend/src/features/nutritionist-reviews/useNutritionistReviews.ts).
2. Follow queue selection, claim and detail loading.
3. Find the expected context key sent on approve/reject.
4. Find stale-context recovery and draft preservation.
5. Identify how prior exact-match reference evidence is labeled.

## 23. Review questions

1. Why are JWT claims provisional during startup?
2. Which route decisions are user-experience aids rather than security boundaries?
3. Why does the refresh interceptor queue concurrent failed requests?
4. What data may safely live in the session resource cache, and when is it cleared?
5. How should the UI distinguish a partial plan from a failed plan?
6. Why must profile-proposal acceptance and report acknowledgment be separate screens/actions?
7. How does the RND workspace defend against a queue-selection race?
8. Why is an exact prior review shown as reference rather than automatic approval?
9. What evidence would be needed before describing a feature as production verified?

## 24. Current documentation cautions

When studying older screenshots or documents, verify them against current code:

- The current frontend package is Next.js 15/React 19, not the older Next.js 14/React 18 description.
- The dashboard entry is `DashboardWorkspace.tsx`; there is no current `MemberDashboardWorkspace.tsx`.
- Progress is composed through `useProgressWorkspace.ts` and section components; there is no single current `ProgressWorkspace.tsx`.
- Water state is server-persisted and user/date scoped.
- The notification service worker does not establish full offline application behavior.
- `nutrimind_*` cookies/events and some package identifiers are legacy internals under the KAINARA product.

These notes explain the current implementation; they do not authorize runtime changes from this documentation-only task.
