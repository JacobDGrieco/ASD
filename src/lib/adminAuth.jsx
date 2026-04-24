import { createContext, useContext, useState } from 'react'

const AdminContext = createContext(null)

export function AdminProvider({ children }) {
  const [token, setToken] = useState(() => sessionStorage.getItem('admin_token'))

  const login = async (password) => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (!res.ok) throw new Error('Invalid password')
    const data = await res.json()
    sessionStorage.setItem('admin_token', data.token)
    setToken(data.token)
  }

  const logout = () => {
    sessionStorage.removeItem('admin_token')
    setToken(null)
  }

  return (
    <AdminContext.Provider value={{ token, login, logout }}>
      {children}
    </AdminContext.Provider>
  )
}

export function useAdminAuth() {
  return useContext(AdminContext)
}
