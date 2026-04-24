import { describe, it, expect } from 'vitest'
import { mockReq, mockRes } from './api-helpers.js'

describe('test helpers', () => {
  it('mockReq defaults to GET', () => {
    const req = mockReq()
    expect(req.method).toBe('GET')
  })

  it('mockRes captures status and json', () => {
    const res = mockRes()
    res.status(404).json({ error: 'not found' })
    expect(res.statusCode).toBe(404)
    expect(res.body).toEqual({ error: 'not found' })
  })
})
