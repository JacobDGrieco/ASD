import { Readable } from 'node:stream'
import { get } from '@vercel/blob'

export default async function handler(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' })

  const pathname = typeof request.query.pathname === 'string' ? request.query.pathname : ''
  const shouldRedirect = request.query.redirect === '1'
  if (!pathname) {
    return response.status(400).json({ error: 'Missing pathname' })
  }

  const result = await get(pathname, {
    access: 'private',
    ifNoneMatch: request.headers['if-none-match'] ?? undefined,
  })

  if (!result) {
    return response.status(404).send('Not found')
  }

  if (result.statusCode === 304) {
    response.setHeader('ETag', result.blob.etag)
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    return response.status(304).end()
  }

  if (shouldRedirect) {
    return response.redirect(307, result.blob.url)
  }

  response.setHeader('Content-Type', result.blob.contentType ?? 'application/octet-stream')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('ETag', result.blob.etag)
  response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  return Readable.fromWeb(result.stream).pipe(response)
}
