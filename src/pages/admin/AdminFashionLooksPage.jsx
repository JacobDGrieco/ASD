import { useEffect, useRef, useState } from 'react';
import { FaEye, FaEyeSlash, FaPencilAlt, FaTrash } from 'react-icons/fa';
import { TabPanel, TabView } from 'primereact/tabview';
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx';
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx';
import CreditsField from '../../components/admin/CreditsField.jsx';
import FashionPiecesField from '../../components/admin/FashionPiecesField.jsx';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js';
import { clientImage } from '../../lib/images.js';
import { slugify } from '../../lib/slugify.js';
import '../../styles/AdminArtistsPage.css';

const empty = {
	title: '',
	slug: '',
	description: '',
	isVisible: true,
	images: [],
	order: 0,
	collectionId: '',
	credits: [],
	pieces: [],
};

const columns = [
	{ key: 'images', label: 'Cover', kind: 'images', className: 'admin-artists-page-col-image' },
	{ key: 'title', label: 'Title', className: 'admin-artists-page-col-lg' },
	{ key: 'pieceCount', label: 'Pieces', kind: 'pieceCount', className: 'admin-artists-page-col-sm' },
];

function primaryImage(images) {
	if (!Array.isArray(images) || images.length === 0) return null;
	return images.find((image) => image.isPrimary) ?? images[0];
}

function validateLookForm(form) {
	if (!form.title?.trim()) return 'Title is required.';
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

function LooksTable({ looks, isFormOpen, dropTargetId, loadingEditId, onDragStart, onDragOver, onDrop, onDragEnd, onEdit, onDelete }) {
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
					{looks.map((look) => (
						<tr
							key={look.id}
							className={[
								dropTargetId === look.id ? 'admin-artists-page-drop-target-row' : '',
								isLookHidden(look) ? 'admin-artists-page-hidden-row' : '',
							].filter(Boolean).join(' ')}
							onDragOver={(event) => onDragOver(event, look.id)}
							onDrop={(event) => {
								event.preventDefault();
								onDrop(look.id);
							}}
						>
							<td className="admin-artists-page-drag-cell">
								<button
									type="button"
									draggable={!isFormOpen}
									onDragStart={(event) => onDragStart(event, look.id)}
									onDragEnd={onDragEnd}
									className="admin-artists-page-drag-handle"
									aria-label={`Reorder ${look.title}`}
									title="Drag to reorder"
								>
									::
								</button>
							</td>
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
									<ConfirmActionButton
										message="Delete this Look and all its pieces and credits?"
										onConfirm={() => onDelete(look.id)}
										buttonClassName="admin-artists-page-danger-btn admin-artists-page-icon-btn"
										buttonAriaLabel="Delete look"
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
	);
}

function LookFormModal({ form, setForm, token, collections, talentOptions, crewOptions, onClose, onSave }) {
	return (
		<div className="admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<div className="admin-modal">
				<div className="admin-modal-header">
					<h2 className="admin-modal-title">{form.id ? 'Edit Look' : 'New Look'}</h2>
					<button type="button" onClick={onClose} className="admin-modal-close" aria-label="Close">Ã—</button>
				</div>
				<div className="admin-modal-body">
					<TabView className="page-tabview admin-modal-tabs">
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
									<label htmlFor="admin-fashion-look-collection" className="admin-modal-label">Collection</label>
									<select
										id="admin-fashion-look-collection"
										value={form.collectionId ?? ''}
										onChange={(event) => setForm((current) => ({ ...current, collectionId: event.target.value || null }))}
										className="admin-artists-page-input"
									>
										<option value="">No collection (loose look)</option>
										{collections.map((collection) => (
											<option key={collection.id} value={collection.id}>
												{collection.title}{collection.season ? ` (${collection.season})` : ''}
											</option>
										))}
									</select>
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
					</TabView>
				</div>
				<div className="admin-modal-footer">
					<button type="button" onClick={onClose} className="admin-artists-page-ghost-btn">Cancel</button>
					<button type="button" onClick={onSave} className="admin-artists-page-primary-btn">Save</button>
				</div>
			</div>
		</div>
	);
}

export default function AdminFashionLooksPage() {
	const { token } = useAdminAuth();
	const auth = { Authorization: `Bearer ${token}` };
	const [looks, setLooks] = useState([]);
	const [talentOptions, setTalentOptions] = useState([]);
	const [crewOptions, setCrewOptions] = useState([]);
	const [collections, setCollections] = useState([]);
	const [form, setForm] = useState(null);
	const draggedIdRef = useRef(null);
	const [dropTargetId, setDropTargetId] = useState(null);
	const [loadingEditId, setLoadingEditId] = useState(null);

	useEffect(() => {
		let ignore = false;

		loadAdminResource({ cacheKey: 'fashion-looks-list', url: '/api/admin/fashion/looks', token })
			.then((list) => {
				if (!ignore) setLooks(list);
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

	const openCreate = () => setForm({ ...empty });
	const openEdit = async (look) => {
		setLoadingEditId(look.id);
		try {
			const detail = await fetch(`/api/admin/fashion/looks?id=${look.id}`, { headers: auth }).then((r) => r.json());
			setForm({
				...empty,
				...detail,
				images: detail.images ?? [],
				collectionId: detail.collectionId ?? '',
				credits: toFormCredits(detail.credits),
				pieces: toFormPieces(detail.pieces),
			});
		} finally {
			setLoadingEditId(null);
		}
	};
	const closeForm = () => setForm(null);
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
		setLooks(nextLooks);
		primeAdminResource('fashion-looks-list', token, nextLooks);
		fetch('/api/admin/fashion?resource=crew', { headers: auth })
			.then((response) => (response.ok ? response.json() : null))
			.then((crew) => {
				if (!crew) return;
				setCrewOptions(crew.map(toCrewOption));
				primeAdminResource('fashion-crew-list', token, crew);
			})
			.catch(() => {});
		closeForm();
	};

	const handleDelete = async (id) => {
		await fetch(`/api/admin/fashion/looks?id=${id}`, { method: 'DELETE', headers: auth });
		const nextLooks = looks.filter((look) => look.id !== id);
		setLooks(nextLooks);
		primeAdminResource('fashion-looks-list', token, nextLooks);
	};

	const persistLookOrder = async (nextLooks) => {
		const changed = nextLooks.filter((look, index) => look.order !== index);
		if (!changed.length) return nextLooks;

		const saved = await Promise.all(
			changed.map((look) => {
				const nextOrderValue = nextLooks.findIndex((candidate) => candidate.id === look.id);
				return fetch(`/api/admin/fashion/looks?id=${look.id}`, {
					method: 'PUT',
					headers: { ...auth, 'Content-Type': 'application/json' },
					body: JSON.stringify({ order: nextOrderValue }),
				}).then((res) => res.json());
			})
		);

		const savedById = new Map(saved.map((look) => [look.id, look]));
		return nextLooks.map((look, index) => savedById.get(look.id) ?? { ...look, order: index });
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

		const draggedIndex = looks.findIndex((look) => look.id === draggedIdRef.current);
		const targetIndex = looks.findIndex((look) => look.id === id);
		if (draggedIndex === -1 || targetIndex === -1) {
			draggedIdRef.current = null;
			setDropTargetId(null);
			return;
		}

		const reordered = [...looks];
		const [moved] = reordered.splice(draggedIndex, 1);
		reordered.splice(targetIndex, 0, moved);

		const normalized = reordered.map((look, index) => ({ ...look, order: index }));
		setLooks(normalized);
		primeAdminResource('fashion-looks-list', token, normalized);
		draggedIdRef.current = null;
		setDropTargetId(null);

		const persisted = await persistLookOrder(reordered);
		setLooks(persisted);
		primeAdminResource('fashion-looks-list', token, persisted);
	};

	const handleDragEnd = () => {
		draggedIdRef.current = null;
		setDropTargetId(null);
	};

	return (
		<div>
			<div className="admin-artists-page-sticky-top">
				<div className="admin-artists-page-header">
					<h1 className="admin-artists-page-title">Fashion â€” Looks</h1>
					<button type="button" onClick={openCreate} className="admin-artists-page-primary-btn">New Look</button>
				</div>
			</div>

			<LooksTable
				looks={looks}
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
                <LookFormModal
                    form={form}
                    setForm={setForm}
                    token={token}
                    collections={collections}
                    talentOptions={talentOptions}
                    crewOptions={crewOptions}
                    onClose={closeForm}
                    onSave={handleSave}
                />
            )}
		</div>
	);
}
