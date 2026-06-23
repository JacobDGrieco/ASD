import { useEffect, useState } from 'react'
import { FaExternalLinkAlt, FaEye, FaEyeSlash, FaPencilAlt, FaTrash } from 'react-icons/fa'
import { SiInstagram } from 'react-icons/si'
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx'
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js'
import { slugify } from '../../lib/slugify.js'
import '../../styles/AdminArtistsPage.css'

const ROLE_OPTIONS = [
  { value: 'MODEL', label: 'Model' },
  { value: 'DESIGNER', label: 'Designer' },
  { value: 'PHOTOGRAPHER', label: 'Photographer' },
  { value: 'EDITOR', label: 'Photo Editor' },
  { value: 'STYLIST', label: 'Stylist' },
  { value: 'OTHER', label: 'Other' },
]

const ROLE_LABEL_BY_VALUE = Object.fromEntries(ROLE_OPTIONS.map((option) => [option.value, option.label]))

const empty = {
  name: '',
  slug: '',
  role: 'MODEL',
  isVisible: true,
  bio: '',
  images: [],
  order: 0,
  instagramProfile: '',
  email: '',
  website: '',
  agencyName: '',
  agencyContact: '',
}

function iconLabel(icon, text) {
  return (
    <span className="admin-modal-label-with-icon">
      <span className="admin-modal-label-icon" aria-hidden="true">{icon}</span>
      <span>{text}</span>
    </span>
  )
}

const columns = [
  { key: 'images', label: 'Image', kind: 'images', className: 'admin-artists-page-col-image' },
  { key: 'name', label: 'Name', className: 'admin-artists-page-col-lg' },
  { key: 'role', label: 'Role', kind: 'role', className: 'admin-artists-page-col-sm' },
  { key: 'instagramProfile', label: <SiInstagram />, headerLabel: 'Instagram', kind: 'link', className: 'admin-artists-page-col-action admin-artists-page-center-cell' },
  { key: 'email', label: 'Email', className: 'admin-artists-page-col-sm' },
]

function primaryImage(images) {
  if (!Array.isArray(images) || images.length === 0) return null
  return images.find((image) => image.isPrimary) ?? images[0]
}

function validateTalentForm(form) {
  if (!form.name?.trim()) return 'Name is required.'
  if (!form.role) return 'Role is required.'
  return null
}

function isTalentHidden(talent) {
  return talent?.isVisible === false
}

export default function AdminFashionTalentPage() {
  const { token } = useAdminAuth()
  const auth = { Authorization: `Bearer ${token}` }
  const [talent, setTalent] = useState([])
  const [form, setForm] = useState(null)
  const [draggedId, setDraggedId] = useState(null)
  const [dropTargetId, setDropTargetId] = useState(null)
  const [loadingEditId, setLoadingEditId] = useState(null)

  useEffect(() => {
    let ignore = false

    loadAdminResource({ cacheKey: 'fashion-talent-list', url: '/api/admin/fashion/talent', token })
      .then((list) => {
        if (!ignore) setTalent(list)
      })

    return () => {
      ignore = true
    }
  }, [token])

  const openCreate = () => setForm({ ...empty })
  const openEdit = async (person) => {
    setLoadingEditId(person.id)
    try {
      const detail = await fetch(`/api/admin/fashion/talent?id=${person.id}`, { headers: auth }).then((r) => r.json())
      setForm({ ...empty, ...detail, images: detail.images ?? [] })
    } finally {
      setLoadingEditId(null)
    }
  }
  const closeForm = () => setForm(null)
  const nextOrder = talent.reduce((maxOrder, person) => Math.max(maxOrder, person.order ?? 0), -1) + 1

  const handleSave = async () => {
    const validationError = validateTalentForm(form)
    if (validationError) {
      window.alert(validationError)
      return
    }

    const isEdit = Boolean(form.id)
    const url = isEdit ? `/api/admin/fashion/talent?id=${form.id}` : '/api/admin/fashion/talent'
    const payload = {
      ...form,
      slug: slugify(form.name),
      ...(isEdit ? {} : { order: nextOrder }),
    }
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to save talent.' }))
      window.alert(error.error ?? 'Failed to save talent.')
      return
    }
    const saved = await res.json()
    const nextTalent = isEdit ? talent.map((person) => (person.id === saved.id ? saved : person)) : [...talent, saved]
    setTalent(nextTalent)
    primeAdminResource('fashion-talent-list', token, nextTalent)
    closeForm()
  }

  const handleDelete = async (id) => {
    await fetch(`/api/admin/fashion/talent?id=${id}`, { method: 'DELETE', headers: auth })
    const nextTalent = talent.filter((person) => person.id !== id)
    setTalent(nextTalent)
    primeAdminResource('fashion-talent-list', token, nextTalent)
  }

  const persistTalentOrder = async (nextTalent) => {
    const changed = nextTalent.filter((person, index) => person.order !== index)
    if (!changed.length) return nextTalent

    const saved = await Promise.all(
      changed.map((person) => {
        const nextOrderValue = nextTalent.findIndex((candidate) => candidate.id === person.id)
        return fetch(`/api/admin/fashion/talent?id=${person.id}`, {
          method: 'PUT',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: nextOrderValue }),
        }).then((res) => res.json())
      })
    )

    const savedById = new Map(saved.map((person) => [person.id, person]))
    return nextTalent.map((person, index) => savedById.get(person.id) ?? { ...person, order: index })
  }

  const handleDragStart = (event, id) => {
    if (form) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
    setDraggedId(id)
  }

  const handleDragOver = (event, id) => {
    if (!draggedId || draggedId === id) return
    event.preventDefault()
    setDropTargetId(id)
  }

  const handleDrop = async (id) => {
    if (!draggedId || draggedId === id) {
      setDraggedId(null)
      setDropTargetId(null)
      return
    }

    const draggedIndex = talent.findIndex((person) => person.id === draggedId)
    const targetIndex = talent.findIndex((person) => person.id === id)
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null)
      setDropTargetId(null)
      return
    }

    const reordered = [...talent]
    const [moved] = reordered.splice(draggedIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    const normalized = reordered.map((person, index) => ({ ...person, order: index }))
    setTalent(normalized)
    primeAdminResource('fashion-talent-list', token, normalized)
    setDraggedId(null)
    setDropTargetId(null)

    const persisted = await persistTalentOrder(reordered)
    setTalent(persisted)
    primeAdminResource('fashion-talent-list', token, persisted)
  }

  const handleDragEnd = () => {
    setDraggedId(null)
    setDropTargetId(null)
  }

  const renderDisplayValue = (person, column) => {
    if (column.kind === 'images') {
      const image = primaryImage(person.images)
      if (!image) return <span className="admin-artists-page-empty-value">-</span>
      return (
        <div className="admin-artists-page-image-summary">
          <div className={`admin-artists-page-thumb-frame ${isTalentHidden(person) ? 'admin-artists-page-thumb-frame-hidden' : ''}`.trim()}>
            <img src={image.previewUrl || image.url} alt={person.name} className="admin-artists-page-thumb" />
          </div>
          <span className="admin-artists-page-image-count">{person.imageCount ?? person.images?.length ?? 1} image{(person.imageCount ?? person.images?.length ?? 1) === 1 ? '' : 's'}</span>
        </div>
      )
    }

    if (column.kind === 'role') {
      return <span className="admin-artists-page-cell-value">{ROLE_LABEL_BY_VALUE[person.role] ?? person.role}</span>
    }

    const value = person[column.key]
    if (value === null || value === undefined || value === '') return <span className="admin-artists-page-empty-value">-</span>

    if (column.kind === 'link') {
      return (
        <a href={String(value)} target="_blank" rel="noreferrer" className="admin-artists-page-link-btn" aria-label={`Open ${column.headerLabel} link`} title="Open in new tab">
          <FaExternalLinkAlt aria-hidden="true" />
        </a>
      )
    }

    return <span className="admin-artists-page-cell-value" title={String(value)}>{String(value)}</span>
  }

  const renderHeader = (column) => {
    if (column.kind !== 'link') return column.label
    return (
      <span className="admin-artists-page-social-header" title={column.headerLabel}>
        <span aria-hidden="true">{column.label}</span>
        <span className="admin-artists-page-sr-only">{column.headerLabel}</span>
      </span>
    )
  }

  return (
    <div>
      <div className="admin-artists-page-sticky-top">
        <div className="admin-artists-page-header">
          <h1 className="admin-artists-page-title">Fashion Talent</h1>
          <button onClick={openCreate} className="admin-artists-page-primary-btn">New Talent</button>
        </div>
      </div>

      <div className="admin-artists-page-table-wrap">
        <table className="admin-artists-page-table">
          <thead>
            <tr>
              <th className="admin-artists-page-drag-header"></th>
              {columns.map((column) => <th key={column.key} className={column.className}>{renderHeader(column)}</th>)}
              <th className="admin-artists-page-actions-col admin-artists-page-sticky-right-0"></th>
            </tr>
          </thead>
          <tbody>
            {talent.map((person) => (
              <tr
                key={person.id}
                className={[
                  dropTargetId === person.id ? 'admin-artists-page-drop-target-row' : '',
                  isTalentHidden(person) ? 'admin-artists-page-hidden-row' : '',
                ].filter(Boolean).join(' ')}
                onDragOver={(event) => handleDragOver(event, person.id)}
                onDrop={(event) => {
                  event.preventDefault()
                  handleDrop(person.id)
                }}
              >
                <td className="admin-artists-page-drag-cell">
                  <button
                    type="button"
                    draggable={!form}
                    onDragStart={(event) => handleDragStart(event, person.id)}
                    onDragEnd={handleDragEnd}
                    className="admin-artists-page-drag-handle"
                    aria-label={`Reorder ${person.name}`}
                    title="Drag to reorder"
                  >
                    ::
                  </button>
                </td>
                {columns.map((column) => (
                  <td key={column.key} className={column.className ?? ''}>
                    {renderDisplayValue(person, column)}
                  </td>
                ))}
                <td className="admin-artists-page-action-cell admin-artists-page-actions-col admin-artists-page-sticky-right-0">
                  <div className="admin-artists-page-actions">
                    <button type="button" onClick={() => void openEdit(person)} disabled={loadingEditId === person.id} className="admin-artists-page-ghost-btn admin-artists-page-icon-btn" aria-label="Edit talent" title="Edit">
                      <FaPencilAlt aria-hidden="true" />
                    </button>
                    <ConfirmActionButton
                      message="Delete this person? They will be removed from any Look credits."
                      onConfirm={() => handleDelete(person.id)}
                      buttonClassName="admin-artists-page-danger-btn admin-artists-page-icon-btn"
                      buttonAriaLabel="Delete talent"
                      buttonTitle="Delete"
                    >
                      <FaTrash aria-hidden="true" />
                    </ConfirmActionButton>
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
              <h2 className="admin-modal-title">{form.id ? 'Edit Talent' : 'New Talent'}</h2>
              <button type="button" onClick={closeForm} className="admin-modal-close" aria-label="Close">×</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-modal-grid">
                <div className="admin-modal-field admin-modal-field-full">
                  <div className="admin-artists-page-name-field">
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, isVisible: !current.isVisible }))}
                      className={`admin-artists-page-visibility-toggle ${form.isVisible ? '' : 'admin-artists-page-visibility-toggle-hidden'}`.trim()}
                      aria-label={form.isVisible ? 'Talent is visible to the public. Click to hide.' : 'Talent is hidden from the public. Click to show.'}
                      title={form.isVisible ? 'Visible on public site' : 'Hidden from public site'}
                    >
                      {form.isVisible ? <FaEye aria-hidden="true" /> : <FaEyeSlash aria-hidden="true" />}
                    </button>
                    <div className="admin-artists-page-name-field-main">
                      <label className="admin-modal-label">Name</label>
                      <input
                        type="text"
                        placeholder="Name"
                        value={form.name}
                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value, slug: slugify(event.target.value) }))}
                        className="admin-artists-page-input"
                      />
                    </div>
                  </div>
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Role</label>
                  <select
                    value={form.role}
                    onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                    className="admin-artists-page-input"
                  >
                    {ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Images</label>
                  <ImageCollectionField
                    value={form.images}
                    onChange={(images) => setForm((current) => ({ ...current, images }))}
                    token={token}
                    folder="fashion-talent"
                    entityLabel={form.name || 'Talent image'}
                  />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Bio</label>
                  <textarea
                    placeholder="Bio"
                    value={form.bio}
                    onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                    className="admin-artists-page-input admin-modal-textarea"
                    rows={5}
                  />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">{iconLabel(<SiInstagram />, 'Instagram URL')}</label>
                  <input type="url" placeholder="Instagram URL" value={form.instagramProfile} onChange={(event) => setForm((current) => ({ ...current, instagramProfile: event.target.value }))} className="admin-artists-page-input" />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Email</label>
                  <input type="email" placeholder="Contact email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="admin-artists-page-input" />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Website</label>
                  <input type="url" placeholder="Personal or portfolio site" value={form.website} onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))} className="admin-artists-page-input" />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Agency Name</label>
                  <input type="text" placeholder="Agency name (if signed)" value={form.agencyName} onChange={(event) => setForm((current) => ({ ...current, agencyName: event.target.value }))} className="admin-artists-page-input" />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Agency Contact</label>
                  <input type="text" placeholder="Agency email or phone" value={form.agencyContact} onChange={(event) => setForm((current) => ({ ...current, agencyContact: event.target.value }))} className="admin-artists-page-input" />
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
