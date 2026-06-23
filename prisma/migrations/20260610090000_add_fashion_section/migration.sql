-- CreateEnum
CREATE TYPE "FashionTalentRole" AS ENUM ('MODEL', 'DESIGNER', 'PHOTOGRAPHER', 'EDITOR', 'STYLIST', 'OTHER');

-- CreateTable
CREATE TABLE "FashionTalent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "role" "FashionTalentRole" NOT NULL,
    "bio" TEXT NOT NULL DEFAULT '',
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "instagramProfile" TEXT,
    "email" TEXT,
    "website" TEXT,
    "agencyName" TEXT,
    "agencyContact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FashionTalent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionTalentImage" (
    "id" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT,
    "usage" TEXT NOT NULL DEFAULT 'portrait',
    "altText" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FashionTalentImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionLook" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FashionLook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionLookImage" (
    "id" TEXT NOT NULL,
    "lookId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT,
    "usage" TEXT NOT NULL DEFAULT 'lookbook',
    "altText" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FashionLookImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionPiece" (
    "id" TEXT NOT NULL,
    "lookId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "buyUrl" TEXT,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "pathname" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FashionPiece_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionLookCredit" (
    "id" TEXT NOT NULL,
    "lookId" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "roleLabel" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FashionLookCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FashionPieceCredit" (
    "id" TEXT NOT NULL,
    "pieceId" TEXT NOT NULL,
    "talentId" TEXT NOT NULL,
    "roleLabel" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FashionPieceCredit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FashionTalent_slug_key" ON "FashionTalent"("slug");

-- CreateIndex
CREATE INDEX "FashionTalent_isVisible_order_idx" ON "FashionTalent"("isVisible", "order");

-- CreateIndex
CREATE INDEX "FashionTalentImage_talentId_sortOrder_idx" ON "FashionTalentImage"("talentId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FashionLook_slug_key" ON "FashionLook"("slug");

-- CreateIndex
CREATE INDEX "FashionLook_isVisible_order_idx" ON "FashionLook"("isVisible", "order");

-- CreateIndex
CREATE INDEX "FashionLookImage_lookId_sortOrder_idx" ON "FashionLookImage"("lookId", "sortOrder");

-- CreateIndex
CREATE INDEX "FashionPiece_lookId_sortOrder_idx" ON "FashionPiece"("lookId", "sortOrder");

-- CreateIndex
CREATE INDEX "FashionLookCredit_lookId_sortOrder_idx" ON "FashionLookCredit"("lookId", "sortOrder");

-- CreateIndex
CREATE INDEX "FashionLookCredit_talentId_idx" ON "FashionLookCredit"("talentId");

-- CreateIndex
CREATE UNIQUE INDEX "FashionLookCredit_lookId_talentId_roleLabel_key" ON "FashionLookCredit"("lookId", "talentId", "roleLabel");

-- CreateIndex
CREATE INDEX "FashionPieceCredit_pieceId_sortOrder_idx" ON "FashionPieceCredit"("pieceId", "sortOrder");

-- CreateIndex
CREATE INDEX "FashionPieceCredit_talentId_idx" ON "FashionPieceCredit"("talentId");

-- CreateIndex
CREATE UNIQUE INDEX "FashionPieceCredit_pieceId_talentId_roleLabel_key" ON "FashionPieceCredit"("pieceId", "talentId", "roleLabel");

-- AddForeignKey
ALTER TABLE "FashionTalentImage" ADD CONSTRAINT "FashionTalentImage_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "FashionTalent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionLookImage" ADD CONSTRAINT "FashionLookImage_lookId_fkey" FOREIGN KEY ("lookId") REFERENCES "FashionLook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionPiece" ADD CONSTRAINT "FashionPiece_lookId_fkey" FOREIGN KEY ("lookId") REFERENCES "FashionLook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionLookCredit" ADD CONSTRAINT "FashionLookCredit_lookId_fkey" FOREIGN KEY ("lookId") REFERENCES "FashionLook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionLookCredit" ADD CONSTRAINT "FashionLookCredit_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "FashionTalent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionPieceCredit" ADD CONSTRAINT "FashionPieceCredit_pieceId_fkey" FOREIGN KEY ("pieceId") REFERENCES "FashionPiece"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FashionPieceCredit" ADD CONSTRAINT "FashionPieceCredit_talentId_fkey" FOREIGN KEY ("talentId") REFERENCES "FashionTalent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
