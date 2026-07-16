/**
 * Client-side cache for admin GET requests, shared by nearly every admin page's
 * list-load (`AdminMusicArtistsPage`, `AdminMusicSongsPage`, etc.). Namespaces
 * cache entries by `token` so switching between "logged out" and "logged in" (or
 * between accounts within one page load) invalidates the right entries; on a 401 it
 * clears everything and hard-redirects to the login page. Client-only,
 * module-level `Map`.
 */
const resourceCache = new Map()

function cacheId(cacheKey, token) {
  return `${cacheKey}::${token ?? ''}`
}

// A 401 means the session cookie has expired/been revoked server-side — clear
// every cached admin resource (it's all now stale/unauthorized) and bounce to
// login, rather than letting the page silently keep showing cached data.
function expireAdminSession() {
  resourceCache.clear()

  if (typeof window === 'undefined') return

  if (window.location.pathname !== '/admin/login') {
    window.location.assign('/admin/login')
  }
}

/**
 * Fetches and caches an admin GET resource, de-duplicating concurrent requests for
 * the same `cacheKey`/`token` pair. On a 401, clears the cache and redirects to
 * login, returning a promise that never resolves (the caller's page is about to
 * navigate away, so there's nothing useful to do with the data).
 */
export function loadAdminResource({ cacheKey, url, token }) {
  const id = cacheId(cacheKey, token)
  const existing = resourceCache.get(id)

  if (existing?.data) return Promise.resolve(existing.data)
  if (existing?.promise) return existing.promise

  // `token` is always the COOKIE_AUTH_SENTINEL value ('cookie'); the server discards it
  // and authenticates via the HttpOnly session cookie instead (see readAdminTokenFromRequest
  // in src/lib/auth.js). No Authorization header is sent here for that reason.
  const promise = fetch(url)
    .then(async (response) => {
      if (response.status === 401) {
        expireAdminSession()
        return new Promise(() => {})
      }

      if (!response.ok) {
        throw new Error(`Failed to load ${cacheKey} (${response.status})`)
      }

      return response.json()
    })
    .then((data) => {
      resourceCache.set(id, { data })
      return data
    })
    .catch((error) => {
      resourceCache.delete(id)
      throw error
    })

  resourceCache.set(id, { promise })
  return promise
}

/** Seeds the cache with already-known data (e.g. after a save, so the list doesn't need to re-fetch to reflect it). */
export function primeAdminResource(cacheKey, token, data) {
  resourceCache.set(cacheId(cacheKey, token), { data })
}

/** Evicts a single cached resource, forcing the next `loadAdminResource` call for it to re-fetch. */
export function clearAdminResource(cacheKey, token) {
  resourceCache.delete(cacheId(cacheKey, token))
}

/** Clears every cached admin resource — called on login/logout so no data from a previous session/account carries over. */
export function clearAdminResourceCache() {
  resourceCache.clear()
}
