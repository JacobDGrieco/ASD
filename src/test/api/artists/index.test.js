import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes } from '../../api-helpers.js'

vi.mock('../../../lib/prisma.js', () => ({
  prisma: {
    artist: {
      findMany: vi.fn(),
    },
  },
}))

import handler from '../../../../api/artists/index.js'
import { prisma } from '../../../lib/prisma.js'

const fakeArtists = [
  { id: '1', name: 'Artist One', slug: 'artist-one', bio: 'Bio', portrait: '', order: 0 },
]

beforeEach(() => {
  vi.clearAllMocks()
  prisma.artist.findMany.mockResolvedValue(fakeArtists)
})

describe('GET /api/artists', () => {
  it('returns 200 with artist list', async () => {
    const req = mockReq()
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual(fakeArtists)
  })

  it('returns 405 for non-GET methods', async () => {
    const req = mockReq({ method: 'POST' })
    const res = mockRes()
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })
})
