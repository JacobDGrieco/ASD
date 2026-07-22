/**
 * Shared normalization for contributor lookup keys persisted in the database.
 *
 * These keys intentionally match the existing case/whitespace-insensitive
 * matching rules used by music outside artists and fashion crew credits.
 */
export function normalizePersonName(value) {
	return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizedPersonName(value) {
	return normalizePersonName(value).toLowerCase();
}
