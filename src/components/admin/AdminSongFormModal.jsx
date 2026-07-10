import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { TabPanel, TabView } from 'primereact/tabview';
import { FaEye, FaEyeSlash, FaPlus, FaTimes } from 'react-icons/fa';
import { SiApplemusic, SiSoundcloud, SiSpotify, SiYoutube } from 'react-icons/si';
import AdminDateInput, { isValidDateInput } from './AdminDateInput.jsx';
import ImageCollectionField from './ImageCollectionField.jsx';
import ChipInputField from './ChipInputField.jsx';
import { SONG_ROLES } from '../../lib/songRoles.js';
import { defaultVisibilityForReleaseDate } from '../../lib/contentVisibility.js';
import { isOtherArtist, OTHER_ARTIST_NAME } from '../../lib/publicVisibility.js';
import { slugify } from '../../lib/slugify.js';
import '../../styles/AdminArtistsPage.css';
import '../../styles/AdminSongsPage.css';

function createClientKey(prefix) {
	return `${prefix}-${crypto.randomUUID()}`;
}

function createAlbumPlacement() {
	return { clientKey: createClientKey('placement'), albumId: '', trackNumber: '', discNumber: 1 };
}

function createRoleEntry(role = 'Featured Artist', name = '') {
	return { clientKey: createClientKey('role'), role, name };
}

const emptyForm = {
	title: '',
	slug: '',
	isVisible: true,
	autoShowOnRelease: false,
	duration: '',
	soundcloudUrl: '',
	spotifyUrl: '',
	appleMusicUrl: '',
	youtubeUrl: '',
	aboutText: '',
	roles: [],
	releaseDate: '',
	images: [],
	tags: [],
	bpm: '',
	key: '',
	albumPlacements: [createAlbumPlacement()],
};

const SONG_KEYS = [
	'C Major',
	'C Minor',
	'Db Major',
	'Db Minor',
	'D Major',
	'D Minor',
	'Eb Major',
	'Eb Minor',
	'E Major',
	'E Minor',
	'F Major',
	'F Minor',
	'Gb Major',
	'Gb Minor',
	'G Major',
	'G Minor',
	'Ab Major',
	'Ab Minor',
	'A Major',
	'A Minor',
	'Bb Major',
	'Bb Minor',
	'B Major',
	'B Minor',
];

function iconLabel(icon, text) {
	return (
		<span className="admin-modal-label-with-icon">
			<span className="admin-modal-label-icon" aria-hidden="true">{icon}</span>
			<span>{text}</span>
		</span>
	);
}

function normalizeSongDuplicateValue(value) {
	return String(value ?? '').trim().toLowerCase();
}

function normalizeSongReleaseDate(value) {
	if (!value) return '';
	return String(value).slice(0, 10);
}

function compareText(left, right) {
	return String(left ?? '').localeCompare(String(right ?? ''), undefined, { sensitivity: 'base', numeric: true });
}

function albumArtistName(album) {
	if (!album) return '';
	if (isOtherArtist(album.artist)) return album.otherArtistName || OTHER_ARTIST_NAME;
	return album.artist?.name ?? '';
}

function albumSearchLabel(album) {
	if (!album) return '';
	const artistName = albumArtistName(album);
	return artistName ? `${album.title} - ${artistName}` : album.title;
}

function albumMatchesSearch(album, query) {
	if (!query) return true;
	const searchableText = [
		album.title,
		albumArtistName(album),
		normalizeSongReleaseDate(album.releaseDate),
	].join(' ').toLowerCase();
	return searchableText.includes(query);
}

function compareAlbumOptions(left, right) {
	const artistCompare = compareText(albumArtistName(left), albumArtistName(right));
	if (artistCompare !== 0) return artistCompare;

	const titleCompare = compareText(left.title, right.title);
	if (titleCompare !== 0) return titleCompare;

	const releaseDateCompare = compareText(normalizeSongReleaseDate(left.releaseDate), normalizeSongReleaseDate(right.releaseDate));
	if (releaseDateCompare !== 0) return releaseDateCompare;

	return compareText(left.id, right.id);
}

function albumArtistKey(album) {
	if (!album) return '';
	if (isOtherArtist(album.artist)) {
		return `other:${normalizeSongDuplicateValue(album.otherArtistName || OTHER_ARTIST_NAME)}`;
	}
	return `artist:${album.artistId ?? album.artist?.id ?? ''}`;
}

function placementAlbumIds(song) {
	if (Array.isArray(song.albumIds) && song.albumIds.length) return song.albumIds;
	if (Array.isArray(song.placements) && song.placements.length) return song.placements.map((p) => p.albumId);
	return song.albumId ? [song.albumId] : [];
}

function buildPlacementForm(song) {
	if (Array.isArray(song.albumPlacements) && song.albumPlacements.length) {
		return song.albumPlacements.map((p) => ({
			clientKey: createClientKey('placement'),
			albumId: p.albumId ?? '',
			trackNumber: Number(p.trackNumber ?? 1),
			discNumber: Number(p.discNumber ?? 1),
		}));
	}
	if (Array.isArray(song.placements) && song.placements.length) {
		return song.placements.map((p) => ({
			clientKey: createClientKey('placement'),
			albumId: p.albumId ?? p.album?.id ?? '',
			trackNumber: Number(p.trackNumber ?? 1),
			discNumber: Number(p.discNumber ?? 1),
		}));
	}
	if (song.albumId) {
		return [{ clientKey: createClientKey('placement'), albumId: song.albumId, trackNumber: Number(song.trackNumber ?? 1), discNumber: Number(song.discNumber ?? 1) }];
	}
	return [createAlbumPlacement()];
}

function hasManualSongVisibilityChoice(song) {
	const releaseDate = song?.meta?.releaseDate ?? song?.placements?.[0]?.album?.releaseDate ?? '';
	const defaultVisibility = defaultVisibilityForReleaseDate(releaseDate);
	return (
		song?.isVisible !== defaultVisibility.isVisible ||
		Boolean(song?.autoShowOnRelease) !== defaultVisibility.autoShowOnRelease
	);
}

function validateSongForm(form, songs = [], albumById = {}) {
	const errors = {
		title: '',
		releaseDate: '',
		albumPlacementsRoot: '',
		albumPlacements: Array.isArray(form.albumPlacements)
			? form.albumPlacements.map(() => ({ albumId: '', trackNumber: '', discNumber: '' }))
			: [],
	};

	if (!form.title?.trim()) errors.title = 'Song title is required.';
	if (form.releaseDate && !isValidDateInput(form.releaseDate)) errors.releaseDate = 'Release date must use YYYY-MM-DD.';
	if (!Array.isArray(form.albumPlacements) || form.albumPlacements.length === 0) {
		errors.albumPlacementsRoot = 'At least one album is required.';
		return errors;
	}

	const seenAlbumIds = new Set();
	for (const [index, placement] of form.albumPlacements.entries()) {
		if (!placement.albumId) errors.albumPlacements[index].albumId = 'Each album card must have an album selected.';
		if (placement.albumId && seenAlbumIds.has(placement.albumId)) errors.albumPlacements[index].albumId = 'Each album can only be selected once per song.';
		if (!placement.trackNumber || Number(placement.trackNumber) < 1) errors.albumPlacements[index].trackNumber = 'Track number must be at least 1.';
		if (!placement.discNumber || Number(placement.discNumber) < 1) errors.albumPlacements[index].discNumber = 'Disc number must be at least 1.';
		seenAlbumIds.add(placement.albumId);
	}

	if (!errors.title && !errors.releaseDate && !errors.albumPlacementsRoot && !errors.albumPlacements.some((p) => p.albumId || p.trackNumber || p.discNumber)) {
		const normalizedTitle = normalizeSongDuplicateValue(form.title);
		const normalizedReleaseDate = normalizeSongReleaseDate(form.releaseDate);
		const selectedAlbumIds = [...new Set(form.albumPlacements.map((p) => p.albumId).filter(Boolean))];

		const duplicateSong = songs.find((song) => {
			if (song.id === form.id) return false;
			if (normalizeSongDuplicateValue(song.title) !== normalizedTitle) return false;
			if (normalizeSongReleaseDate(song.meta?.releaseDate) !== normalizedReleaseDate) return false;
			return placementAlbumIds(song).some((albumId) => {
				if (!selectedAlbumIds.includes(albumId)) return false;
				const selectedAlbum = albumById[albumId];
				const existingAlbum = albumById[albumId] ?? song.placements?.find((p) => p.albumId === albumId)?.album ?? null;
				return (
					normalizeSongDuplicateValue(selectedAlbum?.title) === normalizeSongDuplicateValue(existingAlbum?.title) &&
					albumArtistKey(selectedAlbum) === albumArtistKey(existingAlbum)
				);
			});
		});

		if (duplicateSong) {
			errors.title = 'A song with this title, album, artist, and release date already exists.';
		}
	}

	return errors;
}

function hasSongValidationErrors(errors) {
	if (!errors) return false;
	if (errors.title || errors.albumPlacementsRoot) return true;
	return Array.isArray(errors.albumPlacements) && errors.albumPlacements.some((p) => p.albumId || p.trackNumber || p.discNumber);
}

function hasSongInfoErrors(errors) {
	return Boolean(errors?.title || errors?.releaseDate);
}

function hasAlbumErrors(errors) {
	if (!errors) return false;
	if (errors.albumPlacementsRoot) return true;
	return Array.isArray(errors.albumPlacements) && errors.albumPlacements.some((p) => p.albumId || p.trackNumber || p.discNumber);
}

function initFormFromPrefill(prefill = {}) {
	return {
		...emptyForm,
		title: prefill.title ?? '',
		releaseDate: prefill.releaseDate ?? '',
		soundcloudUrl: prefill.soundcloudUrl ?? '',
		spotifyUrl: prefill.spotifyUrl ?? '',
		appleMusicUrl: prefill.appleMusicUrl ?? '',
		youtubeUrl: prefill.youtubeUrl ?? '',
		...defaultVisibilityForReleaseDate(prefill.releaseDate ?? ''),
		albumPlacements: [{
			...createAlbumPlacement(),
			albumId: prefill.albumId ?? '',
			trackNumber: 1,
			discNumber: 1,
		}],
	};
}

function AlbumPlacementSelect({ id, value, albums, onChange, className, invalid }) {
	const [isOpen, setIsOpen] = useState(false);
	const [searchText, setSearchText] = useState('');
	const listboxId = useId();
	const rootRef = useRef(null);
	const selectedAlbum = albums.find((album) => album.id === value) ?? null;
	const query = searchText.trim().toLowerCase();
	const filteredAlbums = useMemo(
		() => albums.filter((album) => albumMatchesSearch(album, query)),
		[albums, query]
	);

	useEffect(() => {
		if (!isOpen) setSearchText(albumSearchLabel(selectedAlbum));
	}, [isOpen, selectedAlbum]);

	useEffect(() => {
		if (!isOpen) return undefined;

		const handlePointerDown = (event) => {
			if (!rootRef.current?.contains(event.target)) {
				setSearchText(albumSearchLabel(selectedAlbum));
				setIsOpen(false);
			}
		};
		const handleEscape = (event) => {
			if (event.key === 'Escape') {
				setSearchText(albumSearchLabel(selectedAlbum));
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', handlePointerDown);
		document.addEventListener('keydown', handleEscape);
		return () => {
			document.removeEventListener('mousedown', handlePointerDown);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isOpen, selectedAlbum]);

	const selectValue = (nextValue) => {
		onChange({ target: { value: nextValue } });
		setSearchText(albumSearchLabel(albums.find((album) => album.id === nextValue) ?? null));
		setIsOpen(false);
	};

	const renderAlbumOption = (album) => (
		<span className="admin-song-album-select-option-content">
			<span className="admin-song-album-select-title" title={album.title}>{album.title}</span>
			<span className="admin-song-album-select-artist" title={albumArtistName(album)}>{albumArtistName(album)}</span>
		</span>
	);

	return (
		<div className="admin-song-album-select" ref={rootRef}>
			<input
				id={id}
				type="text"
				className={`${className} admin-song-album-select-input`.trim()}
				role="combobox"
				aria-autocomplete="list"
				aria-controls={listboxId}
				aria-expanded={isOpen}
				aria-invalid={invalid}
				value={searchText}
				placeholder="- Album -"
				onFocus={(event) => {
					event.currentTarget.select();
					setIsOpen(true);
				}}
				onClick={() => setIsOpen(true)}
				onChange={(event) => {
					setSearchText(event.target.value);
					setIsOpen(true);
				}}
				onKeyDown={(event) => {
					if (event.key === 'ArrowDown') {
						event.preventDefault();
						setIsOpen(true);
					}
					if (event.key === 'Enter' && isOpen && filteredAlbums.length > 0) {
						event.preventDefault();
						selectValue(filteredAlbums[0].id);
					}
				}}
			/>
			{isOpen && (
				<div id={listboxId} className="admin-song-album-select-menu" role="listbox">
					<button
						type="button"
						role="option"
						aria-selected={!value}
						className={`admin-song-album-select-option ${!value ? 'admin-song-album-select-option-selected' : ''}`.trim()}
						onClick={() => selectValue('')}
					>
						<span className="admin-song-album-select-placeholder">- Album -</span>
					</button>
					{filteredAlbums.map((album) => (
						<button
							type="button"
							key={album.id}
							role="option"
							aria-selected={value === album.id}
							className={`admin-song-album-select-option ${value === album.id ? 'admin-song-album-select-option-selected' : ''}`.trim()}
							onClick={() => selectValue(album.id)}
						>
							{renderAlbumOption(album)}
						</button>
					))}
					{filteredAlbums.length === 0 && (
						<div className="admin-song-album-select-empty">No matching albums</div>
					)}
				</div>
			)}
		</div>
	);
}

export default function AdminSongFormModal({
	songId,
	prefill,
	songs,
	albums,
	token,
	session,
	onSaved,
	onClose,
}) {
	const isArtistScoped = session?.role === 'ARTIST';
	const isViewer = session?.role === 'VIEWER';

	const [form, setForm] = useState(null);
	const [validationErrors, setValidationErrors] = useState(null);
	const [activeTabIndex, setActiveTabIndex] = useState(0);
	const [visibilityTouched, setVisibilityTouched] = useState(false);
	const [loading, setLoading] = useState(Boolean(songId));
	const [loadError, setLoadError] = useState('');

	const albumById = useMemo(
		() => Object.fromEntries(albums.map((album) => [album.id, album])),
		[albums]
	);

	const sortedAlbums = useMemo(
		() => [...albums].sort(compareAlbumOptions),
		[albums]
	);

	useEffect(() => {
		if (!songId) {
			setForm(initFormFromPrefill(prefill ?? {}));
			setVisibilityTouched(false);
			setValidationErrors(null);
			setActiveTabIndex(0);
			setLoading(false);
			setLoadError('');
			return;
		}

		setLoading(true);
		setLoadError('');
		fetch(`/api/admin/songs?id=${songId}`, { headers: { Authorization: `Bearer ${token}` } })
			.then(async (response) => {
				const contentType = response.headers.get('content-type') ?? '';
				const payload = contentType.includes('application/json')
					? await response.json().catch(() => null)
					: await response.text().catch(() => '');

				if (!response.ok) {
					const message = payload && typeof payload === 'object'
						? payload.error
						: String(payload || '').trim();
					throw new Error(message || `Failed to load song (${response.status})`);
				}

				return payload;
			})
			.then((detail) => {
				setVisibilityTouched(hasManualSongVisibilityChoice(detail));
				setForm({
					...emptyForm,
					...detail,
					images: detail.images ?? [],
					aboutText: detail.meta?.aboutText ?? '',
					roles: Array.isArray(detail.meta?.roles)
						? detail.meta.roles.map((entry) => createRoleEntry(entry.role, entry.name))
						: [],
					tags: detail.meta?.tags ?? [],
					bpm: detail.meta?.bpm ?? '',
					key: detail.meta?.key ?? '',
					releaseDate: detail.meta?.releaseDate ? detail.meta.releaseDate.slice(0, 10) : '',
					albumPlacements: buildPlacementForm(detail),
				});
				setValidationErrors(null);
				setActiveTabIndex(0);
			})
			.catch((error) => {
				console.error(error);
				setLoadError(error instanceof Error ? error.message : 'Failed to load song.');
				setForm(null);
			})
			.finally(() => setLoading(false));
	}, [prefill, songId, token]);

	const set = (key) => (event) =>
		setForm((current) => {
			const nextValue = event.target.value;
			setValidationErrors((currentErrors) => currentErrors ? { ...currentErrors, [key]: '' } : currentErrors);
			return {
				...current,
				[key]: nextValue,
				...(key === 'title' ? { slug: slugify(nextValue) } : {}),
			};
		});

	const setReleaseDate = (value) =>
		setForm((current) => {
			setValidationErrors((currentErrors) => currentErrors ? { ...currentErrors, releaseDate: '' } : currentErrors);
			return {
				...current,
				releaseDate: value,
				...(!visibilityTouched ? defaultVisibilityForReleaseDate(value) : {}),
			};
		});

	const setBpm = (event) =>
		setForm((current) => {
			const value = event.target.value;
			if (value === '') return { ...current, bpm: '' };
			const numericValue = Number(value);
			if (!Number.isFinite(numericValue)) return current;
			return {
				...current,
				bpm: String(Math.min(999, Math.max(0, Math.trunc(numericValue)))),
			};
		});

	const addRole = () =>
		setForm((current) => ({
			...current,
			roles: [...current.roles, createRoleEntry()],
		}));

	const removeRole = (index) =>
		setForm((current) => ({
			...current,
			roles: current.roles.filter((_, i) => i !== index),
		}));

	const updateRole = (index, key, value) =>
		setForm((current) => ({
			...current,
			roles: current.roles.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)),
		}));

	const setAlbumPlacement = (index, key) => (event) =>
		setForm((current) => {
			const nextValue = key === 'albumId'
				? event.target.value
				: event.target.value === '' ? '' : Number(event.target.value);

			setValidationErrors((currentErrors) => {
				if (!currentErrors?.albumPlacements?.[index]) return currentErrors;
				return {
					...currentErrors,
					albumPlacementsRoot: '',
					albumPlacements: currentErrors.albumPlacements.map((placementErrors, i) =>
						i === index ? { ...placementErrors, [key]: '' } : placementErrors
					),
				};
			});

			return {
				...current,
				albumPlacements: current.albumPlacements.map((placement, i) =>
					i === index ? { ...placement, [key]: nextValue } : placement
				),
				...(() => {
					if (current.releaseDate || visibilityTouched) return {};
					const nextPlacements = current.albumPlacements.map((placement, i) =>
						i === index ? { ...placement, [key]: nextValue } : placement
					);
					const primaryAlbumReleaseDate = albumById[nextPlacements[0]?.albumId]?.releaseDate?.slice?.(0, 10) ?? '';
					return defaultVisibilityForReleaseDate(primaryAlbumReleaseDate);
				})(),
			};
		});

	const addAlbumPlacement = () =>
		setForm((current) => {
			setValidationErrors((currentErrors) => currentErrors
				? {
					...currentErrors,
					albumPlacementsRoot: '',
					albumPlacements: [...(currentErrors.albumPlacements ?? []), { albumId: '', trackNumber: '', discNumber: '' }],
				}
				: currentErrors);
			return { ...current, albumPlacements: [...current.albumPlacements, createAlbumPlacement()] };
		});

	const removeAlbumPlacement = (index) =>
		setForm((current) => {
			setValidationErrors((currentErrors) => currentErrors
				? {
					...currentErrors,
					albumPlacementsRoot: '',
					albumPlacements: (currentErrors.albumPlacements ?? []).filter((_, i) => i !== index),
				}
				: currentErrors);
			return {
				...current,
				albumPlacements: current.albumPlacements.filter((_, i) => i !== index),
				...(() => {
					if (current.releaseDate || visibilityTouched) return {};
					const nextPlacements = current.albumPlacements.filter((_, i) => i !== index);
					const primaryAlbumReleaseDate = albumById[nextPlacements[0]?.albumId]?.releaseDate?.slice?.(0, 10) ?? '';
					return defaultVisibilityForReleaseDate(primaryAlbumReleaseDate);
				})(),
			};
		});

	const handleSave = async () => {
		const nextErrors = validateSongForm(form, songs ?? [], albumById);
		if (hasSongValidationErrors(nextErrors)) {
			setValidationErrors(nextErrors);
			if (hasAlbumErrors(nextErrors) && !hasSongInfoErrors(nextErrors)) setActiveTabIndex(2);
			return;
		}
		setValidationErrors(null);

		const isEdit = Boolean(form.id);
		const url = isEdit ? `/api/admin/songs?id=${form.id}` : '/api/admin/songs';
		const payload = {
			...form,
			slug: slugify(form.title),
			albumIds: form.albumPlacements.map((p) => p.albumId),
			discNumbers: form.albumPlacements.map((p) => Number(p.discNumber)),
			trackNumbers: form.albumPlacements.map((p) => Number(p.trackNumber)),
			roles: form.roles.map(({ role, name }) => ({ role, name })),
			albumPlacements: form.albumPlacements.map(({ albumId, trackNumber, discNumber }) => ({ albumId, trackNumber, discNumber })),
		};

		const response = await fetch(url, {
			method: isEdit ? 'PUT' : 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});

		if (!response.ok) {
			const error = await response.json().catch(() => ({ error: 'Failed to save song.' }));
			window.alert(error.error ?? 'Failed to save song.');
			return;
		}

		onSaved(await response.json());
	};

	const songFieldClassName = (fieldName) =>
		`admin-artists-page-input${validationErrors?.[fieldName] ? ' admin-artists-page-input-invalid' : ''}`;

	const placementFieldClassName = (index, fieldName) =>
		`admin-artists-page-input${validationErrors?.albumPlacements?.[index]?.[fieldName] ? ' admin-artists-page-input-invalid' : ''}`;

	return (
		<div className="admin-modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<div className="admin-modal admin-song-modal">
				<div className="admin-modal-header">
					<h2 className="admin-modal-title">{form?.id ? 'Edit Song' : 'New Song'}</h2>
					<button type="button" onClick={onClose} className="admin-modal-close" aria-label="Close">
						<FaTimes aria-hidden="true" />
					</button>
				</div>
				<div className="admin-modal-body">
					{loading ? (
						<div className="admin-modal-loading">Loading…</div>
					) : loadError ? (
						<div className="admin-song-modal-error">{loadError}</div>
					) : !form ? (
						<div className="admin-song-modal-error">Song could not be loaded.</div>
					) : (
						<TabView activeIndex={activeTabIndex} onTabChange={(e) => setActiveTabIndex(e.index)} className="page-tabview admin-song-editor-tabs">
							<TabPanel header="Song">
								<div className="admin-modal-grid">
									<div className="admin-modal-field admin-modal-field-full">
										<div className="admin-artists-page-name-field">
											<button
												type="button"
												onClick={() => {
													setVisibilityTouched(true);
													setForm((current) => ({ ...current, isVisible: !current.isVisible, autoShowOnRelease: false }));
												}}
												className={`admin-artists-page-visibility-toggle ${form.isVisible ? '' : 'admin-artists-page-visibility-toggle-hidden'}`.trim()}
												aria-label={form.isVisible ? 'Song is visible to the public. Click to hide.' : 'Song is hidden from the public. Click to show.'}
												title={form.isVisible ? 'Visible on public site' : 'Hidden from public site'}
											>
												{form.isVisible ? <FaEye aria-hidden="true" /> : <FaEyeSlash aria-hidden="true" />}
											</button>
											<div className="admin-artists-page-name-field-main">
												<label htmlFor="admin-song-title" className="admin-modal-label">Title <span className="admin-modal-label-required">*</span></label>
												<input id="admin-song-title" type="text" placeholder="Title" value={form.title} onChange={set('title')} className={songFieldClassName('title')} aria-invalid={Boolean(validationErrors?.title)} />
											</div>
										</div>
									</div>
									<div className="admin-modal-field admin-modal-field-full">
										<div className="admin-modal-label">Images</div>
										<ImageCollectionField
											value={form.images}
											onChange={(images) => setForm((current) => ({ ...current, images }))}
											token={token}
											folder="songs"
											entityLabel={form.title || 'Song image'}
										/>
									</div>
									<div className="admin-song-metadata-grid admin-modal-field-full">
										<div className="admin-modal-field admin-song-metadata-field-duration">
											<label htmlFor="admin-song-duration" className="admin-modal-label">Duration</label>
											<input id="admin-song-duration" type="text" placeholder="e.g. 3:42" value={form.duration} onChange={set('duration')} className="admin-artists-page-input" />
										</div>
										<div className="admin-modal-field">
											<label htmlFor="admin-song-release-date" className="admin-modal-label">Release Date</label>
											<AdminDateInput id="admin-song-release-date" value={form.releaseDate} onChange={setReleaseDate} className={songFieldClassName('releaseDate')} ariaInvalid={Boolean(validationErrors?.releaseDate)} />
										</div>
										<div className="admin-modal-field admin-song-metadata-field-bpm">
											<label htmlFor="admin-song-bpm" className="admin-modal-label">BPM</label>
											<input id="admin-song-bpm" type="number" min="0" max="999" step="1" placeholder="e.g. 120" value={form.bpm} onChange={setBpm} className="admin-artists-page-input" />
										</div>
										<div className="admin-modal-field">
											<label htmlFor="admin-song-key" className="admin-modal-label">Key</label>
											<select id="admin-song-key" value={form.key} onChange={set('key')} className="admin-artists-page-input">
												<option value="">- Key -</option>
												{SONG_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
											</select>
										</div>
									</div>
									<div className="admin-modal-field admin-modal-field-full">
										<label htmlFor="admin-song-about" className="admin-modal-label">About</label>
										<textarea id="admin-song-about" placeholder="About this song..." value={form.aboutText} onChange={set('aboutText')} className="admin-artists-page-input admin-modal-textarea" rows={5} />
									</div>
									<div className="admin-modal-field admin-modal-field-full">
										<div className="admin-modal-label">Tags</div>
										<ChipInputField
											value={form.tags}
											onChange={(tags) => setForm((current) => ({ ...current, tags }))}
											placeholder="Type a tag and press Enter"
										/>
									</div>
								</div>
							</TabPanel>
							<TabPanel header="Links">
								<div className="admin-modal-grid">
									<div className="admin-modal-field admin-modal-field-full">
										<label className="admin-modal-label">{iconLabel(<SiSoundcloud />, 'SoundCloud URL')}</label>
										<input type="text" placeholder="SoundCloud URL" value={form.soundcloudUrl} onChange={set('soundcloudUrl')} className="admin-artists-page-input" />
									</div>
									<div className="admin-modal-field admin-modal-field-full">
										<label className="admin-modal-label">{iconLabel(<SiSpotify />, 'Spotify URL')}</label>
										<input type="text" placeholder="Spotify URL" value={form.spotifyUrl} onChange={set('spotifyUrl')} className="admin-artists-page-input" />
									</div>
									<div className="admin-modal-field admin-modal-field-full">
										<label className="admin-modal-label">{iconLabel(<SiApplemusic />, 'Apple Music URL')}</label>
										<input type="text" placeholder="Apple Music URL" value={form.appleMusicUrl} onChange={set('appleMusicUrl')} className="admin-artists-page-input" />
									</div>
									<div className="admin-modal-field admin-modal-field-full">
										<label className="admin-modal-label">{iconLabel(<SiYoutube />, 'YouTube URL')}</label>
										<input type="text" placeholder="YouTube URL" value={form.youtubeUrl} onChange={set('youtubeUrl')} className="admin-artists-page-input" />
									</div>
								</div>
							</TabPanel>
							<TabPanel header="Albums">
								<div className="admin-song-tab-layout">
									<div className="admin-song-tab-scroll">
										<div className="admin-song-album-cards">
											{form.albumPlacements.map((placement, index) => (
												<div key={placement.clientKey ?? placement.albumId} className="admin-song-album-card">
													<div className="admin-song-album-card-header">
														<h3 className="admin-song-album-card-title">Album {index + 1}</h3>
														{form.albumPlacements.length > 1 && (
															<button type="button" onClick={() => removeAlbumPlacement(index)} className="admin-artists-page-danger-btn">Remove</button>
														)}
													</div>
													<div className="admin-modal-grid admin-song-album-grid">
														<div className="admin-modal-field admin-modal-field-full">
															<label htmlFor={`admin-song-${placement.clientKey}-album`} className="admin-modal-label">Album <span className="admin-modal-label-required">*</span></label>
															<AlbumPlacementSelect
																id={`admin-song-${placement.clientKey}-album`}
																value={placement.albumId}
																albums={sortedAlbums}
																onChange={setAlbumPlacement(index, 'albumId')}
																className={placementFieldClassName(index, 'albumId')}
																invalid={Boolean(validationErrors?.albumPlacements?.[index]?.albumId)}
															/>
														</div>
														<div className="admin-modal-field">
															<label htmlFor={`admin-song-${placement.clientKey}-track-number`} className="admin-modal-label">Track # <span className="admin-modal-label-required">*</span></label>
															<input id={`admin-song-${placement.clientKey}-track-number`} type="number" placeholder="Track #" value={placement.trackNumber} onChange={setAlbumPlacement(index, 'trackNumber')} className={placementFieldClassName(index, 'trackNumber')} aria-invalid={Boolean(validationErrors?.albumPlacements?.[index]?.trackNumber)} />
														</div>
														<div className="admin-modal-field">
															<label htmlFor={`admin-song-${placement.clientKey}-disc-number`} className="admin-modal-label">Disc # <span className="admin-modal-label-required">*</span></label>
															<input id={`admin-song-${placement.clientKey}-disc-number`} type="number" placeholder="Disc #" value={placement.discNumber} onChange={setAlbumPlacement(index, 'discNumber')} className={placementFieldClassName(index, 'discNumber')} aria-invalid={Boolean(validationErrors?.albumPlacements?.[index]?.discNumber)} />
														</div>
													</div>
												</div>
											))}
										</div>
									</div>
									<div className="admin-song-tab-actions">
										<button
											type="button"
											onClick={addAlbumPlacement}
											className="admin-artists-page-ghost-btn admin-song-add-album-btn"
											aria-label={isArtistScoped ? 'Add album placement' : 'Add album'}
											title={isArtistScoped ? 'Add album placement' : 'Add album'}
										>
											<FaPlus aria-hidden="true" />
										</button>
									</div>
								</div>
							</TabPanel>
							<TabPanel header="Roles">
								<div className="admin-song-tab-layout">
									<div className="admin-song-tab-scroll">
										<div className="admin-song-roles-list">
											{form.roles.map((entry, index) => (
												<div key={entry.clientKey ?? `${entry.role}:${entry.name}`} className="admin-song-role-row">
													<select value={entry.role} onChange={(e) => updateRole(index, 'role', e.target.value)} className="admin-artists-page-input">
														{SONG_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
													</select>
													<input
														type="text"
														placeholder="Name"
														value={entry.name}
														onChange={(e) => updateRole(index, 'name', e.target.value)}
														className="admin-artists-page-input"
													/>
													<button type="button" onClick={() => removeRole(index)} className="admin-artists-page-danger-btn" aria-label="Remove role">
														<FaTimes aria-hidden="true" />
													</button>
												</div>
											))}
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
							</TabPanel>
						</TabView>
					)}
				</div>
				<div className="admin-modal-footer">
					<button type="button" onClick={onClose} className="admin-artists-page-ghost-btn">Cancel</button>
					{!isViewer && (
						<button type="button" onClick={handleSave} disabled={loading || !form} className="admin-artists-page-primary-btn">Save</button>
					)}
				</div>
			</div>
		</div>
	);
}
