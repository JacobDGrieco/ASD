ALTER TABLE "Album" ADD COLUMN "links" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "Song" ADD COLUMN "links" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "Album"
SET "links" =
  CASE WHEN COALESCE("soundcloudUrl", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'soundcloud-professional-0', 'platform', 'soundcloud', 'type', 'professional', 'url', "soundcloudUrl")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("spotifyUrl", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'spotify-professional-1', 'platform', 'spotify', 'type', 'professional', 'url', "spotifyUrl")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("appleMusicUrl", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'appleMusic-professional-2', 'platform', 'appleMusic', 'type', 'professional', 'url', "appleMusicUrl")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("youtubeUrl", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'youtube-professional-3', 'platform', 'youtube', 'type', 'professional', 'url', "youtubeUrl")) ELSE '[]'::jsonb END;

UPDATE "Song"
SET "links" =
  CASE WHEN COALESCE("soundcloudUrl", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'soundcloud-professional-0', 'platform', 'soundcloud', 'type', 'professional', 'url', "soundcloudUrl")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("spotifyUrl", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'spotify-professional-1', 'platform', 'spotify', 'type', 'professional', 'url', "spotifyUrl")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("appleMusicUrl", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'appleMusic-professional-2', 'platform', 'appleMusic', 'type', 'professional', 'url', "appleMusicUrl")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("youtubeUrl", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'youtube-professional-3', 'platform', 'youtube', 'type', 'professional', 'url', "youtubeUrl")) ELSE '[]'::jsonb END;
