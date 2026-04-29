import { useEffect, useState } from 'react'
import { FaExternalLinkAlt, FaPencilAlt } from 'react-icons/fa'
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js'
import { ARTIST_VIDEO_SOURCE, buildStaticArtistVideoPath, validateArtistVideoInput } from '../../lib/artistVideos.js'
import '../../styles/AdminArtistsPage.css'
import '../../styles/AdminVideosPage.css'

const VIDEO_BASE_URL = import.meta.env.VITE_VIDEO_BASE_URL || ''

const emptyForm = {
  artistId: '',
  title: '',
  description: '',
  sourceType: '',
  youtubeUrl: '',
  videoUrl: '',
  videosPageUrl: '',
  posterImage: [],
}

function toPosterImage(row) {
  if (!row.posterUrl && !row.posterPathname) return []
  return [{
    url: row.posterUrl,
    pathname: row.posterPathname,
    previewUrl: row.posterPreviewUrl || row.posterUrl,
    usage: 'poster',
    altText: row.title || `${row.artist.name} poster`,
    isPrimary: true,
    sortOrder: 0,
  }]
}

function rowToForm(row) {
  return {
    artistId: row.artist.id,
    title: row.title ?? '',
    description: row.description ?? '',
    sourceType: row.sourceType ?? '',
    youtubeUrl: row.youtubeUrl ?? '',
    videoUrl: row.videoUrl ?? '',
    videosPageUrl: row.videosPageUrl ?? '',
    posterImage: toPosterImage(row),
  }
}

function buildPayload(form) {
  const posterImage = Array.isArray(form.posterImage) ? form.posterImage[0] ?? null : null
  return {
    artistId: form.artistId,
    title: form.title,
    description: form.description,
    sourceType: form.sourceType || null,
    youtubeUrl: form.youtubeUrl,
    videoUrl: form.videoUrl,
    videosPageUrl: form.videosPageUrl,
    posterUrl: posterImage?.url ?? null,
    posterPathname: posterImage?.pathname ?? null,
  }
}

function findArtist(rows, artistId) {
  return rows.find((row) => row.artist.id === artistId)?.artist ?? null
}

export default function AdminVideosPage() {
  const { token } = useAdminAuth()
  const auth = { Authorization: `Bearer ${token}` }
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(null)
  const [loadingArtistId, setLoadingArtistId] = useState(null)

  useEffect(() => {
    let ignore = false

    loadAdminResource({ cacheKey: 'videos-list', url: '/api/admin/videos', token })
      .then((videoRows) => {
        if (!ignore) setRows(videoRows)
      })

    return () => {
      ignore = true
    }
  }, [token])

  const openEdit = (row) => {
    setLoadingArtistId(row.artist.id)
    setForm({ ...emptyForm, ...rowToForm(row) })
    setLoadingArtistId(null)
  }

  const closeForm = () => setForm(null)

  const handleSave = async () => {
    const artist = findArtist(rows, form.artistId)
    const payload = {
      ...buildPayload(form),
      videoUrl: form.sourceType === ARTIST_VIDEO_SOURCE.UPLOAD ? buildStaticArtistVideoPath(artist?.slug, VIDEO_BASE_URL) : form.videoUrl,
    }
    const validationError = validateArtistVideoInput(payload)
    if (validationError) {
      window.alert(validationError)
      return
    }

    const response = await fetch(`/api/admin/videos?artistId=${encodeURIComponent(form.artistId)}`, {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to save video.' }))
      window.alert(error.error ?? 'Failed to save video.')
      return
    }

    const saved = await response.json()
    const nextRows = rows.map((row) => (row.artist.id === saved.artist.id ? saved : row))
    setRows(nextRows)
    primeAdminResource('videos-list', token, nextRows)
    closeForm()
  }

  return (
    <div>
      <div className="admin-artists-page-sticky-top">
        <div className="admin-artists-page-header">
          <h1 className="admin-artists-page-title">Videos</h1>
        </div>
      </div>

      <p className="admin-videos-page-note">
        Each artist has one video row. Posters upload the same way as other site images. Static videos automatically resolve to <code>&lt;base&gt;/videos/&lt;artist-slug&gt;.mp4</code>.
      </p>

      <div className="admin-artists-page-table-wrap">
        <table className="admin-artists-page-table admin-videos-page-table">
          <thead>
            <tr>
              <th className="admin-artists-page-col-image">Poster</th>
              <th className="admin-artists-page-col-lg">Artist</th>
              <th className="admin-artists-page-col-xl">Title</th>
              <th className="admin-artists-page-col-sm">Source</th>
              <th className="admin-artists-page-col-wide">Video</th>
              <th className="admin-artists-page-col-wide">Video Page</th>
              <th className="admin-artists-page-action-cell admin-artists-page-actions-col admin-artists-page-sticky-right-0"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.artist.id}>
                <td className="admin-artists-page-center-cell">
                  {row.posterPreviewUrl ? <img src={row.posterPreviewUrl} alt={row.title || row.artist.name} className="admin-artists-page-thumb" /> : <span className="admin-artists-page-empty-value">-</span>}
                </td>
                <td><span className="admin-artists-page-cell-value">{row.artist.name}</span></td>
                <td>
                  <span className="admin-artists-page-cell-value">{row.title || '-'}</span>
                  {row.description ? <span className="admin-artists-page-wrap-value admin-videos-page-description">{row.description}</span> : null}
                </td>
                <td><span className="admin-artists-page-cell-value">{row.sourceType === ARTIST_VIDEO_SOURCE.YOUTUBE ? 'YouTube' : row.sourceType === ARTIST_VIDEO_SOURCE.UPLOAD ? 'Local' : '-'}</span></td>
                <td>
                  {row.sourceType === ARTIST_VIDEO_SOURCE.YOUTUBE && row.youtubeUrl ? (
                    <a href={row.youtubeUrl} target="_blank" rel="noreferrer" className="admin-artists-page-link-btn" title="Open video">
                      <FaExternalLinkAlt aria-hidden="true" />
                    </a>
                  ) : row.sourceType === ARTIST_VIDEO_SOURCE.UPLOAD && row.videoUrl ? (
                    <a href={row.videoUrl} target="_blank" rel="noreferrer" className="admin-artists-page-link-btn" title="Open video file">
                      <FaExternalLinkAlt aria-hidden="true" />
                    </a>
                  ) : <span className="admin-artists-page-empty-value">-</span>}
                </td>
                <td>
                  {row.videosPageUrl ? (
                    <a href={row.videosPageUrl} target="_blank" rel="noreferrer" className="admin-artists-page-link-btn" title="Open full videos page">
                      <FaExternalLinkAlt aria-hidden="true" />
                    </a>
                  ) : <span className="admin-artists-page-empty-value">-</span>}
                </td>
                <td className="admin-artists-page-action-cell admin-artists-page-actions-col admin-artists-page-sticky-right-0">
                  <div className="admin-artists-page-actions">
                    <button type="button" onClick={() => openEdit(row)} disabled={loadingArtistId === row.artist.id} className="admin-artists-page-ghost-btn admin-artists-page-icon-btn" aria-label="Edit video" title="Edit">
                      <FaPencilAlt aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="admin-modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) closeForm() }}>
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Edit Video</h2>
              <button type="button" onClick={closeForm} className="admin-modal-close" aria-label="Close">×</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-modal-grid">
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Artist</label>
                  <input type="text" value={findArtist(rows, form.artistId)?.name ?? ''} className="admin-artists-page-input" disabled />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Poster</label>
                  <ImageCollectionField
                    value={form.posterImage}
                    onChange={(images) => setForm((current) => ({ ...current, posterImage: images.slice(0, 1) }))}
                    token={token}
                    folder="videos"
                    entityLabel={findArtist(rows, form.artistId)?.name || 'Video poster'}
                  />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Title</label>
                  <input type="text" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="admin-artists-page-input" placeholder="Optional promo title" />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Description</label>
                  <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="admin-artists-page-input admin-modal-textarea" rows={4} placeholder="Optional description" />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Source Type</label>
                  <select
                    value={form.sourceType}
                    onChange={(event) => setForm((current) => ({
                      ...current,
                      sourceType: event.target.value,
                      youtubeUrl: event.target.value === ARTIST_VIDEO_SOURCE.YOUTUBE ? current.youtubeUrl : '',
                      videoUrl: event.target.value === ARTIST_VIDEO_SOURCE.UPLOAD ? buildStaticArtistVideoPath(findArtist(rows, current.artistId)?.slug, VIDEO_BASE_URL) ?? '' : '',
                    }))}
                    className="admin-artists-page-input"
                  >
                    <option value="">No video selected</option>
                    <option value={ARTIST_VIDEO_SOURCE.YOUTUBE}>YouTube embed</option>
                    <option value={ARTIST_VIDEO_SOURCE.UPLOAD}>Local/static file</option>
                  </select>
                </div>
                {form.sourceType === ARTIST_VIDEO_SOURCE.YOUTUBE && (
                  <div className="admin-modal-field admin-modal-field-full">
                    <label className="admin-modal-label">YouTube URL</label>
                    <input type="url" value={form.youtubeUrl} onChange={(event) => setForm((current) => ({ ...current, youtubeUrl: event.target.value }))} className="admin-artists-page-input" placeholder="https://www.youtube.com/watch?v=..." />
                  </div>
                )}
                {form.sourceType === ARTIST_VIDEO_SOURCE.UPLOAD && (
                  <div className="admin-modal-field admin-modal-field-full">
                    <label className="admin-modal-label">Local/Static Video Path</label>
                    <input
                      type="text"
                      value={buildStaticArtistVideoPath(findArtist(rows, form.artistId)?.slug, VIDEO_BASE_URL) ?? ''}
                      className="admin-artists-page-input"
                      disabled
                    />
                  </div>
                )}
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Video Page URL</label>
                  <input type="url" value={form.videosPageUrl} onChange={(event) => setForm((current) => ({ ...current, videosPageUrl: event.target.value }))} className="admin-artists-page-input" placeholder="https://youtube.com/@artist/videos" />
                </div>
              </div>
            </div>
            <div className="admin-modal-footer">
              <button type="button" onClick={closeForm} className="admin-artists-page-ghost-btn">Cancel</button>
              <button type="button" onClick={handleSave} className="admin-artists-page-primary-btn">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
