import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import AdminLoginPage from './AdminLoginPage.jsx'
import * as adminAuth from '../../lib/adminAuth.jsx'

beforeEach(() => vi.restoreAllMocks())

describe('AdminLoginPage', () => {
  it('renders password input and submit button', () => {
    vi.spyOn(adminAuth, 'useAdminAuth').mockReturnValue({ token: null, login: vi.fn() })
    render(<MemoryRouter><AdminLoginPage /></MemoryRouter>)
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enter' })).toBeInTheDocument()
  })

  it('calls login with the entered password on submit', async () => {
    const mockLogin = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(adminAuth, 'useAdminAuth').mockReturnValue({ token: null, login: mockLogin })
    render(<MemoryRouter><AdminLoginPage /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enter' }))
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('secret'))
  })

  it('shows "Invalid password" error when login throws', async () => {
    const mockLogin = vi.fn().mockRejectedValue(new Error('Invalid password'))
    vi.spyOn(adminAuth, 'useAdminAuth').mockReturnValue({ token: null, login: mockLogin })
    render(<MemoryRouter><AdminLoginPage /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enter' }))
    await waitFor(() => expect(screen.getByText('Invalid password')).toBeInTheDocument())
  })
})
