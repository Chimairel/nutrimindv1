# UI redesign delivery — September 13, 2026

Implements the current-code UI audit and the user's approved navigation and presentation direction. The forest-green, lime and mint theme is retained. This record describes implemented work and verification, not clinical certification.

## Delivered

- **Shared layout:** compact headers, opaque cards, quieter canvas, responsive controls and grouped role navigation. Mobile primary navigation contains five User destinations, four Nutritionist destinations and five Admin destinations, with the remaining Admin tools under More.
- **User:** Profile is a hub for Personal details, Health & goals, Food & planning, Membership, and Security & privacy. The old `/health-profile` URL redirects to `/profile/health`. Existing forms and submission handlers are reused. Progress links to saved report history. Current reports show their version/date and hide acknowledgement controls once acknowledged.
- **Home and meals:** a distinct dark intake card, clearer meal rows and status treatments, compact plan information, and a separate Plan options disclosure for whole-plan replacement. Day totals say Planned rather than Target. Swap previews identify both meals, distinguish the calorie change from the daily target, and show only additional shopping needs while retaining recorded purchases.
- **Groceries:** bought/to-buy language, visible purchased and required quantities, partial-purchase editing, fewer counters and cost evidence below the list. At 390 × 844 the fixture's first ingredient appeared above the bottom navigation.
- **Nutritionist:** Meal plans, Outside meals and Approved reviews share local navigation. Recipes appear first in the library; serving coverage has its own tab. Revalidation is visibly flagged before decisions, with ingredient quantities included. Unsupported zero ratings were removed and a bounded public profile preview added.
- **Admin:** attention signals precede secondary metrics; sidebar destinations are grouped; account records have mobile cards using the existing access dialog. Legacy textual application availability no longer crashes rendering, and completed applications are collapsed. Operations places pending incidents first; compensation policy/period creation forms are secondary. FNRI help text reflects audited composition correction support.
- **Public entry and imagery:** shorter mobile authentication/application introductions; no email separator when Google sign-in is not configured. Existing reviewed images and attribution remain intact. Category illustrations have light/dark colors and concise disclosure without repeating meal titles. No new external photographs were scraped or licensed during this change.

## Verification

- Root `npm run check`: architecture limit, formatting, both linters, deterministic tests and both production builds. Backend: 519 passed, zero failed, one previously documented clinical-policy TODO. Frontend: 78 passed.
- In-app browser: 32 routes checked at 320, 390, 768 and 1440 px using task-owned synthetic accounts and PostgreSQL. Final portal checks showed no document or main-container horizontal overflow. Public authentication glows and landing decoration extend their internal bounds but are clipped by their containers; this is recorded separately from portal overflow.
- User interaction: library swap preserved 300 g purchased against 450 g needed, displaying 150 g remaining. Editing the purchased total to 400 g displayed 50 g remaining. Report acknowledgement remained hidden for the acknowledged version; legacy health navigation redirected correctly.
- Professional interaction: selected a revalidation-required meal, obtained the normal review claim, and inspected current restrictions, ingredient quantity and decision controls. Coverage tab and approved-review archive loaded. No inappropriate approval was submitted.
- Admin interaction: applications, completed records, mobile account controls, data, images, analytics, operations, compensation and More loaded. No real account access, publication, payment or messaging action was performed.
- Light/dark visual checks covered Home and Admin Overview. Existing keyboard tests for meal actions and role tools passed. The tracker foreground contrast against its lightest gradient endpoint is 8.50:1 for primary text and 5.23:1 for muted text. This is not a full WCAG conformance audit.
- A transient Next.js development manifest error during hot reload was resolved by restarting only the worktree's preview. Production builds completed successfully.

## Scope and preview

Preview: `http://127.0.0.1:3002`, with the isolated API on loopback 5012 and the existing task-owned PostgreSQL container on 55463. This is the `codex/frontend-polish` worktree, not a guarantee that another IDE checkout on port 3000 includes these changes.

The backend change is a review-response presentation correction: stale triage is projected as requiring review and ingredient quantities are returned. Approval rules, authentication, quotas and database schema were not relaxed. Live Gemini, Google OAuth, SMTP, payments, production scheduling, complete image/price coverage and external clinical sign-off remain outside this local UI verification. New backend-dependent drilldowns and trend analytics described as future work in the audit are not fabricated here.

Evidence: [responsive measurements and screenshots](verification/ui-redesign-2026-09-13/README.md). The original [UI audit](UI_UX_AUDIT_AND_REDESIGN_PLAN_2026-09-10.md) remains the design rationale.
