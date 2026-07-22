/**
 * Public card for a fashion collection or loose-look grouping.
 */
import { Link } from 'react-router-dom';
import '../../styles/ContentCard.css';

export default function CollectionCard({ collection, isOpen, onClick, to, metaOverride }) {
	const coverImg = collection.coverImage;
	const isLoose = collection.collectionType === 'LOOSE_LOOK' || collection.catalogueType === 'loose';
	const isHidden = collection.isVisible === false || (isLoose && collection.linkedLook?.isVisible === false);
	const lookCount = collection.looks?.length ?? 0;
	const meta = metaOverride ?? [
		isLoose ? 'Loose' : 'Collection',
		collection.season,
		isLoose ? null : `${lookCount} look${lookCount === 1 ? '' : 's'}`,
	].filter(Boolean).join(' - ');

	const content = (
		<>
			<div className="content-card-cover-wrap">
				{coverImg ? (
					<img
						src={coverImg.previewUrl || coverImg.url}
						alt={collection.title}
						className="content-card-cover"
					/>
				) : (
					<div className="content-card-cover-blank" />
				)}
			</div>
			<div className="content-card-info">
				<span className="content-card-title">{collection.title}</span>
				<span className="content-card-meta">{meta}</span>
			</div>
		</>
	);

	if (to) {
		return (
			<Link to={to} className={`content-card-card${isOpen ? ' content-card-open' : ''}${isHidden ? ' content-card-hidden' : ''}`}>
				<div className="content-card-primary-action">
					{content}
				</div>
			</Link>
		);
	}

	return (
		<div className={`content-card-card${isOpen ? ' content-card-open' : ''}${isHidden ? ' content-card-hidden' : ''}`}>
			<button type="button" className="content-card-primary-action" onClick={onClick}>
				{content}
			</button>
		</div>
	);
}
