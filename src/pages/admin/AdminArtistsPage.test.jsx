import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AdminArtistsPage from './AdminArtistsPage.jsx'
import * as adminAuth from '../../lib/adminAuth.jsx'

const fakeArtists = [
  { id: '1', name: 'Artist One', slug: 'artist-one', bio: 'Hard rap', aboutMe: 'Long bio', portrait: '', order: 0, soundcloudProfile: null, spotifyProfile: null, appleMusicProfile: null },
]

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(adminAuth, 'useAdminAuth').mockReturnValue({ token: 'test-token' })
})

describe('AdminArtistsPage', () => {
  it('renders artist names after fetching', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(fakeArtists) })
    render(<MemoryRouter><AdminArtistsPage /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('Artist One')).toBeInTheDocument())
  })

  it('shows create form when "New Artist" is clicked', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
    render(<MemoryRouter><AdminArtistsPage /></MemoryRouter>)
    await waitFor(() => screen.getByText('New Artist'))
    fireEvent.click(screen.getByText('New Artist'))
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument()
  })

  it('submits create form and shows the new artist in the list', async () => {
    const newArtist = { id: '2', name: 'Brand New', slug: 'brand-new', bio: '', aboutMe: '', portrait: '', order: 1, soundcloudProfile: null, spotifyProfile: null, appleMusicProfile: null }
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(newArtist) })
    render(<MemoryRouter><AdminArtistsPage /></MemoryRouter>)
    await waitFor(() => screen.getByText('New Artist'))
    fireEvent.click(screen.getByText('New Artist'))
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Brand New' } })
    fireEvent.change(screen.getByPlaceholderText('Slug'), { target: { value: 'brand-new' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.getByText('Brand New')).toBeInTheDocument())
  })

  it('calls DELETE when delete button is clicked and confirmed', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeArtists) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<MemoryRouter><AdminArtistsPage /></MemoryRouter>)
    await waitFor(() => screen.getByText('Artist One'))
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('?id=1'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })
})
