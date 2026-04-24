import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import '../../styles/AdminArtistsPage.css'
import { SiSoundcloud, SiSpotify, SiApplemusic } from "react-icons/si";

const empty = {
	title: '', slug: '', trackNumber: 1, discNumber: 1, duration: '',
	soundcloudUrl: '', spotifyUrl: '', appleMusicUrl: '', albumId: '',
	aboutText: '', producers: '', writers: '', releaseDate: '',
};

const columns = [
	{ key: 'title', label: 'Title', placeholder: 'Title', className: 'admin-artists-page-col-xl' },
	{ key: 'albumId', label: 'Album', kind: 'album', className: 'admin-artists-page-col-lg' },
	{ key: 'slug', label: 'Slug', placeholder: 'Slug', className: 'admin-artists-page-col-md' },
	{ key: 'discNumber', label: 'Disc', type: 'number', kind: 'number', placeholder: 'Disc #', className: 'admin-artists-page-col-xs' },
	{ key: 'trackNumber', label: 'Track', type: 'number', kind: 'number', placeholder: 'Track #', className: 'admin-artists-page-col-xs' },
	{ key: 'duration', label: 'Duration', placeholder: 'Duration (e.g. 3:42)', className: 'admin-artists-page-col-sm' },
	{ key: 'releaseDate', label: 'Release Date', type: 'date', placeholder: 'Release Date', className: 'admin-artists-page-col-sm' },
	{ key: 'producers', label: 'Producers', placeholder: 'Producers', className: 'admin-artists-page-col-lg', valueClassName: 'admin-artists-page-wrap-value' },
	{ key: 'writers', label: 'Writers', placeholder: 'Writers', className: 'admin-artists-page-col-lg', valueClassName: 'admin-artists-page-wrap-value' },
	{ key: 'aboutText', label: 'About', kind: 'textarea', placeholder: 'About this song...', className: 'admin-artists-page-col-xxl', valueClassName: 'admin-artists-page-wrap-value' },
	{ key: 'soundcloudUrl', label: <SiSoundcloud />, headerLabel: 'SoundCloud', placeholder: 'SoundCloud URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell admin-artists-page-sticky-right-5` },
	{ key: 'spotifyUrl', label: <SiSpotify />, headerLabel: 'Spotify', placeholder: 'Spotify URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell admin-artists-page-sticky-right-4` },
	{ key: 'appleMusicUrl', label: <SiApplemusic />, headerLabel: 'Apple Music', placeholder: 'Apple Music URL', kind: 'link', className: `admin-artists-page-col-action admin-artists-page-center-cell admin-artists-page-sticky-right-3` },
];

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
		releaseDate: song.meta?.releaseDate ? song.meta.releaseDate.slice(0, 10) : '',
	});
	const closeForm = () => setForm(null);
	const isEditing = (songId) => form && form.id === songId;
	const isCreating = Boolean(form && !form.id);

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
			meta: { aboutText: form.aboutText, producers: form.producers, writers: form.writers, releaseDate: form.releaseDate || null },
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

	const renderField = (column) => {
		if (column.kind === 'album') {
			return (
				<select value={form.albumId} onChange={set('albumId')} className="admin-artists-page-input">
					<option value="">- Album -</option>
					{albums.map((album) => <option key={album.id} value={album.id}>{album.title}</option>)}
				</select>
			);
		}

		if (column.kind === 'textarea') {
			return (
				<textarea
					placeholder={column.placeholder}
					value={form.aboutText ?? ''}
					onChange={set('aboutText')}
					className={`admin-artists-page-input admin-artists-page-textarea-cell`}
					rows={3}
				/>
			);
		}

		if (column.kind === 'link') {
			return (
				<input
					type="text"
					placeholder={column.placeholder}
					value={form[column.key] ?? ''}
					onChange={set(column.key)}
					className="admin-artists-page-input"
				/>
			);
		}

		if (column.kind === 'number') {
			return (
				<input
					type="number"
					placeholder={column.placeholder}
					value={form[column.key] ?? 0}
					onChange={setNum(column.key)}
					className="admin-artists-page-input"
				/>
			);
		}

		return (
			<input
				type={column.type ?? 'text'}
				placeholder={column.placeholder}
				value={form[column.key] ?? ''}
				onChange={set(column.key)}
				className="admin-artists-page-input"
			/>
		);
	};

	const renderValue = (song, column) => {
		if (column.key === 'albumId') {
			const value = song.album?.title ?? '';
			return value ? <span className="admin-artists-page-cell-value" title={value}>{value}</span> : <span className="admin-artists-page-empty-value">-</span>;
		}

		if (column.key === 'aboutText' || column.key === 'producers' || column.key === 'writers') {
			const value = song.meta?.[column.key] ?? '';
			return value ? <span className={column.valueClassName ?? 'admin-artists-page-cell-value'} title={value}>{value}</span> : <span className="admin-artists-page-empty-value">-</span>;
		}

		if (column.key === 'releaseDate') {
			const value = song.meta?.releaseDate ?? song.album?.releaseDate ?? '';
			const dateValue = value ? String(value).slice(0, 10) : '';
			return dateValue ? <span className="admin-artists-page-cell-value" title={dateValue}>{dateValue}</span> : <span className="admin-artists-page-empty-value">-</span>;
		}

		if (column.kind === 'link') {
			const value = song[column.key];
			return value ? <a href={String(value)} target="_blank" rel="noreferrer" className="admin-artists-page-link-btn" aria-label={`Open ${column.label} link`} title="Open in new tab">↗</a> : <span className="admin-artists-page-empty-value">-</span>;
		}

		const value = song[column.key];
		if (value === null || value === undefined || value === '') return <span className="admin-artists-page-empty-value">-</span>;
		return <span className={column.valueClassName ?? 'admin-artists-page-cell-value'} title={String(value)}>{String(value)}</span>;
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

	const renderEditableRow = (key) => (
		<tr key={key} className="admin-artists-page-editing-row">
			{columns.map((column) => (
				<td key={column.key} className={column.className}>
					{renderField(column)}
				</td>
			))}
			<td className={`admin-artists-page-action-cell admin-artists-page-sticky-right-2`}>
				<button type="button" onClick={handleSave} className={`admin-artists-page-ghost-btn admin-artists-page-icon-btn`} aria-label="Save song" title="Save">✓</button>
			</td>
			<td className={`admin-artists-page-action-cell admin-artists-page-sticky-right-1`}>
				<button type="button" onClick={closeForm} className={`admin-artists-page-ghost-btn admin-artists-page-icon-btn`} aria-label="Cancel song edit" title="Cancel">✕</button>
			</td>
			<td className={`admin-artists-page-action-cell admin-artists-page-sticky-right-0`}></td>
		</tr>
	);

	return (
		<div>
			<div className="admin-artists-page-header">
				<h1 className="admin-artists-page-title">Songs</h1>
				<button onClick={openCreate} className="admin-artists-page-primary-btn">New Song</button>
			</div>

			<div className="admin-artists-page-table-wrap">
				<table className="admin-artists-page-table">
					<thead>
						<tr>
							{columns.map((column) => <th key={column.key} className={column.className}>{renderHeader(column)}</th>)}
							<th className={`admin-artists-page-col-action admin-artists-page-sticky-right-2`}></th>
							<th className={`admin-artists-page-col-action admin-artists-page-sticky-right-1`}></th>
							<th className={`admin-artists-page-col-action admin-artists-page-sticky-right-0`}></th>
						</tr>
					</thead>
					<tbody>
						{isCreating && renderEditableRow('create')}
						{songs.map((song) => (
							isEditing(song.id) ? renderEditableRow(song.id) : (
								<tr key={song.id}>
									{columns.map((column) => (
										<td key={column.key} className={`${column.className ?? ''} ${column.key === 'slug' || column.key === 'discNumber' || column.key === 'trackNumber' ? 'admin-artists-page-muted' : ''}`.trim()}>
											{renderValue(song, column)}
										</td>
									))}
									<td className={`admin-artists-page-action-cell admin-artists-page-sticky-right-2`}>
										<Link to={`/admin/lyrics/${song.id}`} state={{ songTitle: song.title }} className={`admin-artists-page-ghost-btn admin-artists-page-icon-btn`} style={{ textDecoration: 'none' }} aria-label="Edit lyrics" title="Edit lyrics">📝</Link>
									</td>
									<td className={`admin-artists-page-action-cell admin-artists-page-sticky-right-1`}>
										<button type="button" onClick={() => openEdit(song)} className={`admin-artists-page-ghost-btn admin-artists-page-icon-btn`} aria-label="Edit song" title="Edit">✎</button>
									</td>
									<td className={`admin-artists-page-action-cell admin-artists-page-sticky-right-0`}>
										<button type="button" onClick={() => handleDelete(song.id)} className={`admin-artists-page-danger-btn admin-artists-page-icon-btn`} aria-label="Delete song" title="Delete">🗑</button>
									</td>
								</tr>
							)
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
