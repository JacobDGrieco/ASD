ALTER TABLE "Artist" ADD COLUMN "links" JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "FashionTalent" ADD COLUMN "links" JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE "Artist"
SET "links" =
  CASE WHEN COALESCE("soundcloudProfile", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'soundcloud-professional-0', 'platform', 'soundcloud', 'type', 'professional', 'url', "soundcloudProfile")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("spotifyProfile", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'spotify-professional-1', 'platform', 'spotify', 'type', 'professional', 'url', "spotifyProfile")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("appleMusicProfile", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'appleMusic-professional-2', 'platform', 'appleMusic', 'type', 'professional', 'url', "appleMusicProfile")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("youtubeProfile", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'youtubeMusic-professional-3', 'platform', 'youtubeMusic', 'type', 'professional', 'url', "youtubeProfile")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("instagramProfile", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'instagram-personal-4', 'platform', 'instagram', 'type', 'personal', 'url', "instagramProfile")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("twitterProfile", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'x-personal-5', 'platform', 'x', 'type', 'personal', 'url', "twitterProfile")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("facebookProfile", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'facebook-personal-6', 'platform', 'facebook', 'type', 'personal', 'url', "facebookProfile")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("tiktokProfile", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'tiktok-personal-7', 'platform', 'tiktok', 'type', 'personal', 'url', "tiktokProfile")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("snapchatProfile", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'snapchat-personal-8', 'platform', 'snapchat', 'type', 'personal', 'url', "snapchatProfile")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("youtubeSocialProfile", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'youtube-personal-9', 'platform', 'youtube', 'type', 'personal', 'url', "youtubeSocialProfile")) ELSE '[]'::jsonb END;

UPDATE "FashionTalent"
SET "links" =
  CASE WHEN COALESCE("instagramProfile", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'instagram-personal-0', 'platform', 'instagram', 'type', 'personal', 'url', "instagramProfile")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("tiktokProfile", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'tiktok-personal-1', 'platform', 'tiktok', 'type', 'personal', 'url', "tiktokProfile")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("twitterProfile", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'x-personal-2', 'platform', 'x', 'type', 'personal', 'url', "twitterProfile")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("youtubeProfile", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'youtube-personal-3', 'platform', 'youtube', 'type', 'personal', 'url', "youtubeProfile")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("facebookProfile", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'facebook-personal-4', 'platform', 'facebook', 'type', 'personal', 'url', "facebookProfile")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("website", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'website-professional-5', 'platform', 'website', 'type', 'professional', 'url', "website")) ELSE '[]'::jsonb END ||
  CASE WHEN COALESCE("email", '') <> '' THEN jsonb_build_array(jsonb_build_object('id', 'email-professional-6', 'platform', 'email', 'type', 'professional', 'url', "email")) ELSE '[]'::jsonb END;
