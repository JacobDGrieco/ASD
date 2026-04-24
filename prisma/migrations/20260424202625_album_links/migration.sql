-- CreateEnum
CREATE TYPE "AlbumType" AS ENUM ('ALBUM', 'SINGLE', 'EP');

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "aboutMe" TEXT NOT NULL DEFAULT '',
    "portrait" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "soundcloudProfile" TEXT,
    "spotifyProfile" TEXT,
    "appleMusicProfile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "AlbumType" NOT NULL,
    "coverArt" TEXT NOT NULL DEFAULT '',
    "aboutText" TEXT NOT NULL DEFAULT '',
    "soundcloudUrl" TEXT,
    "spotifyUrl" TEXT,
    "appleMusicUrl" TEXT,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "artistId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "trackNumber" INTEGER NOT NULL,
    "discNumber" INTEGER NOT NULL DEFAULT 1,
    "duration" TEXT NOT NULL DEFAULT '',
    "soundcloudUrl" TEXT,
    "spotifyUrl" TEXT,
    "appleMusicUrl" TEXT,
    "albumId" TEXT NOT NULL,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongMeta" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "aboutText" TEXT NOT NULL DEFAULT '',
    "producers" TEXT NOT NULL DEFAULT '',
    "writers" TEXT NOT NULL DEFAULT '',
    "releaseDate" TIMESTAMP(3),

    CONSTRAINT "SongMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LyricBlock" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "blockOrder" INTEGER NOT NULL,

    CONSTRAINT "LyricBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Annotation" (
    "id" TEXT NOT NULL,
    "lyricBlockId" TEXT NOT NULL,
    "startChar" INTEGER NOT NULL,
    "endChar" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,

    CONSTRAINT "Annotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordPlayerTrack" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RecordPlayerTrack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Artist_slug_key" ON "Artist"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Album_slug_key" ON "Album"("slug");

-- CreateIndex
CREATE INDEX "Album_artistId_idx" ON "Album"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "Song_slug_key" ON "Song"("slug");

-- CreateIndex
CREATE INDEX "Song_albumId_idx" ON "Song"("albumId");

-- CreateIndex
CREATE UNIQUE INDEX "SongMeta_songId_key" ON "SongMeta"("songId");

-- CreateIndex
CREATE INDEX "LyricBlock_songId_idx" ON "LyricBlock"("songId");

-- CreateIndex
CREATE INDEX "Annotation_lyricBlockId_idx" ON "Annotation"("lyricBlockId");

-- CreateIndex
CREATE INDEX "RecordPlayerTrack_songId_idx" ON "RecordPlayerTrack"("songId");

-- CreateIndex
CREATE UNIQUE INDEX "RecordPlayerTrack_position_key" ON "RecordPlayerTrack"("position");

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongMeta" ADD CONSTRAINT "SongMeta_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LyricBlock" ADD CONSTRAINT "LyricBlock_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_lyricBlockId_fkey" FOREIGN KEY ("lyricBlockId") REFERENCES "LyricBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordPlayerTrack" ADD CONSTRAINT "RecordPlayerTrack_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
