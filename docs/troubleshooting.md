# Troubleshooting

## Public Pages Show Stale Release Data

Relevant files: `src/hooks/useApi.js`, `src/lib/apiCache.js`, `src/lib/releaseSchedule.js`, `api/public.js`.

Public APIs return `Cache-Control: no-store`, but browser-side code caches responses in memory. Pages with `refreshAtUtcMidnight` refresh at the America/New_York release boundary. For other pages, reload the page or clear the relevant cache path in code.

## Hidden Content Is Visible While Logged In

Relevant files: `src/lib/adminAuth.jsx`, `src/lib/publicPreview.js`, `api/public.js`.

A valid admin cookie enables public preview responses to include hidden/unreleased data. Log out or use a non-authenticated browser session to verify public visibility.

## Admin Redirects to Login

Relevant files: `src/lib/adminResourceCache.js`, `src/lib/adminAuth.jsx`, `api/admin/login.js`.

A 401 from an admin GET clears the admin resource cache and navigates to `/admin/login`. Likely causes are an expired JWT, missing `JWT_SECRET`, invalid cookie, or failed session hydration.

## Admin Login Always Fails

Relevant files: `api/admin/login.js`, `src/lib/passwords.js`, `src/lib/adminAccounts.js`.

Check:

- `ADMIN_PASSWORD` exists if using global login.
- `JWT_SECRET` is set.
- DB-backed account rows are active.
- The connected database has the expected account tables/columns.
- The caller has not exceeded the in-process login rate limit. Wait for the retry window or restart the local dev function process.

## Uploads Fail

Relevant files: `api/admin/uploads.js`, `src/components/admin/ImageCollectionField.jsx`, `src/components/admin/BoardMarkdownEditor.jsx`.

Check:

- `BLOB_READ_WRITE_TOKEN` is set.
- File type is JPEG, PNG, WebP, GIF, or AVIF.
- File size is under 10 MB.
- Upload folder is one of the server allowlisted folders.
- The admin session is not `VIEWER`.

## Private Blob Image Does Not Load

Relevant files: `api/blob.js`, `src/lib/images.js`.

Check that the stored pathname is a managed blob pathname and that `BLOB_READ_WRITE_TOKEN` can read private blobs. `buildClientImageUrl` proxies private blob pathnames through `/api/blob?pathname=...`.

## Blob Cleanup Leaves Files Behind

Relevant file: `src/lib/blobCleanup.js`.

Cleanup is best effort. It rechecks database references before deleting and logs failures with `console.warn`, but it does not fail the admin request. Re-run cleanup manually only after confirming no database row references the pathname.

## YouTube Sync Is Unavailable

Relevant files: `api/admin/crosshair.js`, `src/lib/youtubeChannelSync.js`.

`GET /api/admin/crosshair?action=config` reports whether public API-key or OAuth sync is configured. Public mode requires `YOUTUBE_API_KEY` plus `YOUTUBE_CHANNEL_ID` or `YOUTUBE_CHANNEL_HANDLE`. OAuth mode requires client id, client secret, and refresh token.

## Crosshair Sync Overwrites Less Than Expected

Relevant file: `src/lib/youtubeChannelSync.js`.

Rows whose `source` is not `YOUTUBE_SYNC` preserve manual title, description, type, thumbnail, published date, and visibility choices. This protects admin edits from resyncs.

## Prisma Client Is Missing or Stale

Run:

```sh
npm run db:generate
```

`postinstall` also runs Prisma generate after `npm install`.

## Database Schema Mismatch

Relevant files: `prisma/schema.prisma`, `docs/database/proposal.md`.

Do not run production schema changes without a confirmed workflow, migration history decision, and backup. The repository now assumes the current account schema is present.

## SoundCloud Player Fails

Relevant files: `src/lib/playerContext.jsx`, `src/components/shared/SoundCloudPlayer.jsx`.

The UI reports `Couldn't load this track` when the widget API reports failure. Check the stored SoundCloud URL, whether unreleased content should use `privateSoundcloudUrl` in admin preview, and browser console errors from the SoundCloud widget script.
