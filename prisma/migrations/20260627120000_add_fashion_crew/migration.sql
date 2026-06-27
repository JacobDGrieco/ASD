-- AlterTable
ALTER TABLE "FashionLookCredit" ADD COLUMN     "crewId" TEXT;

-- AlterTable
ALTER TABLE "FashionPieceCredit" ADD COLUMN     "crewId" TEXT;

-- CreateTable
CREATE TABLE "FashionCrew" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "pathname" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FashionCrew_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FashionLookCredit_crewId_idx" ON "FashionLookCredit"("crewId");

-- CreateIndex
CREATE INDEX "FashionPieceCredit_crewId_idx" ON "FashionPieceCredit"("crewId");

-- AddForeignKey
ALTER TABLE "FashionLookCredit" ADD CONSTRAINT "FashionLookCredit_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "FashionCrew"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionPieceCredit" ADD CONSTRAINT "FashionPieceCredit_crewId_fkey" FOREIGN KEY ("crewId") REFERENCES "FashionCrew"("id") ON DELETE SET NULL ON UPDATE CASCADE;
