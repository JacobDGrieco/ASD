/**
 * Fashion admin outside-talent route.
 *
 * Manages reusable outside/crew credit people created directly or through
 * free-text fashion credits.
 */
import { useEffect, useState } from 'react';
import { FaExternalLinkAlt } from 'react-icons/fa';
import AdminEntityCard from '../../components/admin/AdminEntityCard.jsx';
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
			const detail = await fetch(`/api/admin/fashion?resource=crew&id=${person.id}`).then((response) => response.json());
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
			headers: { 'Content-Type': 'application/json' },
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
		await fetch(`/api/admin/fashion?resource=crew&id=${id}`, { method: 'DELETE' });
		const nextCrew = crew.filter((person) => person.id !== id);
		setCrew(nextCrew);
		primeAdminResource('fashion-crew-list', token, nextCrew);
		closeForm();
	};

	return (
		<div>
			<div className="admin-sticky-top">
				<div className="admin-page-header">
					<h1 className="admin-page-title">Fashion - Outside Talent</h1>
					<button type="button" onClick={openCreate} className="admin-button-primary">New Outside Talent</button>
				</div>
			</div>

			<div className="admin-entity-card-grid">
				{crew.map((person) => (
					<AdminEntityCard
						key={person.id}
						image={person.image?.previewUrl || person.image?.url}
						title={person.name}
						subtitle={person.role}
						showLinksSummary={false}
						onEdit={() => void openEdit(person)}
						editDisabled={loadingEditId === person.id}
						editAriaLabel={`Edit ${person.name}`}
						footer={person.externalUrl ? (
							<a
								href={person.externalUrl}
								target="_blank"
								rel="noreferrer"
								className="admin-entity-card-link-btn"
								aria-label={`Open promo link for ${person.name}`}
							>
								<FaExternalLinkAlt aria-hidden="true" />
								<span>Open link</span>
							</a>
						) : null}
					/>
				))}
			</div>

			{form && (
				<div className="admin-modal-overlay" role="presentation">
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
										className="admin-field-input"
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
								<div className="admin-modal-field admin-modal-field-full">
									<label htmlFor="admin-fashion-outside-talent-role" className="admin-modal-label">Default Role</label>
									<select
										id="admin-fashion-outside-talent-role"
										value={form.role}
										onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
										className="admin-field-input"
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
										className="admin-field-input"
									/>
								</div>
							</div>
						</div>
						<div className="admin-modal-footer">
							<div className="admin-modal-footer-start">
								{form.id && (
									<ConfirmActionButton
										message="Delete this outside talent? They will be removed from any Look credits."
										onConfirm={async () => {
											await handleDelete(form.id);
											closeForm();
										}}
										buttonClassName="admin-button-danger"
										buttonAriaLabel="Delete outside talent"
										buttonTitle="Delete"
									>
										Delete
									</ConfirmActionButton>
								)}
							</div>
							<button type="button" onClick={closeForm} className="admin-button-secondary">Cancel</button>
							<button type="button" onClick={handleSave} className="admin-button-primary">Save</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
