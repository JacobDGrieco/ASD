import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const songs = await prisma.lyricBlock.findMany({
    select: { songId: true },
    distinct: ['songId'],
  })

  for (const { songId } of songs) {
    const existing = await prisma.songLyric.findUnique({ where: { songId } })
    if (existing) {
      console.log(`[${songId}] Already migrated, skipping`)
      continue
    }

    const blocks = await prisma.lyricBlock.findMany({
      where: { songId },
      orderBy: { blockOrder: 'asc' },
      include: {
        annotations: true,
      },
    })

    const joinedText = blocks.map((b) => b.text).join('\n')

    const songLyric = await prisma.songLyric.create({
      data: { songId, text: joinedText },
    })

    let blockOffset = 0
    let annotationCount = 0

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]

      for (const annotation of block.annotations) {
        if (!annotation.explanation) continue

        const absStart = blockOffset + annotation.startChar
        const absEnd = blockOffset + annotation.endChar

        const songAnnotation = await prisma.songAnnotation.create({
          data: { songLyricId: songLyric.id, explanation: annotation.explanation },
        })

        await prisma.songAnnotationRange.create({
          data: {
            songAnnotationId: songAnnotation.id,
            startChar: absStart,
            endChar: absEnd,
          },
        })

        annotationCount++
      }

      blockOffset += block.text.length + (i < blocks.length - 1 ? 1 : 0)
    }

    console.log(`[${songId}] Migrated: ${blocks.length} blocks, ${annotationCount} annotations`)
  }
}

main()
  .then(() => { console.log('Done'); process.exit(0) })
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
