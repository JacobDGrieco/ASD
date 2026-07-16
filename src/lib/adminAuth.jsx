import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { clearAdminResourceCache } from './adminResourceCache.js'

const AdminContext = createContext(null)
// Real auth is the HttpOnly session cookie (see src/lib/auth.js); this sentinel only
// signals "a session exists" to consumers. Many admin pages still build an
// `Authorization: Bearer ${token}` header from it out of habit — the server discards
// that header (see isUsableBearerToken in src/lib/auth.js) and falls back to the
// cookie, so those headers are inert. TODO: sweep the remaining admin pages/components
// (AdminSongFormModal, AdminMusicLyricsPage, AdminMusicBoardPage, AdminMusicCrosshairPage,
// AdminAboutPage, AdminAccountsPage, AdminMusicAlbumsPage, AdminMusicArtistsPage,
// AdminFashionTalentPage, AdminFashionLooksPage, AdminFashionCollectionsPage,
// AdminFashionOutsideTalentPage, AdminMusicOutsideArtistsPage, AdminMusicSongsPage,
// AdminMusicRecordPlayerPage, FashionHomePage, BoardPage, ImageCollectionField,
// BoardMarkdownEditor) to drop this dead header construction. Left in place for now —
// flagged for a dedicated follow-up pass rather than a blind mechanical rewrite.
const COOKIE_AUTH_SENTINEL = 'cookie'

export function AdminProvider({ children }) {
  const [token, setToken] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false

    fetch('/api/admin/login')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (ignore) return
        if (data?.session) {
          setToken(COOKIE_AUTH_SENTINEL)
          setSession(data.session)
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [])

  const login = useCallback(async (password) => {
    clearAdminResourceCache()
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) throw new Error('Invalid password')

    const data = await res.json()
    setToken(COOKIE_AUTH_SENTINEL)
    setSession(data.session)
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/admin/login', { method: 'DELETE' }).catch(() => {})
    clearAdminResourceCache()
    setToken(null)
    setSession(null)
  }, [])

  const value = useMemo(() => ({ token, session, loading, login, logout }), [loading, login, logout, session, token])

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdminAuth() {
  return useContext(AdminContext)
}
