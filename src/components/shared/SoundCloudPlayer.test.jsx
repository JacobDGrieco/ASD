import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import SoundCloudPlayer from './SoundCloudPlayer.jsx'

describe('SoundCloudPlayer', () => {
  it('renders an iframe with the soundcloud url embedded', () => {
    render(<SoundCloudPlayer url="https://soundcloud.com/artist/track" autoPlay={false} />)
    const iframe = screen.getByTitle('SoundCloud Player')
    expect(iframe).toBeInTheDocument()
    expect(iframe.src).toContain('soundcloud.com%2Fartist%2Ftrack')
  })

  it('includes auto_play=true when autoPlay is true', () => {
    render(<SoundCloudPlayer url="https://soundcloud.com/artist/track" autoPlay={true} />)
    const iframe = screen.getByTitle('SoundCloud Player')
    expect(iframe.src).toContain('auto_play=true')
  })

  it('renders nothing when url is null', () => {
    const { container } = render(<SoundCloudPlayer url={null} autoPlay={false} />)
    expect(container.firstChild).toBeNull()
  })
})
