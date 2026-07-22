-- Validation queries for the safe additive database migration.
--
-- Run these against the disposable test database after applying migrations and
-- running scripts/database/backfill-safe-additive.js. Every query is read-only.

-- 1. Confirm additive columns exist.
SELECT
	table_name,
	column_name,
	is_nullable,
	data_type
FROM information_schema.columns
WHERE table_schema = 'public'
	AND (
		(table_name = 'MusicOutsideArtist' AND column_name = 'normalizedName')
		OR (table_name = 'FashionCrew' AND column_name = 'normalizedName')
		OR (table_name = 'Song' AND column_name IN ('createdAt', 'updatedAt'))
	)
ORDER BY table_name, column_name;

-- 2. Confirm planned indexes exist, including the raw JSONB GIN index.
SELECT
	indexname,
	indexdef
FROM pg_indexes
WHERE schemaname = 'public'
	AND indexname IN (
		'MusicOutsideArtist_normalizedName_idx',
		'Album_artistId_releaseDate_idx',
		'SongMeta_releaseDate_idx',
		'SongMeta_roles_gin_idx',
		'RecordPlayerTrack_active_position_idx',
		'BoardPost_artistId_archivedAt_publishedAt_idx',
		'FashionCrew_normalizedName_idx'
	)
ORDER BY indexname;

-- 3. Backfill completeness for normalized contributor names.
SELECT
	'MusicOutsideArtist' AS table_name,
	COUNT(*) AS rows_needing_backfill
FROM "MusicOutsideArtist"
WHERE btrim("name") <> ''
	AND "normalizedName" IS DISTINCT FROM lower(regexp_replace(btrim("name"), '[[:space:]]+', ' ', 'g'))
UNION ALL
SELECT
	'FashionCrew' AS table_name,
	COUNT(*) AS rows_needing_backfill
FROM "FashionCrew"
WHERE btrim("name") <> ''
	AND "normalizedName" IS DISTINCT FROM lower(regexp_replace(btrim("name"), '[[:space:]]+', ' ', 'g'));

-- 4. Duplicate normalized contributor names that block a future unique policy.
SELECT
	'MusicOutsideArtist' AS table_name,
	"normalizedName",
	COUNT(*) AS duplicate_count,
	array_agg(id ORDER BY "createdAt") AS ids
FROM "MusicOutsideArtist"
WHERE "normalizedName" IS NOT NULL
GROUP BY "normalizedName"
HAVING COUNT(*) > 1
UNION ALL
SELECT
	'FashionCrew' AS table_name,
	"normalizedName",
	COUNT(*) AS duplicate_count,
	array_agg(id ORDER BY "createdAt") AS ids
FROM "FashionCrew"
WHERE "normalizedName" IS NOT NULL
GROUP BY "normalizedName"
HAVING COUNT(*) > 1
ORDER BY table_name, "normalizedName";

-- 5. Song timestamp backfill completeness.
SELECT
	COUNT(*) AS songs_missing_timestamps
FROM "Song"
WHERE "createdAt" IS NULL
	OR "updatedAt" IS NULL;

-- 6. Duplicate album track slots. These block a future unique constraint on
-- albumId/discNumber/trackNumber.
SELECT
	"albumId",
	"discNumber",
	"trackNumber",
	COUNT(*) AS duplicate_count,
	array_agg(id ORDER BY "placementOrder") AS placement_ids
FROM "SongAlbum"
GROUP BY "albumId", "discNumber", "trackNumber"
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, "albumId", "discNumber", "trackNumber";

-- 7. More than one primary image per owner. These block future partial unique
-- indexes on each image table.
SELECT 'ArtistImage' AS table_name, "artistId" AS owner_id, COUNT(*) AS primary_count
FROM "ArtistImage"
WHERE "isPrimary" = true
GROUP BY "artistId"
HAVING COUNT(*) > 1
UNION ALL
SELECT 'AlbumImage' AS table_name, "albumId" AS owner_id, COUNT(*) AS primary_count
FROM "AlbumImage"
WHERE "isPrimary" = true
GROUP BY "albumId"
HAVING COUNT(*) > 1
UNION ALL
SELECT 'SongImage' AS table_name, "songId" AS owner_id, COUNT(*) AS primary_count
FROM "SongImage"
WHERE "isPrimary" = true
GROUP BY "songId"
HAVING COUNT(*) > 1
UNION ALL
SELECT 'FashionTalentImage' AS table_name, "talentId" AS owner_id, COUNT(*) AS primary_count
FROM "FashionTalentImage"
WHERE "isPrimary" = true
GROUP BY "talentId"
HAVING COUNT(*) > 1
UNION ALL
SELECT 'FashionLookImage' AS table_name, "lookId" AS owner_id, COUNT(*) AS primary_count
FROM "FashionLookImage"
WHERE "isPrimary" = true
GROUP BY "lookId"
HAVING COUNT(*) > 1
ORDER BY table_name, owner_id;

-- 8. Fashion credits whose target name cannot be resolved from either a talent,
-- a crew member, or a fallback creditName.
SELECT 'FashionCollectionCredit' AS table_name, id, "collectionId" AS owner_id
FROM "FashionCollectionCredit"
WHERE "talentId" IS NULL
	AND "crewId" IS NULL
	AND btrim("creditName") = ''
UNION ALL
SELECT 'FashionLookCredit' AS table_name, id, "lookId" AS owner_id
FROM "FashionLookCredit"
WHERE "talentId" IS NULL
	AND "crewId" IS NULL
	AND btrim("creditName") = ''
UNION ALL
SELECT 'FashionPieceCredit' AS table_name, id, "pieceId" AS owner_id
FROM "FashionPieceCredit"
WHERE "talentId" IS NULL
	AND "crewId" IS NULL
	AND btrim("creditName") = ''
ORDER BY table_name, owner_id, id;

-- 9. Legacy/data-shape inventory for later contract decisions.
SELECT
	(SELECT COUNT(*) FROM "FashionCollection" WHERE type = 'LOOSE_LOOK') AS loose_look_collections,
	(SELECT COUNT(*) FROM "LyricBlock") AS legacy_lyric_blocks,
	(SELECT COUNT(*) FROM "Annotation") AS legacy_lyric_annotations;
