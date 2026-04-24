import { PrismaClient } from '../src/generated/prisma/index.js'

const prisma = new PrismaClient()

async function main() {
  await prisma.annotation.deleteMany()
  await prisma.lyricBlock.deleteMany()
  await prisma.songMeta.deleteMany()
  await prisma.recordPlayerTrack.deleteMany()
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
        trackNumber: 1,
        discNumber: 1,
        duration: '3:42',
        albumId: album.id,
      },
    })

    await prisma.songMeta.create({
      data: {
        songId: song.id,
        aboutText: 'The opening track sets the tone for the whole project.',
        producers: 'Placeholder Producer',
        writers: artist.name,
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

  console.log('Seed complete.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
