/**
 * Admin CRUD for Crosshair videos, plus two `action=` sub-routes: `config` (GET,
 * reports which YouTube sync auth modes are configured) and `sync` (POST, runs
 * `syncCrosshairFromYouTube` — see that module for what a sync does and how it
 * protects manual edits). Requires `MUSIC_CROSSHAIR` page access and a non-viewer
 * role. Server-only (Vercel Function). Consumed by `AdminMusicCrosshairPage.jsx`.
 */
import { prisma } from '../../src/lib/prisma.js'
import { canAccessAdminPage, isViewer, requireAdmin } from '../../src/lib/auth.js'
import { ADMIN_PAGE_KEYS } from '../../src/lib/adminPageAccess.js'
import { collectBlobPathnames, deleteRemovedBlobPathnames, deleteUnusedBlobPathnames } from '../../src/lib/blobCleanup.js'
import { formatCrosshairVideo, normalizeCrosshairVideoInput, validateCrosshairVideoInput } from '../../src/lib/crosshairVideos.js'
import { getYouTubeSyncConfigStatus, syncCrosshairFromYouTube } from '../../src/lib/youtubeChannelSync.js'

function requireCrosshairAccess(req, res) {
  const session = requireAdmin(req, res)
  if (!session) return null
  if (isViewer(session) || !canAccessAdminPage(session, ADMIN_PAGE_KEYS.MUSIC_CROSSHAIR)) {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }
  return session
}

export default async function handler(req, res) {
  const session = requireCrosshairAccess(req, res)
  if (!session) return

  const id = typeof req.query.id === 'string' ? req.query.id.trim() : ''
  const action = typeof req.query.action === 'string' ? req.query.action.trim() : ''

  if (req.method === 'GET') {
    if (action === 'config') {
      return res.status(200).json(getYouTubeSyncConfigStatus())
    }

    const videos = await prisma.crosshairVideo.findMany({
      orderBy: [
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    })
    return res.status(200).json(videos.map(formatCrosshairVideo))
  }

  if (req.method === 'POST') {
    if (action === 'sync') {
      try {
        const mode = typeof req.body?.mode === 'string' ? req.body.mode : 'auto'
        const result = await syncCrosshairFromYouTube({ mode })
        return res.status(200).json(result)
      } catch (error) {
        return res.status(400).json({ error: error.message })
      }
    }

    const normalized = normalizeCrosshairVideoInput(req.body)
    const validationError = validateCrosshairVideoInput(normalized)
    if (validationError) return res.status(400).json({ error: validationError })

    const video = await prisma.crosshairVideo.create({
      data: normalized,
    })
    return res.status(201).json(formatCrosshairVideo(video))
  }

  if (req.method === 'PUT') {
    if (!id) return res.status(400).json({ error: 'Video id is required.' })
    const existing = await prisma.crosshairVideo.findUnique({
      where: { id },
      select: { thumbnailUrl: true, thumbnailPathname: true },
    })
    if (!existing) return res.status(404).json({ error: 'Video not found.' })
    const normalized = normalizeCrosshairVideoInput(req.body)
    const validationError = validateCrosshairVideoInput(normalized)
    if (validationError) return res.status(400).json({ error: validationError })

    const video = await prisma.crosshairVideo.update({
      where: { id },
      data: normalized,
    })
    await deleteRemovedBlobPathnames(
      [existing.thumbnailPathname, existing.thumbnailUrl],
      [normalized.thumbnailPathname, normalized.thumbnailUrl],
    )
    return res.status(200).json(formatCrosshairVideo(video))
  }

  if (req.method === 'DELETE') {
    if (!id) return res.status(400).json({ error: 'Video id is required.' })
    const existing = await prisma.crosshairVideo.findUnique({
      where: { id },
      select: { thumbnailUrl: true, thumbnailPathname: true },
    })
    if (!existing) return res.status(404).json({ error: 'Video not found.' })
    const blobPathnames = collectBlobPathnames(existing.thumbnailPathname, existing.thumbnailUrl)
    await prisma.crosshairVideo.delete({ where: { id } })
    await deleteUnusedBlobPathnames(blobPathnames)
    return res.status(204).end()
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
