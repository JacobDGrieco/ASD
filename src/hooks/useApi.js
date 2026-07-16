import { useEffect, useReducer } from 'react'
import { clearCachedApiEntry, getCachedApiEntry, prefetchApi } from '../lib/apiCache.js'
import { useAdminAuth } from '../lib/adminAuth.jsx'
import { isAdminPreviewSession } from '../lib/publicPreview.js'
import { millisecondsUntilNextUtcMidnight } from '../lib/releaseSchedule.js'

function apiStateReducer(state, action) {
  switch (action.type) {
    case 'cached':
      return { data: action.data, loading: false, error: null }
    case 'loading':
      return { ...state, loading: true, error: null }
    case 'success':
      return { data: action.data, loading: false, error: null }
    case 'refreshSuccess':
      return { ...state, data: action.data, error: null }
    case 'error':
      return { ...state, loading: false, error: action.error }
    case 'refreshError':
      return { ...state, error: action.error }
    default:
      return state
  }
}

export { prefetchApi }

export function useApi(url, { maxAge = 5 * 60 * 1000, refreshAtUtcMidnight = false, headers, cacheKey = url } = {}) {
  const auth = useAdminAuth()
  const adminPreview = isAdminPreviewSession(auth?.session, auth?.token)
  const effectiveCacheKey = adminPreview && url?.startsWith('/api/') && !url.startsWith('/api/admin/')
    ? `${cacheKey}:admin-preview`
    : cacheKey
  const cached = url ? getCachedApiEntry(effectiveCacheKey, maxAge) : null
  const [{ data, loading, error }, dispatchApiState] = useReducer(
    apiStateReducer,
    { data: cached?.data ?? null, loading: url !== null && !cached, error: null }
  )

  useEffect(() => {
    if (!url) return

    let cancelled = false
    const cachedEntry = getCachedApiEntry(effectiveCacheKey, maxAge)

    if (cachedEntry) {
      dispatchApiState({ type: 'cached', data: cachedEntry.data })
      return
    }

    dispatchApiState({ type: 'loading' })

    prefetchApi(url, { maxAge, headers, cacheKey: effectiveCacheKey })
      .then((nextData) => {
        if (!cancelled) {
          dispatchApiState({ type: 'success', data: nextData })
        }
      })
      .catch((nextError) => {
        if (!cancelled) {
          dispatchApiState({ type: 'error', error: nextError.message })
        }
      })

    return () => {
      cancelled = true
    }
  }, [effectiveCacheKey, headers, maxAge, url])

  useEffect(() => {
    if (!url || !refreshAtUtcMidnight) return undefined

    let cancelled = false
    let timeoutId = null

    const scheduleRefresh = () => {
      timeoutId = window.setTimeout(() => {
        clearCachedApiEntry(effectiveCacheKey)

        prefetchApi(url, { maxAge, headers, cacheKey: effectiveCacheKey })
          .then((nextData) => {
            if (!cancelled) {
              dispatchApiState({ type: 'refreshSuccess', data: nextData })
            }
          })
          .catch((nextError) => {
            if (!cancelled) {
              dispatchApiState({ type: 'refreshError', error: nextError.message })
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
  }, [effectiveCacheKey, headers, maxAge, refreshAtUtcMidnight, url])

  return { data, loading, error }
}
