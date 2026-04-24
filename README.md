# ASD Music Promo Site

React + Vite frontend with Vercel Functions in `api/` and Prisma-backed data access.

## Development

- `npm run dev`: frontend-only Vite dev server
- `npm run dev:vercel`: full-stack local dev with the React app and Vercel API routes
- `npm run build`: production frontend build
- `npm run test:run`: run the test suite

Use `npm run dev:vercel` for any page that depends on `/api/*` routes, including the homepage.

## Deployment Notes

- Vercel Hobby limits function count per deployment, not across all of your projects.
- Only deployable runtime handlers should live under `api/`.
- API tests live in `src/test/api/` so they do not get counted as Vercel Functions.
