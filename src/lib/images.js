function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function isDirectPublicBlobUrl(url) {
  return /\.public\.blob\.vercel-storage\.com$/i.test(new URL(url).hostname)
}

function isDirectPrivateBlobUrl(url) {
  return /\.private\.blob\.vercel-storage\.com$/i.test(new URL(url).hostname)
}

export function buildBlobProxyUrl(pathname) {
  const value = toTrimmedString(pathname)
  if (!value) return ''
  return `/api/blob?pathname=${encodeURIComponent(value)}`
}

export function buildClientImageUrl(image) {
  const previewUrl = toTrimmedString(image?.previewUrl)
  const url = toTrimmedString(image?.url)
  const pathname = toTrimmedString(image?.pathname)

  if (previewUrl) return previewUrl

  if (url) {
    try {
      if (isDirectPublicBlobUrl(url) || !isDirectPrivateBlobUrl(url)) {
        return url
      }
    } catch {
      if (pathname) return buildBlobProxyUrl(pathname)
      return url
    }
  }

  if (pathname) return buildBlobProxyUrl(pathname)
  return url
}

function makeLegacyImage({ id, url, usage, altText }) {
  if (!toTrimmedString(url)) return []

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
  }]
}

export function normalizeImageInput(images, fallbackUsage) {
  const normalized = Array.isArray(images)
    ? images
        .map((image, index) => ({
          id: image?.id,
          url: toTrimmedString(image?.url),
          pathname: toTrimmedString(image?.pathname) || null,
          usage: toTrimmedString(image?.usage) || fallbackUsage,
          altText: toTrimmedString(image?.altText),
          sortOrder: index,
          isPrimary: Boolean(image?.isPrimary),
          previewUrl: toTrimmedString(image?.previewUrl),
        }))
        .filter((image) => image.url)
    : []

  if (!normalized.length) return []

  const primaryIndex = normalized.findIndex((image) => image.isPrimary)
  return normalized.map((image, index) => ({
    ...image,
    sortOrder: index,
    isPrimary: primaryIndex === -1 ? index === 0 : index === primaryIndex,
  }))
}

export function toImageCreateManyData(images) {
  return images.map((image) => ({
    url: image.url,
    pathname: image.pathname,
    usage: image.usage,
    altText: image.altText,
    sortOrder: image.sortOrder,
    isPrimary: image.isPrimary,
  }))
}

export function mergeLegacyImages(images, legacyUrl, { fallbackUsage, altText, idPrefix }) {
  if (Array.isArray(images) && images.length > 0) {
    return images
  }

  return makeLegacyImage({
    id: `${idPrefix}-legacy`,
    url: legacyUrl,
    usage: fallbackUsage,
    altText,
  })
}

export function primaryImageUrl(images, legacyUrl = '') {
  const collection = Array.isArray(images) ? images : []
  const primary = collection.find((image) => image.isPrimary) ?? collection[0]
  return primary?.url ?? legacyUrl ?? ''
}

export function primaryImageReference(images, legacyValue = '') {
  const collection = Array.isArray(images) ? images : []
  const primary = collection.find((image) => image.isPrimary) ?? collection[0]
  return primary?.pathname ?? primary?.url ?? legacyValue ?? ''
}

export function clientImage(image) {
  if (!image) return image

  return {
    ...image,
    previewUrl: buildClientImageUrl(image),
  }
}

export function clientImages(images) {
  return Array.isArray(images) ? images.map(clientImage) : []
}
