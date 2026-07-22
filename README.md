# A.S.D.

A.S.D. is a React/Vite site for a music label and companion fashion vertical, backed by a shared admin CMS. Public routes are rendered in the browser, while data is served by Vercel Functions in `api/` using Prisma and PostgreSQL.

## Main Features

- Music portal with artists, albums, songs, lyrics, credits, release links, The Board, The Crosshair, and a SoundCloud-backed player.
- Fashion portal with talent profiles, catalogue collections, looks, pieces, galleries, and credits.
- Admin CMS for music, board posts, Crosshair videos, record-player slots, company profile content, fashion talent, looks, collections, and login accounts.
- Vercel Blob image uploads with private-blob proxy reads and best-effort cleanup of unused managed blobs.
- YouTube channel sync for Crosshair videos.

## Technology Stack

- Frontend: React 19, React Router 7, Vite, PrimeReact, Framer Motion, Tiptap, DOMPurify.
- API: Vercel Functions under `api/`.
- Data: Prisma ORM with PostgreSQL, schema in `prisma/schema.prisma`.
- Storage: Vercel Blob through `@vercel/blob`.
- Auth: JWT admin sessions in an HttpOnly cookie, with `ADMIN_PASSWORD` and DB-backed artist/talent accounts.
- Analytics: Vercel Analytics.

## Requirements

- Node.js and npm.
- A PostgreSQL database reachable through `DATABASE_URL`.
- Vercel Blob credentials for image upload/delete behavior.
- `JWT_SECRET` for admin session signing.
- Optional YouTube API/OAuth credentials for Crosshair sync.

## Setup

```sh
npm install
npm run db:generate
```

Create `.env.local` with the required values described in `docs/environment-variables.md`. Do not commit real secrets.

## Local Development

Use Vite only when you do not need serverless routes:

```sh
npm run dev
```

Use Vercel local dev for pages that call `/api/*`, including the homepage, admin CMS, public data pages, uploads, and preview behavior:

```sh
npm run dev:vercel
```

`npm run dev:vercel:host` starts Vercel dev on `0.0.0.0:3000` for LAN/device testing.

## Scripts

- `npm run dev`: Vite dev server.
- `npm run dev:vercel`: full-stack local Vercel dev.
- `npm run dev:vercel:host`: Vercel dev listening on all interfaces.
- `npm run build`: production frontend build.
- `npm run preview`: preview the built Vite app.
- `npm run lint`: ESLint.
- `npm run check:api-entrypoints`: static import check for Vercel API handlers.
- `npm run db:generate`: generate Prisma client.
- `npm run db:migrate`: run Prisma migrate dev.
- `npm run db:push`: push Prisma schema to the database.
- `npm run doctor`: run React Doctor.

Prisma also has a seed command configured as `node prisma/seed.js`, but there is no npm `db:seed` script in this checkout.

## Project Structure

- `src/App.jsx`: route map and provider composition.
- `src/pages/`: public and admin route components.
- `src/components/`: public UI, admin form fields, player, board, music, and fashion components.
- `src/lib/`: auth, permissions, data formatting, caching, visibility, player state, blob cleanup, and integration helpers.
- `src/hooks/`: app hooks such as `useApi`.
- `api/`: Vercel Function handlers.
- `prisma/`: database schema and seed script.
- `scripts/`: operational scripts.
- `public/`: static assets and legal HTML.
- `docs/`: architecture, API, environment, data-model, deployment, and troubleshooting docs.

## Documentation

- `docs/architecture.md`
- `docs/project-structure.md`
- `docs/application-flows.md`
- `docs/environment-variables.md`
- `docs/development.md`
- `docs/deployment.md`
- `docs/data-model.md`
- `docs/api.md`
- `docs/authentication-and-permissions.md`
- `docs/external-integrations.md`
- `docs/troubleshooting.md`
- `FUTURE_FIXES.md`

The initial audit is in `DOCUMENTATION_AUDIT.md`.

## Known Limitations

- No automated test suite is present in this checkout.
- `prisma/migrations/` is not present, so the production database migration workflow needs explicit operator confirmation before schema changes.
- `api/admin/login.js` has no application-level rate limiting.
- `api/blob.js` serves private blobs without auth when the pathname is known so public pages can render uploaded images; hardening this is tracked in `FUTURE_FIXES.md`.
- Several client calls still build inert `Authorization: Bearer cookie` headers while real auth comes from the HttpOnly cookie.
