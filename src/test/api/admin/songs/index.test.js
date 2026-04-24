import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes } from '../../../api-helpers.js'

vi.stubEnv('JWT_SECRET', 'test-secret')
vi.mock('../../../../lib/prisma.js', () => ({
  prisma: { song: { findMany: vi.fn(), create: vi.fn() }, songMeta: { create: vi.fn() } },
}))

import handler from '../../../../../api/admin/songs.js'
import { prisma } from '../../../../lib/prisma.js'
import { signToken } from '../../../../lib/auth.js'

function auth() { return { authorization: `Bearer ${signToken()}` } }
const fakeSong = { id: 's1', title: 'Track One', slug: 'artist-one-track-one', trackNumber: 1, discNumber: 1, duration: '3:42', albumId: 'a1' }

beforeEach(() => vi.clearAllMocks())

describe('GET /api/admin/songs', () => {
  it('returns 200 with songs', async () => {
    prisma.song.findMany.mockResolvedValue([fakeSong])
    const res = mockRes()
    await handler(mockReq({ headers: auth() }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})
describe('POST /api/admin/songs', () => {
  it('creates song + SongMeta and returns 201', async () => {
    prisma.song.create.mockResolvedValue(fakeSong)
    prisma.songMeta.create.mockResolvedValue({ id: 'm1', songId: 's1' })
    const res = mockRes()
    await handler(mockReq({ method: 'POST', headers: auth(), body: { title: 'Track One', slug: 'artist-one-track-one', trackNumber: 1, discNumber: 1, duration: '3:42', albumId: 'a1' } }), res)
    expect(res.statusCode).toBe(201)
    expect(prisma.songMeta.create).toHaveBeenCalledOnce()
  })
})
