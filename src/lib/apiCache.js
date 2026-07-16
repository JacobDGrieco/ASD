/**
 * Client-side in-memory cache + in-flight request de-duplication for public GET
 * endpoints. Backs `useApi`'s cache layer and `prefetchApi`'s hover/nav-triggered
 * warmups. State is a plain module-level `Map`, so it resets on full page reload
 * and isn't shared across browser tabs.
 */
const apiCache = new Map()
const inflightRequests = new Map()

/** Returns the cached `{ data, timestamp }` entry for `cacheKey` if it exists and is younger than `maxAge`, evicting it otherwise. A `maxAge` of 0 always evicts and misses (forces a fresh fetch). */
export function getCachedApiEntry(cacheKey, maxAge) {
  if (maxAge <= 0) {
    apiCache.delete(cacheKey)
    return null
  }

  const entry = apiCache.get(cacheKey)
  if (!entry) return null
  if (Date.now() - entry.timestamp > maxAge) {
    apiCache.delete(cacheKey)
    return null
  }
  return entry
}

async function fetchJson(url, headers) {
  const response = await fetch(url, headers ? { headers } : undefined)
  if (!response.ok) throw new Error(String(response.status))
  return response.json()
}

/**
 * Fetches `url` as JSON, serving from cache if fresh and de-duplicating concurrent
 * requests for the same `cacheKey` (so hovering the same link twice before the
 * first fetch resolves doesn't issue a second network request).
 */
export function prefetchApi(url, { maxAge = 5 * 60 * 1000, headers, cacheKey = url } = {}) {
  if (!url) return Promise.resolve(null)

  const cached = getCachedApiEntry(cacheKey, maxAge)
  if (cached) return Promise.resolve(cached.data)

  if (inflightRequests.has(cacheKey)) return inflightRequests.get(cacheKey)

  const request = fetchJson(url, headers)
    .then((data) => {
      apiCache.set(cacheKey, { data, timestamp: Date.now() })
      return data
    })
    .finally(() => {
      inflightRequests.delete(cacheKey)
    })

  inflightRequests.set(cacheKey, request)
  return request
}

/** Evicts a cached entry and any in-flight request for `cacheKey` — used when data is known stale (e.g. `useApi`'s midnight refresh). */
export function clearCachedApiEntry(cacheKey) {
  apiCache.delete(cacheKey)
  inflightRequests.delete(cacheKey)
}
