import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes } from '../../../src/test/api-helpers.js'

vi.stubEnv('JWT_SECRET', 'test-secret')
vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: { recordPlayerTrack: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() } },
}))

import handler from './index.js'
import { prisma } from '../../../src/lib/prisma.js'
import { signToken } from '../../../src/lib/auth.js'

function auth() { return { authorization: `Bearer ${signToken()}` } }
const fakeTracks = [{ id: 'rp1', songId: 's1', position: 1, active: true }]

beforeEach(() => vi.clearAllMocks())

describe('GET /api/admin/record-player', () => {
  it('returns all record player tracks', async () => {
    prisma.recordPlayerTrack.findMany.mockResolvedValue(fakeTracks)
    const res = mockRes()
    await handler(mockReq({ headers: auth() }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})
describe('PUT /api/admin/record-player', () => {
  it('replaces all tracks and returns 200', async () => {
    prisma.recordPlayerTrack.deleteMany.mockResolvedValue({})
    prisma.recordPlayerTrack.createMany.mockResolvedValue({ count: 1 })
    prisma.recordPlayerTrack.findMany.mockResolvedValue(fakeTracks)
    const res = mockRes()
    await handler(mockReq({ method: 'PUT', headers: auth(), body: { tracks: [{ songId: 's1', position: 1, active: true }] } }), res)
    expect(res.statusCode).toBe(200)
    expect(prisma.recordPlayerTrack.deleteMany).toHaveBeenCalledOnce()
  })
})
