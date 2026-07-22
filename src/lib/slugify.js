/** URL slug generator for artists/albums/songs/talent/collections: lowercases, strips accents (NFD-normalize then drop combining marks), and collapses non-alphanumeric runs to a single hyphen. */
export function slugify(value) {
	return String(value)
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}
