ALTER TABLE "ArtistVideo"
  ALTER COLUMN "title" DROP NOT NULL,
  ALTER COLUMN "description" DROP NOT NULL,
  ALTER COLUMN "description" DROP DEFAULT,
  ALTER COLUMN "sourceType" DROP NOT NULL;

ALTER TABLE "ArtistVideo"
  ADD COLUMN "posterPathname" TEXT;

DROP INDEX IF EXISTS "ArtistVideo_sortOrder_idx";

ALTER TABLE "ArtistVideo"
  DROP COLUMN IF EXISTS "sortOrder";

INSERT INTO "ArtistVideo" ("id", "artistId", "createdAt", "updatedAt")
SELECT
  'av_' || substr(md5("id"), 1, 21),
  "id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Artist"
WHERE NOT EXISTS (
  SELECT 1 FROM "ArtistVideo" WHERE "ArtistVideo"."artistId" = "Artist"."id"
);
