import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes } from '../../src/test/api-helpers.js'

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { artist: { findUnique: vi.fn() } },
}))

import handler from './[slug].js'
import { prisma } from '../../src/lib/prisma.js'

const fakeArtist = {
  id: '1', name: 'Artist One', slug: 'artist-one', bio: 'Bio', aboutMe: 'About',
  portrait: '', soundcloudProfile: null, spotifyProfile: null, appleMusicProfile: null,
  albums: [{
    id: 'a1', title: 'Debut', slug: 'artist-one-debut', type: 'ALBUM', coverArt: '',
    releaseDate: new Date('2024-01-01'),
    songs: [{ id: 's1', title: 'Track One', slug: 'artist-one-track-one', trackNumber: 1, discNumber: 1, duration: '3:42' }],
  }],
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/artists/[slug]', () => {
  it('returns 200 with artist and albums', async () => {
    prisma.artist.findUnique.mockResolvedValue(fakeArtist)
    const res = mockRes()
    await handler(mockReq({ query: { slug: 'artist-one' } }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.slug).toBe('artist-one')
    expect(res.body.albums).toHaveLength(1)
  })
  it('returns 404 when artist not found', async () => {
    prisma.artist.findUnique.mockResolvedValue(null)
    const res = mockRes()
    await handler(mockReq({ query: { slug: 'nobody' } }), res)
    expect(res.statusCode).toBe(404)
  })
  it('returns 405 for non-GET methods', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'DELETE', query: { slug: 'x' } }), res)
    expect(res.statusCode).toBe(405)
  })
})
