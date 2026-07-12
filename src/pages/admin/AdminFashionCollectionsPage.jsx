import { useEffect, useRef, useState } from 'react'
import { FaEye, FaEyeSlash, FaPencilAlt, FaTrash } from 'react-icons/fa'
import { TabPanel, TabView } from 'primereact/tabview'
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx'
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx'
import CreditsField from '../../components/admin/CreditsField.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js'
import { slugify } from '../../lib/slugify.js'
import '../../styles/AdminArtistsPage.css'

const empty = {
  title: '',
  slug: '',
  description: '',
  about: '',
  season: '',
  location: '',
  coverImages: [],
  isVisible: true,
  order: 0,
  credits: [],
}

const columns = [
  { key: 'coverImage', label: 'Cover', kind: 'image', className: 'admin-artists-page-col-image' },
  { key: 'title', label: 'Title', className: 'admin-artists-page-col-lg' },
  { key: 'season', label: 'Season', className: 'admin-artists-page-col-sm' },
  { key: 'lookCount', label: 'Looks', kind: 'lookCount', className: 'admin-artists-page-col-sm' },
]

function validateCollectionForm(form) {
  if (!form.title?.trim()) return 'Title is required.'
  return null
}

function hasCreditValue(credit) {
  return Boolean(credit?.creditName?.trim() || credit?.talentId || credit?.crewId)
}

function toFormCredits(credits) {
  return (Array.isArray(credits) ? credits : []).map((credit) => ({
    talentId: credit.talentId ?? credit.talent?.id ?? '',
    crewId: credit.crewId ?? credit.crew?.id ?? '',
    creditName: credit.creditName ?? credit.talent?.name ?? credit.crew?.name ?? '',
    roleLabel: credit.roleLabel ?? '',
  }))
}

function toTalentOption(person) {
  return {
    id: person.id,
    name: person.name,
    role: person.role,
    image: person.images?.[0] ?? null,
  }
}

function toCrewOption(person) {
  return {
    id: person.id,
    name: person.name,
    role: person.role,
    image: person.image ?? null,
  }
}

function isCollectionHidden(collection) {
  return collection?.isVisible === false
}

function renderDisplayValue(collection, column) {
  if (column.kind === 'image') {
    const image = collection.coverImage
    if (!image) return <span className="admin-artists-page-empty-value">-</span>
    return (
      <div className="admin-artists-page-image-summary">
        <div className={`admin-artists-page-thumb-frame ${isCollectionHidden(collection) ? 'admin-artists-page-thumb-frame-hidden' : ''}`.trim()}>
          <img src={image.previewUrl || image.url} alt={collection.title} className="admin-artists-page-thumb" />
        </div>
        <span className="admin-artists-page-image-count">cover</span>
      </div>
    )
  }

  if (column.kind === 'lookCount') {
    const count = collection.lookCount ?? 0
    return <span className="admin-artists-page-cell-value">{count} look{count === 1 ? '' : 's'}</span>
  }

  const value = collection[column.key]
  if (value === null || value === undefined || value === '') return <span className="admin-artists-page-empty-value">-</span>
  return <span className="admin-artists-page-cell-value" title={String(value)}>{String(value)}</span>
}

function CollectionsTable({
  collections,
  isFormOpen,
  dropTargetId,
  loadingEditId,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onEdit,
  onDelete,
}) {
  return (
    <div className="admin-artists-page-table-wrap">
      <table className="admin-artists-page-table">
        <thead>
          <tr>
            <th className="admin-artists-page-drag-header"></th>
            {columns.map((column) => <th key={column.key} className={column.className}>{column.label}</th>)}
            <th className="admin-artists-page-actions-col admin-artists-page-sticky-right-0"></th>
          </tr>
        </thead>
        <tbody>
          {collections.map((collection) => (
            <tr
              key={collection.id}
              className={[
                dropTargetId === collection.id ? 'admin-artists-page-drop-target-row' : '',
                isCollectionHidden(collection) ? 'admin-artists-page-hidden-row' : '',
              ].filter(Boolean).join(' ')}
              onDragOver={(event) => onDragOver(event, collection.id)}
              onDrop={(event) => {
                event.preventDefault()
                onDrop(collection.id)
              }}
            >
              <td className="admin-artists-page-drag-cell">
                <button
                  type="button"
                  draggable={!isFormOpen}
                  onDragStart={(event) => onDragStart(event, collection.id)}
                  onDragEnd={onDragEnd}
                  className="admin-artists-page-drag-handle"
                  aria-label={`Reorder ${collection.title}`}
                  title="Drag to reorder"
                >
                  ::
                </button>
              </td>
              {columns.map((column) => (
                <td key={column.key} className={column.className ?? ''}>
                  {renderDisplayValue(collection, column)}
                </td>
              ))}
              <td className="admin-artists-page-action-cell admin-artists-page-actions-col admin-artists-page-sticky-right-0">
                <div className="admin-artists-page-actions">
                  <button type="button" onClick={() => void onEdit(collection)} disabled={loadingEditId === collection.id} className="admin-artists-page-ghost-btn admin-artists-page-icon-btn" aria-label="Edit collection" title="Edit">
                    <FaPencilAlt aria-hidden="true" />
                  </button>
                  <ConfirmActionButton
                    message="Delete this collection? Assigned looks will become loose looks."
                    onConfirm={() => onDelete(collection.id)}
                    buttonClassName="admin-artists-page-danger-btn admin-artists-page-icon-btn"
                    buttonAriaLabel="Delete collection"
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
  )
}

function CollectionFormModal({ form, setForm, token, talentOptions, crewOptions, onClose, onSave }) {
  return (
    <div className="admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="admin-modal">
        <div className="admin-modal-header">
          <h2 className="admin-modal-title">{form.id ? 'Edit Collection' : 'New Collection'}</h2>
          <button type="button" onClick={onClose} className="admin-modal-close" aria-label="Close">x</button>
        </div>
        <div className="admin-modal-body">
          <TabView className="page-tabview admin-modal-tabs">
            <TabPanel header="Collection">
              <div className="admin-modal-grid">
                <div className="admin-modal-field admin-modal-field-full">
                  <div className="admin-artists-page-name-field">
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, isVisible: !current.isVisible }))}
                      className={`admin-artists-page-visibility-toggle ${form.isVisible ? '' : 'admin-artists-page-visibility-toggle-hidden'}`.trim()}
                      aria-label={form.isVisible ? 'Collection is visible to the public. Click to hide.' : 'Collection is hidden from the public. Click to show.'}
                      title={form.isVisible ? 'Visible on public site' : 'Hidden from public site'}
                    >
                      {form.isVisible ? <FaEye aria-hidden="true" /> : <FaEyeSlash aria-hidden="true" />}
                    </button>
                    <div className="admin-artists-page-name-field-main">
                      <label htmlFor="admin-fashion-collection-title" className="admin-modal-label">Title</label>
                      <input
                        id="admin-fashion-collection-title"
                        type="text"
                        placeholder="Collection title"
                        value={form.title}
                        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value, slug: slugify(event.target.value) }))}
                        className="admin-artists-page-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="admin-modal-field">
                  <label htmlFor="admin-fashion-collection-season" className="admin-modal-label">Season</label>
                  <input id="admin-fashion-collection-season" type="text" placeholder="SS25" value={form.season} onChange={(event) => setForm((current) => ({ ...current, season: event.target.value }))} className="admin-artists-page-input" />
                </div>
                <div className="admin-modal-field">
                  <label htmlFor="admin-fashion-collection-location" className="admin-modal-label">Location</label>
                  <input id="admin-fashion-collection-location" type="text" placeholder="Paris Fashion Week" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} className="admin-artists-page-input" />
                </div>

                <div className="admin-modal-field admin-modal-field-full">
                  <div className="admin-modal-label">Cover Image</div>
                  <ImageCollectionField
                    value={form.coverImages}
                    onChange={(images) => setForm((current) => ({ ...current, coverImages: images.slice(0, 1) }))}
                    token={token}
                    folder="fashion-collections"
                    entityLabel={form.title || 'Collection cover'}
                  />
                </div>

                <div className="admin-modal-field admin-modal-field-full">
                  <label htmlFor="admin-fashion-collection-description" className="admin-modal-label">Description</label>
                  <textarea
                    id="admin-fashion-collection-description"
                    placeholder="Short subtitle for the catalogue..."
                    value={form.description}
                    onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                    className="admin-artists-page-input admin-modal-textarea"
                    rows={4}
                  />
                </div>

                <div className="admin-modal-field admin-modal-field-full">
                  <label htmlFor="admin-fashion-collection-about" className="admin-modal-label">About</label>
                  <textarea
                    id="admin-fashion-collection-about"
                    placeholder="Long-form collection notes..."
                    value={form.about}
                    onChange={(event) => setForm((current) => ({ ...current, about: event.target.value }))}
                    className="admin-artists-page-input admin-modal-textarea"
                    rows={7}
                  />
                </div>
              </div>
            </TabPanel>

            <TabPanel header="Credits">
              <div className="admin-modal-grid">
                <div className="admin-modal-field admin-modal-field-full">
                  <div className="admin-modal-label">Collection Credits</div>
                  <CreditsField
                    value={form.credits}
                    onChange={(credits) => setForm((current) => ({ ...current, credits }))}
                    talentOptions={talentOptions}
                    crewOptions={crewOptions}
                    placeholder="Add credit"
                  />
                </div>
              </div>
            </TabPanel>
          </TabView>
        </div>
        <div className="admin-modal-footer">
          <button type="button" onClick={onClose} className="admin-artists-page-ghost-btn">Cancel</button>
          <button type="button" onClick={onSave} className="admin-artists-page-primary-btn">Save</button>
        </div>
      </div>
    </div>
  )
}

export default function AdminFashionCollectionsPage() {
  const { token } = useAdminAuth()
  const auth = { Authorization: `Bearer ${token}` }
  const [collections, setCollections] = useState([])
  const [talentOptions, setTalentOptions] = useState([])
  const [crewOptions, setCrewOptions] = useState([])
  const [form, setForm] = useState(null)
  const draggedIdRef = useRef(null)
  const [dropTargetId, setDropTargetId] = useState(null)
  const [loadingEditId, setLoadingEditId] = useState(null)

  useEffect(() => {
    let ignore = false

    loadAdminResource({ cacheKey: 'fashion-collections-list', url: '/api/admin/fashion/collections', token })
      .then((list) => {
        if (!ignore) setCollections(list)
      })

    return () => {
      ignore = true
    }
  }, [token])

  useEffect(() => {
    let ignore = false

    Promise.all([
      loadAdminResource({ cacheKey: 'fashion-talent-list', url: '/api/admin/fashion?resource=talent', token }),
      loadAdminResource({ cacheKey: 'fashion-crew-list', url: '/api/admin/fashion?resource=crew', token }),
    ]).then(([talent, crew]) => {
      if (ignore) return
      setTalentOptions(talent.map(toTalentOption))
      setCrewOptions(crew.map(toCrewOption))
    })

    return () => {
      ignore = true
    }
  }, [token])

  const openCreate = () => setForm({ ...empty })
  const openEdit = async (collection) => {
    setLoadingEditId(collection.id)
    try {
      const detail = await fetch(`/api/admin/fashion/collections/${collection.id}`, { headers: auth }).then((response) => response.json())
      setForm({
        ...empty,
        ...detail,
        coverImages: detail.coverImage ? [detail.coverImage] : [],
        credits: toFormCredits(detail.credits),
      })
    } finally {
      setLoadingEditId(null)
    }
  }
  const closeForm = () => setForm(null)
  const nextOrder = collections.reduce((maxOrder, collection) => Math.max(maxOrder, collection.order ?? 0), -1) + 1

  const handleSave = async () => {
    const validationError = validateCollectionForm(form)
    if (validationError) {
      window.alert(validationError)
      return
    }

    const isEdit = Boolean(form.id)
    const url = isEdit ? `/api/admin/fashion/collections/${form.id}` : '/api/admin/fashion/collections'
    const payload = {
      title: form.title,
      slug: slugify(form.title),
      description: form.description,
      about: form.about,
      season: form.season,
      location: form.location,
      coverImage: form.coverImages?.[0] ?? null,
      isVisible: form.isVisible,
      order: isEdit ? form.order : nextOrder,
      credits: form.credits.filter(hasCreditValue),
    }
    const res = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Failed to save collection.' }))
      window.alert(error.error ?? 'Failed to save collection.')
      return
    }
    const saved = await res.json()
    const nextCollections = isEdit
      ? collections.map((collection) => (collection.id === saved.id ? saved : collection))
      : [...collections, saved]
    setCollections(nextCollections)
    primeAdminResource('fashion-collections-list', token, nextCollections)
    fetch('/api/admin/fashion?resource=crew', { headers: auth })
      .then((response) => (response.ok ? response.json() : null))
      .then((crew) => {
        if (!crew) return
        setCrewOptions(crew.map(toCrewOption))
        primeAdminResource('fashion-crew-list', token, crew)
      })
      .catch(() => {})
    closeForm()
  }

  const handleDelete = async (id) => {
    await fetch(`/api/admin/fashion/collections/${id}`, { method: 'DELETE', headers: auth })
    const nextCollections = collections.filter((collection) => collection.id !== id)
    setCollections(nextCollections)
    primeAdminResource('fashion-collections-list', token, nextCollections)
  }

  const persistCollectionOrder = async (nextCollections) => {
    const changed = nextCollections.filter((collection, index) => collection.order !== index)
    if (!changed.length) return nextCollections

    const saved = await Promise.all(
      changed.map((collection) => {
        const nextOrderValue = nextCollections.findIndex((candidate) => candidate.id === collection.id)
        return fetch(`/api/admin/fashion/collections/${collection.id}`, {
          method: 'PUT',
          headers: { ...auth, 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: nextOrderValue }),
        }).then((res) => res.json())
      })
    )

    const savedById = new Map(saved.map((collection) => [collection.id, collection]))
    return nextCollections.map((collection, index) => savedById.get(collection.id) ?? { ...collection, order: index })
  }

  const handleDragStart = (event, id) => {
    if (form) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
    draggedIdRef.current = id
  }

  const handleDragOver = (event, id) => {
    if (!draggedIdRef.current || draggedIdRef.current === id) return
    event.preventDefault()
    setDropTargetId(id)
  }

  const handleDrop = async (id) => {
    if (!draggedIdRef.current || draggedIdRef.current === id) {
      draggedIdRef.current = null
      setDropTargetId(null)
      return
    }

    const draggedIndex = collections.findIndex((collection) => collection.id === draggedIdRef.current)
    const targetIndex = collections.findIndex((collection) => collection.id === id)
    if (draggedIndex === -1 || targetIndex === -1) {
      draggedIdRef.current = null
      setDropTargetId(null)
      return
    }

    const reordered = [...collections]
    const [moved] = reordered.splice(draggedIndex, 1)
    reordered.splice(targetIndex, 0, moved)

    const normalized = reordered.map((collection, index) => ({ ...collection, order: index }))
    setCollections(normalized)
    primeAdminResource('fashion-collections-list', token, normalized)
    draggedIdRef.current = null
    setDropTargetId(null)

    const persisted = await persistCollectionOrder(reordered)
    setCollections(persisted)
    primeAdminResource('fashion-collections-list', token, persisted)
  }

  const handleDragEnd = () => {
    draggedIdRef.current = null
    setDropTargetId(null)
  }

  return (
    <div>
      <div className="admin-artists-page-sticky-top">
        <div className="admin-artists-page-header">
          <h1 className="admin-artists-page-title">Fashion - Collections</h1>
          <button type="button" onClick={openCreate} className="admin-artists-page-primary-btn">New Collection</button>
        </div>
      </div>

      <CollectionsTable
        collections={collections}
        isFormOpen={Boolean(form)}
        dropTargetId={dropTargetId}
        loadingEditId={loadingEditId}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      {form && (
        <CollectionFormModal
          form={form}
          setForm={setForm}
          token={token}
          talentOptions={talentOptions}
          crewOptions={crewOptions}
          onClose={closeForm}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
