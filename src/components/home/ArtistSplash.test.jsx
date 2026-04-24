import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import ArtistSplash from './ArtistSplash.jsx'

const fakeArtists = [
  { id: '1', name: 'Artist One', slug: 'artist-one', bio: 'Bio one', portrait: 'https://example.com/1.jpg' },
  { id: '2', name: 'Artist Two', slug: 'artist-two', bio: 'Bio two', portrait: 'https://example.com/2.jpg' },
]

describe('ArtistSplash', () => {
  it('renders all artist names', () => {
    render(<MemoryRouter><ArtistSplash artists={fakeArtists} /></MemoryRouter>)
    expect(screen.getByText('Artist One')).toBeInTheDocument()
    expect(screen.getByText('Artist Two')).toBeInTheDocument()
  })

  it('links each artist to their profile page', () => {
    render(<MemoryRouter><ArtistSplash artists={fakeArtists} /></MemoryRouter>)
    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute('href', '/artists/artist-one')
    expect(links[1]).toHaveAttribute('href', '/artists/artist-two')
  })

  it('renders artist portrait images', () => {
    render(<MemoryRouter><ArtistSplash artists={fakeArtists} /></MemoryRouter>)
    const imgs = screen.getAllByRole('img')
    expect(imgs[0]).toHaveAttribute('src', 'https://example.com/1.jpg')
  })
})
