import { del } from '@vercel/blob'
import { prisma } from './prisma.js'

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

export function removedBlobPathnames(before, after) {
  const beforePathnames = collectBlobPathnames(before)
  const afterPathnames = new Set(collectBlobPathnames(after))
  return beforePathnames.filter((pathname) => !afterPathnames.has(pathname))
}

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

export async function deleteRemovedBlobPathnames(before, after) {
  return deleteUnusedBlobPathnames(removedBlobPathnames(before, after))
}
