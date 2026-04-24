import { describe, expect, it } from 'vitest'
import { getHomePageApiMessage } from './HomePage.jsx'

describe('getHomePageApiMessage', () => {
  it('returns the local development guidance when running in dev', () => {
    expect(getHomePageApiMessage(true)).toContain('npm run dev:vercel')
  })

  it('returns deployment troubleshooting guidance outside local dev', () => {
    const message = getHomePageApiMessage(false)

    expect(message).not.toContain('npm run dev:vercel')
    expect(message).toContain('environment variables')
  })
})
