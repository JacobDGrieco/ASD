/**
 * Public card for fashion talent list and featured talent sections.
 */
import { Link } from 'react-router-dom';
import '../../styles/ContentCard.css';

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
		<Link to={`/fashion/talent/${talent.slug}`} className={`content-card-card${talent.isVisible === false ? ' content-card-hidden' : ''}`}>
			<div className="content-card-primary-action">
				<div className="content-card-cover-wrap">
					{image ? (
						<img src={image.previewUrl || image.url} alt={talent.name} className="content-card-cover" />
					) : (
						<div className="content-card-cover-blank" />
					)}
				</div>
				<div className="content-card-info">
					<span className="content-card-title">{talent.name}</span>
					<span className="content-card-meta">{ROLE_LABEL[talent.role] ?? talent.role}</span>
				</div>
			</div>
		</Link>
	);
}
