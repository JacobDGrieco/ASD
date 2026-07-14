-- CreateEnum
CREATE TYPE "FashionCollectionType" AS ENUM ('COLLECTION', 'LOOSE_LOOK');

-- AlterTable
ALTER TABLE "FashionCollection" ADD COLUMN "type" "FashionCollectionType" NOT NULL DEFAULT 'COLLECTION';
