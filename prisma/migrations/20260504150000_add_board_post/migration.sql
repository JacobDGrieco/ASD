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

CREATE INDEX "BoardPost_artistId_idx" ON "BoardPost"("artistId");
CREATE INDEX "BoardPost_publishedAt_idx" ON "BoardPost"("publishedAt");

ALTER TABLE "BoardPost"
  ADD CONSTRAINT "BoardPost_artistId_fkey"
  FOREIGN KEY ("artistId") REFERENCES "Artist"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
