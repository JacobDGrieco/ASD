# Database Current State

Last updated: July 22, 2026.

This is the single source document for the current PostgreSQL/Prisma database
state, the July 22 safe additive migration, the backup and validation procedure,
rollback instructions, and the remaining database plan.

## Summary

The application uses PostgreSQL with Prisma as the application schema and client
source of truth. The database referenced by `.env.local` was updated on July 22,
2026 with the approved safe additive changes.

No existing columns were changed, renamed, or removed. The applied changes only
added nullable columns and indexes:

- `MusicOutsideArtist.normalizedName`
- `FashionCrew.normalizedName`
- `Song.createdAt`
- `Song.updatedAt`
- read-path indexes for contributor lookup, album release ordering, board posts,
  record-player tracks, song metadata release dates, and `SongMeta.roles` JSONB
  containment

The new columns were backfilled, and application write paths now populate them
for future rows.

## Stack And Source Of Truth

- Database: PostgreSQL hosted on Neon/Vercel infrastructure.
- ORM/client: Prisma Client via `@prisma/client`.
- Schema source: `prisma/schema.prisma`.
- Runtime database variables: `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
- Application runtime: Vercel Functions plus a Vite/React frontend.
- Validation SQL: `docs/database/validation.sql`.
- Safe additive rollback SQL: `docs/database/rollback-safe-additive.sql`.

## Migration History State

The live database has an existing Prisma `_prisma_migrations` table with 34
historical migrations. Observed range:

- First migration: `20260424212501_init`
- Latest historical migration: `20260716120000_add_album_roles`

Those 34 historical migration folders are not present in this checkout. Prisma
therefore reports that the local migration folder and the live migration table
have no common migration. Because of that, `npx prisma migrate deploy` is not a
safe production command from this repository until migration history is restored
or explicitly reconciled.

The generated local migrations are still useful review artifacts:

- `prisma/migrations/00000000000000_baseline/migration.sql`
- `prisma/migrations/20260722094500_safe_additive_indexes_and_metadata/migration.sql`

The baseline migration must not be deployed to the existing live database because
the live database already has the represented tables. It is useful for disposable
databases and as a snapshot of the current accepted schema.

## Backup Or Copy

PostgreSQL CLI tools (`pg_dump`, `pg_restore`, and `psql`) were not available on
this machine. Before applying DDL, a local JSON copy was created instead with:

```powershell
node scripts/database/export-database-json.js
```

Backup directory:

```text
backups/database/pre-safe-additive-2026-07-22T14-09-20Z
```

`backups/database/` is ignored by git because it contains real database rows.
The export wrote one JSON file per public table plus `manifest.json`; the
manifest recorded 34 tables including `_prisma_migrations`.

For future high-value database changes, prefer a provider snapshot or `pg_dump`
backup when those tools are available. Do not treat an export as verified merely
because it exists; verify row counts and restoreability appropriate to the
operation.

## Applied Safe Additive Change

Because local Prisma migration history is missing, `migrate deploy` was not used.
The reviewed additive SQL was applied through the idempotent direct runner:

```powershell
$env:ALLOW_APPROVED_DB_WRITE='1'
node scripts/database/apply-safe-additive-migration.js --execute --confirm-approved-db --backup-dir=backups\database\pre-safe-additive-2026-07-22T14-09-20Z
```

The script prefers `DATABASE_URL_UNPOOLED` for DDL when it exists.

Applied DDL:

- Added `MusicOutsideArtist.normalizedName TEXT` if missing.
- Added `FashionCrew.normalizedName TEXT` if missing.
- Added `Song.createdAt TIMESTAMP(3)` if missing.
- Added `Song.updatedAt TIMESTAMP(3)` if missing.
- Added `MusicOutsideArtist_normalizedName_idx`.
- Added `FashionCrew_normalizedName_idx`.
- Added `Album_artistId_releaseDate_idx`.
- Added `SongMeta_releaseDate_idx`.
- Added `SongMeta_roles_gin_idx`.
- Added `RecordPlayerTrack_active_position_idx`.
- Added `BoardPost_artistId_archivedAt_publishedAt_idx`.

The Prisma schema models the additive columns and B-tree indexes. The
`SongMeta_roles_gin_idx` index is raw PostgreSQL because Prisma cannot represent
JSONB GIN indexes in `schema.prisma`.

## Backfill

Backfill script:

```powershell
node scripts/database/backfill-safe-additive.js
```

Execution command used after confirming the backup and target database:

```powershell
$env:ALLOW_APPROVED_DB_WRITE='1'
node scripts/database/backfill-safe-additive.js --execute --confirm-approved-db
```

Rows updated:

- `MusicOutsideArtist.normalizedName`: 44
- `FashionCrew.normalizedName`: 1
- `Song.createdAt` / `Song.updatedAt`: 395

Post-backfill checks:

- `MusicOutsideArtist` rows still needing normalized-name backfill: 0
- `FashionCrew` rows still needing normalized-name backfill: 0
- `Song` rows missing timestamps: 0

## Application Write Paths

The application now writes the new fields instead of relying on the one-time
backfill:

- `api/admin/outside-artists.js`
  - Writes `MusicOutsideArtist.normalizedName` on create/update.
- `api/admin/songs.js`
  - Writes `normalizedName` for auto-created `MusicOutsideArtist` rows.
  - Uses `normalizedName` in lookup with a case-insensitive name fallback.
  - Writes `Song.createdAt` and `Song.updatedAt` on song create.
  - Writes `Song.updatedAt` on song update and lazy release-visibility sync.
- `api/admin/albums.js`
  - Writes `normalizedName` for auto-created `MusicOutsideArtist` rows.
  - Uses `normalizedName` in lookup with a case-insensitive name fallback.
  - Writes `Song.updatedAt` when syncing single-release fields to songs.
- `api/public.js`
  - Uses `normalizedName` for outside-artist credit lookup with legacy fallback.
- `api/admin/fashion.js`
  - Writes `FashionCrew.normalizedName` on direct crew create/update and
    auto-created crew rows.
- `api/admin/fashionCollections.js`
  - Writes `FashionCrew.normalizedName` for collection-credit auto-created crew.
- `scripts/sync-single-release-fields.js`
  - Writes `Song.updatedAt` when updating song release links.
- `prisma/seed.js`
  - Writes song timestamps for seed songs.
- `src/lib/normalizedNames.js`
  - Centralizes the shared case/whitespace normalization used by those paths.

## Validation Outcome

Validation SQL:

```text
docs/database/validation.sql
```

Because `psql` was not installed locally, the SQL was run through:

```powershell
node scripts/database/run-validation-sql.js
```

Results:

- Additive columns present: 4 rows returned.
- Planned indexes present: 7 rows returned.
- Normalized-name backfill incomplete rows: 0.
- Duplicate normalized contributor names: 0 rows.
- Songs missing timestamps: 0.
- Multiple-primary-image report: 0 rows.
- Invalid fashion credit report: 0 rows.
- Legacy inventory:
  - `LOOSE_LOOK` collections: 0
  - `LyricBlock` rows: 2156
  - `Annotation` rows: 8

Remaining validation blocker:

- Duplicate album track slots: 3 rows. This blocks a future unique constraint on
  `SongAlbum(albumId, discNumber, trackNumber)` until those rows are reviewed and
  cleaned.

## Rollback

Source rollback is a normal git revert of the schema, code, script, and
documentation changes.

Database rollback for only the safe additive phase is documented in:

```text
docs/database/rollback-safe-additive.sql
```

That rollback drops the new indexes and additive columns. Dropping the columns
also removes their backfilled values, so restore from the JSON copy or provider
backup if those values need to be recovered.

The baseline migration should not be rolled back on the existing live database
because it was not applied there and represents the already-existing schema.

## Future Migration Procedure

For every future database migration:

1. Restore or reconcile historical Prisma migrations before relying on
   `npx prisma migrate deploy`.
2. Create a verified backup, provider snapshot, or disposable database copy.
3. Apply migrations to a disposable database or branch first when available.
4. Run `docs/database/validation.sql`.
5. Run `npx prisma validate` and `npx prisma generate`.
6. Run `npm run build`.
7. Confirm public and admin flows that write affected rows.
8. Keep rollback SQL or restore instructions with the migration.

Until migration history is reconciled, production DDL should be reviewed and
applied only with an explicit backup and verification path.

## Remaining Database Plan

### Reconcile Prisma Migration History

Restore or reconcile the 34 historical migration folders that are already
recorded in the live `_prisma_migrations` table. After restoration, verify that
`npx prisma migrate status` reports a shared history.

Classification: Requires application coordination.

### Make Song Timestamps Required

`Song.createdAt` and `Song.updatedAt` are nullable during the expand/backfill
phase. After at least one deploy cycle confirms application writes are reliable,
make them required:

- `Song.createdAt DateTime @default(now())`
- `Song.updatedAt DateTime @updatedAt`

Precondition:

- `SELECT COUNT(*) FROM "Song" WHERE "createdAt" IS NULL OR "updatedAt" IS NULL;`
  returns `0`.

Classification: Data migration required.

### Resolve Duplicate Track Slots

Validation currently reports 3 duplicate
`SongAlbum(albumId, discNumber, trackNumber)` groups. Review and correct those
rows before adding a unique track-slot constraint.

Classification: Data cleanup, then safe constraint.

### Add Primary Image Constraints

Application logic expects one primary image per owner, and current validation
reports no multiple-primary-image conflicts. A future migration can add partial
unique indexes for one primary image per owning record in the image tables.

Classification: Safe constraint after validation.

### Add Fashion Credit Identity Checks

Fashion credit rows can reference `talentId`, `crewId`, or a fallback
`creditName`. Current validation reports no invalid fashion credit rows. A future
migration can add check constraints requiring exactly one usable identity path.

Classification: Safe constraint after validation.

### Decide Legacy Lyrics Cleanup

Current lyrics use `SongLyric`, `SongAnnotation`, and `SongAnnotationRange`.
Legacy tables still contain data:

- `LyricBlock`: 2156 rows
- `Annotation`: 8 rows

Do not drop those tables until current lyric UI behavior and any import/export
needs are confirmed. If obsolete, export or archive their contents before a
separate contract migration.

Classification: Potentially destructive.

### Keep `LOOSE_LOOK` Cleanup Separate

`FashionCollectionType.LOOSE_LOOK` remains in the Prisma enum, but current live
data has 0 `LOOSE_LOOK` rows. Remove or rename the enum value only in a separate
enum migration after confirming deployed code no longer references it.

Classification: Breaking enum contract unless carefully staged.

## Open Risks

- Local migration history does not match the live database. This is the highest
  operational risk for future database work.
- The generated baseline migration is useful for disposable databases and review,
  but dangerous for the existing live database if deployed as DDL.
- `Song.createdAt` and `Song.updatedAt` remain nullable until the next migration
  phase.
- Future constraints for primary images, track slots, and credit identity should
  wait until validation blockers are resolved.
