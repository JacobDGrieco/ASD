import { Link } from 'react-router-dom';
import { PROFILE_LINK_PLATFORM_LABELS, hrefForProfileLink, normalizeProfileLinks } from '../../lib/profileLinks.js';
import { prefetchSongPage } from '../../lib/publicPrefetch.js';
import ArtworkGallery from '../shared/ArtworkGallery.jsx';
import ProfileLinkIcon from '../shared/ProfileLinkIcon.jsx';
import '../../styles/AlbumCard.css';

function getSongIdFromPath(path) {
	if (!path) return null;
	const parts = path.split('/').filter(Boolean);
	if (parts[0] === 'songs') return parts[1] ?? null;
	return null;
}

export default function AlbumCard({ album, isOpen, isUnreleased = false, isDisabled = false, onClick, to, subtitle, className = '' }) {
	const year = new Date(album.releaseDate).getFullYear();
	const cardClassName = `album-card-card ${isOpen ? 'album-card-open' : ''} ${isDisabled ? 'album-card-disabled' : ''} ${album.isPubliclyVisible === false ? 'album-card-hidden' : ''} ${className}`.trim();
	const streamLinks = normalizeProfileLinks(album.links);

	const content = (
		<>
			<div className="album-card-cover-wrap">
				{isUnreleased && <span className="album-card-ribbon">Empty</span>}
				<ArtworkGallery images={album.images} title={album.title} className="album-card-gallery-trigger" />
				{album.coverArt ? (
					<img src={album.coverArt} alt={album.title} className="album-card-cover" />
				) : (
					<div className="album-card-cover-blank" />
				)}
			</div>
			<div className="album-card-info">
				<span className="album-card-title">{album.title}</span>
				<span className="album-card-meta">{year} · {subtitle ?? album.type}</span>
			</div>
		</>
	);

	return (
		<div className={cardClassName}>
			{to ? (
				<Link
					to={to}
					className="album-card-primary-action"
					onMouseEnter={() => { const s = getSongIdFromPath(to); if (s) prefetchSongPage(s, album.coverArt); }}
					onFocus={() => { const s = getSongIdFromPath(to); if (s) prefetchSongPage(s, album.coverArt); }}
					onTouchStart={() => { const s = getSongIdFromPath(to); if (s) prefetchSongPage(s, album.coverArt); }}
				>
					{content}
				</Link>
			) : onClick ? (
				<button type="button" className="album-card-primary-action" onClick={onClick}>
					{content}
				</button>
			) : (
				<div className="album-card-primary-action">
					{content}
				</div>
			)}
			{streamLinks.length > 0 && (
				<div className="album-card-stream-links">
					{streamLinks.map((link) => {
						const label = PROFILE_LINK_PLATFORM_LABELS[link.platform] ?? 'Link';
						return (
							<a
								key={link.id}
								href={hrefForProfileLink(link)}
								target="_blank"
								rel="noreferrer"
								className="album-card-stream-link"
								aria-label={label}
								title={label}
							>
								<ProfileLinkIcon platform={link.platform} aria-hidden="true" />
							</a>
						);
					})}
				</div>
			)}
		</div>
	);
}
