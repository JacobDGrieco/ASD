import { useEffect, useState } from 'react';
import { FaExternalLinkAlt, FaPencilAlt, FaTrash } from 'react-icons/fa';
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx';
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js';
import '../../styles/AdminArtistsPage.css';

const fashionCreditRoles = [
	'Model',
	'Photographer',
	'Agency',
	'Brand',
	'Stylist',
	'Wardrobe Stylist',
	'Designer',
	'Creative Director',
	'Art Director',
	'Makeup Artist',
	'Hair Stylist',
	'Nail Artist',
	'Casting Director',
	'Producer',
	'Set Designer',
	'Photo Assistant',
	'Digital Tech',
	'Retoucher',
	'Tailor',
	'Seamstress',
	'Location Scout',
	'Editor',
	'Other',
];

const columns = [
	{ key: 'image', label: 'Photo', kind: 'image', className: 'admin-artists-page-col-image' },
	{ key: 'name', label: 'Name', className: 'admin-artists-page-col-lg' },
	{ key: 'role', label: 'Default Role', className: 'admin-artists-page-col-md' },
	{ key: 'externalUrl', label: 'Promo Link', kind: 'link', className: 'admin-artists-page-col-action admin-artists-page-center-cell' },
];

const empty = {
	name: '',
	role: '',
	externalUrl: '',
	image: null,
};

function validateCrewForm(form) {
	if (!form.name?.trim()) return 'Name is required.';
	return null;
}

export default function AdminFashionOutsideTalentPage() {
	const { token } = useAdminAuth();
	const auth = { Authorization: `Bearer ${token}` };
	const [crew, setCrew] = useState([]);
	const [form, setForm] = useState(null);
	const [loadingEditId, setLoadingEditId] = useState(null);

	useEffect(() => {
		let ignore = false;

		loadAdminResource({ cacheKey: 'fashion-crew-list', url: '/api/admin/fashion?resource=crew', token })
			.then((list) => {
				if (!ignore) setCrew(list);
			});

		return () => {
			ignore = true;
		};
	}, [token]);

	const openCreate = () => setForm({ ...empty });

	const openEdit = async (person) => {
		setLoadingEditId(person.id);
		try {
			const detail = await fetch(`/api/admin/fashion?resource=crew&id=${person.id}`, { headers: auth }).then((response) => response.json());
			setForm({ ...empty, ...detail });
		} finally {
			setLoadingEditId(null);
		}
	};

	const closeForm = () => setForm(null);

	const handleSave = async () => {
		const validationError = validateCrewForm(form);
		if (validationError) {
			window.alert(validationError);
			return;
		}

		const isEdit = Boolean(form.id);
		const url = isEdit ? `/api/admin/fashion?resource=crew&id=${form.id}` : '/api/admin/fashion?resource=crew';
		const res = await fetch(url, {
			method: isEdit ? 'PUT' : 'POST',
			headers: { ...auth, 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: form.name, role: form.role, externalUrl: form.externalUrl, image: form.image }),
		});
		if (!res.ok) {
			const error = await res.json().catch(() => ({ error: 'Failed to save outside talent.' }));
			window.alert(error.error ?? 'Failed to save outside talent.');
			return;
		}

		const saved = await res.json();
		const nextCrew = isEdit ? crew.map((person) => (person.id === saved.id ? saved : person)) : [...crew, saved];
		setCrew(nextCrew);
		primeAdminResource('fashion-crew-list', token, nextCrew);
		closeForm();
	};

	const handleDelete = async (id) => {
		await fetch(`/api/admin/fashion?resource=crew&id=${id}`, { method: 'DELETE', headers: auth });
		const nextCrew = crew.filter((person) => person.id !== id);
		setCrew(nextCrew);
		primeAdminResource('fashion-crew-list', token, nextCrew);
	};

	const renderDisplayValue = (person, column) => {
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
				<a href={person.externalUrl} target="_blank" rel="noreferrer" className="admin-artists-page-link-btn" aria-label={`Open promo link for ${person.name}`} title="Open in new tab">
					<FaExternalLinkAlt aria-hidden="true" />
				</a>
			);
		}

		const value = person[column.key];
		if (value === null || value === undefined || value === '') return <span className="admin-artists-page-empty-value">-</span>;
		return <span className="admin-artists-page-cell-value" title={String(value)}>{String(value)}</span>;
	};

	return (
		<div>
			<div className="admin-artists-page-sticky-top">
				<div className="admin-artists-page-header">
					<h1 className="admin-artists-page-title">Fashion - Outside Talent</h1>
					<button type="button" onClick={openCreate} className="admin-artists-page-primary-btn">New Outside Talent</button>
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
						{crew.map((person) => (
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
											aria-label="Edit outside talent"
											title="Edit"
										>
											<FaPencilAlt aria-hidden="true" />
										</button>
										<ConfirmActionButton
											message="Delete this outside talent? They will be removed from any Look credits."
											onConfirm={() => handleDelete(person.id)}
											buttonClassName="admin-artists-page-danger-btn admin-artists-page-icon-btn"
											buttonAriaLabel="Delete outside talent"
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
				<div className="admin-modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
					<div className="admin-modal">
						<div className="admin-modal-header">
							<h2 className="admin-modal-title">{form.id ? 'Edit Outside Talent' : 'New Outside Talent'}</h2>
							<button type="button" onClick={closeForm} className="admin-modal-close" aria-label="Close">&times;</button>
						</div>
						<div className="admin-modal-body">
							<div className="admin-modal-grid">
								<div className="admin-modal-field admin-modal-field-full">
									<label htmlFor="admin-fashion-outside-talent-name" className="admin-modal-label">Name</label>
									<input
										id="admin-fashion-outside-talent-name"
										type="text"
										placeholder="Full name"
										value={form.name}
										onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
										className="admin-artists-page-input"
									/>
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label htmlFor="admin-fashion-outside-talent-role" className="admin-modal-label">Default Role</label>
									<select
										id="admin-fashion-outside-talent-role"
										value={form.role}
										onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
										className="admin-artists-page-input"
									>
										<option value="">- Select role -</option>
										{fashionCreditRoles.map((role) => <option key={role} value={role}>{role}</option>)}
									</select>
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label htmlFor="admin-fashion-outside-talent-external-url" className="admin-modal-label">External Link</label>
									<input
										id="admin-fashion-outside-talent-external-url"
										type="url"
										placeholder="https://instagram.com/name"
										value={form.externalUrl}
										onChange={(event) => setForm((current) => ({ ...current, externalUrl: event.target.value }))}
										className="admin-artists-page-input"
									/>
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<div className="admin-modal-label">Photo</div>
									<ImageCollectionField
										value={form.image ? [form.image] : []}
										onChange={(images) => setForm((current) => ({ ...current, image: images[0] ?? null }))}
										token={token}
										folder="fashion-crew"
										entityLabel={form.name || 'Outside talent photo'}
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
