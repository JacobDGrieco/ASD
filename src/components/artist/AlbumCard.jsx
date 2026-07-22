/**
 * Release card used by discography, featured-on, and music preview sections.
 */
import { Link } from 'react-router-dom';
import { PROFILE_LINK_PLATFORM_LABELS, hrefForProfileLink, normalizeProfileLinks } from '../../lib/profileLinks.js';
import { prefetchSongPage } from '../../lib/publicPrefetch.js';
import ArtworkGallery from '../shared/ArtworkGallery.jsx';
import ProfileLinkIcon from '../shared/ProfileLinkIcon.jsx';
import '../../styles/ContentCard.css';

function getSongIdFromPath(path) {
	if (!path) return null;
	const parts = path.split('/').filter(Boolean);
	if (parts[0] === 'songs') return parts[1] ?? null;
	return null;
}

export default function AlbumCard({ album, isOpen, isUnreleased = false, isDisabled = false, onClick, to, subtitle, className = '' }) {
	const year = new Date(album.releaseDate).getFullYear();
	const cardClassName = `content-card-card ${isOpen ? 'content-card-open' : ''} ${isDisabled ? 'content-card-disabled' : ''} ${album.isPubliclyVisible === false ? 'content-card-hidden' : ''} ${className}`.trim();
	const streamLinks = normalizeProfileLinks(album.links);

	const content = (
		<>
			<div className="content-card-cover-wrap">
				{isUnreleased && <span className="content-card-ribbon">Empty</span>}
				<ArtworkGallery images={album.images} title={album.title} className="content-card-gallery-trigger" />
				{album.coverArt ? (
					<img src={album.coverArt} alt={album.title} className="content-card-cover" />
				) : (
					<div className="content-card-cover-blank" />
				)}
			</div>
			<div className="content-card-info">
				<span className="content-card-title">{album.title}</span>
				<span className="content-card-meta">{year} · {subtitle ?? album.type}</span>
			</div>
		</>
	);

	return (
		<div className={cardClassName}>
			{to ? (
				<Link
					to={to}
					className="content-card-primary-action"
					onMouseEnter={() => { const s = getSongIdFromPath(to); if (s) prefetchSongPage(s, album.coverArt); }}
					onFocus={() => { const s = getSongIdFromPath(to); if (s) prefetchSongPage(s, album.coverArt); }}
					onTouchStart={() => { const s = getSongIdFromPath(to); if (s) prefetchSongPage(s, album.coverArt); }}
				>
					{content}
				</Link>
			) : onClick ? (
				<button type="button" className="content-card-primary-action" onClick={onClick}>
					{content}
				</button>
			) : (
				<div className="content-card-primary-action">
					{content}
				</div>
			)}
			{streamLinks.length > 0 && (
				<div className="content-card-stream-links">
					{streamLinks.map((link) => {
						const label = PROFILE_LINK_PLATFORM_LABELS[link.platform] ?? 'Link';
						return (
							<a
								key={link.id}
								href={hrefForProfileLink(link)}
								target="_blank"
								rel="noreferrer"
								className="content-card-stream-link"
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
