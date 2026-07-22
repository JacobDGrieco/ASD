# Application Flows

## Public Page Load

1. `src/main.jsx` mounts `App` inside `BrowserRouter`.
2. `src/App.jsx` matches the route and renders the public page under `PublicLayout`.
3. The page calls `useApi` from `src/hooks/useApi.js`.
4. `useApi` checks `src/lib/apiCache.js`, then fetches the public `/api/*` endpoint.
5. `vercel.json` rewrites friendly API paths to `api/public.js?resource=...`.
6. `api/public.js` queries Prisma, applies visibility rules, formats images/links/credits, and returns JSON.

## Admin Login

1. `AdminLoginPage.jsx` calls `login` from `src/lib/adminAuth.jsx`.
2. `login` posts the password to `api/admin/login.js`.
3. The route checks `ADMIN_PASSWORD`, active `ArtistAdminAccess` rows, then active `FashionTalentAdminAccess` rows.
4. A matching account is signed with `signToken` from `src/lib/auth.js`.
5. The route sets the HttpOnly `asd_admin_token` cookie and returns session metadata.
6. `AdminProvider` stores the session and a local marker, then admin routes can render.

No application-level login rate limiting is implemented.

## Admin Route Access

1. `src/App.jsx` wraps `/admin/*` routes in `AdminRoute`.
2. Page routes use `AdminSuperRoute` or `AdminPageAccessRoute` where appropriate.
3. `src/lib/adminPageAccess.js` determines whether the route appears accessible.
4. Every admin API still enforces permissions server-side through `requireAdmin`, `requireSuperAdmin`, and endpoint-specific checks.

## Admin Data Load and Mutation

1. Admin pages read the session from `useAdminAuth`.
2. List/detail GETs usually call `loadAdminResource` from `src/lib/adminResourceCache.js`.
3. Writes use direct `fetch` calls to `api/admin/*.js`.
4. The endpoint authenticates, validates input, performs Prisma writes, and returns a formatted model.
5. Pages update local state or prime/clear admin caches after successful writes.

## Release Visibility

1. Admin forms choose `isVisible` and `autoShowOnRelease` directly or derive defaults with `normalizeVisibilityInput`.
2. Public reads call `isEffectivelyVisible` or equivalent helpers through `api/public.js`.
3. `isReleasedOnUtcDay` uses the America/New_York day boundary from `src/lib/releaseSchedule.js`.
4. `api/admin/albums.js` and `api/admin/songs.js` lazily update stale rows whose auto-show date has passed.

## Music Release Save

1. Album forms in `AdminMusicAlbumsPage.jsx` write to `api/admin/albums.js`.
2. Song forms in `AdminSongFormModal.jsx` write through `api/admin/songs.js`.
3. Album/song endpoints normalize images, profile links, visibility, role credits, and placements.
4. Duplicate checks happen in application code, not database constraints.
5. `SINGLE` albums share release-level links and roles with placed songs through `syncSingleSongsFromAlbum` and `syncSingleAlbumsFromSong`.

## Lyrics and Annotation Editing

1. `AdminMusicLyricsPage.jsx` loads song lyric data from `api/admin/lyrics.js`.
2. If no `SongLyric` row exists, the API returns a blank editable payload instead of 404.
3. Text and synced lines are saved by `PUT /api/admin/lyrics?songId=...`.
4. Annotation ranges are created, replaced, or deleted through `api/admin/annotations.js`.
5. Public song pages render the saved lyric and annotation payload through `LyricsView.jsx`.

## Board Post Lifecycle

1. Admin board UI writes through `/api/admin/board`, rewritten to `api/admin/artists?resource=board`.
2. `src/lib/adminBoardHandler.js` validates title, headline, body markdown limits, and artist ownership.
3. Publishing past the active public cap auto-archives the oldest active post.
4. Public board data is served by `api/public.js?resource=boardPosts`.
5. `src/lib/boardPosition.js` lays out pinned and unpinned posts.
6. `src/lib/boardMarkdown.js` renders the markdown subset, and `BoardCardDetail.jsx` sanitizes before display.

## Image Upload and Cleanup

1. Admin image fields request direct upload tokens or import remote images through `api/admin/uploads.js`.
2. Uploads are restricted by folder, content type, and size.
3. Admin endpoints store image URL/pathname fields in Prisma.
4. When images are replaced or owning records deleted, endpoints call `deleteRemovedBlobPathnames` or `deleteUnusedBlobPathnames`.
5. `src/lib/blobCleanup.js` rechecks known database references before deleting from Vercel Blob.

## Crosshair YouTube Sync

1. `AdminMusicCrosshairPage.jsx` calls `POST /api/admin/crosshair?action=sync`.
2. `api/admin/crosshair.js` delegates to `syncCrosshairFromYouTube`.
3. `src/lib/youtubeChannelSync.js` chooses OAuth or API-key mode, fetches channel uploads, gets video details, filters deleted/private videos, and upserts `CrosshairVideo` rows.
4. Rows with manual `source` preserve human-edited fields during sync.

## Fashion Catalogue

1. Public fashion pages call `/api/fashion/*` endpoints rewritten to `api/public.js`.
2. Admin talent/crew/look CRUD is handled by `api/admin/fashion.js`.
3. Admin collection CRUD is handled by `api/admin/fashionCollections.js`.
4. TALENT sessions are scoped to their own profile and created looks/collections.
5. Free-text fashion credits can create `FashionCrew` rows automatically.
6. Public formatting merges inherited collection/look/piece credits for display.

## Fashion Homepage Featured Image Editing

`src/pages/FashionHomePage.jsx` lets admin-preview users change image `usage` values from the public homepage. The page builds the full look payload with `buildLookPayloadWithImageUsage` and saves through `api/admin/fashion?resource=looks`.

This is a permanent editorial convenience, not a temporary debug affordance. It lets admins see how featured look images read in the live homepage layout and swap the featured usage in context.

## Private SoundCloud Release Flow

`src/components/admin/AdminSongFormModal.jsx` exposes private SoundCloud URLs for unreleased songs. Those URLs are admin-only inputs and are intended to be removed after the song release date, while public playback uses the normal release URL rules from `api/public.js` and `src/lib/releaseSchedule.js`.
