CREATE TABLE "ArtistAdminAccess" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtistAdminAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ArtistAdminAccess_artistId_key" ON "ArtistAdminAccess"("artistId");

ALTER TABLE "ArtistAdminAccess" ADD CONSTRAINT "ArtistAdminAccess_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
