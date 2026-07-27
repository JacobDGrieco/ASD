# Performance Implementation Report

Date: 2026-07-27

## Scope

This pass implemented the actionable items from `PERFORMANCE_AUDIT.md` using the follow-up decisions provided by the project owner.

Database migration and track-slot cleanup work from phase 6 was intentionally skipped so it can be handled separately by the database workflow.

## Changes Implemented

- Public API responses now use a shared-cache window for anonymous visitors:
  - `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600`
  - Admin preview requests remain `private, no-store`
  - `Vary: Cookie` is set to keep admin-preview responses separated from anonymous cache entries
- Release visibility now supports a configurable timezone:
  - Server: `RELEASE_VISIBILITY_TIME_ZONE`
  - Client build: `VITE_RELEASE_VISIBILITY_TIME_ZONE`
  - Default remains `America/New_York`
- Music home loading now uses a purpose-built public endpoint instead of fetching the full artists graph.
- Side-rail name loading now uses a compact `railNames` public endpoint instead of fetching full artist/talent payloads.
- Sitewide player startup now requests 30 songs first, then appends the remaining pool in the background when available.
- Route-level React lazy loading was added for public pages, reducing initial JavaScript.
- Termly loading is deferred and the public legal footer is hidden while legal routes/files remain available.
- Large PNG public backdrops were converted to WebP and public imports now use the lighter assets.
- Admin list page sizes for albums, songs, fashion collections, and fashion looks are now 15 items per page.

## Local Measurements

Measured by invoking `api/public.js` directly with the local environment and configured database.

| Endpoint | Status | Duration | Payload | Count | Cache |
|---|---:|---:|---:|---|---|
| `musicHome` | 200 | 835.4 ms | 29,127 bytes | 6 artists, 8 releases | public / 300s shared |
| `railNames` music | 200 | 52.3 ms | 515 bytes | 6 | public / 300s shared |
| `railNames` fashion | 200 | 59.0 ms | 70 bytes | 1 | public / 300s shared |
| `playerPool` sitewide initial | 200 | 567.9 ms | 16,230 bytes | 30 songs | public / 300s shared |
| `playerPool` sitewide remainder | 200 | 271.9 ms | 155,807 bytes | 281 songs | public / 300s shared |
| `artists` full reference | 200 | 449.2 ms | 437,254 bytes | 6 artists | public / 300s shared |

Build output changed substantially after route splitting and asset conversion:

| Asset | Before | After |
|---|---:|---:|
| Main JS bundle | 616.49 kB / 189.56 kB gzip | 245.20 kB / 75.78 kB gzip |
| Main CSS bundle | 205.15 kB / 37.45 kB gzip | 62.18 kB / 12.36 kB gzip |
| Music backdrop | 2,009,413 byte PNG | 141,550 byte WebP |
| Fashion backdrop | 1,579,908 byte PNG | 54,964 byte WebP |

## Validation

- `npm run lint`
  - Passed
  - Existing warnings remain:
    - `src/components/admin/AdminSongFormModal.jsx`: missing `focusedPart` hook dependency
    - `src/components/home/ArtistSplash.jsx`: missing `clearTimers` hook dependency
- `npm run check:api-entrypoints`
  - Passed
- `npx prisma validate`
  - Passed
- `npm run build`
  - Passed

## Remaining Risks And Follow-Ups

- Admin collection/look pagination is currently client-side pagination. This satisfies the 15-item UI page size, but server-side admin API pagination would still be useful once those datasets are large enough for admin payload size to matter.
- Full public `artists` remains available for pages that need artist detail data. The home page and side rails no longer depend on that heavier response.
- The sitewide player still needs one larger background request to hydrate the remaining pool. Startup is lighter, but the total music payload is unchanged once the background load completes.
- Existing public image records were not rewritten in the database. The app now uses direct public asset URLs for the changed home backdrops, and upload URL behavior should be audited separately before any data rewrite.
- Phase 6 database cleanup was not implemented by request.
