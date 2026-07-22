/**
 * Public card for a fashion look in catalogue and collection grids.
 */
import { Link } from 'react-router-dom';
import '../../styles/ContentCard.css';

export default function LookCard({ look }) {
	const image = look.images?.[0];

	return (
		<Link to={`/fashion/looks/${look.slug}`} className={`content-card-card${look.isVisible === false ? ' content-card-hidden' : ''}`}>
			<div className="content-card-primary-action">
				<div className="content-card-cover-wrap">
					{image ? (
						<img src={image.previewUrl || image.url} alt={look.title} className="content-card-cover" />
					) : (
						<div className="content-card-cover-blank" />
					)}
				</div>
				<div className="content-card-info">
					<span className="content-card-title">{look.title}</span>
					<span className="content-card-meta">{look.pieces?.length ?? 0} piece{(look.pieces?.length ?? 0) === 1 ? '' : 's'}</span>
				</div>
			</div>
		</Link>
	);
}
