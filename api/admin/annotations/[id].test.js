import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes } from '../../../src/test/api-helpers.js'

vi.stubEnv('JWT_SECRET', 'test-secret')
vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: { annotation: { update: vi.fn(), delete: vi.fn() } },
}))

import handler from './[id].js'
import { prisma } from '../../../src/lib/prisma.js'
import { signToken } from '../../../src/lib/auth.js'

function auth() { return { authorization: `Bearer ${signToken()}` } }

beforeEach(() => vi.clearAllMocks())

describe('PUT /api/admin/annotations/[id]', () => {
  it('updates annotation and returns 200', async () => {
    prisma.annotation.update.mockResolvedValue({ id: 'a1', explanation: 'Updated' })
    const res = mockRes()
    await handler(mockReq({ method: 'PUT', headers: auth(), query: { id: 'a1' }, body: { startChar: 0, endChar: 10, explanation: 'Updated' } }), res)
    expect(res.statusCode).toBe(200)
  })
})
describe('DELETE /api/admin/annotations/[id]', () => {
  it('deletes annotation and returns 204', async () => {
    prisma.annotation.delete.mockResolvedValue({})
    const res = mockRes()
    await handler(mockReq({ method: 'DELETE', headers: auth(), query: { id: 'a1' } }), res)
    expect(res.statusCode).toBe(204)
  })
})
