ALTER TABLE "ArtistAdminAccess"
ADD COLUMN "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN "pageAccess" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "ArtistAdminAccess"
SET "pageAccess" = '["board","music_albums","music_songs","music_videos"]'::jsonb
WHERE "pageAccess" = '[]'::jsonb;

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

CREATE UNIQUE INDEX "FashionTalentAdminAccess_talentId_key" ON "FashionTalentAdminAccess"("talentId");

ALTER TABLE "FashionTalentAdminAccess"
ADD CONSTRAINT "FashionTalentAdminAccess_talentId_fkey"
FOREIGN KEY ("talentId") REFERENCES "FashionTalent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
