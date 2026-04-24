import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes } from '../../../api-helpers.js'

vi.stubEnv('JWT_SECRET', 'test-secret')
vi.mock('../../../../lib/prisma.js', () => ({
  prisma: { lyricBlock: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() } },
}))

import handler from '../../../../../api/admin/lyrics.js'
import { prisma } from '../../../../lib/prisma.js'
import { signToken } from '../../../../lib/auth.js'

function auth() { return { authorization: `Bearer ${signToken()}` } }
const fakeBlocks = [{ id: 'lb1', songId: 's1', text: 'Line one', blockOrder: 0, annotations: [] }]

beforeEach(() => vi.clearAllMocks())

describe('GET /api/admin/lyrics/[songId]', () => {
  it('returns lyric blocks with annotations', async () => {
    prisma.lyricBlock.findMany.mockResolvedValue(fakeBlocks)
    const res = mockRes()
    await handler(mockReq({ headers: auth(), query: { songId: 's1' } }), res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toHaveLength(1)
  })
})
describe('PUT /api/admin/lyrics/[songId]', () => {
  it('replaces all lyric blocks and returns 200', async () => {
    prisma.lyricBlock.deleteMany.mockResolvedValue({})
    prisma.lyricBlock.createMany.mockResolvedValue({ count: 2 })
    prisma.lyricBlock.findMany.mockResolvedValue(fakeBlocks)
    const res = mockRes()
    await handler(mockReq({ method: 'PUT', headers: auth(), query: { songId: 's1' }, body: { blocks: [{ text: 'Line one', blockOrder: 0 }, { text: 'Line two', blockOrder: 1 }] } }), res)
    expect(res.statusCode).toBe(200)
    expect(prisma.lyricBlock.deleteMany).toHaveBeenCalledWith({ where: { songId: 's1' } })
    expect(prisma.lyricBlock.createMany).toHaveBeenCalledOnce()
  })
})
