CREATE TYPE "CrosshairVideoType" AS ENUM ('UNCUT', 'EDITED', 'SHORT');

CREATE TABLE "CrosshairVideo" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "artistName" TEXT,
    "type" "CrosshairVideoType" NOT NULL DEFAULT 'UNCUT',
    "youtubeUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "thumbnailPathname" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrosshairVideo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrosshairVideo_isVisible_type_sortOrder_idx" ON "CrosshairVideo"("isVisible", "type", "sortOrder");
CREATE INDEX "CrosshairVideo_publishedAt_idx" ON "CrosshairVideo"("publishedAt");
