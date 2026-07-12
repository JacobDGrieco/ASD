const apiCache = new Map()
const inflightRequests = new Map()

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

export function clearCachedApiEntry(cacheKey) {
  apiCache.delete(cacheKey)
  inflightRequests.delete(cacheKey)
}
