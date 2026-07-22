/**
 * Central image-reference layer: normalizes admin-submitted image arrays for
 * storage, and resolves the URL a client should actually fetch from (direct blob
 * URL vs. proxied through `/api/blob?pathname=` for private blobs).
 *
 * Also bridges the same legacy-vs-new-model split as `profileLinks.js`: several
 * entities (Artist, Album, Song) originally stored a single image as a raw string
 * column (`portrait`, `coverArt`, `artwork`) before gaining a dedicated `*Image`
 * relation table for multiple ordered images — `mergeLegacyImages` presents both
 * shapes uniformly to callers.
 *
 * Runs in both server (`api/public.js`/`api/admin/*.js` formatters) and client
 * (`ImageCollectionField`, display components) contexts — pure data transforms, no I/O.
 */
function toTrimmedString(value) {
	return typeof value === 'string' ? value.trim() : '';
}

function isDirectPublicBlobUrl(url) {
	return /\.public\.blob\.vercel-storage\.com$/i.test(new URL(url).hostname);
}

function isDirectPrivateBlobUrl(url) {
	return /\.private\.blob\.vercel-storage\.com$/i.test(new URL(url).hostname);
}

/** Builds the URL to fetch a private blob through `api/blob.js` by pathname, rather than hitting Vercel Blob's storage domain directly. */
export function buildBlobProxyUrl(pathname) {
	const value = toTrimmedString(pathname);
	if (!value) return '';
	return `/api/blob?pathname=${encodeURIComponent(value)}`;
}

/**
 * Resolves the URL a client should actually load for an image record, in order of
 * preference: a precomputed `previewUrl` (fastest — already resolved server-side),
 * else the direct `url` if it's public (or not a recognized blob host at all, e.g.
 * an external image URL), else proxy private blob URLs through `/api/blob` since
 * they require the server's read access, else fall back to whatever pathname/url is
 * available.
 */
export function buildClientImageUrl(image) {
	const previewUrl = toTrimmedString(image?.previewUrl);
	const url = toTrimmedString(image?.url);
	const pathname = toTrimmedString(image?.pathname);

	if (previewUrl) return previewUrl;

	if (url) {
		try {
			if (isDirectPublicBlobUrl(url) || !isDirectPrivateBlobUrl(url)) {
				return url;
			}
		} catch {
			if (pathname) return buildBlobProxyUrl(pathname);
			return url;
		}
	}

	if (pathname) return buildBlobProxyUrl(pathname);
	return url;
}

function makeLegacyImage({ id, url, usage, altText }) {
	if (!toTrimmedString(url)) return [];

	return [{
		id,
		url: toTrimmedString(url),
		pathname: null,
		usage,
		altText: toTrimmedString(altText),
		sortOrder: 0,
		isPrimary: true,
		isLegacy: true,
		previewUrl: toTrimmedString(url),
	}];
}

/**
 * Sanitizes an admin-submitted image array before it's persisted: drops entries
 * without a URL, assigns `sortOrder` from array position, and ensures exactly one
 * image is flagged `isPrimary` (the first explicitly-marked one, or the first image
 * if none was marked).
 */
export function normalizeImageInput(images, fallbackUsage) {
	const normalized = Array.isArray(images)
		? images.reduce((normalizedImages, image, index) => {
			const normalizedImage = {
				id: image?.id,
				url: toTrimmedString(image?.url),
				pathname: toTrimmedString(image?.pathname) || null,
				usage: toTrimmedString(image?.usage) || fallbackUsage,
				altText: toTrimmedString(image?.altText),
				sortOrder: index,
				isPrimary: Boolean(image?.isPrimary),
				previewUrl: toTrimmedString(image?.previewUrl),
			};
			if (normalizedImage.url) normalizedImages.push(normalizedImage);
			return normalizedImages;
		}, [])
		: [];

	if (!normalized.length) return [];

	const primaryIndex = normalized.findIndex((image) => image.isPrimary);
	return normalized.map((image, index) => ({
		...image,
		sortOrder: index,
		isPrimary: primaryIndex === -1 ? index === 0 : index === primaryIndex,
	}));
}

/** Strips a normalized image array down to the fields a Prisma `createMany` for an `*Image` table accepts. */
export function toImageCreateManyData(images) {
	return images.map((image) => ({
		url: image.url,
		pathname: image.pathname,
		usage: image.usage,
		altText: image.altText,
		sortOrder: image.sortOrder,
		isPrimary: image.isPrimary,
	}));
}

/**
 * Presents an entity's images uniformly regardless of which model generation it
 * uses: returns the `*Image` relation array if it has entries, otherwise wraps the
 * entity's legacy single-string image column (`portrait`/`coverArt`/`artwork`) into
 * a one-element array with the same shape.
 */
export function mergeLegacyImages(images, legacyUrl, { fallbackUsage, altText, idPrefix }) {
	if (Array.isArray(images) && images.length > 0) {
		return images;
	}

	return makeLegacyImage({
		id: `${idPrefix}-legacy`,
		url: legacyUrl,
		usage: fallbackUsage,
		altText,
	});
}

/** Pathname or URL of an entity's primary image (or first image if none is flagged primary), falling back to a legacy string value if there are no images at all. */
export function primaryImageReference(images, legacyValue = '') {
	const collection = Array.isArray(images) ? images : [];
	const primary = collection.find((image) => image.isPrimary) ?? collection[0];
	return primary?.pathname ?? primary?.url ?? legacyValue ?? '';
}

/** Adds a resolved `previewUrl` to an image record for client consumption (see `buildClientImageUrl`). */
export function clientImage(image) {
	if (!image) return image;

	return {
		...image,
		previewUrl: buildClientImageUrl(image),
	};
}

/** Maps `clientImage` over an array, tolerating a non-array input. */
export function clientImages(images) {
	return Array.isArray(images) ? images.map(clientImage) : [];
}
