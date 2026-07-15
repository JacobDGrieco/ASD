import { Buffer } from 'node:buffer'
import { del, put } from '@vercel/blob'
import { handleUpload } from '@vercel/blob/client'
import { isViewer, requireAdmin } from '../../src/lib/auth.js'
import { blobPathnameFromReference } from '../../src/lib/blobCleanup.js'

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
const ALLOWED_FOLDERS = new Set(['artists', 'albums', 'songs', 'board', 'about-members', 'music-outside-artists', 'fashion-talent', 'fashion-looks', 'fashion-pieces', 'fashion-crew', 'fashion-collections'])
const CONTENT_TYPE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

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

function sanitizeSegment(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeFolder(value) {
  return ALLOWED_FOLDERS.has(value) ? value : 'artists'
}

function extensionFromUrl(url) {
  const pathname = new URL(url).pathname
  const rawName = pathname.split('/').pop() ?? ''
  const match = rawName.match(/\.([a-z0-9]+)$/i)
  return match ? match[1].toLowerCase() : ''
}

function buildRemotePathname(folder, sourceUrl, contentType) {
  const nameFromUrl = sanitizeSegment((new URL(sourceUrl).pathname.split('/').pop() || 'remote-image').replace(/\.[a-z0-9]+$/i, ''))
  const extension = extensionFromUrl(sourceUrl) || CONTENT_TYPE_EXTENSIONS[contentType] || 'img'
  return `${folder}/${Date.now()}-${nameFromUrl || 'remote-image'}.${extension}`
}

async function importImageFromUrl(body) {
  const remoteUrl = typeof body?.url === 'string' ? body.url.trim() : ''
  const requestedFolder = typeof body?.folder === 'string' ? body.folder : 'artists'
  const folder = normalizeFolder(requestedFolder)
  const altText = typeof body?.entityLabel === 'string' ? body.entityLabel.trim() : ''

  if (!remoteUrl) {
    throw new Error('Image URL is required')
  }

  let parsedUrl
  try {
    parsedUrl = new URL(remoteUrl)
  } catch {
    throw new Error('Image URL must be valid')
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Image URL must use http or https')
  }

  const response = await fetch(parsedUrl, {
    redirect: 'follow',
    headers: {
      Accept: ALLOWED_CONTENT_TYPES.join(','),
      'User-Agent': 'ASD Admin Image Import',
    },
  })

  if (!response.ok) {
    throw new Error(`Image download failed (${response.status})`)
  }

  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    throw new Error('Only JPEG, PNG, WebP, GIF, and AVIF images are supported')
  }

  const contentLength = Number(response.headers.get('content-length') || 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Image exceeds the 10 MB upload limit')
  }

  const arrayBuffer = await response.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Image exceeds the 10 MB upload limit')
  }

  const pathname = buildRemotePathname(folder, parsedUrl.toString(), contentType)
  const blob = await put(pathname, Buffer.from(arrayBuffer), {
    access: 'public',
    addRandomSuffix: true,
    contentType,
  })

  return {
    url: blob.url,
    pathname: blob.pathname ?? pathname,
    usage: folder === 'albums' || folder === 'board' || folder === 'fashion-collections'
      ? 'cover'
      : folder === 'songs'
        ? 'artwork'
        : folder === 'fashion-looks'
          ? 'lookbook'
          : folder === 'fashion-pieces'
            ? 'piece'
            : 'portrait',
    altText,
    isPrimary: false,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const body = await readJsonBody(req)
    const uploadSession = requireAdmin(req, res)
    if (!uploadSession) return
    if (isViewer(uploadSession)) return res.status(403).json({ error: 'Forbidden' })

    if (req.method === 'DELETE') {
      const requestedPathnames = Array.isArray(body?.pathnames) ? body.pathnames : [body?.pathname]
      const pathnames = [...new Set(requestedPathnames.flatMap((pathname) => {
        const normalized = blobPathnameFromReference(pathname)
        return normalized ? [normalized] : []
      }))]

      if (!pathnames.length) {
        return res.status(400).json({ error: 'Valid blob pathname is required' })
      }

      await del(pathnames)
      return res.status(200).json({ deleted: pathnames })
    }

    if (body?.type === 'image.import-from-url') {
      const image = await importImageFromUrl(body)
      return res.status(200).json({ image })
    }

    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = clientPayload ? JSON.parse(clientPayload) : {}
        const requestedFolder = typeof payload?.folder === 'string' ? payload.folder : 'artists'
        const folder = normalizeFolder(requestedFolder)

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
