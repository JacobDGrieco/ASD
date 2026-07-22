# Deployment

## Platform

The app is configured for Vercel with Vite output in `dist`.

Relevant `vercel.json` fields:

- `buildCommand`: `npm run build`
- `outputDirectory`: `dist`
- `framework`: `vite`
- `rewrites`: maps public routes to `index.html` and friendly API paths to Vercel Functions.

## Build

```sh
npm run build
```

The build only emits frontend assets. API handlers under `api/` are deployed as Vercel Functions.

## Routing

Public browser routes such as `/music`, `/artists/:path*`, `/fashion/:path*`, and `/admin/:path*` rewrite to `index.html` so React Router can resolve them.

Friendly API routes such as `/api/artists/:slug`, `/api/songs/:id`, and `/api/fashion/catalogue` rewrite to `api/public.js` with a `resource` query parameter.

Admin compatibility routes such as `/api/admin/fashion/talent` and `/api/admin/board` rewrite to consolidated handlers.

## Environment

Production requires the server-only variables documented in `docs/environment-variables.md`, especially:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `JWT_SECRET`
- `ADMIN_PASSWORD` or DB-backed accounts
- `BLOB_READ_WRITE_TOKEN`
- YouTube variables if Crosshair sync is used

## Database Changes

No migration directory is present in this checkout because the current database already represents the desired schema. If the project needs Prisma migration history for future production deploys, restore or recreate migrations from the current schema before relying on `prisma migrate deploy`.

Runtime capability checks in `src/lib/adminAccountSchema.js` were mainly for a single migration window. Remove them if code search confirms they are no longer needed by active application paths.

## Deploy Gating

`vercel.json` contains an `ignoreCommand` that depends on `VERCEL_GIT_COMMIT_MESSAGE` and `[deploy]`. The intended policy is that only commits with `[deploy]` trigger the official Vercel build, allowing normal commits and branch resets without immediately changing the public deployment.

## Post-Deploy Checks

- Public routes load without 404 after rewrites.
- `/api/artists` and `/api/fashion/catalogue` return JSON.
- Admin login works and sets `asd_admin_token`.
- Upload/import image flows work against Vercel Blob.
- Crosshair sync config reports expected availability if YouTube sync is configured.
