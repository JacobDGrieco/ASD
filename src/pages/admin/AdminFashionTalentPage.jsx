import { useEffect, useRef, useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { TabPanel, TabView } from 'primereact/tabview';
import AdminEntityCard from '../../components/admin/AdminEntityCard.jsx';
import AdminProfileLinksField from '../../components/admin/AdminProfileLinksField.jsx';
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx';
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js';
import { FASHION_TALENT_LEGACY_LINK_FIELDS, normalizeProfileLinks, profileLinksForSource } from '../../lib/profileLinks.js';
import { slugify } from '../../lib/slugify.js';
import '../../styles/AdminArtistsPage.css';

const ROLE_OPTIONS = [
	{ value: 'MODEL', label: 'Model' },
	{ value: 'DESIGNER', label: 'Designer' },
	{ value: 'PHOTOGRAPHER', label: 'Photographer' },
	{ value: 'EDITOR', label: 'Photo Editor' },
	{ value: 'STYLIST', label: 'Stylist' },
	{ value: 'OTHER', label: 'Other' },
];

const ROLE_LABEL_BY_VALUE = Object.fromEntries(ROLE_OPTIONS.map((option) => [option.value, option.label]));

const empty = {
	name: '',
	slug: '',
	role: 'MODEL',
	isVisible: true,
	bio: '',
	images: [],
	links: [],
	order: 0,
	email: '',
	website: '',
	agencyName: '',
	agencyContact: '',
};

function primaryImage(images) {
	if (!Array.isArray(images) || images.length === 0) return null;
	return images.find((image) => image.isPrimary) ?? images[0];
}

function validateTalentForm(form) {
	if (!form.name?.trim()) return 'Name is required.';
	if (!form.role) return 'Role is required.';
	return null;
}

function isTalentHidden(talent) {
	return talent?.isVisible === false;
}

function TalentFormModal({ form, setForm, token, onClose, onSave, onDelete, canDelete }) {
	return (
		<div className="admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<div className="admin-modal">
				<div className="admin-modal-header">
					<h2 className="admin-modal-title">{form.id ? 'Edit Talent' : 'New Talent'}</h2>
					<button type="button" onClick={onClose} className="admin-modal-close" aria-label="Close">x</button>
				</div>
				<div className="admin-modal-body">
					<TabView className="page-tabview admin-modal-tabs">
						<TabPanel header="Talent">
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
											<label htmlFor="admin-fashion-talent-name" className="admin-modal-label">Name</label>
											<input
												id="admin-fashion-talent-name"
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
									<div className="admin-modal-label">Images</div>
									<ImageCollectionField
										value={form.images}
										onChange={(images) => setForm((current) => ({ ...current, images }))}
										token={token}
										folder="fashion-talent"
										entityLabel={form.name || 'Talent image'}
									/>
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label htmlFor="admin-fashion-talent-bio" className="admin-modal-label">Bio</label>
									<textarea
										id="admin-fashion-talent-bio"
										placeholder="Bio"
										value={form.bio}
										onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
										className="admin-artists-page-input admin-modal-textarea"
										rows={5}
									/>
								</div>
								<div className="admin-modal-field admin-modal-field-full admin-fashion-talent-meta-row">
									<div className="admin-modal-field">
										<label htmlFor="admin-fashion-talent-role" className="admin-modal-label">Role</label>
										<select
											id="admin-fashion-talent-role"
											value={form.role}
											onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
											className="admin-artists-page-input"
										>
											{ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
										</select>
									</div>
									<div className="admin-modal-field">
										<label htmlFor="admin-fashion-talent-agency-name" className="admin-modal-label">Agency Name</label>
										<input id="admin-fashion-talent-agency-name" type="text" placeholder="Agency name (if signed)" value={form.agencyName} onChange={(event) => setForm((current) => ({ ...current, agencyName: event.target.value }))} className="admin-artists-page-input" />
									</div>
									<div className="admin-modal-field">
										<label htmlFor="admin-fashion-talent-agency-contact" className="admin-modal-label">Agency Contact</label>
										<input id="admin-fashion-talent-agency-contact" type="text" placeholder="Agency email or phone" value={form.agencyContact} onChange={(event) => setForm((current) => ({ ...current, agencyContact: event.target.value }))} className="admin-artists-page-input" />
									</div>
								</div>
							</div>
						</TabPanel>
						<TabPanel header="Links">
							<div className="admin-modal-grid">
								<div className="admin-modal-field admin-modal-field-full">
									<label className="admin-modal-label">Links</label>
									<AdminProfileLinksField
										value={form.links}
										onChange={(links) => setForm((current) => ({ ...current, links }))}
									/>
								</div>
							</div>
						</TabPanel>
					</TabView>
				</div>
				<div className="admin-modal-footer">
					<div className="admin-modal-footer-start">
						{form.id && canDelete && (
							<ConfirmActionButton
								message="Delete this person? They will be removed from any Look credits."
								onConfirm={onDelete}
								buttonClassName="admin-artists-page-danger-btn"
								buttonAriaLabel="Delete talent"
								buttonTitle="Delete"
							>
								Delete
							</ConfirmActionButton>
						)}
					</div>
					<button type="button" onClick={onClose} className="admin-artists-page-ghost-btn">Cancel</button>
					<button type="button" onClick={onSave} className="admin-artists-page-primary-btn">Save</button>
				</div>
			</div>
		</div>
	);
}

export default function AdminFashionTalentPage() {
	const { token, session } = useAdminAuth();
	const isSuperAdmin = session?.role === 'SUPER_ADMIN';
	const auth = { Authorization: `Bearer ${token}` };
	const [talent, setTalent] = useState([]);
	const [form, setForm] = useState(null);
	const draggedIdRef = useRef(null);
	const [dropTargetId, setDropTargetId] = useState(null);
	const [loadingEditId, setLoadingEditId] = useState(null);

	useEffect(() => {
		let ignore = false;

		loadAdminResource({ cacheKey: 'fashion-talent-list', url: '/api/admin/fashion/talent', token })
			.then((list) => {
				if (!ignore) setTalent(list);
			});

		return () => {
			ignore = true;
		};
	}, [token]);

	const openCreate = () => setForm({ ...empty, links: [] });
	const openEdit = async (person) => {
		setLoadingEditId(person.id);
		try {
			const detail = await fetch(`/api/admin/fashion/talent?id=${person.id}`, { headers: auth }).then((r) => r.json());
			setForm({ ...empty, ...detail, images: detail.images ?? [], links: profileLinksForSource(detail, FASHION_TALENT_LEGACY_LINK_FIELDS) });
		} finally {
			setLoadingEditId(null);
		}
	};
	const closeForm = () => setForm(null);
	const nextOrder = talent.reduce((maxOrder, person) => Math.max(maxOrder, person.order ?? 0), -1) + 1;

	const handleSave = async () => {
		const validationError = validateTalentForm(form);
		if (validationError) {
			window.alert(validationError);
			return;
		}

		const isEdit = Boolean(form.id);
		const url = isEdit ? `/api/admin/fashion/talent?id=${form.id}` : '/api/admin/fashion/talent';
		const payload = {
			...form,
			links: normalizeProfileLinks(form.links),
			slug: slugify(form.name),
			...(isEdit ? {} : { order: nextOrder }),
		};
		const res = await fetch(url, {
			method: isEdit ? 'PUT' : 'POST',
			headers: { ...auth, 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		if (!res.ok) {
			const error = await res.json().catch(() => ({ error: 'Failed to save talent.' }));
			window.alert(error.error ?? 'Failed to save talent.');
			return;
		}
		const saved = await res.json();
		const nextTalent = isEdit ? talent.map((person) => (person.id === saved.id ? saved : person)) : [...talent, saved];
		setTalent(nextTalent);
		primeAdminResource('fashion-talent-list', token, nextTalent);
		closeForm();
	};

	const handleDelete = async (id) => {
		await fetch(`/api/admin/fashion/talent?id=${id}`, { method: 'DELETE', headers: auth });
		const nextTalent = talent.filter((person) => person.id !== id);
		setTalent(nextTalent);
		primeAdminResource('fashion-talent-list', token, nextTalent);
		closeForm();
	};

	const persistTalentOrder = async (nextTalent) => {
		const changed = nextTalent.filter((person, index) => person.order !== index);
		if (!changed.length) return nextTalent;

		const saved = await Promise.all(
			changed.map((person) => {
				const nextOrderValue = nextTalent.findIndex((candidate) => candidate.id === person.id);
				return fetch(`/api/admin/fashion/talent?id=${person.id}`, {
					method: 'PUT',
					headers: { ...auth, 'Content-Type': 'application/json' },
					body: JSON.stringify({ order: nextOrderValue }),
				}).then((res) => res.json());
			})
		);

		const savedById = new Map(saved.map((person) => [person.id, person]));
		return nextTalent.map((person, index) => savedById.get(person.id) ?? { ...person, order: index });
	};

	const handleDragStart = (event, id) => {
		if (form) return;
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', id);
		draggedIdRef.current = id;
	};

	const handleDragOver = (event, id) => {
		if (!draggedIdRef.current || draggedIdRef.current === id) return;
		event.preventDefault();
		setDropTargetId(id);
	};

	const handleDrop = async (id) => {
		if (!draggedIdRef.current || draggedIdRef.current === id) {
			draggedIdRef.current = null;
			setDropTargetId(null);
			return;
		}

		const draggedIndex = talent.findIndex((person) => person.id === draggedIdRef.current);
		const targetIndex = talent.findIndex((person) => person.id === id);
		if (draggedIndex === -1 || targetIndex === -1) {
			draggedIdRef.current = null;
			setDropTargetId(null);
			return;
		}

		const reordered = [...talent];
		const [moved] = reordered.splice(draggedIndex, 1);
		reordered.splice(targetIndex, 0, moved);

		const normalized = reordered.map((person, index) => ({ ...person, order: index }));
		setTalent(normalized);
		primeAdminResource('fashion-talent-list', token, normalized);
		draggedIdRef.current = null;
		setDropTargetId(null);

		const persisted = await persistTalentOrder(reordered);
		setTalent(persisted);
		primeAdminResource('fashion-talent-list', token, persisted);
	};

	const handleDragEnd = () => {
		draggedIdRef.current = null;
		setDropTargetId(null);
	};

	return (
		<div>
			<div className="admin-artists-page-sticky-top">
				<div className="admin-artists-page-header">
					<h1 className="admin-artists-page-title">Fashion — Talent</h1>
					{isSuperAdmin && <button type="button" onClick={openCreate} className="admin-artists-page-primary-btn">New Talent</button>}
				</div>
			</div>

			<div className="admin-entity-card-grid">
				{talent.map((person) => {
					const image = primaryImage(person.images);
					return (
						<AdminEntityCard
							key={person.id}
							image={image?.previewUrl || image?.url}
							imageCount={person.imageCount ?? person.images?.length ?? 1}
							isHidden={isTalentHidden(person)}
							title={person.name}
							subtitle={ROLE_LABEL_BY_VALUE[person.role] ?? person.role}
							links={person.links}
							onEdit={() => void openEdit(person)}
							editDisabled={loadingEditId === person.id}
							editAriaLabel={`Edit ${person.name}`}
							draggable={isSuperAdmin && !form}
							onDragStart={(event) => handleDragStart(event, person.id)}
							onDragOver={(event) => handleDragOver(event, person.id)}
							onDrop={(event) => {
								event.preventDefault();
								handleDrop(person.id);
							}}
							onDragEnd={handleDragEnd}
							isDropTarget={dropTargetId === person.id}
						/>
					);
				})}
			</div>

			{form && (
				<TalentFormModal
					form={form}
					setForm={setForm}
					token={token}
					onClose={closeForm}
					onSave={handleSave}
					onDelete={() => handleDelete(form.id)}
					canDelete={isSuperAdmin}
				/>
			)}
		</div>
	);
}
