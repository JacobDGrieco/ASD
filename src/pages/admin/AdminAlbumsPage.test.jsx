import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AdminAlbumsPage from './AdminAlbumsPage.jsx'
import * as adminAuth from '../../lib/adminAuth.jsx'

const fakeArtists = [{ id: 'a1', name: 'Artist One', slug: 'artist-one' }]
const fakeAlbums = [
  { id: 'al1', title: 'Debut', slug: 'debut', type: 'ALBUM', coverArt: '', releaseDate: '2024-01-01T00:00:00.000Z', artistId: 'a1', artist: { name: 'Artist One', slug: 'artist-one' } },
]

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(adminAuth, 'useAdminAuth').mockReturnValue({ token: 'test-token' })
})

describe('AdminAlbumsPage', () => {
  it('renders album titles after loading', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeAlbums) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeArtists) })
    render(<MemoryRouter><AdminAlbumsPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Debut')).toBeInTheDocument())
  })

  it('shows create form when "New Album" is clicked', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeArtists) })
    render(<MemoryRouter><AdminAlbumsPage /></MemoryRouter>)
    await waitFor(() => screen.getByText('New Album'))
    fireEvent.click(screen.getByText('New Album'))
    expect(screen.getByPlaceholderText('Title')).toBeInTheDocument()
  })

  it('calls DELETE when delete is clicked and confirmed', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeAlbums) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeArtists) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<MemoryRouter><AdminAlbumsPage /></MemoryRouter>)
    await waitFor(() => screen.getByText('Debut'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('?id=al1'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })
})
