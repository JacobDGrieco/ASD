import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function parseCreditNames(value) {
  if (typeof value !== 'string' || !value.trim()) return []
  return value.split(';').map((name) => name.trim()).filter(Boolean)
}

async function main() {
  const records = await prisma.songMeta.findMany({
    select: { id: true, featuredArtists: true, producers: true, writers: true },
  })

  let updated = 0
  for (const record of records) {
    const roles = [
      ...parseCreditNames(record.featuredArtists).map((name) => ({ role: 'Featured Artist', name })),
      ...parseCreditNames(record.producers).map((name) => ({ role: 'Producer', name })),
      ...parseCreditNames(record.writers).map((name) => ({ role: 'Writer', name })),
    ]
    if (roles.length === 0) continue
    await prisma.songMeta.update({ where: { id: record.id }, data: { roles } })
    updated++
  }

  console.log(`Migrated ${updated} of ${records.length} records.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
