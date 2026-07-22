/**
 * Public song hero/header component.
 *
 * Displays artwork, title, artist/release metadata, and the play action for a song.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { prefetchArtistPage } from '../../lib/publicPrefetch.js';
import { PROFILE_LINK_PLATFORM_LABELS, hrefForProfileLink, normalizeProfileLinks } from '../../lib/profileLinks.js';
import { buildAlbumPath, isOtherArtist } from '../../lib/publicVisibility.js';
import PlayButton from '../player/PlayButton.jsx';
import ArtworkGallery from '../shared/ArtworkGallery.jsx';
import ProfileLinkIcon from '../shared/ProfileLinkIcon.jsx';
import SongPersonCard from './SongPersonCard.jsx';
import '../../styles/SongHeader.css';

function legacyImage(url, altText, id) {
	return url ? { id, url, previewUrl: url, altText } : null;
}

function addUniqueImage(images, image, seen) {
	if (!image?.previewUrl && !image?.url) return;

	const keys = [image.pathname, image.previewUrl, image.url].filter(Boolean);
	if (keys.some((key) => seen.has(key))) return;

	keys.forEach((key) => seen.add(key));
	images.push(image);
}

function albumGalleryImages(album) {
	if (!album) return [];
	return [
		...(Array.isArray(album.images) ? album.images : []),
		legacyImage(album.coverArt, album.title, `${album.id ?? album.title}-cover`),
	];
}

function songGalleryImages(song) {
	const images = [];
	const seen = new Set();
	const placementAlbums = Array.isArray(song.placements)
		? song.placements.map((placement) => placement.album)
		: [];

	for (const image of [
		...(Array.isArray(song.images) ? song.images : []),
		legacyImage(song.artwork, song.title, `${song.id}-artwork`),
		...albumGalleryImages(song.album),
		...placementAlbums.flatMap(albumGalleryImages),
	]) {
		addUniqueImage(images, image, seen);
	}

	return images;
}

export default function SongHeader({ song, adminPreview = false }) {
	const galleryImages = useMemo(() => songGalleryImages(song), [song]);
	const hasSongArtwork = Array.isArray(song.images) && song.images.length > 0;
	const albumArtwork = song.album?.coverArt || song.album?.images?.[0]?.previewUrl || song.album?.images?.[0]?.url || '';
	const artwork = hasSongArtwork
		? albumArtwork || song.images[0]?.previewUrl || song.images[0]?.url || song.artwork
		: albumArtwork || song.artwork;
	const artistLinkData = song.album?.artist
		? { slug: song.album.artist.slug, images: [], portrait: song.album.coverArt }
		: null;
	const showArtistPageLink = song.album?.artist && !isOtherArtist(song.album.artist);
	const albumMetaAlbum = Array.isArray(song.placements)
		? song.placements.find((placement) => placement.album?.type && placement.album.type !== 'SINGLE')?.album ?? song.album
		: song.album;
	const albumPagePath = buildAlbumPath({
		album: albumMetaAlbum,
		allowHidden: adminPreview,
	});
	const showAlbumMeta = albumMetaAlbum?.type !== 'SINGLE';
	const releaseDate = song.meta?.releaseDate
		? new Date(song.meta.releaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })
		: null;
	const featuredArtists = song.meta?.featuredArtistLinks?.length
		? song.meta.featuredArtistLinks
		: song.meta?.roleGroups?.['Featured Artist'] ?? [];
	const streamLinks = normalizeProfileLinks(song.links);

	return (
		<section className={`song-header-header ${song.isPubliclyVisible === false ? 'song-header-hidden' : ''}`.trim()}>
			<div className="song-header-media-column">
				<div className="song-header-art-wrap">
					<ArtworkGallery images={galleryImages} title={song.title} buttonLabel={`View ${song.title} images`} />
					{artwork
						? <img src={artwork} alt={song.title} className="song-header-art" />
						: <div className="song-header-art-blank" />
					}
				</div>
				{streamLinks.length > 0 && (
					<div className="song-header-stream-links">
						{streamLinks.map((link) => {
							const label = PROFILE_LINK_PLATFORM_LABELS[link.platform] ?? 'Link';
							return (
								<a
									key={link.id}
									href={hrefForProfileLink(link)}
									target="_blank"
									rel="noopener noreferrer"
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
				{song.isPubliclyVisible === false && <span className="song-header-visibility-badge">Hidden in public view</span>}
				<div className="song-header-artist-links">
					<span
						onMouseEnter={() => showArtistPageLink && prefetchArtistPage(artistLinkData)}
						onFocus={() => showArtistPageLink && prefetchArtistPage(artistLinkData)}
						onTouchStart={() => showArtistPageLink && prefetchArtistPage(artistLinkData)}
					>
						<SongPersonCard person={showArtistPageLink ? song.album.artist : { name: song.album.artist.name, image: song.album.artist.image }} label="Artist" />
					</span>
					{featuredArtists.map((artist) => (
						<SongPersonCard key={artist.slug || artist.externalUrl || artist.name} person={artist} label="Featured Artist" />
					))}
				</div>
				<h1 className="song-header-title">{song.title}</h1>
				{showAlbumMeta ? (
					<p className="song-header-meta">
						{albumPagePath ? <Link to={albumPagePath}>{albumMetaAlbum.title}</Link> : albumMetaAlbum.title}
						{song.meta?.releaseDate && ` · ${new Date(song.meta.releaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}`}
					</p>
				) : releaseDate ? (
					<p className="song-header-meta">
						{releaseDate}
					</p>
				) : null}
				<div className="player-header-actions">
					<PlayButton type="song" id={song.id} startSongId={song.id} sourceLabel="Playing from A.S.D." label="Play" disabled={!song.soundcloudUrl} />
					{!song.soundcloudUrl && <span className="player-action-note">No streamable track</span>}
				</div>
			</div>
		</section>
	);
}
