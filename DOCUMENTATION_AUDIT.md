# Documentation Audit — ASD

Generated as Phase 1–2 of a repository-wide documentation pass. This is a research artifact, not user-facing documentation — it exists to scope Phase 3 (clarification questions) and Phases 4–9 (actual documentation edits).

## 1. High-level summary

ASD is the web presence for a music label with a companion fashion vertical, plus a shared admin CMS that both verticals' staff use to manage content. The public site presents artists, albums, songs (with lyrics/annotations), a drag-and-drop "board" of pinned posts, a YouTube-video hub ("Crosshair"), a home-page vinyl "record player" widget, fashion talent profiles, and fashion look/collection catalogues. The admin CMS (`/admin/*`) is a single React app section gated by a custom JWT-cookie auth system with four roles (`SUPER_ADMIN`, `ARTIST`, `TALENT`, `VIEWER`), used to create/edit all of the above and to manage per-account page permissions.

The app is a single Vite-built React SPA; server logic lives entirely in Vercel Functions under `api/`, talking to a single Postgres database through Prisma. There is no separate backend service or server framework (no Express/Next.js) — `api/*.js` files are plain Vercel serverless handlers.

## 2. Technology stack

- **Frontend**: React 19, React Router DOM 7, Vite 8, PrimeReact (UI components, notably `TabView`), Framer Motion (board drag/pan, hero carousels), Tiptap (rich text, used in `BoardMarkdownEditor`), `react-icons`, DOMPurify (sanitizing rendered markdown).
- **API**: Vercel Functions — one JS file per route under `api/`, using Vercel's filesystem-based routing plus custom `rewrites` in `vercel.json` to expose clean public paths that map to consolidated `resource=`-routed handlers.
- **Database**: PostgreSQL via Prisma ORM 5 (`prisma/schema.prisma`). Client generated to `src/generated/prisma/` (gitignored, machine-generated — see §14).
- **File storage**: Vercel Blob (`@vercel/blob`), used for all uploaded images/videos; `api/blob.js` proxies private blob reads, `api/admin/uploads.js` handles direct uploads, imports-from-URL, and deletes.
- **Auth**: Custom JWT (`jsonwebtoken`) in an HttpOnly cookie, scrypt password hashing (Node `crypto`), no third-party auth provider.
- **External integration**: YouTube Data API v3 (`src/lib/youtubeChannelSync.js`), either via API key (public mode) or OAuth refresh-token (private mode), used only for the Crosshair video library.
- **Analytics**: `@vercel/analytics`.
- **Tooling**: ESLint 9 (flat config), `react-doctor` (via CI and a local `.claude` skill), Prisma CLI for migrations/seed.
- **Testing**: Effectively none — see §14 "Test setup" finding; `vitest`-shaped config exists in `vite.config.js` but the package isn't installed and `src/test/` contains only empty directories.
- **Deployment**: Vercel, gated by a commit-message convention (`vercel.json`'s `ignoreCommand` only builds commits containing `[deploy]` — matches the observed git history, e.g. `bffd497 [deploy] fixed all admin pages...`).

## 3. Major entry points

- **`index.html`** → **`src/main.jsx`** — Vite SPA bootstrap, mounts `<App />`.
- **`src/App.jsx`** — defines all client routes (public + `/admin/*`), wraps public routes in a shared `PublicLayout` (nav/footer/scroll-reset), wraps admin routes in `AdminProvider` + `AdminRoute` guards.
- **`api/public.js`** — single consolidated read-only endpoint for all public data, resource-routed via `?resource=`, rewritten from clean URLs by `vercel.json` (e.g. `/api/artists` → `/api/public?resource=artists`).
- **`api/admin/*.js`** — one handler per admin-managed resource area (about, accounts, albums, annotations, artists, crosshair, fashion, fashionCollections, login, lyrics, outside-artists, record-player, songs, uploads), each gated by `src/lib/auth.js`'s `requireAdmin`/`requireSuperAdmin`.
- **`api/blob.js`** — streams/redirects private Vercel Blob content by pathname (unauthenticated — see §11).
- **`prisma/seed.js`** — dev-only DB seeding entry point (`npm run db:seed`).

## 4. Important application flows

- **Public content read** — page component → `useApi`/`prefetchApi` (`src/hooks/useApi.js`) → `/api/public?resource=...` (rewritten from a clean path) → `api/public.js` resource router → Prisma query, visibility-filtered by `contentVisibility.js`/`publicVisibility.js`/`releaseSchedule.js` → JSON shaped for the page.
- **Admin login** — `AdminLoginPage.jsx` → `POST /api/admin/login` → three-branch credential check (env `ADMIN_PASSWORD`, hardcoded `'viewer'` literal, or DB-backed scrypt-hashed `ArtistAdminAccess`/`FashionTalentAdminAccess` rows) → JWT signed and set as an HttpOnly cookie → client re-hydrates session via `GET /api/admin/login` on load.
- **Admin CRUD (e.g. songs, albums, fashion looks)** — admin page → `adminResourceCache`-wrapped fetch → `api/admin/*.js` → `requireAdmin` → page-key + role check (`adminPageAccess.js`) → Prisma write → for image fields, `blobCleanup.js` diffs old/new pathnames and deletes orphaned blobs.
- **Release-based auto-visibility** — admin sets `autoShowOnRelease` + a future `releaseDate` → `contentVisibility.js` computes effective visibility live on every public read regardless of the raw DB flag → separately, `syncAlbumReleaseVisibility`/`syncSongReleaseVisibility` lazily flip the DB `isVisible` column to true the next time an admin hits the relevant admin endpoint after the release passes (NY-midnight boundary, `releaseSchedule.js`).
- **Admin preview of hidden content on the public site** — any valid admin session (any role) sets `includeHidden` via `publicPreview.js`'s cookie/bearer check, which makes `api/public.js` return normally-hidden items site-wide (not scoped to the admin's own artist/talent — see §11).
- **Image upload** — admin form → `ImageCollectionField`/`BoardMarkdownEditor` → direct-to-Blob client upload (`@vercel/blob/client`) or "import from URL" (server-side fetch-and-store via `api/admin/uploads.js`) → pathname stored on the relevant `*Image` row → old pathname cleaned up via `blobCleanup.js` if replaced.
- **YouTube video sync (Crosshair)** — manual admin action (`POST /api/admin/crosshair?action=sync`) → `youtubeChannelSync.js` calls YouTube Data API (API-key or OAuth mode) → upserts `CrosshairVideo` rows by `youtubeVideoId`, preserving any manually-edited fields (`source !== 'YOUTUBE_SYNC'`).
- **Board post lifecycle** — create/publish/schedule from `AdminMusicBoardPage.jsx` → `adminBoardHandler.js` enforces a 25-post published cap (auto-archiving the oldest), a 90-day public-visibility age cutoff, and 1-image/5-link limits per post body → public `BoardPage.jsx` renders posts at deterministic pseudo-random positions computed by `boardPosition.js`, with collision avoidance and pin-until-date locking.

## 5. Directory-by-directory overview

| Directory                                     | Responsibility                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/pages/`                                | Route-level components, public site (also`src/pages/admin/` for CMS pages).                                                                                                                                                                                                                                                                                                                      |
| `src/components/`                           | Reusable UI, split into`admin/` (CMS widgets) and per-vertical folders (`album/`, `artist/`, `board/`, `fashion/`, `home/`, `shared/`, `song/`).                                                                                                                                                                                                                                   |
| `src/hooks/`                                | `useApi` (data fetching + caching) and `useCompanyProfile` (About page data).                                                                                                                                                                                                                                                                                                                  |
| `src/lib/`                                  | All non-visual logic: auth, visibility rules, Prisma client, blob cleanup, YouTube sync, markdown rendering, board layout math, slugify, image normalization, admin permission model. This is the most business-logic-dense directory in the repo.                                                                                                                                                 |
| `src/styles/`                               | Per-component/page CSS files, plain CSS (no CSS-in-JS or Tailwind).                                                                                                                                                                                                                                                                                                                                |
| `src/generated/`                            | Prisma Client output —**generated, do not hand-edit or document as source** (gitignored).                                                                                                                                                                                                                                                                                                   |
| `src/test/`                                 | Scaffolded but empty — see §14.                                                                                                                                                                                                                                                                                                                                                                  |
| `api/`                                      | Vercel Function handlers — the entire server side of the app. Flat per-resource files (`albums.js`, `songs.js`, etc.) plus several **empty leftover directories** (`api/artists/`, `api/record-player/`, `api/songs/`, `api/admin/{albums,annotations,artists,lyrics,record-player,songs}/`) from an earlier per-folder routing scheme — harmless to Vercel routing but stale. |
| `prisma/`                                   | `schema.prisma` (data model), `migrations/` (33 tracked migrations, 2026-04-24 → 2026-07-14), `seed.js` (dev seed data).                                                                                                                                                                                                                                                                    |
| `scripts/`                                  | `vercel-api-entrypoints.js` (active — makes the Vercel route graph visible to static-analysis tools like react-doctor); `migrate-lyrics-to-flat.js` and `migrate-song-roles.js` (historical one-off backfills, already run — see §14).                                                                                                                                                    |
| `docs/superpowers/`                         | Six paired plan+spec markdown docs recording past feature designs (the-board, id-based-urls, song-roles-redesign, fashion-crew-registry, fashion-collections, admin-entity-cards). Historical design records, not living reference docs, and not cross-linked from anywhere.                                                                                                                       |
| `.superpowers/`, `.agents/`, `.claude/` | AI-assisted-development tooling state (brainstorm notes, spec-driven-dev scratch files, a local react-doctor skill). Not app code; gitignored.                                                                                                                                                                                                                                                     |
| `public/`, `dist/`                        | Static assets copied verbatim to the build (`public/`) and the Vite build output (`dist/`, regenerated, not source).                                                                                                                                                                                                                                                                           |
| `fonts/`, `imgs/`                         | Static brand assets (fonts referenced by CSS`@font-face`; `imgs/` is gitignored per `.gitignore` and appears to be local-only sample/placeholder imagery).                                                                                                                                                                                                                                   |

## 6. Files whose purpose is unclear

- **`scripts/vercel-api-entrypoints.js`** statically imports `../api/admin/videos.js`, which does not exist anywhere in the repo. If this script is actually run (`npm run check:api-entrypoints`), that import would throw. Needs a decision: was `api/admin/videos.js` removed and the entrypoints list not updated, or was it never created? (Cross-reference: README.md advertises a "Stage (`/videos`)" route that also does not exist in `src/App.jsx` — see §10.)
- **`src/lib/dateInput.js`** (`isValidDateInput`) — none of the four backend/admin research passes found a call site within the files they read; likely consumed by an admin date-picker component not directly traced. Needs confirmation of where it's actually used (candidate: `AdminDateInput.jsx`, which a separate agent pass read but didn't explicitly confirm calls this validator).
- **Nine empty directories under `api/`** (listed in §5) — almost certainly dead leftovers from a prior routing layout, but worth a one-line confirmation before deleting, since an empty dir could also be an accidental `git add` artifact rather than intentional.
- **`.agents/` directory** — exists but is completely empty; unclear if it's meant to hold something (e.g., a future subagent config) or is a stray created-and-abandoned folder.

## 7. Functions with unclear intent or side effects

- **`api/admin/albums.js` / `api/admin/songs.js`: `syncAlbumReleaseVisibility` / `syncSongReleaseVisibility`** — run a Prisma `updateMany` as a side effect of *every* request to these endpoints, including plain `GET`s, silently mutating `isVisible`/`autoShowOnRelease` for any row whose release date has passed. Not documented anywhere that visibility flags can change as a side effect of an unrelated read request.
- **`api/public.js`: `isAdminPreviewSession` (in `publicPreview.js`) is defined but never called** — `api/public.js` reimplements the same check inline instead. Dead export, or was something meant to use it and doesn't?
- **`api/admin/fashion.js` / `api/admin/fashionCollections.js`: auto-creation of `FashionCrew` records** — when a credit is entered with a free-text name that doesn't match an existing Talent/Crew record, the endpoint silently creates a new `FashionCrew` row. Same pattern in `api/admin/songs.js` for `MusicOutsideArtist`. This is an implicit "typing a new name is equivalent to registering a new person" business rule with no confirmation step.
- **`src/lib/blobCleanup.js`: `deleteUnusedBlobPathnames`** — swallows deletion failures with only `console.warn`, never surfacing them to the caller or retrying. Silent-failure risk: orphaned blobs can accumulate indefinitely with no operator-visible signal.
- **`src/pages/BoardPage.jsx`: `handlePositionChange`** — calls a blocking `window.prompt()` to ask for a pin-until date, then PATCHes an admin endpoint (`/api/admin/board`) directly from what is nominally a public page component. Intentional (admin-preview-only path) but easy to mistake for a bug on first read.
- **`src/pages/FashionHomePage.jsx`: `handleSwapPresentation` (`canSwapPresentation`)** — similarly, a public page component contains an authenticated admin write path (`PUT /api/admin/fashion/looks`) gated on `session?.role === 'SUPER_ADMIN'`.
- **`src/lib/auth.js`: legacy-token upgrade branch** (`if (payload?.admin === true && !payload?.role)`) — silently upgrades an old JWT payload shape into a `SUPER_ADMIN` session. Evidence of a past auth schema change; unclear how long this compatibility branch needs to be kept (all outstanding 8-hour-lifetime old tokens would have expired within a day of the change, so it may already be safe to remove — a question for Phase 3).

## 8. Variables with unclear names or roles

- **Every admin page's `token`** (from `adminAuth.jsx`) is always the literal sentinel string `'cookie'` and is placed into an `Authorization: Bearer` header that the server explicitly discards (`isUsableBearerToken` filters it out). The name `token` implies it carries the real credential; it doesn't — the real credential is an HttpOnly cookie the JS layer never touches. This is copy-pasted across ~15 admin page files.
- **`AdminMusicRecordPlayerPage.jsx`: `slotsCache`** — a second, independent module-level cache alongside the shared `adminResourceCache`, never cleared on logout. Name doesn't indicate it's a special-case parallel cache with different lifecycle rules than every other admin page's data.
- **Generic response-variable names** (`data`, `result`, `payload`, `saved`, `updated`) used inconsistently for "the server's response after a save" across different admin pages — same concept, different names depending on which page you're reading.
- **`boardPosition.js` constants** (`RADIUS_STEP = 300`, `JITTER = 60`, `MAX_OVERLAP_FRACTION = 0.10`, `ANGLE_TRIES = 12`, `MAX_ROTATION_DEG = 10`) — units/rationale not stated (pixels? degrees, presumably, for rotation — but no comment ties them to the visual behavior they produce).
- **`src/components/home/SideRails.jsx`: bare `500`/`1000` millisecond timeouts** that don't reference the file's own named constant `RIGHT_RAIL_TRANSITION_MS = 760` a few lines away — inconsistent, and unclear whether the mismatch is intentional (different transition than the named one) or a stale copy-paste.

## 9. Missing or misleading comments

- No TODO/FIXME/HACK comments and no large commented-out code blocks were found anywhere in `src/`, `api/`, or `scripts/` across all four research passes — the codebase is clean in that specific respect, so Phase 7's job is closer to "add comments where genuinely missing" than "clean up comment debt."
- The complete absence of comments around the three-branch login logic (`api/admin/login.js`) is misleading by omission: nothing in the code signals that `'viewer'` is an intentional, permanent, undocumented shared credential rather than test/debug residue — see §12.
- `src/lib/passwords.js` and the `ADMIN_PASSWORD` plain `===` compare in `api/admin/login.js` sit right next to each other conceptually (both are "how do we check a password") but use different comparison strategies (timing-safe vs not) with no comment explaining why the env-var path is exempt from the timing-safe treatment used everywhere else.

## 10. Incorrect or outdated documentation

- **README.md line 13**: `"**The Stage** (\`/videos\`) — artist videos"`— no`/videos`route exists in`src/App.jsx`. The `ArtistVideo`Prisma model and`src/lib/artistVideos.js` (YouTube URL parsing) both exist, suggesting the feature was partially built (data model + helper) but the page/route was never shipped, or was removed. **Needs a decision in Phase 3**: is this a planned-but-unbuilt feature (document as "not yet implemented") or should the README line be removed?
- **README.md line 37**: `"npm run test:run: run the test suite"` — this script does not exist in `package.json`, and no test runner (`vitest` etc.) is installed. `src/test/` is an empty scaffold. This line should be corrected or removed once Phase 3 clarifies the intended test strategy (see §12 questions).
- **`vite.config.js`'s `test` block** (vitest-shaped config: `environment: 'jsdom'`, `setupFiles: ['src/test/setup.js']`) references a setup file that doesn't exist and configures a test runner that isn't a project dependency — dead/aspirational configuration, not functioning documentation of current behavior.

## 11. Public interfaces missing documentation

- **Every `api/admin/*.js` and `api/public.js` handler** — no JSDoc/route documentation exists anywhere describing accepted methods, query/body shape, auth requirements, or response shape. This is the single largest documentation gap in the repo (13 admin endpoint files + the public resource router).
- **`src/lib/auth.js`** — the entire role model (`SUPER_ADMIN`/`ARTIST`/`TALENT`/`VIEWER`), the token-read precedence (bearer-if-usable, else cookie), and the row-scoping helpers (`artistScopedAlbumWhere`, etc.) have no exported-function documentation despite being the security-critical core of the app.
- **`src/lib/contentVisibility.js` / `releaseSchedule.js` / `publicVisibility.js`** — the visibility/release-date business rules are entirely implicit in code with no docstrings, despite being genuine, non-obvious business logic (NY-midnight release boundary, auto-show-then-materialize pattern, reserved-artist hiding).
- **`src/lib/blobCleanup.js`** — the reference-counting/race-condition-avoidance strategy for blob deletion is non-obvious and undocumented.
- **`src/lib/boardMarkdown.js`** — the security-relevant allowlist behavior (which tags/URL schemes are permitted) is exactly the kind of thing that should have a doc comment explaining the threat model, and currently doesn't.
- **`api/blob.js`** — has no auth check at all, unlike every other blob-touching endpoint; this asymmetry should be either documented as intentional (e.g., "blob pathnames are treated as unguessable capability tokens") or flagged as a gap — a Phase 3 question.

## 12. Important business rules that are currently implicit

- Release-day boundary is **America/New_York midnight**, not UTC midnight or the server's local time (`releaseSchedule.js`).
- An item with a future `releaseDate` and `autoShowOnRelease: true` is publicly visible starting the moment that NY-midnight boundary passes, computed live on every public read — independent of whether the DB's `isVisible` column has been "caught up" yet by the lazy sync job.
- Board: max 25 published posts (oldest auto-archived past the cap), 90-day public-visibility age cutoff, 1 image / 5 links per post body.
- Record player: exactly 8 fixed slots.
- Album/song duplicate detection is title+artist+release-date equality, enforced client-side only (not a DB constraint), so it's racy under concurrent edits.
- Typing a new (unmatched) credit name for fashion collections/looks or song outside-artists **silently creates a new registry record** rather than requiring explicit "create new person" confirmation.
- The "ASD Records" artist row is a `SUPER_ADMIN` account in disguise — logging in with its `ArtistAdminAccess` credentials grants full super-admin rights, not artist-scoped rights, and it's rendered specially ("Admin" not "Music Artist") in the accounts admin page.
- The hardcoded literal password `'viewer'` (no env var, no DB row, no hashing) grants anyone a live `VIEWER` session against the production admin CMS — appears intentional (a public demo/read-only login) but is entirely undocumented as a designed feature anywhere in the repo.
- Public-preview mode (`includeHidden`) is granted by *any* valid admin session regardless of role or scope — an `ARTIST` account scoped to one artist can, via the public API preview flag, see every other artist/talent's hidden content too. Unclear if this is intended ("any staff member may preview site-wide") or a scoping bug — Phase 3 question.
- YouTube sync preserves manually-edited Crosshair video fields on resync (title/description/type/custom thumbnail/publishedAt) but always refreshes duration/privacy/lastSyncedAt/youtubeUrl and always trusts the current DB `isVisible` — i.e., "manual edits win, except visibility and technical metadata."

## 13. Areas where the implementation is ambiguous

- Whether the public-preview-grants-full-site-visibility behavior (§12) is intended or a scoping oversight.
- Whether the `'viewer'` hardcoded password and the `ADMIN_PASSWORD` non-timing-safe compare are considered acceptable risk (e.g., because the site's real secrets sit behind Postgres/Blob access, not the admin UI) or should be hardened — needs an explicit call before writing security-relevant documentation that could otherwise read as endorsing the current state.
- Whether the dead `Authorization: Bearer ${token}` pattern across every admin page is intentional scaffolding for a future non-cookie auth mode, or simply vestigial and safe to remove/stop documenting as if it mattered.
- Whether `api/blob.js`'s lack of authentication is an intentional "pathname acts as a capability token" design or a gap.
- Whether the two migration scripts (`migrate-lyrics-to-flat.js`, `migrate-song-roles.js`) should be documented as historical/archival only, or deleted — schema evidence strongly suggests they're one-off and already applied (see §14), but only the user can confirm they're safe to retire from active memory.
- Whether the `/videos` ("The Stage") feature referenced in the README is planned, abandoned, or already superseded by something else (e.g., is `ArtistVideo`/`artistVideos.js` used anywhere reachable, or is it entirely orphaned model+helper code with no consumer?). This needs direct confirmation since it affects whether `ArtistVideo`-related code gets a "feature not yet wired to a route" note or a "legacy, no longer used" note.

## 14. Potentially unused or legacy files

- **`scripts/migrate-lyrics-to-flat.js`, `scripts/migrate-song-roles.js`** — one-off backfill scripts; schema/migration evidence indicates they already ran and their target schema is now the only schema in use. Recommend documenting as historical/archival rather than active tooling.
- **Nine empty directories under `api/`** (`api/artists/`, `api/record-player/`, `api/songs/`, `api/admin/{albums,annotations,artists,lyrics,record-player,songs}/`) — leftover from a prior per-folder routing layout, no files in any of them.
- **`scripts/vercel-api-entrypoints.js`'s reference to `api/admin/videos.js`** — points at a file that doesn't exist; either stale or evidence of an unfinished removal.
- **`src/components/album/AlbumDetails.jsx`: `formatAlbumType`** (lines 65–68) — defined, never called.
- **`.agents/` directory** — empty, purpose unclear (see §6).
- **Test scaffolding** (`vite.config.js`'s vitest block, empty `src/test/` directory tree mirroring the API resource structure) — configured but non-functional; either finish wiring it up or remove the dead configuration.
- **`src/generated/`** is machine output, not legacy app code — flagged here only to make explicit that it should be excluded from any "unused file" cleanup pass and from hand-written-file documentation.

## 15. Documentation you recommend adding

Per Phase 8 of the instructions, once Phase 3 clarifications are resolved:

- `README.md` corrections (remove/clarify the `/videos` route claim and the `test:run` script claim; add an environment-variables section or link to `docs/environment-variables.md`).
- `docs/architecture.md` — client/server/DB boundaries, the admin-preview-bypasses-visibility flow, and the consolidated-resource-router pattern (`api/public.js`, `api/admin/fashion.js`) as an explicit architectural convention (multiple entities behind one file, routed by `?resource=`), since it's not obvious from file layout alone.
- `docs/authentication-and-permissions.md` — the four-role model, the three-branch login precedence (env password / hardcoded viewer / DB scrypt), the cookie-vs-dead-bearer-header situation, and the page-access double-implementation (data-driven nav vs. hardcoded per-page role checks) so future contributors add new restricted pages correctly.
- `docs/application-flows.md` — release-date auto-visibility, YouTube sync, blob cleanup/reference-counting, board post lifecycle (cap/archive/age-out), as traced in §4.
- `docs/environment-variables.md` — full table from §"Environment variables" findings (12 app-consumed vars + a note on the Vercel/Neon-injected-but-unused Postgres var cluster).
- `docs/data-model.md` — entity relationship diagram plus the implicit rules in §12 (visibility fields, the ASD-Records-artist-is-really-super-admin special case, credit auto-registration).
- `docs/troubleshooting.md` — at minimum: "`npm run test:run` doesn't exist yet," "why does `/api/*` 404 under plain `npm run dev`" (needs `dev:vercel` per README), and the react-doctor CI check being advisory-only.
- File-level headers for the dense `src/lib/` modules (auth.js, contentVisibility.js, releaseSchedule.js, blobCleanup.js, youtubeChannelSync.js, boardMarkdown.js, boardPosition.js, adminPageAccess.js, profileLinks.js, images.js) per the Phase 4 template — these are the highest-value targets since they carry nearly all of the app's non-obvious business logic.

## 16. Questions that must be answered before documenting uncertain behavior

See the grouped clarification questions presented separately below (Phase 3). They cover: the `/videos` route discrepancy, test strategy, the `'viewer'` backdoor and `ADMIN_PASSWORD` comparison, the public-preview scope bypass, the dead bearer-token pattern, the two legacy migration scripts, and the empty `api/` directories/`.agents/` folder.
