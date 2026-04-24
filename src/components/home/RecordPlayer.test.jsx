import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import RecordPlayer from './RecordPlayer.jsx'

const fakeTracks = [
  { id: 'rp1', position: 1, active: true, song: { id: 's1', title: 'Track One', slug: 'artist-one-track-one', soundcloudUrl: 'https://soundcloud.com/a/t', album: { coverArt: 'https://example.com/cover.jpg', title: 'Debut', artist: { name: 'Artist One' } } } },
  { id: 'rp2', position: 2, active: true, song: { id: 's2', title: 'Track Two', slug: 'artist-two-track-one', soundcloudUrl: null, album: { coverArt: 'https://example.com/cover2.jpg', title: 'EP', artist: { name: 'Artist Two' } } } },
]

describe('RecordPlayer', () => {
  it('renders a record for each track', () => {
    render(<RecordPlayer tracks={fakeTracks} />)
    const records = screen.getAllByRole('button')
    expect(records).toHaveLength(2)
  })

  it('clicking a record updates the active song display', () => {
    render(<RecordPlayer tracks={fakeTracks} />)
    const records = screen.getAllByRole('button')
    fireEvent.click(records[0])
    expect(screen.getByText('Track One')).toBeInTheDocument()
  })

  it('clicking the active record again deselects it', () => {
    render(<RecordPlayer tracks={fakeTracks} />)
    const records = screen.getAllByRole('button')
    fireEvent.click(records[0])
    fireEvent.click(records[0])
    expect(screen.queryByText('Track One')).not.toBeInTheDocument()
  })
})
