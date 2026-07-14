-- AlterTable
ALTER TABLE "FashionCollection" ADD COLUMN "releaseDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "FashionCollection_isVisible_releaseDate_idx" ON "FashionCollection"("isVisible", "releaseDate");
