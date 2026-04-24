import { describe, it, expect, vi } from 'vitest'

vi.stubEnv('JWT_SECRET', 'test-secret-1234')
vi.stubEnv('ADMIN_PASSWORD', 'correct-password')

import { signToken, verifyToken, requireAdmin } from './auth.js'
import { mockReq, mockRes } from '../test/api-helpers.js'

describe('signToken', () => {
  it('returns a non-empty string', () => {
    const token = signToken()
    expect(typeof token).toBe('string')
    expect(token.length).toBeGreaterThan(10)
  })
})

describe('verifyToken', () => {
  it('returns true for a valid token', () => {
    const token = signToken()
    expect(verifyToken(token)).toBe(true)
  })

  it('returns false for a garbage string', () => {
    expect(verifyToken('not-a-token')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(verifyToken('')).toBe(false)
  })
})

describe('requireAdmin', () => {
  it('returns true when Authorization header has a valid token', () => {
    const token = signToken()
    const req = mockReq({ headers: { authorization: `Bearer ${token}` } })
    const res = mockRes()
    expect(requireAdmin(req, res)).toBe(true)
    expect(res.statusCode).toBe(200)
  })

  it('returns false and sets 401 when no Authorization header', () => {
    const req = mockReq({ headers: {} })
    const res = mockRes()
    expect(requireAdmin(req, res)).toBe(false)
    expect(res.statusCode).toBe(401)
  })

  it('returns false and sets 401 for invalid token', () => {
    const req = mockReq({ headers: { authorization: 'Bearer bad-token' } })
    const res = mockRes()
    expect(requireAdmin(req, res)).toBe(false)
    expect(res.statusCode).toBe(401)
  })
})
