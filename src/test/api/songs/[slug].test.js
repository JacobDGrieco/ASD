import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes } from '../../api-helpers.js'

vi.mock('../../../lib/prisma.js', () => ({
  prisma: { song: { findUnique: vi.fn() } },
}))

import handler from '../../../../api/songs/[slug].js'
import { prisma } from '../../../lib/prisma.js'

const fakeSong = {
  id: 's1', title: 'Track One', slug: 'artist-one-track-one', trackNumber: 1,
  discNumber: 1, duration: '3:42', soundcloudUrl: null, spotifyUrl: null, appleMusicUrl: null,
  album: { title: 'Debut', slug: 'artist-one-debut', coverArt: '', artist: { name: 'Artist One', slug: 'artist-one' } },
  meta: { aboutText: 'About.', producers: 'Prod', writers: 'Writer', releaseDate: null },
  lyricBlocks: [{
    id: 'lb1', text: 'Yeah I been movin in silence', blockOrder: 0,
    annotations: [{ id: 'a1', startChar: 0, endChar: 25, explanation: 'Staying focused.' }],
  }],
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/songs/[slug]', () => {
  it('returns 200 with song, lyrics, and annotations', async () => {
    prisma.song.findUnique.mockResolvedValue(fakeSong)
    const res = mockRes()
    await handler(mockReq({ query: { slug: 'artist-one-track-one' } }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body.slug).toBe('artist-one-track-one')
    expect(res.body.lyricBlocks).toHaveLength(1)
    expect(res.body.lyricBlocks[0].annotations).toHaveLength(1)
  })
  it('returns 404 when song not found', async () => {
    prisma.song.findUnique.mockResolvedValue(null)
    const res = mockRes()
    await handler(mockReq({ query: { slug: 'nobody' } }), res)
    expect(res.statusCode).toBe(404)
  })
  it('returns 405 for non-GET methods', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'POST', query: { slug: 'x' } }), res)
    expect(res.statusCode).toBe(405)
  })
})
