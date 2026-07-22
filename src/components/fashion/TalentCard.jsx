import { Link } from 'react-router-dom';
import '../../styles/AlbumCard.css';

const ROLE_LABEL = {
	MODEL: 'Model',
	DESIGNER: 'Designer',
	PHOTOGRAPHER: 'Photographer',
	EDITOR: 'Photo Editor',
	STYLIST: 'Stylist',
	OTHER: 'Other',
};

export default function TalentCard({ talent }) {
	const image = talent.images?.[0];

	return (
		<Link to={`/fashion/talent/${talent.slug}`} className={`album-card-card${talent.isVisible === false ? ' album-card-hidden' : ''}`}>
			<div className="album-card-primary-action">
				<div className="album-card-cover-wrap">
					{image ? (
						<img src={image.previewUrl || image.url} alt={talent.name} className="album-card-cover" />
					) : (
						<div className="album-card-cover-blank" />
					)}
				</div>
				<div className="album-card-info">
					<span className="album-card-title">{talent.name}</span>
					<span className="album-card-meta">{ROLE_LABEL[talent.role] ?? talent.role}</span>
				</div>
			</div>
		</Link>
	);
}
