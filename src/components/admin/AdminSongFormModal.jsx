import { useEffect, useId, useMemo, useReducer, useRef, useState } from 'react';
import { TabPanel, TabView } from 'primereact/tabview';
import { FaEye, FaEyeSlash, FaPlus, FaTimes } from 'react-icons/fa';
import { SiApplemusic, SiSoundcloud, SiSpotify, SiYoutube } from 'react-icons/si';
import AdminDateInput from './AdminDateInput.jsx';
import { isValidDateInput } from '../../lib/dateInput.js';
import ImageCollectionField from './ImageCollectionField.jsx';
import ChipInputField from './ChipInputField.jsx';
import MusicRolePersonPickerField from './MusicRolePersonPickerField.jsx';
import { SONG_ROLES } from '../../lib/songRoles.js';
import {
	createAlbumPlacement,
	createRoleEntry,
	emptySongForm,
	initSongFormFromPrefill,
} from '../../lib/adminSongForm.js';
import { defaultVisibilityForReleaseDate } from '../../lib/contentVisibility.js';
import { isOtherArtist, OTHER_ARTIST_NAME } from '../../lib/publicVisibility.js';
import { slugify } from '../../lib/slugify.js';
import '../../styles/AdminArtistsPage.css';
import '../../styles/AdminSongsPage.css';

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

const initialSongModalState = {
	form: null,
	validationErrors: null,
	activeTabIndex: 0,
	loadStatus: { pending: false, error: '' },
};

function clearFieldError(errors, fieldName) {
	return errors ? { ...errors, [fieldName]: '' } : errors;
}

function songModalReducer(state, action) {
	switch (action.type) {
		case 'init-create':
			return {
				...state,
				form: action.form,
				validationErrors: null,
				activeTabIndex: 0,
				loadStatus: { pending: false, error: '' },
			};
		case 'load-start':
			return {
				...state,
				loadStatus: { pending: true, error: '' },
			};
		case 'load-success':
			return {
				...state,
				form: action.form,
				validationErrors: null,
				activeTabIndex: 0,
				loadStatus: { pending: false, error: '' },
			};
		case 'load-failure':
			return {
				...state,
				form: null,
				loadStatus: { pending: false, error: action.error },
			};
		case 'set-form':
			return {
				...state,
				form: state.form ? action.updater(state.form) : state.form,
			};
		case 'set-field': {
			const nextValue = action.value;
			return {
				...state,
				form: {
					...state.form,
					[action.fieldName]: nextValue,
					...(action.fieldName === 'title' ? { slug: slugify(nextValue) } : {}),
				},
				validationErrors: clearFieldError(state.validationErrors, action.fieldName),
			};
		}
		case 'set-release-date':
			return {
				...state,
				form: {
					...state.form,
					releaseDate: action.value,
					...(!action.visibilityTouched ? defaultVisibilityForReleaseDate(action.value) : {}),
				},
				validationErrors: clearFieldError(state.validationErrors, 'releaseDate'),
			};
		case 'set-album-placement': {
			const nextPlacements = state.form.albumPlacements.map((placement, i) =>
				i === action.index ? { ...placement, [action.fieldName]: action.value } : placement
			);
			const primaryAlbumReleaseDate = state.form.releaseDate || action.visibilityTouched
				? ''
				: action.albumById[nextPlacements[0]?.albumId]?.releaseDate?.slice?.(0, 10) ?? '';
			return {
				...state,
				form: {
					...state.form,
					albumPlacements: nextPlacements,
					...(state.form.releaseDate || action.visibilityTouched ? {} : defaultVisibilityForReleaseDate(primaryAlbumReleaseDate)),
				},
				validationErrors: state.validationErrors?.albumPlacements?.[action.index]
					? {
						...state.validationErrors,
						albumPlacementsRoot: '',
						albumPlacements: state.validationErrors.albumPlacements.map((placementErrors, i) =>
							i === action.index ? { ...placementErrors, [action.fieldName]: '' } : placementErrors
						),
					}
					: state.validationErrors,
			};
		}
		case 'add-album-placement':
			return {
				...state,
				form: { ...state.form, albumPlacements: [...state.form.albumPlacements, createAlbumPlacement()] },
				validationErrors: state.validationErrors
					? {
						...state.validationErrors,
						albumPlacementsRoot: '',
						albumPlacements: [...(state.validationErrors.albumPlacements ?? []), { albumId: '', trackNumber: '', discNumber: '' }],
					}
					: state.validationErrors,
			};
		case 'remove-album-placement': {
			const nextPlacements = state.form.albumPlacements.filter((_, i) => i !== action.index);
			const primaryAlbumReleaseDate = state.form.releaseDate || action.visibilityTouched
				? ''
				: action.albumById[nextPlacements[0]?.albumId]?.releaseDate?.slice?.(0, 10) ?? '';
			return {
				...state,
				form: {
					...state.form,
					albumPlacements: nextPlacements,
					...(state.form.releaseDate || action.visibilityTouched ? {} : defaultVisibilityForReleaseDate(primaryAlbumReleaseDate)),
				},
				validationErrors: state.validationErrors
					? {
						...state.validationErrors,
						albumPlacementsRoot: '',
						albumPlacements: (state.validationErrors.albumPlacements ?? []).filter((_, i) => i !== action.index),
					}
					: state.validationErrors,
			};
		}
		case 'set-validation-errors':
			return {
				...state,
				validationErrors: action.errors,
				activeTabIndex: action.activeTabIndex ?? state.activeTabIndex,
			};
		case 'set-active-tab':
			return {
				...state,
				activeTabIndex: action.index,
			};
		default:
			return state;
	}
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
		const selectedAlbumIds = form.albumPlacements.flatMap((p) => (p.albumId ? [p.albumId] : []));
		const selectedAlbumIdSet = new Set(selectedAlbumIds);

		const duplicateSong = songs.find((song) => {
			if (song.id === form.id) return false;
			if (normalizeSongDuplicateValue(song.title) !== normalizedTitle) return false;
			if (normalizeSongReleaseDate(song.meta?.releaseDate) !== normalizedReleaseDate) return false;
			return placementAlbumIds(song).some((albumId) => {
				if (!selectedAlbumIdSet.has(albumId)) return false;
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

function createInitialSongModalState({ initialForm, prefill }) {
	return {
		...initialSongModalState,
		form: initialForm ?? initSongFormFromPrefill(prefill ?? {}),
	};
}

function renderAlbumOption(album) {
	return (
		<span className="admin-song-album-select-option-content">
			<span className="admin-song-album-select-title" title={album.title}>{album.title}</span>
			<span className="admin-song-album-select-artist" title={albumArtistName(album)}>{albumArtistName(album)}</span>
		</span>
	);
}

function AlbumPlacementSelect({ id, value, albums, onChange, className, invalid }) {
	const [isOpen, setIsOpen] = useState(false);
	const [searchText, setSearchText] = useState('');
	const listboxId = useId();
	const rootRef = useRef(null);
	const selectedAlbum = albums.find((album) => album.id === value) ?? null;
	const selectedAlbumLabel = albumSearchLabel(selectedAlbum);
	const query = searchText.trim().toLowerCase();
	const filteredAlbums = useMemo(
		() => albums.filter((album) => albumMatchesSearch(album, query)),
		[albums, query]
	);

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
				value={isOpen ? searchText : selectedAlbumLabel}
				placeholder="- Album -"
				onFocus={(event) => {
					setSearchText(selectedAlbumLabel);
					event.currentTarget.select();
					setIsOpen(true);
				}}
				onClick={() => {
					setSearchText(selectedAlbumLabel);
					setIsOpen(true);
				}}
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

function SongInfoTab({
	form,
	validationErrors,
	token,
	setForm,
	setField,
	setReleaseDate,
	setBpm,
	songFieldClassName,
	visibilityTouchedRef,
}) {
	return (
		<div className="admin-modal-grid">
			<div className="admin-modal-field admin-modal-field-full">
				<div className="admin-artists-page-name-field">
					<button
						type="button"
						onClick={() => {
							visibilityTouchedRef.current = true;
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
						<input id="admin-song-title" type="text" placeholder="Title" value={form.title} onChange={setField('title')} className={songFieldClassName('title')} aria-invalid={Boolean(validationErrors?.title)} />
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
					<input id="admin-song-duration" type="text" placeholder="e.g. 3:42" value={form.duration} onChange={setField('duration')} className="admin-artists-page-input" />
				</div>
				<div className="admin-modal-field">
					<label htmlFor="admin-song-release-date" className="admin-modal-label">Release Date</label>
					<AdminDateInput id="admin-song-release-date" ariaLabel="Song release date" value={form.releaseDate} onChange={setReleaseDate} className={songFieldClassName('releaseDate')} ariaInvalid={Boolean(validationErrors?.releaseDate)} />
				</div>
				<div className="admin-modal-field admin-song-metadata-field-bpm">
					<label htmlFor="admin-song-bpm" className="admin-modal-label">BPM</label>
					<input id="admin-song-bpm" type="number" min="0" max="999" step="1" placeholder="e.g. 120" value={form.bpm} onChange={setBpm} className="admin-artists-page-input" />
				</div>
				<div className="admin-modal-field">
					<label htmlFor="admin-song-key" className="admin-modal-label">Key</label>
					<select id="admin-song-key" value={form.key} onChange={setField('key')} className="admin-artists-page-input">
						<option value="">- Key -</option>
						{SONG_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
					</select>
				</div>
			</div>
			<div className="admin-modal-field admin-modal-field-full">
				<label htmlFor="admin-song-about" className="admin-modal-label">About</label>
				<textarea id="admin-song-about" placeholder="About this song..." value={form.aboutText} onChange={setField('aboutText')} className="admin-artists-page-input admin-modal-textarea" rows={5} />
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
	);
}

function SongLinksTab({ form, setField }) {
	return (
		<div className="admin-modal-grid">
			<div className="admin-modal-field admin-modal-field-full">
				<label className="admin-modal-label">{iconLabel(<SiSoundcloud />, 'SoundCloud URL')}</label>
				<input type="text" placeholder="SoundCloud URL" value={form.soundcloudUrl} onChange={setField('soundcloudUrl')} className="admin-artists-page-input" />
			</div>
			<div className="admin-modal-field admin-modal-field-full">
				<label className="admin-modal-label">{iconLabel(<SiSpotify />, 'Spotify URL')}</label>
				<input type="text" placeholder="Spotify URL" value={form.spotifyUrl} onChange={setField('spotifyUrl')} className="admin-artists-page-input" />
			</div>
			<div className="admin-modal-field admin-modal-field-full">
				<label className="admin-modal-label">{iconLabel(<SiApplemusic />, 'Apple Music URL')}</label>
				<input type="text" placeholder="Apple Music URL" value={form.appleMusicUrl} onChange={setField('appleMusicUrl')} className="admin-artists-page-input" />
			</div>
			<div className="admin-modal-field admin-modal-field-full">
				<label className="admin-modal-label">{iconLabel(<SiYoutube />, 'YouTube URL')}</label>
				<input type="text" placeholder="YouTube URL" value={form.youtubeUrl} onChange={setField('youtubeUrl')} className="admin-artists-page-input" />
			</div>
		</div>
	);
}

function SongAlbumsTab({
	form,
	sortedAlbums,
	validationErrors,
	isArtistScoped,
	setAlbumPlacement,
	placementFieldClassName,
	removeAlbumPlacement,
	addAlbumPlacement,
}) {
	return (
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
	);
}

function selectedRoleImage(entry, artistOptions, outsideArtistOptions) {
	const selected = entry.artistId
		? artistOptions.find((artist) => artist.id === entry.artistId)
		: entry.outsideArtistId
			? outsideArtistOptions.find((artist) => artist.id === entry.outsideArtistId)
			: null;

	return selected?.image ?? null;
}

function SongRolesTab({ form, artistOptions, outsideArtistOptions, addRole, removeRole, updateRole }) {
	return (
		<div className="admin-song-tab-layout">
			<div className="admin-song-tab-scroll">
				<div className="admin-song-roles-list">
					{form.roles.map((entry, index) => {
						const image = selectedRoleImage(entry, artistOptions, outsideArtistOptions);

						return (
							<div key={entry.clientKey ?? `${entry.role}:${entry.name}`} className="admin-song-role-row">
								<div className="admin-song-role-thumb" aria-hidden="true">
									{image ? (
										<img src={image.previewUrl || image.url} alt="" className="admin-song-role-thumb-img" />
									) : null}
								</div>
								<MusicRolePersonPickerField
									name={entry.name}
									artistId={entry.artistId}
									outsideArtistId={entry.outsideArtistId}
									artistOptions={artistOptions}
									outsideArtistOptions={outsideArtistOptions}
									onChange={(patch) => updateRole(index, patch)}
								/>
								<select value={entry.role} onChange={(e) => updateRole(index, 'role', e.target.value)} className="admin-artists-page-input" aria-label={`Role type ${index + 1}`}>
									{SONG_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
								</select>
								<button type="button" onClick={() => removeRole(index)} className="admin-artists-page-danger-btn admin-artists-page-icon-btn" aria-label="Remove role" title="Remove role">
									<FaTimes aria-hidden="true" />
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

function SongEditorTabs(props) {
	return (
		<TabView activeIndex={props.activeTabIndex} onTabChange={props.onTabChange} className="page-tabview admin-song-editor-tabs">
			<TabPanel header="Song">
				<SongInfoTab {...props} />
			</TabPanel>
			<TabPanel header="Links">
				<SongLinksTab form={props.form} setField={props.setField} />
			</TabPanel>
			<TabPanel header="Albums">
				<SongAlbumsTab {...props} />
			</TabPanel>
			<TabPanel header="Roles">
				<SongRolesTab {...props} />
			</TabPanel>
		</TabView>
	);
}

export default function AdminSongFormModal({
	initialForm,
	initialVisibilityTouched = false,
	prefill,
	songs,
	albums,
	artists = [],
	outsideArtists = [],
	token,
	session,
	onSaved,
	onClose,
}) {
	const isArtistScoped = session?.role === 'ARTIST';
	const isViewer = session?.role === 'VIEWER';

	const [modalState, dispatchModal] = useReducer(
		songModalReducer,
		{ initialForm, prefill },
		createInitialSongModalState
	);
	const visibilityTouchedRef = useRef(initialVisibilityTouched);
	const { form, validationErrors, activeTabIndex } = modalState;

	const albumById = useMemo(
		() => Object.fromEntries(albums.map((album) => [album.id, album])),
		[albums]
	);

	const sortedAlbums = useMemo(
		() => albums.toSorted(compareAlbumOptions),
		[albums]
	);

	const sortedArtists = useMemo(
		() => artists.toSorted((left, right) => compareText(left.name, right.name)),
		[artists]
	);

	const sortedOutsideArtists = useMemo(
		() => outsideArtists.toSorted((left, right) => compareText(left.name, right.name)),
		[outsideArtists]
	);

	const setForm = (updater) => dispatchModal({ type: 'set-form', updater });

	const setField = (key) => (event) => {
		dispatchModal({ type: 'set-field', fieldName: key, value: event.target.value });
	};

	const setReleaseDate = (value) => {
		dispatchModal({ type: 'set-release-date', value, visibilityTouched: visibilityTouchedRef.current });
	};

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

	const updateRole = (index, keyOrPatch, value) =>
		setForm((current) => ({
			...current,
			roles: current.roles.map((entry, i) => {
				if (i !== index) return entry;

				const patch = typeof keyOrPatch === 'string'
					? { [keyOrPatch]: value }
					: keyOrPatch;
				const next = { ...entry, ...patch };
				if (patch._prefillRole && (!entry.role || entry.role === 'Featured Artist')) next.role = patch._prefillRole;
				delete next._prefillRole;
				return next;
			}),
		}));

	const setAlbumPlacement = (index, key) => (event) =>
		{
			const nextValue = key === 'albumId'
				? event.target.value
				: event.target.value === '' ? '' : Number(event.target.value);
			dispatchModal({
				type: 'set-album-placement',
				index,
				fieldName: key,
				value: nextValue,
				albumById,
				visibilityTouched: visibilityTouchedRef.current,
			});
		};

	const addAlbumPlacement = () => {
		dispatchModal({ type: 'add-album-placement' });
	};

	const removeAlbumPlacement = (index) => {
		dispatchModal({
			type: 'remove-album-placement',
			index,
			albumById,
			visibilityTouched: visibilityTouchedRef.current,
		});
	};

	const handleSave = async () => {
		const nextErrors = validateSongForm(form, songs ?? [], albumById);
		if (hasSongValidationErrors(nextErrors)) {
			dispatchModal({
				type: 'set-validation-errors',
				errors: nextErrors,
				activeTabIndex: hasAlbumErrors(nextErrors) && !hasSongInfoErrors(nextErrors) ? 2 : undefined,
			});
			return;
		}
		dispatchModal({ type: 'set-validation-errors', errors: null });

		const isEdit = Boolean(form.id);
		const url = isEdit ? `/api/admin/songs?id=${form.id}` : '/api/admin/songs';
		const payload = {
			...form,
			slug: slugify(form.title),
			albumIds: form.albumPlacements.map((p) => p.albumId),
			discNumbers: form.albumPlacements.map((p) => Number(p.discNumber)),
			trackNumbers: form.albumPlacements.map((p) => Number(p.trackNumber)),
			roles: form.roles.map(({ role, name, artistId, outsideArtistId, externalUrl }) => ({
				role,
				name,
				artistId,
				outsideArtistId,
				externalUrl,
			})),
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
		<div className="admin-modal-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
			<div className="admin-modal admin-song-modal">
				<div className="admin-modal-header">
					<h2 className="admin-modal-title">{form?.id ? 'Edit Song' : 'New Song'}</h2>
					<button type="button" onClick={onClose} className="admin-modal-close" aria-label="Close">
						<FaTimes aria-hidden="true" />
					</button>
				</div>
				<div className="admin-modal-body">
					{!form ? (
						<div className="admin-song-modal-error">Song could not be loaded.</div>
					) : (
						<SongEditorTabs
							activeTabIndex={activeTabIndex}
							onTabChange={(e) => dispatchModal({ type: 'set-active-tab', index: e.index })}
							form={form}
							validationErrors={validationErrors}
							token={token}
							setForm={setForm}
							setField={setField}
							setReleaseDate={setReleaseDate}
							setBpm={setBpm}
							songFieldClassName={songFieldClassName}
							visibilityTouchedRef={visibilityTouchedRef}
							sortedAlbums={sortedAlbums}
							artistOptions={sortedArtists}
							outsideArtistOptions={sortedOutsideArtists}
							isArtistScoped={isArtistScoped}
							setAlbumPlacement={setAlbumPlacement}
							placementFieldClassName={placementFieldClassName}
							removeAlbumPlacement={removeAlbumPlacement}
							addAlbumPlacement={addAlbumPlacement}
							addRole={addRole}
							removeRole={removeRole}
							updateRole={updateRole}
						/>
					)}
				</div>
				<div className="admin-modal-footer">
					<button type="button" onClick={onClose} className="admin-artists-page-ghost-btn">Cancel</button>
					{!isViewer && (
						<button type="button" onClick={handleSave} disabled={!form} className="admin-artists-page-primary-btn">Save</button>
					)}
				</div>
			</div>
		</div>
	);
}
