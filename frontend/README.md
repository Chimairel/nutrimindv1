# NutriMind Frontend

This package is the Next.js 14 App Router frontend for NutriMind. It is not a standalone full-stack application: it communicates with the separate Express API in `../backend` through the shared Axios client.

For architecture, complete setup, environment-variable names, verification commands, and known limitations, start with the [repository contributor guide](../README.md). The [engineering record](../docs/NUTRIMIND_ENGINEERING_RECORD.md) is the canonical current evidence source.

## Local development

Configure `frontend/.env.local` without committing it:

```text
NEXT_PUBLIC_API_URL=<browser-visible API base URL>
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<browser-visible Google OAuth client ID>
```

Then run:

```powershell
npm install
npm run dev
```

The frontend defaults to `http://localhost:3000`. When `NEXT_PUBLIC_API_URL` is absent, API requests default to `http://localhost:5000/api`.

## Static verification

```powershell
npx tsc --noEmit --incremental false
npm run lint
npm run build
```

As of August 30, 2026, all three commands pass, although lint reports warnings. Repository CI runs lint and a production build for this package. Static checks do not establish runtime, integration, E2E, deployment, accessibility, or clinical verification.

## Main folders

- `src/app`: route groups, layouts, and pages
- `src/components`: shared and domain UI components
- `src/hooks`: profile, meal, notification, and auth hooks
- `src/lib`: Axios, client auth helpers, and React contexts
- `src/types`: frontend domain contracts
- `public`: manifest and icons; no service worker/offline implementation is currently present
