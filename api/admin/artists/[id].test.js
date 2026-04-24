import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes } from '../../../src/test/api-helpers.js'

vi.stubEnv('JWT_SECRET', 'test-secret')
vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: { artist: { update: vi.fn(), delete: vi.fn() } },
}))

import handler from './[id].js'
import { prisma } from '../../../src/lib/prisma.js'
import { signToken } from '../../../src/lib/auth.js'

function auth() { return { authorization: `Bearer ${signToken()}` } }

beforeEach(() => vi.clearAllMocks())

describe('PUT /api/admin/artists/[id]', () => {
  it('updates artist and returns 200', async () => {
    prisma.artist.update.mockResolvedValue({ id: '1', name: 'Updated' })
    const res = mockRes()
    await handler(mockReq({ method: 'PUT', headers: auth(), query: { id: '1' }, body: { name: 'Updated' } }), res)
    expect(res.statusCode).toBe(200)
  })
})
describe('DELETE /api/admin/artists/[id]', () => {
  it('deletes artist and returns 204', async () => {
    prisma.artist.delete.mockResolvedValue({})
    const res = mockRes()
    await handler(mockReq({ method: 'DELETE', headers: auth(), query: { id: '1' } }), res)
    expect(res.statusCode).toBe(204)
  })
})
