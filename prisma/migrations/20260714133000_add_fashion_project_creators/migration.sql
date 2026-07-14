ALTER TABLE "FashionCollection" ADD COLUMN "creatorTalentId" TEXT;

ALTER TABLE "FashionLook" ADD COLUMN "creatorTalentId" TEXT;

CREATE INDEX "FashionCollection_creatorTalentId_idx" ON "FashionCollection"("creatorTalentId");

CREATE INDEX "FashionLook_creatorTalentId_idx" ON "FashionLook"("creatorTalentId");

ALTER TABLE "FashionCollection"
  ADD CONSTRAINT "FashionCollection_creatorTalentId_fkey"
  FOREIGN KEY ("creatorTalentId") REFERENCES "FashionTalent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FashionLook"
  ADD CONSTRAINT "FashionLook_creatorTalentId_fkey"
  FOREIGN KEY ("creatorTalentId") REFERENCES "FashionTalent"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
