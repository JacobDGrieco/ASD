/**
 * Music admin artist-management route.
 *
 * Handles artist CRUD, artist profile links/images, videos, and account-scoped
 * editing rules.
 */
import { useEffect, useRef, useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { TabPanel } from 'primereact/tabview';
import AdminEntityCard from '../../components/admin/AdminEntityCard.jsx';
import AdminProfileLinksField from '../../components/admin/AdminProfileLinksField.jsx';
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx';
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx';
import PageTabs from '../../components/shared/PageTabs.jsx';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import { loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js';
import { ARTIST_LEGACY_LINK_FIELDS, normalizeProfileLinks, profileLinksForSource } from '../../lib/profileLinks.js';
import { slugify } from '../../lib/slugify.js';
import '../../styles/AdminArtistsPage.css';

const empty = {
	name: '',
	slug: '',
	isVisible: true,
	bio: '',
	aboutMe: '',
	images: [],
	links: [],
	order: 0,
};

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

function MusicArtistFormModal({ form, setForm, token, onClose, onSave, onDelete, canDelete }) {
	const updateField = (key) => (event) => {
		setForm((current) => ({
			...current,
			[key]: event.target.value,
			...(key === 'name' ? { slug: slugify(event.target.value) } : {}),
		}));
	};

	return (
		<div className="admin-modal-overlay" role="presentation">
			<div className="admin-modal">
				<div className="admin-modal-header">
					<h2 className="admin-modal-title">{form.id ? 'Edit Artist' : 'New Artist'}</h2>
					<button type="button" onClick={onClose} className="admin-modal-close" aria-label="Close">x</button>
				</div>
				<div className="admin-modal-body">
					<PageTabs className="admin-modal-tabs" tabCount={2}>
						<TabPanel header="Artist">
							<div className="admin-modal-grid">
								<div className="admin-modal-field admin-modal-field-full">
									<div className="admin-artist-name-field">
										<button
											type="button"
											onClick={() => setForm((current) => ({ ...current, isVisible: !current.isVisible }))}
											className={`admin-visibility-toggle ${form.isVisible ? '' : 'admin-visibility-toggle-hidden'}`.trim()}
											aria-label={form.isVisible ? 'Artist is visible to the public. Click to hide.' : 'Artist is hidden from the public. Click to show.'}
											title={form.isVisible ? 'Visible on public site' : 'Hidden from public site'}
										>
											{form.isVisible ? <FaEye aria-hidden="true" /> : <FaEyeSlash aria-hidden="true" />}
										</button>
										<div className="admin-artist-name-field-main">
											<label htmlFor="admin-music-artist-name" className="admin-modal-label">Name</label>
											<input
												id="admin-music-artist-name"
												type="text"
												placeholder="Name"
												value={form.name}
												onChange={updateField('name')}
												className="admin-field-input"
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
										onChange={updateField('bio')}
										className="admin-field-input admin-modal-textarea"
										rows={5}
									/>
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label htmlFor="admin-music-artist-about-me" className="admin-modal-label">About Me</label>
									<textarea
										id="admin-music-artist-about-me"
										placeholder="About Me"
										value={form.aboutMe}
										onChange={updateField('aboutMe')}
										className="admin-field-input admin-modal-textarea"
										rows={5}
									/>
								</div>
							</div>
						</TabPanel>
						<TabPanel header="Links">
							<div className="admin-modal-grid">
								<fieldset className="admin-modal-field admin-modal-field-full">
									<legend className="admin-modal-label">Links</legend>
									<AdminProfileLinksField
										value={form.links}
										onChange={(links) => setForm((current) => ({ ...current, links }))}
									/>
								</fieldset>
							</div>
						</TabPanel>
					</PageTabs>
				</div>
				<div className="admin-modal-footer">
					<div className="admin-modal-footer-start">
						{form.id && canDelete && (
							<ConfirmActionButton
								message="Delete this artist and all their albums/songs?"
								onConfirm={onDelete}
								buttonClassName="admin-button-danger"
								buttonAriaLabel="Delete artist"
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

export default function AdminMusicArtistsPage() {
	const { token, session } = useAdminAuth();
	const isSuperAdmin = session?.role === 'SUPER_ADMIN';
	const isViewer = session?.role === 'VIEWER';
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

	const openCreate = () => setForm({ ...empty, links: [] });
	const openEdit = async (artist) => {
		setLoadingEditId(artist.id);
		try {
			const detail = await fetch(`/api/admin/artists?id=${artist.id}`).then((r) => r.json());
			setForm({ ...empty, ...detail, images: detail.images ?? [], links: profileLinksForSource(detail, ARTIST_LEGACY_LINK_FIELDS) });
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
			links: normalizeProfileLinks(form.links),
			slug: slugify(form.name),
			...(isEdit ? {} : { order: nextOrder }),
		};
		const res = await fetch(url, {
			method: isEdit ? 'PUT' : 'POST',
			headers: { 'Content-Type': 'application/json' },
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
		await fetch(`/api/admin/artists?id=${id}`, { method: 'DELETE' });
		const nextArtists = artists.filter((artist) => artist.id !== id);
		setArtists(nextArtists);
		primeAdminResource('artists-list', token, nextArtists);
		closeForm();
	};

	const persistArtistOrder = async (nextArtists) => {
		const changedArtists = nextArtists.filter((artist, index) => artist.order !== index);
		if (!changedArtists.length) return nextArtists;

		const savedArtists = await Promise.all(
			changedArtists.map((artist) => {
				const nextOrderValue = nextArtists.findIndex((candidate) => candidate.id === artist.id);
				return fetch(`/api/admin/artists?id=${artist.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
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

	return (
		<div>
			<div className="admin-sticky-top">
				<div className="admin-page-header">
					<h1 className="admin-page-title">Music — Artists</h1>
					{isSuperAdmin && !isViewer && <button type="button" onClick={openCreate} className="admin-button-primary">New Artist</button>}
				</div>
			</div>

			<div className="admin-entity-card-grid">
				{artists.map((artist) => {
					const image = primaryImage(artist.images);
					return (
						<AdminEntityCard
							key={artist.id}
							image={image?.previewUrl || image?.url}
							imageCount={artist.imageCount ?? artist.images?.length ?? 1}
							isHidden={isArtistHidden(artist)}
							title={artist.name}
							links={artist.links}
							onEdit={isViewer ? undefined : () => void openEdit(artist)}
							editDisabled={loadingEditId === artist.id}
							editAriaLabel={`Edit ${artist.name}`}
							draggable={isSuperAdmin && !isViewer && !form}
							onDragStart={(event) => handleDragStart(event, artist.id)}
							onDragOver={(event) => handleDragOver(event, artist.id)}
							onDrop={(event) => {
								event.preventDefault();
								handleDrop(artist.id);
							}}
							onDragEnd={handleDragEnd}
							isDropTarget={dropTargetId === artist.id}
						/>
					);
				})}
			</div>

			{form && (
				<MusicArtistFormModal
					form={form}
					setForm={setForm}
					token={token}
					onClose={closeForm}
					onSave={handleSave}
					onDelete={async () => {
						await handleDelete(form.id);
						closeForm();
					}}
					canDelete={isSuperAdmin && !isViewer}
				/>
			)}
		</div>
	);
}
