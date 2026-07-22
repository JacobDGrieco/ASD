-- Rollback SQL for 20260722094500_safe_additive_indexes_and_metadata.
--
-- This removes only the additive indexes and columns introduced by that
-- migration. Run it manually only against a disposable database or after a
-- verified backup/restore plan for any valuable database.

BEGIN;

DROP INDEX IF EXISTS "FashionCrew_normalizedName_idx";
DROP INDEX IF EXISTS "BoardPost_artistId_archivedAt_publishedAt_idx";
DROP INDEX IF EXISTS "RecordPlayerTrack_active_position_idx";
DROP INDEX IF EXISTS "SongMeta_roles_gin_idx";
DROP INDEX IF EXISTS "SongMeta_releaseDate_idx";
DROP INDEX IF EXISTS "Album_artistId_releaseDate_idx";
DROP INDEX IF EXISTS "MusicOutsideArtist_normalizedName_idx";

ALTER TABLE "FashionCrew" DROP COLUMN IF EXISTS "normalizedName";
ALTER TABLE "Song" DROP COLUMN IF EXISTS "createdAt";
ALTER TABLE "Song" DROP COLUMN IF EXISTS "updatedAt";
ALTER TABLE "MusicOutsideArtist" DROP COLUMN IF EXISTS "normalizedName";

COMMIT;
