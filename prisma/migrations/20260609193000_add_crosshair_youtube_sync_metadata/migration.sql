ALTER TABLE "CrosshairVideo"
ADD COLUMN "youtubeVideoId" TEXT,
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "durationSeconds" INTEGER,
ADD COLUMN "privacyStatus" TEXT,
ADD COLUMN "lastSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "CrosshairVideo_youtubeVideoId_key" ON "CrosshairVideo"("youtubeVideoId");
