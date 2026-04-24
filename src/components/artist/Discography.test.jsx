import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect } from 'vitest'
import Discography from './Discography.jsx'

const fakeAlbums = [
  {
    id: 'a1', title: 'Debut Album', slug: 'debut', type: 'ALBUM', coverArt: '', releaseDate: '2024-01-01',
    songs: [
      { id: 's1', title: 'Track One', slug: 'track-one', trackNumber: 1, discNumber: 1, duration: '3:42' },
      { id: 's2', title: 'Track Two', slug: 'track-two', trackNumber: 2, discNumber: 1, duration: '4:10' },
    ],
  },
  {
    id: 'a2', title: 'Single Drop', slug: 'single', type: 'SINGLE', coverArt: '', releaseDate: '2024-06-01',
    songs: [{ id: 's3', title: 'The Single', slug: 'the-single', trackNumber: 1, discNumber: 1, duration: '2:58' }],
  },
]

describe('Discography', () => {
  it('renders all album titles', () => {
    render(<MemoryRouter><Discography albums={fakeAlbums} /></MemoryRouter>)
    expect(screen.getByText('Debut Album')).toBeInTheDocument()
    expect(screen.getByText('Single Drop')).toBeInTheDocument()
  })

  it('clicking an album expands its track list', () => {
    render(<MemoryRouter><Discography albums={fakeAlbums} /></MemoryRouter>)
    expect(screen.queryByText('Track One')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Debut Album'))
    expect(screen.getByText('Track One')).toBeInTheDocument()
    expect(screen.getByText('Track Two')).toBeInTheDocument()
  })

  it('clicking the same album again collapses it', () => {
    render(<MemoryRouter><Discography albums={fakeAlbums} /></MemoryRouter>)
    fireEvent.click(screen.getByText('Debut Album'))
    expect(screen.getByText('Track One')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Debut Album'))
    expect(screen.queryByText('Track One')).not.toBeInTheDocument()
  })

  it('clicking a different album switches the expanded panel', () => {
    render(<MemoryRouter><Discography albums={fakeAlbums} /></MemoryRouter>)
    fireEvent.click(screen.getByText('Debut Album'))
    expect(screen.getByText('Track One')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Single Drop'))
    expect(screen.queryByText('Track One')).not.toBeInTheDocument()
    expect(screen.getByText('The Single')).toBeInTheDocument()
  })
})
