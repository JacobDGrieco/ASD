let cachedAdminAccountSchemaCapabilities = null

export async function getAdminAccountSchemaCapabilities(prisma) {
  if (cachedAdminAccountSchemaCapabilities) return cachedAdminAccountSchemaCapabilities

  const [artistColumns, talentTables] = await Promise.all([
    prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'ArtistAdminAccess'
        AND column_name IN ('name', 'pageAccess')
    `,
    prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'FashionTalentAdminAccess'
    `,
  ])

  const artistColumnNames = new Set(artistColumns.map((column) => column.column_name))
  cachedAdminAccountSchemaCapabilities = {
    hasArtistAccountName: artistColumnNames.has('name'),
    hasArtistAccountPageAccess: artistColumnNames.has('pageAccess'),
    hasFashionTalentAdminAccess: talentTables.length > 0,
  }

  return cachedAdminAccountSchemaCapabilities
}
