import { Link } from 'react-router-dom';
import { FaApple, FaSoundcloud, FaSpotify, FaYoutube } from 'react-icons/fa';
import { prefetchSongPage } from '../../lib/publicPrefetch.js';
import ArtworkGallery from '../shared/ArtworkGallery.jsx';
import '../../styles/AlbumCard.css';

function getSongSlugFromPath(to) {
	if (!to) return null;
	const [pathname] = String(to).split('?');
	const parts = pathname.split('/').filter(Boolean);
	if (parts.length === 0) return null;
	if (parts[0] === 'songs') return parts[1] ?? null;
	return parts[2] ?? null;
}

export default function AlbumCard({ album, isOpen, isUnreleased = false, onClick, to, subtitle }) {
	const year = new Date(album.releaseDate).getFullYear();
	const className = `album-card-card ${isOpen ? 'album-card-open' : ''}`;
	const streamLinks = [
		{ href: album.soundcloudUrl, label: 'SoundCloud', icon: FaSoundcloud },
		{ href: album.spotifyUrl, label: 'Spotify', icon: FaSpotify },
		{ href: album.appleMusicUrl, label: 'Apple Music', icon: FaApple },
		{ href: album.youtubeUrl, label: 'YouTube', icon: FaYoutube },
	].filter((link) => link.href);

	const content = (
		<>
			<div className="album-card-cover-wrap">
				{isUnreleased && <span className="album-card-ribbon">Empty</span>}
				<ArtworkGallery images={album.images} title={album.title} showLabel className="album-card-gallery-trigger" />
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
		<div className={className}>
			{to ? (
				<Link
					to={to}
					className="album-card-primary-action"
					onMouseEnter={() => { const s = getSongSlugFromPath(to); if (s) prefetchSongPage(s, album.coverArt, album.slug); }}
					onFocus={() => { const s = getSongSlugFromPath(to); if (s) prefetchSongPage(s, album.coverArt, album.slug); }}
					onTouchStart={() => { const s = getSongSlugFromPath(to); if (s) prefetchSongPage(s, album.coverArt, album.slug); }}
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
					{streamLinks.map((link) => (
						<a
							key={link.label}
							href={link.href}
							target="_blank"
							rel="noreferrer"
							className="album-card-stream-link"
							aria-label={link.label}
							title={link.label}
						>
							<link.icon aria-hidden="true" />
						</a>
					))}
				</div>
			)}
		</div>
	);
}
