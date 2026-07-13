ALTER TABLE "CompanyProfile"
ADD COLUMN "title" TEXT NOT NULL DEFAULT 'ASD Records builds the world around independent artists.';

UPDATE "CompanyProfile"
SET "title" = 'ASD Records builds the world around independent artists.'
WHERE "id" = 'main' AND "title" = '';

ALTER TABLE "CompanyProfile"
DROP COLUMN "companyTitle",
DROP COLUMN "companyBio";
