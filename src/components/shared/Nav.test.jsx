import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import Nav from './Nav.jsx'

describe('Nav', () => {
  it('renders the site name linking to home', () => {
    render(<MemoryRouter><Nav /></MemoryRouter>)
    const link = screen.getByRole('link', { name: /ASD/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/')
  })
})
