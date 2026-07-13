CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "bio" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "imagePathname" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyMember_isVisible_sortOrder_idx" ON "CompanyMember"("isVisible", "sortOrder");

INSERT INTO "CompanyProfile" ("id", "bio", "updatedAt")
VALUES (
    'main',
    'ASD Records is a music label, fashion vertical, and creative operations company for artists who move outside the expected lane. The company pairs releases, visuals, editorial work, and live-facing media into one connected platform.',
    CURRENT_TIMESTAMP
);

INSERT INTO "CompanyMember" ("id", "name", "role", "bio", "imageUrl", "sortOrder", "updatedAt")
VALUES
    (
        'alex-rivers',
        'Alex Rivers',
        'Founder / Executive Director',
        'Alex guides ASD Records as an independent house for artists who need room to build a complete world around their releases. Their work spans artist development, release planning, and the long-term shape of the company.',
        'https://picsum.photos/seed/asd-founder-alex/720/720',
        0,
        CURRENT_TIMESTAMP
    ),
    (
        'mara-vale',
        'Mara Vale',
        'Creative Director',
        'Mara leads the visual language across music, fashion, campaigns, and live presentation. She connects the label sound to the imagery, styling, and editorial systems that make each project feel distinct.',
        'https://picsum.photos/seed/asd-founder-mara/720/720',
        1,
        CURRENT_TIMESTAMP
    ),
    (
        'theo-knox',
        'Theo Knox',
        'Head of Operations',
        'Theo keeps the company moving from backend systems to release logistics. His role is to make sure the creative side has the structure, timing, and production support it needs.',
        'https://picsum.photos/seed/asd-founder-theo/720/720',
        2,
        CURRENT_TIMESTAMP
    );
