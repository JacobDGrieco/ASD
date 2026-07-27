/**
 * Floating annotation detail panel used by the public lyrics view.
 */
import { FaTimes } from 'react-icons/fa';
import '../../styles/AnnotationPopup.css';

export default function AnnotationPopup({ annotation, className = '', id, onClose, placement = 'below', style }) {
	return (
		<div
			id={id}
			className={`annotation-popup-popup annotation-popup-${placement} ${className}`.trim()}
			role="dialog"
			aria-label="Lyric annotation"
			style={style}
		>
			<button
				type="button"
				className="annotation-popup-close"
				onClick={onClose}
				aria-label="Close annotation"
				title="Close"
			>
				<FaTimes aria-hidden="true" />
			</button>
			<p className="annotation-popup-text">{annotation.explanation}</p>
		</div>
	);
}
