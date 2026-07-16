/**
 * Formatting/validation helpers for Crosshair videos (the video-hub feature),
 * shared by the manual admin CRUD path (`api/admin/crosshair.js`) and the YouTube
 * sync path (`youtubeChannelSync.js`) so both produce the same client-facing shape.
 * Runs in both server and client contexts — pure functions, no I/O.
 */
import { buildClientImageUrl } from './images.js'
import { getYouTubeEmbedUrl, getYouTubeVideoId } from './artistVideos.js'

export const CROSSHAIR_VIDEO_TYPE = {
  UNCUT: 'UNCUT',
  EDITED: 'EDITED',
  SHORT: 'SHORT',
}

export const CROSSHAIR_VIDEO_TYPE_OPTIONS = [
  { value: CROSSHAIR_VIDEO_TYPE.UNCUT, label: 'Uncut' },
  { value: CROSSHAIR_VIDEO_TYPE.EDITED, label: 'Edited' },
  { value: CROSSHAIR_VIDEO_TYPE.SHORT, label: 'Shorts' },
]

export function getCrosshairVideoTypeLabel(value) {
  return CROSSHAIR_VIDEO_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? 'Uncut'
}

export function getYouTubeThumbnailUrl(youtubeUrl) {
  const videoId = getYouTubeVideoId(youtubeUrl)
  if (!videoId) return null
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

/**
 * Shapes a `CrosshairVideo` row for client consumption: resolves a display
 * thumbnail (custom upload if present, else YouTube's own thumbnail) and adds the
 * embed URL/type label.
 */
export function formatCrosshairVideo(video) {
  const customThumbnailUrl = buildClientImageUrl({
    url: video.thumbnailUrl,
    pathname: video.thumbnailPathname,
  })
  const thumbnailUrl = customThumbnailUrl || getYouTubeThumbnailUrl(video.youtubeUrl)

  return {
    id: video.id,
    title: video.title,
    description: video.description ?? '',
    type: video.type,
    typeLabel: getCrosshairVideoTypeLabel(video.type),
    youtubeVideoId: video.youtubeVideoId,
    youtubeUrl: video.youtubeUrl,
    youtubeEmbedUrl: getYouTubeEmbedUrl(video.youtubeUrl),
    thumbnailUrl,
    customThumbnailUrl,
    thumbnailPathname: video.thumbnailPathname,
    source: video.source ?? 'MANUAL',
    durationSeconds: video.durationSeconds,
    privacyStatus: video.privacyStatus,
    isVisible: video.isVisible,
    publishedAt: video.publishedAt,
    lastSyncedAt: video.lastSyncedAt,
    createdAt: video.createdAt,
    updatedAt: video.updatedAt,
  }
}

/** Sanitizes manual admin CRUD input into the shape `crosshairVideo` writes expect (used by `api/admin/crosshair.js`, not the sync path, which builds its own shape in `youtubeChannelSync.js`). */
export function normalizeCrosshairVideoInput(input = {}) {
  const type = Object.values(CROSSHAIR_VIDEO_TYPE).includes(input.type)
    ? input.type
    : CROSSHAIR_VIDEO_TYPE.UNCUT

  return {
    title: typeof input.title === 'string' ? input.title.trim() : '',
    description: typeof input.description === 'string' ? input.description.trim() : '',
    type,
    youtubeVideoId: getYouTubeVideoId(input.youtubeUrl),
    youtubeUrl: typeof input.youtubeUrl === 'string' ? input.youtubeUrl.trim() : '',
    thumbnailUrl: typeof input.thumbnailUrl === 'string' && input.thumbnailUrl.trim() ? input.thumbnailUrl.trim() : null,
    thumbnailPathname: typeof input.thumbnailPathname === 'string' && input.thumbnailPathname.trim() ? input.thumbnailPathname.trim() : null,
    source: input.source === 'YOUTUBE_SYNC' ? 'YOUTUBE_SYNC' : 'MANUAL',
    durationSeconds: Number.isFinite(Number.parseInt(input.durationSeconds, 10)) ? Number.parseInt(input.durationSeconds, 10) : null,
    privacyStatus: typeof input.privacyStatus === 'string' && input.privacyStatus.trim() ? input.privacyStatus.trim() : null,
    isVisible: input.isVisible !== false,
    publishedAt: typeof input.publishedAt === 'string' && input.publishedAt.trim() ? new Date(input.publishedAt) : null,
  }
}

/** @returns {string|null} A user-facing validation error, or null if `input` is valid. */
export function validateCrosshairVideoInput(input) {
  if (!input.title) return 'Title is required.'
  if (!input.youtubeUrl) return 'YouTube URL is required.'
  if (!getYouTubeVideoId(input.youtubeUrl)) return 'Use a valid YouTube video, shorts, or youtu.be URL.'
  if (input.publishedAt && Number.isNaN(input.publishedAt.getTime())) return 'Publish date is invalid.'
  return null
}
