ALTER TABLE "CompanyProfile"
ADD COLUMN "companyTitle" TEXT NOT NULL DEFAULT '',
ADD COLUMN "companyBio" TEXT NOT NULL DEFAULT '';

UPDATE "CompanyProfile"
SET
    "companyTitle" = 'A label, a fashion desk, and a creative system.',
    "companyBio" = 'The company exists to give independent artists a sharper infrastructure: release strategy, music presentation, visual direction, fashion storytelling, and a home for the work after launch. ASD is built around people, not lanes.'
WHERE "id" = 'main';
