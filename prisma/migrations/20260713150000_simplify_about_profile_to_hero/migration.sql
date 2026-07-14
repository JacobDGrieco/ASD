ALTER TABLE "CompanyProfile"
ADD COLUMN "title" TEXT NOT NULL DEFAULT 'A.S.D. builds the world around independent artists.';

UPDATE "CompanyProfile"
SET "title" = 'A.S.D. builds the world around independent artists.'
WHERE "id" = 'main' AND "title" = '';

ALTER TABLE "CompanyProfile"
DROP COLUMN "companyTitle",
DROP COLUMN "companyBio";
