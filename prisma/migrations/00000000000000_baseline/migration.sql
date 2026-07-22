-- CreateEnum
CREATE TYPE "AlbumType" AS ENUM ('ALBUM', 'SINGLE', 'EP');

-- CreateEnum
CREATE TYPE "ArtistVideoSource" AS ENUM ('YOUTUBE', 'UPLOAD');

-- CreateEnum
CREATE TYPE "CrosshairVideoType" AS ENUM ('UNCUT', 'EDITED', 'SHORT');

-- CreateEnum
CREATE TYPE "FashionCollectionType" AS ENUM ('COLLECTION', 'LOOSE_LOOK');

-- CreateEnum
CREATE TYPE "FashionTalentRole" AS ENUM ('MODEL', 'DESIGNER', 'PHOTOGRAPHER', 'EDITOR', 'STYLIST', 'OTHER');

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "bio" TEXT NOT NULL DEFAULT '',
    "aboutMe" TEXT NOT NULL DEFAULT '',
    "portrait" TEXT NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    "soundcloudProfile" TEXT,
    "spotifyProfile" TEXT,
    "appleMusicProfile" TEXT,
    "youtubeProfile" TEXT,
    "instagramProfile" TEXT,
    "twitterProfile" TEXT,
    "facebookProfile" TEXT,
    "tiktokProfile" TEXT,
    "snapchatProfile" TEXT,
    "youtubeSocialProfile" TEXT,
    "links" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MusicOutsideArtist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "externalUrl" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "pathname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicOutsideArtist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistVideo" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "posterUrl" TEXT,
    "posterPathname" TEXT,
    "sourceType" "ArtistVideoSource",
    "youtubeUrl" TEXT,
    "videoUrl" TEXT,
    "videosPageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrosshairVideo" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "artistName" TEXT,
    "type" "CrosshairVideoType" NOT NULL DEFAULT 'UNCUT',
    "youtubeVideoId" TEXT,
    "youtubeUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "thumbnailPathname" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "durationSeconds" INTEGER,
    "privacyStatus" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrosshairVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistAdminAccess" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "pageAccess" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistAdminAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "autoShowOnRelease" BOOLEAN NOT NULL DEFAULT false,
    "type" "AlbumType" NOT NULL,
    "coverArt" TEXT NOT NULL DEFAULT '',
    "otherArtistName" TEXT,
    "aboutText" TEXT NOT NULL DEFAULT '',
    "soundcloudUrl" TEXT,
    "spotifyUrl" TEXT,
    "appleMusicUrl" TEXT,
    "youtubeUrl" TEXT,
    "links" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "roles" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "artistId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistImage" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT,
    "usage" TEXT NOT NULL DEFAULT 'portrait',
    "altText" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlbumImage" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT,
    "usage" TEXT NOT NULL DEFAULT 'cover',
    "altText" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlbumImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "autoShowOnRelease" BOOLEAN NOT NULL DEFAULT false,
    "duration" TEXT NOT NULL DEFAULT '',
    "artwork" TEXT NOT NULL DEFAULT '',
    "soundcloudUrl" TEXT,
    "privateSoundcloudUrl" TEXT,
    "spotifyUrl" TEXT,
    "appleMusicUrl" TEXT,
    "youtubeUrl" TEXT,
    "links" JSONB NOT NULL DEFAULT '[]'::jsonb,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongAlbum" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "trackNumber" INTEGER NOT NULL,
    "discNumber" INTEGER NOT NULL DEFAULT 1,
    "placementOrder" INTEGER NOT NULL,

    CONSTRAINT "SongAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "SongMeta" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "aboutText" TEXT NOT NULL DEFAULT '',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bpm" TEXT NOT NULL DEFAULT '',
    "key" TEXT NOT NULL DEFAULT '',
    "releaseDate" TIMESTAMP(3),
    "roles" JSONB NOT NULL DEFAULT '[]'::jsonb,

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
CREATE TABLE "SongLyric" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "syncedLines" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongLyric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongAnnotation" (
    "id" TEXT NOT NULL,
    "songLyricId" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SongAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SongAnnotationRange" (
    "id" TEXT NOT NULL,
    "songAnnotationId" TEXT NOT NULL,
    "startChar" INTEGER NOT NULL,
    "endChar" INTEGER NOT NULL,

    CONSTRAINT "SongAnnotationRange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecordPlayerTrack" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RecordPlayerTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardPost" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT,
    "posX" DOUBLE PRECISION,
    "posY" DOUBLE PRECISION,
    "rotation" DOUBLE PRECISION,
    "positionPinnedUntil" TIMESTAMP(3),
    "pinColor" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "title" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "imagePathname" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionTalent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "role" "FashionTalentRole" NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "instagramProfile" TEXT,
    "tiktokProfile" TEXT,
    "twitterProfile" TEXT,
    "youtubeProfile" TEXT,
    "facebookProfile" TEXT,
    "email" TEXT,
    "website" TEXT,
    "links" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "agencyName" TEXT,
    "agencyContact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FashionTalent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionTalentAdminAccess" (
    "id" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "pageAccess" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FashionTalentAdminAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionTalentImage" (
    "id" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT,
    "usage" TEXT NOT NULL DEFAULT 'portrait',
    "altText" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FashionTalentImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionCollection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "FashionCollectionType" NOT NULL DEFAULT 'COLLECTION',
    "description" TEXT NOT NULL DEFAULT '',
    "about" TEXT NOT NULL DEFAULT '',
    "season" TEXT NOT NULL DEFAULT '',
    "releaseDate" TIMESTAMP(3),
    "location" TEXT NOT NULL DEFAULT '',
    "coverImage" TEXT NOT NULL DEFAULT '',
    "coverPathname" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "creatorTalentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FashionCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionLookCollection" (
    "id" TEXT NOT NULL,
    "lookId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FashionLookCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionCollectionCredit" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "talentId" TEXT,
    "crewId" TEXT,
    "creditName" TEXT NOT NULL DEFAULT '',
    "roleLabel" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FashionCollectionCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionLook" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "releaseDate" TIMESTAMP(3),
    "order" INTEGER NOT NULL DEFAULT 0,
    "creatorTalentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FashionLook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionLookImage" (
    "id" TEXT NOT NULL,
    "lookId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT,
    "usage" TEXT NOT NULL DEFAULT 'lookbook',
    "altText" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FashionLookImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionPiece" (
    "id" TEXT NOT NULL,
    "lookId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "buyUrl" TEXT,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "pathname" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FashionPiece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionLookCredit" (
    "id" TEXT NOT NULL,
    "lookId" TEXT NOT NULL,
    "talentId" TEXT,
    "crewId" TEXT,
    "creditName" TEXT NOT NULL DEFAULT '',
    "roleLabel" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FashionLookCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionPieceCredit" (
    "id" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "talentId" TEXT,
    "crewId" TEXT,
    "creditName" TEXT NOT NULL DEFAULT '',
    "roleLabel" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FashionPieceCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionCrew" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "externalUrl" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "pathname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FashionCrew_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Artist_slug_key" ON "Artist"("slug");

-- CreateIndex
CREATE INDEX "MusicOutsideArtist_name_idx" ON "MusicOutsideArtist"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistVideo_artistId_key" ON "ArtistVideo"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "CrosshairVideo_youtubeVideoId_key" ON "CrosshairVideo"("youtubeVideoId");

-- CreateIndex
CREATE INDEX "CrosshairVideo_isVisible_type_sortOrder_idx" ON "CrosshairVideo"("isVisible", "type", "sortOrder");

-- CreateIndex
CREATE INDEX "CrosshairVideo_publishedAt_idx" ON "CrosshairVideo"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ArtistAdminAccess_artistId_key" ON "ArtistAdminAccess"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "Album_slug_key" ON "Album"("slug");

-- CreateIndex
CREATE INDEX "Album_artistId_idx" ON "Album"("artistId");

-- CreateIndex
CREATE INDEX "ArtistImage_artistId_sortOrder_idx" ON "ArtistImage"("artistId", "sortOrder");

-- CreateIndex
CREATE INDEX "AlbumImage_albumId_sortOrder_idx" ON "AlbumImage"("albumId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Song_slug_key" ON "Song"("slug");

-- CreateIndex
CREATE INDEX "SongAlbum_songId_placementOrder_idx" ON "SongAlbum"("songId", "placementOrder");

-- CreateIndex
CREATE INDEX "SongAlbum_albumId_discNumber_trackNumber_idx" ON "SongAlbum"("albumId", "discNumber", "trackNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SongAlbum_songId_albumId_key" ON "SongAlbum"("songId", "albumId");

-- CreateIndex
CREATE INDEX "SongImage_songId_sortOrder_idx" ON "SongImage"("songId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SongMeta_songId_key" ON "SongMeta"("songId");

-- CreateIndex
CREATE INDEX "LyricBlock_songId_idx" ON "LyricBlock"("songId");

-- CreateIndex
CREATE INDEX "Annotation_lyricBlockId_idx" ON "Annotation"("lyricBlockId");

-- CreateIndex
CREATE UNIQUE INDEX "SongLyric_songId_key" ON "SongLyric"("songId");

-- CreateIndex
CREATE INDEX "SongAnnotation_songLyricId_idx" ON "SongAnnotation"("songLyricId");

-- CreateIndex
CREATE INDEX "SongAnnotationRange_songAnnotationId_idx" ON "SongAnnotationRange"("songAnnotationId");

-- CreateIndex
CREATE INDEX "RecordPlayerTrack_songId_idx" ON "RecordPlayerTrack"("songId");

-- CreateIndex
CREATE UNIQUE INDEX "RecordPlayerTrack_position_key" ON "RecordPlayerTrack"("position");

-- CreateIndex
CREATE INDEX "BoardPost_artistId_idx" ON "BoardPost"("artistId");

-- CreateIndex
CREATE INDEX "BoardPost_publishedAt_idx" ON "BoardPost"("publishedAt");

-- CreateIndex
CREATE INDEX "CompanyMember_isVisible_sortOrder_idx" ON "CompanyMember"("isVisible", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FashionTalent_slug_key" ON "FashionTalent"("slug");

-- CreateIndex
CREATE INDEX "FashionTalent_isVisible_order_idx" ON "FashionTalent"("isVisible", "order");

-- CreateIndex
CREATE UNIQUE INDEX "FashionTalentAdminAccess_talentId_key" ON "FashionTalentAdminAccess"("talentId");

-- CreateIndex
CREATE INDEX "FashionTalentImage_talentId_sortOrder_idx" ON "FashionTalentImage"("talentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FashionCollection_slug_key" ON "FashionCollection"("slug");

-- CreateIndex
CREATE INDEX "FashionCollection_isVisible_releaseDate_idx" ON "FashionCollection"("isVisible", "releaseDate");

-- CreateIndex
CREATE INDEX "FashionCollection_isVisible_order_idx" ON "FashionCollection"("isVisible", "order");

-- CreateIndex
CREATE INDEX "FashionCollection_creatorTalentId_idx" ON "FashionCollection"("creatorTalentId");

-- CreateIndex
CREATE INDEX "FashionLookCollection_collectionId_sortOrder_idx" ON "FashionLookCollection"("collectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "FashionLookCollection_lookId_idx" ON "FashionLookCollection"("lookId");

-- CreateIndex
CREATE UNIQUE INDEX "FashionLookCollection_lookId_collectionId_key" ON "FashionLookCollection"("lookId", "collectionId");

-- CreateIndex
CREATE INDEX "FashionCollectionCredit_collectionId_sortOrder_idx" ON "FashionCollectionCredit"("collectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "FashionCollectionCredit_talentId_idx" ON "FashionCollectionCredit"("talentId");

-- CreateIndex
CREATE INDEX "FashionCollectionCredit_crewId_idx" ON "FashionCollectionCredit"("crewId");

-- CreateIndex
CREATE UNIQUE INDEX "FashionLook_slug_key" ON "FashionLook"("slug");

-- CreateIndex
CREATE INDEX "FashionLook_isVisible_order_idx" ON "FashionLook"("isVisible", "order");

-- CreateIndex
CREATE INDEX "FashionLook_isVisible_releaseDate_idx" ON "FashionLook"("isVisible", "releaseDate");

-- CreateIndex
CREATE INDEX "FashionLook_creatorTalentId_idx" ON "FashionLook"("creatorTalentId");

-- CreateIndex
CREATE INDEX "FashionLookImage_lookId_sortOrder_idx" ON "FashionLookImage"("lookId", "sortOrder");

-- CreateIndex
CREATE INDEX "FashionPiece_lookId_sortOrder_idx" ON "FashionPiece"("lookId", "sortOrder");

-- CreateIndex
CREATE INDEX "FashionLookCredit_lookId_sortOrder_idx" ON "FashionLookCredit"("lookId", "sortOrder");

-- CreateIndex
CREATE INDEX "FashionLookCredit_lookId_talentId_idx" ON "FashionLookCredit"("lookId", "talentId");

-- CreateIndex
CREATE INDEX "FashionLookCredit_talentId_idx" ON "FashionLookCredit"("talentId");

-- CreateIndex
CREATE INDEX "FashionLookCredit_crewId_idx" ON "FashionLookCredit"("crewId");

-- CreateIndex
CREATE INDEX "FashionPieceCredit_pieceId_sortOrder_idx" ON "FashionPieceCredit"("pieceId", "sortOrder");

-- CreateIndex
CREATE INDEX "FashionPieceCredit_pieceId_talentId_idx" ON "FashionPieceCredit"("pieceId", "talentId");

-- CreateIndex
CREATE INDEX "FashionPieceCredit_talentId_idx" ON "FashionPieceCredit"("talentId");

-- CreateIndex
CREATE INDEX "FashionPieceCredit_crewId_idx" ON "FashionPieceCredit"("crewId");

-- AddForeignKey
ALTER TABLE "ArtistVideo" ADD CONSTRAINT "ArtistVideo_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistAdminAccess" ADD CONSTRAINT "ArtistAdminAccess_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistImage" ADD CONSTRAINT "ArtistImage_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlbumImage" ADD CONSTRAINT "AlbumImage_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongAlbum" ADD CONSTRAINT "SongAlbum_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongAlbum" ADD CONSTRAINT "SongAlbum_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongImage" ADD CONSTRAINT "SongImage_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongMeta" ADD CONSTRAINT "SongMeta_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LyricBlock" ADD CONSTRAINT "LyricBlock_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Annotation" ADD CONSTRAINT "Annotation_lyricBlockId_fkey" FOREIGN KEY ("lyricBlockId") REFERENCES "LyricBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongLyric" ADD CONSTRAINT "SongLyric_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongAnnotation" ADD CONSTRAINT "SongAnnotation_songLyricId_fkey" FOREIGN KEY ("songLyricId") REFERENCES "SongLyric"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SongAnnotationRange" ADD CONSTRAINT "SongAnnotationRange_songAnnotationId_fkey" FOREIGN KEY ("songAnnotationId") REFERENCES "SongAnnotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordPlayerTrack" ADD CONSTRAINT "RecordPlayerTrack_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardPost" ADD CONSTRAINT "BoardPost_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionTalentAdminAccess" ADD CONSTRAINT "FashionTalentAdminAccess_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "FashionTalent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionTalentImage" ADD CONSTRAINT "FashionTalentImage_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "FashionTalent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionCollection" ADD CONSTRAINT "FashionCollection_creatorTalentId_fkey" FOREIGN KEY ("creatorTalentId") REFERENCES "FashionTalent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionLookCollection" ADD CONSTRAINT "FashionLookCollection_lookId_fkey" FOREIGN KEY ("lookId") REFERENCES "FashionLook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionLookCollection" ADD CONSTRAINT "FashionLookCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FashionCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionCollectionCredit" ADD CONSTRAINT "FashionCollectionCredit_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FashionCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionCollectionCredit" ADD CONSTRAINT "FashionCollectionCredit_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "FashionTalent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionCollectionCredit" ADD CONSTRAINT "FashionCollectionCredit_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "FashionCrew"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionLook" ADD CONSTRAINT "FashionLook_creatorTalentId_fkey" FOREIGN KEY ("creatorTalentId") REFERENCES "FashionTalent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionLookImage" ADD CONSTRAINT "FashionLookImage_lookId_fkey" FOREIGN KEY ("lookId") REFERENCES "FashionLook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionPiece" ADD CONSTRAINT "FashionPiece_lookId_fkey" FOREIGN KEY ("lookId") REFERENCES "FashionLook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionLookCredit" ADD CONSTRAINT "FashionLookCredit_lookId_fkey" FOREIGN KEY ("lookId") REFERENCES "FashionLook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionLookCredit" ADD CONSTRAINT "FashionLookCredit_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "FashionTalent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionLookCredit" ADD CONSTRAINT "FashionLookCredit_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "FashionCrew"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionPieceCredit" ADD CONSTRAINT "FashionPieceCredit_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "FashionPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionPieceCredit" ADD CONSTRAINT "FashionPieceCredit_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "FashionTalent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionPieceCredit" ADD CONSTRAINT "FashionPieceCredit_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "FashionCrew"("id") ON DELETE SET NULL ON UPDATE CASCADE;

