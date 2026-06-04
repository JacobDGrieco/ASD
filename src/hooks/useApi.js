import { useEffect, useState } from 'react'
import { millisecondsUntilNextUtcMidnight } from '../lib/releaseSchedule.js'

const apiCache = new Map()
const inflightRequests = new Map()

function getCachedEntry(cacheKey, maxAge) {
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

  const cached = getCachedEntry(cacheKey, maxAge)
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

export function useApi(url, { maxAge = 5 * 60 * 1000, refreshAtUtcMidnight = false, headers, cacheKey = url } = {}) {
  const cached = url ? getCachedEntry(cacheKey, maxAge) : null
  const [data, setData] = useState(cached?.data ?? null)
  const [loading, setLoading] = useState(url !== null && !cached)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!url) return

    let cancelled = false
    const cachedEntry = getCachedEntry(cacheKey, maxAge)

    if (cachedEntry) {
      setData(cachedEntry.data)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    prefetchApi(url, { maxAge, headers, cacheKey })
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
  }, [cacheKey, headers, maxAge, url])

  useEffect(() => {
    if (!url || !refreshAtUtcMidnight) return undefined

    let cancelled = false
    let timeoutId = null

    const scheduleRefresh = () => {
      timeoutId = window.setTimeout(() => {
        apiCache.delete(cacheKey)
        inflightRequests.delete(cacheKey)

        prefetchApi(url, { maxAge, headers, cacheKey })
          .then((nextData) => {
            if (!cancelled) {
              setData(nextData)
              setError(null)
            }
          })
          .catch((nextError) => {
            if (!cancelled) {
              setError(nextError.message)
            }
          })
          .finally(() => {
            if (!cancelled) scheduleRefresh()
          })
      }, millisecondsUntilNextUtcMidnight())
    }

    scheduleRefresh()

    return () => {
      cancelled = true
      if (timeoutId !== null) window.clearTimeout(timeoutId)
    }
  }, [cacheKey, headers, maxAge, refreshAtUtcMidnight, url])

  return { data, loading, error }
}
