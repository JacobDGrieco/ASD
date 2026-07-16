/**
 * Whether the current browser session is an authenticated admin viewing a public
 * page (any role). Historically also gated a public-API "see hidden content"
 * bypass, which has been removed (`api/public.js` no longer varies its response
 * for admin sessions) — this now only gates the remaining admin-while-browsing
 * affordances: the "Return to Public View" exit banner (`App.jsx`) and board-post
 * drag-editing (`BoardPage.jsx`).
 */
export function isAdminPreviewSession(session, token) {
  return Boolean(session?.role && token)
}
