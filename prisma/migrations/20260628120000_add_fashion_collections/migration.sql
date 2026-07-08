-- AlterTable
ALTER TABLE "FashionLook" ADD COLUMN     "collectionId" TEXT;

-- CreateTable
CREATE TABLE "FashionCollection" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "about" TEXT NOT NULL DEFAULT '',
    "season" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "coverImage" TEXT NOT NULL DEFAULT '',
    "coverPathname" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FashionCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionCollectionCredit" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "talentId" TEXT,
    "crewId" TEXT,
    "creditName" TEXT NOT NULL DEFAULT '',
    "roleLabel" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FashionCollectionCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FashionCollection_slug_key" ON "FashionCollection"("slug");

-- CreateIndex
CREATE INDEX "FashionCollection_isVisible_order_idx" ON "FashionCollection"("isVisible", "order");

-- CreateIndex
CREATE INDEX "FashionCollectionCredit_collectionId_sortOrder_idx" ON "FashionCollectionCredit"("collectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "FashionCollectionCredit_talentId_idx" ON "FashionCollectionCredit"("talentId");

-- CreateIndex
CREATE INDEX "FashionCollectionCredit_crewId_idx" ON "FashionCollectionCredit"("crewId");

-- CreateIndex
CREATE INDEX "FashionLook_collectionId_idx" ON "FashionLook"("collectionId");

-- AddForeignKey
ALTER TABLE "FashionLook" ADD CONSTRAINT "FashionLook_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FashionCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionCollectionCredit" ADD CONSTRAINT "FashionCollectionCredit_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "FashionCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionCollectionCredit" ADD CONSTRAINT "FashionCollectionCredit_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "FashionTalent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionCollectionCredit" ADD CONSTRAINT "FashionCollectionCredit_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "FashionCrew"("id") ON DELETE SET NULL ON UPDATE CASCADE;
