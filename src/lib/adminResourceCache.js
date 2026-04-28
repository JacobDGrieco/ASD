const resourceCache = new Map()

function cacheId(cacheKey, token) {
  return `${cacheKey}::${token ?? ''}`
}

export function loadAdminResource({ cacheKey, url, token }) {
  const id = cacheId(cacheKey, token)
  const existing = resourceCache.get(id)

  if (existing?.data) return Promise.resolve(existing.data)
  if (existing?.promise) return existing.promise

  const promise = fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(async (response) => {
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

export function primeAdminResource(cacheKey, token, data) {
  resourceCache.set(cacheId(cacheKey, token), { data })
}

export function clearAdminResource(cacheKey, token) {
  resourceCache.delete(cacheId(cacheKey, token))
}
