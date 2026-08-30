# NutriMind production operations runbook

## Release gate

1. Use Node 24 and npm 11.
2. Configure every backend value documented in `backend/.env.example`; never place secrets in the frontend environment.
3. Obtain the clinical sign-off recorded in `CLINICAL_POLICY_APPROVAL.md` and set `CLINICAL_POLICY_APPROVED_VERSION` to the exact signed version.
4. Run `npm ci`, `npm test`, `npm run build`, `npm run preflight:data-integrity`, and `npm run test:integration:production` in `backend`.
5. Run `npm ci`, `npm run lint`, and `npm run build` in `frontend`.
6. Back up the database, run `npx prisma migrate deploy` once, then start the API with `npm start`.
7. Verify `/health` (process alive), `/ready` (database reachable), login for every role, the nutritionist review queue, one non-mutating library browse, and the admin operations panel.

Do not deploy if the production configuration gate, clinical policy gate, migration, readiness probe, or smoke test fails.

## Database backup and restore

- Enable the managed PostgreSQL provider's point-in-time recovery and daily snapshots. Retain at least 30 days for production.
- Before every migration, create a named restore point and record its timestamp with the release identifier.
- Test restoration into an isolated database at least quarterly. Run `npm run preflight:data-integrity` against the restored copy before declaring the drill successful.
- Never test a restore over the live database. Rollback means restoring into a new database, validating it, then changing the application connection under an approved incident procedure.

## Monitoring and alerts

Poll `/health` and `/ready` every minute. Alert when readiness fails twice, any generation job is stuck for 20 minutes, a review is overdue for two hours, a plan starts within 48 hours while pending, an RND license expires, or AI failures rise above the team's agreed threshold. The admin overview exposes these queues without storing prompts or patient health details in telemetry.

Application logs are JSON and include request IDs. Do not add passwords, tokens, full prompts, medical-condition text, or meal-plan contents to logs. Retain access logs according to the project's privacy policy.

## Scheduler

Invoke only the authenticated `/api/cron/*` routes over HTTPS with `CRON_SECRET`. Use the shopping-day preparation rules already implemented; do not run multiple schedulers against the same environment. Generation jobs have a database uniqueness guard, but duplicate scheduler ownership is still an operational defect.

## Security and secrets

- Rotate `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CRON_SECRET`, database credentials, Gemini, Google OAuth, and SMTP credentials before a public deployment and after any exposure.
- Rotating refresh-token signing material signs all users out. Announce this when feasible.
- Restrict CORS to exact HTTPS frontend origins and configure `TRUST_PROXY` only when the reverse-proxy topology is known.
- Use an email-provider credential scoped to mail sending, not a personal mailbox password.

## Incident response

1. Suspend affected accounts from Admin; this revokes their sessions.
2. Preserve relevant audit events and request IDs without copying medical data into tickets.
3. Disable the affected integration or scheduler, rotate exposed credentials, and confirm `/ready`.
4. Review pending meal-library flags and invalidate reusable evidence when ingredient or declaration safety is in doubt.
5. Restore from a validated snapshot only if data integrity is compromised.
6. Document the root cause, affected period, user impact, and preventive action.

## Privacy requests

Users can export their application data as JSON and permanently delete their account after password and phrase confirmation. Administrative database exports are not a substitute for the user-facing export. Test both flows before launch and document any legally required retention exception before implementing it.

