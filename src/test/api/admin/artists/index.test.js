import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes } from '../../../api-helpers.js'

vi.stubEnv('JWT_SECRET', 'test-secret')
vi.mock('../../../../lib/prisma.js', () => ({
  prisma: { artist: { findMany: vi.fn(), create: vi.fn() } },
}))

import handler from '../../../../../api/admin/artists.js'
import { prisma } from '../../../../lib/prisma.js'
import { signToken } from '../../../../lib/auth.js'

function auth() { return { authorization: `Bearer ${signToken()}` } }
const fakeArtist = { id: '1', name: 'Artist One', slug: 'artist-one', bio: '', aboutMe: '', portrait: '', order: 0 }

beforeEach(() => vi.clearAllMocks())

describe('GET /api/admin/artists', () => {
  it('returns 401 without token', async () => {
    const res = mockRes()
    await handler(mockReq({ headers: {} }), res)
    expect(res.statusCode).toBe(401)
  })
  it('returns 200 with artist list', async () => {
    prisma.artist.findMany.mockResolvedValue([fakeArtist])
    const res = mockRes()
    await handler(mockReq({ headers: auth() }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})

describe('POST /api/admin/artists', () => {
  it('creates artist and returns 201', async () => {
    prisma.artist.create.mockResolvedValue(fakeArtist)
    const res = mockRes()
    await handler(mockReq({ method: 'POST', headers: auth(), body: { name: 'Artist One', slug: 'artist-one' } }), res)
    expect(res.statusCode).toBe(201)
  })
})
