import { useEffect, useMemo, useState } from 'react';
import { FaExternalLinkAlt, FaEye, FaEyeSlash, FaPencilAlt, FaPlus, FaSyncAlt, FaTrash } from 'react-icons/fa';
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx';
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js';
import { CROSSHAIR_VIDEO_TYPE, CROSSHAIR_VIDEO_TYPE_OPTIONS, validateCrosshairVideoInput } from '../../lib/crosshairVideos.js';
import '../../styles/AdminArtistsPage.css';
import '../../styles/AdminCrosshairPage.css';

const emptyForm = {
	title: '',
	description: '',
	type: CROSSHAIR_VIDEO_TYPE.UNCUT,
	youtubeUrl: '',
	thumbnailImage: [],
	isVisible: true,
	publishedAt: '',
};

function dateInputValue(value) {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return date.toISOString().slice(0, 10);
}

function formatDate(value) {
	if (!value) return 'Unscheduled';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'Invalid date';
	return date.toLocaleDateString();
}

function toThumbnailImage(row) {
	if (!row.customThumbnailUrl && !row.thumbnailPathname) return [];
	return [{
		url: row.customThumbnailUrl,
		pathname: row.thumbnailPathname,
		previewUrl: row.customThumbnailUrl,
		usage: 'thumbnail',
		altText: row.title,
		isPrimary: true,
	}];
}

function rowToForm(row) {
	return {
		title: row.title ?? '',
		description: row.description ?? '',
		type: row.type ?? CROSSHAIR_VIDEO_TYPE.UNCUT,
		youtubeUrl: row.youtubeUrl ?? '',
		thumbnailImage: toThumbnailImage(row),
		isVisible: row.isVisible !== false,
		publishedAt: dateInputValue(row.publishedAt),
	};
}

function buildPayload(form) {
	const thumbnailImage = Array.isArray(form.thumbnailImage) ? form.thumbnailImage[0] ?? null : null;
	return {
		title: form.title,
		description: form.description,
		type: form.type,
		youtubeUrl: form.youtubeUrl,
		thumbnailUrl: thumbnailImage?.url ?? null,
		thumbnailPathname: thumbnailImage?.pathname ?? null,
		isVisible: Boolean(form.isVisible),
		publishedAt: form.publishedAt || null,
	};
}

export default function AdminMusicCrosshairPage() {
	const { token, session } = useAdminAuth();
	const auth = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
	const isSuperAdmin = session?.role === 'SUPER_ADMIN';
	const [videos, setVideos] = useState([]);
	const [loading, setLoading] = useState(true);
	const [form, setForm] = useState(emptyForm);
	const [editing, setEditing] = useState(null);
	const [modalOpen, setModalOpen] = useState(false);
	const [saving, setSaving] = useState(false);
	const [syncing, setSyncing] = useState(false);
	const [syncConfig, setSyncConfig] = useState(null);
	const [message, setMessage] = useState('');

	const sortedVideos = useMemo(() => videos.toSorted((left, right) => {
		const leftDate = left.publishedAt ?? left.createdAt ?? 0;
		const rightDate = right.publishedAt ?? right.createdAt ?? 0;
		return new Date(rightDate) - new Date(leftDate);
	}), [videos]);

	useEffect(() => {
		if (!token || !isSuperAdmin) return;
		let ignore = false;
		setLoading(true);
		loadAdminResource({ cacheKey: 'crosshair-videos', url: '/api/admin/crosshair', token })
			.then((data) => {
				if (!ignore) setVideos(data ?? []);
			})
			.catch((error) => {
				if (!ignore) setMessage(error.message);
			})
			.finally(() => {
				if (!ignore) setLoading(false);
			});

		return () => {
			ignore = true;
		};
	}, [isSuperAdmin, token]);

	useEffect(() => {
		if (!token || !isSuperAdmin) return;
		let ignore = false;
		fetch('/api/admin/crosshair?action=config', { headers: auth })
			.then((response) => response.ok ? response.json() : null)
			.then((data) => {
				if (!ignore) setSyncConfig(data);
			})
			.catch(() => {
				if (!ignore) setSyncConfig(null);
			});

		return () => {
			ignore = true;
		};
	}, [auth, isSuperAdmin, token]);

	function openCreate() {
		setForm(emptyForm);
		setEditing(null);
		setMessage('');
		setModalOpen(true);
	}

	function openEdit(video) {
		setForm(rowToForm(video));
		setEditing(video);
		setMessage('');
		setModalOpen(true);
	}

	function closeModal() {
		setModalOpen(false);
		setEditing(null);
		setForm(emptyForm);
		setMessage('');
	}

	async function save() {
		const payload = buildPayload(form);
		const validationError = validateCrosshairVideoInput({
			...payload,
			publishedAt: payload.publishedAt ? new Date(payload.publishedAt) : null,
		});
		if (validationError) {
			setMessage(validationError);
			return;
		}

		setSaving(true);
		setMessage('');

		try {
			const url = editing ? `/api/admin/crosshair?id=${encodeURIComponent(editing.id)}` : '/api/admin/crosshair';
			const response = await fetch(url, {
				method: editing ? 'PUT' : 'POST',
				headers: { ...auth, 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const result = await response.json().catch(() => null);
			if (!response.ok) throw new Error(result?.error ?? 'Failed to save Crosshair video.');

			const nextVideos = editing
				? videos.map((video) => (video.id === result.id ? result : video))
				: [result, ...videos];
			setVideos(nextVideos);
			primeAdminResource('crosshair-videos', token, nextVideos);
			closeModal();
		} catch (error) {
			setMessage(error.message);
		} finally {
			setSaving(false);
		}
	}

	async function refreshVideos() {
		const response = await fetch('/api/admin/crosshair', { headers: auth });
		const data = await response.json();
		if (!response.ok) throw new Error(data?.error ?? 'Failed to refresh Crosshair videos.');
		setVideos(data ?? []);
		primeAdminResource('crosshair-videos', token, data ?? []);
	}

	async function syncYouTube() {
		setSyncing(true);
		setMessage('');

		try {
			const response = await fetch('/api/admin/crosshair?action=sync', {
				method: 'POST',
				headers: { ...auth, 'Content-Type': 'application/json' },
				body: JSON.stringify({ mode: 'auto' }),
			});
			const result = await response.json().catch(() => null);
			if (!response.ok) throw new Error(result?.error ?? 'YouTube sync failed.');

			await refreshVideos();
			const modeLabel = result.mode === 'oauth' ? 'OAuth' : 'public API';
			setMessage(`Synced ${result.saved} Crosshair videos from ${result.channelTitle} using ${modeLabel}.`);
		} catch (error) {
			setMessage(error.message);
		} finally {
			setSyncing(false);
		}
	}

	async function deleteVideo(video) {
		const response = await fetch(`/api/admin/crosshair?id=${encodeURIComponent(video.id)}`, {
			method: 'DELETE',
			headers: auth,
		});
		if (!response.ok) {
			setMessage('Failed to delete Crosshair video.');
			return;
		}
		const nextVideos = videos.filter((candidate) => candidate.id !== video.id);
		setVideos(nextVideos);
		primeAdminResource('crosshair-videos', token, nextVideos);
	}

	if (!isSuperAdmin) {
		return (
			<div className="admin-crosshair-page">
				<h1 className="admin-artists-page-title">Music — Crosshair</h1>
				<p className="admin-crosshair-page-note">Only super admins can manage Crosshair videos.</p>
			</div>
		);
	}

	return (
		<div className="admin-crosshair-page">
			<div className="admin-artists-page-sticky-top">
				<div className="admin-artists-page-header">
					<h1 className="admin-artists-page-title">Music — The Crosshair</h1>
					<div className="admin-crosshair-page-header-actions">
						<button
							type="button"
							className="admin-artists-page-ghost-btn admin-crosshair-page-new-btn"
							onClick={syncYouTube}
							disabled={syncing || !syncConfig || (!syncConfig.publicApiConfigured && !syncConfig.oauthConfigured)}
						>
							<FaSyncAlt aria-hidden="true" /> {syncing ? 'Syncing...' : 'Sync YouTube'}
						</button>
						<button type="button" className="admin-artists-page-primary-btn admin-crosshair-page-new-btn" onClick={openCreate}>
							<FaPlus aria-hidden="true" /> New Video
						</button>
					</div>
				</div>
			</div>

			<p className="admin-crosshair-page-note">
				Sync public channel uploads with a YouTube API key, sync unlisted uploads with OAuth credentials, or add manual entries here. Manual edits are preserved on future syncs.
			</p>
			{message && !modalOpen && <p className="admin-crosshair-page-message" role="alert">{message}</p>}

			{loading ? (
				<p className="admin-crosshair-page-note">Loading videos...</p>
			) : (
				<div className="admin-artists-page-table-wrap">
					<table className="admin-artists-page-table admin-crosshair-page-table">
						<thead>
							<tr>
								<th className="admin-artists-page-col-image">Thumb</th>
								<th className="admin-artists-page-col-xxl">Title</th>
								<th className="admin-artists-page-col-lg">Publish</th>
								<th className="admin-artists-page-col-md">Type</th>
								<th className="admin-artists-page-col-action admin-artists-page-center-cell">Video</th>
								<th className="admin-artists-page-action-cell admin-artists-page-actions-col admin-artists-page-sticky-right-0"></th>
							</tr>
						</thead>
						<tbody>
							{sortedVideos.map((video) => (
								<tr key={video.id} className={video.isVisible ? '' : 'admin-crosshair-page-hidden-row'}>
									<td className="admin-artists-page-center-cell">
										{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" className="admin-artists-page-thumb" /> : <span className="admin-artists-page-empty-value">-</span>}
									</td>
									<td>
										<span className="admin-artists-page-cell-value">{video.title}</span>
										{video.description && <span className="admin-crosshair-page-description">{video.description}</span>}
									</td>
									<td><span className="admin-artists-page-cell-value">{formatDate(video.publishedAt)}</span></td>
									<td><span className="admin-artists-page-cell-value">{video.typeLabel}</span></td>
									<td className="admin-artists-page-center-cell">
										<a href={video.youtubeUrl} target="_blank" rel="noreferrer" className="admin-artists-page-link-btn" aria-label="Open YouTube video" title="Open YouTube video">
											<FaExternalLinkAlt aria-hidden="true" />
										</a>
									</td>
									<td className="admin-artists-page-action-cell admin-artists-page-actions-col admin-artists-page-sticky-right-0">
										<div className="admin-artists-page-actions">
											<button type="button" onClick={() => openEdit(video)} className="admin-artists-page-ghost-btn admin-artists-page-icon-btn" aria-label="Edit video" title="Edit">
												<FaPencilAlt aria-hidden="true" />
											</button>
											<ConfirmActionButton
												message="Delete this Crosshair video?"
												buttonClassName="admin-artists-page-danger-btn admin-artists-page-icon-btn"
												buttonTitle="Delete"
												buttonAriaLabel="Delete video"
												onConfirm={() => deleteVideo(video)}
											>
												<FaTrash aria-hidden="true" />
											</ConfirmActionButton>
										</div>
									</td>
								</tr>
							))}
							{!sortedVideos.length && (
								<tr>
									<td colSpan={7} className="admin-crosshair-page-empty">No Crosshair videos yet.</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			)}

			{modalOpen && (
				<div className="admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
					<div className="admin-modal admin-crosshair-page-modal">
						<div className="admin-modal-header">
							<h2 className="admin-modal-title">{editing ? 'Edit Crosshair Video' : 'New Crosshair Video'}</h2>
							<button type="button" onClick={closeModal} className="admin-modal-close" aria-label="Close">x</button>
						</div>
						<div className="admin-modal-body">
							{message && <p className="admin-crosshair-page-message" role="alert">{message}</p>}
							<div className="admin-crosshair-page-form-grid">
								<div className="admin-modal-field admin-modal-field-full admin-crosshair-page-title-row">
									<div className="admin-artists-page-name-field">
										<button
											type="button"
											onClick={() => setForm((current) => ({ ...current, isVisible: !current.isVisible }))}
											className={`admin-artists-page-visibility-toggle ${form.isVisible ? '' : 'admin-artists-page-visibility-toggle-hidden'}`.trim()}
											aria-label={form.isVisible ? 'Crosshair video is visible to the public. Click to hide.' : 'Crosshair video is hidden from the public. Click to show.'}
											title={form.isVisible ? 'Visible on public site' : 'Hidden from public site'}
										>
											{form.isVisible ? <FaEye aria-hidden="true" /> : <FaEyeSlash aria-hidden="true" />}
										</button>
										<div className="admin-artists-page-name-field-main">
											<label htmlFor="admin-crosshair-title" className="admin-modal-label">Title *</label>
											<input id="admin-crosshair-title" type="text" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="admin-artists-page-input" />
										</div>
									</div>
								</div>
								<div className="admin-modal-field admin-modal-field-full admin-crosshair-page-thumbnail-row">
									<div className="admin-modal-label">Custom Thumbnail</div>
									<ImageCollectionField
										value={form.thumbnailImage}
										onChange={(images) => setForm((current) => ({ ...current, thumbnailImage: images.slice(0, 1) }))}
										token={token}
										folder="crosshair"
										entityLabel={form.title || 'Crosshair thumbnail'}
									/>
								</div>
								<div className="admin-modal-field admin-crosshair-page-half-field">
									<label htmlFor="admin-crosshair-type" className="admin-modal-label">Type</label>
									<select id="admin-crosshair-type" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} className="admin-artists-page-input">
										{CROSSHAIR_VIDEO_TYPE_OPTIONS.map((option) => (
											<option key={option.value} value={option.value}>{option.label}</option>
										))}
									</select>
								</div>
								<div className="admin-modal-field admin-crosshair-page-half-field">
									<label htmlFor="admin-crosshair-publish-date" className="admin-modal-label">Publish Date</label>
									<input id="admin-crosshair-publish-date" type="date" value={form.publishedAt} onChange={(event) => setForm((current) => ({ ...current, publishedAt: event.target.value }))} className="admin-artists-page-input" />
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label htmlFor="admin-crosshair-description" className="admin-modal-label">Description</label>
									<textarea id="admin-crosshair-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="admin-artists-page-input admin-modal-textarea admin-crosshair-page-description-input" rows={5} />
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label htmlFor="admin-crosshair-youtube-url" className="admin-modal-label">YouTube URL *</label>
									<input id="admin-crosshair-youtube-url" type="url" value={form.youtubeUrl} onChange={(event) => setForm((current) => ({ ...current, youtubeUrl: event.target.value }))} className="admin-artists-page-input" placeholder="https://www.youtube.com/watch?v=..." />
								</div>
							</div>
						</div>
						<div className="admin-modal-footer">
							<button type="button" onClick={closeModal} className="admin-artists-page-ghost-btn">Cancel</button>
							<button type="button" onClick={save} className="admin-artists-page-primary-btn" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
