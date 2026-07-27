/**
 * Fashion admin collections route.
 *
 * Manages collection metadata, ordered look placement, credits, and loose-look
 * grouping collections.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash, FaPencilAlt } from 'react-icons/fa';
import { TabPanel } from 'primereact/tabview';
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx';
import AdminDateInput from '../../components/admin/AdminDateInput.jsx';
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx';
import CreditsField from '../../components/admin/CreditsField.jsx';
import PageTabs from '../../components/shared/PageTabs.jsx';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js';
import { isValidDateInput } from '../../lib/dateInput.js';
import { slugify } from '../../lib/slugify.js';
import '../../styles/AdminArtistsPage.css';

const empty = {
	title: '',
	slug: '',
	type: 'COLLECTION',
	description: '',
	about: '',
	season: '',
	releaseDate: '',
	location: '',
	coverImages: [],
	isVisible: true,
	order: 0,
	credits: [],
};

const PAGE_SIZE = 15;

const columns = [
	{ key: 'coverImage', label: 'Cover', kind: 'image', className: 'admin-table-col-image' },
	{ key: 'title', label: 'Title', className: 'admin-table-col-lg' },
	{ key: 'season', label: 'Season', className: 'admin-table-col-sm admin-fashion-collections-season-col' },
	{ key: 'releaseDate', label: 'Release Date', kind: 'date', className: 'admin-table-col-sm' },
	{ key: 'lookCount', label: 'Looks', kind: 'lookCount', className: 'admin-table-col-sm' },
];

function validateCollectionForm(form) {
	if (!form.title?.trim()) return 'Title is required.';
	if (form.releaseDate && !isValidDateInput(form.releaseDate)) return 'Release date must use YYYY-MM-DD.';
	return null;
}

function collectionReleaseDateValue(collection) {
	return collection?.releaseDate ? String(collection.releaseDate).slice(0, 10) : '';
}

function compareCollectionsByReleaseDate(left, right) {
	const leftTime = left.releaseDate ? new Date(left.releaseDate).getTime() : null;
	const rightTime = right.releaseDate ? new Date(right.releaseDate).getTime() : null;

	if (leftTime !== null && rightTime !== null && leftTime !== rightTime) return rightTime - leftTime;
	if (leftTime !== null) return -1;
	if (rightTime !== null) return 1;
	return (left.order ?? 0) - (right.order ?? 0);
}

function sortCollectionsByReleaseDate(collections) {
	return collections.toSorted(compareCollectionsByReleaseDate);
}

function hasCreditValue(credit) {
	return Boolean(credit?.creditName?.trim() || credit?.talentId || credit?.crewId);
}

function toFormCredits(credits) {
	return (Array.isArray(credits) ? credits : []).map((credit) => ({
		talentId: credit.talentId ?? credit.talent?.id ?? '',
		crewId: credit.crewId ?? credit.crew?.id ?? '',
		creditName: credit.creditName ?? credit.talent?.name ?? credit.crew?.name ?? '',
		roleLabel: credit.roleLabel ?? '',
	}));
}

function toTalentOption(person) {
	return {
		id: person.id,
		name: person.name,
		role: person.role,
		image: person.images?.[0] ?? null,
	};
}

function toCrewOption(person) {
	return {
		id: person.id,
		name: person.name,
		role: person.role,
		image: person.image ?? null,
	};
}

function isCollectionHidden(collection) {
	return collection?.isVisible === false;
}

function renderDisplayValue(collection, column) {
	if (column.kind === 'image') {
		const image = collection.coverImage;
		if (!image) return <span className="admin-empty-value">-</span>;
		return (
			<div className="admin-image-summary">
				<div className={`admin-thumb-frame ${isCollectionHidden(collection) ? 'admin-thumb-frame-hidden' : ''}`.trim()}>
					<img src={image.previewUrl || image.url} alt={collection.title} className="admin-thumb" />
				</div>
				<span className="admin-image-count">cover</span>
			</div>
		);
	}

	if (column.kind === 'lookCount') {
		const count = collection.lookCount ?? 0;
		return <span className="admin-table-cell-value">{count} look{count === 1 ? '' : 's'}</span>;
	}

	if (column.kind === 'date') {
		const value = collectionReleaseDateValue(collection);
		return value ? <span className="admin-table-cell-value" title={value}>{value}</span> : <span className="admin-empty-value">-</span>;
	}

	const value = collection[column.key];
	if (value === null || value === undefined || value === '') return <span className="admin-empty-value">-</span>;
	return <span className="admin-table-cell-value" title={String(value)}>{String(value)}</span>;
}

function CollectionsTable({
	collections,
	loadingEditId,
	onEdit,
}) {
	return (
		<div className="admin-table-wrap">
			<table className="admin-table">
				<thead>
					<tr>
						{columns.map((column) => <th key={column.key} className={column.className}>{column.label}</th>)}
						<th className="admin-table-actions-col admin-table-sticky-right-0"></th>
					</tr>
				</thead>
				<tbody>
					{collections.map((collection) => (
						<tr
							key={collection.id}
							className={isCollectionHidden(collection) ? 'admin-table-hidden-row' : ''}
						>
							{columns.map((column) => (
								<td key={column.key} className={column.className ?? ''}>
									{renderDisplayValue(collection, column)}
								</td>
							))}
							<td className="admin-table-action-cell admin-table-actions-col admin-table-sticky-right-0">
								<div className="admin-table-actions">
									<button type="button" onClick={() => void onEdit(collection)} disabled={loadingEditId === collection.id} className="admin-button-secondary admin-button-icon" aria-label="Edit collection" title="Edit">
										<FaPencilAlt aria-hidden="true" />
									</button>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function CollectionsPagination({ currentPage, totalPages, onPageChange }) {
	if (totalPages <= 1) return null;

	return (
		<div className="admin-pagination">
			<button type="button" className="admin-pagination-btn" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
				Prev
			</button>
			<span className="admin-pagination-info">Page {currentPage} of {totalPages}</span>
			<button type="button" className="admin-pagination-btn" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
				Next
			</button>
		</div>
	);
}

function CollectionFormModal({ form, setForm, token, talentOptions, crewOptions, onClose, onSave, onDelete }) {
	return (
		<div className="admin-modal-overlay" role="presentation">
			<div className="admin-modal">
				<div className="admin-modal-header">
					<h2 className="admin-modal-title">{form.id ? 'Edit Collection' : 'New Collection'}</h2>
					<button type="button" onClick={onClose} className="admin-modal-close" aria-label="Close">x</button>
				</div>
				<div className="admin-modal-body">
					<PageTabs className="admin-modal-tabs" tabCount={2}>
						<TabPanel header="Collection">
							<div className="admin-modal-grid">
								<div className="admin-modal-field admin-modal-field-full">
									<div className="admin-artist-name-field">
										<button
											type="button"
											onClick={() => setForm((current) => ({ ...current, isVisible: !current.isVisible }))}
											className={`admin-visibility-toggle ${form.isVisible ? '' : 'admin-visibility-toggle-hidden'}`.trim()}
											aria-label={form.isVisible ? 'Collection is visible to the public. Click to hide.' : 'Collection is hidden from the public. Click to show.'}
											title={form.isVisible ? 'Visible on public site' : 'Hidden from public site'}
										>
											{form.isVisible ? <FaEye aria-hidden="true" /> : <FaEyeSlash aria-hidden="true" />}
										</button>
										<div className="admin-artist-name-field-main">
											<label htmlFor="admin-fashion-collection-title" className="admin-modal-label">Title</label>
											<input
												id="admin-fashion-collection-title"
												type="text"
												placeholder="Collection title"
												value={form.title}
												onChange={(event) => setForm((current) => ({ ...current, title: event.target.value, slug: slugify(event.target.value) }))}
												className="admin-field-input"
											/>
										</div>
									</div>
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

								<div className="admin-modal-field admin-modal-field-full admin-fashion-collection-type-location-row">
									<div className="admin-modal-field">
										<label htmlFor="admin-fashion-collection-type" className="admin-modal-label">Type</label>
										<select
											id="admin-fashion-collection-type"
											value={form.type}
											onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
											className="admin-field-input"
										>
											<option value="COLLECTION">Collection</option>
											<option value="LOOSE_LOOK">Loose Look</option>
										</select>
									</div>
									<div className="admin-modal-field">
										<label htmlFor="admin-fashion-collection-location" className="admin-modal-label">Location</label>
										<input id="admin-fashion-collection-location" type="text" placeholder="Paris Fashion Week" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} className="admin-field-input" />
									</div>
								</div>

								<div className="admin-modal-field admin-modal-field-full admin-fashion-collection-season-date-row">
									<div className="admin-modal-field">
										<label htmlFor="admin-fashion-collection-season" className="admin-modal-label">Season</label>
										<input id="admin-fashion-collection-season" type="text" placeholder="SS25" value={form.season} onChange={(event) => setForm((current) => ({ ...current, season: event.target.value }))} className="admin-field-input" />
									</div>
									<div className="admin-modal-field">
										<label htmlFor="admin-fashion-collection-release-date" className="admin-modal-label">Release Date</label>
										<AdminDateInput
											id="admin-fashion-collection-release-date"
											ariaLabel="Collection release date"
											value={form.releaseDate}
											onChange={(value) => setForm((current) => ({ ...current, releaseDate: value }))}
											className="admin-field-input"
										/>
									</div>
								</div>

								<div className="admin-modal-field admin-modal-field-full">
									<label htmlFor="admin-fashion-collection-description" className="admin-modal-label">Description</label>
									<textarea
										id="admin-fashion-collection-description"
										placeholder="Short subtitle for the catalogue..."
										value={form.description}
										onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
										className="admin-field-input admin-modal-textarea"
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
										className="admin-field-input admin-modal-textarea"
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
					</PageTabs>
				</div>
				<div className="admin-modal-footer">
					<div className="admin-modal-footer-start">
						{form.id && (
							<ConfirmActionButton
								message="Delete this collection? Assigned looks will become loose looks."
								onConfirm={onDelete}
								buttonClassName="admin-button-danger"
								buttonAriaLabel="Delete collection"
								buttonTitle="Delete"
							>
								Delete
							</ConfirmActionButton>
						)}
					</div>
					<button type="button" onClick={onClose} className="admin-button-secondary">Cancel</button>
					<button type="button" onClick={onSave} className="admin-button-primary">Save</button>
				</div>
			</div>
		</div>
	);
}

export default function AdminFashionCollectionsPage() {
	const { token } = useAdminAuth();
	const navigate = useNavigate();
	const auth = { Authorization: `Bearer ${token}` };
	const [collections, setCollections] = useState([]);
	const [talentOptions, setTalentOptions] = useState([]);
	const [crewOptions, setCrewOptions] = useState([]);
	const [form, setForm] = useState(null);
	const [loadingEditId, setLoadingEditId] = useState(null);
	const [page, setPage] = useState(1);

	useEffect(() => {
		let ignore = false;

		loadAdminResource({ cacheKey: 'fashion-collections-list', url: '/api/admin/fashion/collections', token })
			.then((list) => {
				if (!ignore) setCollections(sortCollectionsByReleaseDate(list));
			});

		return () => {
			ignore = true;
		};
	}, [token]);

	useEffect(() => {
		let ignore = false;

		Promise.all([
			loadAdminResource({ cacheKey: 'fashion-talent-list', url: '/api/admin/fashion?resource=talent', token }),
			loadAdminResource({ cacheKey: 'fashion-crew-list', url: '/api/admin/fashion?resource=crew', token }),
		]).then(([talent, crew]) => {
			if (ignore) return;
			setTalentOptions(talent.map(toTalentOption));
			setCrewOptions(crew.map(toCrewOption));
		});

		return () => {
			ignore = true;
		};
	}, [token]);

	const openCreate = () => setForm({ ...empty });
	const openEdit = async (collection) => {
		setLoadingEditId(collection.id);
		try {
			const detail = await fetch(`/api/admin/fashion/collections/${collection.id}`, { headers: auth }).then((response) => response.json());
			setForm({
				...empty,
				...detail,
				releaseDate: collectionReleaseDateValue(detail),
				coverImages: detail.coverImage ? [detail.coverImage] : [],
				credits: toFormCredits(detail.credits),
			});
		} finally {
			setLoadingEditId(null);
		}
	};
	const closeForm = () => setForm(null);
	const nextOrder = collections.reduce((maxOrder, collection) => Math.max(maxOrder, collection.order ?? 0), -1) + 1;
	const totalPages = useMemo(() => Math.max(1, Math.ceil(collections.length / PAGE_SIZE)), [collections.length]);
	const currentPage = Math.min(page, totalPages);
	const pagedCollections = useMemo(
		() => collections.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
		[collections, currentPage]
	);

	const handleSave = async () => {
		const validationError = validateCollectionForm(form);
		if (validationError) {
			window.alert(validationError);
			return;
		}

		const isEdit = Boolean(form.id);
		const url = isEdit ? `/api/admin/fashion/collections/${form.id}` : '/api/admin/fashion/collections';
		const payload = {
			title: form.title,
			slug: slugify(form.title),
			type: form.type,
			description: form.description,
			about: form.about,
			season: form.season,
			releaseDate: form.releaseDate || null,
			location: form.location,
			coverImage: form.coverImages?.[0] ?? null,
			isVisible: form.isVisible,
			order: isEdit ? form.order : nextOrder,
			credits: form.credits.filter(hasCreditValue),
		};
		const res = await fetch(url, {
			method: isEdit ? 'PUT' : 'POST',
			headers: { ...auth, 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		if (!res.ok) {
			const error = await res.json().catch(() => ({ error: 'Failed to save collection.' }));
			window.alert(error.error ?? 'Failed to save collection.');
			return;
		}
		const saved = await res.json();
		const nextCollections = isEdit
			? collections.map((collection) => (collection.id === saved.id ? saved : collection))
			: [...collections, saved];
		const sortedCollections = sortCollectionsByReleaseDate(nextCollections);
		setCollections(sortedCollections);
		primeAdminResource('fashion-collections-list', token, sortedCollections);
		fetch('/api/admin/fashion?resource=crew', { headers: auth })
			.then((response) => (response.ok ? response.json() : null))
			.then((crew) => {
				if (!crew) return;
				setCrewOptions(crew.map(toCrewOption));
				primeAdminResource('fashion-crew-list', token, crew);
			})
			.catch(() => { });
		closeForm();

		if (!isEdit && saved.type === 'LOOSE_LOOK') {
			navigate('/admin/fashion/looks', {
				state: {
					prefillLookFromCollection: saved,
					returnTo: '/admin/fashion/collections',
				},
			});
		}
	};

	const handleDelete = async (id) => {
		await fetch(`/api/admin/fashion/collections/${id}`, { method: 'DELETE', headers: auth });
		const nextCollections = collections.filter((collection) => collection.id !== id);
		setCollections(nextCollections);
		primeAdminResource('fashion-collections-list', token, nextCollections);
	};

	return (
		<div>
			<div className="admin-sticky-top">
				<div className="admin-page-header">
					<h1 className="admin-page-title">Fashion - Collections</h1>
					<button type="button" onClick={openCreate} className="admin-button-primary">New Collection</button>
				</div>
			</div>

			<CollectionsTable
				collections={pagedCollections}
				loadingEditId={loadingEditId}
				onEdit={openEdit}
			/>

			<CollectionsPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />

			{form && (
				<CollectionFormModal
					form={form}
					setForm={setForm}
					token={token}
					talentOptions={talentOptions}
					crewOptions={crewOptions}
					onClose={closeForm}
					onSave={handleSave}
					onDelete={async () => {
						await handleDelete(form.id);
						closeForm();
					}}
				/>
			)}
		</div>
	);
}
