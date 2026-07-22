/**
 * Artist profile section for releases where the artist appears as a credit rather
 * than the primary release owner.
 */
import AlbumCard from './AlbumCard.jsx';
import { buildAlbumPath, buildSongPath, isOtherArtist } from '../../lib/publicVisibility.js';
import '../../styles/Discography.css';

export default function FeaturedOn({ featuredIn, adminPreview = false }) {
	if (!featuredIn?.length) return null;

	return (
		<section className="discography-section">
			<h2 className="discography-heading">Featured On</h2>
			<div className="discography-grid">
				{featuredIn.map((album) => {
					const singleSong = album.songs?.length === 1 ? album.songs[0] : null;
					const leadSong = singleSong ?? album.songs?.[0] ?? null;
					const to = isOtherArtist(album.artist)
						? buildSongPath({
							song: leadSong,
							allowHidden: adminPreview,
						})
						: singleSong
							? buildSongPath({
								song: singleSong,
								allowHidden: adminPreview,
							})
							: buildAlbumPath({
								album,
								allowHidden: adminPreview,
							});
					return (
						<AlbumCard
							key={album.id}
							album={album}
							subtitle={album.artist?.name}
							to={to}
						/>
					);
				})}
			</div>
		</section>
	);
}
