/**
 * Detects, at runtime, whether certain admin-account schema additions have been
 * deployed to the connected database yet — lets `api/admin/login.js` and
 * `adminAccounts.js` work across a rolling deploy where the app code and DB
 * migration state might briefly be out of sync (e.g. `name`/`pageAccess` columns on
 * `ArtistAdminAccess`, or the `FashionTalentAdminAccess` table's existence).
 * Result is memoized per server instance since schema doesn't change at runtime.
 */
let cachedAdminAccountSchemaCapabilities = null;

/** Queries `information_schema` for the optional admin-account columns/tables and caches the result for this process's lifetime. */
export async function getAdminAccountSchemaCapabilities(prisma) {
	if (cachedAdminAccountSchemaCapabilities) return cachedAdminAccountSchemaCapabilities;

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
	]);

	const artistColumnNames = new Set(artistColumns.map((column) => column.column_name));
	cachedAdminAccountSchemaCapabilities = {
		hasArtistAccountName: artistColumnNames.has('name'),
		hasArtistAccountPageAccess: artistColumnNames.has('pageAccess'),
		hasFashionTalentAdminAccess: talentTables.length > 0,
	};

	return cachedAdminAccountSchemaCapabilities;
}
