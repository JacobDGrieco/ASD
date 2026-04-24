import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AdminSongsPage from './AdminSongsPage.jsx'
import * as adminAuth from '../../lib/adminAuth.jsx'

const fakeAlbums = [{ id: 'al1', title: 'Debut', artist: { name: 'Artist One' } }]
const fakeSongs = [
  { id: 's1', title: 'Track One', slug: 'artist-one-track-one', trackNumber: 1, discNumber: 1, duration: '3:42', albumId: 'al1', soundcloudUrl: null, spotifyUrl: null, appleMusicUrl: null, album: { title: 'Debut', artist: { name: 'Artist One' } }, meta: { aboutText: '', producers: '', writers: '' } },
]

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(adminAuth, 'useAdminAuth').mockReturnValue({ token: 'test-token' })
})

describe('AdminSongsPage', () => {
  it('renders song titles after loading', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeSongs) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeAlbums) })
    render(<MemoryRouter><AdminSongsPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Track One')).toBeInTheDocument())
  })

  it('shows "Edit Lyrics" link for each song', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeSongs) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeAlbums) })
    render(<MemoryRouter><AdminSongsPage /></MemoryRouter>)
    await waitFor(() => screen.getByText('Track One'))
    expect(screen.getByText('Edit Lyrics')).toBeInTheDocument()
  })

  it('shows create form when "New Song" is clicked', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeAlbums) })
    render(<MemoryRouter><AdminSongsPage /></MemoryRouter>)
    await waitFor(() => screen.getByText('New Song'))
    fireEvent.click(screen.getByText('New Song'))
    expect(screen.getByPlaceholderText('Title')).toBeInTheDocument()
  })
})
