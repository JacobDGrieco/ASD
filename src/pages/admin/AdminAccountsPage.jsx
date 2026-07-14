import { Navigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { TabPanel, TabView } from 'primereact/tabview'
import { FaPencilAlt, FaTrash } from 'react-icons/fa'
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx'
import { useAdminAuth } from '../../lib/adminAuth.jsx'
import { loadAdminResource } from '../../lib/adminResourceCache.js'
import {
  ADMIN_ACCOUNT_TYPES,
  getAllowedPageGroupsForAccountType,
  getDefaultAdminPageAccess,
  normalizeAdminPageAccess,
} from '../../lib/adminPageAccess.js'
import '../../styles/AdminArtistsPage.css'

const accountTypeLabels = {
  [ADMIN_ACCOUNT_TYPES.MUSIC_ARTIST]: 'Music Artist',
  [ADMIN_ACCOUNT_TYPES.FASHION_TALENT]: 'Fashion Talent',
}

const emptyForm = {
  id: '',
  accountType: ADMIN_ACCOUNT_TYPES.MUSIC_ARTIST,
  subjectId: '',
  name: '',
  password: '',
  active: true,
  pageAccess: getDefaultAdminPageAccess(ADMIN_ACCOUNT_TYPES.MUSIC_ARTIST),
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function accountTypeLabel(row) {
  if (row.isSuperAdminAccount || row.account?.isSuperAdminAccount) return 'Admin'
  return accountTypeLabels[row.accountType]
}

function formatAccess(row) {
  if (!row.account) return '-'
  if (row.isSuperAdminAccount || row.account?.isSuperAdminAccount) return 'All pages'
  const access = normalizeAdminPageAccess(row.account?.pageAccess)
  if (access.length === 0) return 'Default'
  return `${access.length} page${access.length === 1 ? '' : 's'}`
}

export default function AdminAccountsPage() {
  const { token, session } = useAdminAuth()
  const auth = { Authorization: `Bearer ${token}` }
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(null)
  const [activeTabIndex, setActiveTabIndex] = useState(0)

  useEffect(() => {
    if (session?.role !== 'SUPER_ADMIN' || !token) return

    let ignore = false
    loadAdminResource({ cacheKey: 'admin-accounts-list', url: '/api/admin/accounts', token })
      .then((accountRows) => {
        if (!ignore) setRows(accountRows)
      })

    return () => {
      ignore = true
    }
  }, [session?.role, token])

  const availableSubjects = useMemo(
    () => rows.reduce((subjects, row) => {
      if (row.accountType !== form?.accountType) return subjects
      if (!row.hasAccount || row.subject.id === form?.subjectId) subjects.push(row.subject)
      return subjects
    }, []),
    [rows, form?.accountType, form?.subjectId],
  )

  const accessGroups = useMemo(
    () => getAllowedPageGroupsForAccountType(form?.accountType ?? ADMIN_ACCOUNT_TYPES.MUSIC_ARTIST),
    [form?.accountType],
  )

  if (session?.role !== 'SUPER_ADMIN') {
    return <Navigate to="/admin" replace />
  }

  const openCreate = () => {
    setActiveTabIndex(0)
    setForm({ ...emptyForm })
  }

  const openEdit = (row) => {
    setActiveTabIndex(0)
    setForm({
      id: row.account?.id ?? '',
      accountType: row.accountType,
      subjectId: row.subject.id,
      name: row.account?.name ?? row.subject.name ?? '',
      password: '',
      active: row.account?.active ?? true,
      isSuperAdminAccount: row.isSuperAdminAccount || row.account?.isSuperAdminAccount || false,
      pageAccess: normalizeAdminPageAccess(row.account?.pageAccess).length > 0
        ? normalizeAdminPageAccess(row.account?.pageAccess)
        : getDefaultAdminPageAccess(row.accountType),
    })
  }

  const closeForm = () => setForm(null)

  const updateForm = (updates) => {
    setForm((current) => ({ ...current, ...updates }))
  }

  const handleAccountTypeChange = (accountType) => {
    updateForm({
      accountType,
      subjectId: '',
      pageAccess: getDefaultAdminPageAccess(accountType),
    })
  }

  const togglePageAccess = (pageKey) => {
    setForm((current) => {
      const currentAccess = normalizeAdminPageAccess(current.pageAccess)
      const pageAccess = currentAccess.includes(pageKey)
        ? currentAccess.filter((key) => key !== pageKey)
        : [...currentAccess, pageKey]

      return {
        ...current,
        pageAccess,
      }
    })
  }

  const handleSave = async () => {
    if (!form.subjectId) {
      window.alert('Person is required.')
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
        accountType: form.accountType,
        subjectId: form.subjectId,
        name: form.name,
        active: form.active,
        pageAccess: form.isSuperAdminAccount ? [] : normalizeAdminPageAccess(form.pageAccess),
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
      row.accountType !== saved.accountType || row.subject.id !== saved.subjectId
        ? row
        : {
            ...row,
            hasAccount: true,
            isSuperAdminAccount: saved.isSuperAdminAccount || row.isSuperAdminAccount,
            account: saved,
          }
    )))
    closeForm()
  }

  const handleDelete = async (row) => {
    if (!row.account?.id) return

    const response = await fetch(`/api/admin/accounts?id=${row.account.id}`, {
      method: 'DELETE',
      headers: auth,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to delete account.' }))
      window.alert(error.error ?? 'Failed to delete account.')
      return
    }

    setRows((current) => current.map((candidate) => (
      candidate.accountType !== row.accountType || candidate.subject.id !== row.subject.id
        ? candidate
        : { ...candidate, hasAccount: false, account: null }
    )))
  }

  return (
    <div>
      <div className="admin-artists-page-sticky-top">
        <div className="admin-artists-page-header">
          <h1 className="admin-artists-page-title">Admin - Accounts</h1>
          <button type="button" onClick={openCreate} className="admin-artists-page-primary-btn">New Account</button>
        </div>
      </div>

      <div className="admin-artists-page-table-wrap">
        <table className="admin-artists-page-table">
          <thead>
            <tr>
              <th className="admin-artists-page-col-lg">Name</th>
              <th className="admin-artists-page-col-md">Type</th>
              <th className="admin-artists-page-col-sm">Has Account</th>
              <th className="admin-artists-page-col-sm">Active</th>
              <th className="admin-artists-page-col-md">Access</th>
              <th className="admin-artists-page-col-lg">Updated</th>
              <th className="admin-artists-page-actions-col admin-artists-page-sticky-right-0"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rowId}>
                <td className="admin-artists-page-col-lg">
                  <span className="admin-artists-page-cell-value">{row.subject.name}</span>
                </td>
                <td className="admin-artists-page-col-md">
                  <span className="admin-artists-page-cell-value">{accountTypeLabel(row)}</span>
                </td>
                <td className="admin-artists-page-col-sm">
                  <span className="admin-artists-page-cell-value">{row.hasAccount ? 'Yes' : 'No'}</span>
                </td>
                <td className="admin-artists-page-col-sm">
                  <span className="admin-artists-page-cell-value">{row.account ? (row.account.active ? 'Yes' : 'No') : '-'}</span>
                </td>
                <td className="admin-artists-page-col-md">
                  <span className="admin-artists-page-cell-value">{formatAccess(row)}</span>
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
                        message={`Remove login access for ${row.subject.name}?`}
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
        <div className="admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}>
          <div className="admin-modal">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">{form.id ? 'Edit Account' : 'New Account'}</h2>
              <button type="button" onClick={closeForm} className="admin-modal-close" aria-label="Close">x</button>
            </div>
            <div className="admin-modal-body">
              <TabView
                activeIndex={activeTabIndex}
                onTabChange={(event) => setActiveTabIndex(event.index)}
                className="page-tabview admin-modal-tabs"
              >
                <TabPanel header="Account">
                  <div className="admin-modal-grid">
                    <div className="admin-modal-field">
                      <label htmlFor="admin-account-type" className="admin-modal-label">Type</label>
                      {form.isSuperAdminAccount ? (
                        <input
                          id="admin-account-type"
                          type="text"
                          readOnly
                          value="Admin"
                          className="admin-artists-page-input"
                        />
                      ) : (
                        <select
                          id="admin-account-type"
                          value={form.accountType}
                          onChange={(event) => handleAccountTypeChange(event.target.value)}
                          disabled={Boolean(form.id)}
                          className="admin-artists-page-input"
                        >
                          <option value={ADMIN_ACCOUNT_TYPES.MUSIC_ARTIST}>Music Artist</option>
                          <option value={ADMIN_ACCOUNT_TYPES.FASHION_TALENT}>Fashion Talent</option>
                        </select>
                      )}
                    </div>
                    <div className="admin-modal-field">
                      <label htmlFor="admin-account-subject" className="admin-modal-label">
                        {form.accountType === ADMIN_ACCOUNT_TYPES.FASHION_TALENT ? 'Fashion Talent' : 'Music Artist'}
                      </label>
                      {form.id ? (
                        <input
                          id="admin-account-subject"
                          type="text"
                          readOnly
                          value={rows.find((row) => row.accountType === form.accountType && row.subject.id === form.subjectId)?.subject.name ?? ''}
                          className="admin-artists-page-input"
                        />
                      ) : (
                        <select
                          id="admin-account-subject"
                          value={form.subjectId}
                          onChange={(event) => updateForm({ subjectId: event.target.value })}
                          className="admin-artists-page-input"
                        >
                          <option value="">- Person -</option>
                          {availableSubjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>{subject.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div className="admin-modal-field admin-modal-field-full">
                      <label htmlFor="admin-account-name" className="admin-modal-label">Name</label>
                      <input
                        id="admin-account-name"
                        type="text"
                        value={form.name}
                        onChange={(event) => updateForm({ name: event.target.value })}
                        className="admin-artists-page-input"
                      />
                    </div>
                    <div className="admin-modal-field admin-modal-field-full">
                      <label htmlFor="admin-account-password" className="admin-modal-label">Password</label>
                      <input
                        id="admin-account-password"
                        type="password"
                        value={form.password}
                        onChange={(event) => updateForm({ password: event.target.value })}
                        placeholder={form.id ? 'Leave blank to keep current password' : 'Set password'}
                        className="admin-artists-page-input"
                      />
                    </div>
                    <div className="admin-modal-field admin-modal-field-full">
                      <div className="admin-modal-label">Status</div>
                      <label className="admin-admin-account-toggle">
                        <input
                          type="checkbox"
                          checked={form.active}
                          onChange={(event) => updateForm({ active: event.target.checked })}
                        />
                        <span>{form.active ? 'Active' : 'Inactive'}</span>
                      </label>
                    </div>
                  </div>
                </TabPanel>
                <TabPanel header="Access">
                  <div className="admin-account-access-grid">
                    {form.isSuperAdminAccount ? (
                      <section className="admin-account-access-group">
                        <h3 className="admin-account-access-heading">Admin</h3>
                        <p className="admin-account-access-note">Super admin accounts can use every admin page.</p>
                      </section>
                    ) : accessGroups.map((group) => (
                      <section key={group.key} className="admin-account-access-group">
                        <h3 className="admin-account-access-heading">{group.label}</h3>
                        <div className="admin-account-access-options">
                          {group.pages.map((page) => (
                            <label key={page.key} className="admin-account-access-option">
                              <input
                                type="checkbox"
                                checked={normalizeAdminPageAccess(form.pageAccess).includes(page.key)}
                                onChange={() => togglePageAccess(page.key)}
                              />
                              <span>{page.label}</span>
                            </label>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </TabPanel>
              </TabView>
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
