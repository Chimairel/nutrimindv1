# NutriMind UI audit and redesign plan

September 10, 2026 · Planning deliverable, not an implemented redesign

## Recommendation

Keep the dark forest green, lime accent, mint background, rounded corners and existing brand typography. Change the information architecture and component hierarchy: smaller workspace headers, opaque content surfaces, fewer nested containers, and the user's next task visible before decorative summaries.

Move Health Profile into a unified Profile hub. Keep daily tracking in Home and Progress, and keep immediate access to conditions/allergies through shortcuts. Combine the nutritionist's review destinations into one Reviews workspace. Organize Admin around attention needed, people, data and operations instead of duplicating its navigation as large cards.

This audit found presentation defects and an additional data-dependent rendering failure. They should be addressed before treating the prior functionality tests as evidence that every screen is complete.

## Evidence and limits

- Inspected the current `codex/frontend-polish` worktree after repair commit `ab9a8bf`, including the five pre-existing uncommitted dashboard/theme polish files. Those files were not changed during this audit.
- Browser: Chromium through Playwright, actual frontend/API login, task-owned synthetic PostgreSQL records. No authenticated UI was fabricated using mocked API responses.
- Covered 23 authenticated routes at 1440×1000 and 390×844; 22 rendered workspace content, while Admin Nutritionists rendered the error boundary twice. Also visited four public entry routes at both sizes, selected profile panels, health restrictions, user library, a nutritionist review, and dark-mode Home.
- Evidence: [route observations](verification/ui-audit-2026-09-10/observations.json), [additional states](verification/ui-audit-2026-09-10/detail-observations.json), and adjacent screenshots. Screenshot names include the route and viewport. Screenshots capture the visible viewport of internally scrolling workspaces; body-text observations include additional mounted content. They are not stitched full-page inspections of every scroll position.
- Port 3000 was found serving `C:/Users/chima/Desktop/Nutrimind`, not this worktree. Its attempted synthetic login failed to reach its configured API. The audit therefore used a separate worktree preview at `http://127.0.0.1:3002`, connected to the synthetic API on 5012. The Desktop checkout was not changed.
- Synthetic records include deliberately incomplete plans, stale recipe evidence, long test names, no outside-review queue items, and empty compensation ledgers. These expose real layout states but do not measure production content coverage or real user adoption.
- Selecting one synthetic nutritionist queue card acquired its normal 30-minute review claim. No review was approved/rejected, no account suspended, no profile saved, and no application, payment, source publication or image assignment submitted. The claim expires normally.
- This is a broad UI/navigation audit, not complete accessibility certification or exhaustive interaction testing. Onboarding steps after registration, live OAuth, checkout, populated payment statements, every modal, all dark-mode screens and a completed nutritionist application require later acceptance coverage.

## Priorities from the browser

| ID | Priority | Evidence and user impact | Recommended change |
|---|---|---|---|
| UI-01 | P1 | `/admin/nutritionists` shows the full error boundary twice. The page is unavailable with the current synthetic application records. | Fix and regression-test malformed/legacy availability values before redesign. Source lead: `NutritionistApplicationCard` passes the first availability string to `toLocalInput`; that helper calls `toISOString()` without checking validity. The audit fixture includes `Monday afternoon`. This is a source-backed likely cause, not a captured browser stack diagnosis. |
| UI-02 | P1 | `/nutrition-report` produces horizontal overflow at 390 px; screenshot is 495 px wide. DOM inspection identifies an absolutely positioned 600 px decorative glow crossing the viewport. | Contain decorative layers, constrain content width, and reserve space for the acknowledgement footer. Test both current and archived reports at 320–430 px. |
| UI-03 | P1 | Report headline copy says “Clinical guidelines” and “cross-referenced with FNRI index standards”; the fixture report and summary export explicitly identify unreviewed AI guidance. Acknowledgement UI appears even for an already acknowledged report. | Use “AI-generated nutrition guidance,” date/version, and actual review state. Never imply FNRI or acknowledgement is professional approval. Give acknowledged reports a normal reader with Back/History, showing the mandatory acknowledgement only when required. |
| UI-04 | P1 | Nutritionist review queue shows green `SAFE` on pending rows, including one selected row with current VEGAN profile and an egg ingredient. | Separate review status from automated triage. Show “Awaiting review,” “Profile changed,” and the relevant conflict prominently. Do not translate stale/automated SAFE into a user-facing safety assurance. Trace the stale risk projection as a prerequisite functional check. |
| UI-05 | P1 | Meals displays `TARGET: 600 KCAL` for the partial plan while Home/Profile use the person's 2,000 kcal target. | Show “600 kcal planned / 2,000 kcal target” with missing-slot context. Label planned macros separately from personal targets. This is a partial-plan fixture, not evidence that every production day has this mismatch. |
| UI-06 | P2 | Almost every workspace repeats a top title, a large dark hero, eyebrow, icon, description, and another title. Mobile Profile reaches the form only near the bottom of the first screen. | Introduce a compact workspace header. Retain expressive hero treatment on landing and a smaller Home greeting only. |
| UI-07 | P2 | Several cards use translucent mint over the mint page background. Nested mint sections, glow and heavy shadows blur section boundaries. | Opaque white/light surfaces and clearly separated dark surfaces; restrained borders/shadows. Use lime for selected state and the main action, not every container. |
| UI-08 | P2 | Grocery first screen contains header, PDF, cycle controls, estimate and counters; ingredients are pushed down. “Packed,” “to buy,” “purchased” and “pantry” describe overlapping concepts. | Put list items immediately below compact cycle/search controls. Use “To buy” and “Bought”; give pantry its own explanatory action. Keep purchased quantities visible and preserve the audited quantity model. |
| UI-09 | P2 | Nutritionist library opens with coverage cards and a restriction matrix before search and recipes. | Make Recipes the default tab; move Coverage and Flags to secondary tabs. Show one actionable coverage notice with a deep link rather than the full matrix above every search. |
| UI-10 | P2 | Admin Overview repeats seven navigation tiles before operational metrics; Analytics largely repeats counts. | Lead Overview with unresolved work, deadlines and failures. Put reference totals below. Keep Analytics as a secondary report; add trends only when the API provides time-series evidence. |
| UI-11 | P2 | Admin Users technically fits the viewport but hides status/access columns in a sideways-scrolling table. | Use mobile account cards with name, role, status and a Details action. Keep a dense sortable desktop table. Document-level overflow checks alone are insufficient. |
| UI-12 | P2 | Health inputs and account settings live in separate primary destinations; exports and Premium also occupy the main desktop rail. | Consolidate into Profile; preserve contextual deep links and shared desktop/mobile destinations. |
| UI-13 | P2 | Admin Data still says canonical nutrient values are read-only, despite the newly implemented composition correction workflow. | Correct help text and distinguish consumption releases, aliases and composition corrections. Put change history and affected-record counts beside publication. |
| UI-14 | P2 | Nutritionist Profile devotes a large sparse card to license, verification, zero meals and rating 0.0. | Use a compact professional identity card and a user-visible profile preview. Hide unsupported/empty rating rather than depicting zero as a meaningful score. Explain what the review count measures. |
| UI-15 | P2 | Placeholder images repeat the dish name, category, “representative visual,” and technical fallback text, then the card repeats the name again. Tiny egg icons do little to identify meals. | Create a deliberate image system: useful photo or consistent illustration, one title outside the image, short visual disclosure, credits in the appropriate accessible location. |
| UI-16 | P2 | Meals elevates a red “Regenerate plan” above routine browsing; it may be blocked once shopping/logging exists. | Promote meal choice/next-week planning. Put regeneration in Plan options, explain availability before click, and retain server safeguards. |
| UI-17 | P2 | Professional application on mobile has a long marketing block before the first input. | Reduce intro to purpose, requirements and step count; start the form in the first screen. Keep Track application beside Apply. |
| UI-18 | P3 | Jargon includes “unstatemented units,” raw uppercase audit event names, “biometrics,” “locality strength,” and “daily budget” for calories. Some important metadata is very small. | Use plain labels, readable secondary text, consistent units and dates. Put technical explanations in Details rather than removing necessary evidence. |

## Proposed navigation and data ownership

### User

Main navigation: **Home · Meals · Groceries · Progress · Profile** on both desktop and mobile. These correspond to daily actions, planning, shopping, longitudinal tracking and settings. The existing five-item mobile structure is already close to this.

| Destination | Contents | What moves here |
|---|---|---|
| Home | Today/date, next meal, consumed versus target, remaining meals, water, check-in reminder, short grocery summary | Keep daily actions; remove generic explanatory cards from the main reading path. |
| Meals | Week/date selection; Plan, Library and History; swap preview; next-week Premium affordance | Keep plan/library together. Put advanced plan regeneration in a menu. |
| Groceries | Current/next cycle, remaining purchases, bought quantities, search/categories, cost coverage, PDF | The checklist is the principal content; counters and explanations become compact. |
| Progress | Weight trend, intake/adherence history, weekly check-ins, Reports | Nutrition report history and report reading have a discoverable home here. |
| Profile | Personal details, Health & goals, Food & planning, Membership, Security & privacy | Health Profile, account settings, avatar and Premium management converge here. Export-all-data belongs under Security & privacy; contextual PDFs stay on the relevant screen. |

Profile should be a hub with a short identity summary and grouped rows, not a gigantic form or an eight-tab strip. Desktop can use a local section list; mobile opens a section page with a Back to Profile link.

| Profile section | Fields/actions | Saving and display |
|---|---|---|
| Personal details | Name, email, avatar | Inline avatar edit; avoid making avatar a full top-level destination. |
| Health & goals | Conditions, allergies/intolerances, body measurements, goal and activity | Separate clearly titled groups. Show current values before edit. Do not hide allergies behind a vague “Safety” tab. |
| Food & planning | Diet, carb preference, cooking culture, Region/Province-HUC, National/Regional/Local preference, shopping day | Explain locality in plain terms and disclose the actual province/HUC scope; do not promise city stock. |
| Membership | Free/Premium status, remaining swaps, AI quota, next-week access, test checkout state | One factual benefit comparison, context-specific upgrade links from locked features. |
| Security & privacy | Password, account export, consent information, deletion, sign out | Separate destructive deletion from ordinary settings and downloads. |

Health updates must remain available immediately. Weekly check-in is a reminder cadence, not a restriction preventing a new allergy from being recorded. Use a visible Home/Progress “Update health information” shortcut. After saving, explain that affected meals are being checked again and the report may need updating; preserve the revision transactions already implemented.

Suggested route approach: `/profile/health`, `/profile/planning`, `/profile/membership`, `/profile/security`, and `/progress/reports`. Keep `/health-profile`, `/billing`, `/export`, and existing report links working through redirects or wrapper routes. Preserve onboarding report gates, browser Back, refresh/deep links and current query state. Moving a route must not silently relax authorization or prerequisites.

### Nutritionist

Main navigation: **Reviews · Meal library · Compensation · Profile**.

| Workspace | Primary content | Secondary content |
|---|---|---|
| Reviews | Meal plans / Outside meals, unclaimed/mine filters, risk reason, age/deadline, selected review | Completed review history. Initially label the existing archive “Approved reviews”; an all-outcome history needs an API addition before advertising it. |
| Meal library | Recipe search/filter/results, status, certification freshness, edit/review action | Coverage, flags and archived recipes. |
| Compensation | Current statement/status, earned work, paid/outstanding amounts | Period history, adjustments, policy explanation. |
| Profile | Credentials, validity/status, bio/specialization, preview of what users can see | Account/security links where supported; do not invent editing capabilities. |

Review screen order: **why review is needed → current restrictions and target → meal/portion/ingredients → nutrition evidence → decision**. Keep claim owner/expiry visible. Desktop uses a compact queue beside the inspector; mobile opens a dedicated inspector with Back to queue. Do not stack a full long queue before its selected item. Use a sticky decision footer that leaves the last field visible, and focus the validation error when a decision is blocked.

Meal operational approval, certification freshness, profile revalidation and estimated nutrition are distinct facts. A recipe can be operationally approved yet have stale reusable evidence. Display “Needs evidence review” as the primary actionable status in that case; retain the detailed distinctions in the inspector.

### Admin

Desktop grouped navigation: **Overview**; **People** (Users, Nutritionists); **Content & data** (Nutrition data, Meal images); **Operations** (Issues & activity, Compensation, Analytics). Use section labels already represented in navigation metadata. Mobile: Overview, People, Data, Operations, More.

Overview order: **Needs attention → upcoming deadlines → recent consequential activity → concise platform totals**. Each attention item should deep-link to its filtered queue: pending applications, expiring credentials, failed generation, stale certification and pending reviews. Only show metrics with actual backend evidence; do not invent “healthy” status from a lack of data.

Nutritionists should open a searchable application queue with status tabs and a detail drawer/page. Put applicant identity, license evidence, availability/call, decision history and next allowed action together. Completed applications must not run editable date conversion unconditionally. Keep the required call, decision audit and invitation delivery state.

Data should distinguish **Food catalogue**, **Sources & releases**, **Import & reconcile**, and **Change history**. Composition editing remains a focused modal/drawer with Before/After, source, reason, affected evidence and publish action. Meal images can remain a separate route under Content & data so asset work does not clutter food-composition maintenance.

Compensation should default to periods/statements needing work; move policy creation to Settings/Policies. Preserve maker-checker roles and manual-payout evidence, but show business labels before internal terminology. Do not combine subscription revenue with nutritionist payout accounting.

## Screen-by-screen layout plan

| Existing screen | Keep | Change |
|---|---|---|
| User Dashboard | Daily tracker, meal actions, water, check-in and grocery links | Compact greeting/date; dark intake card with readable labels; meal actions above fold; one Weekly plan link; help text in contextual details. |
| User Meals | Plan/History/Library, same-day unconsumed swaps, current/next cycle | One week/date control; move four summary cards into a single summary line; rename planned totals; reduce nested cards. |
| User Library | Compatible results, calorie/macros, reviewer details | Explain “Matched to your profile” and selected date/slot once; cards get a clear Choose meal action, then target selection/preview. Preserve best breakfast/lunch/dinner ordering and empty reasons. |
| Meal detail / swap | Actual ingredients, reviewer, extra shopping and confirmation | Use side-by-side before/after desktop and stacked mobile; headline selected day/meal; “Additional shopping: 150 g chicken.” No reduction narration. This modal redesign requires later dedicated browser acceptance. |
| Grocery | Required/purchased/remaining, PDF and cost coverage | Title/date/search then checklist; To buy/Bought/Pantry filters; simplify counts and “packed” language; purchased-total edit near each item. |
| Progress | Weight logging, chart and adherence | Rename calorie budget to daily calorie target; timeframe next to chart; useful empty CTA; Reports and Check-ins become discoverable local sections. |
| Health Profile | All fields and structured restriction review | Move into Profile sections; shorter forms, plain labels, last-updated state and visible save feedback. |
| Account Profile | Account, security, avatar, privacy actions | Compact identity header and section hub; inline avatar; avoid repeated Sign out cards. |
| Premium | Honest quotas, no safety paywall, test mode | Benefits before technical payment details; show actual availability; separate disabled sandbox state from real purchase flow. No invented price. |
| Exports | Honest summary preview and JSON/PDF distinction | Put report downloads under Reports and data export under Privacy; retain dedicated print layout rather than styling print as an app dashboard. |
| Nutrition Report | Versioned content, acknowledgement gate, history | Responsive reader, review/source/date badges, nonjudgmental category labels, current versus archived state, Back link, no permanent blocking footer after acknowledgement. |
| Nutritionist Reviews | Claim workflow, current profile and ingredient evidence | Risk reasons before green status; concise queue; inspector and decision footer; keep non-clinical admin actions separate. |
| Nutritionist Outside meals | Estimate corrections and original evidence | Local tab in Reviews; one concise empty state instead of two large empty panels; same inspector pattern. |
| Nutritionist Approved | Traceable reviewer archive | Completed/Approved local review tab, searchable date/person/meal rows; do not imply entire plans were reviewed if records are individual meals. |
| Nutritionist Library | Certification, flags and serving coverage | Recipes first, Coverage separate, recipe status plus most relevant action; smaller consistent cards. |
| Nutritionist Compensation | Statements, work history and payout evidence | Current period first; “Work not yet included in a statement” instead of “Unstatemented units”; policy explanations expandable. |
| Nutritionist Profile | PRC validity and bounded public information | Two-column identity/details on desktop, stacked mobile; public preview; no unsupported zero rating. |
| Admin Overview | Queue counts and operational signals | Attention list first; remove navigation-card wall; timestamps and scoped metrics. |
| Admin Users | Search, role/access state and suspension | Dense desktop rows, readable mobile cards, status text as well as icons, one detail action; protect destructive actions. |
| Admin Nutritionists | Staged applications and activated professionals | Repair render failure; status tabs, selected application detail and audit timeline. |
| Admin Analytics | Existing factual aggregates | Secondary destination; reduce duplication with Overview. Trend charts are conditional on new time-series API support. |
| Admin Nutrition data | Provenance, releases, catalogue and corrections | Correct read-only copy; task-oriented tabs, focused import stepper and publication diff. |
| Admin Meal images | Assignment, rights/source and fallback information | Missing/assigned/needs-review filters, consistent aspect ratio and no duplicate meal title; bulk work only if supported later. |
| Admin Operations | Issues, audit records and refresh | Pending issues first; human-readable activity labels, date/actor filters, less emphasis on supported-condition counts. |
| Admin Compensation | Policy/period/statement/control separation | Periods and pending work first; policy forms behind explicit action; mobile stacked records. |
| Landing | Brand, Filipino context, user and nutritionist entry paths | Prioritize user value; keep illustrative-demo label; move unfinished project-journal content behind Docs. |
| Login/Register | Clear email form and OAuth when configured | Shorter mobile intro; suppress “or use email” when no alternative is rendered; visible service/configuration state in demo rather than fake OAuth. |
| Nutritionist Apply | Apply/Track, five stages and credential requirements | Form near top on mobile; compact requirements disclosure and “Step 1 of 5”; readable step labels. Later audit remaining stages and tracking states. |

## Component rules while preserving the theme

1. **Surface hierarchy:** quiet mint canvas, opaque primary cards, lightly tinted nested rows, forest-green navigation. Use dark emphasis sparingly for Home intake/important summary. Clip decorative glows inside their owning container.
2. **Header hierarchy:** 24–32 px page title, one short supporting sentence only where useful, one main action. Mobile headers should normally stay within about 100–140 px, excluding navigation. This is a proposed design target, not a measured accessibility standard.
3. **Density:** one parent card per meaningful task. Desktop lists can be denser than consumer recipe cards. Reduce repeated borders, empty padding and oversized KPI tiles. Do not stretch a single day pill across the entire content width.
4. **Typography:** retain display font for short titles; use body font for forms, tables and instructions. Aim for 14–16 px ordinary content and 12–14 px metadata. Tiny all-caps mono should be decorative, never the only readable status or instruction.
5. **Color semantics:** lime indicates selection/main action; green indicates an actual completed/approved state; amber means attention; red means destructive action/error. Automated triage is explicitly labeled. Never encode approval only through color.
6. **Responsive controls:** visible names on primary navigation; Profile stays reachable for every role. Tables use meaningful mobile representations. Keep fixed navigation/decision bars clear of content and device safe areas.
7. **Form behavior:** grouped labels, units next to values, inline errors, unsaved-change handling, save confirmation and focus management. Do not visually imply that unsubmitted chip edits are already active restrictions.
8. **State design:** loading skeleton, no records, no compatible meals, stale evidence, permission/expired session, offline/API failure and saving state each have distinct copy and one relevant next action. Missing data is “Unavailable,” not zero.
9. **Accessibility acceptance:** keyboard navigation, visible focus, labels, dialog focus return, non-color status, reduced motion, 200% zoom and contrast measurements. Target WCAG AA contrast in implementation; no measured conformance claim is made here.

## Meal imagery and the capstone question

**Choosing images with clear usage rights is appropriate, but requiring only images with no copyright at all is unnecessarily restrictive.** A copyrighted photograph may be usable through a license or the creator's permission. “Royalty-free” does not mean copyright-free or without conditions.

Philippine fair use includes teaching, scholarship and research, but educational purpose is one factor alongside the work's nature, amount used and market effect. A capstone label alone does not establish that every copied meal photograph is permitted. A public app, repository or promotional demo has a different use context from a closed classroom presentation. Attribution alone does not settle permission. See the [Supreme Court's explanation of the four factors](https://sc.judiciary.gov.ph/sc-no-copyright-violation-in-ringtone-previews/) and [RA 8293, sections 184–185](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/4371).

Practical capstone asset plan:

- Prefer your team's own dish photographs, with consistent lighting, background and crop. Photograph common meals already in the library so imagery matches recipe identity.
- Accept appropriately licensed or explicitly permitted photos, including licenses requiring attribution. Retain the source page, creator, license/version, allowed edits and relevant permission evidence. Do not require a photo to be public domain just to use it.
- Generated illustrations/photos can fill gaps subject to the provider's terms and a visual review. Mark them as illustrative where they are not a photo of the actual recipe. Generation is not a guarantee of absence of rights issues or nutritional accuracy.
- Keep a polished category illustration for meals without an accurate usable image. Do not substitute a visually similar but different dish that implies ingredients absent from the recipe.
- Prioritize the recipes used in your capstone demonstration rather than holding the whole interface hostage to sourcing 100 photographs. Expand coverage in batches.
- User cards show the meal clearly with minimal disclosure. Put full credits in meal details or an accessible image-credit view as the applicable license requires. Keep the complete rights record in Admin; do not bury attribution if the license requires it beside the image.
- Avoid scraping random Google/Pinterest images and adding “credits to owner.” Search results are discovery aids, not permission records.

The browser fixture's seven synthetic library entries are mostly category fallbacks. This does not prove that the shared catalogue has no images; the prior engineering record documents seven reviewed photo assignments in a different dataset. Inspect that dataset separately before making coverage claims or replacing approved assets.

## Implementation sequence and acceptance

| Phase | Deliverable | Acceptance before moving on |
|---|---|---|
| 0 — prerequisites | Fix Admin Nutritionists invalid-data rendering, report overflow, misleading/stale status and copy | Browser regression with textual/invalid availability, stale recipe/current restrictions, partial plan and acknowledged report. No whole-page crash and no false verification wording. |
| 1 — shared layout | Compact header, surfaces, typography, role navigation and Profile hub routes | Same features reachable on desktop/mobile; old links redirect correctly; no prerequisite/RBAC changes; no horizontal overflow at 320, 390, 768 and 1440 px. |
| 2 — user journey | Home, Meals/Library/swap, Groceries, Progress/Reports, Profile sections | User can find/update health information within two navigation steps; first shopping item is visible without passing a wall of counters; bought 300/need 450 still shows 150 remaining; partial purchases and changed preview protections pass. |
| 3 — professional workflow | Reviews consolidation, recipe-first library, coverage tab, professional profile | Claim/expiry/decision accessible by keyboard and mobile; restrictions and quantities visible before decision; no admin-style safety approval; completed scope accurately labeled. |
| 4 — admin workflow | Attention-first Overview, People queue, focused data editor, Operations/compensation organization | Application stages, credentials, publish impacts and approval separation remain intact; mobile record details expose actions without blind horizontal scrolling. |
| 5 — content and final QA | Reviewed image batch, empty/error/loading states, light/dark and public entry polish | Each displayed image has an allowed-use record; fallback remains intentional; screen-by-screen visual comparisons, contrast/focus tests, browser journeys and current build/lint/tests pass. |

Suggested implementation seams: `workspace-navigation.ts`, Sidebar/BottomNav/Navbar, `PortalPageHeader`, Card/Badge, `ProgressWorkspace`, Profile sections, Meals workspace, shared meal image/card components, Report reader/history, nutritionist queue/library, and Admin feature modules. Extract components by a real task boundary; do not duplicate health forms or create parallel sources of profile state.

Before implementation, prepare wireframes for Profile hub, Home, Meals/Library, Grocery, Review inspector and Admin Overview using the same real data fields. Approve the navigation and content order first, then apply the shared visual rules. This document supplies that plan; it does not authorize skipping functional checks or claim the proposed UI has already been built.
