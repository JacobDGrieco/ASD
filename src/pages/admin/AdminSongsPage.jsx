import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import { slugify } from '../../lib/slugify.js'
import ImageCollectionField from '../../components/admin/ImageCollectionField.jsx'
import ChipInputField from '../../components/admin/ChipInputField.jsx'
import '../../styles/AdminArtistsPage.css'
import { SiSoundcloud, SiSpotify, SiApplemusic } from "react-icons/si";

const PAGE_SIZE = 30;

const empty = {
	title: '', slug: '', trackNumber: 1, discNumber: 1, duration: '',
	soundcloudUrl: '', spotifyUrl: '', appleMusicUrl: '', albumId: '',
	aboutText: '', producers: '', writers: '', featuredArtists: '', releaseDate: '',
	images: [], tags: [],
};

function primaryImage(images) {
	if (!Array.isArray(images) || images.length === 0) return null;
	return images.find((image) => image.isPrimary) ?? images[0];
}

function compareLexicographically(left, right) {
	return left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true });
}

function validateSongForm(form) {
	if (!form.title?.trim()) return 'Song title is required.';
	if (!form.albumId) return 'Album is required.';
	if (!form.trackNumber || Number(form.trackNumber) < 1) return 'Track number must be at least 1.';
	if (!form.discNumber || Number(form.discNumber) < 1) return 'Disc number must be at least 1.';
	return null;
}

export default function AdminSongsPage() {
	const { token } = useAdminAuth();
	const auth = { Authorization: `Bearer ${token}` };
	const [songs, setSongs] = useState([]);
	const [albums, setAlbums] = useState([]);
	const [artists, setArtists] = useState([]);
	const [form, setForm] = useState(null);
	const [filterArtist, setFilterArtist] = useState('');
	const [filterAlbum, setFilterAlbum] = useState('');
	const [page, setPage] = useState(1);

	useEffect(() => {
		Promise.all([
			fetch('/api/admin/songs', { headers: auth }).then((r) => r.json()),
			fetch('/api/admin/albums', { headers: auth }).then((r) => r.json()),
			fetch('/api/admin/artists', { headers: auth }).then((r) => r.json()),
		]).then(([songList, albumList, artistList]) => {
			setSongs(songList);
			setAlbums(albumList);
			setArtists(artistList);
		});
	}, [token]);

	useEffect(() => {
		setPage(1);
		setFilterAlbum('');
	}, [filterArtist]);

	useEffect(() => {
		setPage(1);
	}, [filterAlbum]);

	const albumById = Object.fromEntries(albums.map((a) => [a.id, a]));

	const albumOptions = filterArtist
		? albums.filter((a) => a.artistId === filterArtist)
		: albums;
	const sortedArtists = [...artists].sort((left, right) => compareLexicographically(left.name, right.name));
	const sortedAlbumOptions = [...albumOptions].sort((left, right) => compareLexicographically(left.title, right.title));
	const sortedAlbums = [...albums].sort((left, right) => compareLexicographically(left.title, right.title));

	const filteredSongs = songs.filter((song) => {
		if (filterAlbum && song.albumId !== filterAlbum) return false;
		if (filterArtist) {
			const album = albumById[song.albumId];
			if (!album || album.artistId !== filterArtist) return false;
		}
		return true;
	});

	const totalPages = Math.max(1, Math.ceil(filteredSongs.length / PAGE_SIZE));
	const pagedSongs = filteredSongs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

	const openCreate = () => setForm({ ...empty });
	const openEdit = (song) => setForm({
		...empty,
		...song,
		images: song.images ?? [],
		aboutText: song.meta?.aboutText ?? '',
		producers: song.meta?.producers ?? '',
		writers: song.meta?.writers ?? '',
		featuredArtists: song.meta?.featuredArtists ?? '',
		tags: song.meta?.tags ?? [],
		releaseDate: song.meta?.releaseDate ? song.meta.releaseDate.slice(0, 10) : '',
	});
	const closeForm = () => setForm(null);

	const handleSave = async () => {
		const validationError = validateSongForm(form);
		if (validationError) {
			window.alert(validationError);
			return;
		}

		const isEdit = Boolean(form.id);
		const url = isEdit ? `/api/admin/songs?id=${form.id}` : '/api/admin/songs';
		const payload = {
			...form,
			slug: slugify(form.title),
		};
		const res = await fetch(url, {
			method: isEdit ? 'PUT' : 'POST',
			headers: { ...auth, 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		const saved = await res.json();
		const album = albums.find((candidate) => candidate.id === saved.albumId);
		const withRelations = {
			...saved,
			images: saved.images ?? [],
			album: album ? { title: album.title, artist: album.artist, releaseDate: album.releaseDate } : null,
			meta: { aboutText: form.aboutText, producers: form.producers, writers: form.writers, featuredArtists: form.featuredArtists, tags: form.tags, releaseDate: form.releaseDate || null },
		};
		setSongs((prev) => isEdit ? prev.map((song) => song.id === saved.id ? withRelations : song) : [...prev, withRelations]);
		closeForm();
	};

	const handleDelete = async (id) => {
		if (!window.confirm('Delete this song and all its lyrics/annotations?')) return;
		await fetch(`/api/admin/songs?id=${id}`, { method: 'DELETE', headers: auth });
		setSongs((prev) => prev.filter((song) => song.id !== id));
	};

	const set = (key) => (e) => setForm((current) => ({
		...current,
		[key]: e.target.value,
		...(key === 'title' ? { slug: slugify(e.target.value) } : {}),
	}));
	const setNum = (key) => (e) => setForm((current) => ({ ...current, [key]: Number(e.target.value) }));

	const cell = (v) => v
		? <span className="admin-artists-page-cell-value" title={String(v)}>{String(v)}</span>
		: <span className="admin-artists-page-empty-value">-</span>;

	const wrapCell = (v) => v
		? <span className="admin-artists-page-wrap-value" title={String(v)}>{String(v)}</span>
		: <span className="admin-artists-page-empty-value">-</span>;

	const linkCell = (song, key, label) => {
		const value = song[key];
		return value
			? <a href={String(value)} target="_blank" rel="noreferrer" className="admin-artists-page-link-btn" aria-label={`Open ${label} link`} title="Open in new tab">↗</a>
			: <span className="admin-artists-page-empty-value">-</span>;
	};

	const artistName = (song) => {
		const album = albumById[song.albumId];
		if (album?.artist?.name) return album.artist.name;
		return song.album?.artist?.name ?? null;
	};

	const imageCell = (song) => {
		const image = primaryImage(song.images);
		if (!image) return <span className="admin-artists-page-empty-value">-</span>;
		return (
			<div className="admin-artists-page-image-summary">
				<img src={image.previewUrl || image.url} alt={song.title} className="admin-artists-page-thumb" />
				<span className="admin-artists-page-image-count">{song.images?.length ?? 1} image{(song.images?.length ?? 1) === 1 ? '' : 's'}</span>
			</div>
		);
	};

	return (
		<div>
			<div className="admin-artists-page-header">
				<h1 className="admin-artists-page-title">Songs</h1>
				<button onClick={openCreate} className="admin-artists-page-primary-btn">New Song</button>
			</div>

			<div className="admin-filter-bar">
				<select
					value={filterArtist}
					onChange={(e) => setFilterArtist(e.target.value)}
					className="admin-filter-select"
				>
					<option value="">All Artists</option>
					{sortedArtists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}
				</select>
				<select
					value={filterAlbum}
					onChange={(e) => setFilterAlbum(e.target.value)}
					className="admin-filter-select"
				>
					<option value="">All Albums</option>
					{sortedAlbumOptions.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}
				</select>
			</div>

			<div className="admin-artists-page-table-wrap">
				<table className="admin-artists-page-table admin-songs-table">
					<thead>
						<tr>
							<th className="admin-artists-page-col-image">Images</th>
							<th className="admin-songs-col-title">Title</th>
							<th className="admin-songs-col-artist">Artist</th>
							<th className="admin-songs-col-featured">Featured</th>
							<th className="admin-songs-col-album">Album</th>
							<th className="admin-songs-col-date">Release Date</th>
							<th className="admin-songs-col-about">About</th>
							<th className="admin-artists-page-col-action admin-artists-page-center-cell">
								<span className="admin-artists-page-social-header" title="SoundCloud">
									<SiSoundcloud aria-hidden="true" />
									<span className="admin-artists-page-sr-only">SoundCloud</span>
								</span>
							</th>
							<th className="admin-artists-page-col-action admin-artists-page-center-cell">
								<span className="admin-artists-page-social-header" title="Spotify">
									<SiSpotify aria-hidden="true" />
									<span className="admin-artists-page-sr-only">Spotify</span>
								</span>
							</th>
							<th className="admin-artists-page-col-action admin-artists-page-center-cell">
								<span className="admin-artists-page-social-header" title="Apple Music">
									<SiApplemusic aria-hidden="true" />
									<span className="admin-artists-page-sr-only">Apple Music</span>
								</span>
							</th>
							<th className="admin-songs-col-actions admin-artists-page-sticky-right-0"></th>
						</tr>
					</thead>
					<tbody>
						{pagedSongs.map((song) => {
							const releaseDate = song.meta?.releaseDate ?? song.album?.releaseDate ?? '';
							const dateStr = releaseDate ? String(releaseDate).slice(0, 10) : '';
							return (
								<tr key={song.id}>
									<td className="admin-artists-page-col-image">{imageCell(song)}</td>
									<td className="admin-songs-col-title">{cell(song.title)}</td>
									<td className="admin-songs-col-artist">{cell(artistName(song))}</td>
									<td className="admin-songs-col-featured">{cell(song.meta?.featuredArtists)}</td>
									<td className="admin-songs-col-album">{cell(song.album?.title)}</td>
									<td className="admin-songs-col-date">{cell(dateStr)}</td>
									<td className="admin-songs-col-about">{wrapCell(song.meta?.aboutText)}</td>
									<td className="admin-artists-page-col-action admin-artists-page-center-cell">
										{linkCell(song, 'soundcloudUrl', 'SoundCloud')}
									</td>
									<td className="admin-artists-page-col-action admin-artists-page-center-cell">
										{linkCell(song, 'spotifyUrl', 'Spotify')}
									</td>
									<td className="admin-artists-page-col-action admin-artists-page-center-cell">
										{linkCell(song, 'appleMusicUrl', 'Apple Music')}
									</td>
									<td className="admin-songs-col-actions admin-artists-page-sticky-right-0">
										<div className="admin-songs-actions">
											<Link to={`/admin/lyrics/${song.id}`} state={{ songTitle: song.title }} className="admin-artists-page-ghost-btn admin-artists-page-icon-btn" style={{ textDecoration: 'none' }} aria-label="Edit lyrics" title="Edit lyrics">📝</Link>
											<button type="button" onClick={() => openEdit(song)} className="admin-artists-page-ghost-btn admin-artists-page-icon-btn" aria-label="Edit song" title="Edit">✎</button>
											<button type="button" onClick={() => handleDelete(song.id)} className="admin-artists-page-danger-btn admin-artists-page-icon-btn" aria-label="Delete song" title="Delete">🗑</button>
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>

			{totalPages > 1 && (
				<div className="admin-pagination">
					<button
						type="button"
						className="admin-pagination-btn"
						onClick={() => setPage((p) => p - 1)}
						disabled={page === 1}
					>
						← Prev
					</button>
					<span className="admin-pagination-info">Page {page} of {totalPages}</span>
					<button
						type="button"
						className="admin-pagination-btn"
						onClick={() => setPage((p) => p + 1)}
						disabled={page === totalPages}
					>
						Next →
					</button>
				</div>
			)}

			{form && (
				<div className="admin-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}>
					<div className="admin-modal">
						<div className="admin-modal-header">
							<h2 className="admin-modal-title">{form.id ? 'Edit Song' : 'New Song'}</h2>
							<button type="button" onClick={closeForm} className="admin-modal-close" aria-label="Close">✕</button>
						</div>
						<div className="admin-modal-body">
							<div className="admin-modal-grid">
								<div className="admin-modal-field admin-modal-field-full">
									<label className="admin-modal-label">Title</label>
									<input type="text" placeholder="Title" value={form.title} onChange={set('title')} className="admin-artists-page-input" />
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label className="admin-modal-label">Images</label>
									<ImageCollectionField
										value={form.images}
										onChange={(images) => setForm((current) => ({ ...current, images }))}
										token={token}
										folder="songs"
										entityLabel={form.title || 'Song image'}
									/>
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label className="admin-modal-label">Album</label>
									<select value={form.albumId} onChange={set('albumId')} className="admin-artists-page-input">
										<option value="">- Album -</option>
										{sortedAlbums.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}
									</select>
								</div>
								<div className="admin-modal-field">
									<label className="admin-modal-label">Track #</label>
									<input type="number" placeholder="Track #" value={form.trackNumber} onChange={setNum('trackNumber')} className="admin-artists-page-input" />
								</div>
								<div className="admin-modal-field">
									<label className="admin-modal-label">Disc #</label>
									<input type="number" placeholder="Disc #" value={form.discNumber} onChange={setNum('discNumber')} className="admin-artists-page-input" />
								</div>
								<div className="admin-modal-field">
									<label className="admin-modal-label">Duration</label>
									<input type="text" placeholder="e.g. 3:42" value={form.duration} onChange={set('duration')} className="admin-artists-page-input" />
								</div>
								<div className="admin-modal-field">
									<label className="admin-modal-label">Release Date</label>
									<input type="date" value={form.releaseDate} onChange={set('releaseDate')} className="admin-artists-page-input" />
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label className="admin-modal-label">Featured Artists</label>
									<input type="text" placeholder="Featured artists" value={form.featuredArtists} onChange={set('featuredArtists')} className="admin-artists-page-input" />
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label className="admin-modal-label">Producers</label>
									<input type="text" placeholder="Producers" value={form.producers} onChange={set('producers')} className="admin-artists-page-input" />
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label className="admin-modal-label">Writers</label>
									<input type="text" placeholder="Writers" value={form.writers} onChange={set('writers')} className="admin-artists-page-input" />
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label className="admin-modal-label">About</label>
									<textarea placeholder="About this song..." value={form.aboutText} onChange={set('aboutText')} className="admin-artists-page-input admin-modal-textarea" rows={5} />
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label className="admin-modal-label">Tags</label>
									<ChipInputField
										value={form.tags}
										onChange={(tags) => setForm((current) => ({ ...current, tags }))}
										placeholder="Type a tag and press Enter"
									/>
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label className="admin-modal-label">SoundCloud URL</label>
									<input type="text" placeholder="SoundCloud URL" value={form.soundcloudUrl} onChange={set('soundcloudUrl')} className="admin-artists-page-input" />
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label className="admin-modal-label">Spotify URL</label>
									<input type="text" placeholder="Spotify URL" value={form.spotifyUrl} onChange={set('spotifyUrl')} className="admin-artists-page-input" />
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label className="admin-modal-label">Apple Music URL</label>
									<input type="text" placeholder="Apple Music URL" value={form.appleMusicUrl} onChange={set('appleMusicUrl')} className="admin-artists-page-input" />
								</div>
							</div>
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
