import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaEye, FaEyeSlash, FaPencilAlt, FaTrash } from 'react-icons/fa';
import { TabPanel } from 'primereact/tabview';
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx';
import AdminDateInput from '../../components/admin/AdminDateInput.jsx';
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx';
import CreditsField from '../../components/admin/CreditsField.jsx';
import FashionPiecesField from '../../components/admin/FashionPiecesField.jsx';
import PageTabs from '../../components/shared/PageTabs.jsx';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js';
import { clientImage } from '../../lib/images.js';
import { isValidDateInput } from '../../lib/dateInput.js';
import { slugify } from '../../lib/slugify.js';
import '../../styles/AdminArtistsPage.css';

const empty = {
	title: '',
	slug: '',
	description: '',
	isVisible: true,
	releaseDate: '',
	images: [],
	order: 0,
	collectionPlacements: [],
	credits: [],
	pieces: [],
};

const columns = [
	{ key: 'images', label: 'Cover', kind: 'images', className: 'admin-artists-page-col-image' },
	{ key: 'placementOrder', label: '#', kind: 'placementOrder', className: 'admin-songs-col-track admin-artists-page-center-cell' },
	{ key: 'title', label: 'Title', className: 'admin-artists-page-col-lg' },
	{ key: 'collections', label: 'Collections', kind: 'collections', className: 'admin-artists-page-col-sm' },
	{ key: 'effectiveReleaseDate', label: 'Release Date', kind: 'date', className: 'admin-artists-page-col-sm' },
	{ key: 'pieceCount', label: 'Pieces', kind: 'pieceCount', className: 'admin-artists-page-col-sm' },
];

function primaryImage(images) {
	if (!Array.isArray(images) || images.length === 0) return null;
	return images.find((image) => image.isPrimary) ?? images[0];
}

function validateLookForm(form) {
	if (!form.title?.trim()) return 'Title is required.';
	if (form.releaseDate && !isValidDateInput(form.releaseDate)) return 'Release date must use YYYY-MM-DD.';
	return null;
}

function isLookHidden(look) {
	return look?.isVisible === false;
}

function hasCreditValue(credit) {
	return Boolean(credit?.creditName?.trim() || credit?.talentId || credit?.crewId);
}

function renderDisplayValue(look, column) {
	if (column.kind === 'images') {
		const image = primaryImage(look.images);
		if (!image) return <span className="admin-artists-page-empty-value">-</span>;
		return (
			<div className="admin-artists-page-image-summary">
				<div className={`admin-artists-page-thumb-frame ${isLookHidden(look) ? 'admin-artists-page-thumb-frame-hidden' : ''}`.trim()}>
					<img src={image.previewUrl || image.url} alt={look.title} className="admin-artists-page-thumb" />
				</div>
				<span className="admin-artists-page-image-count">{look.imageCount ?? look.images?.length ?? 1} image{(look.imageCount ?? look.images?.length ?? 1) === 1 ? '' : 's'}</span>
			</div>
		);
	}

	if (column.kind === 'pieceCount') {
		const count = look.pieceCount ?? look.pieces?.length ?? 0;
		return <span className="admin-artists-page-cell-value">{count} piece{count === 1 ? '' : 's'}</span>;
	}

	if (column.kind === 'collections') {
		const labels = (look.collectionPlacements ?? [])
			.flatMap((placement) => (placement.collection?.title ? [placement.collection.title] : []));
		if (!labels.length) return <span className="admin-artists-page-empty-value">Loose look</span>;
		const value = labels.join(', ');
		return <span className="admin-artists-page-cell-value" title={value}>{value}</span>;
	}

	if (column.kind === 'date') {
		const value = look.effectiveReleaseDate ? String(look.effectiveReleaseDate).slice(0, 10) : '';
		return value ? <span className="admin-artists-page-cell-value" title={value}>{value}</span> : <span className="admin-artists-page-empty-value">-</span>;
	}

	if (column.kind === 'placementOrder') {
		const placements = Array.isArray(look.collectionPlacements) ? look.collectionPlacements : [];
		if (!placements.length) return <span className="admin-artists-page-cell-value">{look.order ?? 0}</span>;
		const value = placements
			.map((placement) => placement.sortOrder ?? 0)
			.join(', ');
		return <span className="admin-artists-page-cell-value" title={value}>{value}</span>;
	}

	const value = look[column.key];
	if (value === null || value === undefined || value === '') return <span className="admin-artists-page-empty-value">-</span>;
	return <span className="admin-artists-page-cell-value" title={String(value)}>{String(value)}</span>;
}

// Older credits may still have a linked person. Keep that id while making the
// visible credit name editable as plain text.
function toFormCredits(credits) {
	return (Array.isArray(credits) ? credits : []).map((credit) => ({
		talentId: credit.talentId ?? credit.talent?.id ?? '',
		crewId: credit.crewId ?? credit.crew?.id ?? '',
		creditName: credit.creditName ?? credit.talent?.name ?? credit.crew?.name ?? '',
		roleLabel: credit.roleLabel ?? '',
	}));
}

function toFormPieceImage(piece) {
	if (piece?.image) return piece.image;
	const imageReference = piece?.imageUrl || piece?.pathname;
	if (!imageReference) return null;

	return clientImage({
		id: `${piece.id ?? piece.name ?? 'piece'}-image`,
		url: piece.imageUrl || imageReference,
		pathname: piece.pathname || imageReference,
		usage: 'piece',
		altText: piece.name ?? '',
		sortOrder: 0,
		isPrimary: true,
	});
}

function toFormPieces(pieces) {
	return (Array.isArray(pieces) ? pieces : []).map((piece) => ({
		id: piece.id,
		name: piece.name ?? '',
		buyUrl: piece.buyUrl ?? '',
		image: toFormPieceImage(piece),
		credits: toFormCredits(piece.credits),
	}));
}

function toFormCollectionPlacements(placements) {
	return (Array.isArray(placements) ? placements : []).map((placement, index) => ({
		_key: crypto.randomUUID(),
		collectionId: placement.collectionId ?? placement.collection?.id ?? '',
		sortOrder: Number.isFinite(Number(placement.sortOrder)) ? Number(placement.sortOrder) : index,
	}));
}

function lookReleaseDateValue(look) {
	return look?.releaseDate ? String(look.releaseDate).slice(0, 10) : '';
}

function compareLooksByReleaseDate(left, right) {
	const leftDate = left.effectiveReleaseDate ?? left.releaseDate;
	const rightDate = right.effectiveReleaseDate ?? right.releaseDate;
	const leftTime = leftDate ? new Date(leftDate).getTime() : null;
	const rightTime = rightDate ? new Date(rightDate).getTime() : null;

	if (leftTime !== null && rightTime !== null && leftTime !== rightTime) return rightTime - leftTime;
	if (leftTime !== null) return -1;
	if (rightTime !== null) return 1;

	const leftPlacement = lookPlacementSortKey(left);
	const rightPlacement = lookPlacementSortKey(right);
	const collectionCompare = leftPlacement.collectionName.localeCompare(rightPlacement.collectionName, undefined, { sensitivity: 'base', numeric: true });
	if (collectionCompare !== 0) return collectionCompare;

	if (leftPlacement.sortOrder !== rightPlacement.sortOrder) return leftPlacement.sortOrder - rightPlacement.sortOrder;

	return String(left.title ?? '').localeCompare(String(right.title ?? ''), undefined, { sensitivity: 'base', numeric: true });
}

function buildLookFromCollection(collection) {
	return {
		...empty,
		title: collection.title ?? '',
		slug: slugify(collection.title ?? ''),
		description: collection.description || collection.about || '',
		isVisible: collection.isVisible ?? true,
		releaseDate: collection.releaseDate ? String(collection.releaseDate).slice(0, 10) : '',
		images: collection.coverImage ? [collection.coverImage] : [],
		collectionPlacements: collection.id ? [{ _key: crypto.randomUUID(), collectionId: collection.id, sortOrder: 0 }] : [],
	};
}

function lookPlacementSortKey(look) {
	const placements = Array.isArray(look.collectionPlacements) ? look.collectionPlacements : [];
	if (!placements.length) {
		return {
			collectionName: '\uffff',
			sortOrder: look.order ?? Number.MAX_SAFE_INTEGER,
		};
	}

	const [placement] = placements.toSorted((left, right) => {
		const collectionCompare = String(left.collection?.title ?? '').localeCompare(String(right.collection?.title ?? ''), undefined, { sensitivity: 'base', numeric: true });
		if (collectionCompare !== 0) return collectionCompare;
		return (left.sortOrder ?? 0) - (right.sortOrder ?? 0);
	});

	return {
		collectionName: String(placement.collection?.title ?? ''),
		sortOrder: placement.sortOrder ?? 0,
	};
}

function sortLooksByReleaseDate(looks) {
	return looks.toSorted(compareLooksByReleaseDate);
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

function LooksTable({ looks, loadingEditId, onEdit }) {
	return (
		<div className="admin-artists-page-table-wrap">
			<table className="admin-artists-page-table">
				<thead>
					<tr>
						{columns.map((column) => <th key={column.key} className={column.className}>{column.label}</th>)}
						<th className="admin-artists-page-actions-col admin-artists-page-sticky-right-0"></th>
					</tr>
				</thead>
				<tbody>
					{looks.map((look) => (
						<tr
							key={look.id}
							className={isLookHidden(look) ? 'admin-artists-page-hidden-row' : ''}
						>
							{columns.map((column) => (
								<td key={column.key} className={column.className ?? ''}>
									{renderDisplayValue(look, column)}
								</td>
							))}
							<td className="admin-artists-page-action-cell admin-artists-page-actions-col admin-artists-page-sticky-right-0">
								<div className="admin-artists-page-actions">
									<button type="button" onClick={() => void onEdit(look)} disabled={loadingEditId === look.id} className="admin-artists-page-ghost-btn admin-artists-page-icon-btn" aria-label="Edit look" title="Edit">
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

function LookFormModal({ form, setForm, token, collections, talentOptions, crewOptions, onClose, onSave, onDelete }) {
	return (
		<div className="admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<div className="admin-modal">
				<div className="admin-modal-header">
					<h2 className="admin-modal-title">{form.id ? 'Edit Look' : 'New Look'}</h2>
					<button type="button" onClick={onClose} className="admin-modal-close" aria-label="Close">x</button>
				</div>
				<div className="admin-modal-body">
					<PageTabs className="admin-modal-tabs" tabCount={4}>
						<TabPanel header="Look">
							<div className="admin-modal-grid">
								<div className="admin-modal-field admin-modal-field-full">
									<div className="admin-artists-page-name-field">
										<button
											type="button"
											onClick={() => setForm((current) => ({ ...current, isVisible: !current.isVisible }))}
											className={`admin-artists-page-visibility-toggle ${form.isVisible ? '' : 'admin-artists-page-visibility-toggle-hidden'}`.trim()}
											aria-label={form.isVisible ? 'Look is visible to the public. Click to hide.' : 'Look is hidden from the public. Click to show.'}
											title={form.isVisible ? 'Visible on public site' : 'Hidden from public site'}
										>
											{form.isVisible ? <FaEye aria-hidden="true" /> : <FaEyeSlash aria-hidden="true" />}
										</button>
										<div className="admin-artists-page-name-field-main">
											<label htmlFor="admin-fashion-look-title" className="admin-modal-label">Title</label>
											<input
												id="admin-fashion-look-title"
												type="text"
												placeholder="Look title"
												value={form.title}
												onChange={(event) => setForm((current) => ({ ...current, title: event.target.value, slug: slugify(event.target.value) }))}
												className="admin-artists-page-input"
											/>
										</div>
									</div>
								</div>

								<div className="admin-modal-field admin-modal-field-full">
									<div className="admin-modal-label">Lookbook Images</div>
									<ImageCollectionField
										value={form.images}
										onChange={(images) => setForm((current) => ({ ...current, images }))}
										token={token}
										folder="fashion-looks"
										entityLabel={form.title || 'Look image'}
									/>
								</div>

								<div className="admin-modal-field admin-modal-field-full">
									<label htmlFor="admin-fashion-look-release-date" className="admin-modal-label">Look Release Date</label>
									<AdminDateInput
										id="admin-fashion-look-release-date"
										ariaLabel="Look release date"
										value={form.releaseDate}
										onChange={(value) => setForm((current) => ({ ...current, releaseDate: value }))}
										className="admin-artists-page-input"
									/>
								</div>

								<div className="admin-modal-field admin-modal-field-full">
									<label htmlFor="admin-fashion-look-description" className="admin-modal-label">Description (the ideas behind it)</label>
									<textarea
										id="admin-fashion-look-description"
										placeholder="Describe the fashion and the ideas behind this look..."
										value={form.description}
										onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
										className="admin-artists-page-input admin-modal-textarea"
										rows={6}
									/>
								</div>
							</div>
						</TabPanel>

						<TabPanel header="Collection">
							<div className="admin-modal-grid">
								<div className="admin-modal-field admin-modal-field-full">
									<div className="admin-modal-label">Collections</div>
									<div className="admin-fashion-look-placements">
										{form.collectionPlacements.map((placement, index) => (
											<div key={placement._key} className="admin-fashion-look-placement-row">
												<select
													value={placement.collectionId}
													onChange={(event) => setForm((current) => ({
														...current,
														collectionPlacements: current.collectionPlacements.map((item, itemIndex) => (
															itemIndex === index ? { ...item, collectionId: event.target.value } : item
														)),
													}))}
													className="admin-artists-page-input admin-fashion-look-placement-collection"
													aria-label={`Collection ${index + 1}`}
												>
													<option value="">Select collection</option>
													{collections.map((collection) => (
														<option
															key={collection.id}
															value={collection.id}
															disabled={form.collectionPlacements.some((item, itemIndex) => itemIndex !== index && item.collectionId === collection.id)}
														>
															{collection.title}{collection.season ? ` (${collection.season})` : ''}
														</option>
													))}
												</select>
												<input
													type="number"
													min="0"
													step="1"
													value={placement.sortOrder}
													onChange={(event) => setForm((current) => ({
														...current,
														collectionPlacements: current.collectionPlacements.map((item, itemIndex) => (
															itemIndex === index ? { ...item, sortOrder: Number(event.target.value) || 0 } : item
														)),
													}))}
													className="admin-artists-page-input admin-fashion-look-placement-order"
													aria-label={`Order in collection ${index + 1}`}
												/>
												<button
													type="button"
													onClick={() => setForm((current) => ({
														...current,
														collectionPlacements: current.collectionPlacements.filter((_, itemIndex) => itemIndex !== index),
													}))}
													className="admin-artists-page-danger-btn admin-artists-page-icon-btn"
													aria-label="Remove collection placement"
													title="Remove"
												>
													<FaTrash aria-hidden="true" />
												</button>
											</div>
										))}
										<button
											type="button"
											onClick={() => setForm((current) => ({
												...current,
												collectionPlacements: [
													...current.collectionPlacements,
													{ _key: crypto.randomUUID(), collectionId: '', sortOrder: current.collectionPlacements.length },
												],
											}))}
											className="admin-artists-page-ghost-btn"
										>
											Add Collection
										</button>
									</div>
								</div>
							</div>
						</TabPanel>

						<TabPanel header="Credits">
							<div className="admin-modal-grid">
								<div className="admin-modal-field admin-modal-field-full">
									<div className="admin-modal-label">Default Credits</div>
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

						<TabPanel header="Pieces">
							<div className="admin-modal-grid">
								<div className="admin-modal-field admin-modal-field-full">
									<div className="admin-modal-label">Pieces</div>
									<FashionPiecesField
										value={form.pieces}
										onChange={(pieces) => setForm((current) => ({ ...current, pieces }))}
										token={token}
										lookTitle={form.title}
										talentOptions={talentOptions}
										crewOptions={crewOptions}
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
								message="Delete this Look and all its pieces and credits?"
								onConfirm={onDelete}
								buttonClassName="admin-artists-page-danger-btn"
								buttonAriaLabel="Delete look"
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

export default function AdminFashionLooksPage() {
	const { token } = useAdminAuth();
	const location = useLocation();
	const navigate = useNavigate();
	const auth = { Authorization: `Bearer ${token}` };
	const [looks, setLooks] = useState([]);
	const [talentOptions, setTalentOptions] = useState([]);
	const [crewOptions, setCrewOptions] = useState([]);
	const [collections, setCollections] = useState([]);
	const [form, setForm] = useState(null);
	const returnToAfterSaveRef = useRef(null);
	const [loadingEditId, setLoadingEditId] = useState(null);

	useEffect(() => {
		let ignore = false;

		loadAdminResource({ cacheKey: 'fashion-looks-list', url: '/api/admin/fashion/looks', token })
			.then((list) => {
				if (!ignore) setLooks(sortLooksByReleaseDate(list));
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
			loadAdminResource({ cacheKey: 'fashion-collections-list', url: '/api/admin/fashion/collections', token }),
		]).then(([talent, crew, collectionList]) => {
			if (ignore) return;
			setTalentOptions(talent.map(toTalentOption));
			setCrewOptions(crew.map(toCrewOption));
			setCollections(collectionList);
		});

		return () => {
			ignore = true;
		};
	}, [token]);

	useEffect(() => {
		const prefill = location.state?.prefillLookFromCollection;
		if (!prefill) return;

		setForm(buildLookFromCollection(prefill));
		returnToAfterSaveRef.current = location.state?.returnTo || null;
		navigate(location.pathname, { replace: true, state: {} });
	}, [location.pathname, location.state, navigate]);

	const openCreate = () => setForm({ ...empty });
	const openEdit = async (look) => {
		setLoadingEditId(look.id);
		try {
			const detail = await fetch(`/api/admin/fashion/looks?id=${look.id}`, { headers: auth }).then((r) => r.json());
			setForm({
				...empty,
				...detail,
				images: detail.images ?? [],
				releaseDate: lookReleaseDateValue(detail),
				collectionPlacements: toFormCollectionPlacements(detail.collectionPlacements),
				credits: toFormCredits(detail.credits),
				pieces: toFormPieces(detail.pieces),
			});
		} finally {
			setLoadingEditId(null);
		}
	};
	const closeForm = () => {
		setForm(null);
		returnToAfterSaveRef.current = null;
	};
	const nextOrder = looks.reduce((maxOrder, look) => Math.max(maxOrder, look.order ?? 0), -1) + 1;

	const handleSave = async () => {
		const validationError = validateLookForm(form);
		if (validationError) {
			window.alert(validationError);
			return;
		}

		const isEdit = Boolean(form.id);
		const url = isEdit ? `/api/admin/fashion/looks?id=${form.id}` : '/api/admin/fashion/looks';
		const payload = {
			...form,
			slug: slugify(form.title),
			releaseDate: form.releaseDate || null,
			collectionPlacements: form.collectionPlacements.reduce((acc, placement) => {
				if (!placement.collectionId) return acc;
				const index = acc.length;
				acc.push({
					collectionId: placement.collectionId,
					sortOrder: Number.isFinite(Number(placement.sortOrder)) ? Number(placement.sortOrder) : index,
				});
				return acc;
			}, []),
			credits: form.credits.filter(hasCreditValue),
			pieces: form.pieces.map((piece) => ({
				...piece,
				credits: piece.credits.filter(hasCreditValue),
			})),
			...(isEdit ? {} : { order: nextOrder }),
		};
		const res = await fetch(url, {
			method: isEdit ? 'PUT' : 'POST',
			headers: { ...auth, 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		if (!res.ok) {
			const error = await res.json().catch(() => ({ error: 'Failed to save look.' }));
			window.alert(error.error ?? 'Failed to save look.');
			return;
		}
		const saved = await res.json();
		const nextLooks = isEdit ? looks.map((look) => (look.id === saved.id ? saved : look)) : [...looks, saved];
		const sortedLooks = sortLooksByReleaseDate(nextLooks);
		setLooks(sortedLooks);
		primeAdminResource('fashion-looks-list', token, sortedLooks);
		fetch('/api/admin/fashion?resource=crew', { headers: auth })
			.then((response) => (response.ok ? response.json() : null))
			.then((crew) => {
				if (!crew) return;
				setCrewOptions(crew.map(toCrewOption));
				primeAdminResource('fashion-crew-list', token, crew);
			})
			.catch(() => { });
		closeForm();
		if (returnToAfterSaveRef.current) navigate(returnToAfterSaveRef.current);
	};

	const handleDelete = async (id) => {
		await fetch(`/api/admin/fashion/looks?id=${id}`, { method: 'DELETE', headers: auth });
		const nextLooks = looks.filter((look) => look.id !== id);
		setLooks(nextLooks);
		primeAdminResource('fashion-looks-list', token, nextLooks);
	};

	return (
		<div>
			<div className="admin-artists-page-sticky-top">
				<div className="admin-artists-page-header">
					<h1 className="admin-artists-page-title">Fashion — Looks</h1>
					<button type="button" onClick={openCreate} className="admin-artists-page-primary-btn">New Look</button>
				</div>
			</div>

			<LooksTable
				looks={looks}
				loadingEditId={loadingEditId}
				onEdit={openEdit}
			/>

			{form && (
				<LookFormModal
					form={form}
					setForm={setForm}
					token={token}
					collections={collections}
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
