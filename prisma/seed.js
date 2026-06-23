import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  await prisma.fashionPieceCredit.deleteMany()
  await prisma.fashionLookCredit.deleteMany()
  await prisma.fashionPiece.deleteMany()
  await prisma.fashionLookImage.deleteMany()
  await prisma.fashionLook.deleteMany()
  await prisma.fashionTalentImage.deleteMany()
  await prisma.fashionTalent.deleteMany()
  await prisma.annotation.deleteMany()
  await prisma.lyricBlock.deleteMany()
  await prisma.songMeta.deleteMany()
  await prisma.recordPlayerTrack.deleteMany()
  await prisma.songImage.deleteMany()
  await prisma.songAlbum.deleteMany()
  await prisma.song.deleteMany()
  await prisma.albumImage.deleteMany()
  await prisma.album.deleteMany()
  await prisma.artistImage.deleteMany()
  await prisma.artist.deleteMany()

  const artists = [
    { name: 'Artist One', slug: 'artist-one', bio: 'Hard rap from the underground.', aboutMe: 'Artist One has been crafting raw, unfiltered verses since 2018. Known for dense wordplay and unflinching honesty.' },
    { name: 'Artist Two', slug: 'artist-two', bio: 'Melancholic bars over ambient production.', aboutMe: 'Artist Two blends sad rap with atmospheric textures, creating soundscapes that linger long after the track ends.' },
    { name: 'Artist Three', slug: 'artist-three', bio: 'Ambient textures meet introspective lyricism.', aboutMe: 'Artist Three occupies the space between music and meditation, crafting pieces that defy easy categorization.' },
    { name: 'Artist Four', slug: 'artist-four', bio: 'Street poetry with cinematic production.', aboutMe: 'Artist Four draws from lived experience, painting vivid pictures with every bar over lush, orchestral beats.' },
    { name: 'Artist Five', slug: 'artist-five', bio: 'Dark, brooding rap with experimental edges.', aboutMe: 'Artist Five pushes the boundaries of the genre, incorporating industrial sounds and unconventional song structures.' },
  ]

  for (let i = 0; i < artists.length; i++) {
    const artistSeed = artists[i]
    const portraitUrl = `https://picsum.photos/seed/${artistSeed.slug}/800/1000`

    const artist = await prisma.artist.create({
      data: {
        ...artistSeed,
        order: i,
        portrait: portraitUrl,
        images: {
          create: {
            url: portraitUrl,
            usage: 'portrait',
            altText: artistSeed.name,
            sortOrder: 0,
            isPrimary: true,
          },
        },
      },
    })

    const debutCoverUrl = `https://picsum.photos/seed/${artist.slug}-album/400/400`
    const album = await prisma.album.create({
      data: {
        title: `${artist.name} - Debut`,
        slug: `${artist.slug}-debut`,
        type: 'ALBUM',
        coverArt: debutCoverUrl,
        releaseDate: new Date('2024-01-01'),
        artistId: artist.id,
        images: {
          create: {
            url: debutCoverUrl,
            usage: 'cover',
            altText: `${artist.name} - Debut`,
            sortOrder: 0,
            isPrimary: true,
          },
        },
      },
    })

    const singleCoverUrl = `https://picsum.photos/seed/${artist.slug}-single/400/400`
    await prisma.album.create({
      data: {
        title: `${artist.name} - Single`,
        slug: `${artist.slug}-single`,
        type: 'SINGLE',
        coverArt: singleCoverUrl,
        releaseDate: new Date('2024-06-01'),
        artistId: artist.id,
        images: {
          create: {
            url: singleCoverUrl,
            usage: 'cover',
            altText: `${artist.name} - Single`,
            sortOrder: 0,
            isPrimary: true,
          },
        },
      },
    })

    const song = await prisma.song.create({
      data: {
        title: 'Track One',
        slug: `${artist.slug}-track-one`,
        duration: '3:42',
        artwork: debutCoverUrl,
        images: {
          create: {
            url: debutCoverUrl,
            usage: 'artwork',
            altText: 'Track One',
            sortOrder: 0,
            isPrimary: true,
          },
        },
        placements: {
          create: {
            albumId: album.id,
            trackNumber: 1,
            discNumber: 1,
            placementOrder: 0,
          },
        },
      },
    })

    await prisma.songMeta.create({
      data: {
        songId: song.id,
        aboutText: 'The opening track sets the tone for the whole project.',
        producers: 'Placeholder Producer',
        writers: artist.name,
        tags: ['intro', 'featured'],
      },
    })

    const lines = [
      'Yeah I been movin in silence',
      'They never see me comin',
      'Built this from nothing',
      'Every scar a lesson',
    ]

    const blocks = []
    for (let j = 0; j < lines.length; j++) {
      const block = await prisma.lyricBlock.create({
        data: { songId: song.id, text: lines[j], blockOrder: j },
      })
      blocks.push(block)
    }

    await prisma.annotation.create({
      data: {
        lyricBlockId: blocks[0].id,
        startChar: 0,
        endChar: 25,
        explanation: 'The artist describes operating without drawing attention - staying focused while others seek validation.',
      },
    })

    await prisma.recordPlayerTrack.create({
      data: { songId: song.id, position: i + 1, active: true },
    })
  }

  const fashionTalentSeeds = [
    {
      name: 'Mara Vale',
      slug: 'mara-vale',
      role: 'MODEL',
      bio: 'Runway model with sharp editorial movement and a quiet, cinematic presence.',
      instagramProfile: 'https://instagram.com/mara-vale',
      agencyName: 'ASD Fashion',
      agencyContact: 'booking@asd.example',
    },
    {
      name: 'Sol Rivera',
      slug: 'sol-rivera',
      role: 'MODEL',
      bio: 'Print and campaign model focused on modern streetwear silhouettes.',
      instagramProfile: 'https://instagram.com/sol-rivera',
      agencyName: 'ASD Fashion',
      agencyContact: 'booking@asd.example',
    },
    {
      name: 'Noor Ellis',
      slug: 'noor-ellis',
      role: 'DESIGNER',
      bio: 'Designer building practical statement pieces from black denim, washed cotton, and metal trim.',
      website: 'https://example.com/noor-ellis',
      email: 'noor@example.com',
    },
    {
      name: 'Jules Hart',
      slug: 'jules-hart',
      role: 'PHOTOGRAPHER',
      bio: 'Photographer using high-contrast light and close crops for underground editorial stories.',
      website: 'https://example.com/jules-hart',
    },
    {
      name: 'Imani Cross',
      slug: 'imani-cross',
      role: 'EDITOR',
      bio: 'Photo editor and visual director shaping ASD Fashion campaigns from selects to final color.',
      email: 'imani@example.com',
    },
    {
      name: 'Theo Knox',
      slug: 'theo-knox',
      role: 'STYLIST',
      bio: 'Stylist focused on layered textures, thrifted accents, and performance-ready silhouettes.',
      instagramProfile: 'https://instagram.com/theo-knox',
    },
  ]

  const fashionTalent = {}
  for (let i = 0; i < fashionTalentSeeds.length; i++) {
    const talentSeed = fashionTalentSeeds[i]
    const portraitUrl = `https://picsum.photos/seed/fashion-${talentSeed.slug}/800/1100`
    const talent = await prisma.fashionTalent.create({
      data: {
        ...talentSeed,
        order: i,
        images: {
          create: {
            url: portraitUrl,
            usage: 'portrait',
            altText: talentSeed.name,
            sortOrder: 0,
            isPrimary: true,
          },
        },
      },
    })
    fashionTalent[talent.slug] = talent
  }

  const fashionLooks = [
    {
      title: 'Night Market Uniform',
      slug: 'night-market-uniform',
      description: 'A black-on-black street uniform built around coated denim, cropped outerwear, and polished hardware.',
      credits: [
        { talentId: fashionTalent['mara-vale'].id, roleLabel: 'Model' },
        { talentId: fashionTalent['noor-ellis'].id, roleLabel: 'Designer' },
        { talentId: fashionTalent['jules-hart'].id, roleLabel: 'Photographer' },
      ],
      pieces: [
        {
          name: 'Cropped Utility Jacket',
          buyUrl: 'https://example.com/shop/cropped-utility-jacket',
          seed: 'cropped-utility-jacket',
        },
        {
          name: 'Waxed Cargo Trouser',
          buyUrl: 'https://example.com/shop/waxed-cargo-trouser',
          seed: 'waxed-cargo-trouser',
          credits: [
            { talentId: fashionTalent['theo-knox'].id, roleLabel: 'Stylist' },
            { talentId: fashionTalent['jules-hart'].id, roleLabel: 'Photographer' },
          ],
        },
        {
          name: 'Steel Ring Belt',
          buyUrl: 'https://example.com/shop/steel-ring-belt',
          seed: 'steel-ring-belt',
        },
      ],
    },
    {
      title: 'Soft Static Editorial',
      slug: 'soft-static-editorial',
      description: 'Muted layers, oversized knits, and worn-in cotton photographed like an analog test print.',
      credits: [
        { talentId: fashionTalent['sol-rivera'].id, roleLabel: 'Model' },
        { talentId: fashionTalent['theo-knox'].id, roleLabel: 'Stylist' },
        { talentId: fashionTalent['imani-cross'].id, roleLabel: 'Editor' },
      ],
      pieces: [
        {
          name: 'Oversized Static Knit',
          buyUrl: 'https://example.com/shop/oversized-static-knit',
          seed: 'oversized-static-knit',
        },
        {
          name: 'Washed Canvas Skirt',
          buyUrl: 'https://example.com/shop/washed-canvas-skirt',
          seed: 'washed-canvas-skirt',
        },
      ],
    },
    {
      title: 'After Hours Tailoring',
      slug: 'after-hours-tailoring',
      description: 'Low light tailoring with narrow lapels, long lines, and a performance-ready finish.',
      credits: [
        { talentId: fashionTalent['mara-vale'].id, roleLabel: 'Model' },
        { talentId: fashionTalent['sol-rivera'].id, roleLabel: 'Model' },
        { talentId: fashionTalent['noor-ellis'].id, roleLabel: 'Designer' },
        { talentId: fashionTalent['jules-hart'].id, roleLabel: 'Photographer' },
      ],
      pieces: [
        {
          name: 'Narrow Lapel Blazer',
          buyUrl: 'https://example.com/shop/narrow-lapel-blazer',
          seed: 'narrow-lapel-blazer',
        },
        {
          name: 'Longline Satin Shirt',
          buyUrl: 'https://example.com/shop/longline-satin-shirt',
          seed: 'longline-satin-shirt',
        },
        {
          name: 'Split Hem Trouser',
          buyUrl: 'https://example.com/shop/split-hem-trouser',
          seed: 'split-hem-trouser',
        },
      ],
    },
  ]

  for (let i = 0; i < fashionLooks.length; i++) {
    const lookSeed = fashionLooks[i]
    await prisma.fashionLook.create({
      data: {
        title: lookSeed.title,
        slug: lookSeed.slug,
        description: lookSeed.description,
        order: i,
        images: {
          create: [0, 1, 2].map((imageIndex) => ({
            url: `https://picsum.photos/seed/fashion-${lookSeed.slug}-${imageIndex}/1000/1300`,
            usage: 'lookbook',
            altText: `${lookSeed.title} image ${imageIndex + 1}`,
            sortOrder: imageIndex,
            isPrimary: imageIndex === 0,
          })),
        },
        credits: {
          create: lookSeed.credits.map((credit, creditIndex) => ({
            talentId: credit.talentId,
            roleLabel: credit.roleLabel,
            sortOrder: creditIndex,
          })),
        },
        pieces: {
          create: lookSeed.pieces.map((piece, pieceIndex) => ({
            name: piece.name,
            buyUrl: piece.buyUrl,
            imageUrl: `https://picsum.photos/seed/fashion-piece-${piece.seed}/800/1000`,
            sortOrder: pieceIndex,
            credits: piece.credits?.length
              ? {
                  create: piece.credits.map((credit, creditIndex) => ({
                    talentId: credit.talentId,
                    roleLabel: credit.roleLabel,
                    sortOrder: creditIndex,
                  })),
                }
              : undefined,
          })),
        },
      },
    })
  }

  console.log('Seed complete.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
