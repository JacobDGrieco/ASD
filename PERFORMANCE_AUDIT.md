# Performance Audit

Date: July 27, 2026

Scope: repository-wide read-only audit of the A.S.D. React/Vite site, Vercel Functions, Prisma/PostgreSQL database, public API loading, admin data access patterns, media/image/font assets, and SoundCloud-backed playback.

No application files were edited for this audit.

## Executive Summary

The site is not currently limited by database volume. The configured database is small: `Song` has 395 rows, `Album` has 202 rows, and the largest legacy table, `LyricBlock`, has 2,156 rows. The main performance risk is that the browser cold path asks Vercel Functions and PostgreSQL for large, uncached public JSON payloads, then hydrates a relatively large SPA bundle before users can interact with route content.

Highest-impact findings:

1. Public API responses are all sent with `Cache-Control: no-store` in `api/public.js`, so cold visitors and route reloads miss CDN/browser HTTP caching even for mostly-public catalogue data.
2. `/api/artists` is doing too much work for list/homepage use. Local handler measurement returned about `437 kB` JSON and took `774 ms` from this machine against the configured database.
3. The sitewide SoundCloud player pool is large for a click-triggered action. `/api/player-pool?type=sitewide` returned 311 playable tracks, about `172 kB` JSON, and took `498 ms`.
4. The initial client bundle is heavy for a public SPA. Production build output shows `index-*.js` at `616.49 kB` minified / `189.56 kB` gzip, plus `205.15 kB` CSS / `37.45 kB` gzip.
5. Two route hero images are multi-megabyte PNGs in the critical visual path: `music-tour-stage-backdrop` is about `2.01 MB`, and `fashion-runway-backdrop` is about `1.58 MB`.
6. `index.html` includes a blocking Termly script in the document head before the app script. That can delay first paint/hydration depending on third-party response time.
7. The database has good recent additive indexes for the current scale, but one integrity blocker remains: 3 duplicate `SongAlbum(albumId, discNumber, trackNumber)` groups still block a future unique constraint.

## Critical User Journeys

Public critical paths:

- `/`: portal entry, company/about preview, board preview.
- `/music`: artist splash, record-player tracks, latest releases, Crosshair preview, shuffle playback.
- `/artists/:slug`: artist hero, discography, featured appearances, player controls.
- `/albums/:id`: album details and track list.
- `/songs/:id`: song details, lyrics, annotations, streaming links.
- `/fashion`: fashion landing, catalogue and talent previews.
- `/fashion/catalogue`, `/fashion/collections/:slug`, `/fashion/looks/:slug`, `/fashion/talent/:slug`.
- `/board` and `/crosshair`.

Admin critical paths:

- `/admin/login`.
- Music CMS list/detail/edit pages for artists, albums, songs, lyrics, board, Crosshair, record-player slots.
- Fashion CMS list/detail/edit pages for talent, outside talent, looks, and collections.

Playback path:

Browser click or hover/focus/touch preloads SoundCloud widget API and `/api/player-pool`, then the global player renders a hidden SoundCloud iframe for transport.

## Measurement Environment And Limitations

Measurements were taken locally from the repository, using the configured database connection from `.env.local` through read-only Prisma queries. These are useful for relative bottleneck identification, but they are not production Web Vitals.

Limitations:

- No Playwright/browser-flow measurement was run because project instructions say not to use Playwright unless explicitly requested.
- No production Lighthouse, Real User Monitoring, Vercel traces, CDN logs, or database query plans were available.
- Local API handler timings include this machine's network path to the configured database, not necessarily Vercel-to-database latency.
- No load test was run, and no production traffic was touched.

Suggested performance budgets for review:

- Public route TTFB for cached API data: p75 under 150 ms from the deployment region.
- Public route TTFB for uncached database-backed JSON: p75 under 500 ms, p95 under 1,200 ms.
- Initial JS gzip for public shell: under 150 kB target, under 200 kB ceiling.
- Initial CSS gzip: under 50 kB.
- Largest above-the-fold image transfer: under 300 kB on mobile, under 600 kB on desktop.
- API payload for summary/list endpoints: under 100 kB uncompressed for common public routes.

## Current Observed Results

Production build:

```text
npm run build
vite v8.0.9
647 modules transformed
index-*.js: 616.49 kB minified, 189.56 kB gzip
index-*.css: 205.15 kB, 37.45 kB gzip
music-tour-stage-backdrop-*.png: 2,009.41 kB
fashion-runway-backdrop-*.png: 1,579.90 kB
Vite warning: some chunks are larger than 500 kB after minification
```

Read-only public API handler measurements:

| Endpoint/resource | Local handler time | JSON bytes | Items | Cache-Control |
|---|---:|---:|---:|---|
| `artists` | 774.4 ms | 437,254 | 6 | `no-store` |
| `recordPlayer` | 370.1 ms | 34,200 | 8 | `no-store` |
| `crosshair` | 51.9 ms | 4,885 | 6 | `no-store` |
| `playerPool-sitewide` | 498.1 ms | 171,841 | 311 | `no-store` |
| `fashionCatalogue` | 207.0 ms | 9,737 | 1 | `no-store` |
| `fashionTalentList` | 100.2 ms | 1,409 | 1 | `no-store` |
| `boardPosts` | 149.5 ms | 3,981 | 2 | `no-store` |
| `about` | 236.6 ms | 4,238 | n/a | `no-store` |
| `artist-detail` | 835.8 ms | 66,003 | n/a | `no-store` |
| `album-detail` | 375.4 ms | 4,062 | n/a | `no-store` |
| `song-detail` | 470.5 ms | 8,497 | n/a | `no-store` |
| `fashion-collection-detail` | 702.0 ms | 11,312 | n/a | `no-store` |
| `fashion-talent-detail` | 156.1 ms | 1,423 | n/a | `no-store` |

Database validation:

- Prisma schema is valid when `.env.local` database variables are loaded.
- Safe additive columns present: 4 rows.
- Planned indexes present: 7 rows.
- Normalized contributor-name backfill incomplete rows: 0.
- Duplicate normalized contributor names: 0 rows.
- Songs missing timestamps: 0.
- Multiple-primary-image report: 0 rows.
- Invalid fashion credit report: 0 rows.
- Duplicate album track-slot report: 3 rows.
- Legacy inventory: `LOOSE_LOOK` collections 0, `LyricBlock` rows 2,156, legacy `Annotation` rows 8.

Top database tables by current size:

| Table | Rows | Total KB | Table KB | Index KB |
|---|---:|---:|---:|---:|
| `Song` | 395 | 712 | 560 | 152 |
| `LyricBlock` | 2,156 | 568 | 304 | 264 |
| `Album` | 202 | 376 | 216 | 160 |
| `SongMeta` | 395 | 376 | 176 | 200 |
| `SongAlbum` | 397 | 320 | 56 | 264 |
| `AlbumImage` | 200 | 208 | 104 | 104 |
| `BoardPost` | 3 | 160 | 16 | 144 |

## Prioritized Bottlenecks

### 1. Public API Caching Is Disabled At The HTTP Layer

Symptom: Every public endpoint measured returned `Cache-Control: no-store`.

Location: `api/public.js`, `setPublicCache`.

Evidence: Handler measurement shows `no-store` for every public resource. The source confirms `setPublicCache(res)` sets only `no-store`.

Cause: Browser-side in-memory caching in `src/hooks/useApi.js` is the only active public data cache. It does not help first visits, hard reloads, new tabs, CDN edge cache, or multiple users requesting the same public catalogue data.

Why it matters: Cold page loads pay serverless startup, auth-preview check, Prisma query work, serialization, and database latency even for public data that changes infrequently.

Recommended correction: Split public cache policy by audience and resource:

- Anonymous public requests: use `s-maxage` and `stale-while-revalidate` for stable public data.
- Admin-preview requests: keep `private, no-store`.
- Release-sensitive music endpoints: use short TTLs and the existing release-boundary refresh logic, or schedule explicit invalidation/revalidation after release updates.

Expected benefit: Lower TTFB and lower database/serverless load for anonymous users. The benefit should be measured with production CDN cache-hit rate and p75/p95 API latency.

Risk: Medium. Needs clear freshness rules for release-day visibility and admin preview.

### 2. `/api/artists` Is Overloaded

Symptom: The public artists list endpoint is the largest measured payload: about `437 kB` JSON for only 6 public artists.

Location: `api/public.js`, `getArtists`; consumers include `MusicHomePage`, `ShelfPage`, `SideRails`, `MusicHomePreview`, and prefetch calls.

Evidence:

- Local handler measurement: `artists`, `774.4 ms`, `437,254` bytes.
- `getArtists` selects artist profile fields, all artist images, albums, album images, release links, and song placements in one list response.
- `MusicHomePage.jsx` calls `/api/artists` for homepage hero and latest-release data.
- `SideRails.jsx` also fetches `/api/artists` on music pages for decorative rail names.

Cause: One endpoint is acting as list, homepage feed, shelf data, and partial detail backing store. Summary consumers pay for album/song/image data they do not always need.

Why it matters: It delays the music homepage, increases JSON parsing cost, and duplicates work when detail routes later fetch artist/album/song endpoints.

Recommended correction:

- Add smaller public projections such as `artistsSummary`, `musicHome`, and `shelf`.
- Keep `/api/artists/:slug` as the detail-heavy endpoint.
- Make `SideRails` consume a tiny name-only endpoint or reuse already-loaded route data through a shared context.

Expected benefit: Likely largest API payload reduction. For the music homepage, a summary endpoint should target under 100 kB uncompressed.

Risk: Medium. Requires updating route consumers and preserving preview/release behavior.

### 3. Sitewide Player Pool Is Too Heavy For Playback Start

Symptom: The shuffle/play path can fetch 311 tracks and 172 kB of JSON before playback starts.

Location: `api/public.js`, `getSitewidePlayerPool`, `getPlayerPool`; `src/components/player/PlayButton.jsx`; `src/pages/MusicHomePage.jsx`; `src/lib/publicPrefetch.js`.

Evidence:

- Local handler measurement: `playerPool-sitewide`, `498.1 ms`, `171,841` bytes, 311 items.
- `MusicHomePage.jsx` schedules idle prefetch for the sitewide pool.
- `PlayButton.jsx` warms the pool on hover/focus/touch and then fetches it again through deduped cache if needed.

Cause: The pool response contains the full playable queue rather than a bounded initial queue or server-chosen shuffle seed/page.

Why it matters: Playback feels dependent on API latency and JSON parse time. It also warms cover images for several pool items, which is useful only if the user actually plays.

Recommended correction:

- Return an initial bounded pool page, for example 30-50 songs, with a continuation cursor or shuffle session token.
- For shuffle, let the server choose a random start and return the next window instead of shipping all 311 tracks.
- Keep album/artist pools full only when the bounded size is naturally small.

Expected benefit: Faster first playback and lower API payload. Measure click-to-audio-ready and player-pool byte size.

Risk: Medium. Queue semantics, next/previous behavior, and shuffle history must be preserved or intentionally changed.

### 4. Initial SPA Bundle Is Large For Public Pages

Symptom: The main public JS chunk is over Vite's 500 kB minified warning threshold.

Location: `src/main.jsx`, `src/App.jsx`, public route imports, shared providers, PrimeReact/CSS imports, Framer Motion, React Icons, route component boundaries.

Evidence:

- Build output: `index-*.js` 616.49 kB minified / 189.56 kB gzip.
- `src/App.jsx` lazy-loads admin pages but imports all public pages synchronously.
- `src/main.jsx` imports global PrimeReact CSS and PrimeIcons CSS for the whole app.
- `dist/index.html` modulepreloads `adminAuth` and `fa` chunks even for anonymous public visitors.

Cause: Public pages, shared player/admin providers, broad CSS, and icon dependencies sit on or near the initial route path.

Why it matters: Mobile users pay more JavaScript parse/execute cost before interaction. This is especially important because the app is client-rendered, so route content waits on JS.

Recommended correction:

- Lazy-load non-home public routes in `App.jsx`, not only admin routes.
- Move admin auth hydration and admin-only code behind admin route boundaries where possible.
- Replace broad icon package imports with narrower imports or local SVG/icon components where the bundle analyzer confirms benefit.
- Audit PrimeReact usage and import styles only where needed if practical.

Expected benefit: Lower initial JS transfer and execution. Verify with bundle output and browser main-thread profiling.

Risk: Low to medium. Route-level code splitting is safe if loading states and prefetch behavior are preserved.

### 5. Critical Images Are Large PNGs

Symptom: Public route backdrop assets are multi-megabyte PNG files.

Location: `src/assets/music-tour-stage-backdrop.png`, `src/assets/fashion-runway-backdrop.png`, `ArtistSplash.jsx`, fashion home/preview assets.

Evidence:

- `music-tour-stage-backdrop`: 2,009,413 bytes.
- `fashion-runway-backdrop`: 1,579,908 bytes.
- Build emits both as large static assets.

Cause: Large PNG format is used for photographic/illustrative backgrounds. No generated responsive variants are present.

Why it matters: These assets can dominate LCP or delay visual completeness on slower networks.

Recommended correction:

- Convert to AVIF/WebP plus fallback if needed.
- Generate responsive sizes and serve smaller mobile variants.
- Avoid eager preloading of offscreen/non-current preview images.

Expected benefit: Hundreds of KB to more than 1 MB reduction per route where these images load.

Risk: Low. Requires visual QA to avoid unacceptable quality loss.

### 6. Head Third-Party Script Can Block Startup

Symptom: Termly resource-blocker script is loaded synchronously in the document head.

Location: `index.html`.

Evidence: `index.html` includes `<script src="https://app.termly.io/resource-blocker/..."></script>` before the app module script.

Cause: No `async`, `defer`, consent-state gating, or post-hydration loading strategy is used in the document shell.

Why it matters: Third-party response time can block parsing and delay app boot. It can also affect Core Web Vitals variability.

Recommended correction: Confirm legal/compliance requirements, then move Termly to a non-blocking loading mode if allowed. If it must block, document that as a compliance budget and measure the cost.

Expected benefit: Better and less variable first paint/hydration timing if non-blocking is permitted.

Risk: Product/legal decision required.

## Database And API Findings

### Current Database Health

The current database is small and generally well-indexed for the observed scale. Recent additive indexes address many obvious access paths:

- normalized contributor lookup
- album release ordering per artist
- song metadata release dates
- roles JSONB containment
- active record-player position
- board-post public filtering

No read-only validation evidence showed missing backfills, duplicate normalized names, multiple-primary image conflicts, or invalid fashion credits.

### Remaining Integrity Risk: Duplicate Track Slots

Symptom: 3 duplicate album track-slot groups remain.

Location: `SongAlbum`.

Evidence: `docs/database/validation.sql` statement 6 returned 3 rows.

Cause: The schema has `@@unique([songId, albumId])`, but no uniqueness constraint for `(albumId, discNumber, trackNumber)`.

Why it matters: Public album/song ordering assumes track slots are meaningful. Duplicate slots can produce confusing order and block a future correctness constraint.

Recommended correction: Review and clean the 3 duplicate groups, then add a unique constraint or unique index on `(albumId, discNumber, trackNumber)` if the product rule is exactly one song per album/disc/track slot.

Risk: Medium because cleanup changes production data and needs explicit approval.

### Public Query Shape Risks

- `getArtists` fetches nested albums, images, and song placements for all artists. At current size this is slow enough to measure; at 10x catalogue size it will grow linearly.
- `getArtist` does a detail query plus a JSONB role scan for featured appearances. The JSONB GIN index helps, but it still scans all matching featured-role metadata and filters the target artist in application code.
- `getSitewidePlayerPool` loads all streamable songs and placements, then filters visibility and sorts in JavaScript.
- Fashion catalogue/detail query shapes are acceptable at current row counts, but `includePublicLook()` is deep and should be bounded or split before fashion data grows.
- Admin list endpoints are mostly unpaginated. That is acceptable for the current small CMS, but songs/albums/fashion looks should gain pagination or search-first loading before the catalogue grows substantially.

### Blob/Image Proxy Risk

`api/blob.js` proxies private blob reads for known pathnames. This audit did not benchmark blob latency. Performance risk is that pages with many proxied images can create many serverless/blob round trips rather than direct CDN-optimized image delivery.

Recommended correction: Measure image response headers and cache behavior in production. Prefer public-safe CDN URLs or cacheable signed/proxied reads with explicit privacy rules.

## Server And Rendering Findings

- The app is client-rendered; route HTML does not contain primary route content. SEO and first meaningful content depend on JavaScript fetching and rendering.
- Public route data is fetched after hydration through `useApi`, except for module-level prefetch calls in some pages.
- The homepage and music page have thoughtful skeletons/placeholders, but the critical content still depends on API response completion.
- Admin pages are lazily loaded, which is good. Public pages are mostly eager in the main bundle.
- `AdminProvider` is mounted for all routes and checks admin session client-side. Verify whether anonymous public visitors need this on first load; if not, it is a candidate for route-level deferral.

## Frontend And Asset Findings

- Initial JS gzip is just under 190 kB, before route data and third-party scripts.
- Initial CSS is broad: one `index-*.css` includes public and shared styles at 205 kB raw.
- Multiple local custom fonts are emitted. `font-display: swap` is present, which is good, but route-specific fonts still increase cache footprint.
- `primeicons` emits several font formats and an SVG asset. Modern deployments likely only need WOFF2 for real usage, but confirm CSS references before pruning.
- `react-icons/fa` is split into a 36 kB chunk, and `dist/index.html` preloads it for anonymous visitors.
- Above-the-fold artist images are often eager/high priority. This is appropriate for the visible cards, but current preloading also warms many artist/detail images in idle time; keep this constrained on mobile and low-end networks.

## SoundCloud Playback Findings

Strengths:

- `SoundCloudPlayer.jsx` loads `https://w.soundcloud.com/player/api.js` only once and dedupes with `widgetApiRequest`.
- Private SoundCloud share tokens are normalized for widget embedding.
- The hidden global player is mounted only when `currentSong?.soundcloudUrl` exists.
- Playback errors are surfaced to player state.

Risks:

- `preloadSoundCloudWidgetApi()` runs on hover/focus/touch and idle homepage work. This improves perceived playback but can load a third-party script for users who never play audio.
- Playback start can be bottlenecked by `/api/player-pool` payload size before the SoundCloud iframe is ready.
- SoundCloud iframe readiness has an 8 second timeout, but there is no measured click-to-audio-ready metric.

Recommended correction:

- Keep widget API preloading on explicit intent, but avoid early idle preload on constrained networks unless analytics show high play intent.
- Reduce player-pool size before changing SoundCloud widget behavior.
- Add lightweight client measurement events: `player_pool_fetch_start`, `player_pool_fetch_done`, `soundcloud_widget_ready`, `playback_start`, and `widget_error`.

## Caching Findings

Existing client cache:

- `src/lib/apiCache.js` provides module-level in-memory cache and in-flight request dedupe.
- `useApi` defaults to 5 minute freshness and can refresh at the release-day boundary.
- Admin preview cache keys are partitioned to avoid mixing hidden/unreleased public data with anonymous public data.

Missing cache layers:

- No CDN/shared cache for anonymous public API responses.
- No HTTP ETag or conditional request behavior.
- No server-side request-scoped dedupe beyond Prisma's internal behavior.
- No documented payload freshness policy by endpoint.

Recommended caching policy:

- Keep admin preview: `private, no-store`.
- `crosshair`, `fashionTalentList`, `fashionCatalogue`, `about`, `boardPosts`: short `s-maxage` such as 60-300 seconds with `stale-while-revalidate`, unless product needs instant publish/unpublish.
- `artists` and music detail/player endpoints: start with 30-120 seconds `s-maxage` plus release-boundary logic; longer after release scheduling is automated.
- Add `Vary: Cookie` or separate preview endpoint behavior if any cookie affects public response.

## Proposed Loading Strategy

Critical first load:

- Render shell, nav, first route hero, primary text, and first visible media with minimal JS and smallest needed data.
- For `/music`, fetch a dedicated `musicHome` payload with artist hero cards, latest release summaries, record-player summaries, and Crosshair summaries only.

Secondary:

- Full artist discographies, all album/song placements, and full player pools should load after initial content or on user intent.
- Decorative rails should use route data when available or a name-only endpoint.

Conditional/offscreen:

- Full lyrics/annotations only for song detail and player lyrics panel.
- Full SoundCloud widget script only on play intent or high-confidence pre-play interaction.
- Admin/editor code only under `/admin`.

Background:

- Image warmups should stay idle/bounded and adapt to connection quality where possible.
- YouTube sync remains an admin/manual background-type operation, not a public page dependency.

## Recommendations By Impact, Effort, And Risk

| Priority | Recommendation | Impact | Effort | Risk | Confidence |
|---|---|---:|---:|---:|---:|
| P0 | Add endpoint-specific public HTTP cache policy with admin-preview bypass | High | Medium | Medium | High |
| P0 | Split `/api/artists` into smaller summary/home/detail projections | High | Medium | Medium | High |
| P0 | Bound or page the sitewide player pool | High | Medium | Medium | High |
| P1 | Route-level lazy-load public pages and defer admin-only auth/code from anonymous shell | Medium | Medium | Low-Medium | Medium |
| P1 | Convert large PNG backdrops to responsive AVIF/WebP variants | Medium | Low-Medium | Low | High |
| P1 | Move or async/defer Termly if compliance allows | Medium | Low | Product/legal | Medium |
| P1 | Add lightweight API/server timing and player startup measurement | Medium | Low-Medium | Low | High |
| P2 | Add pagination/search-first loading to admin list endpoints before catalogue growth | Medium | Medium | Medium | Medium |
| P2 | Clean duplicate `SongAlbum` track slots and add future uniqueness constraint | Medium | Medium | Data-change | High |
| P2 | Evaluate direct/cacheable image delivery instead of private blob proxy for public images | Medium | Medium | Privacy/product | Medium |

## Implementation Plan

Stage 1: Measurement and visibility

- Add server timing around public API handlers and key Prisma calls.
- Add payload-size logging for public endpoints in non-sensitive aggregate form.
- Add client player startup timing events.
- Validate with production p75/p95 API timings and Web Vitals.
- Rollback: remove instrumentation only.

Stage 2: Public data cache policy

- Classify each public endpoint by freshness and privacy.
- Add anonymous cache headers while keeping admin preview private/no-store.
- Verify release-day visibility and admin-preview isolation.
- Rollback: restore `no-store`.

Stage 3: Public endpoint projection split

- Create smaller response shapes for `musicHome`, `artistsSummary`, `railNames`, and possibly `shelf`.
- Update consumers one route at a time.
- Measure `/music` and `/api/artists` bytes before and after.
- Rollback: route consumers back to existing endpoints.

Stage 4: Player pool redesign

- Add bounded sitewide pool response or cursor/session-based shuffle.
- Preserve current album/artist/song playback semantics.
- Measure click-to-audio-ready and pool payload bytes.
- Rollback: restore full pool path.

Stage 5: Bundle and asset reduction

- Lazy-load public routes.
- Review PrimeReact/icon imports and modulepreloads.
- Convert large route images to responsive formats.
- Verify build output and route visual behavior.
- Rollback: restore previous imports/assets.

Stage 6: Database cleanup and future constraints

- Review duplicate track-slot rows with product owner.
- Apply approved cleanup in a backup-tested migration/data fix.
- Add unique track-slot constraint only after validation is clean.
- Rollback: restore from backup or corrective migration.

## Questions Requiring Decisions

1. Public freshness: how quickly must a newly published/hidden artist, album, song, fashion look, board post, or Crosshair video appear or disappear for anonymous users? Recommended default: allow 60-300 seconds of staleness for public pages, with admin preview always uncached.
2. Release-day behavior: should release visibility be exact at America/New_York midnight for cached anonymous pages? Recommended default: use short TTLs plus scheduled invalidation/redeploy/revalidation for known release dates.
3. Player queue behavior: must shuffle include every streamable song immediately, or is a randomized window with continuation acceptable? Recommended default: return a 30-50 song window and lazily extend the queue.
4. Termly loading: is the current head-blocking script required for compliance before any page code runs? Recommended default: defer/async it if legal requirements permit.
5. Image privacy: can public-facing uploaded images be served through cacheable public URLs, or must they stay behind `/api/blob?pathname=`? Recommended default: public-safe CDN URLs for assets intentionally rendered on public pages.
6. Admin scale: what is the expected catalogue size over the next year? Recommended default: add pagination/search to admin songs/albums before thousands of rows.
7. Track-slot rule: is exactly one song per album/disc/track number a real business invariant? Recommended default: clean duplicates and enforce it once confirmed.

## Verification Plan

After each approved implementation stage:

- Run `npm run lint`.
- Run `npm run build`.
- Run `npm run check:api-entrypoints`.
- Run `npx prisma validate` with `.env.local` database variables loaded.
- Run `node scripts/database/run-validation-sql.js` for read-only database validation.
- Compare endpoint bytes and timings for `/api/artists`, `/api/record-player`, `/api/player-pool?type=sitewide`, `/api/crosshair`, `/api/fashion/catalogue`, and relevant detail endpoints.
- In production or preview, capture Web Vitals for `/`, `/music`, `/artists/:slug`, `/songs/:id`, `/fashion`, and `/fashion/catalogue`.
- For SoundCloud changes, measure click-to-player-pool, widget-ready, and playback-start timings.

## Commands Run

```text
npm run build
npx prisma validate
node scripts/database/run-validation-sql.js
npm run lint
npm run check:api-entrypoints
read-only aggregate table count/size query through Prisma
read-only local public API handler payload/timing measurements
```

Command outcomes:

- `npm run build`: passed; Vite warned about chunks over 500 kB.
- `npx prisma validate`: passed after loading `.env.local` variables.
- `node scripts/database/run-validation-sql.js`: passed after approved database connection.
- `npm run lint`: passed with 2 existing warnings:
  - `src/components/admin/AdminSongFormModal.jsx`: missing `focusedPart` effect dependency.
  - `src/components/home/ArtistSplash.jsx`: missing `clearTimers` effect dependency.
- `npm run check:api-entrypoints`: passed.

## Data And Environments Touched

- Application source: read only.
- Database: read-only validation, aggregate counts/sizes, and public API reads through existing Prisma queries.
- Production systems: no writes, no migrations, no load tests, no deploys.

## Residual Risks

- Real production Web Vitals may differ from local handler timings.
- CDN behavior cannot be confirmed until cache headers are changed and measured in a preview/production deployment.
- Query plans were not captured with `EXPLAIN`; current row counts are small enough that handler payload/query shape matters more than raw table size, but plans should be checked before adding indexes.
- The duplicate track-slot cleanup is a data-change project and needs explicit approval.
