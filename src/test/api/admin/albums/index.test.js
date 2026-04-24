import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes } from '../../../api-helpers.js'

vi.stubEnv('JWT_SECRET', 'test-secret')
vi.mock('../../../../lib/prisma.js', () => ({
  prisma: { album: { findMany: vi.fn(), create: vi.fn() } },
}))

import handler from '../../../../../api/admin/albums.js'
import { prisma } from '../../../../lib/prisma.js'
import { signToken } from '../../../../lib/auth.js'

function auth() { return { authorization: `Bearer ${signToken()}` } }
const fakeAlbum = { id: 'a1', title: 'Debut', slug: 'artist-one-debut', type: 'ALBUM', coverArt: '', releaseDate: new Date('2024-01-01'), artistId: '1' }

beforeEach(() => vi.clearAllMocks())

describe('GET /api/admin/albums', () => {
  it('returns 401 without token', async () => {
    const res = mockRes()
    await handler(mockReq({ headers: {} }), res)
    expect(res.statusCode).toBe(401)
  })
  it('returns 200 with albums', async () => {
    prisma.album.findMany.mockResolvedValue([fakeAlbum])
    const res = mockRes()
    await handler(mockReq({ headers: auth() }), res)
    expect(res.statusCode).toBe(200)
  })
})
describe('POST /api/admin/albums', () => {
  it('creates album and returns 201', async () => {
    prisma.album.create.mockResolvedValue(fakeAlbum)
    const res = mockRes()
    await handler(mockReq({ method: 'POST', headers: auth(), body: { title: 'Debut', slug: 'artist-one-debut', type: 'ALBUM', coverArt: '', releaseDate: '2024-01-01', artistId: '1' } }), res)
    expect(res.statusCode).toBe(201)
  })
})
