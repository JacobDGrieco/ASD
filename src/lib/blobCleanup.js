/**
 * Deletes Vercel Blob-stored images/files once nothing in the database references
 * them anymore, so replacing or removing an image in the admin CMS doesn't leave
 * orphaned blobs accumulating in storage.
 *
 * Runs server-only (admin API handlers) — imports the Blob SDK's `del` and hits
 * Prisma directly. Called from every admin endpoint that manages an image/file
 * field (`api/admin/artists.js`, `albums.js`, `songs.js`, `fashion.js`,
 * `fashionCollections.js`, `about.js`, `crosshair.js`, `outside-artists.js`) after
 * an update (to clean up a replaced image) or a delete (to clean up everything the
 * deleted record owned).
 *
 * Safety model: before deleting a blob pathname, `isBlobPathnameReferenced` re-queries
 * every model that could still reference it. This is a best-effort check-then-delete,
 * not a transaction — a pathname could theoretically be re-referenced between the
 * check and the delete, but Vercel Blob has no atomic "delete if unreferenced"
 * primitive, so this is the practical mitigation. Deletion failures are caught and
 * only logged (`console.warn`), never surfaced to the caller, so a transient Blob
 * API failure won't fail the admin request that triggered the cleanup — the tradeoff
 * is that a failed delete can leave an orphaned blob with no operator-visible signal.
 */
import { del } from '@vercel/blob'
import { prisma } from './prisma.js'

// Only pathnames rooted in one of these folders are treated as blobs this app
// manages — guards against `blobPathnameFromReference` matching an unrelated path.
const MANAGED_BLOB_FOLDERS = new Set([
  'artists',
  'albums',
  'songs',
  'board',
  'about-members',
  'music-outside-artists',
  'fashion-talent',
  'fashion-looks',
  'fashion-pieces',
  'fashion-crew',
  'fashion-collections',
])

function normalizeManagedPathname(value) {
  const pathname = typeof value === 'string' ? value.trim().replace(/^\/+/, '') : ''
  if (!pathname) return ''
  const folder = pathname.split('/')[0]
  return MANAGED_BLOB_FOLDERS.has(folder) ? pathname : ''
}

/**
 * Normalizes any of the three shapes an image reference can take in this codebase
 * — a bare managed-folder pathname, a `/api/blob?pathname=` proxy URL, or a full
 * `*.blob.vercel-storage.com` URL — down to a canonical pathname, or `''` if the
 * reference isn't a recognized managed blob.
 */
export function blobPathnameFromReference(value) {
  const reference = typeof value === 'string' ? value.trim() : ''
  if (!reference) return ''

  const directPathname = normalizeManagedPathname(reference)
  if (directPathname) return directPathname

  try {
    const url = new URL(reference, 'http://localhost')
    if (url.pathname === '/api/blob') {
      return normalizeManagedPathname(url.searchParams.get('pathname') ?? '')
    }

    if (/\.blob\.vercel-storage\.com$/i.test(url.hostname)) {
      return normalizeManagedPathname(decodeURIComponent(url.pathname.replace(/^\/+/, '')))
    }
  } catch {
    return ''
  }

  return ''
}

/**
 * Recursively collects every managed blob pathname referenced by the given values.
 * Accepts a mix of strings, arrays, and image-like objects (checked in order:
 * `pathname`, then `url`, then `previewUrl`) so callers can pass raw DB fields,
 * client-shaped image arrays, or both without pre-normalizing.
 *
 * @returns {string[]} Deduplicated list of canonical pathnames.
 */
export function collectBlobPathnames(...sources) {
  const pathnames = []

  const collect = (source) => {
    if (!source) return
    if (Array.isArray(source)) {
      for (const item of source) collect(item)
      return
    }

    if (typeof source === 'string') {
      const pathname = blobPathnameFromReference(source)
      if (pathname) pathnames.push(pathname)
      return
    }

    if (typeof source === 'object') {
      const pathname = blobPathnameFromReference(source.pathname)
        || blobPathnameFromReference(source.url)
        || blobPathnameFromReference(source.previewUrl)
      if (pathname) pathnames.push(pathname)
    }
  }

  for (const source of sources) collect(source)
  return [...new Set(pathnames)]
}

/** Pathnames present in `before` but no longer present in `after` — i.e. candidates for cleanup after an update. */
export function removedBlobPathnames(before, after) {
  const beforePathnames = collectBlobPathnames(before)
  const afterPathnames = new Set(collectBlobPathnames(after))
  return beforePathnames.filter((pathname) => !afterPathnames.has(pathname))
}

// Every model with an image/file field gets checked here — a false negative (missed
// reference) would cause data-in-use to be deleted, so this list must stay in sync
// with the schema whenever a new image-bearing model is added.
async function isBlobPathnameReferenced(pathname) {
  const exactPathnameCounts = await Promise.all([
    prisma.artistImage.count({ where: { pathname } }),
    prisma.albumImage.count({ where: { pathname } }),
    prisma.songImage.count({ where: { pathname } }),
    prisma.companyMember.count({ where: { imagePathname: pathname } }),
    prisma.musicOutsideArtist.count({ where: { pathname } }),
    prisma.artistVideo.count({ where: { posterPathname: pathname } }),
    prisma.crosshairVideo.count({ where: { thumbnailPathname: pathname } }),
    prisma.fashionTalentImage.count({ where: { pathname } }),
    prisma.fashionCollection.count({ where: { coverPathname: pathname } }),
    prisma.fashionLookImage.count({ where: { pathname } }),
    prisma.fashionPiece.count({ where: { pathname } }),
    prisma.fashionCrew.count({ where: { pathname } }),
  ])

  if (exactPathnameCounts.some((count) => count > 0)) return true

  // Older records may still store a raw URL/pathname directly on a legacy string
  // column (pre-dating the dedicated *Image tables) — `contains` catches those too.
  const legacyReferenceCounts = await Promise.all([
    prisma.artist.count({ where: { portrait: { contains: pathname } } }),
    prisma.album.count({ where: { coverArt: { contains: pathname } } }),
    prisma.song.count({ where: { artwork: { contains: pathname } } }),
    prisma.boardPost.count({
      where: {
        OR: [
          { imageUrl: { contains: pathname } },
          { body: { contains: pathname } },
        ],
      },
    }),
  ])

  return legacyReferenceCounts.some((count) => count > 0)
}

/**
 * Deletes each of `pathnames` from Vercel Blob, but only after confirming nothing
 * in the database still references it (see module header for the check-then-delete
 * caveat). Failures are logged and swallowed rather than thrown, so callers never
 * need to handle a cleanup failure — the tradeoff is silent orphaned blobs on error.
 *
 * @returns {Promise<string[]>} Pathnames actually deleted (empty on no-op or failure).
 */
export async function deleteUnusedBlobPathnames(pathnames) {
  const normalized = [...new Set(collectBlobPathnames(pathnames))]
  if (!normalized.length) return []

  let unused = []
  try {
    for (const pathname of normalized) {
      if (!(await isBlobPathnameReferenced(pathname))) {
        unused.push(pathname)
      }
    }

    if (!unused.length) return []

    await del(unused)
    return unused
  } catch (error) {
    console.warn('Failed to delete unused blob images', {
      pathnames: unused,
      error: error instanceof Error ? error.message : error,
    })
    return []
  }
}

/** Convenience wrapper for the update path: clean up whatever `before` had that `after` no longer references. */
export async function deleteRemovedBlobPathnames(before, after) {
  return deleteUnusedBlobPathnames(removedBlobPathnames(before, after))
}
