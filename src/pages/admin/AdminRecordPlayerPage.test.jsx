import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AdminRecordPlayerPage from './AdminRecordPlayerPage.jsx'
import * as adminAuth from '../../lib/adminAuth.jsx'

const fakeSongs = [
  {
    id: 's1',
    title: 'Track One',
    slug: 'artist-one-track-one',
    album: { title: 'Debut', artist: { name: 'Artist One' } },
  },
]

const fakeTracks = [
  {
    id: 't1',
    songId: 's1',
    position: 1,
    active: true,
    song: { id: 's1', title: 'Track One', slug: 'artist-one-track-one' },
  },
]

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(adminAuth, 'useAdminAuth').mockReturnValue({ token: 'test-token' })
})

describe('AdminRecordPlayerPage', () => {
  it('renders 8 slot rows', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeTracks) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeSongs) })

    render(
      <MemoryRouter>
        <AdminRecordPlayerPage />
      </MemoryRouter>
    )

    await waitFor(() => expect(screen.getAllByText(/Slot \d/)).toHaveLength(8))
  })

  it('pre-fills slot 1 with the existing track song', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeTracks) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeSongs) })

    render(
      <MemoryRouter>
        <AdminRecordPlayerPage />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getAllByRole('combobox')[0]).toHaveValue('s1')
    })
  })

  it('calls PUT /api/admin/record-player on save', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeTracks) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeSongs) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeTracks) })

    render(
      <MemoryRouter>
        <AdminRecordPlayerPage />
      </MemoryRouter>
    )

    await waitFor(() => screen.getByRole('button', { name: 'Save Rack' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save Rack' }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/admin/record-player',
        expect.objectContaining({ method: 'PUT' })
      )
    })
  })
})
