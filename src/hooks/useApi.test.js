import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useApi } from './useApi.js'

describe('useApi', () => {
  beforeEach(() => {
    global.fetch = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in loading state', () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => [] })
    const { result } = renderHook(() => useApi('/api/artists'))
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBe(null)
  })

  it('returns data on success', async () => {
    const fakeData = [{ id: '1', name: 'Artist One' }]
    global.fetch.mockResolvedValue({ ok: true, json: async () => fakeData })
    const { result } = renderHook(() => useApi('/api/artists'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual(fakeData)
    expect(result.current.error).toBe(null)
  })

  it('sets error on non-ok response', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 404 })
    const { result } = renderHook(() => useApi('/api/artists'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe('404')
    expect(result.current.data).toBe(null)
  })

  it('does not fetch when url is null', () => {
    const { result } = renderHook(() => useApi(null))
    expect(global.fetch).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
  })
})
