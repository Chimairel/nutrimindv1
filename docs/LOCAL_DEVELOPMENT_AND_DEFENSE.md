# Local development and defense rehearsal

## Database target

The target is `kainara_local_development@127.0.0.1:55432`, owned by Docker Compose project `kainara-local-development` and container `kainara-local-postgres`. Its named volume persists across stops. PostgreSQL is bound only to loopback. The helper never uses a hosted `DATABASE_URL` for restoration, backup or migrations.

Neon remains the hosted database. Switching the local API changes only the ignored `backend/.env` database setting. The previous environment is saved privately under `backend/.local/local-development/backend-before-local.env`. Never commit that file, local credentials or database archives.

The available verified archive was captured October 10, 2026 at 2 PM Philippine time. It predates subsequent records and newer test accounts. Restoration creates a historical local copy; it does not reconstruct later changes or modify Neon. Confirm the target and archive before restoration/migrations. A refreshed copy after Neon recovers requires a separate intentional import into a fresh target.

## Setup

From the repository root:

```powershell
npm run local-db:up
npm run local-db:status
```

The helper generates a random password in ignored `backend/.local/local-development/postgres.env`. Preserve it with backups. It refuses an existing volume whose credentials are missing.

After confirming the target:

```powershell
npm run local-db:restore -- --confirm-target=kainara_local_development@127.0.0.1:55432 --archive=backend/.local/backups/clarification-rollout-20261010/development-before-rollout.dump --manifest=backend/.local/backups/clarification-rollout-20261010/manifest.json
npm run local-db:migrate -- --confirm-target=kainara_local_development@127.0.0.1:55432
npm run local-db:use -- --confirm-target=kainara_local_development@127.0.0.1:55432
```

Restoration checks the archive checksum and refuses existing public tables. It never drops or overwrites data. Current migrations are applied to this local copy using `migrate deploy`. The API switch requires the checked-in migration set and saves the previous environment privately for rollback.

Start ordinary applications in separate terminals:

```powershell
npm run dev:backend
npm run dev:frontend
```

Retain an already running frontend on port 3000. Avoid duplicate servers. The older `docker:up` command packages the applications using their configured database; `local-db:up` starts this local PostgreSQL service specifically.

## Daily development

Local database operations consume no Neon quota. Local changes are separate from hosted data, with no automatic synchronization. When finished, stop the application processes, then run:

```powershell
npm run local-db:stop
```

Data and volume are retained. Resume with `local-db:up`. Do not discard the volume without an intentional decision and a verified backup.

## Defense rehearsal

1. Rehearse the exact application revision intended for presentation. Keep production build output separate from development output.
2. Check both `http://localhost:5000/health` and `/ready` return 200. Only the latter checks a database read.
3. Use marked synthetic member, RND and admin accounts. Create missing accounts on this local target through the existing admin UI or guarded CLI; keep credentials private.
4. Rehearse member guidance/meal screens, RND review/canvas, and admin audit/catalogue. Make review decisions only on synthetic cases.
5. Run `npm run local-db:backup`. Preserve its manifest and rehearse a restore into a separate disposable database before relying on it.
6. Test restarting Docker/PostgreSQL and the API. Keep Docker Desktop running and the laptop powered on presentation day.
7. Gemini, email, Google login, remote images and hosted media still need their external services. Local PostgreSQL is not a fully offline application.

The existing restore drill runs from `backend`:

```powershell
npm run test:acceptance:capstone-restore -- --archive=.local/backups/YOUR-ARCHIVE.dump --manifest=.local/backups/YOUR-ARCHIVE.dump.manifest.json --application-smoke=true
```

It restores into a separate temporary database, applies migrations, checks constraints/history and runs a bounded API smoke. It does not replace persistent local development. This is separate from full browser verification.

## Hosted idle work

The meal preparation worker has one non-overlapping timer. New/retried work wakes it immediately. Processed days continue every 30 seconds; persisted future retries retain their schedule. Empty queues and failures wait up to 15 minutes before reconciliation. Existing lease and per-day generation rules remain. Idle orphan-gap recovery can therefore take up to 15 minutes instead of five.

Enabled push reminders retain their 30-second timing and may keep hosted compute active. Browser polling, external jobs, multiple API instances and database-reading readiness probes also consume quota. Local development is the primary saving; adaptive meal polling alone does not guarantee hosted scale-to-zero.

The optional `deploy/compose.production.yaml` currently reads `/ready` every 15 seconds. That continuous database monitoring can keep Neon active if this deployment profile is used. The ordinary backend Dockerfile uses `/health` for recurring liveness. Check `/ready` explicitly before presentation/deployment; avoid adding frequent database-reading uptime probes to a free-tier setup. This local setup does not alter deployed health-check policies.

## Recovery

Start Docker Desktop, run `local-db:up`, then restart the API. Failed restores preserve the archive and partial target for inspection; never rerun over existing tables. When intentionally returning to Neon, take only its previous `DATABASE_URL` from the private rollback file, preserving newer settings, and verify the hosted target/readiness first.
