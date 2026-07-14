import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { clearAdminResourceCache } from './adminResourceCache.js'

const AdminContext = createContext(null)
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
