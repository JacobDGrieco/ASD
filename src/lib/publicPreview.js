export function isAdminPreviewSession(session, token) {
  return Boolean(session?.role && token)
}
