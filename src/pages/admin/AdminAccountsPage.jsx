import { useEffect, useMemo, useState } from 'react'
import { FaPencilAlt, FaTrash } from 'react-icons/fa'
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import '../../styles/AdminArtistsPage.css'

const emptyForm = {
  id: '',
  artistId: '',
  password: '',
  active: true,
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

export default function AdminAccountsPage() {
  const { token } = useAdminAuth()
  const auth = { Authorization: `Bearer ${token}` }
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(null)

  useEffect(() => {
    fetch('/api/admin/accounts', { headers: auth })
      .then((response) => response.json())
      .then(setRows)
  }, [token])

  const availableArtists = useMemo(
    () => rows.filter((row) => !row.hasAccount || row.artist.id === form?.artistId).map((row) => row.artist),
    [rows, form]
  )

  const openCreate = () => setForm({ ...emptyForm })
  const openEdit = (row) => setForm({
    id: row.account?.id ?? '',
    artistId: row.artist.id,
    password: '',
    active: row.account?.active ?? true,
  })
  const closeForm = () => setForm(null)

  const handleSave = async () => {
    if (!form.artistId) {
      window.alert('Artist is required.')
      return
    }

    const isEdit = Boolean(form.id)
    if (!isEdit && !form.password) {
      window.alert('Password is required.')
      return
    }

    const response = await fetch(isEdit ? `/api/admin/accounts?id=${form.id}` : '/api/admin/accounts', {
      method: isEdit ? 'PUT' : 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        artistId: form.artistId,
        active: form.active,
        ...(form.password ? { password: form.password } : {}),
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to save account.' }))
      window.alert(error.error ?? 'Failed to save account.')
      return
    }

    const saved = await response.json()
    setRows((current) => current.map((row) => (
      row.artist.id !== saved.artistId
        ? row
        : {
            ...row,
            hasAccount: true,
            account: saved,
          }
    )))
    closeForm()
  }

  const handleDelete = async (row) => {
    if (!row.account?.id) return

    await fetch(`/api/admin/accounts?id=${row.account.id}`, {
      method: 'DELETE',
      headers: auth,
    })

    setRows((current) => current.map((candidate) => (
      candidate.artist.id !== row.artist.id
        ? candidate
        : { ...candidate, hasAccount: false, account: null }
    )))
  }

  return (
    <div>
      <div className="admin-artists-page-sticky-top">
        <div className="admin-artists-page-header">
          <h1 className="admin-artists-page-title">Accounts</h1>
          <button type="button" onClick={openCreate} className="admin-artists-page-primary-btn">New Account</button>
        </div>
      </div>

      <div className="admin-artists-page-table-wrap">
        <table className="admin-artists-page-table">
          <thead>
            <tr>
              <th className="admin-artists-page-col-lg">Artist</th>
              <th className="admin-artists-page-col-sm">Has Account</th>
              <th className="admin-artists-page-col-sm">Active</th>
              <th className="admin-artists-page-col-lg">Updated</th>
              <th className="admin-artists-page-actions-col admin-artists-page-sticky-right-0"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.artist.id}>
                <td className="admin-artists-page-col-lg">
                  <span className="admin-artists-page-cell-value">{row.artist.name}</span>
                </td>
                <td className="admin-artists-page-col-sm">
                  <span className="admin-artists-page-cell-value">{row.hasAccount ? 'Yes' : 'No'}</span>
                </td>
                <td className="admin-artists-page-col-sm">
                  <span className="admin-artists-page-cell-value">{row.account ? (row.account.active ? 'Yes' : 'No') : '-'}</span>
                </td>
                <td className="admin-artists-page-col-lg">
                  <span className="admin-artists-page-cell-value">{row.account ? formatDate(row.account.updatedAt) : '-'}</span>
                </td>
                <td className="admin-artists-page-action-cell admin-artists-page-actions-col admin-artists-page-sticky-right-0">
                  <div className="admin-artists-page-actions">
                    <button
                      type="button"
                      onClick={() => openEdit(row)}
                      className="admin-artists-page-ghost-btn admin-artists-page-icon-btn"
                      aria-label={row.hasAccount ? 'Edit account' : 'Create account'}
                      title={row.hasAccount ? 'Edit account' : 'Create account'}
                    >
                      <FaPencilAlt aria-hidden="true" />
                    </button>
                    {row.hasAccount ? (
                      <ConfirmActionButton
                        message={`Remove login access for ${row.artist.name}?`}
                        confirmLabel="Remove"
                        onConfirm={() => handleDelete(row)}
                        buttonClassName="admin-artists-page-danger-btn admin-artists-page-icon-btn"
                        buttonAriaLabel="Delete account"
                        buttonTitle="Delete account"
                      >
                        <FaTrash aria-hidden="true" />
                      </ConfirmActionButton>
                    ) : null}
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
              <h2 className="admin-modal-title">{form.id ? 'Edit Account' : 'New Account'}</h2>
              <button type="button" onClick={closeForm} className="admin-modal-close" aria-label="Close">×</button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-modal-grid">
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Artist</label>
                  {form.id ? (
                    <input
                      type="text"
                      readOnly
                      value={rows.find((row) => row.artist.id === form.artistId)?.artist.name ?? ''}
                      className="admin-artists-page-input"
                    />
                  ) : (
                    <select
                      value={form.artistId}
                      onChange={(event) => setForm((current) => ({ ...current, artistId: event.target.value }))}
                      className="admin-artists-page-input"
                    >
                      <option value="">- Artist -</option>
                      {availableArtists.map((artist) => (
                        <option key={artist.id} value={artist.id}>{artist.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Password</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder={form.id ? 'Leave blank to keep current password' : 'Set password'}
                    className="admin-artists-page-input"
                  />
                </div>
                <div className="admin-modal-field admin-modal-field-full">
                  <label className="admin-modal-label">Status</label>
                  <label className="admin-admin-account-toggle">
                    <input
                      type="checkbox"
                      checked={form.active}
                      onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
                    />
                    <span>{form.active ? 'Active' : 'Inactive'}</span>
                  </label>
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
