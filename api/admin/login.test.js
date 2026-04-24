import { describe, it, expect, vi } from 'vitest'
import { mockReq, mockRes } from '../../src/test/api-helpers.js'

vi.stubEnv('ADMIN_PASSWORD', 'secret123')
vi.stubEnv('JWT_SECRET', 'jwt-test-secret')

import handler from './login.js'

describe('POST /api/admin/login', () => {
  it('returns 200 with token on correct password', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'POST', body: { password: 'secret123' } }), res)
    expect(res.statusCode).toBe(200)
    expect(typeof res.body.token).toBe('string')
  })
  it('returns 401 on wrong password', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'POST', body: { password: 'wrong' } }), res)
    expect(res.statusCode).toBe(401)
  })
  it('returns 405 for non-POST methods', async () => {
    const res = mockRes()
    await handler(mockReq({ method: 'GET' }), res)
    expect(res.statusCode).toBe(405)
  })
})
