# Database Proposal

Last updated: July 27, 2026.

This proposal covers the database-related items from `FUTURE_FIXES.md`. It is a
review artifact only. No production database commands or destructive migrations
have been run as part of this document.

## 1. Restore or Reconcile Prisma Migration History

Existing design:

- The live database has 34 historical rows in `_prisma_migrations`.
- This checkout has only `00000000000000_baseline` and the July 22 safe additive
  migration.
- `docs/database/current-state.md` states that `npx prisma migrate deploy` is not
  safe against the existing live database until history is restored or reconciled.

Proposed design:

- Restore the missing historical migration folders if they can be recovered from
  source control, deployment artifacts, or a prior checkout.
- If they cannot be recovered, create an explicit reconciliation plan for a new
  migration baseline in a disposable database first, then document the operator
  procedure for production.

Classification: Requires application coordination.

Compatibility impact:

- No application behavior changes.
- This gates future production DDL.

Verification:

- `npx prisma migrate status` against an approved non-production copy.
- Compare live schema to `prisma/schema.prisma` with `npx prisma migrate diff`.
- Run `docs/database/validation.sql`.

Rollback:

- No rollback for read-only restoration. If a reconciliation migration is created,
  do not apply it to production until reviewed with backup/restore steps.

## 2. Resolve Duplicate Track Slots Before Adding Constraint

Existing design:

- `SongAlbum` has `@@unique([songId, albumId])`.
- It does not enforce one song per album/disc/track slot.
- `docs/database/validation.sql` reports 3 duplicate
  `(albumId, discNumber, trackNumber)` groups in current data.

Proposed design:

1. Review each duplicate group with album title, song title, placement order,
   disc number, and track number.
2. Correct duplicates manually through the admin UI or a reviewed data-fix script.
3. Add `@@unique([albumId, discNumber, trackNumber])` only after validation returns
   no duplicates.

Classification: Data cleanup, then safe constraint.

Compatibility impact:

- The admin album/song editors will need to surface constraint failures cleanly if
  a future write attempts a duplicate slot.

Verification:

- Run validation query 6 in `docs/database/validation.sql`.
- Add or run a focused API save check for duplicate track slots.
- Run `npx prisma validate`, `npx prisma generate`, and `npm run build`.

Rollback:

- The data cleanup should be reversible by restoring the original track numbers
  from the review notes.
- The unique constraint can be dropped in a rollback migration if required.

## 3. Legacy Lyrics Contract

Existing design:

- Current application code uses `SongLyric`, `SongAnnotation`, and
  `SongAnnotationRange`.
- Legacy `LyricBlock` and `Annotation` models still exist in Prisma.
- Current-state docs recorded live rows: 2,156 `LyricBlock` rows and 8
  `Annotation` rows.

Proposed design:

1. Export/archive legacy lyric tables before any destructive migration.
2. Confirm there is no import/export, reporting, or admin recovery workflow that
   still needs the legacy rows.
3. If obsolete, create a contract migration that drops `Annotation`, then
   `LyricBlock`, and removes `Song.lyricBlocks`.

Classification: Potentially destructive.

Compatibility impact:

- Drops historical data unless archived.
- Requires Prisma Client regeneration and application build validation.

Verification:

- `rg "LyricBlock|Annotation" src api scripts docs prisma`
- Row-count export manifest for both legacy tables.
- Admin lyrics read/write smoke check.

Rollback:

- Restore from verified backup or archived export.
- Revert source and apply a rollback migration that recreates the tables if the
  drop migration has already been applied.

## 4. Legacy Image and Link Compatibility Paths

Existing design:

- Dedicated image relation tables and `links` JSON fields are the target shape.
- Several models still have legacy string fields such as `portrait`, `coverArt`,
  `artwork`, and per-platform link columns.
- `src/lib/images.js` and `src/lib/profileLinks.js` bridge both shapes.

Proposed design:

1. Add validation queries that count legacy-only rows per model.
2. Backfill missing relation-table images and JSON links from legacy fields where
   safe and deterministic.
3. Deploy code that reads the new shape first and logs/report legacy-only rows.
4. Remove write-side legacy population.
5. Remove read-side compatibility helpers only after validation is clean.
6. Drop legacy columns in a later contract migration.

Classification: Requires application coordination; data migration required.

Compatibility impact:

- Public API response shapes should remain stable during expand/migrate phases.
- Contract phase may break any external client relying on legacy columns if those
  columns are exposed directly.

Verification:

- Legacy-only count queries.
- Representative public pages for artists, albums, songs, fashion talent, and
  catalogue items.
- `npm run build`.

Rollback:

- Keep legacy columns populated until the final contract phase, so rollback is a
  normal source revert before column drops.

## 5. `LOOSE_LOOK` Enum Cleanup

Existing design:

- `FashionCollectionType` contains `COLLECTION` and `LOOSE_LOOK`.
- Current-state docs recorded 0 live `LOOSE_LOOK` rows.
- Application code still references `LOOSE_LOOK` in public catalogue formatting
  and the admin collection flow.

Proposed design:

1. Decide whether loose looks remain a product concept.
2. If not, remove the admin option and public handling in one deploy while keeping
   the enum value.
3. After confirming no rows and no deployed code references the value, remove the
   enum value through a PostgreSQL-safe enum migration.

Classification: Breaking enum contract unless staged.

Compatibility impact:

- Admin collection creation flow changes.
- Public catalogue compatibility aliases may need to remain during transition.

Verification:

- `SELECT COUNT(*) FROM "FashionCollection" WHERE type = 'LOOSE_LOOK';`
- `rg "LOOSE_LOOK" src api docs prisma`
- Admin collections and fashion catalogue smoke checks.

Rollback:

- Re-add the admin option/code handling before reverting the enum migration.

## 6. Public API Resource Names

Existing design:

- `api/public.js` multiplexes resources with `?resource=...`.
- `vercel.json` provides friendlier rewrites for repo-owned public routes.
- External callers may still use `?resource=` directly.

Proposed design:

- Do not rename resource names until access logs or known integrations confirm no
  direct external clients rely on them.
- If names are changed, keep aliases in `api/public.js` for at least one release
  cycle and document deprecation dates.

Classification: Breaking API contract unless aliases are kept.

Compatibility impact:

- Potential external client breakage.

Verification:

- Repo search for direct callers.
- Deployment/provider request logs if available.
- Public route smoke checks.

Rollback:

- Re-add aliases for old resource names.
