import { useId, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { FaArrowDown, FaArrowUp, FaImage, FaTrash, FaUpload } from 'react-icons/fa'
import { buildBlobProxyUrl } from '../../lib/images.js'
import '../../styles/AdminArtistsPage.css'

function sanitizeSegment(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizePrimary(images) {
  if (!images.length) return []
  const primaryIndex = images.findIndex((image) => image.isPrimary)
  return images.map((image, index) => ({
    ...image,
    sortOrder: index,
    isPrimary: primaryIndex === -1 ? index === 0 : index === primaryIndex,
  }))
}

function getDefaultUsage(folder) {
  return folder === 'albums' ? 'cover' : 'portrait'
}

export default function ImageCollectionField({ value, onChange, token, folder, entityLabel }) {
  const inputId = useId()
  const images = Array.isArray(value) ? normalizePrimary(value) : []
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const setImages = (nextImages) => {
    onChange(normalizePrimary(nextImages))
  }

  const moveImage = (index, offset) => {
    const targetIndex = index + offset
    if (targetIndex < 0 || targetIndex >= images.length) return

    const nextImages = [...images]
    const [movedImage] = nextImages.splice(index, 1)
    nextImages.splice(targetIndex, 0, movedImage)
    setImages(nextImages)
  }

  const removeImage = (index) => {
    setImages(images.filter((_, currentIndex) => currentIndex !== index))
  }

  const handleUpload = async (event) => {
    const files = Array.from(event.target.files ?? [])
    if (!files.length || !token) return

    setUploading(true)
    setError('')

    try {
      const uploadedImages = []

      for (const file of files) {
        const pathname = `${folder}/${Date.now()}-${sanitizeSegment(file.name)}`
        const blob = await upload(pathname, file, {
          access: 'private',
          handleUploadUrl: '/api/admin/uploads',
          clientPayload: JSON.stringify({ folder }),
          headers: { Authorization: `Bearer ${token}` },
        })

        uploadedImages.push({
          url: blob.url,
          pathname: blob.pathname ?? pathname,
          previewUrl: buildBlobProxyUrl(blob.pathname ?? pathname),
          usage: getDefaultUsage(folder),
          altText: entityLabel,
          isPrimary: false,
        })
      }

      setImages([
        ...images,
        ...uploadedImages.map((image, index) => ({
          ...image,
          isPrimary: images.length === 0 && index === 0,
        })),
      ])
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  return (
    <div className="admin-artists-page-image-field">
      <label htmlFor={inputId} className={`admin-artists-page-ghost-btn admin-artists-page-upload-btn`}>
        <FaUpload aria-hidden="true" />
        <span>{uploading ? 'Uploading...' : 'Upload images'}</span>
      </label>
      <input
        id={inputId}
        type="file"
        accept="image/*"
        multiple
        onChange={handleUpload}
        className="admin-artists-page-file-input"
        disabled={uploading}
      />

      {images.length === 0 ? (
        <div className="admin-artists-page-empty-image-state">
          <FaImage aria-hidden="true" />
          <span>No images uploaded</span>
        </div>
      ) : (
        <div className="admin-artists-page-image-list">
          {images.map((image, index) => (
            <div key={image.id ?? image.pathname ?? image.url ?? index} className="admin-artists-page-image-card">
              <img src={image.previewUrl || image.url} alt={image.altText || entityLabel || 'Uploaded image'} className="admin-artists-page-thumb" />
              <div className="admin-artists-page-image-meta">
                <div className="admin-artists-page-image-actions">
                  <button type="button" onClick={() => moveImage(index, -1)} className={`admin-artists-page-ghost-btn admin-artists-page-icon-btn`} title="Move up" aria-label="Move image up">
                    <FaArrowUp aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => moveImage(index, 1)} className={`admin-artists-page-ghost-btn admin-artists-page-icon-btn`} title="Move down" aria-label="Move image down">
                    <FaArrowDown aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => removeImage(index)} className={`admin-artists-page-danger-btn admin-artists-page-icon-btn`} title="Remove image" aria-label="Remove image">
                    <FaTrash aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error ? <p className="admin-artists-page-upload-error">{error}</p> : null}
    </div>
  )
}
