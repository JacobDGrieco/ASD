import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const AdminContext = createContext(null)
const ADMIN_TOKEN_STORAGE_KEY = 'admin_token:v1'
const ADMIN_SESSION_STORAGE_KEY = 'admin_session:v1'
const LEGACY_ADMIN_TOKEN_STORAGE_KEY = 'admin_token'
const LEGACY_ADMIN_SESSION_STORAGE_KEY = 'admin_session'

function readSession() {
  const raw = sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) ?? sessionStorage.getItem(LEGACY_ADMIN_SESSION_STORAGE_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
    sessionStorage.removeItem(LEGACY_ADMIN_SESSION_STORAGE_KEY)
    return null
  }
}

function readToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? sessionStorage.getItem(LEGACY_ADMIN_TOKEN_STORAGE_KEY)
}

function clearLegacySessionStorage() {
  sessionStorage.removeItem(LEGACY_ADMIN_TOKEN_STORAGE_KEY)
  sessionStorage.removeItem(LEGACY_ADMIN_SESSION_STORAGE_KEY)
}

export function AdminProvider({ children }) {
  const [token, setToken] = useState(() => readToken())
  const [session, setSession] = useState(() => readSession())

  const login = useCallback(async (password) => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) throw new Error('Invalid password')

    const data = await res.json()
    sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, data.token)
    sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(data.session))
    clearLegacySessionStorage()
    setToken(data.token)
    setSession(data.session)
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
    sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
    clearLegacySessionStorage()
    setToken(null)
    setSession(null)
  }, [])

  const value = useMemo(() => ({ token, session, login, logout }), [login, logout, session, token])

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdminAuth() {
  return useContext(AdminContext)
}
