import { useEffect, useState } from 'react';
import { FaEye, FaEyeSlash, FaPencilAlt, FaTrash } from 'react-icons/fa';
import { TabPanel, TabView } from 'primereact/tabview';
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx';
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx';
import CreditsField from '../../components/admin/CreditsField.jsx';
import FashionPiecesField from '../../components/admin/FashionPiecesField.jsx';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js';
import { slugify } from '../../lib/slugify.js';
import '../../styles/AdminArtistsPage.css';

const empty = {
	title: '',
	slug: '',
	description: '',
	isVisible: true,
	images: [],
	order: 0,
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
	return Boolean(credit?.creditName?.trim() || credit?.talentId);
}

// Older credits may still have a linked talent. Keep that id while making the
// visible credit name editable as plain text.
function toFormCredits(credits) {
	return (Array.isArray(credits) ? credits : []).map((credit) => ({
		talentId: credit.talentId ?? credit.talent?.id ?? '',
		creditName: credit.creditName ?? credit.talent?.name ?? '',
		roleLabel: credit.roleLabel ?? '',
	}));
}

function toFormPieces(pieces) {
	return (Array.isArray(pieces) ? pieces : []).map((piece) => ({
		id: piece.id,
		name: piece.name ?? '',
		buyUrl: piece.buyUrl ?? '',
		image: piece.image ?? null,
		credits: toFormCredits(piece.credits),
	}));
}

export default function AdminFashionLooksPage() {
	const { token } = useAdminAuth();
	const auth = { Authorization: `Bearer ${token}` };
	const [looks, setLooks] = useState([]);
	const [form, setForm] = useState(null);
	const [draggedId, setDraggedId] = useState(null);
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

	const openCreate = () => setForm({ ...empty });
	const openEdit = async (look) => {
		setLoadingEditId(look.id);
		try {
			const detail = await fetch(`/api/admin/fashion/looks?id=${look.id}`, { headers: auth }).then((r) => r.json());
			setForm({
				...empty,
				...detail,
				images: detail.images ?? [],
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
		setDraggedId(id);
	};

	const handleDragOver = (event, id) => {
		if (!draggedId || draggedId === id) return;
		event.preventDefault();
		setDropTargetId(id);
	};

	const handleDrop = async (id) => {
		if (!draggedId || draggedId === id) {
			setDraggedId(null);
			setDropTargetId(null);
			return;
		}

		const draggedIndex = looks.findIndex((look) => look.id === draggedId);
		const targetIndex = looks.findIndex((look) => look.id === id);
		if (draggedIndex === -1 || targetIndex === -1) {
			setDraggedId(null);
			setDropTargetId(null);
			return;
		}

		const reordered = [...looks];
		const [moved] = reordered.splice(draggedIndex, 1);
		reordered.splice(targetIndex, 0, moved);

		const normalized = reordered.map((look, index) => ({ ...look, order: index }));
		setLooks(normalized);
		primeAdminResource('fashion-looks-list', token, normalized);
		setDraggedId(null);
		setDropTargetId(null);

		const persisted = await persistLookOrder(reordered);
		setLooks(persisted);
		primeAdminResource('fashion-looks-list', token, persisted);
	};

	const handleDragEnd = () => {
		setDraggedId(null);
		setDropTargetId(null);
	};

	const renderDisplayValue = (look, column) => {
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
	};

	return (
		<div>
			<div className="admin-artists-page-sticky-top">
				<div className="admin-artists-page-header">
					<h1 className="admin-artists-page-title">Fashion Looks</h1>
					<button onClick={openCreate} className="admin-artists-page-primary-btn">New Look</button>
				</div>
			</div>

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
								onDragOver={(event) => handleDragOver(event, look.id)}
								onDrop={(event) => {
									event.preventDefault();
									handleDrop(look.id);
								}}
							>
								<td className="admin-artists-page-drag-cell">
									<button
										type="button"
										draggable={!form}
										onDragStart={(event) => handleDragStart(event, look.id)}
										onDragEnd={handleDragEnd}
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
										<button type="button" onClick={() => void openEdit(look)} disabled={loadingEditId === look.id} className="admin-artists-page-ghost-btn admin-artists-page-icon-btn" aria-label="Edit look" title="Edit">
											<FaPencilAlt aria-hidden="true" />
										</button>
										<ConfirmActionButton
											message="Delete this Look and all its pieces and credits?"
											onConfirm={() => handleDelete(look.id)}
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

			{form && (
				<div className="admin-modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) closeForm(); }}>
					<div className="admin-modal">
						<div className="admin-modal-header">
							<h2 className="admin-modal-title">{form.id ? 'Edit Look' : 'New Look'}</h2>
							<button type="button" onClick={closeForm} className="admin-modal-close" aria-label="Close">×</button>
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
													<label className="admin-modal-label">Title</label>
													<input
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
											<label className="admin-modal-label">Lookbook Images</label>
											<ImageCollectionField
												value={form.images}
												onChange={(images) => setForm((current) => ({ ...current, images }))}
												token={token}
												folder="fashion-looks"
												entityLabel={form.title || 'Look image'}
											/>
										</div>

										<div className="admin-modal-field admin-modal-field-full">
											<label className="admin-modal-label">Description (the ideas behind it)</label>
											<textarea
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
											<label className="admin-modal-label">Default Credits</label>
											<CreditsField
												value={form.credits}
												onChange={(credits) => setForm((current) => ({ ...current, credits }))}
												placeholder="Add credit"
											/>
										</div>
									</div>
								</TabPanel>

								<TabPanel header="Pieces">
									<div className="admin-modal-grid">
										<div className="admin-modal-field admin-modal-field-full">
											<label className="admin-modal-label">Pieces</label>
											<FashionPiecesField
												value={form.pieces}
												onChange={(pieces) => setForm((current) => ({ ...current, pieces }))}
												token={token}
												lookTitle={form.title}
											/>
										</div>
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
	);
}
