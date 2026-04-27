import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { FaApple, FaSoundcloud, FaSpotify, FaYoutube } from 'react-icons/fa';
import { TabPanel, TabView } from 'primereact/tabview';
import { useApi } from '../hooks/useApi.js';
import AlbumDetails from '../components/album/AlbumDetails.jsx';
import TrackList from '../components/artist/TrackList.jsx';
import AuroraBackground from '../components/shared/AuroraBackground.jsx';
import '../styles/SongHeader.css';
import '../styles/SongPage.css';

export default function AlbumPage() {
	const { albumSlug } = useParams();
	const { data: album, loading, error } = useApi(`/api/albums/${albumSlug}`);

	if (!loading && (error || !album)) return <div className="page not-found"><h1>Album not found</h1></div>;

	return (
		<div className="page aurora-page">
			<AuroraBackground />
			{album && (
				<div className="aurora-page-content">
					<AlbumHeader album={album} />
					<div className="song-page-body">
						<TabView className="page-tabview">
							<TabPanel header="Tracklist">
								<TrackList songs={album.songs} artistSlug={album.artist.slug} albumSlug={albumSlug} />
							</TabPanel>
							<TabPanel header="About & Info">
								<AlbumDetails album={album} />
							</TabPanel>
						</TabView>
					</div>
				</div>
			)}
		</div>
	);
}

function AlbumHeader({ album }) {
	const year = new Date(album.releaseDate).getFullYear();
	const streamLinks = [
		{ href: album.soundcloudUrl, label: 'SoundCloud', icon: FaSoundcloud },
		{ href: album.spotifyUrl, label: 'Spotify', icon: FaSpotify },
		{ href: album.appleMusicUrl, label: 'Apple Music', icon: FaApple },
		{ href: album.youtubeUrl, label: 'YouTube', icon: FaYoutube },
	].filter((link) => link.href);

	return (
		<section className="song-header-header">
			<div className="song-header-media-column">
				<div className="song-header-art-wrap">
					{album.coverArt
						? <img src={album.coverArt} alt={album.title} className="song-header-art" />
						: <div className="song-header-art-blank" />
					}
				</div>
				{streamLinks.length > 0 && (
					<div className="song-header-stream-links">
						{streamLinks.map((link) => (
							<a
								key={link.label}
								href={link.href}
								target="_blank"
								rel="noreferrer"
								className="song-header-stream-link"
								aria-label={link.label}
								title={link.label}
							>
								<link.icon aria-hidden="true" />
							</a>
						))}
					</div>
				)}
			</div>
			<div className="song-header-info">
				<div className="song-header-artist-links">
					<Link to={`/artists/${album.artist.slug}`} className="song-header-artist-link">
						{album.artist.name}
					</Link>
				</div>
				<h1 className="song-header-title">{album.title}</h1>
				<p className="song-header-meta">{year} · {album.type}</p>
			</div>
		</section>
	);
}
