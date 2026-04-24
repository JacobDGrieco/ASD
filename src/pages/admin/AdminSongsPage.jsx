import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import '../../styles/AdminArtistsPage.css'
import { SiSoundcloud, SiSpotify, SiApplemusic } from "react-icons/si";

const empty = {
	title: '', slug: '', trackNumber: 1, discNumber: 1, duration: '',
	soundcloudUrl: '', spotifyUrl: '', appleMusicUrl: '', albumId: '',
	aboutText: '', producers: '', writers: '', featuredArtists: '', releaseDate: '',
};

export default function AdminSongsPage() {
	const { token } = useAdminAuth();
	const auth = { Authorization: `Bearer ${token}` };
	const [songs, setSongs] = useState([]);
	const [albums, setAlbums] = useState([]);
	const [form, setForm] = useState(null);

	useEffect(() => {
		fetch('/api/admin/songs', { headers: auth }).then((r) => r.json()).then(setSongs);
		fetch('/api/admin/albums', { headers: auth }).then((r) => r.json()).then(setAlbums);
	}, [token]);

	const openCreate = () => setForm({ ...empty });
	const openEdit = (song) => setForm({
		...empty,
		...song,
		aboutText: song.meta?.aboutText ?? '',
		producers: song.meta?.producers ?? '',
		writers: song.meta?.writers ?? '',
		featuredArtists: song.meta?.featuredArtists ?? '',
		releaseDate: song.meta?.releaseDate ? song.meta.releaseDate.slice(0, 10) : '',
	});
	const closeForm = () => setForm(null);

	const handleSave = async () => {
		const isEdit = Boolean(form.id);
		const url = isEdit ? `/api/admin/songs?id=${form.id}` : '/api/admin/songs';
		const res = await fetch(url, {
			method: isEdit ? 'PUT' : 'POST',
			headers: { ...auth, 'Content-Type': 'application/json' },
			body: JSON.stringify(form),
		});
		const saved = await res.json();
		const album = albums.find((candidate) => candidate.id === saved.albumId);
		const withRelations = {
			...saved,
			album: album ? { title: album.title, artist: album.artist, releaseDate: album.releaseDate } : null,
			meta: { aboutText: form.aboutText, producers: form.producers, writers: form.writers, featuredArtists: form.featuredArtists, releaseDate: form.releaseDate || null },
		};
		setSongs((prev) => isEdit ? prev.map((song) => song.id === saved.id ? withRelations : song) : [...prev, withRelations]);
		closeForm();
	};

	const handleDelete = async (id) => {
		if (!window.confirm('Delete this song and all its lyrics/annotations?')) return;
		await fetch(`/api/admin/songs?id=${id}`, { method: 'DELETE', headers: auth });
		setSongs((prev) => prev.filter((song) => song.id !== id));
	};

	const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));
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

	return (
		<div>
			<div className="admin-artists-page-header">
				<h1 className="admin-artists-page-title">Songs</h1>
				<button onClick={openCreate} className="admin-artists-page-primary-btn">New Song</button>
			</div>

			<div className="admin-artists-page-table-wrap">
				<table className="admin-artists-page-table admin-songs-table">
					<thead>
						<tr>
							<th className="admin-songs-col-title">Title</th>
							<th className="admin-songs-col-featured">Featured</th>
							<th className="admin-songs-col-album">Album</th>
							<th className="admin-songs-col-date">Release Date</th>
							<th className="admin-songs-col-about">About</th>
							<th className="admin-artists-page-col-action admin-artists-page-center-cell admin-songs-sticky-sc">
								<span className="admin-artists-page-social-header" title="SoundCloud">
									<SiSoundcloud aria-hidden="true" />
									<span className="admin-artists-page-sr-only">SoundCloud</span>
								</span>
							</th>
							<th className="admin-artists-page-col-action admin-artists-page-center-cell admin-songs-sticky-spotify">
								<span className="admin-artists-page-social-header" title="Spotify">
									<SiSpotify aria-hidden="true" />
									<span className="admin-artists-page-sr-only">Spotify</span>
								</span>
							</th>
							<th className="admin-artists-page-col-action admin-artists-page-center-cell admin-songs-sticky-am">
								<span className="admin-artists-page-social-header" title="Apple Music">
									<SiApplemusic aria-hidden="true" />
									<span className="admin-artists-page-sr-only">Apple Music</span>
								</span>
							</th>
							<th className="admin-songs-col-actions admin-artists-page-sticky-right-0"></th>
						</tr>
					</thead>
					<tbody>
						{songs.map((song) => {
							const releaseDate = song.meta?.releaseDate ?? song.album?.releaseDate ?? '';
							const dateStr = releaseDate ? String(releaseDate).slice(0, 10) : '';
							return (
								<tr key={song.id}>
									<td className="admin-songs-col-title">{cell(song.title)}</td>
									<td className="admin-songs-col-featured">{cell(song.meta?.featuredArtists)}</td>
									<td className="admin-songs-col-album">{cell(song.album?.title)}</td>
									<td className="admin-songs-col-date">{cell(dateStr)}</td>
									<td className="admin-songs-col-about">{wrapCell(song.meta?.aboutText)}</td>
									<td className="admin-artists-page-col-action admin-artists-page-center-cell admin-songs-sticky-sc">
										{linkCell(song, 'soundcloudUrl', 'SoundCloud')}
									</td>
									<td className="admin-artists-page-col-action admin-artists-page-center-cell admin-songs-sticky-spotify">
										{linkCell(song, 'spotifyUrl', 'Spotify')}
									</td>
									<td className="admin-artists-page-col-action admin-artists-page-center-cell admin-songs-sticky-am">
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
									<label className="admin-modal-label">Slug</label>
									<input type="text" placeholder="Slug" value={form.slug} onChange={set('slug')} className="admin-artists-page-input" />
								</div>
								<div className="admin-modal-field admin-modal-field-full">
									<label className="admin-modal-label">Album</label>
									<select value={form.albumId} onChange={set('albumId')} className="admin-artists-page-input">
										<option value="">- Album -</option>
										{albums.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}
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
