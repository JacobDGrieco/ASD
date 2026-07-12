import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { FaArchive, FaPencilAlt, FaThumbtack, FaTrash } from 'react-icons/fa';
import BoardMarkdownEditor from '../../components/admin/BoardMarkdownEditor.jsx';
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx';
import AdminDateInput from '../../components/admin/AdminDateInput.jsx';
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js';
import { extractBoardBodyImagePathnames, validateBoardBodyMarkdown } from '../../lib/boardMarkdown.js';
import { ASD_RECORDS_ARTIST_NAME, ASD_RECORDS_ARTIST_OPTION_ID, isAsdRecordsArtist } from '../../lib/publicVisibility.js';
import '../../styles/AdminArtistsPage.css';
import '../../styles/admin-board-page.css';

function todayDateInputValue() {
	return new Date().toISOString().slice(0, 10);
}

const empty = {
	title: '',
	artistId: '',
	body: '',
	images: [],
	pinColor: '',
	expiresAt: '',
	publishMode: 'draft',
	publishAt: todayDateInputValue(),
};
const initialBoardModalState = {
	form: empty,
	editing: null,
	modalOpen: false,
	saving: false,
	validationErrors: {},
	formMessage: '',
};

function boardModalReducer(state, action) {
	switch (action.type) {
		case 'open-create':
			return {
				...state,
				form: action.form,
				editing: null,
				modalOpen: true,
				validationErrors: {},
				formMessage: '',
			};
		case 'open-edit':
			return {
				...state,
				form: action.form,
				editing: action.post,
				modalOpen: true,
				validationErrors: {},
				formMessage: '',
			};
		case 'close':
			return {
				...state,
				form: empty,
				editing: null,
				modalOpen: false,
				validationErrors: {},
				formMessage: '',
				saving: false,
			};
		case 'set-form':
			return {
				...state,
				form: action.updater(state.form),
			};
		case 'set-validation-errors':
			return {
				...state,
				validationErrors: typeof action.updater === 'function'
					? action.updater(state.validationErrors)
					: action.updater,
			};
		case 'set-form-message':
			return {
				...state,
				formMessage: action.message,
			};
		case 'set-saving':
			return {
				...state,
				saving: action.saving,
			};
		default:
			return state;
	}
}

function statusLabel(post) {
	if (post.archivedAt) return 'Archived';
	if (!post.publishedAt) return 'Draft';
	return 'Published';
}

function positionLabel(post) {
	if (post.posX == null) return 'Auto';
	if (!post.positionPinnedUntil) return 'Pinned';
	return `Pinned until ${new Date(post.positionPinnedUntil).toLocaleDateString()}`;
}

function BoardPostModal({
	editing,
	form,
	formMessage,
	validationErrors,
	isSuperAdmin,
	artists,
	token,
	saving,
	pendingBodyImagePathnamesRef,
	setForm,
	setValidationErrors,
	onClose,
	onSave,
}) {
	return (
		<div className="admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<div className="admin-modal">
				<div className="admin-modal-header">
					<h2 className="admin-modal-title">{editing ? 'Edit Post' : 'New Post'}</h2>
					<button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close">x</button>
				</div>
				<div className="admin-modal-body">
					{formMessage ? (
						<div className="admin-board-page-form-message" role="alert">
							{formMessage}
						</div>
					) : null}
					<div className="admin-modal-field admin-modal-field-full">
						<label htmlFor="admin-board-post-title" className="admin-modal-label">Title *</label>
						<input
							id="admin-board-post-title"
							className={`admin-modal-input admin-board-page-text-input${validationErrors.title ? ' admin-board-page-input-invalid' : ''}`}
							value={form.title}
							onChange={(e) => {
								const nextValue = e.target.value;
								setForm((f) => ({ ...f, title: nextValue }));
								if (validationErrors.title) {
									setValidationErrors((current) => {
										const next = { ...current };
										delete next.title;
										return next;
									});
								}
							}}
							placeholder="Post title"
						/>
						{validationErrors.title ? <p className="admin-board-page-field-error">{validationErrors.title}</p> : null}
					</div>
					{isSuperAdmin && (
						<div className="admin-modal-field admin-modal-field-full">
							<label htmlFor="admin-board-post-artist" className="admin-modal-label">Post As</label>
							<select
								id="admin-board-post-artist"
								className={`admin-modal-input admin-board-page-text-input admin-board-page-select-input${validationErrors.artistId ? ' admin-board-page-input-invalid' : ''}`}
								value={form.artistId}
								onChange={(e) => {
									const nextValue = e.target.value;
									setForm((f) => ({ ...f, artistId: nextValue }));
									if (validationErrors.artistId) {
										setValidationErrors((current) => {
											const next = { ...current };
											delete next.artistId;
											return next;
										});
									}
								}}
							>
								<option value="">Select artist</option>
								<option value={ASD_RECORDS_ARTIST_OPTION_ID}>{ASD_RECORDS_ARTIST_NAME}</option>
								{artists.map((artist) => (
									<option key={artist.id} value={artist.id}>{artist.name}</option>
								))}
							</select>
							{validationErrors.artistId ? <p className="admin-board-page-field-error">{validationErrors.artistId}</p> : null}
						</div>
					)}
					<div className="admin-modal-field admin-modal-field-full">
						<BoardMarkdownEditor
							value={form.body}
							onChange={(markdown) => {
								setForm((f) => ({ ...f, body: markdown }));
								if (validationErrors.body) {
									setValidationErrors((current) => {
										const next = { ...current };
										delete next.body;
										return next;
									});
								}
							}}
							token={token}
							entityLabel={form.title || 'Board image'}
							error={validationErrors.body}
							onBodyImageUpload={(pathname) => {
								if (!pendingBodyImagePathnamesRef.current.includes(pathname)) {
									pendingBodyImagePathnamesRef.current = [...pendingBodyImagePathnamesRef.current, pathname];
								}
							}}
							maxImages={1}
							maxLinks={5}
						/>
					</div>
					<div className="admin-modal-field admin-modal-field-full">
						<div className="admin-modal-label">Cover Image</div>
						<ImageCollectionField
							value={form.images}
							onChange={(imgs) => setForm((f) => ({ ...f, images: imgs }))}
							token={token}
							folder="board"
							entityLabel={form.title || 'post'}
						/>
					</div>
					<div className="admin-board-page-settings-row admin-modal-field-full">
						<div className="admin-modal-field admin-board-page-color-field">
							<label htmlFor="admin-board-post-pin-color" className="admin-modal-label">Pin Color</label>
							<input
								id="admin-board-post-pin-color"
								type="color"
								className="admin-modal-input admin-board-page-color-input"
								value={form.pinColor || '#e06060'}
								onChange={(e) => setForm((f) => ({ ...f, pinColor: e.target.value }))}
							/>
						</div>
						<div className="admin-modal-field">
							<label htmlFor="admin-board-post-expires-at" className="admin-modal-label">Expires At</label>
							<AdminDateInput
								id="admin-board-post-expires-at"
								ariaLabel="Post expiration date"
								className="admin-modal-input admin-board-page-date-input"
								value={form.expiresAt}
								onChange={(v) => setForm((f) => ({ ...f, expiresAt: v }))}
							/>
						</div>
					</div>
					<div className="admin-board-page-publish-panel admin-modal-field-full">
						<div className="admin-board-page-publish-header">
							<div className="admin-modal-label">Publishing</div>
							<span className="admin-board-page-publish-summary">
								{form.publishMode === 'draft'
									? 'Save keeps this post as a draft.'
									: form.publishMode === 'publish'
										? 'Save publishes this post immediately.'
										: 'Save schedules this post for the selected date.'}
							</span>
						</div>
						<div className="admin-board-page-publish-options">
							<button
								type="button"
								className={`admin-board-page-publish-option${form.publishMode === 'draft' ? ' admin-board-page-publish-option-active' : ''}`}
								onClick={() => setForm((f) => ({ ...f, publishMode: 'draft' }))}
							>
								Draft
							</button>
							<button
								type="button"
								className={`admin-board-page-publish-option${form.publishMode === 'publish' ? ' admin-board-page-publish-option-active' : ''}`}
								onClick={() => setForm((f) => ({ ...f, publishMode: 'publish' }))}
							>
								Publish Now
							</button>
							<button
								type="button"
								className={`admin-board-page-publish-option${form.publishMode === 'schedule' ? ' admin-board-page-publish-option-active' : ''}`}
								onClick={() => setForm((f) => ({ ...f, publishMode: 'schedule' }))}
							>
								Schedule
							</button>
						</div>
						{form.publishMode === 'schedule' && (
							<div className="admin-modal-field admin-board-page-publish-date-field">
								<label htmlFor="admin-board-post-publish-at" className="admin-modal-label">Publish On</label>
								<AdminDateInput
									id="admin-board-post-publish-at"
									ariaLabel="Post publish date"
									className={`admin-modal-input admin-board-page-date-input${validationErrors.publishAt ? ' admin-board-page-input-invalid' : ''}`}
									value={form.publishAt}
									onChange={(v) => {
										setForm((f) => ({ ...f, publishAt: v }));
										if (validationErrors.publishAt) {
											setValidationErrors((current) => {
												const next = { ...current };
												delete next.publishAt;
												return next;
											});
										}
									}}
								/>
								{validationErrors.publishAt ? <p className="admin-board-page-field-error">{validationErrors.publishAt}</p> : null}
							</div>
						)}
					</div>
				</div>
				<div className="admin-modal-footer">
					<button type="button" className="admin-artists-page-ghost-btn" onClick={onClose}>Cancel</button>
					<button type="button" className="admin-artists-page-primary-btn" onClick={onSave} disabled={saving}>
						{saving
							? 'Saving...'
							: form.publishMode === 'draft'
								? 'Save Draft'
								: form.publishMode === 'publish'
									? 'Publish Post'
									: 'Schedule Post'}
					</button>
				</div>
			</div>
		</div>
	);
}

function BoardPostRow({ post, canEdit, isViewer, isSuperAdmin, onEdit, onArchive, onDelete, onReleasePosition }) {
	return (
		<tr>
			<td className="admin-board-page-col-thumb">
				{post.imageUrl
					? <img src={post.imageUrl} alt={post.title} className="admin-board-page-thumb" />
					: <div className="admin-board-page-thumb-placeholder" />}
			</td>
			<td className="admin-board-page-col-title">{post.title}</td>
			<td className="admin-board-page-col-sm">{post.artist?.name}</td>
			<td className="admin-board-page-col-sm">
				{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : <span className="admin-board-page-badge-draft">Draft</span>}
			</td>
			<td className="admin-board-page-col-sm">
				<span className={`admin-board-page-badge admin-board-page-badge-${statusLabel(post).toLowerCase()}`}>
					{statusLabel(post)}
				</span>
			</td>
			<td className="admin-board-page-col-pos">
				<button
					type="button"
					className={`admin-board-page-pin-btn${post.posX != null ? ' admin-board-page-pin-btn-active' : ''}`}
					onClick={isSuperAdmin && post.posX != null ? () => onReleasePosition(post) : undefined}
					title={post.posX != null ? positionLabel(post) + ' - click to release' : 'Auto-placed'}
					aria-label={post.posX != null ? 'Release pinned board position' : 'Board position is automatic'}
					disabled={!isSuperAdmin || post.posX == null}
				>
					<FaThumbtack aria-hidden="true" />
				</button>
			</td>
			<td className="admin-board-page-col-actions">
				{canEdit && !isViewer && (
					<button
						type="button"
						className="admin-artists-page-ghost-btn admin-artists-page-icon-btn"
						onClick={() => onEdit(post)}
						aria-label="Edit post"
						title="Edit"
					>
						<FaPencilAlt aria-hidden="true" />
					</button>
				)}
				{isSuperAdmin && !post.archivedAt && (
					<button
						type="button"
						className="admin-artists-page-ghost-btn admin-artists-page-icon-btn"
						onClick={() => onArchive(post, true)}
						aria-label="Archive post"
						title="Archive"
					>
						<FaArchive aria-hidden="true" />
					</button>
				)}
				{canEdit && !isViewer && (
					<ConfirmActionButton
						message="Delete this board post?"
						buttonClassName="admin-artists-page-danger-btn admin-artists-page-icon-btn"
						buttonTitle="Delete"
						buttonAriaLabel="Delete post"
						onConfirm={() => onDelete(post)}
					>
						<FaTrash aria-hidden="true" />
					</ConfirmActionButton>
				)}
			</td>
		</tr>
	);
}

function ArchivedBoardPosts({ posts, isOpen, onToggleOpen, onRestore, onDelete }) {
	if (!posts.length) return null;

	return (
		<div className="admin-board-page-archived">
			<button
				type="button"
				className="admin-board-page-archived-toggle"
				onClick={onToggleOpen}
			>
				{isOpen ? 'v' : '>'} Archived ({posts.length})
			</button>
			{isOpen && (
				<div className="admin-board-page-table-wrap">
					<table className="admin-board-page-table">
						<tbody>
							{posts.map((post) => (
								<tr key={post.id}>
									<td className="admin-board-page-col-thumb">
										{post.imageUrl
											? <img src={post.imageUrl} alt={post.title} className="admin-board-page-thumb" />
											: <div className="admin-board-page-thumb-placeholder" />}
									</td>
									<td className="admin-board-page-col-title">{post.title}</td>
									<td className="admin-board-page-col-sm">{post.artist?.name}</td>
									<td colSpan={3} />
									<td className="admin-board-page-col-actions">
										<button
											type="button"
											className="admin-artists-page-ghost-btn"
											onClick={() => onRestore(post)}
										>
											Restore
										</button>
										<ConfirmActionButton
											message="Delete this archived board post?"
											buttonClassName="admin-artists-page-danger-btn admin-artists-page-icon-btn"
											buttonAriaLabel="Delete archived post"
											onConfirm={() => onDelete(post)}
										>
											<FaTrash aria-hidden="true" />
										</ConfirmActionButton>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

function ActiveBoardPostsTable({ posts, isViewer, isSuperAdmin, isArtist, sessionArtistId, onEdit, onArchive, onDelete, onReleasePosition }) {
	return (
		<div className="admin-board-page-table-wrap">
			<table className="admin-board-page-table">
				<thead>
					<tr>
						<th className="admin-board-page-col-thumb" />
						<th className="admin-board-page-col-title">Title</th>
						<th className="admin-board-page-col-sm">Artist</th>
						<th className="admin-board-page-col-sm">Published</th>
						<th className="admin-board-page-col-sm">Status</th>
						<th className="admin-board-page-col-pos">Pin</th>
						<th className="admin-board-page-col-actions">Actions</th>
					</tr>
				</thead>
				<tbody>
					{posts.map((post) => (
						<BoardPostRow
							key={post.id}
							post={post}
							canEdit={isSuperAdmin || (isArtist && post.artistId === sessionArtistId)}
							isViewer={isViewer}
							isSuperAdmin={isSuperAdmin}
							onEdit={onEdit}
							onArchive={onArchive}
							onDelete={onDelete}
							onReleasePosition={onReleasePosition}
						/>
					))}
				</tbody>
			</table>
		</div>
	);
}

export default function AdminMusicBoardPage() {
	const { token, session } = useAdminAuth();
	const isSuperAdmin = session?.role === 'SUPER_ADMIN';
	const isArtist = session?.role === 'ARTIST';
	const isViewer = session?.role === 'VIEWER';

	const [posts, setPosts] = useState([]);
	const [artists, setArtists] = useState([]);
	const [loading, setLoading] = useState(true);
	const [archivedOpen, setArchivedOpen] = useState(false);
	const [boardModalState, dispatchBoardModal] = useReducer(boardModalReducer, initialBoardModalState);
	const { form, editing, modalOpen, saving, validationErrors, formMessage } = boardModalState;
	const pendingBodyImagePathnamesRef = useRef([]);
	const setForm = (updater) => dispatchBoardModal({ type: 'set-form', updater });
	const setValidationErrors = (updater) => dispatchBoardModal({ type: 'set-validation-errors', updater });
	const setFormMessage = (message) => dispatchBoardModal({ type: 'set-form-message', message });
	const setSaving = (saving) => dispatchBoardModal({ type: 'set-saving', saving });

	const activePosts = useMemo(() => posts.filter((p) => !p.archivedAt), [posts]);
	const archivedPosts = useMemo(() => posts.filter((p) => p.archivedAt), [posts]);

	useEffect(() => {
		if (!token) return;

		async function load() {
			setLoading(true);
			const data = await loadAdminResource({
				cacheKey: 'boardPosts',
				url: '/api/admin/board',
				token,
			});
			setPosts(data ?? []);
			setLoading(false);
		}

		void load();
	}, [token]);

	useEffect(() => {
		if (!token || !isSuperAdmin) return;

		let ignore = false;
		loadAdminResource({
			cacheKey: 'artists-list',
			url: '/api/admin/artists',
			token,
		})
			.then((data) => {
				if (!ignore) setArtists(data ?? []);
			})
			.catch(() => {
				if (!ignore) setArtists([]);
			});

		return () => {
			ignore = true;
		};
	}, [isSuperAdmin, token]);

	function openCreate() {
		pendingBodyImagePathnamesRef.current = [];
		dispatchBoardModal({
			type: 'open-create',
			form: {
				...empty,
				artistId: isSuperAdmin ? ASD_RECORDS_ARTIST_OPTION_ID : '',
				publishAt: todayDateInputValue(),
			},
		});
	}

	function openEdit(post) {
		pendingBodyImagePathnamesRef.current = [];
		const publishedAt = post.publishedAt ? new Date(post.publishedAt) : null;
		const publishMode = !publishedAt
			? 'draft'
			: publishedAt > new Date()
				? 'schedule'
				: 'publish';

		dispatchBoardModal({
			type: 'open-edit',
			post,
			form: {
				title: post.title,
				artistId: isAsdRecordsArtist(post.artist) ? ASD_RECORDS_ARTIST_OPTION_ID : post.artistId,
				body: post.body ?? '',
				images: post.imageUrl ? [{ url: post.imageUrl, isPrimary: true }] : [],
				pinColor: post.pinColor ?? '',
				expiresAt: post.expiresAt ? String(post.expiresAt).slice(0, 10) : '',
				publishMode,
				publishAt: post.publishedAt ? String(post.publishedAt).slice(0, 10) : todayDateInputValue(),
			},
		});
	}

	function cleanupBodyImageUploads(pathnames, body, { deleteAll = false } = {}) {
		if (!token) return;

		const uniquePathnames = [...new Set(pathnames)].filter(Boolean);
		if (!uniquePathnames.length) return;

		const referencedPathnames = deleteAll ? new Set() : extractBoardBodyImagePathnames(body);
		const unusedPathnames = uniquePathnames.filter((pathname) => !referencedPathnames.has(pathname));
		if (!unusedPathnames.length) return;

		void fetch('/api/admin/uploads', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify({ pathnames: unusedPathnames }),
		});
	}

	function closeModal({ cleanupUploads = true } = {}) {
		if (cleanupUploads) {
			cleanupBodyImageUploads(pendingBodyImagePathnamesRef.current, form.body, { deleteAll: true });
		}
		dispatchBoardModal({ type: 'close' });
		pendingBodyImagePathnamesRef.current = [];
	}

	async function save() {
		const nextErrors = {};
		if (!form.title.trim()) nextErrors.title = 'Title is required.';
		if (isSuperAdmin && !form.artistId) nextErrors.artistId = 'Choose who this post is from.';
		if (form.publishMode === 'schedule' && !form.publishAt) nextErrors.publishAt = 'Scheduled publish date is required.';
		const bodyError = validateBoardBodyMarkdown(form.body, { maxImages: 1, maxLinks: 5 });
		if (bodyError) nextErrors.body = bodyError;
		if (Object.keys(nextErrors).length > 0) {
			setValidationErrors(nextErrors);
			setFormMessage('');
			return;
		}

		setValidationErrors({});
		setFormMessage('');
		setSaving(true);

		const primaryImage = form.images?.find((img) => img.isPrimary) ?? form.images?.[0];
		const publishedAt = form.publishMode === 'draft'
			? null
			: form.publishMode === 'publish'
				? new Date().toISOString()
				: form.publishAt || null;

		const payload = {
			artistId: isSuperAdmin ? form.artistId : undefined,
			title: form.title,
			headline: form.title,
			body: form.body,
			imageUrl: primaryImage?.url ?? null,
			pinColor: form.pinColor || null,
			expiresAt: form.expiresAt || null,
			publishedAt,
		};

		try {
			let res;
			let updated;
			if (editing) {
				res = await fetch(`/api/admin/board?id=${editing.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify(payload),
				});
				updated = await res.json();
				if (!res.ok) throw new Error(updated.error ?? 'Save failed');
				setPosts((prev) => prev.map((p) => (p.id === editing.id ? updated : p)));
			} else {
				res = await fetch('/api/admin/board', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify(payload),
				});
				updated = await res.json();
				if (!res.ok) throw new Error(updated.error ?? 'Save failed');
				setPosts((prev) => [updated, ...prev]);
			}
			cleanupBodyImageUploads(pendingBodyImagePathnamesRef.current, payload.body);
			primeAdminResource('boardPosts', token, null);
			closeModal({ cleanupUploads: false });
		} catch (err) {
			setFormMessage(err.message);
		} finally {
			setSaving(false);
		}
	}

	async function deletePost(post) {
		const res = await fetch(`/api/admin/board?id=${post.id}`, {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${token}` },
		});
		if (res.ok) {
			setPosts((prev) => prev.filter((p) => p.id !== post.id));
			primeAdminResource('boardPosts', token, null);
		}
	}

	async function toggleArchive(post, archive) {
		const res = await fetch(`/api/admin/board?id=${post.id}&action=archive`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify({ archive }),
		});
		if (res.ok) {
			const updated = await res.json();
			setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
			primeAdminResource('boardPosts', token, null);
		}
	}

	async function releasePosition(post) {
		const res = await fetch(`/api/admin/board?id=${post.id}&action=position`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify({ posX: null, posY: null, rotation: null, positionPinnedUntil: null }),
		});
		if (res.ok) {
			const updated = await res.json();
			setPosts((prev) => prev.map((p) => (p.id === post.id ? updated : p)));
		}
	}


	return (
		<div className="admin-board-page">
			<div className="admin-artists-page-header">
				<h1 className="admin-artists-page-title">The Board</h1>
				{(isArtist || isSuperAdmin) && (
					<button type="button" className="admin-artists-page-primary-btn" onClick={openCreate}>
						New Post
					</button>
				)}
			</div>

			{loading ? (
				<p className="admin-board-page-loading">Loading posts...</p>
			) : (
                <ActiveBoardPostsTable
                    posts={activePosts}
                    isViewer={isViewer}
                    isSuperAdmin={isSuperAdmin}
                    isArtist={isArtist}
                    sessionArtistId={session?.artistId}
                    onEdit={openEdit}
                    onArchive={toggleArchive}
                    onDelete={deletePost}
                    onReleasePosition={releasePosition}
                />
			)}

            {isSuperAdmin && (
                <ArchivedBoardPosts
                    posts={archivedPosts}
                    isOpen={archivedOpen}
                    onToggleOpen={() => setArchivedOpen((value) => !value)}
                    onRestore={(post) => toggleArchive(post, false)}
                    onDelete={deletePost}
                />
            )}

            {modalOpen && (
                <BoardPostModal
                    editing={editing}
                    form={form}
                    formMessage={formMessage}
                    validationErrors={validationErrors}
                    isSuperAdmin={isSuperAdmin}
                    artists={artists}
                    token={token}
                    saving={saving}
                    pendingBodyImagePathnamesRef={pendingBodyImagePathnamesRef}
                    setForm={setForm}
                    setValidationErrors={setValidationErrors}
                    onClose={closeModal}
                    onSave={save}
                />
            )}
		</div>
	);
}
