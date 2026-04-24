import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes } from '../../src/test/api-helpers.js'

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { recordPlayerTrack: { findMany: vi.fn() } },
}))

import handler from './index.js'
import { prisma } from '../../src/lib/prisma.js'

const fakeTracks = [{
  id: 'rp1', position: 1, active: true,
  song: { id: 's1', title: 'Track One', slug: 'artist-one-track-one', soundcloudUrl: null,
    album: { coverArt: '', title: 'Debut', artist: { name: 'Artist One' } } },
}]

beforeEach(() => {
  vi.clearAllMocks()
  prisma.recordPlayerTrack.findMany.mockResolvedValue(fakeTracks)
})

describe('GET /api/record-player', () => {
  it('returns 200 with active tracks sorted by position', async () => {
    const res = mockRes()
    await handler(mockReq(), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].position).toBe(1)
  })
  it('returns 405 for non-GET methods', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'DELETE' }), res)
    expect(res.statusCode).toBe(405)
  })
})
