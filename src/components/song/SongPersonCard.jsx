/**
 * Small linked credit card for people shown on song/release pages.
 */
import { Link } from 'react-router-dom';
import '../../styles/SongHeader.css';

function personImageSrc(person) {
	return person?.image?.previewUrl || person?.image?.url || person?.portrait || '';
}

export default function SongPersonCard({ person, label }) {
	const name = person?.name;
	if (!name) return null;

	const imageSrc = personImageSrc(person);
	const inner = (
		<>
			<span className="song-person-card-image-wrap">
				{imageSrc ? (
					<img src={imageSrc} alt={name} className="song-person-card-image" />
				) : (
					<span className="song-person-card-image-blank" />
				)}
			</span>
			<span className="song-person-card-copy">
				{label ? <span className="song-person-card-role">{label}</span> : null}
				<span className="song-person-card-name">{name}</span>
			</span>
		</>
	);

	if (person.slug) {
		return (
			<Link to={`/artists/${person.slug}`} className="song-person-card">
				{inner}
			</Link>
		);
	}

	if (person.externalUrl) {
		return (
			<a href={person.externalUrl} target="_blank" rel="noopener noreferrer" className="song-person-card">
				{inner}
			</a>
		);
	}

	return (
		<span className="song-person-card">
			{inner}
		</span>
	);
}
