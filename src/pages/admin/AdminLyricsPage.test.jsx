import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminLyricsPage from './AdminLyricsPage.jsx'
import * as adminAuth from '../../lib/adminAuth.jsx'

const fakeBlocks = [
  { id: 'b1', text: 'Yeah I been movin in silence', blockOrder: 0, annotations: [] },
  { id: 'b2', text: 'They never see me comin', blockOrder: 1, annotations: [{ id: 'an1', startChar: 0, endChar: 4, explanation: 'They = haters' }] },
]

function renderPage(songId = 's1') {
  return render(
    <MemoryRouter initialEntries={[`/admin/lyrics/${songId}`]}>
      <Routes>
        <Route path="/admin/lyrics/:songId" element={<AdminLyricsPage />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(adminAuth, 'useAdminAuth').mockReturnValue({ token: 'test-token' })
})

describe('AdminLyricsPage', () => {
  it('loads and shows lyrics in the textarea', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(fakeBlocks) })
    renderPage()
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('Yeah I been movin in silence\nThey never see me comin'))
  })

  it('switches to Annotations tab and shows existing annotations', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(fakeBlocks) })
    renderPage()
    await waitFor(() => screen.getByText('Annotations'))
    fireEvent.click(screen.getByText('Annotations'))
    expect(screen.getByText('They = haters')).toBeInTheDocument()
  })

  it('submits lyrics save with warning confirmation', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeBlocks) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()
    await waitFor(() => screen.getByRole('textbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Save Lyrics' }))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('?songId=s1'),
        expect.objectContaining({ method: 'PUT' })
      )
    })
  })

  it('calls DELETE annotation when delete chip button is clicked', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(fakeBlocks) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderPage()
    await waitFor(() => screen.getByText('Annotations'))
    fireEvent.click(screen.getByText('Annotations'))
    await waitFor(() => screen.getByText('They = haters'))
    fireEvent.click(screen.getAllByRole('button', { name: '×' })[0])
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/annotations?id=an1'),
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })
})
