ALTER TABLE "Song"
ADD COLUMN "artwork" TEXT NOT NULL DEFAULT '';

ALTER TABLE "SongMeta"
ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "SongImage" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT,
    "usage" TEXT NOT NULL DEFAULT 'artwork',
    "altText" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SongImage_songId_sortOrder_idx" ON "SongImage"("songId", "sortOrder");

ALTER TABLE "SongImage"
ADD CONSTRAINT "SongImage_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
