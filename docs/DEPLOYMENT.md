# NutriMind deployment runbook

This runbook packages the existing Next.js and Express applications. It does not bypass the clinical-policy production gate, change the database, or enable PayMongo automatically.

## Build and verify images

From the repository root:

```bash
docker build -t nutrimind-api:local ./backend
docker build --build-arg NEXT_PUBLIC_API_URL=https://your-domain.example/api -t nutrimind-web:local ./frontend
```

Run `npm run check` before publishing images. CI performs the same source gates and builds both Dockerfiles without pushing them.

## VPS prerequisites

- Docker Engine with the Compose plugin
- A private `/etc/nutrimind/backend.env` readable only by the deployment account
- A domain whose DNS points to the VPS
- Host Nginx or Caddy terminating HTTPS and proxying `/api` to `127.0.0.1:5000` and other traffic to `127.0.0.1:3000`
- Container images published under immutable SHA-256 digests

Start from [`backend/.env.example`](../backend/.env.example). Production startup intentionally fails unless all required secrets, exact CORS origins, and the approved clinical-policy version are present. Keep PayMongo in TEST and its feature flags disabled until its separate release checklist passes.

## Release

Record both the new and previous image digests. Then export only immutable references:

```bash
export NUTRIMIND_API_IMAGE='registry.example/nutrimind-api@sha256:...'
export NUTRIMIND_WEB_IMAGE='registry.example/nutrimind-web@sha256:...'
export NUTRIMIND_BACKEND_ENV_FILE='/etc/nutrimind/backend.env'
bash deploy/deploy.sh
```

The script validates the Compose file, pulls exact images, runs `prisma migrate deploy`, starts the services, and requires both readiness checks to pass. It never runs `prisma db push`, resets data, or seeds production.

## Rollback

Set `NUTRIMIND_API_IMAGE` and `NUTRIMIND_WEB_IMAGE` to the previously recorded digests and rerun `bash deploy/deploy.sh`. Database rollback is deliberately not automated: migrations must be backward-compatible with the preceding application release. If a migration is not backward-compatible, stop and prepare a reviewed forward repair migration.

## TLS proxy boundary

Only loopback ports 3000 and 5000 are published by the production Compose file. Expose HTTPS through the host proxy, redirect HTTP to HTTPS, preserve `X-Forwarded-Proto` and `X-Request-ID`, and set `TRUST_PROXY=true` only in that topology.
