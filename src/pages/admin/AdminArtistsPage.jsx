import { useState, useEffect } from 'react';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import styles from '../../styles/AdminArtistsPage.module.css';
import { SiSoundcloud, SiSpotify, SiApplemusic } from "react-icons/si";

const empty = { name: '', slug: '', bio: '', aboutMe: '', portrait: '', order: 0, soundcloudProfile: '', spotifyProfile: '', appleMusicProfile: '' };
const columns = [
	{ key: 'portrait', label: 'Portrait', placeholder: 'Portrait URL', kind: 'image', className: styles.colSm },
	{ key: 'name', label: 'Name', placeholder: 'Name', className: styles.colMd },
	{ key: 'slug', label: 'Slug', placeholder: 'Slug', className: styles.colMd },
	{ key: 'bio', label: 'Bio', placeholder: 'Bio', kind: 'textarea', className: styles.colXxl, valueClassName: styles.wrapValue },
	{ key: 'aboutMe', label: 'About Me', placeholder: 'About Me', kind: 'textarea', className: styles.colXxl, valueClassName: styles.wrapValue },
	{ key: 'soundcloudProfile', label: <SiSoundcloud />, headerLabel: 'SoundCloud', placeholder: 'SoundCloud URL', kind: 'link', className: `${styles.colAction} ${styles.centerCell} ${styles.stickyRight4}` },
	{ key: 'spotifyProfile', label: <SiSpotify />, headerLabel: 'Spotify', placeholder: 'Spotify URL', kind: 'link', className: `${styles.colAction} ${styles.centerCell} ${styles.stickyRight3}` },
	{ key: 'appleMusicProfile', label: <SiApplemusic />, headerLabel: 'Apple Music', placeholder: 'Apple Music URL', kind: 'link', className: `${styles.colAction} ${styles.centerCell} ${styles.stickyRight2}` },
];

export default function AdminArtistsPage() {
	const { token } = useAdminAuth();
	const auth = { Authorization: `Bearer ${token}` };
	const [artists, setArtists] = useState([]);
	const [form, setForm] = useState(null);
	const [draggedArtistId, setDraggedArtistId] = useState(null);
	const [dropTargetId, setDropTargetId] = useState(null);

	useEffect(() => {
		fetch('/api/admin/artists', { headers: auth })
			.then((r) => r.json())
			.then(setArtists);
	}, [token]);

	const openCreate = () => setForm({ ...empty });
	const openEdit = (a) => setForm({ ...a });
	const closeForm = () => setForm(null);
	const isEditing = (artistId) => form && form.id === artistId;
	const isCreating = Boolean(form && !form.id);
	const nextOrder = artists.reduce((maxOrder, artist) => Math.max(maxOrder, artist.order ?? 0), -1) + 1;

	const handleSave = async () => {
		const isEdit = Boolean(form.id);
		const url = isEdit ? `/api/admin/artists?id=${form.id}` : '/api/admin/artists';
		const payload = isEdit ? form : { ...form, order: nextOrder };
		const res = await fetch(url, {
			method: isEdit ? 'PUT' : 'POST',
			headers: { ...auth, 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		const saved = await res.json();
		setArtists((prev) => isEdit ? prev.map((a) => a.id === saved.id ? saved : a) : [...prev, saved]);
		closeForm();
	};

	const handleDelete = async (id) => {
		if (!window.confirm('Delete this artist and all their albums/songs?')) return;
		await fetch(`/api/admin/artists?id=${id}`, { method: 'DELETE', headers: auth });
		setArtists((prev) => prev.filter((a) => a.id !== id));
	};

	const persistArtistOrder = async (nextArtists) => {
		const changedArtists = nextArtists.filter((artist, index) => artist.order !== index);
		if (!changedArtists.length) return nextArtists;

		const savedArtists = await Promise.all(
			changedArtists.map((artist, index) => {
				const nextOrder = nextArtists.findIndex((candidate) => candidate.id === artist.id);
				return fetch(`/api/admin/artists?id=${artist.id}`, {
					method: 'PUT',
					headers: { ...auth, 'Content-Type': 'application/json' },
					body: JSON.stringify({ ...artist, order: nextOrder }),
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
		setDraggedArtistId(artistId);
	};

	const handleDragOver = (event, artistId) => {
		if (!draggedArtistId || draggedArtistId === artistId) return;
		event.preventDefault();
		setDropTargetId(artistId);
	};

	const handleDrop = async (artistId) => {
		if (!draggedArtistId || draggedArtistId === artistId) {
			setDraggedArtistId(null);
			setDropTargetId(null);
			return;
		}

		const draggedIndex = artists.findIndex((artist) => artist.id === draggedArtistId);
		const targetIndex = artists.findIndex((artist) => artist.id === artistId);
		if (draggedIndex === -1 || targetIndex === -1) {
			setDraggedArtistId(null);
			setDropTargetId(null);
			return;
		}

		const reordered = [...artists];
		const [movedArtist] = reordered.splice(draggedIndex, 1);
		reordered.splice(targetIndex, 0, movedArtist);

		const normalized = reordered.map((artist, index) => ({ ...artist, order: index }));
		setArtists(normalized);
		setDraggedArtistId(null);
		setDropTargetId(null);

		const persisted = await persistArtistOrder(reordered);
		setArtists(persisted);
	};

	const handleDragEnd = () => {
		setDraggedArtistId(null);
		setDropTargetId(null);
	};

	const field = (column) => {
		if (column.kind === 'textarea') {
			return (
				<textarea
					placeholder={column.placeholder}
					value={form[column.key] ?? ''}
					onChange={(e) => setForm((f) => ({ ...f, [column.key]: e.target.value }))}
					className={`${styles.input} ${styles.textareaCell}`}
					rows={3}
				/>
			);
		}

		return (
			<input
				key={column.key}
				type={column.type ?? 'text'}
				placeholder={column.placeholder}
				value={form[column.key] ?? ''}
				onChange={(e) => setForm((f) => ({ ...f, [column.key]: (column.type ?? 'text') === 'number' ? Number(e.target.value) : e.target.value }))}
				className={styles.input}
			/>
		);
	};

	const renderDisplayValue = (artist, column) => {
		const value = artist[column.key];
		if (value === null || value === undefined || value === '') return <span className={styles.emptyValue}>-</span>;
		if (column.kind === 'image') {
			return <img src={String(value)} alt={artist.name} className={styles.thumb} />;
		}
		if (column.kind === 'link') {
			return <a href={String(value)} target="_blank" rel="noreferrer" className={styles.linkBtn} aria-label={`Open ${column.label} link`} title="Open in new tab">↗</a>;
		}
		return (
			<span className={column.valueClassName ?? styles.cellValue} title={String(value)}>
				{String(value)}
			</span>
		);
	};

	const renderHeader = (column) => {
		if (column.kind !== 'link') return column.label;
		return (
			<span className={styles.socialHeader} title={column.headerLabel}>
				<span aria-hidden="true">{column.label}</span>
				<span className={styles.srOnly}>{column.headerLabel}</span>
			</span>
		);
	};

	const renderEditableRow = () => (
		<tr className={styles.editingRow}>
			<td className={styles.dragCell}></td>
			{columns.map((column) => (
				<td key={column.key} className={column.className}>
					{field(column)}
				</td>
			))}
			<td className={`${styles.actionCell} ${styles.stickyRight1}`}>
				<button type="button" onClick={handleSave} className={`${styles.ghostBtn} ${styles.iconBtn}`} aria-label="Save artist" title="Save">✓</button>
			</td>
			<td className={`${styles.actionCell} ${styles.stickyRight0}`}>
				<button type="button" onClick={closeForm} className={`${styles.ghostBtn} ${styles.iconBtn}`} aria-label="Cancel artist edit" title="Cancel">✕</button>
			</td>
		</tr>
	);

	return (
		<div>
			<div className={styles.header}>
				<h1 className={styles.title}>Artists</h1>
				<button onClick={openCreate} className={styles.primaryBtn}>New Artist</button>
			</div>

			<div className={styles.tableWrap}>
				<table className={styles.table}>
					<thead>
						<tr>
							<th className={styles.dragHeader}></th>
							{columns.map((column) => <th key={column.key} className={column.className}>{renderHeader(column)}</th>)}
							<th className={`${styles.colAction} ${styles.stickyRight1}`}></th>
							<th className={`${styles.colAction} ${styles.stickyRight0}`}></th>
						</tr>
					</thead>
					<tbody>
						{isCreating && renderEditableRow()}
						{artists.map((a) => (
							isEditing(a.id) ? (
								<tr key={a.id} className={styles.editingRow}>
									<td className={styles.dragCell}></td>
									{columns.map((column) => (
										<td key={column.key} className={column.className}>
											{field(column)}
										</td>
									))}
									<td className={`${styles.actionCell} ${styles.stickyRight1}`}>
										<button type="button" onClick={handleSave} className={`${styles.ghostBtn} ${styles.iconBtn}`} aria-label="Save artist" title="Save">✓</button>
									</td>
									<td className={`${styles.actionCell} ${styles.stickyRight0}`}>
										<button type="button" onClick={closeForm} className={`${styles.ghostBtn} ${styles.iconBtn}`} aria-label="Cancel artist edit" title="Cancel">✕</button>
									</td>
								</tr>
							) : (
								<tr
									key={a.id}
									className={dropTargetId === a.id ? styles.dropTargetRow : ''}
									onDragOver={(event) => handleDragOver(event, a.id)}
									onDrop={(event) => {
										event.preventDefault();
										handleDrop(a.id);
									}}
								>
									<td className={styles.dragCell}>
										<button
											type="button"
											draggable={!form}
											onDragStart={(event) => handleDragStart(event, a.id)}
											onDragEnd={handleDragEnd}
											className={styles.dragHandle}
											aria-label={`Reorder ${a.name}`}
											title="Drag to reorder"
										>
											::
										</button>
									</td>
									{columns.map((column) => (
										<td key={column.key} className={`${column.className ?? ''} ${column.key === 'slug' ? styles.muted : ''}`.trim()}>
											{renderDisplayValue(a, column)}
										</td>
									))}
									<td className={`${styles.actionCell} ${styles.stickyRight1}`}>
										<button type="button" onClick={() => openEdit(a)} className={`${styles.ghostBtn} ${styles.iconBtn}`} aria-label="Edit artist" title="Edit">✎</button>
									</td>
									<td className={`${styles.actionCell} ${styles.stickyRight0}`}>
										<button type="button" onClick={() => handleDelete(a.id)} className={`${styles.dangerBtn} ${styles.iconBtn}`} aria-label="Delete artist" title="Delete">🗑</button>
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
