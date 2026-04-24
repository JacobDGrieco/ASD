import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminRoute from './AdminRoute.jsx'
import * as adminAuth from '../../lib/adminAuth.jsx'

beforeEach(() => vi.restoreAllMocks())

describe('AdminRoute', () => {
  it('renders protected children when token exists', () => {
    vi.spyOn(adminAuth, 'useAdminAuth').mockReturnValue({ token: 'abc' })
    render(
      <MemoryRouter initialEntries={['/admin/artists']}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="/admin/artists" element={<div>Protected</div>} />
          </Route>
          <Route path="/admin/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Protected')).toBeInTheDocument()
  })

  it('redirects to /admin/login when token is null', () => {
    vi.spyOn(adminAuth, 'useAdminAuth').mockReturnValue({ token: null })
    render(
      <MemoryRouter initialEntries={['/admin/artists']}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="/admin/artists" element={<div>Protected</div>} />
          </Route>
          <Route path="/admin/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Login')).toBeInTheDocument()
    expect(screen.queryByText('Protected')).not.toBeInTheDocument()
  })
})
