# Project Structure

## Root Files

- `package.json`: npm scripts, dependencies, Prisma seed command.
- `vite.config.js`: React plugin and `/api` dev proxy for Vite-only development.
- `vercel.json`: production build config and rewrites for public routes, admin routes, and API compatibility paths.
- `eslint.config.js`: ESLint flat config for JavaScript and JSX.
- `.editorconfig` and `.prettierrc`: tab-based formatting defaults.
- `DOCUMENTATION_AUDIT.md`: initial audit findings and clarification questions.
- `FUTURE_FIXES.md`: follow-up fix backlog from the documentation pass.

## `api/`

Vercel Function handlers. Only deployable runtime handlers should live here.

- `api/public.js`: public resource multiplexer for music, board, about, player, Crosshair, and fashion data.
- `api/blob.js`: private Vercel Blob read proxy by pathname.
- `api/admin/*.js`: admin CMS endpoints. Each handler authenticates with `src/lib/auth.js` and applies its own role/page checks.

## `src/`

Application source.

- `src/main.jsx`: React root, router, global CSS imports, and Vercel Analytics.
- `src/App.jsx`: route tree, public/admin layout composition, page-access guards, lazy admin pages, preview exit control.
- `src/hooks/`: React hooks. `useApi.js` is the public data fetch/cache hook.
- `src/lib/`: shared app logic. This directory contains code that runs in browser, server, or both, depending on imports.
- `src/pages/`: route-level components for public pages and admin CMS pages.
- `src/components/`: reusable UI components grouped by domain.
- `src/styles/`: feature-specific CSS files.
- `src/assets/`: bundled images and starter SVGs.
- `src/generated/prisma/`: generated Prisma client output. Do not edit or document as handwritten code.

## `src/lib/`

Important modules:

- `auth.js`: server-side admin JWT/cookie auth, role helpers, scoped Prisma filters.
- `adminAuth.jsx`: client-side admin session context.
- `adminPageAccess.js`: admin page keys, route destinations, and page-access defaults.
- `adminResourceCache.js`: client-side admin GET cache with 401 redirect behavior.
- `apiCache.js`: client-side public GET cache and in-flight request dedupe.
- `contentVisibility.js` and `releaseSchedule.js`: release visibility business rules.
- `images.js`: image normalization, legacy-image bridging, and private blob proxy URL resolution.
- `blobCleanup.js`: best-effort deletion of unused managed Vercel Blob pathnames.
- `profileLinks.js`: bridge between legacy per-platform columns and `links` JSON arrays.
- `playerContext.jsx`: global SoundCloud-backed player state.
- `boardMarkdown.js` and `boardPosition.js`: board body rendering/validation and board layout.
- `youtubeChannelSync.js`: YouTube channel import for Crosshair.

## `src/pages/`

Public pages map directly to routes in `src/App.jsx`. Admin pages under `src/pages/admin/` are large orchestration components for forms, tables, cached loads, validation, and writes to `api/admin/*`.

Admin pages should keep API contract assumptions close to the form logic. Extract shared behavior into `src/lib/` or `src/components/admin/` only when the behavior is genuinely shared.

## `src/components/`

- `components/admin/`: form controls and admin layout widgets.
- `components/artist/`, `components/album/`, `components/song/`: music display components.
- `components/board/`: public board canvas/card/detail UI.
- `components/fashion/`: fashion cards and catalogue grid.
- `components/home/`: portal and music/fashion homepage previews.
- `components/player/`: global player UI.
- `components/shared/`: nav, media embeds, artwork galleries, rails, title handling, and footer.

## `prisma/`

- `schema.prisma`: complete Prisma schema.
- `seed.js`: seed script configured in `package.json` as Prisma's seed command.

There is no `prisma/migrations/` directory in this checkout. Confirm the intended migration workflow before changing production schema.

## `scripts/`

- `vercel-api-entrypoints.js`: statically imports Vercel API handlers for route-graph visibility and code-health tooling.
- `sync-single-release-fields.js`: manual data synchronization/repair script for single-release links and roles. Run with `--dry-run` first.

## `public/`

Static assets and legal HTML. `LegalPage.jsx` loads `public/legal/terms-of-service.html` and `public/legal/privacy-policy.html`. Those static HTML files are the editable legal-copy source in this repository.

## `fonts/`

Custom font binaries used by the CSS. The current font files were downloaded for free through DaFont.com; record explicit license notes here or in `FUTURE_FIXES.md` if redistribution requirements need to be tracked.
