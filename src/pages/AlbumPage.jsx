import { useParams } from 'react-router-dom';
import { useMemo } from 'react';
import { TabPanel, TabView } from 'primereact/tabview';
import { useApi } from '../hooks/useApi.js';
import AlbumDetails from '../components/album/AlbumDetails.jsx';
import TrackList from '../components/artist/TrackList.jsx';
import SongPersonCard from '../components/song/SongPersonCard.jsx';
import AuroraBackground from '../components/shared/AuroraBackground.jsx';
import ArtworkGallery from '../components/shared/ArtworkGallery.jsx';
import ProfileLinkIcon from '../components/shared/ProfileLinkIcon.jsx';
import { useAdminAuth } from '../lib/adminAuth.jsx';
import { usePageTitle } from '../lib/pageTitle.js';
import { PROFILE_LINK_PLATFORM_LABELS, hrefForProfileLink, normalizeProfileLinks } from '../lib/profileLinks.js';
import { isAdminPreviewSession, publicPreviewCacheKey, publicPreviewHeaders } from '../lib/publicPreview.js';
import '../styles/SongHeader.css';
import '../styles/SongPage.css';

export default function AlbumPage() {
	const { albumId } = useParams();
	const { session, token } = useAdminAuth();
	const adminPreview = isAdminPreviewSession(session, token);
	const apiUrl = `/api/albums/${albumId}`;
	const previewHeaders = useMemo(() => publicPreviewHeaders(adminPreview ? token : null), [adminPreview, token]);
	const { data: album, loading, error } = useApi(apiUrl, {
		refreshAtUtcMidnight: true,
		headers: previewHeaders,
		cacheKey: publicPreviewCacheKey(apiUrl, adminPreview),
	});
	const titleParts = useMemo(() => album ? [album.title, album.artist?.name] : null, [album]);
	usePageTitle(titleParts);

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
								<TrackList songs={album.songs} allowHidden={adminPreview} />
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
	const streamLinks = normalizeProfileLinks(album.links);

	return (
		<section className={`song-header-header song-header-album-header ${album.isPubliclyVisible === false ? 'song-header-hidden' : ''}`.trim()}>
			<div className="song-header-media-column">
				<div className="song-header-art-wrap">
					<ArtworkGallery images={album.images} title={album.title} buttonLabel={`View ${album.title} images`} />
					{album.coverArt
						? <img src={album.coverArt} alt={album.title} className="song-header-art" />
						: <div className="song-header-art-blank" />
					}
				</div>
				{streamLinks.length > 0 && (
					<div className="song-header-stream-links">
						{streamLinks.map((link, index) => {
							const label = PROFILE_LINK_PLATFORM_LABELS[link.platform] ?? 'Link';
							return (
							<a
								key={`${link.platform}-${link.type}-${link.url}-${index}`}
								href={hrefForProfileLink(link)}
								target="_blank"
								rel="noreferrer"
								className="song-header-stream-link"
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
			<div className="song-header-info">
				{album.isPubliclyVisible === false && <span className="song-header-visibility-badge">Hidden in public view</span>}
				<div className="song-header-artist-links">
					<SongPersonCard person={album.artist} label="Artist" />
				</div>
				<h1 className="song-header-title">{album.title}</h1>
				<p className="song-header-meta">{year} · {album.type}</p>
			</div>
		</section>
	);
}
