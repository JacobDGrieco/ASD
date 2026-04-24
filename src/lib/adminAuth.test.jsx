import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AdminProvider, useAdminAuth } from './adminAuth.jsx'

const wrapper = ({ children }) => <AdminProvider>{children}</AdminProvider>

beforeEach(() => {
  sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('useAdminAuth', () => {
  it('token is null when sessionStorage is empty', () => {
    const { result } = renderHook(() => useAdminAuth(), { wrapper })
    expect(result.current.token).toBeNull()
  })

  it('reads existing token from sessionStorage on mount', () => {
    sessionStorage.setItem('admin_token', 'existing-jwt')
    const { result } = renderHook(() => useAdminAuth(), { wrapper })
    expect(result.current.token).toBe('existing-jwt')
  })

  it('login fetches token, stores it, and updates state', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'jwt123' }),
    })
    const { result } = renderHook(() => useAdminAuth(), { wrapper })
    await act(() => result.current.login('secret'))
    expect(result.current.token).toBe('jwt123')
    expect(sessionStorage.getItem('admin_token')).toBe('jwt123')
    expect(fetch).toHaveBeenCalledWith('/api/admin/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ password: 'secret' }),
    }))
  })

  it('login throws when response is not ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })
    const { result } = renderHook(() => useAdminAuth(), { wrapper })
    await expect(act(() => result.current.login('wrong'))).rejects.toThrow('Invalid password')
    expect(result.current.token).toBeNull()
  })

  it('logout clears token from state and sessionStorage', () => {
    sessionStorage.setItem('admin_token', 'jwt123')
    const { result } = renderHook(() => useAdminAuth(), { wrapper })
    act(() => result.current.logout())
    expect(result.current.token).toBeNull()
    expect(sessionStorage.getItem('admin_token')).toBeNull()
  })
})
