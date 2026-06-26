import { useEffect, useState } from 'react';
import { useAdminAuth } from '../../lib/adminAuth.jsx';
import '../../styles/AdminRecordPlayerPage.css';

const MAX_SLOTS = 8;
let slotsCache = null;
let slotsPromise = null;

function loadSlots(token) {
	if (slotsCache) return Promise.resolve(slotsCache);
	if (slotsPromise) return slotsPromise;

	slotsPromise = fetch('/api/admin/record-player', {
		headers: { Authorization: `Bearer ${token}` },
	})
		.then(async (response) => {
			if (!response.ok) throw new Error(`Failed to load record player slots (${response.status})`);
			return response.json();
		})
		.then((tracks) => {
			slotsCache = tracks;
			return tracks;
		})
		.finally(() => {
			slotsPromise = null;
		});

	return slotsPromise;
}

function makeSlots(tracks) {
	const base = Array.from({ length: MAX_SLOTS }, (_, index) => ({
		position: index + 1,
		songId: '',
		songLabel: '',
		active: true,
	}));

	tracks.forEach((track) => {
		if (track.position < 1 || track.position > MAX_SLOTS) return;

		base[track.position - 1] = {
			position: track.position,
			songId: track.songId ?? track.song?.id ?? '',
			songLabel: track.song?.title ?? '',
			active: track.active ?? true,
		};
	});

	return base;
}

export default function AdminMusicRecordPlayerPage() {
	const { token, session } = useAdminAuth();
	const isViewer = session?.role === 'VIEWER';
	const authHeaders = { Authorization: `Bearer ${token}` };

	const [slots, setSlots] = useState(() => makeSlots([]));
	const [saved, setSaved] = useState(false);
	const [activeSearchPosition, setActiveSearchPosition] = useState(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [searchResults, setSearchResults] = useState([]);
	const [isSearching, setIsSearching] = useState(false);

	useEffect(() => {
		const effectStartedAt = performance.now();
		let ignore = false;
		let completed = false;

		const fetchStartedAt = performance.now();

		loadSlots(token)
			.then((tracks) => {
				const mapStartedAt = performance.now();
				const nextSlots = makeSlots(tracks);
				return nextSlots;
			})
			.then((nextSlots) => {
				if (!ignore) {
					const setStartedAt = performance.now();
					setSlots(nextSlots);
					completed = true;
				}
			});

		return () => {
			ignore = true;
		};
	}, [token]);

	useEffect(() => {
		if (activeSearchPosition === null || searchQuery.trim().length < 2) {
			setSearchResults([]);
			setIsSearching(false);
			return undefined;
		}

		const controller = new AbortController();
		const timeoutId = window.setTimeout(async () => {
			setIsSearching(true);
			try {
				const searchStartedAt = performance.now();
				const response = await fetch(`/api/admin/record-player?resource=songs&q=${encodeURIComponent(searchQuery.trim())}`, {
					headers: { Authorization: `Bearer ${token}` },
					signal: controller.signal,
				});
				const jsonStartedAt = performance.now();
				const results = await response.json();
				setSearchResults(Array.isArray(results) ? results : []);
			} catch (error) {
				if (error.name !== 'AbortError') {
					setSearchResults([]);
				}
			} finally {
				setIsSearching(false);
			}
		}, 200);

		return () => {
			controller.abort();
			window.clearTimeout(timeoutId);
		};
	}, [activeSearchPosition, searchQuery, token]);

	const updateSlot = (position, key, value) => {
		setSlots((current) =>
			current.map((slot) =>
				slot.position === position ? { ...slot, [key]: value } : slot
			)
		);
	};

	const openSearch = (slot) => {
		setActiveSearchPosition(slot.position);
		setSearchQuery(slot.songLabel);
		setSearchResults([]);
	};

	const closeSearch = (position) => {
		window.setTimeout(() => {
			setActiveSearchPosition((current) => (current === position ? null : current));
			setSearchResults([]);
			setSearchQuery('');
		}, 120);
	};

	const selectSong = (position, song) => {
		updateSlot(position, 'songId', song.id);
		updateSlot(position, 'songLabel', `${song.artistName ? `${song.artistName} - ` : ''}${song.title}`);
		setActiveSearchPosition(null);
		setSearchResults([]);
		setSearchQuery('');
	};

	const clearSong = (position) => {
		setSlots((current) =>
			current.map((slot) =>
				slot.position === position ? { ...slot, songId: '', songLabel: '' } : slot
			)
		);
		setSearchResults([]);
		setSearchQuery('');
	};

	const handleSave = async () => {
		const filledSlots = slots.filter((slot) => slot.songId !== '');
		const response = await fetch('/api/admin/record-player', {
			method: 'PUT',
			headers: {
				...authHeaders,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ tracks: filledSlots }),
		});
		const updated = await response.json();
		slotsCache = updated;
		setSlots(makeSlots(updated));
		setSaved(true);
		window.setTimeout(() => setSaved(false), 2000);
	};

	return (
		<div>
			<div className="admin-record-player-page-header">
				<h1 className="admin-record-player-page-title">Music — Record Player</h1>
				{!isViewer && (
					<button type="button" onClick={handleSave} className="admin-record-player-page-primary-btn">
						Save Rack
					</button>
				)}
			</div>

			{saved ? <p className="admin-record-player-page-saved">Saved!</p> : null}

			<p className="admin-record-player-page-hint">
				Assign up to {MAX_SLOTS} songs to the home page vinyl rack.
			</p>

			<div className="admin-record-player-page-slots">
				{slots.map((slot) => (
					<div key={slot.position} className="admin-record-player-page-slot">
						<span className="admin-record-player-page-slot-label">Slot {slot.position}</span>

						<div className="admin-record-player-page-picker">
							<input
								type="text"
								value={activeSearchPosition === slot.position ? searchQuery : slot.songLabel}
								onFocus={() => !isViewer && openSearch(slot)}
								onBlur={() => closeSearch(slot.position)}
								onChange={(event) => {
									if (isViewer) return;
									if (activeSearchPosition !== slot.position) setActiveSearchPosition(slot.position);
									setSearchQuery(event.target.value);
								}}
								className="admin-record-player-page-select"
								placeholder="Search song or artist..."
								autoComplete="off"
								disabled={isViewer}
								readOnly={isViewer}
							/>
							{!isViewer && slot.songId && (
								<button
									type="button"
									onMouseDown={(event) => event.preventDefault()}
									onClick={() => clearSong(slot.position)}
									className="admin-record-player-page-clear-btn"
									aria-label={`Clear slot ${slot.position}`}
									title="Clear"
								>
									Clear
								</button>
							)}
							{activeSearchPosition === slot.position && (
								<div className="admin-record-player-page-results">
									{searchQuery.trim().length < 2 && (
										<div className="admin-record-player-page-result-empty">Type at least 2 characters</div>
									)}
									{searchQuery.trim().length >= 2 && isSearching && (
										<div className="admin-record-player-page-result-empty">Searching...</div>
									)}
									{searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
										<div className="admin-record-player-page-result-empty">No matches found</div>
									)}
									{searchResults.map((song) => (
										<button
											key={song.id}
											type="button"
											onMouseDown={(event) => event.preventDefault()}
											onClick={() => selectSong(slot.position, song)}
											className="admin-record-player-page-result-btn"
										>
											{song.artistName ? `${song.artistName} - ` : ''}
											{song.title}
										</button>
									))}
								</div>
							)}
						</div>

						<label className="admin-record-player-page-active-label">
							<input
								type="checkbox"
								checked={slot.active}
								onChange={(event) => updateSlot(slot.position, 'active', event.target.checked)}
								className="admin-record-player-page-checkbox"
								disabled={isViewer}
							/>
							Active
						</label>
					</div>
				))}
			</div>
		</div>
	);
}
