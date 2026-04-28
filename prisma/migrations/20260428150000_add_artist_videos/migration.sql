CREATE TYPE "ArtistVideoSource" AS ENUM ('YOUTUBE', 'UPLOAD');

CREATE TABLE "ArtistVideo" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "posterUrl" TEXT,
    "sourceType" "ArtistVideoSource" NOT NULL,
    "youtubeUrl" TEXT,
    "videoUrl" TEXT,
    "videosPageUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistVideo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArtistVideo_artistId_key" ON "ArtistVideo"("artistId");
CREATE INDEX "ArtistVideo_sortOrder_idx" ON "ArtistVideo"("sortOrder");

ALTER TABLE "ArtistVideo" ADD CONSTRAINT "ArtistVideo_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
