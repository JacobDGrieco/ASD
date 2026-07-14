-- AlterTable
ALTER TABLE "FashionLook" ADD COLUMN "releaseDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FashionLookCollection" (
    "id" TEXT NOT NULL,
    "lookId" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FashionLookCollection_pkey" PRIMARY KEY ("id")
);

-- Migrate existing one-to-one collection assignments into placements.
INSERT INTO "FashionLookCollection" ("id", "lookId", "collectionId", "sortOrder")
SELECT "id" || '_' || "collectionId", "id", "collectionId", "order"
FROM "FashionLook"
WHERE "collectionId" IS NOT NULL;

-- Drop old direct relationship.
ALTER TABLE "FashionLook" DROP CONSTRAINT IF EXISTS "FashionLook_collectionId_fkey";
DROP INDEX IF EXISTS "FashionLook_collectionId_idx";
ALTER TABLE "FashionLook" DROP COLUMN "collectionId";

-- CreateIndex
CREATE UNIQUE INDEX "FashionLookCollection_lookId_collectionId_key" ON "FashionLookCollection"("lookId", "collectionId");

-- CreateIndex
CREATE INDEX "FashionLookCollection_collectionId_sortOrder_idx" ON "FashionLookCollection"("collectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "FashionLookCollection_lookId_idx" ON "FashionLookCollection"("lookId");

-- CreateIndex
CREATE INDEX "FashionLook_isVisible_releaseDate_idx" ON "FashionLook"("isVisible", "releaseDate");

-- AddForeignKey
ALTER TABLE "FashionLookCollection" ADD CONSTRAINT "FashionLookCollection_lookId_fkey" FOREIGN KEY ("lookId") REFERENCES "FashionLook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionLookCollection" ADD CONSTRAINT "FashionLookCollection_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FashionCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
