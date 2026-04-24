import { Buffer } from 'node:buffer'
import { handleUpload } from '@vercel/blob/client'
import { requireAdmin } from '../../src/lib/auth.js'

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body)

  const chunks = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const body = await readJsonBody(req)
    if (body?.type === 'blob.generate-client-token' && !requireAdmin(req, res)) return

    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = clientPayload ? JSON.parse(clientPayload) : {}
        const folder = payload?.folder === 'albums' ? 'albums' : 'artists'

        if (!String(pathname).startsWith(`${folder}/`)) {
          throw new Error('Invalid upload path')
        }

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_IMAGE_SIZE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ folder }),
        }
      },
    })

    return res.status(200).json(json)
  } catch (error) {
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Upload failed' })
  }
}
