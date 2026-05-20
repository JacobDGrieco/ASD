export function isAdminPreviewSession(session, token) {
  return Boolean(session?.role && token)
}

export function publicPreviewHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : undefined
}

export function publicPreviewCacheKey(url, enabled) {
  return enabled ? `${url}::admin-preview` : url
}
