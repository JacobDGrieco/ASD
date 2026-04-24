import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockReq, mockRes } from '../../../api-helpers.js'

vi.stubEnv('JWT_SECRET', 'test-secret')
vi.mock('../../../../lib/prisma.js', () => ({
  prisma: { annotation: { create: vi.fn() } },
}))

import handler from '../../../../../api/admin/annotations.js'
import { prisma } from '../../../../lib/prisma.js'
import { signToken } from '../../../../lib/auth.js'

function auth() { return { authorization: `Bearer ${signToken()}` } }

beforeEach(() => vi.clearAllMocks())

describe('POST /api/admin/annotations', () => {
  it('creates annotation and returns 201', async () => {
    const fake = { id: 'a1', lyricBlockId: 'lb1', startChar: 0, endChar: 10, explanation: 'Means X' }
    prisma.annotation.create.mockResolvedValue(fake)
    const res = mockRes()
    await handler(mockReq({ method: 'POST', headers: auth(), body: { lyricBlockId: 'lb1', startChar: 0, endChar: 10, explanation: 'Means X' } }), res)
    expect(res.statusCode).toBe(201)
    expect(res.body.explanation).toBe('Means X')
  })
  it('returns 401 without token', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'POST', headers: {} }), res)
    expect(res.statusCode).toBe(401)
  })
})
