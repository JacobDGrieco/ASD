/**
 * Music admin album-management route.
 *
 * Lists and edits releases, including album images, release links, visibility,
 * roles, and single-release synchronization.
 */
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { FaEye, FaEyeSlash, FaPencilAlt, FaPlus, FaTrash } from 'react-icons/fa';
import { TabPanel } from 'primereact/tabview';
import AdminProfileLinksField from '../../components/admin/AdminProfileLinksField.jsx';
import AdminProfileLinksSummary from '../../components/admin/AdminProfileLinksSummary.jsx';
import ConfirmActionButton from '../../components/admin/ConfirmActionButton.jsx';
import AdminDateInput from '../../components/admin/AdminDateInput.jsx';
import { isValidDateInput } from '../../lib/dateInput.js';
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx';
import MusicRolePersonPickerField from '../../components/admin/MusicRolePersonPickerField.jsx';
import PageTabs from '../../components/shared/PageTabs.jsx';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import { clearAdminResource, loadAdminResource, primeAdminResource } from '../../lib/adminResourceCache.js';
import AdminSongFormModal from '../../components/admin/AdminSongFormModal.jsx';
import { ADMIN_ALBUMS_FILTER_STATE_KEY } from '../../lib/adminFilterState.js';
import { defaultVisibilityForReleaseDate, isEffectivelyVisible } from '../../lib/contentVisibility.js';
import { MUSIC_RELEASE_LEGACY_LINK_FIELDS, normalizeProfileLinks, profileLinksForSource } from '../../lib/profileLinks.js';
import { isOtherArtist, OTHER_ARTIST_NAME, OTHER_ARTIST_OPTION_ID } from '../../lib/publicVisibility.js';
import { slugify } from '../../lib/slugify.js';
import { createRoleEntry } from '../../lib/adminSongForm.js';
import { SONG_ROLES, sortMusicRoleEntries } from '../../lib/songRoles.js';
import '../../styles/AdminArtistsPage.css';
import '../../styles/AdminAlbumsPage.css';

const PAGE_SIZE = 30;

const empty = {
	title: '',
	slug: '',
	isVisible: true,
	autoShowOnRelease: false,
	type: '',
	images: [],
	links: [],
	roles: [],
	otherArtistName: '',
	aboutText: '',
	soundcloudUrl: '',
	spotifyUrl: '',
	appleMusicUrl: '',
	youtubeUrl: '',
	releaseDate: '',
	artistId: '',
};

const columns = [
	{ key: 'images', label: 'Images', kind: 'images', className: 'admin-artists-page-col-image' },
	{ key: 'title', label: 'Title', placeholder: 'Title', className: 'admin-artists-page-col-wide' },
	{ key: 'artistId', label: 'Artist', kind: 'artist', className: 'admin-artists-page-col-sm' },
	{ key: 'type', label: 'Type', kind: 'select', className: 'admin-artists-page-col-sm' },
	{ key: 'releaseDate', label: 'Release Date', type: 'date', placeholder: 'Release Date', className: 'admin-artists-page-col-sm' },
	{ key: 'links', label: 'Links', kind: 'links', className: 'admin-artists-page-col-xl admin-links-col-centered' },
];

function primaryImage(images) {
	if (!Array.isArray(images) || images.length === 0) return null;
	return images.find((image) => image.isPrimary) ?? images[0];
}

function selectedRoleImage(entry, artistOptions, outsideArtistOptions) {
	const selected = entry.artistId
		? artistOptions.find((artist) => artist.id === entry.artistId)
		: entry.outsideArtistId
			? outsideArtistOptions.find((artist) => artist.id === entry.outsideArtistId)
			: null;

	if (selected?.image) return selected.image;
	if (!Array.isArray(selected?.images) || selected.images.length === 0) return null;
	return selected.images.find((image) => image.isPrimary) ?? selected.images[0];
}

function toFormRoles(roles) {
	return sortMusicRoleEntries(Array.isArray(roles)
		? roles.map((entry) => createRoleEntry(entry.role, entry.name, {
			artistId: entry.artistId,
			outsideArtistId: entry.outsideArtistId,
			externalUrl: entry.externalUrl,
			applyToSongs: entry.applyToSongs !== false,
		}))
		: []);
}

function hasRoleValue(role) {
	return Boolean(role?.name?.trim() && role?.role);
}

function isAlbumHidden(album) {
	return (
		(!isOtherArtist(album?.artist) && album?.artist?.isVisible === false) ||
		!isEffectivelyVisible(album, album?.releaseDate)
	);
}

function compareLexicographically(left, right) {
	return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true });
}

function compareAlbumsByReleaseDate(left, right) {
	const leftDate = normalizeAlbumReleaseDate(left.releaseDate);
	const rightDate = normalizeAlbumReleaseDate(right.releaseDate);
	if (leftDate && rightDate && leftDate !== rightDate) return rightDate.localeCompare(leftDate);
	if (leftDate !== rightDate) return leftDate ? -1 : 1;

	const titleCompare = compareLexicographically(left.title ?? '', right.title ?? '');
	if (titleCompare !== 0) return titleCompare;

	const leftArtist = isOtherArtist(left.artist) ? left.otherArtistName || OTHER_ARTIST_NAME : left.artist?.name ?? '';
	const rightArtist = isOtherArtist(right.artist) ? right.otherArtistName || OTHER_ARTIST_NAME : right.artist?.name ?? '';
	return compareLexicographically(leftArtist, rightArtist);
}

function withOtherArtistOption(artists) {
	return [...artists, { id: OTHER_ARTIST_OPTION_ID, name: OTHER_ARTIST_NAME }];
}

function normalizeAlbumDuplicateValue(value) {
	return String(value ?? '').trim().toLowerCase();
}

function normalizeAlbumReleaseDate(value) {
	if (!value) return '';
	return String(value).slice(0, 10);
}

function hasManualAlbumVisibilityChoice(album) {
	const defaultVisibility = defaultVisibilityForReleaseDate(album?.releaseDate);
	return (
		album?.isVisible !== defaultVisibility.isVisible ||
		Boolean(album?.autoShowOnRelease) !== defaultVisibility.autoShowOnRelease
	);
}

function validateAlbumForm(form, albums = []) {
	const errors = {};
	if (!form.title?.trim()) errors.title = 'Album title is required.';
	if (!form.artistId) errors.artistId = 'Artist is required.';
	if (form.artistId === OTHER_ARTIST_OPTION_ID && !form.otherArtistName?.trim()) errors.otherArtistName = 'Other artist name is required.';
	if (!form.type) errors.type = 'Album type is required.';
	if (!form.releaseDate) errors.releaseDate = 'Release date is required.';
	else if (!isValidDateInput(form.releaseDate, { required: true })) errors.releaseDate = 'Release date must use YYYY-MM-DD.';

	if (!errors.title && !errors.artistId && !errors.otherArtistName && !errors.releaseDate) {
		const normalizedTitle = normalizeAlbumDuplicateValue(form.title);
		const normalizedArtistId = form.artistId;
		const normalizedOtherArtistName = normalizeAlbumDuplicateValue(form.otherArtistName);
		const normalizedReleaseDate = normalizeAlbumReleaseDate(form.releaseDate);

		const duplicateAlbum = albums.find((album) => {
			if (album.id === form.id) return false;
			if (normalizeAlbumDuplicateValue(album.title) !== normalizedTitle) return false;

			const albumArtistId = isOtherArtist(album.artist) ? OTHER_ARTIST_OPTION_ID : album.artistId;
			if (albumArtistId !== normalizedArtistId) return false;

			if (albumArtistId === OTHER_ARTIST_OPTION_ID) {
				if (normalizeAlbumDuplicateValue(album.otherArtistName) !== normalizedOtherArtistName) return false;
			}

			return normalizeAlbumReleaseDate(album.releaseDate) === normalizedReleaseDate;
		});

		if (duplicateAlbum) {
			errors.title = 'An album with this title, artist, and release date already exists.';
		}
	}

	return errors;
}

function renderValue(album, column) {
	if (column.key === 'artistId') {
		const artistLabel = isOtherArtist(album.artist)
			? album.otherArtistName || OTHER_ARTIST_NAME
			: album.artist?.name;
		return artistLabel ? <span className="admin-artists-page-cell-value" title={artistLabel}>{artistLabel}</span> : <span className="admin-artists-page-empty-value">-</span>;
	}

	if (column.key === 'releaseDate') {
		const value = album.releaseDate ? album.releaseDate.slice(0, 10) : '';
		return value ? <span className="admin-artists-page-cell-value" title={value}>{value}</span> : <span className="admin-artists-page-empty-value">-</span>;
	}

	if (column.kind === 'links') {
		return <AdminProfileLinksSummary links={album.links} />;
	}

	if (column.kind === 'images') {
		const image = primaryImage(album.images);
		if (!image) return <span className="admin-artists-page-empty-value">-</span>;
		return (
			<div className="admin-artists-page-image-summary">
				<div className={`admin-artists-page-thumb-frame ${isAlbumHidden(album) ? 'admin-artists-page-thumb-frame-hidden' : ''}`.trim()}>
					<img src={image.previewUrl || image.url} alt={album.title} className="admin-artists-page-thumb" />
				</div>
				<span className="admin-artists-page-image-count">{album.imageCount ?? album.images?.length ?? 1} image{(album.imageCount ?? album.images?.length ?? 1) === 1 ? '' : 's'}</span>
			</div>
		);
	}

	const value = album[column.key];
	if (value === null || value === undefined || value === '') return <span className="admin-artists-page-empty-value">-</span>;
	return <span className={column.valueClassName ?? 'admin-artists-page-cell-value'} title={String(value)}>{String(value)}</span>;
}

function renderHeader(column) {
	return column.label;
}

function AlbumsTable({ albums, isViewer, loadingEditId, onEdit }) {
	return (
		<div className="admin-artists-page-table-wrap">
			<table className="admin-artists-page-table">
				<thead>
					<tr>
						{columns.map((column) => <th key={column.key} className={column.className}>{renderHeader(column)}</th>)}
						<th className="admin-artists-page-actions-col admin-artists-page-sticky-right-0"></th>
					</tr>
				</thead>
				<tbody>
					{albums.map((album) => (
						<tr key={album.id} className={isAlbumHidden(album) ? 'admin-artists-page-hidden-row' : ''}>
							{columns.map((column) => (
								<td key={column.key} className={`${column.className ?? ''} ${column.key === 'type' ? 'admin-artists-page-muted' : ''}`.trim()}>
									{renderValue(album, column)}
								</td>
							))}
							<td className="admin-artists-page-action-cell admin-artists-page-actions-col admin-artists-page-sticky-right-0">
								<div className="admin-artists-page-actions">
									{!isViewer && (
										<button type="button" onClick={() => void onEdit(album)} disabled={loadingEditId === album.id} className="admin-artists-page-ghost-btn admin-artists-page-icon-btn" aria-label="Edit album" title="Edit">
											<FaPencilAlt aria-hidden="true" />
										</button>
									)}
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function AlbumsPagination({ currentPage, totalPages, onPageChange }) {
	if (totalPages <= 1) return null;

	return (
		<div className="admin-pagination">
			<button
				type="button"
				className="admin-pagination-btn"
				onClick={() => onPageChange(currentPage - 1)}
				disabled={currentPage === 1}
			>
				Prev
			</button>
			<span className="admin-pagination-info">Page {currentPage} of {totalPages}</span>
			<button
				type="button"
				className="admin-pagination-btn"
				onClick={() => onPageChange(currentPage + 1)}
				disabled={currentPage === totalPages}
			>
				Next
			</button>
		</div>
	);
}

function AlbumRolesTab({ form, artistOptions, outsideArtistOptions, addRole, removeRole, updateRole }) {
	return (
		<div className="admin-song-tab-layout">
			<div className="admin-song-tab-scroll">
				<div className="admin-song-roles-list">
					{form.roles.map((entry, index) => {
						const image = selectedRoleImage(entry, artistOptions, outsideArtistOptions);

						return (
							<div key={entry.clientKey ?? `${entry.role}:${entry.name}`} className="admin-song-role-row admin-song-role-row-with-apply">
								<label className="admin-song-role-apply-toggle" title="Apply this album role to attached songs">
									<input
										type="checkbox"
										checked={entry.applyToSongs !== false}
										onChange={(event) => updateRole(index, 'applyToSongs', event.target.checked)}
										aria-label={`Apply ${entry.role || 'role'} to attached songs`}
									/>
								</label>
								<div className="admin-song-role-thumb" aria-hidden="true">
									{image ? (
										<img src={image.previewUrl || image.url} alt="" className="admin-song-role-thumb-img" />
									) : null}
								</div>
								<div className="admin-song-role-name">
									<MusicRolePersonPickerField
										name={entry.name}
										artistId={entry.artistId}
										outsideArtistId={entry.outsideArtistId}
										artistOptions={artistOptions}
										outsideArtistOptions={outsideArtistOptions}
										onChange={(patch) => updateRole(index, patch)}
									/>
								</div>
								<select value={entry.role} onChange={(event) => updateRole(index, 'role', event.target.value)} className="admin-artists-page-input admin-song-role-select" aria-label={`Role type ${index + 1}`}>
									{SONG_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
								</select>
								<button type="button" onClick={() => removeRole(index)} className="admin-artists-page-danger-btn admin-artists-page-icon-btn" aria-label="Remove role" title="Remove role">
									<FaTrash aria-hidden="true" />
								</button>
							</div>
						);
					})}
				</div>
			</div>
			<div className="admin-song-tab-actions">
				<button
					type="button"
					onClick={addRole}
					className="admin-artists-page-ghost-btn admin-song-add-role-btn"
					aria-label="Add role"
					title="Add role"
				>
					<FaPlus aria-hidden="true" />
				</button>
			</div>
		</div>
	);
}

function AlbumFormModal({
	form,
	setForm,
	token,
	artistOptions,
	roleArtistOptions,
	outsideArtistOptions,
	scopedArtistId,
	isArtistScoped,
	validationErrors,
	visibilityTouchedRef,
	fieldClassName,
	set,
	setReleaseDate,
	addRole,
	removeRole,
	updateRole,
	onClose,
	onSave,
	onDelete,
	canDelete,
}) {
	return (
		<div className="admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<div className="admin-modal">
				<div className="admin-modal-header">
					<h2 className="admin-modal-title">{form.id ? 'Edit Album' : 'New Album'}</h2>
					<button type="button" onClick={onClose} className="admin-modal-close" aria-label="Close">x</button>
				</div>
				<div className="admin-modal-body">
					<PageTabs className="admin-modal-tabs" tabCount={3}>
						<TabPanel header="Album">
							<div className="admin-modal-grid">
								<div className="admin-modal-field admin-modal-field-full">
									<div className="admin-artists-page-name-field">
										<button
											type="button"
											onClick={() => {
												visibilityTouchedRef.current = true;
												setForm((current) => ({
													...current,
													isVisible: !current.isVisible,
													autoShowOnRelease: false,
												}));
											}}
											className={`admin-artists-page-visibility-toggle ${form.isVisible ? '' : 'admin-artists-page-visibility-toggle-hidden'}`.trim()}
											aria-label={form.isVisible ? 'Album is visible to the public. Click to hide.' : 'Album is hidden from the public. Click to show.'}
											title={form.isVisible ? 'Visible on public site' : 'Hidden from public site'}
										>
											{form.isVisible ? <FaEye aria-hidden="true" /> : <FaEyeSlash aria-hidden="true" />}
										</button>
										<div className="admin-artists-page-name-field-main">
											<label htmlFor="admin-music-album-title" className="admin-modal-label">Title <span className="admin-modal-label-required">*</span></label>
											<input id="admin-music-album-title" type="text" placeholder="Title" value={form.title} onChange={set('title')} className={fieldClassName('title')} aria-invalid={Boolean(validationErrors.title)} />
										</div>
									</div>
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<div className="admin-modal-label">Images</div>
									<ImageCollectionField
										value={form.images}
										onChange={(images) => setForm((current) => ({ ...current, images }))}
										token={token}
										folder="albums"
										entityLabel={form.title || 'Album image'}
									/>
								</div>
								<div className="admin-modal-field admin-modal-field-full admin-albums-modal-meta-row">
									<div className="admin-modal-field admin-albums-modal-meta-artist">
										<label htmlFor="admin-music-album-artist" className="admin-modal-label">Artist <span className="admin-modal-label-required">*</span></label>
										{isArtistScoped ? (
											<input
												id="admin-music-album-artist"
												type="text"
												value={artistOptions.find((artist) => artist.id === scopedArtistId)?.name ?? ''}
												className="admin-artists-page-input"
												readOnly
											/>
										) : (
											<select id="admin-music-album-artist" value={form.artistId} onChange={set('artistId')} className={fieldClassName('artistId')} aria-invalid={Boolean(validationErrors.artistId)}>
												<option value="">- Artist -</option>
												{artistOptions.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
											</select>
										)}
									</div>
									<div className="admin-modal-field admin-albums-modal-meta-type">
										<label htmlFor="admin-music-album-type" className="admin-modal-label">Type <span className="admin-modal-label-required">*</span></label>
										<select id="admin-music-album-type" value={form.type} onChange={set('type')} className={fieldClassName('type')} aria-invalid={Boolean(validationErrors.type)}>
											<option value="">- Type -</option>
											<option value="ALBUM">Album</option>
											<option value="SINGLE">Single</option>
											<option value="EP">EP</option>
										</select>
									</div>
									<div className="admin-modal-field admin-albums-modal-meta-date">
										<label htmlFor="admin-music-album-release-date" className="admin-modal-label">Release Date <span className="admin-modal-label-required">*</span></label>
										<AdminDateInput id="admin-music-album-release-date" ariaLabel="Album release date" value={form.releaseDate} onChange={setReleaseDate} className={fieldClassName('releaseDate')} ariaInvalid={Boolean(validationErrors.releaseDate)} required />
									</div>
								</div>
								{form.artistId === OTHER_ARTIST_OPTION_ID && (
									<div className="admin-modal-field admin-modal-field-full">
										<label htmlFor="admin-music-album-other-artist-name" className="admin-modal-label">Other Artist Name <span className="admin-modal-label-required">*</span></label>
										<input id="admin-music-album-other-artist-name" type="text" placeholder="Artist name" value={form.otherArtistName} onChange={set('otherArtistName')} className={fieldClassName('otherArtistName')} aria-invalid={Boolean(validationErrors.otherArtistName)} />
									</div>
								)}
								<div className="admin-modal-field admin-modal-field-full">
									<label htmlFor="admin-music-album-about" className="admin-modal-label">About</label>
									<textarea id="admin-music-album-about" placeholder="About this album..." value={form.aboutText} onChange={set('aboutText')} className="admin-artists-page-input admin-modal-textarea" rows={5} />
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
										showTypeField={false}
									/>
								</fieldset>
							</div>
						</TabPanel>
						<TabPanel header="Roles">
							<AlbumRolesTab
								form={form}
								artistOptions={roleArtistOptions}
								outsideArtistOptions={outsideArtistOptions}
								addRole={addRole}
								removeRole={removeRole}
								updateRole={updateRole}
							/>
						</TabPanel>
					</PageTabs>
				</div>
				<div className="admin-modal-footer">
					<div className="admin-modal-footer-start">
						{form.id && canDelete && (
							<ConfirmActionButton
								message="Delete this album and all its songs?"
								onConfirm={onDelete}
								buttonClassName="admin-artists-page-danger-btn"
								buttonAriaLabel="Delete album"
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

export default function AdminMusicAlbumsPage() {
	const { token, session } = useAdminAuth();
	const isArtistScoped = session?.role === 'ARTIST';
	const isViewer = session?.role === 'VIEWER';
	const scopedArtistId = session?.artistId ?? '';
	const auth = { Authorization: `Bearer ${token}` };
	const initialFilterState = (() => {
		if (typeof window === 'undefined') return { filterArtist: '', filterType: '', filterTitle: '', page: 1 };
		try {
			const saved = JSON.parse(window.sessionStorage.getItem(ADMIN_ALBUMS_FILTER_STATE_KEY) ?? '{}');
			return {
				filterArtist: typeof saved.filterArtist === 'string' ? saved.filterArtist : '',
				filterType: typeof saved.filterType === 'string' ? saved.filterType : '',
				filterTitle: typeof saved.filterTitle === 'string' ? saved.filterTitle : '',
				page: Number.isInteger(saved.page) && saved.page > 0 ? saved.page : 1,
			};
		} catch {
			return { filterArtist: '', filterType: '', filterTitle: '', page: 1 };
		}
	})();
	const [albums, setAlbums] = useState([]);
	const [artists, setArtists] = useState([]);
	const [outsideArtists, setOutsideArtists] = useState([]);
	const [form, setForm] = useState(null);
	const [filterArtist, setFilterArtist] = useState(initialFilterState.filterArtist);
	const [filterType, setFilterType] = useState(initialFilterState.filterType);
	const [filterTitle, setFilterTitle] = useState(initialFilterState.filterTitle);
	const [page, setPage] = useState(initialFilterState.page);
	const [loadingEditId, setLoadingEditId] = useState(null);
	const [validationErrors, setValidationErrors] = useState({});
	const visibilityTouchedRef = useRef(false);
	const [createSongPrefill, setCreateSongPrefill] = useState(null);
	const deferredFilterTitle = useDeferredValue(filterTitle);

	useEffect(() => {
		let ignore = false;

		loadAdminResource({ cacheKey: 'albums-list', url: '/api/admin/albums', token }).then((albumList) => {
			if (!ignore) setAlbums(albumList);
		});

		loadAdminResource({ cacheKey: 'artists-list', url: '/api/admin/artists', token }).then((artistList) => {
			if (!ignore) setArtists(artistList);
		});

		loadAdminResource({ cacheKey: 'music-outside-artists-list', url: '/api/admin/outside-artists', token }).then((outsideArtistList) => {
			if (!ignore) setOutsideArtists(outsideArtistList);
		});

		return () => {
			ignore = true;
		};
	}, [token]);

	const filteredAlbums = useMemo(() => (
		albums.filter((album) => {
			if (filterArtist) {
				const matchesArtist = filterArtist === OTHER_ARTIST_OPTION_ID
					? isOtherArtist(album.artist)
					: album.artistId === filterArtist;
				if (!matchesArtist) return false;
			}
			if (filterType && album.type !== filterType) return false;
			if (deferredFilterTitle && !album.title.toLowerCase().includes(deferredFilterTitle.trim().toLowerCase())) return false;
			return true;
		}).toSorted(compareAlbumsByReleaseDate)
	), [albums, deferredFilterTitle, filterArtist, filterType]);

	const artistOptions = useMemo(() => (
		withOtherArtistOption(artists).sort((left, right) =>
			compareLexicographically(left.name, right.name)
		)
	), [artists]);

	const roleArtistOptions = useMemo(() => (
		artists.toSorted((left, right) => compareLexicographically(left.name, right.name))
	), [artists]);

	const roleOutsideArtistOptions = useMemo(() => (
		outsideArtists.toSorted((left, right) => compareLexicographically(left.name, right.name))
	), [outsideArtists]);

	const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredAlbums.length / PAGE_SIZE)), [filteredAlbums.length]);
	const currentPage = Math.min(page, totalPages);
	const pagedAlbums = useMemo(
		() => filteredAlbums.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
		[currentPage, filteredAlbums]
	);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		window.sessionStorage.setItem(ADMIN_ALBUMS_FILTER_STATE_KEY, JSON.stringify({ filterArtist, filterType, filterTitle, page: currentPage }));
	}, [currentPage, filterArtist, filterTitle, filterType]);

	const openCreate = () => {
		setValidationErrors({});
		visibilityTouchedRef.current = false;
		setForm({
			...empty,
			artistId: isArtistScoped ? scopedArtistId : filterArtist,
			type: filterType || empty.type,
		});
	};
	const openEdit = async (album) => {
		setLoadingEditId(album.id);
		try {
			const detail = await fetch(`/api/admin/albums?id=${album.id}`, { headers: auth }).then((r) => r.json());
			visibilityTouchedRef.current = hasManualAlbumVisibilityChoice(detail);
			setForm({
				...empty,
				...detail,
				artistId: isOtherArtist(detail.artist) ? OTHER_ARTIST_OPTION_ID : detail.artistId,
				otherArtistName: detail.otherArtistName ?? '',
				images: detail.images ?? [],
				links: profileLinksForSource(detail, MUSIC_RELEASE_LEGACY_LINK_FIELDS),
				roles: toFormRoles(detail.roles),
				aboutText: detail.aboutText ?? '',
				soundcloudUrl: detail.soundcloudUrl ?? '',
				spotifyUrl: detail.spotifyUrl ?? '',
				appleMusicUrl: detail.appleMusicUrl ?? '',
				youtubeUrl: detail.youtubeUrl ?? '',
				releaseDate: detail.releaseDate ? detail.releaseDate.slice(0, 10) : '',
			});
			setValidationErrors({});
		} finally {
			setLoadingEditId(null);
		}
	};
	const closeForm = () => {
		setForm(null);
		setValidationErrors({});
		visibilityTouchedRef.current = false;
	};

	const handleSave = async () => {
		const nextErrors = validateAlbumForm(form, albums);
		if (Object.keys(nextErrors).length > 0) {
			setValidationErrors(nextErrors);
			return;
		}
		setValidationErrors({});

		const isEdit = Boolean(form.id);
		const url = isEdit ? `/api/admin/albums?id=${form.id}` : '/api/admin/albums';
		const payload = {
			...form,
			links: normalizeProfileLinks(form.links),
			roles: sortMusicRoleEntries(form.roles.filter(hasRoleValue)).map(({ role, name, artistId, outsideArtistId, externalUrl, applyToSongs }) => ({
				role,
				name,
				artistId,
				outsideArtistId,
				externalUrl,
				applyToSongs: applyToSongs !== false,
			})),
			slug: slugify(form.title),
			...(isArtistScoped ? { artistId: scopedArtistId } : {}),
		};
		const res = await fetch(url, {
			method: isEdit ? 'PUT' : 'POST',
			headers: { ...auth, 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		if (!res.ok) {
			const error = await res.json().catch(() => ({ error: 'Failed to save album.' }));
			window.alert(error.error ?? 'Failed to save album.');
			return;
		}
		const saved = await res.json();
		const withArtist = { ...saved, artist: saved.artist ?? artists.find((artist) => artist.id === saved.artistId) ?? null };
		const nextAlbums = (isEdit ? albums.map((album) => (album.id === saved.id ? withArtist : album)) : [...albums, withArtist])
			.toSorted(compareAlbumsByReleaseDate);
		setAlbums(nextAlbums);
		primeAdminResource('albums-list', token, nextAlbums);
		clearAdminResource('songs-list', token);
		fetch('/api/admin/outside-artists', { headers: auth })
			.then((response) => (response.ok ? response.json() : null))
			.then((outsideArtistList) => {
				if (!outsideArtistList) return;
				setOutsideArtists(outsideArtistList);
				primeAdminResource('music-outside-artists-list', token, outsideArtistList);
			})
			.catch(() => { });
		closeForm();

		if (!isEdit && saved.type === 'SINGLE') {
			setCreateSongPrefill({
				albumId: saved.id,
				title: saved.title ?? '',
				releaseDate: normalizeAlbumReleaseDate(saved.releaseDate),
				isVisible: saved.isVisible,
				autoShowOnRelease: saved.autoShowOnRelease,
				aboutText: saved.aboutText ?? '',
				images: saved.images ?? [],
				soundcloudUrl: saved.soundcloudUrl ?? '',
				spotifyUrl: saved.spotifyUrl ?? '',
				appleMusicUrl: saved.appleMusicUrl ?? '',
				youtubeUrl: saved.youtubeUrl ?? '',
				links: profileLinksForSource(saved, MUSIC_RELEASE_LEGACY_LINK_FIELDS),
				roles: Array.isArray(saved.roles) ? saved.roles.filter((role) => role?.applyToSongs !== false) : [],
			});
		}
	};

	const handleDelete = async (id) => {
		await fetch(`/api/admin/albums?id=${id}`, { method: 'DELETE', headers: auth });
		const nextAlbums = albums.filter((album) => album.id !== id);
		setAlbums(nextAlbums);
		primeAdminResource('albums-list', token, nextAlbums);
	};

	const handleSongSaved = () => {
		clearAdminResource('songs-list', token);
		clearAdminResource('albums-list', token);
		setCreateSongPrefill(null);
	};

	const addRole = () =>
		setForm((current) => ({
			...current,
			roles: sortMusicRoleEntries([...current.roles, createRoleEntry('Featured Artist', '', { applyToSongs: true })]),
		}));

	const removeRole = (index) =>
		setForm((current) => ({
			...current,
			roles: current.roles.filter((_, i) => i !== index),
		}));

	const updateRole = (index, keyOrPatch, value) =>
		setForm((current) => ({
			...current,
			roles: sortMusicRoleEntries(current.roles.map((entry, i) => {
				if (i !== index) return entry;

				const patch = typeof keyOrPatch === 'string'
					? { [keyOrPatch]: value }
					: keyOrPatch;
				const next = { ...entry, ...patch };
				if (patch._prefillRole && (!entry.role || entry.role === 'Featured Artist')) next.role = patch._prefillRole;
				delete next._prefillRole;
				return next;
			})),
		}));

	const set = (key) => (event) => {
		const nextValue = event.target.value;
		setValidationErrors((currentErrors) => {
			if (!(key in currentErrors) && !(key === 'artistId' && 'otherArtistName' in currentErrors)) return currentErrors;
			const nextErrors = { ...currentErrors };
			delete nextErrors[key];
			if (key === 'artistId') delete nextErrors.otherArtistName;
			return nextErrors;
		});

		setForm((current) => ({
			...current,
			[key]: nextValue,
			...(key === 'title' ? { slug: slugify(nextValue) } : {}),
			...(key === 'artistId' && nextValue !== OTHER_ARTIST_OPTION_ID ? { otherArtistName: '' } : {}),
		}));
	};

	const fieldClassName = (fieldName) => (
		`admin-artists-page-input${validationErrors[fieldName] ? ' admin-artists-page-input-invalid' : ''}`
	);

	const setReleaseDate = (value) => {
		const visibilityDefaults = !visibilityTouchedRef.current ? defaultVisibilityForReleaseDate(value) : {};

		setValidationErrors((currentErrors) => {
			if (!('releaseDate' in currentErrors)) return currentErrors;
			const nextErrors = { ...currentErrors };
			delete nextErrors.releaseDate;
			return nextErrors;
		});

		setForm((current) => ({
			...current,
			releaseDate: value,
			...visibilityDefaults,
		}));
	};

	return (
		<div>
			<div className="admin-artists-page-sticky-top">
				<div className="admin-artists-page-header">
					<h1 className="admin-artists-page-title">Music — Albums</h1>
					{!isViewer && <button type="button" onClick={openCreate} className="admin-artists-page-primary-btn">New Album</button>}
				</div>

				<div className="admin-filter-bar">
					<input
						type="search"
						value={filterTitle}
						onChange={(e) => {
							setFilterTitle(e.target.value);
							setPage(1);
						}}
						className="admin-filter-select"
						placeholder="Search title..."
						aria-label="Search albums by title"
					/>
					{!isArtistScoped && (
						<select
							value={filterArtist}
							onChange={(e) => {
								setFilterArtist(e.target.value);
								setPage(1);
							}}
							className="admin-filter-select"
							aria-label="Filter albums by artist"
						>
							<option value="">All Artists</option>
							{artistOptions.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
						</select>
					)}
					<select
						value={filterType}
						onChange={(e) => {
							setFilterType(e.target.value);
							setPage(1);
						}}
						className="admin-filter-select"
						aria-label="Filter albums by type"
					>
						<option value="">All Types</option>
						<option value="ALBUM">Album</option>
						<option value="SINGLE">Single</option>
						<option value="EP">EP</option>
					</select>
				</div>
			</div>

			<AlbumsTable
				albums={pagedAlbums}
				isViewer={isViewer}
				loadingEditId={loadingEditId}
				onEdit={openEdit}
			/>

			<AlbumsPagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />

			{createSongPrefill && (
				<AdminSongFormModal
					prefill={createSongPrefill}
					songs={[]}
					albums={albums}
					token={token}
					session={session}
					onSaved={handleSongSaved}
					onClose={() => setCreateSongPrefill(null)}
				/>
			)}

			{form && (
				<AlbumFormModal
					form={form}
					setForm={setForm}
					token={token}
					artistOptions={artistOptions}
					roleArtistOptions={roleArtistOptions}
					outsideArtistOptions={roleOutsideArtistOptions}
					scopedArtistId={scopedArtistId}
					isArtistScoped={isArtistScoped}
					validationErrors={validationErrors}
					visibilityTouchedRef={visibilityTouchedRef}
					fieldClassName={fieldClassName}
					set={set}
					setReleaseDate={setReleaseDate}
					addRole={addRole}
					removeRole={removeRole}
					updateRole={updateRole}
					onClose={closeForm}
					onSave={handleSave}
					onDelete={async () => {
						await handleDelete(form.id);
						closeForm();
					}}
					canDelete={!isViewer}
				/>
			)}
		</div>
	);
}
