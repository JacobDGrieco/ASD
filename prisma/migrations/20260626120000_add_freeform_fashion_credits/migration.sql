-- Allow fashion look and piece credits to represent outside collaborators.

DROP INDEX IF EXISTS "FashionLookCredit_lookId_talentId_roleLabel_key";
DROP INDEX IF EXISTS "FashionPieceCredit_pieceId_talentId_roleLabel_key";

ALTER TABLE "FashionLookCredit"
  ADD COLUMN "creditName" TEXT NOT NULL DEFAULT '',
  ALTER COLUMN "talentId" DROP NOT NULL;

ALTER TABLE "FashionPieceCredit"
  ADD COLUMN "creditName" TEXT NOT NULL DEFAULT '',
  ALTER COLUMN "talentId" DROP NOT NULL;

CREATE INDEX "FashionLookCredit_lookId_talentId_idx" ON "FashionLookCredit"("lookId", "talentId");
CREATE INDEX "FashionPieceCredit_pieceId_talentId_idx" ON "FashionPieceCredit"("pieceId", "talentId");
