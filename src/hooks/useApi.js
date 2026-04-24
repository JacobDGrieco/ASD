import { useEffect, useState } from 'react'

const apiCache = new Map()
const inflightRequests = new Map()

function getCachedEntry(url, maxAge) {
  const entry = apiCache.get(url)
  if (!entry) return null
  if (Date.now() - entry.timestamp > maxAge) {
    apiCache.delete(url)
    return null
  }
  return entry
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(String(response.status))
  return response.json()
}

export function prefetchApi(url, { maxAge = 5 * 60 * 1000 } = {}) {
  if (!url) return Promise.resolve(null)

  const cached = getCachedEntry(url, maxAge)
  if (cached) return Promise.resolve(cached.data)

  if (inflightRequests.has(url)) return inflightRequests.get(url)

  const request = fetchJson(url)
    .then((data) => {
      apiCache.set(url, { data, timestamp: Date.now() })
      return data
    })
    .finally(() => {
      inflightRequests.delete(url)
    })

  inflightRequests.set(url, request)
  return request
}

export function useApi(url, { maxAge = 5 * 60 * 1000 } = {}) {
  const cached = url ? getCachedEntry(url, maxAge) : null
  const [data, setData] = useState(cached?.data ?? null)
  const [loading, setLoading] = useState(url !== null && !cached)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!url) return

    let cancelled = false
    const cachedEntry = getCachedEntry(url, maxAge)

    if (cachedEntry) {
      setData(cachedEntry.data)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    prefetchApi(url, { maxAge })
      .then((nextData) => {
        if (!cancelled) {
          setData(nextData)
          setLoading(false)
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError(nextError.message)
          setLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [maxAge, url])

  return { data, loading, error }
}
