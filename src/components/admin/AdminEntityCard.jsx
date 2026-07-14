import { FaPencilAlt, FaUser } from 'react-icons/fa';
import AdminProfileLinksSummary from './AdminProfileLinksSummary.jsx';

export default function AdminEntityCard({
	image,
	imageCount = 1,
	isHidden = false,
	title,
	subtitle,
	links,
	showLinksSummary = true,
	onEdit,
	editDisabled = false,
	editAriaLabel = 'Edit',
	draggable = false,
	onDragStart,
	onDragOver,
	onDrop,
	onDragEnd,
	isDropTarget = false,
	footer,
}) {
	return (
		<div
			className={[
				'admin-entity-card',
				draggable ? 'admin-entity-card-draggable' : '',
				isHidden ? 'admin-entity-card-hidden' : '',
				isDropTarget ? 'admin-entity-card-drop-target' : '',
			].filter(Boolean).join(' ')}
			draggable={draggable}
			onDragStart={onDragStart}
			onDragOver={onDragOver}
			onDrop={onDrop}
			onDragEnd={onDragEnd}
		>
			<div className="admin-entity-card-image-wrap">
				{image ? (
					<img src={image} alt={title} className="admin-entity-card-image" />
				) : (
					<div className="admin-entity-card-image-placeholder" aria-hidden="true">
						<FaUser />
					</div>
				)}
				{imageCount > 1 && (
					<span className="admin-entity-card-chip admin-entity-card-chip-left">{imageCount} images</span>
				)}
				{onEdit && (
					<button
						type="button"
						onClick={onEdit}
						onMouseDown={(event) => event.stopPropagation()}
						disabled={editDisabled}
						className="admin-entity-card-chip admin-entity-card-chip-right admin-entity-card-edit-btn"
						aria-label={editAriaLabel}
						title="Edit"
					>
						<FaPencilAlt aria-hidden="true" />
					</button>
				)}
			</div>
			<div className="admin-entity-card-body">
				<span className="admin-entity-card-title">{title}</span>
				{subtitle && <span className="admin-entity-card-subtitle">{subtitle}</span>}
				{showLinksSummary && <AdminProfileLinksSummary links={links} />}
				{footer}
			</div>
		</div>
	);
}
