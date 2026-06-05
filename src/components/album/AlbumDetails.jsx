import { Link } from 'react-router-dom';
import '../../styles/AlbumDetails.css';

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

	const creditRows = [
		{ label: 'Produced by', value: album?.producers, links: album?.producerLinks },
		{ label: 'Written by', value: album?.writers, links: album?.writerLinks },
	].filter((row) => row.value);

	return (
		<section className="album-details-section">
			{(album?.aboutText || creditRows.length > 0) && (
				<div className="album-details-copy">
					<h2 className="album-details-heading">About</h2>
					{album?.aboutText && <p className="album-details-text">{album.aboutText}</p>}
					{creditRows.length > 0 && (
						<div className="album-details-list">
							{creditRows.map((row) => (
								<div key={row.label} className="album-details-row">
									<span className="album-details-label">{row.label}</span>
									<span className="album-details-value">
										{formatLinkedNames(row.value, row.links)}
									</span>
								</div>
							))}
						</div>
					)}
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

			{!album?.aboutText && creditRows.length === 0 && details.length === 0 && (
				<p className="album-details-empty">More album information will show up here.</p>
			)}
		</section>
	);
}

function formatAlbumType(type) {
	if (!type) return null;
	return type.charAt(0) + type.slice(1).toLowerCase();
}

function formatLinkedNames(value, links) {
	const items = Array.isArray(links) && links.length > 0
		? links
		: String(value)
			.split(';')
			.map((name) => ({ name: name.trim(), slug: null }))
			.filter((item) => item.name);

	return items.map((item, index) => (
		<span key={item.name}>
			{index > 0 && ', '}
			{item.slug ? <Link to={`/artists/${item.slug}`}>{item.name}</Link> : item.name}
		</span>
	));
}
