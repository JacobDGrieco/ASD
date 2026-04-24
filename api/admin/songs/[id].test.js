import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes } from '../../../src/test/api-helpers.js'

vi.stubEnv('JWT_SECRET', 'test-secret')
vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: { song: { update: vi.fn(), delete: vi.fn() }, songMeta: { upsert: vi.fn() } },
}))

import handler from './[id].js'
import { prisma } from '../../../src/lib/prisma.js'
import { signToken } from '../../../src/lib/auth.js'

function auth() { return { authorization: `Bearer ${signToken()}` } }

beforeEach(() => vi.clearAllMocks())

describe('PUT /api/admin/songs/[id]', () => {
  it('updates song and meta, returns 200', async () => {
    prisma.song.update.mockResolvedValue({ id: 's1', title: 'Updated' })
    prisma.songMeta.upsert.mockResolvedValue({})
    const res = mockRes()
    await handler(mockReq({ method: 'PUT', headers: auth(), query: { id: 's1' }, body: { title: 'Updated', trackNumber: 1, discNumber: 1, aboutText: 'About', producers: 'Prod', writers: 'Writer' } }), res)
    expect(res.statusCode).toBe(200)
    expect(prisma.songMeta.upsert).toHaveBeenCalledOnce()
  })
})
describe('DELETE /api/admin/songs/[id]', () => {
  it('deletes song and returns 204', async () => {
    prisma.song.delete.mockResolvedValue({})
    const res = mockRes()
    await handler(mockReq({ method: 'DELETE', headers: auth(), query: { id: 's1' } }), res)
    expect(res.statusCode).toBe(204)
  })
})
