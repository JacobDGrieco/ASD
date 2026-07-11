import { useEffect, useRef, useState } from 'react';
import { FaApple, FaExternalLinkAlt, FaEye, FaEyeSlash, FaPencilAlt, FaSoundcloud, FaSpotify, FaTrash, FaYoutube } from 'react-icons/fa';
import { TabPanel, TabView } from 'primereact/tabview';
import { SiFacebook, SiInstagram, SiSnapchat, SiTiktok, SiX, SiYoutube } from 'react-icons/si';
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx';
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js';
import { slugify } from '../../lib/slugify.js';
import '../../styles/AdminArtistsPage.css';

const empty = {
	name: '',
	slug: '',
	isVisible: true,
	bio: '',
	aboutMe: '',
	images: [],
	order: 0,
	soundcloudProfile: '',
	spotifyProfile: '',
	appleMusicProfile: '',
	youtubeProfile: '',
	instagramProfile: '',
	twitterProfile: '',
	facebookProfile: '',
	tiktokProfile: '',
	snapchatProfile: '',
	youtubeSocialProfile: '',
};

function iconLabel(icon, text) {
	return (
		<span className="admin-modal-label-with-icon">
			<span className="admin-modal-label-icon" aria-hidden="true">{icon}</span>
			<span>{text}</span>
		</span>
	);
}

const columns = [
	{ key: 'images', label: 'Images', kind: 'images', className: 'admin-artists-page-col-image' },
	{ key: 'name', label: 'Name', placeholder: 'Name', className: 'admin-artists-page-col-lg' },
	{ key: 'soundcloudProfile', label: <FaSoundcloud />, headerLabel: 'SoundCloud', placeholder: 'SoundCloud URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
	{ key: 'spotifyProfile', label: <FaSpotify />, headerLabel: 'Spotify', placeholder: 'Spotify URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
	{ key: 'appleMusicProfile', label: <FaApple />, headerLabel: 'Apple Music', placeholder: 'Apple Music URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
	{ key: 'youtubeProfile', label: <FaYoutube />, headerLabel: 'YouTube Music', placeholder: 'YouTube Music URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
	{ key: 'instagramProfile', label: <SiInstagram />, headerLabel: 'Instagram', placeholder: 'Instagram URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
	{ key: 'twitterProfile', label: <SiX />, headerLabel: 'X', placeholder: 'X URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
	{ key: 'facebookProfile', label: <SiFacebook />, headerLabel: 'Facebook', placeholder: 'Facebook URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
	{ key: 'tiktokProfile', label: <SiTiktok />, headerLabel: 'TikTok', placeholder: 'TikTok URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
	{ key: 'snapchatProfile', label: <SiSnapchat />, headerLabel: 'Snapchat', placeholder: 'Snapchat URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
	{ key: 'youtubeSocialProfile', label: <SiYoutube />, headerLabel: 'YouTube Social', placeholder: 'YouTube Social URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell` },
];

function primaryImage(images) {
	if (!Array.isArray(images) || images.length === 0) return null;
	return images.find((image) => image.isPrimary) ?? images[0];
}

function validateArtistForm(form) {
	if (!form.name?.trim()) return 'Artist name is required.';
	return null;
}

function isArtistHidden(artist) {
	return artist?.isVisible === false;
}

export default function AdminMusicArtistsPage() {
	const { token, session } = useAdminAuth();
	const isSuperAdmin = session?.role !== 'ARTIST';
	const isViewer = session?.role === 'VIEWER';
	const auth = { Authorization: `Bearer ${token}` };
	const [artists, setArtists] = useState([]);
	const [form, setForm] = useState(null);
	const draggedArtistIdRef = useRef(null);
	const [dropTargetId, setDropTargetId] = useState(null);
	const [loadingEditId, setLoadingEditId] = useState(null);

	useEffect(() => {
		let ignore = false;

		loadAdminResource({ cacheKey: 'artists-list', url: '/api/admin/artists', token })
			.then((artistList) => {
				if (!ignore) setArtists(artistList);
			});

		return () => {
			ignore = true;
		};
	}, [token]);

	const openCreate = () => setForm({ ...empty });
	const openEdit = async (artist) => {
		setLoadingEditId(artist.id);
		try {
			const detail = await fetch(`/api/admin/artists?id=${artist.id}`, { headers: auth }).then((r) => r.json());
			setForm({ ...empty, ...detail, images: detail.images ?? [] });
		} finally {
			setLoadingEditId(null);
		}
	};
	const closeForm = () => setForm(null);
	const nextOrder = artists.reduce((maxOrder, artist) => Math.max(maxOrder, artist.order ?? 0), -1) + 1;

	const handleSave = async () => {
		const validationError = validateArtistForm(form);
		if (validationError) {
			window.alert(validationError);
			return;
		}

		const isEdit = Boolean(form.id);
		const url = isEdit ? `/api/admin/artists?id=${form.id}` : '/api/admin/artists';
		const payload = {
			...form,
			slug: slugify(form.name),
			...(isEdit ? {} : { order: nextOrder }),
		};
		const res = await fetch(url, {
			method: isEdit ? 'PUT' : 'POST',
			headers: { ...auth, 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		if (!res.ok) {
			const error = await res.json().catch(() => ({ error: 'Failed to save artist.' }));
			window.alert(error.error ?? 'Failed to save artist.');
			return;
		}
		const saved = await res.json();
		const nextArtists = isEdit ? artists.map((artist) => (artist.id === saved.id ? saved : artist)) : [...artists, saved];
		setArtists(nextArtists);
		primeAdminResource('artists-list', token, nextArtists);
		closeForm();
	};

	const handleDelete = async (id) => {
		await fetch(`/api/admin/artists?id=${id}`, { method: 'DELETE', headers: auth });
		const nextArtists = artists.filter((artist) => artist.id !== id);
		setArtists(nextArtists);
		primeAdminResource('artists-list', token, nextArtists);
	};

	const persistArtistOrder = async (nextArtists) => {
		const changedArtists = nextArtists.filter((artist, index) => artist.order !== index);
		if (!changedArtists.length) return nextArtists;

		const savedArtists = await Promise.all(
			changedArtists.map((artist) => {
				const nextOrderValue = nextArtists.findIndex((candidate) => candidate.id === artist.id);
				return fetch(`/api/admin/artists?id=${artist.id}`, {
					method: 'PUT',
					headers: { ...auth, 'Content-Type': 'application/json' },
					body: JSON.stringify({ order: nextOrderValue }),
				}).then((res) => res.json());
			})
		);

		const savedById = new Map(savedArtists.map((artist) => [artist.id, artist]));
		return nextArtists.map((artist, index) => savedById.get(artist.id) ?? { ...artist, order: index });
	};

	const handleDragStart = (event, artistId) => {
		if (form) return;
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('text/plain', artistId);
		draggedArtistIdRef.current = artistId;
	};

	const handleDragOver = (event, artistId) => {
		if (!draggedArtistIdRef.current || draggedArtistIdRef.current === artistId) return;
		event.preventDefault();
		setDropTargetId(artistId);
	};

	const handleDrop = async (artistId) => {
		if (!draggedArtistIdRef.current || draggedArtistIdRef.current === artistId) {
			draggedArtistIdRef.current = null;
			setDropTargetId(null);
			return;
		}

		const draggedIndex = artists.findIndex((artist) => artist.id === draggedArtistIdRef.current);
		const targetIndex = artists.findIndex((artist) => artist.id === artistId);
		if (draggedIndex === -1 || targetIndex === -1) {
			draggedArtistIdRef.current = null;
			setDropTargetId(null);
			return;
		}

		const reordered = [...artists];
		const [movedArtist] = reordered.splice(draggedIndex, 1);
		reordered.splice(targetIndex, 0, movedArtist);

		const normalized = reordered.map((artist, index) => ({ ...artist, order: index }));
		setArtists(normalized);
		primeAdminResource('artists-list', token, normalized);
		draggedArtistIdRef.current = null;
		setDropTargetId(null);

		const persisted = await persistArtistOrder(reordered);
		setArtists(persisted);
		primeAdminResource('artists-list', token, persisted);
	};

	const handleDragEnd = () => {
		draggedArtistIdRef.current = null;
		setDropTargetId(null);
	};

	const renderDisplayValue = (artist, column) => {
		const value = artist[column.key];
		if (column.kind === 'images') {
			const image = primaryImage(artist.images);
			if (!image) return <span className="admin-artists-page-empty-value">-</span>;
			return (
				<div className="admin-artists-page-image-summary">
					<div className={`admin-artists-page-thumb-frame ${isArtistHidden(artist) ? 'admin-artists-page-thumb-frame-hidden' : ''}`.trim()}>
						<img src={image.previewUrl || image.url} alt={artist.name} className="admin-artists-page-thumb" />
					</div>
					<span className="admin-artists-page-image-count">{artist.imageCount ?? artist.images?.length ?? 1} image{(artist.imageCount ?? artist.images?.length ?? 1) === 1 ? '' : 's'}</span>
				</div>
			);
		}
		if (value === null || value === undefined || value === '') return <span className="admin-artists-page-empty-value">-</span>;
		if (column.kind === 'link') {
			return (
				<a href={String(value)} target="_blank" rel="noreferrer" className="admin-artists-page-link-btn" aria-label={`Open ${column.headerLabel} link`} title="Open in new tab">
					<FaExternalLinkAlt aria-hidden="true" />
				</a>
			);
		}
		return (
			<span className={column.valueClassName ?? 'admin-artists-page-cell-value'} title={String(value)}>
				{String(value)}
			</span>
		);
	};

	const renderHeader = (column) => {
		if (column.kind !== 'link') return column.label;
		return (
			<span className="admin-artists-page-social-header" title={column.headerLabel}>
				<span aria-hidden="true">{column.label}</span>
				<span className="admin-artists-page-sr-only">{column.headerLabel}</span>
			</span>
		);
	};

	return (
		<div>
			<div className="admin-artists-page-sticky-top">
				<div className="admin-artists-page-header">
					<h1 className="admin-artists-page-title">Music — Artists</h1>
					{isSuperAdmin && !isViewer && <button type="button" onClick={openCreate} className="admin-artists-page-primary-btn">New Artist</button>}
				</div>
			</div>

			<div className="admin-artists-page-table-wrap">
				<table className="admin-artists-page-table">
					<thead>
						<tr>
							{isSuperAdmin && !isViewer && <th className="admin-artists-page-drag-header"></th>}
							{columns.map((column) => <th key={column.key} className={column.className}>{renderHeader(column)}</th>)}
							<th className="admin-artists-page-actions-col admin-artists-page-sticky-right-0"></th>
						</tr>
					</thead>
					<tbody>
						{artists.map((artist) => (
							<tr
								key={artist.id}
								className={[
									dropTargetId === artist.id ? 'admin-artists-page-drop-target-row' : '',
									isArtistHidden(artist) ? 'admin-artists-page-hidden-row' : '',
								].filter(Boolean).join(' ')}
								onDragOver={(event) => handleDragOver(event, artist.id)}
								onDrop={(event) => {
									event.preventDefault();
									handleDrop(artist.id);
								}}
							>
								{isSuperAdmin && !isViewer && (
									<td className="admin-artists-page-drag-cell">
										<button
											type="button"
											draggable={!form}
											onDragStart={(event) => handleDragStart(event, artist.id)}
											onDragEnd={handleDragEnd}
											className="admin-artists-page-drag-handle"
											aria-label={`Reorder ${artist.name}`}
											title="Drag to reorder"
										>
											::
										</button>
									</td>
								)}
								{columns.map((column) => (
									<td key={column.key} className={column.className ?? ''}>
										{renderDisplayValue(artist, column)}
									</td>
								))}
								<td className="admin-artists-page-action-cell admin-artists-page-actions-col admin-artists-page-sticky-right-0">
									<div className="admin-artists-page-actions">
										{!isViewer && (
											<button type="button" onClick={() => void openEdit(artist)} disabled={loadingEditId === artist.id} className="admin-artists-page-ghost-btn admin-artists-page-icon-btn" aria-label="Edit artist" title="Edit">
												<FaPencilAlt aria-hidden="true" />
											</button>
										)}
										{isSuperAdmin && !isViewer && (
											<ConfirmActionButton
												message="Delete this artist and all their albums/songs?"
												onConfirm={() => handleDelete(artist.id)}
												buttonClassName="admin-artists-page-danger-btn admin-artists-page-icon-btn"
												buttonAriaLabel="Delete artist"
												buttonTitle="Delete"
											>
												<FaTrash aria-hidden="true" />
											</ConfirmActionButton>
										)}
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
							<h2 className="admin-modal-title">{form.id ? 'Edit Artist' : 'New Artist'}</h2>
							<button type="button" onClick={closeForm} className="admin-modal-close" aria-label="Close">×</button>
						</div>
						<div className="admin-modal-body">
							<TabView className="page-tabview admin-modal-tabs">
								<TabPanel header="Artist">
									<div className="admin-modal-grid">
										<div className="admin-modal-field admin-modal-field-full">
											<div className="admin-artists-page-name-field">
												<button
													type="button"
													onClick={() => setForm((current) => ({ ...current, isVisible: !current.isVisible }))}
													className={`admin-artists-page-visibility-toggle ${form.isVisible ? '' : 'admin-artists-page-visibility-toggle-hidden'}`.trim()}
													aria-label={form.isVisible ? 'Artist is visible to the public. Click to hide.' : 'Artist is hidden from the public. Click to show.'}
													title={form.isVisible ? 'Visible on public site' : 'Hidden from public site'}
												>
													{form.isVisible ? <FaEye aria-hidden="true" /> : <FaEyeSlash aria-hidden="true" />}
												</button>
												<div className="admin-artists-page-name-field-main">
													<label htmlFor="admin-music-artist-name" className="admin-modal-label">Name</label>
													<input
														id="admin-music-artist-name"
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
												folder="artists"
												entityLabel={form.name || 'Artist image'}
											/>
										</div>
										<div className="admin-modal-field admin-modal-field-full">
											<label htmlFor="admin-music-artist-bio" className="admin-modal-label">Bio</label>
											<textarea
												id="admin-music-artist-bio"
												placeholder="Bio"
												value={form.bio}
												onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
												className="admin-artists-page-input admin-modal-textarea"
												rows={5}
											/>
										</div>
										<div className="admin-modal-field admin-modal-field-full">
											<label htmlFor="admin-music-artist-about-me" className="admin-modal-label">About Me</label>
											<textarea
												id="admin-music-artist-about-me"
												placeholder="About Me"
												value={form.aboutMe}
												onChange={(event) => setForm((current) => ({ ...current, aboutMe: event.target.value }))}
												className="admin-artists-page-input admin-modal-textarea"
												rows={5}
											/>
										</div>
									</div>
								</TabPanel>
								<TabPanel header="Links">
									<div className="admin-modal-grid">
										<div className="admin-modal-field admin-modal-field-full">
											<label className="admin-modal-label">{iconLabel(<FaSoundcloud />, 'SoundCloud URL')}</label>
											<input type="url" placeholder="SoundCloud URL" value={form.soundcloudProfile} onChange={(event) => setForm((current) => ({ ...current, soundcloudProfile: event.target.value }))} className="admin-artists-page-input" />
										</div>
										<div className="admin-modal-field admin-modal-field-full">
											<label className="admin-modal-label">{iconLabel(<FaSpotify />, 'Spotify URL')}</label>
											<input type="url" placeholder="Spotify URL" value={form.spotifyProfile} onChange={(event) => setForm((current) => ({ ...current, spotifyProfile: event.target.value }))} className="admin-artists-page-input" />
										</div>
										<div className="admin-modal-field admin-modal-field-full">
											<label className="admin-modal-label">{iconLabel(<FaApple />, 'Apple Music URL')}</label>
											<input type="url" placeholder="Apple Music URL" value={form.appleMusicProfile} onChange={(event) => setForm((current) => ({ ...current, appleMusicProfile: event.target.value }))} className="admin-artists-page-input" />
										</div>
										<div className="admin-modal-field admin-modal-field-full">
											<label className="admin-modal-label">{iconLabel(<FaYoutube />, 'YouTube Music URL')}</label>
											<input type="url" placeholder="YouTube Music URL" value={form.youtubeProfile} onChange={(event) => setForm((current) => ({ ...current, youtubeProfile: event.target.value }))} className="admin-artists-page-input" />
										</div>
										<div className="admin-modal-field admin-modal-field-full">
											<label className="admin-modal-label">{iconLabel(<SiInstagram />, 'Instagram URL')}</label>
											<input type="url" placeholder="Instagram URL" value={form.instagramProfile} onChange={(event) => setForm((current) => ({ ...current, instagramProfile: event.target.value }))} className="admin-artists-page-input" />
										</div>
										<div className="admin-modal-field admin-modal-field-full">
											<label className="admin-modal-label">{iconLabel(<SiX />, 'X URL')}</label>
											<input type="url" placeholder="X URL" value={form.twitterProfile} onChange={(event) => setForm((current) => ({ ...current, twitterProfile: event.target.value }))} className="admin-artists-page-input" />
										</div>
										<div className="admin-modal-field admin-modal-field-full">
											<label className="admin-modal-label">{iconLabel(<SiFacebook />, 'Facebook URL')}</label>
											<input type="url" placeholder="Facebook URL" value={form.facebookProfile} onChange={(event) => setForm((current) => ({ ...current, facebookProfile: event.target.value }))} className="admin-artists-page-input" />
										</div>
										<div className="admin-modal-field admin-modal-field-full">
											<label className="admin-modal-label">{iconLabel(<SiTiktok />, 'TikTok URL')}</label>
											<input type="url" placeholder="TikTok URL" value={form.tiktokProfile} onChange={(event) => setForm((current) => ({ ...current, tiktokProfile: event.target.value }))} className="admin-artists-page-input" />
										</div>
										<div className="admin-modal-field admin-modal-field-full">
											<label className="admin-modal-label">{iconLabel(<SiSnapchat />, 'Snapchat URL')}</label>
											<input type="url" placeholder="Snapchat URL" value={form.snapchatProfile} onChange={(event) => setForm((current) => ({ ...current, snapchatProfile: event.target.value }))} className="admin-artists-page-input" />
										</div>
										<div className="admin-modal-field admin-modal-field-full">
											<label className="admin-modal-label">{iconLabel(<SiYoutube />, 'YouTube Social URL')}</label>
											<input type="url" placeholder="YouTube Social URL" value={form.youtubeSocialProfile} onChange={(event) => setForm((current) => ({ ...current, youtubeSocialProfile: event.target.value }))} className="admin-artists-page-input" />
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
