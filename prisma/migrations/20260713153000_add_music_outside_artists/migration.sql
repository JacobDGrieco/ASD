CREATE TABLE "MusicOutsideArtist" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "externalUrl" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MusicOutsideArtist_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MusicOutsideArtist_name_idx" ON "MusicOutsideArtist"("name");
