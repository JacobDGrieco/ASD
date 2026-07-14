import { useEffect, useState } from 'react';
import { FaExternalLinkAlt, FaPencilAlt, FaTrash } from 'react-icons/fa';
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx';
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx';
import { SONG_ROLES } from '../../lib/songRoles.js';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js';
import '../../styles/AdminArtistsPage.css';

const columns = [
	{ key: 'image', label: 'Photo', kind: 'image', className: 'admin-artists-page-col-image' },
	{ key: 'name', label: 'Name', className: 'admin-artists-page-col-lg' },
	{ key: 'role', label: 'Default Role', className: 'admin-artists-page-col-md' },
	{ key: 'externalUrl', label: 'External Link', kind: 'link', className: 'admin-artists-page-col-action admin-artists-page-center-cell' },
];

const empty = {
	name: '',
	role: '',
	externalUrl: '',
	image: null,
};

function validateForm(form) {
	if (!form.name?.trim()) return 'Name is required.';
	return null;
}

function renderDisplayValue(person, column) {
	if (column.kind === 'image') {
		if (!person.image) return <span className="admin-artists-page-empty-value">-</span>;
		return (
			<div className="admin-artists-page-image-summary">
				<div className="admin-artists-page-thumb-frame">
					<img src={person.image.previewUrl || person.image.url} alt={person.name} className="admin-artists-page-thumb" />
				</div>
			</div>
		);
	}

	if (column.kind === 'link') {
		if (!person.externalUrl) return <span className="admin-artists-page-empty-value">-</span>;
		return (
			<a href={person.externalUrl} target="_blank" rel="noreferrer" className="admin-artists-page-link-btn" aria-label={`Open external link for ${person.name}`} title="Open in new tab">
				<FaExternalLinkAlt aria-hidden="true" />
			</a>
		);
	}

	const value = person[column.key];
	if (value === null || value === undefined || value === '') return <span className="admin-artists-page-empty-value">-</span>;
	return <span className="admin-artists-page-cell-value" title={String(value)}>{String(value)}</span>;
}

export default function AdminMusicOutsideArtistsPage() {
	const { token } = useAdminAuth();
	const auth = { Authorization: `Bearer ${token}` };
	const [outsideArtists, setOutsideArtists] = useState([]);
	const [form, setForm] = useState(null);
	const [loadingEditId, setLoadingEditId] = useState(null);

	useEffect(() => {
		let ignore = false;

		loadAdminResource({ cacheKey: 'music-outside-artists-list', url: '/api/admin/outside-artists', token })
			.then((list) => {
				if (!ignore) setOutsideArtists(list);
			});

		return () => {
			ignore = true;
		};
	}, [token]);

	const openCreate = () => setForm({ ...empty });

	const openEdit = async (person) => {
		setLoadingEditId(person.id);
		try {
			const detail = await fetch(`/api/admin/outside-artists?id=${person.id}`, { headers: auth }).then((response) => response.json());
			setForm({ ...empty, ...detail });
		} finally {
			setLoadingEditId(null);
		}
	};

	const closeForm = () => setForm(null);

	const handleSave = async () => {
		const validationError = validateForm(form);
		if (validationError) {
			window.alert(validationError);
			return;
		}

		const isEdit = Boolean(form.id);
		const url = isEdit ? `/api/admin/outside-artists?id=${form.id}` : '/api/admin/outside-artists';
		const res = await fetch(url, {
			method: isEdit ? 'PUT' : 'POST',
			headers: { ...auth, 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: form.name, role: form.role, externalUrl: form.externalUrl, image: form.image }),
		});
		if (!res.ok) {
			const error = await res.json().catch(() => ({ error: 'Failed to save outside artist.' }));
			window.alert(error.error ?? 'Failed to save outside artist.');
			return;
		}

		const saved = await res.json();
		const nextOutsideArtists = isEdit
			? outsideArtists.map((person) => (person.id === saved.id ? saved : person))
			: [...outsideArtists, saved].toSorted((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
		setOutsideArtists(nextOutsideArtists);
		primeAdminResource('music-outside-artists-list', token, nextOutsideArtists);
		closeForm();
	};

	const handleDelete = async (id) => {
		await fetch(`/api/admin/outside-artists?id=${id}`, { method: 'DELETE', headers: auth });
		const nextOutsideArtists = outsideArtists.filter((person) => person.id !== id);
		setOutsideArtists(nextOutsideArtists);
		primeAdminResource('music-outside-artists-list', token, nextOutsideArtists);
	};

	return (
		<div>
			<div className="admin-artists-page-sticky-top">
				<div className="admin-artists-page-header">
					<h1 className="admin-artists-page-title">Music - Outside Artists</h1>
					<button type="button" onClick={openCreate} className="admin-artists-page-primary-btn">New Outside Artist</button>
				</div>
			</div>

			<div className="admin-artists-page-table-wrap">
				<table className="admin-artists-page-table">
					<thead>
						<tr>
							{columns.map((column) => <th key={column.key} className={column.className}>{column.label}</th>)}
							<th className="admin-artists-page-actions-col admin-artists-page-sticky-right-0"></th>
						</tr>
					</thead>
					<tbody>
						{outsideArtists.map((person) => (
							<tr key={person.id}>
								{columns.map((column) => (
									<td key={column.key} className={column.className ?? ''}>
										{renderDisplayValue(person, column)}
									</td>
								))}
								<td className="admin-artists-page-action-cell admin-artists-page-actions-col admin-artists-page-sticky-right-0">
									<div className="admin-artists-page-actions">
										<button
											type="button"
											onClick={() => void openEdit(person)}
											disabled={loadingEditId === person.id}
											className="admin-artists-page-ghost-btn admin-artists-page-icon-btn"
											aria-label="Edit outside artist"
											title="Edit"
										>
											<FaPencilAlt aria-hidden="true" />
										</button>
										<ConfirmActionButton
											message="Delete this outside artist? Existing song role credits will keep their typed name, but the saved external link will no longer resolve."
											onConfirm={() => handleDelete(person.id)}
											buttonClassName="admin-artists-page-danger-btn admin-artists-page-icon-btn"
											buttonAriaLabel="Delete outside artist"
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
				<div className="admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
					<div className="admin-modal">
						<div className="admin-modal-header">
							<h2 className="admin-modal-title">{form.id ? 'Edit Outside Artist' : 'New Outside Artist'}</h2>
							<button type="button" onClick={closeForm} className="admin-modal-close" aria-label="Close">&times;</button>
						</div>
						<div className="admin-modal-body">
							<div className="admin-modal-grid">
								<div className="admin-modal-field admin-modal-field-full">
									<label htmlFor="admin-music-outside-artist-name" className="admin-modal-label">Name <span className="admin-modal-label-required">*</span></label>
									<input
										id="admin-music-outside-artist-name"
										type="text"
										placeholder="Full name"
										value={form.name}
										onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
										className="admin-artists-page-input"
									/>
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label htmlFor="admin-music-outside-artist-role" className="admin-modal-label">Default Role</label>
									<select
										id="admin-music-outside-artist-role"
										value={form.role}
										onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
										className="admin-artists-page-input"
									>
										<option value="">- Select role -</option>
										{SONG_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
									</select>
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<div className="admin-modal-label">Photo</div>
									<ImageCollectionField
										value={form.image ? [form.image] : []}
										onChange={(images) => setForm((current) => ({ ...current, image: images[0] ?? null }))}
										token={token}
										folder="music-outside-artists"
										entityLabel={form.name || 'Outside artist photo'}
									/>
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label htmlFor="admin-music-outside-artist-external-url" className="admin-modal-label">External Link</label>
									<input
										id="admin-music-outside-artist-external-url"
										type="url"
										placeholder="https://instagram.com/name"
										value={form.externalUrl}
										onChange={(event) => setForm((current) => ({ ...current, externalUrl: event.target.value }))}
										className="admin-artists-page-input"
									/>
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
	);
}
