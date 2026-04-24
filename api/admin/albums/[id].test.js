import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes } from '../../../src/test/api-helpers.js'

vi.stubEnv('JWT_SECRET', 'test-secret')
vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: { album: { update: vi.fn(), delete: vi.fn() } },
}))

import handler from './[id].js'
import { prisma } from '../../../src/lib/prisma.js'
import { signToken } from '../../../src/lib/auth.js'

function auth() { return { authorization: `Bearer ${signToken()}` } }

beforeEach(() => vi.clearAllMocks())

describe('PUT /api/admin/albums/[id]', () => {
  it('updates album and returns 200', async () => {
    prisma.album.update.mockResolvedValue({ id: 'a1', title: 'Updated' })
    const res = mockRes()
    await handler(mockReq({ method: 'PUT', headers: auth(), query: { id: 'a1' }, body: { title: 'Updated', releaseDate: '2024-01-01' } }), res)
    expect(res.statusCode).toBe(200)
  })
})
describe('DELETE /api/admin/albums/[id]', () => {
  it('deletes album and returns 204', async () => {
    prisma.album.delete.mockResolvedValue({})
    const res = mockRes()
    await handler(mockReq({ method: 'DELETE', headers: auth(), query: { id: 'a1' } }), res)
    expect(res.statusCode).toBe(204)
  })
})
