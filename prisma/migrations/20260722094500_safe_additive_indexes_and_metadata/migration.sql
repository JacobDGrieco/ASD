-- AlterTable
ALTER TABLE "MusicOutsideArtist" ADD COLUMN     "normalizedName" TEXT;

-- AlterTable
ALTER TABLE "Song" ADD COLUMN     "createdAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FashionCrew" ADD COLUMN     "normalizedName" TEXT;

-- CreateIndex
CREATE INDEX "MusicOutsideArtist_normalizedName_idx" ON "MusicOutsideArtist"("normalizedName");

-- CreateIndex
CREATE INDEX "Album_artistId_releaseDate_idx" ON "Album"("artistId", "releaseDate");

-- CreateIndex
CREATE INDEX "SongMeta_releaseDate_idx" ON "SongMeta"("releaseDate");

-- CreateIndex
-- Prisma cannot represent JSONB GIN indexes in schema.prisma. The app queries
-- SongMeta.roles with JSON array containment, so keep this raw PostgreSQL index
-- in the migration history and rollback docs.
CREATE INDEX "SongMeta_roles_gin_idx" ON "SongMeta" USING GIN ("roles");

-- CreateIndex
CREATE INDEX "RecordPlayerTrack_active_position_idx" ON "RecordPlayerTrack"("active", "position");

-- CreateIndex
CREATE INDEX "BoardPost_artistId_archivedAt_publishedAt_idx" ON "BoardPost"("artistId", "archivedAt", "publishedAt");

-- CreateIndex
CREATE INDEX "FashionCrew_normalizedName_idx" ON "FashionCrew"("normalizedName");

