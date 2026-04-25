import { Link } from 'react-router-dom';
import { FaApple, FaSoundcloud, FaSpotify } from 'react-icons/fa';
import { prefetchSongPage } from '../../lib/publicPrefetch.js';
import '../../styles/AlbumCard.css';

export default function AlbumCard({ album, isOpen, isUnreleased = false, onClick, to, subtitle }) {
	const year = new Date(album.releaseDate).getFullYear();
	const className = `album-card-card ${isOpen ? 'album-card-open' : ''}`;
	const streamLinks = [
		{ href: album.soundcloudUrl, label: 'SoundCloud', icon: FaSoundcloud },
		{ href: album.spotifyUrl, label: 'Spotify', icon: FaSpotify },
		{ href: album.appleMusicUrl, label: 'Apple Music', icon: FaApple },
	].filter((link) => link.href);

	const content = (
		<>
			<div className="album-card-cover-wrap">
				{isUnreleased && <span className="album-card-ribbon">Unreleased</span>}
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
					onMouseEnter={() => { const s = to.split('/').filter(Boolean)[2]; if (s) prefetchSongPage(s, album.coverArt); }}
					onFocus={() => { const s = to.split('/').filter(Boolean)[2]; if (s) prefetchSongPage(s, album.coverArt); }}
					onTouchStart={() => { const s = to.split('/').filter(Boolean)[2]; if (s) prefetchSongPage(s, album.coverArt); }}
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
