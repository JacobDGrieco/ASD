/**
 * Public album detail body.
 *
 * Displays tracklist, release credits, release links, artwork, and role groups for
 * one formatted album payload.
 */
import { SONG_ROLES, ROLE_DISPLAY_LABELS } from '../../lib/songRoles.js';
import SongPersonCard from '../song/SongPersonCard.jsx';
import '../../styles/AlbumDetails.css';
import '../../styles/SongInfoLinks.css';

export default function AlbumDetails({ album }) {
	const releaseDate = album?.releaseDate
		? new Date(album.releaseDate).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			timeZone: 'UTC',
		})
		: null;

	const details = [
		{ label: 'Release date', value: releaseDate },
	].filter((detail) => detail.value);

	const roleGroups = album?.roleGroups ?? {};
	const roleRows = SONG_ROLES.reduce((rows, role) => {
		if (roleGroups[role]?.length) {
			rows.push({ label: ROLE_DISPLAY_LABELS[role], links: roleGroups[role] });
		}
		return rows;
	}, []);

	return (
		<section className="album-details-section">
			{album?.aboutText && (
				<div className="album-details-copy">
					<h2 className="album-details-heading">About</h2>
					<p className="album-details-text">{album.aboutText}</p>
				</div>
			)}

			{roleRows.length > 0 && (
				<div className="song-info-links-block">
					<h2 className="song-info-links-heading">People & Roles</h2>
					<div className="song-info-links-list song-info-links-list--people">
						{roleRows.map((row) => (
							<div key={row.label} className="song-info-links-row song-info-links-row--people">
								<span className="song-info-links-label">{row.label}</span>
								<span className="song-info-links-value">
									<span className="song-info-links-person-grid">
										{row.links.map((item) => (
											<SongPersonCard key={`${row.label}-${item.slug || item.externalUrl || item.name}`} person={item} />
										))}
									</span>
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{details.length > 0 && (
				<div className="album-details-meta">
					<h2 className="album-details-heading">Info</h2>
					<div className="album-details-list">
						{details.map((detail) => (
							<div key={detail.label} className="album-details-row">
								<span className="album-details-label">{detail.label}</span>
								<span className="album-details-value">{detail.value}</span>
							</div>
						))}
					</div>
				</div>
			)}

			{!album?.aboutText && roleRows.length === 0 && details.length === 0 && (
				<p className="album-details-empty">More album information will show up here.</p>
			)}
		</section>
	);
}
