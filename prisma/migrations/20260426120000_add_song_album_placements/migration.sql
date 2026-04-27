CREATE TABLE "SongAlbum" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "trackNumber" INTEGER NOT NULL,
    "discNumber" INTEGER NOT NULL DEFAULT 1,
    "placementOrder" INTEGER NOT NULL,

    CONSTRAINT "SongAlbum_pkey" PRIMARY KEY ("id")
);

INSERT INTO "SongAlbum" ("id", "songId", "albumId", "trackNumber", "discNumber", "placementOrder")
SELECT
    CONCAT("id", '_', "albumId"),
    "id",
    "albumId",
    "trackNumber",
    "discNumber",
    0
FROM "Song";

CREATE UNIQUE INDEX "SongAlbum_songId_albumId_key" ON "SongAlbum"("songId", "albumId");
CREATE INDEX "SongAlbum_songId_placementOrder_idx" ON "SongAlbum"("songId", "placementOrder");
CREATE INDEX "SongAlbum_albumId_discNumber_trackNumber_idx" ON "SongAlbum"("albumId", "discNumber", "trackNumber");

ALTER TABLE "SongAlbum" ADD CONSTRAINT "SongAlbum_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SongAlbum" ADD CONSTRAINT "SongAlbum_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "Song_albumId_idx";

ALTER TABLE "Song" DROP CONSTRAINT "Song_albumId_fkey";

ALTER TABLE "Song"
DROP COLUMN "albumId",
DROP COLUMN "discNumber",
DROP COLUMN "trackNumber";
