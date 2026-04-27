import { createContext, useContext, useState } from 'react'

const AdminContext = createContext(null)

function readSession() {
  const raw = sessionStorage.getItem('admin_session')
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    sessionStorage.removeItem('admin_session')
    return null
  }
}

export function AdminProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('admin_token'))
  const [session, setSession] = useState(() => readSession())

  const login = async (password) => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) throw new Error('Invalid password')

    const data = await res.json()
    sessionStorage.setItem('admin_token', data.token)
    sessionStorage.setItem('admin_session', JSON.stringify(data.session))
    setToken(data.token)
    setSession(data.session)
  }

  const logout = () => {
    sessionStorage.removeItem('admin_token')
    sessionStorage.removeItem('admin_session')
    setToken(null)
    setSession(null)
  }

  return (
    <AdminContext.Provider value={{ token, session, login, logout }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdminAuth() {
  return useContext(AdminContext)
}
